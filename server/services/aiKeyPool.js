/**
 * services/aiKeyPool.js  (Part 12 — Prompt 8: Key Pool Orchestrator)
 *
 * Ties the ApiKey vault (Prompt 6) to the provider adapter layer
 * (Prompt 7). This is the piece every prior prompt's comments referred to
 * as "the orchestrator in the next prompt" — chatController no longer
 * talks to a single hardcoded GROQ_API_KEY; it calls getChatCompletion()
 * here, which picks a healthy key from the pool, calls the matching
 * provider adapter, and fails over to the next key on error.
 *
 * ── In-memory pool cache ────────────────────────────────────────────────
 * loadActiveKeys() hits Mongo at most once every CACHE_TTL_MS. The cached
 * value is the list of *eligible* ApiKey docs (encryptedKey included, since
 * we need it to decrypt just before the provider call) — never a decrypted
 * key. Nothing decrypted ever gets stored anywhere, in the cache or
 * otherwise; decrypt() is called fresh, right before each individual
 * provider.chatComplete() attempt, and the plaintext only ever lives in a
 * local variable for the duration of that one call.
 *
 * The cache is a single process-wide module-level variable (not per
 * request), which is what makes the round-robin behavior work across
 * requests: lastUsedAt-ascending sort + updating lastUsedAt on every
 * success naturally rotates which key is "next" without a separate
 * pointer to persist anywhere.
 *
 * ── Fire-and-forget health updates ──────────────────────────────────────
 * Every DB write in the per-attempt failure/success handling is
 * intentionally NOT awaited before moving on to the next key — we only
 * attach a .catch() so a slow write can never add latency to the
 * request's failover speed. The one exception is the increment-then-check
 * pattern in markInvalidKeyAttempt(), which needs the post-increment
 * value to decide whether to auto-deactivate; that one *is* awaited
 * internally (inside its own async function) but the caller in
 * getChatCompletion() still doesn't wait for it before trying the next
 * key — see the call site.
 */

import ApiKey from "../models/ApiKey.js";
import { decrypt } from "../utils/encryption.js";
import { getProvider } from "./providers/index.js";

const CACHE_TTL_MS = 30_000; // 30s — see loadActiveKeys()
const MAX_ATTEMPTS = 4; // safety cap — see getChatCompletion()
const RATE_LIMIT_COOLDOWN_MS = 2 * 60 * 1000; // 2 min
const TRANSIENT_COOLDOWN_MS = 30 * 1000; // 30s
const INVALID_KEY_FAILURE_THRESHOLD = 3;

let cachedKeys = null; // Array<ApiKey lean doc> | null
let cachedAt = 0; // ms timestamp of last successful load

/**
 * Loads all currently-eligible ApiKey docs from Mongo:
 *   isActive: true AND status !== "invalid" AND
 *   (cooldownUntil is null OR cooldownUntil < now)
 * sorted lastUsedAt ascending (nulls sort first in Mongo, so brand-new
 * never-used keys are naturally tried before recently-used ones — this is
 * the whole round-robin mechanism, no separate index/pointer needed).
 *
 * Result is cached in-process for CACHE_TTL_MS so a chat message doesn't
 * hit Mongo every single time, while still being fresh enough (≤30s) that
 * an admin flipping a key off in the vault takes effect quickly.
 *
 * encryptedKey IS included in the cached docs (via .select("+encryptedKey"))
 * because the pool needs it to decrypt just before use — but it is never
 * decrypted here, only carried as ciphertext.
 *
 * @param {boolean} [forceRefresh=false] bypass the cache (used internally
 *   if the cache is empty and might just be stale — normal calls don't
 *   need this)
 * @returns {Promise<Array<Object>>}
 */
export async function loadActiveKeys(forceRefresh = false) {
  const now = Date.now();
  if (!forceRefresh && cachedKeys !== null && now - cachedAt < CACHE_TTL_MS) {
    return cachedKeys;
  }

  const nowDate = new Date();
  const docs = await ApiKey.find({
    isActive: true,
    status: { $ne: "invalid" },
    $or: [{ cooldownUntil: null }, { cooldownUntil: { $lt: nowDate } }],
  })
    .select("+encryptedKey")
    .sort({ lastUsedAt: 1 })
    .lean();

  cachedKeys = docs;
  cachedAt = Date.now();
  return cachedKeys;
}

/**
 * Returns the next eligible key doc from the cached pool, skipping any
 * whose _id is in excludeIds. Does NOT itself trigger a reload — call
 * loadActiveKeys() first (getChatCompletion always does).
 *
 * @param {Array<string>} [excludeIds=[]]
 * @returns {Object|null}
 */
export function getNextKey(excludeIds = []) {
  if (!cachedKeys || cachedKeys.length === 0) return null;
  const excludeSet = new Set(excludeIds.map(String));
  return cachedKeys.find((doc) => !excludeSet.has(String(doc._id))) || null;
}

/** Clears the in-process cache. Exposed for tests. */
export function _resetCacheForTests() {
  cachedKeys = null;
  cachedAt = 0;
}

// ── Fire-and-forget health-state writers ────────────────────────────────
// Each returns a promise; every call site attaches its own .catch() rather
// than awaiting, per the "never let a slow DB write delay failover" spec.

function markSuccess(id) {
  return ApiKey.findByIdAndUpdate(id, {
    $set: {
      status: "healthy",
      consecutiveFailures: 0,
      lastUsedAt: new Date(),
      lastErrorAt: null,
      lastErrorMessage: null,
    },
    $inc: { usageCount: 1 },
  });
}

function markRateLimited(id, message) {
  return ApiKey.findByIdAndUpdate(id, {
    $set: {
      status: "rate_limited",
      cooldownUntil: new Date(Date.now() + RATE_LIMIT_COOLDOWN_MS),
      lastErrorAt: new Date(),
      lastErrorMessage: String(message || "Rate limited").slice(0, 300),
    },
  });
}

/**
 * Atomic increment-then-check: uses findByIdAndUpdate with $inc so
 * concurrent requests hitting the same bad key can't race each other into
 * under-counting consecutiveFailures. If the post-increment count reaches
 * the threshold, follows up with a second update that flips the key off
 * pool-wide (status "invalid" + isActive false) so it stops being tried
 * by anyone.
 */
async function markInvalidKeyAttempt(id, message) {
  const updated = await ApiKey.findByIdAndUpdate(
    id,
    {
      $inc: { consecutiveFailures: 1 },
      $set: {
        status: "invalid",
        lastErrorAt: new Date(),
        lastErrorMessage: String(message || "Invalid key").slice(0, 300),
      },
    },
    { new: true }
  );

  if (updated && updated.consecutiveFailures >= INVALID_KEY_FAILURE_THRESHOLD) {
    await ApiKey.findByIdAndUpdate(id, { $set: { isActive: false } });
  }
}

function markTransientFailure(id, message) {
  return ApiKey.findByIdAndUpdate(id, {
    $set: {
      cooldownUntil: new Date(Date.now() + TRANSIENT_COOLDOWN_MS),
      lastErrorAt: new Date(),
      lastErrorMessage: String(message || "Transient failure").slice(0, 300),
    },
  });
}

/**
 * Main entry point. Tries up to MAX_ATTEMPTS distinct keys from the pool,
 * in round-robin (least-recently-used-first) order, calling the matching
 * provider adapter for each. Returns on the first success; throws if every
 * attempted key fails.
 *
 * @param {Object} params
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens]
 * @param {number} [params.temperature]
 * @returns {Promise<{ text: string, usage: Object|null, provider: string, model: string }>}
 * @throws {Error} with `.code === "NO_KEYS_AVAILABLE"` if the pool is empty,
 *   or `.code === "ALL_KEYS_EXHAUSTED"` (with `.errors`, the list of error
 *   types hit, and `.attempts`) if every attempted key failed.
 */
export async function getChatCompletion({ messages, maxTokens, temperature }) {
  const pool = await loadActiveKeys();

  if (!pool || pool.length === 0) {
    const err = new Error("No active API keys are available in the pool.");
    err.code = "NO_KEYS_AVAILABLE";
    throw err;
  }

  const attemptCap = Math.min(MAX_ATTEMPTS, pool.length);
  const triedIds = [];
  const errorsEncountered = [];

  for (let attempt = 0; attempt < attemptCap; attempt++) {
    const keyDoc = getNextKey(triedIds);
    if (!keyDoc) break; // ran out of distinct eligible keys before hitting the cap
    triedIds.push(keyDoc._id);

    // Decrypt fresh, right before use — never cached, never stored.
    let rawKey;
    try {
      rawKey = decrypt(keyDoc.encryptedKey);
    } catch (decryptErr) {
      console.error(
        `[aiKeyPool] decrypt failed for key ${keyDoc._id} (provider=${keyDoc.provider}):`,
        decryptErr.message
      );
      errorsEncountered.push("decrypt_error");
      // A key that can't be decrypted (wrong ENCRYPTION_KEY, corruption)
      // is unusable exactly like a bad credential — route it through the
      // same invalid-key handling so it eventually stops being retried.
      markInvalidKeyAttempt(keyDoc._id, `Decrypt failure: ${decryptErr.message}`).catch((e) =>
        console.error(`[aiKeyPool] failed to persist decrypt-failure state for ${keyDoc._id}:`, e.message)
      );
      continue;
    }

    let provider;
    try {
      provider = getProvider(keyDoc.provider);
    } catch (registryErr) {
      // Not a key-health problem (e.g. a provider was removed from the
      // adapter registry but an old doc still references it) — log and
      // skip, but don't punish the key's health status for it.
      console.error(
        `[aiKeyPool] no adapter for provider "${keyDoc.provider}" (key ${keyDoc._id}):`,
        registryErr.message
      );
      errorsEncountered.push("unknown_provider");
      continue;
    }

    try {
      const result = await provider.chatComplete({
        apiKey: rawKey,
        model: keyDoc.model,
        messages,
        maxTokens,
        temperature,
        // Only meaningful for provider: "custom" — every other adapter
        // ignores an unused baseUrl param since it hardcodes its own URL.
        baseUrl: keyDoc.baseUrl,
      });

      // Success — update health, then return immediately without trying
      // any further keys. Fire-and-forget: don't block the response on it.
      markSuccess(keyDoc._id).catch((e) =>
        console.error(`[aiKeyPool] failed to persist success state for ${keyDoc._id}:`, e.message)
      );

      return {
        text: result.text,
        usage: result.usage,
        provider: keyDoc.provider,
        model: keyDoc.model,
      };
    } catch (callErr) {
      const type = callErr?.type || "server_error";
      errorsEncountered.push(type);

      console.error(
        `[aiKeyPool] attempt ${attempt + 1}/${attemptCap} failed key=${keyDoc._id} provider=${keyDoc.provider} type=${type}:`,
        callErr.message
      );

      if (type === "rate_limit") {
        markRateLimited(keyDoc._id, callErr.message).catch((e) =>
          console.error(`[aiKeyPool] failed to persist rate-limit state for ${keyDoc._id}:`, e.message)
        );
      } else if (type === "invalid_key") {
        markInvalidKeyAttempt(keyDoc._id, callErr.message).catch((e) =>
          console.error(`[aiKeyPool] failed to persist invalid-key state for ${keyDoc._id}:`, e.message)
        );
      } else {
        // "server_error" | "timeout" — likely transient, short cooldown.
        markTransientFailure(keyDoc._id, callErr.message).catch((e) =>
          console.error(`[aiKeyPool] failed to persist transient-failure state for ${keyDoc._id}:`, e.message)
        );
      }
      // fall through to the next attempt
    }
  }

  // Every attempted key failed (or the pool ran out of distinct keys
  // before the cap). If the pool was bigger than what we were willing to
  // try, that's worth flagging — repeated occurrences signal the pool
  // itself is unhealthy, not just one unlucky key.
  if (pool.length > attemptCap || triedIds.length < attemptCap) {
    console.warn(
      `[aiKeyPool] exhausted ${triedIds.length} attempt(s) (cap=${MAX_ATTEMPTS}) out of a pool of ${pool.length} key(s) without success. errors=${errorsEncountered.join(",") || "none"}`
    );
  }

  const err = new Error(
    `All ${triedIds.length} attempted API key(s) failed: ${errorsEncountered.join(", ") || "no keys tried"}`
  );
  err.code = "ALL_KEYS_EXHAUSTED";
  err.errors = errorsEncountered;
  err.attempts = triedIds.length;
  throw err;
}
