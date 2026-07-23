/**
 * models/ChatLog.js  (Part 11   Prompt 2)
 *
 * Anonymized usage log for the AI chatbot   NEVER stores message content,
 * only metadata needed to review usage patterns (Prompt 5's admin
 * dashboard) and debug Groq reliability.
 *
 * Fields:
 *  - identifier:      same IP / PremiumUser-id string used in ChatUsage.
 *                      Kept here too (rather than joining against ChatUsage)
 *                      so old log rows stay meaningful after they TTL-expire
 *                      out of nothing   ChatLog is self-contained.
 *  - isPremiumUser:    boolean, whether req.user was set (from optionalUser).
 *  - model:            which Groq model actually served the reply
 *                      ("llama-3.3-70b-versatile" / "llama-3.1-8b-instant"),
 *                      or null if the request never reached Groq (blocked
 *                      by validation / content filter / daily cap).
 *  - success:          true only if a reply was returned to the client.
 *  - responseTimeMs:   wall-clock time for the whole request handler.
 *  - createdAt:        when the log row was written.
 *
 * ── TTL index explanation ──────────────────────────────────────────────
 * Mongoose's `timestamps: true` shortcut creates `createdAt`/`updatedAt`
 * but does NOT let you attach index options (like `expires`) to that
 * auto-generated field. So instead we declare `createdAt` explicitly on
 * the schema ourselves (type: Date, default: Date.now), and separately
 * register a TTL index on it with `schema.index({ createdAt: 1 }, { expireAfterSeconds: <seconds> })`.
 *
 * MongoDB's TTL monitor then deletes any document once
 * (createdAt + expireAfterSeconds) is in the past   it runs as a background
 * sweep roughly once every 60 seconds, so expiry isn't instant-on-the-second
 * but documents are reliably gone well within an hour of the 30-day mark.
 *
 * 30 days = 60 * 60 * 24 * 30 = 2,592,000 seconds.
 *
 * IMPORTANT: a TTL index only works on a field containing a BSON Date
 * (or an array of dates)   never on a string date like ChatUsage.date.
 * That's exactly why ChatLog uses a real `Date` for createdAt while
 * ChatUsage intentionally uses a "YYYY-MM-DD" string for its own reasons
 * (unambiguous daily bucketing, see models/ChatUsage.js).
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const chatLogSchema = new Schema({
  identifier: {
    type: String,
    required: true,
    trim: true,
  },
  isPremiumUser: {
    type: Boolean,
    default: false,
  },
  model: {
    type: String,
    default: null, // null when the request never reached a provider
  },
  provider: {
    // Part 12 — Prompt 8: which pool provider actually served the reply
    // ("groq" | "gemini" | "openai" | "anthropic" | "openrouter" | "custom"), or null
    // if the request never reached the key pool (blocked by validation /
    // content filter / daily cap / NO_KEYS_AVAILABLE before any attempt).
    type: String,
    default: null,
  },
  success: {
    type: Boolean,
    required: true,
  },
  responseTimeMs: {
    type: Number,
    required: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// TTL index: MongoDB automatically deletes documents 30 days after createdAt.
chatLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 * 60 * 24 * 30 });

export default mongoose.model("ChatLog", chatLogSchema);
