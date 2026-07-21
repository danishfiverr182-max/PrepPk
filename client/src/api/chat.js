/**
 * src/api/chat.js  (Part 11   Prompt 4 + Prompt 5 feedback endpoint)
 *
 * Talks to POST /api/chat/message and POST /api/chat/feedback. Uses the
 * shared `api` axios instance from src/api/axios.js   same instance every
 * other page/context uses   so it already carries `withCredentials: true`
 * and the `/api` baseURL. withCredentials is what lets the existing
 * `userToken` httpOnly cookie ride along, which is how the backend's
 * optionalUser middleware tells a logged-in premium user apart from a guest.
 */

import api from "./axios";

// ── Fallback messages ────────────────────────────────────────
// Used only if the backend response is missing a `message` field   in
// normal operation the server's own wording (from chatLimiter or
// chatController) is shown instead, since it's already user-friendly.
const RATE_LIMIT_FALLBACK =
  "You're sending messages a bit too fast. Please wait a few minutes and try again.";
const DAILY_CAP_FALLBACK =
  "You've reached today's chat limit. It resets at midnight.";
const BUSY_FALLBACK =
  "The AI assistant is temporarily busy, please try again in a moment.";
const GENERIC_FALLBACK =
  "Something went wrong sending your message. Please try again.";

const GUEST_LIMIT_FALLBACK =
  "You've used your 5 free messages. Log in with Premium to keep chatting.";

export class ChatApiError extends Error {
  constructor(message, { status = null, isDailyCap = false, code = null } = {}) {
    super(message);
    this.name = "ChatApiError";
    this.status = status;
    this.isDailyCap = isDailyCap;
    // Machine-readable code from the server, e.g. "CHAT_GUEST_LIMIT_REACHED".
    // null for the generic/legacy error paths below.
    this.code = code;
  }
}

/**
 * @param {string} message   the new user message
 * @param {Array<{role: "user"|"assistant", content: string}>} history
 * @param {{ categoryName?: string, testName?: string } | null} context
 * @returns {Promise<{ reply: string, model: string, remainingFreeMessages?: number }>}
 *   remainingFreeMessages is only present for guest callers.
 * @throws {ChatApiError}
 */
export async function sendChatMessage(message, history = [], context = null) {
  try {
    const { data } = await api.post("/chat/message", { message, history, context });
    return data;
  } catch (err) {
    const status = err.response?.status;
    const serverMessage = err.response?.data?.message;
    const serverCode = err.response?.data?.code;

    // Guest hit their 5-message lifetime cap. Distinct from the generic
    // 400/429/503 paths below so ChatContext can trigger the upsell/locked
    // UI instead of a normal error bubble.
    if (status === 403 && serverCode === "CHAT_GUEST_LIMIT_REACHED") {
      throw new ChatApiError(serverMessage || GUEST_LIMIT_FALLBACK, {
        status,
        code: serverCode,
      });
    }

    if (status === 429) {
      // Two different 429 sources share this status: chatLimiter (10-min IP
      // window) and the premium daily cap inside chatController. Both
      // already return a friendly `message`; we only distinguish so the UI
      // can decide whether to show a "resets at midnight" tone.
      const isDailyCap = /daily limit/i.test(serverMessage || "");
      throw new ChatApiError(
        serverMessage || (isDailyCap ? DAILY_CAP_FALLBACK : RATE_LIMIT_FALLBACK),
        { status, isDailyCap }
      );
    }

    if (status === 503) {
      throw new ChatApiError(serverMessage || BUSY_FALLBACK, { status });
    }

    if (status === 400) {
      throw new ChatApiError(serverMessage || GENERIC_FALLBACK, { status });
    }

    // Network error, 500, or anything unexpected   never leak raw axios
    // error text to the user.
    throw new ChatApiError(GENERIC_FALLBACK, { status: status ?? null });
  }
}

/**
 * POST /api/chat/feedback  (Part 11   Prompt 5)
 *
 * @param {string} messageSnippet   first ~100 chars of the assistant reply
 *   being rated (also capped server-side regardless of what's sent here)
 * @param {"up"|"down"} rating
 * @returns {Promise<boolean>} true if recorded, false on any failure
 *   (feedback is best-effort   never worth surfacing an error to the user
 *   over a thumbs-up click)
 */
export async function sendChatFeedback(messageSnippet, rating) {
  try {
    await api.post("/chat/feedback", {
      messageSnippet: (messageSnippet || "").slice(0, 100),
      rating,
    });
    return true;
  } catch {
    return false;
  }
}
