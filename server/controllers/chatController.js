/**
 * controllers/chatController.js  (Part 11 Prompts 1-2, Part 12 Prompts 7-8 rewire)
 *
 * POST /api/chat/message
 *
 * Free AI chatbot ("PrepPk AI Study Assistant") backed by a multi-provider
 * key pool (Prompt 8) — the specific provider/model that answers any given
 * request depends on which ApiKey the pool selects, with automatic
 * failover across keys/providers on error.
 *
 * Request body: { message: string, history?: Array<{role, content}>, context?: { categoryName?, testName? } }
 * Success:      200 { reply: string, model: string }
 * Failure:      400 (validation / content filter), 429 (daily cap), 503 (AI assistant unavailable)
 *
 * ── Prompt 2 hardening additions ───────────────────────────────
 *  1. Per-identifier cap (ChatUsage) on top of the existing 10-min IP
 *     rate limiter (chatLimiter). See "Chatbot premium-gating" below for
 *     the current (non-daily-for-everyone) shape of this cap.
 *  2. Prompt-injection keyword/regex pre-check   short-circuits with a
 *     canned reply, no provider call spent.
 *  3. Lightweight profanity/spam blocklist   400 rejection, no provider call.
 *  4. Anonymized usage logging via utils/chatLogger.js on every request
 *     (success or failure), never logging message content.
 *
 * ── Chatbot premium-gating (MODIFIED) ───────────────────────────
 * The chatbot itself is now premium-gated, separately from the
 * test-access premium system:
 *  - GUESTS (req.user is null): identified by the chatGuestId cookie
 *    (middleware/chatGuestId.js, mounted on this route only), not IP.
 *    Capped at GUEST_LIFETIME_CAP messages EVER (ChatUsage kind
 *    "guest_lifetime")   this never resets at midnight. Once reached,
 *    every further request gets a 403 with code
 *    "CHAT_GUEST_LIMIT_REACHED" so the frontend can show a locked/upsell
 *    state instead of a generic error bubble.
 *  - PREMIUM USERS (req.user is a valid, non-expired PremiumUser   see
 *    req.user.isExpired()): capped at PREMIUM_DAILY_CAP messages/day
 *    (ChatUsage kind "premium_daily", resets at midnight). This is
 *    purely an abuse/cost safety net, not a marketed limit   real users
 *    should never realistically hit it.
 *  - Every successful response to a guest also includes
 *    `remainingFreeMessages` so the UI can show a live counter without a
 *    second round trip.
 *
 * ── Part 12   Prompt 8 rewire ────────────────────────────────────
 * server/config/groq.js is deprecated (see that file for details), and as
 * of this prompt the previous Prompt 7 rewire (single hardcoded
 * GROQ_API_KEY via getProvider("groq")) is ALSO retired. sendMessage now
 * calls services/aiKeyPool.js's getChatCompletion(), which pulls from the
 * multi-provider ApiKey vault (Prompt 6), round-robins across whichever
 * keys are currently healthy, and fails over across keys/providers on
 * error   see that file for the full selection/failover logic.
 *
 * PRIMARY_MODEL/FALLBACK_MODEL and the old single-provider try/fallback
 * block are gone: which model and provider actually serve a given request
 * is now entirely a property of which ApiKey doc the pool picks, not
 * something this controller decides. The `provider` actually used is
 * still surfaced in the response's `model` field's sibling data (via the
 * ChatLog entry) for analytics.
 */

import { getChatCompletion } from "../services/aiKeyPool.js";
import ChatUsage, { GUEST_LIFETIME_DATE } from "../models/ChatUsage.js";
import ChatFeedback from "../models/ChatFeedback.js";
import { logChatUsage } from "../utils/chatLogger.js";

const MAX_MESSAGE_LENGTH = 2000;
const MAX_HISTORY_TURNS = 10;

// Guests: lifetime cap, never resets   see ChatUsage kind "guest_lifetime".
const GUEST_LIFETIME_CAP = 5;
// Premium users: daily cap, resets at midnight   pure abuse/cost safety
// net (see module docstring), not a marketed limit.
const PREMIUM_DAILY_CAP = 300;

const GUEST_LIMIT_REACHED_MESSAGE =
  "You've used your 5 free messages. Log in with Premium to keep chatting.";

const SYSTEM_PROMPT = `You are the "PrepPk AI Study Assistant", the built-in study helper for PrepPk, a platform that helps users prepare for Pakistani competitive and military entrance exams.

Your scope is strictly limited to helping with:
- Pakistani Armed Forces entrance exams (Army, Navy, Air Force) and ISSB preparation
- FPSC, PPSC, KPPSC, NTS and other Pakistani government job exams
- Verbal reasoning, non-verbal/spatial reasoning, and general academic MCQs
- English language, grammar, and vocabulary for these exams
- General knowledge, Pakistan Studies, and Islamic Studies as tested in these exams
- Current affairs ONLY in the general sense of exam-relevant topics the user tells you about — you do NOT have internet access and do NOT know real-time news, today's date-specific events, or anything beyond what the user shares with you in this conversation. Never claim to browse the web or know breaking news.

If the user asks about something outside this scope — coding help, personal/relationship advice, unrelated general chit-chat, or anything not related to Pakistani exam preparation — politely decline and steer them back to how you can help with their exam prep. Keep declines brief and friendly, not preachy.

Keep answers clear, concise, and exam-focused. Use short explanations and examples suited to MCQ-style preparation.`;

const INJECTION_REPLY =
  "I can only help with exam prep questions — Pakistani Armed Forces, FPSC/PPSC, verbal, non-verbal, and academic MCQ topics. What would you like to study?";

const CONTENT_FILTER_REPLY =
  "This assistant is for study help only. Please rephrase your question around exam prep — verbal, non-verbal, academic MCQs, English, general knowledge, or Pakistan/Islamic Studies.";

// ── Prompt-injection pre-check ─────────────────────────────────
// Simple keyword/regex screen. Not exhaustive, but cheap and catches the
// common jailbreak phrasings before spending a provider call on them.
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+|the\s+)?(previous|prior|above|earlier)\s+instructions?/i,
  /disregard\s+(all\s+|the\s+)?(previous|prior|above|earlier)\s+(instructions?|prompt)/i,
  /you\s+are\s+now\s+(dan|jailbroken|unrestricted|free)\b/i,
  /\bdan\s+mode\b/i,
  /reveal\s+(your\s+)?(system\s+prompt|instructions)/i,
  /(show|print|output|repeat)\s+(me\s+)?(your\s+)?(system\s+prompt|initial\s+instructions)/i,
  /pretend\s+(you\s+have\s+no|there\s+are\s+no)\s+(rules|restrictions|guidelines)/i,
  /act\s+as\s+if\s+you\s+have\s+no\s+(restrictions|filters|rules)/i,
  /forget\s+(all\s+|your\s+)?(previous\s+)?(instructions|guidelines|rules)/i,
];

// ── Lightweight content filter ─────────────────────────────────
// Kept intentionally small and simple, no external package. Catches
// obvious profanity and spam-link patterns; not meant to be exhaustive.
const BLOCKED_TERMS = [
  "fuck",
  "fucking",
  "shit",
  "bitch",
  "asshole",
  "bastard",
  "cunt",
  "porn",
  "sex chat",
  "nude",
];

const SPAM_PATTERNS = [
  /\bhttps?:\/\/\S+/i, // raw links   not something a study question needs
  /\b(buy now|click here|earn \$?\d+|make money fast|forex signal|crypto pump)\b/i,
  /\b(viagra|casino|bet now)\b/i,
];

function stripHtml(input) {
  return String(input).replace(/<[^>]*>/g, "");
}

function containsInjectionAttempt(text) {
  return INJECTION_PATTERNS.some((pattern) => pattern.test(text));
}

function containsBlockedContent(text) {
  const lower = text.toLowerCase();
  if (BLOCKED_TERMS.some((term) => lower.includes(term))) return true;
  if (SPAM_PATTERNS.some((pattern) => pattern.test(text))) return true;
  return false;
}

function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];

  const trimmed = history.slice(-MAX_HISTORY_TURNS);

  return trimmed
    .filter(
      (turn) =>
        turn &&
        (turn.role === "user" || turn.role === "assistant") &&
        typeof turn.content === "string" &&
        turn.content.trim().length > 0
    )
    .map((turn) => ({
      role: turn.role,
      content: stripHtml(turn.content).slice(0, MAX_MESSAGE_LENGTH),
    }));
}

function buildContextLine(context) {
  if (!context || typeof context !== "object") return null;

  const { categoryName, testName } = context;
  if (!categoryName && !testName) return null;

  const parts = [categoryName, testName].filter(Boolean);
  return `The user is currently viewing: ${parts.join(" - ")}`;
}

function todayString() {
  // YYYY-MM-DD, server-local date   matches ChatUsage.date format.
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function msUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return midnight.getTime() - now.getTime();
}

/**
 * Wraps a ChatUsage upsert-increment with one retry on E11000.
 *
 * `findOneAndUpdate(..., { upsert: true })` is NOT safe against two
 * concurrent requests for the same brand-new (identifier, kind, date) row:
 * both can see "no matching doc" at the same instant and both attempt to
 * insert, but the unique index (identifier_1_date_1) only lets one insert
 * win — the loser throws E11000, not a normal Mongo error. That's exactly
 * what showed up as "[chat] error type=11000" → mislabeled 503 "AI
 * assistant busy" even though the AI key pool was never called.
 *
 * The fix: on E11000, the winning doc now exists, so a plain retry of the
 * same findOneAndUpdate becomes a normal $inc update, not an insert, and
 * succeeds. One retry is sufficient — a second collision on the same
 * already-existing row is not possible.
 */
async function upsertUsageWithRetry(filter) {
  try {
    return await ChatUsage.findOneAndUpdate(filter, { $inc: { count: 1 } }, { upsert: true, new: true });
  } catch (err) {
    if (err?.code === 11000) {
      return ChatUsage.findOneAndUpdate(filter, { $inc: { count: 1 } }, { upsert: true, new: true });
    }
    throw err;
  }
}

/**
 * Atomically increments a PremiumUser's usage row for TODAY and returns
 * the count AFTER incrementing, so the caller can compare it against the
 * daily cap in one round trip (no separate read-then-write race). Resets
 * naturally each day since the row is keyed by (identifier, "YYYY-MM-DD").
 */
async function incrementPremiumDailyUsage(identifier) {
  const date = todayString();
  const usage = await upsertUsageWithRetry({ identifier, kind: "premium_daily", date });
  return usage.count;
}

/**
 * Atomically increments a guest's LIFETIME usage row (keyed by their
 * chatGuestId cookie) and returns the count AFTER incrementing. This row
 * never resets   once it crosses GUEST_LIFETIME_CAP it stays capped
 * until the visitor logs in as a Premium user.
 */
async function incrementGuestLifetimeUsage(chatGuestId) {
  const usage = await upsertUsageWithRetry({
    identifier: chatGuestId,
    kind: "guest_lifetime",
    date: GUEST_LIFETIME_DATE,
  });
  return usage.count;
}

export async function sendMessage(req, res) {
  const startedAt = Date.now();

  // Identify the caller: PremiumUser _id when logged in AND not expired
  // (optionalUser attaches req.user for any valid session, but doesn't
  // itself check expiry   we need the real premium status here, not just
  // "was logged in at some point"). Guests are identified by their
  // chatGuestId cookie (middleware/chatGuestId.js), never IP   IP is
  // shared across many visitors and doesn't survive network changes.
  const isPremiumUser = Boolean(req.user) && !req.user.isExpired();
  const identifier = isPremiumUser ? String(req.user._id) : req.chatGuestId;

  // Set for guests only; included in the success response so the frontend
  // can show a live "N free messages left" counter without a second
  // round trip. Stays null for premium users, who never see this UI.
  let remainingFreeMessages = null;

  let modelUsed = null;
  let providerUsed = null;
  let success = false;

  try {
    const { message, history, context } = req.body || {};

    // ── Validation ──────────────────────────────────────────────
    if (typeof message !== "string" || message.trim().length === 0) {
      return res.status(400).json({ message: "Message cannot be empty." });
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        message: `Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
      });
    }

    const cleanMessage = stripHtml(message).trim();
    if (cleanMessage.length === 0) {
      return res.status(400).json({ message: "Message cannot be empty." });
    }

    // ── Cap check: guest lifetime cap, or premium daily cap ─────
    if (isPremiumUser) {
      const usedToday = await incrementPremiumDailyUsage(identifier);
      if (usedToday > PREMIUM_DAILY_CAP) {
        return res.status(429).json({
          message: `Daily limit reached (${PREMIUM_DAILY_CAP} messages/day). Resets at midnight.`,
          retryAfterMs: msUntilMidnight(),
        });
      }
    } else {
      const usedLifetime = await incrementGuestLifetimeUsage(identifier);
      if (usedLifetime > GUEST_LIFETIME_CAP) {
        return res.status(403).json({
          code: "CHAT_GUEST_LIMIT_REACHED",
          message: GUEST_LIMIT_REACHED_MESSAGE,
        });
      }
      remainingFreeMessages = Math.max(0, GUEST_LIFETIME_CAP - usedLifetime);
    }

    // ── Prompt-injection pre-check   skip the key pool entirely if triggered ──
    if (containsInjectionAttempt(cleanMessage)) {
      success = true; // we did successfully serve a (canned) reply
      return res.json({
        reply: INJECTION_REPLY,
        model: "filtered",
        ...(remainingFreeMessages !== null ? { remainingFreeMessages } : {}),
      });
    }

    // ── Lightweight content filter   reject before calling the key pool ──
    if (containsBlockedContent(cleanMessage)) {
      return res.status(400).json({ message: CONTENT_FILTER_REPLY });
    }

    // ── Build the chat payload ─────────────────────────────────
    let systemContent = SYSTEM_PROMPT;
    const contextLine = buildContextLine(context);
    if (contextLine) {
      systemContent += `\n\n${contextLine}`;
    }

    const messages = [
      { role: "system", content: systemContent },
      ...sanitizeHistory(history),
      { role: "user", content: cleanMessage },
    ];

    // ── Call the key-pool orchestrator (Part 12   Prompt 8) ──────
    // Picks a healthy key from the ApiKey vault, calls the matching
    // provider adapter, and fails over across keys/providers on error.
    // See services/aiKeyPool.js for the full selection/failover logic.
    const result = await getChatCompletion({
      messages,
      maxTokens: 1024,
      temperature: 0.4,
    });

    modelUsed = result.model;
    providerUsed = result.provider;
    success = true;
    return res.json({
      reply: result.text,
      model: modelUsed,
      ...(remainingFreeMessages !== null ? { remainingFreeMessages } : {}),
    });
  } catch (err) {
    // Only NO_KEYS_AVAILABLE / ALL_KEYS_EXHAUSTED actually come from the AI
    // key pool — anything else (a DB error, a bug elsewhere in this
    // try-block, etc.) is a different kind of failure and should say so in
    // the logs, even though the user-facing message stays generic either
    // way (never leak raw provider/DB error details to the client).
    const isAiPoolError = err?.code === "NO_KEYS_AVAILABLE" || err?.code === "ALL_KEYS_EXHAUSTED";
    console.error(
      `[chat] error source=${isAiPoolError ? "ai_pool" : "other"} type=${err?.code || err?.type || "unknown"} ${
        Date.now() - startedAt
      }ms →`,
      err.message
    );

    // NO_KEYS_AVAILABLE (empty pool) and ALL_KEYS_EXHAUSTED (every
    // attempted key failed) both mean the same thing to the user: the
    // assistant genuinely couldn't get an answer right now. Everything
    // else (validation errors etc.) already returned earlier above, so
    // reaching this catch at all means it's a pool/provider-level failure —
    // or, now correctly logged as such, some other unexpected bug that
    // still shouldn't leak internals to the client.
    return res.status(503).json({
      message: "The AI assistant is temporarily busy, please try again in a moment.",
    });
  } finally {
    // Fire-and-forget anonymized usage log   never blocks the response,
    // never includes message content.
    logChatUsage({
      identifier,
      isPremiumUser,
      model: modelUsed,
      provider: providerUsed,
      success,
      responseTimeMs: Date.now() - startedAt,
    });

    console.log(
      `[chat] status=${success ? 200 : "error"} provider=${providerUsed || "n/a"} model=${
        modelUsed || "n/a"
      } ${Date.now() - startedAt}ms user=${isPremiumUser ? "premium" : "guest"}`
    );
  }
}

/**
 * POST /api/chat/feedback  (Part 11   Prompt 5)
 *
 * Records a thumbs-up/thumbs-down rating on a single assistant reply.
 * Only the first 100 chars of that reply are stored, purely for context
 * when reviewing bad answers   never the full conversation, never tied
 * back to a specific user or ChatLog row.
 *
 * Body: { messageSnippet: string, rating: "up" | "down" }
 */
export async function submitFeedback(req, res) {
  try {
    const { messageSnippet, rating } = req.body || {};

    if (rating !== "up" && rating !== "down") {
      return res.status(400).json({ message: "rating must be 'up' or 'down'." });
    }

    const snippet =
      typeof messageSnippet === "string" ? stripHtml(messageSnippet).slice(0, 100) : "";

    await ChatFeedback.create({ messageSnippet: snippet, rating });

    return res.status(201).json({ message: "Feedback recorded." });
  } catch (err) {
    console.error("[chat] feedback error:", err.message);
    return res.status(500).json({ message: "Could not record feedback." });
  }
}