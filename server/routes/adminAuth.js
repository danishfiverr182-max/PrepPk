import { Router } from "express";
import { body, validationResult } from "express-validator";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import passport from "../config/passport.js";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import { loginLimiter, codeLimiter } from "../middleware/rateLimiter.js";
import Admin from "../models/Admin.js";
import { sendVerificationEmail } from "../utils/email.js";
import { createAndSendToken } from "../utils/createAndSendToken.js";
import { isAllowedAdminEmail, maskEmail } from "../utils/adminAllowlist.js";

const router = Router();

// ── In-memory pending registrations ──────────────────────────
// Keyed by email (lowercase).
// Each entry: { hashedCode, expiresAt, name, passwordHash }
// Raw code and raw password are NEVER stored here.
const pendingMap = new Map();
const PENDING_TTL_MS = 10 * 60 * 1000; // 10 minutes

function schedulePendingExpiry(emailLower) {
  const timer = setTimeout(() => pendingMap.delete(emailLower), PENDING_TTL_MS);
  if (timer.unref) timer.unref();
  return timer;
}

// ── Health check ──────────────────────────────────────────────
router.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// ── POST /register ────────────────────────────────────────────
router.post(
  "/register",
  [
    body("fullName")
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage("Full name must be between 2 and 100 characters."),
    body("email")
      .trim()
      .toLowerCase()
      .isEmail()
      .withMessage("Please enter a valid email address."),
    body("password")
      .isLength({ min: 8 })
      .withMessage("Password must be at least 8 characters."),
    body("confirmPassword").custom((value, { req }) => {
      if (value !== req.body.password) throw new Error("Passwords do not match.");
      return true;
    }),
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).json({
        message: errors.array()[0].msg,
        errors: errors.array(),
      });
    }

    const { fullName, email, password } = req.body;
    const emailLower = email.toLowerCase().trim();

    // ── Allowlist gate ──────────────────────────────────────────────────
    // This is the actual security boundary, not the secret URL. Reject
    // BEFORE checking Mongo or sending any email, and use a message that
    // doesn't confirm/deny whether an allowlist even exists — same generic
    // wording either way, so an attacker probing this endpoint learns
    // nothing about which emails (if any) would have worked.
    if (!isAllowedAdminEmail(emailLower)) {
      console.warn(`[register] Blocked registration attempt for non-allowlisted email: ${maskEmail(emailLower)}`);
      return res.status(403).json({
        message: "Registration is not available for this account.",
      });
    }

    try {
      // 1 Check for an already-verified admin
      const existing = await Admin.findOne({ email: emailLower });
      if (existing && existing.isVerified) {
        return res.status(409).json({
          message: "An account with this email already exists. Please log in.",
        });
      }

      // 2 Check for an active pending entry
      const alreadyPending = pendingMap.get(emailLower);
      if (alreadyPending && alreadyPending.expiresAt > Date.now()) {
        return res.status(409).json({
          message:
            "A verification code was already sent to this email. Please check your inbox or wait 10 minutes to try again.",
        });
      }

      // 3 Generate a cryptographically secure 6-digit code
      const rawCode = crypto.randomInt(100000, 999999).toString();

      // 4 Hash the code (so a DB/memory leak never exposes raw codes)
      const hashedCode = await bcrypt.hash(rawCode, 10);

      // 5 Hash the password now so Prompt 04 can just save the Admin doc
      const passwordHash = await bcrypt.hash(password, 12);

      // 6 Store in pendingMap (raw code is NEVER stored)
      pendingMap.set(emailLower, {
        hashedCode,
        expiresAt: Date.now() + PENDING_TTL_MS,
        name: fullName,
        passwordHash,
      });
      schedulePendingExpiry(emailLower);

      // 7 Send email (raw code goes straight to the email, never to logs)
      await sendVerificationEmail(emailLower, rawCode, fullName);

      // Server log confirm action without leaking anything sensitive
      console.log(`[register] Verification email dispatched → ${emailLower} (code hashed, raw discarded)`);

      return res.status(200).json({ pending: true, email: emailLower });
    } catch (err) {
      console.error("Register error:", err.message);
      return res.status(500).json({ message: "Server error. Please try again." });
    }
  }
);

// ── POST /resend-code ─────────────────────────────────────────
// codeLimiter: 5 requests per 10 minutes per IP
// Re-generates a fresh code and resets the 10-minute timer.
router.post("/resend-code", codeLimiter, async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(422).json({ message: "Email is required." });
  }

  const emailLower = email.toLowerCase().trim();
  const pending = pendingMap.get(emailLower);

  if (!pending) {
    return res.status(400).json({
      message: "No pending registration found for this email. Please sign up again.",
    });
  }

  try {
    // Generate a fresh code
    const rawCode = crypto.randomInt(100000, 999999).toString();
    const hashedCode = await bcrypt.hash(rawCode, 10);

    // Update the map keep existing name & passwordHash, refresh code + timer
    pendingMap.set(emailLower, {
      ...pending,
      hashedCode,
      expiresAt: Date.now() + PENDING_TTL_MS,
    });
    schedulePendingExpiry(emailLower);

    await sendVerificationEmail(emailLower, rawCode, pending.name);

    console.log(`[resend-code] Fresh code dispatched → ${emailLower}`);

    return res.status(200).json({ message: "A new verification code has been sent." });
  } catch (err) {
    console.error("Resend-code error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /verify-code ─────────────────────────────────────────
// codeLimiter: 5 requests per 10 minutes per IP
// Full implementation will be completed in Prompt 04.
// Stub validates the code and creates the Admin document.
router.post("/verify-code", codeLimiter, async (req, res) => {
  const { email, code } = req.body;

  if (!email || !code) {
    return res.status(422).json({ message: "Email and code are required." });
  }

  const emailLower = email.toLowerCase().trim();
  const pending = pendingMap.get(emailLower);

  if (!pending) {
    return res.status(400).json({
      message: "Code expired or not found. Please register again.",
    });
  }

  if (Date.now() > pending.expiresAt) {
    pendingMap.delete(emailLower);
    return res.status(400).json({
      message: "Code expired or not found. Please register again.",
    });
  }

  // Compare submitted code against the stored hash
  const isMatch = await bcrypt.compare(String(code).trim(), pending.hashedCode);
  if (!isMatch) {
    return res.status(400).json({ message: "Invalid verification code." });
  }

  try {
    // Create the Admin password is already hashed
    const admin = new Admin({
      fullName: pending.name,
      email: emailLower,
      password: pending.passwordHash, // pre-hashed
      isVerified: true,
    });

    // Skip double-hashing: tell the pre-save hook the password is already hashed
    admin._passwordAlreadyHashed = true;
    await admin.save();

    pendingMap.delete(emailLower);

    console.log(`[verify-code] Admin account created → ${emailLower}`);

    return createAndSendToken(admin, res);
  } catch (err) {
    console.error("Verify-code error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── POST /login ───────────────────────────────────────────────
// loginLimiter: 10 requests per 15 minutes per IP (brute-force protection)
router.post("/login", loginLimiter, async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(422).json({ message: "Email and password are required." });
  }

  const emailLower = email.toLowerCase().trim();

  // ── Allowlist gate ──────────────────────────────────────────────────
  // Defense-in-depth: even if an Admin document already exists for this
  // email (e.g. it was created before this allowlist existed, or was later
  // revoked), login is refused unless the email is currently allow-listed.
  if (!isAllowedAdminEmail(emailLower)) {
    console.warn(`[login] Blocked login attempt for non-allowlisted email: ${maskEmail(emailLower)}`);
    return res.status(401).json({ message: "Invalid email or password." });
  }

  try {
    const admin = await Admin.findOne({ email: emailLower });

    if (!admin) {
      return res.status(401).json({ message: "Invalid email or password." });
    }

    if (!admin.isVerified) {
      return res.status(403).json({ message: "Please verify your email before logging in." });
    }

    if (admin.isLocked) {
      const minutesLeft = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000);
      return res.status(429).json({
        message: `Account locked. Try again after ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
      });
    }

    const isMatch = await admin.comparePassword(password);
    if (!isMatch) {
      await admin.incFailedAttempts();

      if (admin.isLocked) {
        const minutesLeft = Math.ceil((admin.lockUntil.getTime() - Date.now()) / 60000);
        return res.status(429).json({
          message: `Account locked. Try again after ${minutesLeft} minute${minutesLeft === 1 ? "" : "s"}.`,
        });
      }

      return res.status(401).json({ message: "Invalid email or password." });
    }

    await admin.resetFailedAttempts();

    return createAndSendToken(admin, res);
  } catch (err) {
    console.error("Login error:", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ── Google OAuth ─────────────────────────────────────────────
// GET /auth/google kicks off the OAuth redirect flow.
// loginLimiter applied here to prevent abuse of the OAuth button.
router.get(
  "/auth/google",
  loginLimiter,
  passport.authenticate("google", { scope: ["profile", "email"], session: true })
);

// GET /auth/google/callback Passport handles the code exchange.
// On success: sign our own JWT cookie (same shape as manual login) and
// redirect to the dashboard. On failure: bounce back to the login page.
router.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: true,
    failureRedirect: `${process.env.FRONTEND_URL || "http://localhost:5173"}${process.env.ADMIN_SECRET_PATH || "/admin-x9k2"}?error=oauth_failed`,
  }),
  (req, res) => {
    // req.user is the Admin document set by passport's deserializeUser/done()
    const token = jwt.sign(
      { adminId: req.user._id, email: req.user.email },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // Match the __Host- prefix logic used in createAndSendToken
    const COOKIE_NAME =
      process.env.NODE_ENV === "production" ? "__Host-adminToken" : "adminToken";

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000,
      // Do NOT set `domain` required for __Host- prefix
    });

    const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
    return res.redirect(`${FRONTEND_URL}/admin/dashboard`);
  }
);

// ── GET /me ────────────────────────────────────────────────────
// Protected by verifyAdmin. Lets the frontend restore session
// state after a page refresh without re-submitting credentials.
router.get("/me", verifyAdmin, (req, res) => {
  return res.json({
    name: req.admin.fullName,
    email: req.admin.email,
    avatar: req.admin.avatar || null,
  });
});

// ── POST /logout ───────────────────────────────────────────────
// Protected by verifyAdmin harmless either way, but good practice
// to keep random visitors from hitting it.
router.post("/logout", verifyAdmin, (_req, res) => {
  const clearOpts = {
    httpOnly: true,
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  };
  // Clear both cookie names so dev sessions don't linger in production and vice-versa
  res.clearCookie("adminToken", clearOpts);
  res.clearCookie("__Host-adminToken", clearOpts);
  return res.status(200).json({ message: "Logged out" });
});

// ── Export the pending map (useful for testing) ───────────────
export { pendingMap };
export default router;
