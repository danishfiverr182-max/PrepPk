/**
 * controllers/userAuthController.js
 *
 * Handles premium user login, session check (/me), access verification
 * (/check-access), and logout.
 * login and me responses return: { id, email, expiresAt, isActive }.
 * Expiry is checked before password verification   expired users never receive a JWT.
 */

import jwt from "jsonwebtoken";
import crypto from "crypto";
import PremiumUser from "../models/PremiumUser.js";

const SESSION_MESSAGE =
  "This account is already logged in on another device. Please log out from the other device before logging in here.";
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days   matches JWT expiry

// POST /api/user/auth/login
export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email and password are required." });
    }

    const user = await PremiumUser.findOne({ email: email.toLowerCase() }).select(
      "+activeSessionId +activeSessionExpiresAt"
    );
    if (!user) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!user.isActive) {
      return res
        .status(403)
        .json({ message: "Your account has been deactivated. Contact admin." });
    }

    // Check account lock (failed login attempts)
    if (user.isLocked && user.isLocked()) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(403).json({
        message: `Too many failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    // Expiry check BEFORE password verification   do not issue a JWT to expired users.
    if (user.isExpired()) {
      return res.status(403).json({
        message: "Your access has expired. Please contact the admin to renew your subscription.",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      if (user.recordFailedLogin) await user.recordFailedLogin();
      return res.status(401).json({ message: "Invalid email or password." });
    }

    // Reset failed attempts on successful login
    if (user.resetLoginAttempts) await user.resetLoginAttempts();

    // ── Single-active-session check ─────────────────────────────────────
    // Credentials are valid at this point, so it's safe to reveal that the
    // account is already in use elsewhere without leaking info to guessers.
    //
    // The intent is to block the SAME credentials being used to log in on
    // two different DEVICES at once — not to block a second tab on the
    // same device. Cookies are shared across every tab of one browser but
    // never shared across different browsers/devices, so the userToken
    // cookie already on this request (if any) is exactly the right signal
    // for "is this the same device that owns the active session". Without
    // this check, a second tab on the very same device calling /login
    // looks identical to a totally different device — both are just "a
    // login attempt while a session is already active" — so it was being
    // rejected too.
    let sameDeviceReLogin = false;
    const existingToken = req.cookies?.userToken;
    if (existingToken && user.activeSessionId) {
      try {
        const decodedExisting = jwt.verify(existingToken, process.env.JWT_SECRET);
        if (
          String(decodedExisting.id) === String(user._id) &&
          decodedExisting.sid === user.activeSessionId
        ) {
          sameDeviceReLogin = true;
        }
      } catch {
        // Missing/expired/foreign cookie — treat as a normal login attempt.
      }
    }

    // Claiming is done as one atomic findOneAndUpdate (rather than a
    // read-then-write) so that two near-simultaneous login requests from
    // different devices can't both pass the check and both win a session.
    const sessionId = sameDeviceReLogin ? user.activeSessionId : crypto.randomUUID();
    const sessionExpiresAt = new Date(Date.now() + SESSION_MAX_AGE_MS);

    const claimed = sameDeviceReLogin
      ? // Same device that already owns the session: just extend it. Reusing
        // the same sessionId (rather than minting a new one) means any other
        // tab on this device stays valid too, instead of being kicked out.
        await PremiumUser.findOneAndUpdate(
          { _id: user._id, activeSessionId: user.activeSessionId },
          { activeSessionExpiresAt: sessionExpiresAt },
          { new: true }
        )
      : await PremiumUser.findOneAndUpdate(
          {
            _id: user._id,
            $or: [
              { activeSessionId: null },
              { activeSessionExpiresAt: { $lte: new Date() } },
            ],
          },
          { activeSessionId: sessionId, activeSessionExpiresAt: sessionExpiresAt },
          { new: true }
        );

    if (!claimed) {
      return res.status(409).json({ code: "SESSION_ACTIVE", message: SESSION_MESSAGE });
    }

    const token = jwt.sign(
      { id: user._id, role: "user", sid: sessionId },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("userToken", token, {
      httpOnly: true,
      secure:   process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge:   7 * 24 * 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      user: {
        id:        user._id,
        email:     user.email,
        expiresAt: user.expiresAt,
        isActive:  user.isActive,
        // Cosmetic-only: which category nav links to briefly highlight
        // after login. Does not affect access   see PremiumUser model.
        favoriteCategories: user.favoriteCategories || [],
      },
    });
  } catch (err) {
    console.error("user login error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// GET /api/user/auth/me    requires userProtect middleware
export async function me(req, res) {
  try {
    const user = req.user;
    return res.json({
      id:        user.id,
      email:     user.email,
      expiresAt: user.expiresAt,
      isActive:  user.isActive,
      favoriteCategories: user.favoriteCategories || [],
    });
  } catch (err) {
    console.error("user me error:", err);
    return res.status(500).json({ message: "Server error." });
  }
}

// GET /api/user/auth/check-access    requires userProtect middleware
// If middleware passes, the user is logged in and not expired → grant access.
// 401/403 responses are handled by the middleware itself before this runs.
export async function checkAccess(_req, res) {
  return res.json({ hasAccess: true });
}

// POST /api/user/auth/logout
// Releases the account's active session (if this device is the one that
// holds it) so the account becomes loggable-in-elsewhere again, then clears
// the cookie regardless of whether a session was found.
export async function logout(req, res) {
  try {
    const token = req.cookies?.userToken;
    if (token) {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        if (decoded?.id && decoded?.sid) {
          // Only clear the session if it still belongs to this device's
          // token   avoids a stale/duplicated cookie clearing someone
          // else's freshly-claimed session.
          await PremiumUser.updateOne(
            { _id: decoded.id, activeSessionId: decoded.sid },
            { activeSessionId: null, activeSessionExpiresAt: null }
          );
        }
      } catch {
        // Invalid/expired token   nothing to release, just clear the cookie.
      }
    }
  } catch (err) {
    console.error("user logout error:", err);
  }

  res.clearCookie("userToken", { httpOnly: true, sameSite: "lax" });
  return res.json({ success: true, message: "Logged out." });
}