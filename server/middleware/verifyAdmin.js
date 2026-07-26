import jwt from "jsonwebtoken";
import Admin from "../models/Admin.js";
import { isAllowedAdminEmail } from "../utils/adminAllowlist.js";

// ── verifyAdmin ──────────────────────────────────────────────
// Protects every admin API route mounted under the secret path
// (Prompt 08 onward) except: /login, /register, /verify-code,
// /resend-code, /auth/google, /auth/google/callback.
//
// Reads the httpOnly cookie (name varies: "__Host-adminToken" in
// production, "adminToken" in development), verifies the JWT, and
// loads the Admin document onto req.admin.
//
// Distinguishes between expired tokens (TokenExpiredError) and
// invalid/tampered tokens so the frontend can show a meaningful
// "session expired" message rather than a generic auth error.
export async function verifyAdmin(req, res, next) {
  try {
    // Support both prod (__Host- prefix) and dev cookie names
    const token =
      req.cookies?.["__Host-adminToken"] ?? req.cookies?.adminToken;

    if (!token) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // Distinguish expired vs invalid so the frontend can react appropriately
      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          message: "Session expired. Please log in again.",
          expired: true,
        });
      }
      // Covers JsonWebTokenError (bad signature, malformed, etc.)
      return res.status(401).json({ message: "Not authenticated" });
    }

    const admin = await Admin.findById(decoded.adminId).select(
      "-password -verificationCode -verificationExpires"
    );

    if (!admin) {
      // Admin was deleted after the token was issued
      return res.status(401).json({ message: "Not authenticated" });
    }

    // ── Allowlist gate (checked on EVERY request, not just login) ───────
    // A JWT is valid for up to 7 days. Without this check, revoking an
    // admin's access (by removing them from ADMIN_ALLOWED_EMAILS) would
    // only take effect once their existing cookie naturally expired.
    // Checking here means revocation is effective on their very next
    // request, regardless of how much time is left on the token.
    if (!isAllowedAdminEmail(admin.email)) {
      return res.status(401).json({ message: "Not authenticated" });
    }

    req.admin = admin;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Not authenticated" });
  }
}

export default verifyAdmin;
