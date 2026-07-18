/**
 * controllers/premiumUserController.js
 *
 * Premium users have access to ALL categories   no per-category access control.
 * createUser: accepts email, duration, notes, plainPassword.
 * getUser: returns id, email, expiresAt, isActive, plus admin-facing fields.
 * getAllUsers, deleteUser, resetPassword, extendUser, retrievePassword unchanged.
 */

import PremiumUser from "../models/PremiumUser.js";
import { generateUserPassword } from "../utils/passwordGenerator.js";

// Helper: calculate expiresAt + label from duration string
function calcExpiry(duration) {
  const now = Date.now();
  if (duration === "1-week")
    return { expiresAt: new Date(now + 7 * 24 * 60 * 60 * 1000), label: "1 Week" };
  if (duration === "1-month")
    return { expiresAt: new Date(now + 30 * 24 * 60 * 60 * 1000), label: "1 Month" };
  throw new Error("Invalid duration");
}

// POST /api/admin/users  admin only
export async function createUser(req, res) {
  try {
    const {
      email,
      duration,
      notes,
      plainPassword: clientPassword,
      favoriteCategories,
    } = req.body;

    // ── Validate required fields ──────────────────────────
    if (!email || !duration) {
      return res.status(400).json({ message: "Email and duration are required." });
    }

    // Simple email format check
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return res.status(400).json({ message: "Please enter a valid email address." });
    }

    // ── Duplicate email check ─────────────────────────────
    const existing = await PremiumUser.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: "This email already has an account." });
    }

    // ── Duration ──────────────────────────────────────────
    let expiresAt, durationLabel;
    try {
      ({ expiresAt, label: durationLabel } = calcExpiry(duration));
    } catch {
      return res
        .status(400)
        .json({ message: "Invalid duration. Use '1-week' or '1-month'." });
    }

    // ── Password ──────────────────────────────────────────
    const plainPassword =
      clientPassword && clientPassword.trim()
        ? clientPassword.trim()
        : generateUserPassword();

    // Favorite categories are cosmetic-only (see model comment) — just
    // sanitize to an array of non-empty strings, no need to validate
    // against real category slugs; an unmatched slug is simply skipped
    // by the frontend highlight logic later.
    const safeFavoriteCategories = Array.isArray(favoriteCategories)
      ? favoriteCategories.filter((s) => typeof s === "string" && s.trim()).map((s) => s.trim())
      : [];

    // ── Create user ───────────────────────────────────────
    const user = await PremiumUser.create({
      email:                email.toLowerCase().trim(),
      password:             plainPassword,   // pre-save hook hashes it
      plainPasswordForAdmin: plainPassword,  // cleared after 24h by cleanup job
      duration,
      expiresAt,
      notes: notes || "",
      favoriteCategories: safeFavoriteCategories,
    });

    return res.status(201).json({
      success: true,
      credentials: {
        email:         user.email,
        password:      plainPassword,
        expiresAt:     user.expiresAt,
        durationLabel,
      },
    });
  } catch (err) {
    console.error("createUser error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// GET /api/admin/users  admin only
// Supports ?page=1&limit=15&search=email_fragment
export async function getAllUsers(req, res) {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.max(1, parseInt(req.query.limit) || 15);
    const search = (req.query.search || "").trim();

    const filter = search
      ? { email: { $regex: search, $options: "i" } }
      : {};

    const total      = await PremiumUser.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);
    const skip       = (page - 1) * limit;

    const rawUsers = await PremiumUser.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-password")
      .lean();

    const now   = new Date();
    const users = rawUsers.map((u) => ({
      ...u,
      isExpired:        u.expiresAt < now,
      hasPlainPassword: !!u.plainPasswordForAdmin,
    }));

    return res.json({ users, total, page, totalPages });
  } catch (err) {
    console.error("getAllUsers error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// GET /api/admin/users/:userId  admin only
export async function getUser(req, res) {
  try {
    const user = await PremiumUser.findById(req.params.userId)
      .select("-password +activeSessionId +activeSessionExpiresAt")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found." });

    const hasActiveSession =
      !!user.activeSessionId &&
      !!user.activeSessionExpiresAt &&
      new Date(user.activeSessionExpiresAt) > new Date();

    return res.json({
      _id:             user._id,
      email:           user.email,
      expiresAt:       user.expiresAt,
      isActive:        user.isActive,
      isExpired:       user.expiresAt < new Date(),
      createdAt:       user.createdAt,
      notes:           user.notes,
      duration:        user.duration,
      favoriteCategories: user.favoriteCategories || [],
      hasPlainPassword: !!user.plainPasswordForAdmin,
      hasActiveSession,
    });
  } catch (err) {
    console.error("getUser error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// POST /api/admin/users/:userId/force-logout  admin only
// Releases the account's active session (e.g. user lost their device or
// can't reach it to log out) so it can be logged into elsewhere immediately,
// instead of waiting out the remaining token lifetime.
export async function forceLogout(req, res) {
  try {
    const user = await PremiumUser.findById(req.params.userId).select(
      "+activeSessionId +activeSessionExpiresAt"
    );
    if (!user) return res.status(404).json({ message: "User not found." });

    await user.endSession();

    return res.json({ success: true, message: "Session cleared. The user can log in on a new device now." });
  } catch (err) {
    console.error("forceLogout error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// GET /api/admin/users/:userId/retrieve-password  admin only
export async function retrievePassword(req, res) {
  try {
    const user = await PremiumUser.findById(req.params.userId)
      .select("plainPasswordForAdmin")
      .lean();

    if (!user) return res.status(404).json({ message: "User not found." });

    if (user.plainPasswordForAdmin) {
      return res.json({ password: user.plainPasswordForAdmin });
    }

    return res.json({
      password: null,
      message: "Plain password expired. Use Reset Password to generate a new one.",
    });
  } catch (err) {
    console.error("retrievePassword error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// DELETE /api/admin/users/:id  admin only
export async function deleteUser(req, res) {
  try {
    const user = await PremiumUser.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: "User not found." });
    return res.json({ success: true, message: "User deleted." });
  } catch (err) {
    console.error("deleteUser error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// POST /api/admin/users/:userId/reset-password  admin only
export async function resetPassword(req, res) {
  try {
    const user = await PremiumUser.findById(req.params.userId);
    if (!user) return res.status(404).json({ message: "User not found." });

    const newPassword         = generateUserPassword();
    user.password             = newPassword;
    user.plainPasswordForAdmin = newPassword;
    await user.save();

    return res.json({ email: user.email, newPassword });
  } catch (err) {
    console.error("resetPassword error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// PATCH /api/admin/users/:id/extend  admin only
export async function extendUser(req, res) {
  try {
    const raw = req.body.durationKey || req.body.duration;

    const duration =
      raw === "1week"  ? "1-week"  :
      raw === "1month" ? "1-month" :
      raw;

    let expiresAt, durationLabel;
    try {
      const result  = calcExpiry(duration);
      expiresAt     = result.expiresAt;
      durationLabel = result.label;
    } catch {
      return res
        .status(400)
        .json({ message: "Invalid duration. Use '1week' or '1month'." });
    }

    const user = await PremiumUser.findByIdAndUpdate(
      req.params.id,
      { duration, expiresAt },
      { new: true, select: "-password -plainPasswordForAdmin" }
    );

    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({
      success:       true,
      email:         user.email,
      expiresAt:     user.expiresAt,
      isExpired:     user.expiresAt < new Date(),
      durationLabel,
    });
  } catch (err) {
    console.error("extendUser error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// PATCH /api/admin/users/:id/favorite-categories  admin only
// Cosmetic-only (see PremiumUser model comment)   updates which category
// nav links briefly highlight for this user after login. Does NOT change
// what the user can access; every premium user can already reach every
// category regardless of this list.
export async function updateFavoriteCategories(req, res) {
  try {
    const { favoriteCategories } = req.body;

    if (!Array.isArray(favoriteCategories)) {
      return res.status(400).json({ message: "favoriteCategories must be an array." });
    }

    const safe = favoriteCategories
      .filter((s) => typeof s === "string" && s.trim())
      .map((s) => s.trim());

    const user = await PremiumUser.findByIdAndUpdate(
      req.params.id,
      { favoriteCategories: safe },
      { new: true, select: "favoriteCategories" }
    );

    if (!user) return res.status(404).json({ message: "User not found." });

    return res.json({ success: true, favoriteCategories: user.favoriteCategories });
  } catch (err) {
    console.error("updateFavoriteCategories error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}
