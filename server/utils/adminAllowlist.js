/**
 * utils/adminAllowlist.js
 *
 * Hard allowlist of the ONLY email addresses ever allowed to hold admin
 * access — regardless of how someone reaches the admin auth endpoints
 * (manual /register, Google OAuth, or a stray Admin document already sitting
 * in the database from before this allowlist existed).
 *
 * Where the list lives:
 *   ADMIN_ALLOWED_EMAILS in .env — a comma-separated list, e.g.
 *     ADMIN_ALLOWED_EMAILS=admin1@gmail.com,admin2@gmail.com
 *   This is intentionally an env var, not a hardcoded array in source:
 *     - .env is git-ignored, so the real addresses never touch the repo.
 *     - It's never sent to the client in any API response.
 *     - Changing who's allowed (e.g. revoking an email) is a config change
 *       on the server (Railway), not a code deploy.
 *
 * This module is checked at every entry point that could ever grant or use
 * admin access: /register, the Google OAuth strategy, /login, AND on every
 * authenticated request via verifyAdmin/protect. Checking it on every
 * request (not just at login) matters: if you remove an email from
 * ADMIN_ALLOWED_EMAILS, that person's *already-issued* JWT (valid for up to
 * 7 days) is rejected on their very next request instead of continuing to
 * work until it naturally expires.
 */

let cachedList = null;

function parseAllowlist() {
  const raw = process.env.ADMIN_ALLOWED_EMAILS || "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Returns the parsed allowlist (cached after first read). */
export function getAdminAllowlist() {
  if (cachedList === null) {
    cachedList = parseAllowlist();
  }
  return cachedList;
}

/** Case/whitespace-insensitive membership check. */
export function isAllowedAdminEmail(email) {
  if (!email) return false;
  const normalized = String(email).trim().toLowerCase();
  return getAdminAllowlist().includes(normalized);
}

/**
 * For logging: never print the full allowlist (that's the thing we're
 * trying to keep out of logs an attacker or a log-aggregation vendor might
 * see). Only ever log the ATTEMPTED email (useful for noticing intrusion
 * attempts) — never the list of what's actually allowed.
 */
export function maskEmail(email) {
  if (!email) return "(none)";
  const [local, domain] = String(email).split("@");
  if (!domain) return "***";
  const maskedLocal =
    local.length <= 2 ? "*".repeat(local.length) : local[0] + "***" + local[local.length - 1];
  return `${maskedLocal}@${domain}`;
}
