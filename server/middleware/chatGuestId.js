/**
 * middleware/chatGuestId.js  (NEW — guest chatbot premium-gating)
 *
 * Assigns a stable anonymous identity to logged-out visitors of the AI
 * chatbot so their lifetime 5-message free cap can't be reset just by
 * closing the tab or reloading the page (which sessionStorage/in-memory
 * counters can't survive) and doesn't depend on IP address (which is
 * shared by many visitors behind NAT/CGNAT and changes across networks).
 *
 * Behaviour:
 *  - If a "chatGuestId" cookie is already present: reuse it, attach to
 *    req.chatGuestId, call next().
 *  - If missing: mint a new crypto.randomUUID(), set it as an httpOnly
 *    cookie with a 1-year maxAge, attach to req.chatGuestId, call next().
 *
 * Cookie option pattern intentionally matches the existing "userToken"
 * cookie (see server/controllers/userAuthController.js) rather than the
 * __Host- prefixed admin cookie (server/utils/createAndSendToken.js) —
 * chatGuestId is a low-sensitivity anonymous identifier, not an auth
 * session token, so the stricter __Host- constraints aren't needed here.
 *
 * Mounted on the chat routes only (see routes/chatRoutes.js), before
 * chatController — it has nothing to do with premium/admin auth and
 * should not run on every request app-wide.
 */

import crypto from "crypto";

const COOKIE_NAME = "chatGuestId";
const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;

export function chatGuestId(req, res, next) {
  let guestId = req.cookies?.[COOKIE_NAME];

  if (!guestId) {
    guestId = crypto.randomUUID();

    res.cookie(COOKIE_NAME, guestId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
      maxAge: ONE_YEAR_MS,
    });
  }

  req.chatGuestId = guestId;
  next();
}
