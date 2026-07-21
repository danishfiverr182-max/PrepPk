/**
 * models/ApiKey.js  (Part 12   Multi-provider API Key Vault)
 *
 * One document per provider API key the admin has added to the pool.
 * The raw key is NEVER stored   only encryptedKey (AES-256-GCM, see
 * utils/encryption.js) and a 4-character keyPreview for display.
 *
 * status/cooldownUntil/consecutiveFailures exist now so the next prompt's
 * provider-adapter + pool-selection logic has somewhere to record health
 * without a schema migration; they're not populated by this prompt beyond
 * their defaults.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const PROVIDERS = ["groq", "gemini", "openai", "anthropic", "openrouter"];
const STATUSES = ["healthy", "rate_limited", "invalid", "unknown"];

const apiKeySchema = new Schema(
  {
    provider: {
      type: String,
      enum: PROVIDERS,
      required: true,
    },

    // Admin-friendly name, e.g. "Groq - personal account"
    label: {
      type: String,
      required: true,
      trim: true,
    },

    // AES-256-GCM ciphertext (iv:authTag:ciphertext, base64 segments).
    // NEVER select this by default in general queries   controllers must
    // explicitly .select("+encryptedKey") when they actually need to
    // decrypt (see apiKeyController.testKey).
    encryptedKey: {
      type: String,
      required: true,
      select: false,
    },

    // Last 4 characters of the raw key, for admin UI display without
    // ever decrypting just to show "...ab12".
    keyPreview: {
      type: String,
      required: true,
    },

    // Which model this key should be used with, e.g.
    // "llama-3.3-70b-versatile" (groq), "gemini-2.0-flash" (gemini).
    model: {
      type: String,
      required: true,
      trim: true,
    },

    // Admin manual on/off switch, independent of automatic health status.
    isActive: {
      type: Boolean,
      default: true,
    },

    // Automatic health tracking (populated by the pool-selection logic
    // built in a later prompt).
    status: {
      type: String,
      enum: STATUSES,
      default: "unknown",
    },

    // Set when a 429 is hit; cleared once the cooldown window passes.
    cooldownUntil: {
      type: Date,
      default: null,
    },

    // Used by future auto-deactivate logic (e.g. disable after N
    // consecutive failures).
    consecutiveFailures: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Lifetime count of successful calls made with this key.
    usageCount: {
      type: Number,
      default: 0,
      min: 0,
    },

    lastUsedAt: {
      type: Date,
      default: null,
    },

    lastErrorAt: {
      type: Date,
      default: null,
    },

    // Short, admin-facing debugging text   NEVER the key itself.
    lastErrorMessage: {
      type: String,
      default: null,
    },

    addedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true }
);

apiKeySchema.index({ provider: 1, label: 1 });

export const API_KEY_PROVIDERS = PROVIDERS;
export const API_KEY_STATUSES = STATUSES;

export default mongoose.model("ApiKey", apiKeySchema);
