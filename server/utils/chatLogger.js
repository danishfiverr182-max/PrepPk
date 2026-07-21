/**
 * utils/chatLogger.js  (Part 11   Prompt 2)
 *
 * Writes one anonymized ChatLog row per chatbot request. Never receives or
 * stores message content   only metadata for usage-pattern review in the
 * admin dashboard (Prompt 5).
 *
 * Fire-and-forget by design: a logging failure must never break or delay
 * the chat response the user already got. Errors are swallowed after a
 * single console.error so they show up in server logs without surfacing
 * anywhere near the client.
 */

import ChatLog from "../models/ChatLog.js";

/**
 * @param {Object} entry
 * @param {string} entry.identifier      IP (guest) or PremiumUser id (logged-in)
 * @param {boolean} entry.isPremiumUser
 * @param {string|null} entry.model      model used, or null if never called
 * @param {string|null} [entry.provider] which pool provider served the reply
 *   (Part 12 — Prompt 8), or null if the request never reached the key pool
 * @param {boolean} entry.success
 * @param {number} entry.responseTimeMs
 */
export function logChatUsage({ identifier, isPremiumUser, model, provider, success, responseTimeMs }) {
  // Intentionally not awaited by callers   logging should never add
  // latency to the user-facing response. We still return the promise so
  // tests/callers *can* await it if they want deterministic ordering.
  return ChatLog.create({
    identifier,
    isPremiumUser: Boolean(isPremiumUser),
    model: model || null,
    provider: provider || null,
    success: Boolean(success),
    responseTimeMs,
  }).catch((err) => {
    console.error("[chatLogger] failed to write ChatLog entry:", err.message);
  });
}
