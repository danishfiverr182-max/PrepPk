/**
 * controllers/apiKeyController.js  (Part 12   Multi-provider API Key Vault)
 *
 * ── Security note (read this before touching any handler below) ──────
 * `encryptedKey` must NEVER appear in a JSON response, not even the
 * ciphertext (there's no reason a client needs it, and every byte of
 * attack surface we can remove, we should).
 *
 * The schema already sets `select: false` on encryptedKey, which keeps it
 * out of ordinary find/findOne/findOneAndUpdate results by default.
 * BUT: `Model.create()` returns the in-memory document with every field
 * that was set on construction   `select: false` does NOT retroactively
 * strip it from that returned instance, because no "find" query was
 * issued to produce it. That means naively doing `res.json(newDoc)` (or
 * spreading it into a response object) right after `.create()` WOULD leak
 * the ciphertext, even though every other endpoint here is safe by
 * construction.
 *
 * To make this impossible to get wrong by accident, every handler below
 * builds its response through `toSafeApiKey()`, which explicitly
 * allow-lists fields one by one   there is no spread operator anywhere in
 * this file touching a raw ApiKey document. Only testKey() ever calls
 * decrypt() to get a raw key into memory, and that raw string is used
 * only in a local variable that is never returned or logged.
 * ───────────────────────────────────────────────────────────────────
 */

import ApiKey, { API_KEY_PROVIDERS } from "../models/ApiKey.js";
import { encrypt, decrypt } from "../utils/encryption.js";
import { getProvider } from "../services/providers/index.js";

/**
 * Explicit allow-list serializer. Deliberately field-by-field (no spread)
 * so `encryptedKey` can never ride along by accident.
 */
function toSafeApiKey(doc) {
  return {
    id: doc._id,
    provider: doc.provider,
    label: doc.label,
    keyPreview: doc.keyPreview,
    model: doc.model,
    baseUrl: doc.baseUrl,
    isActive: doc.isActive,
    status: doc.status,
    cooldownUntil: doc.cooldownUntil,
    consecutiveFailures: doc.consecutiveFailures,
    usageCount: doc.usageCount,
    lastUsedAt: doc.lastUsedAt,
    lastErrorAt: doc.lastErrorAt,
    lastErrorMessage: doc.lastErrorMessage,
    addedBy: doc.addedBy,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

/**
 * POST /api/admin/api-keys
 * Body: { provider, label, apiKey (raw), model }
 */
export async function createKey(req, res) {
  try {
    const { provider, label, apiKey, model, baseUrl } = req.body || {};

    if (!API_KEY_PROVIDERS.includes(provider)) {
      return res.status(400).json({
        message: `provider must be one of: ${API_KEY_PROVIDERS.join(", ")}`,
      });
    }

    if (typeof label !== "string" || label.trim().length === 0) {
      return res.status(400).json({ message: "label is required." });
    }

    if (typeof apiKey !== "string" || apiKey.trim().length < 8) {
      return res.status(400).json({ message: "apiKey looks too short to be valid." });
    }

    if (typeof model !== "string" || model.trim().length === 0) {
      return res.status(400).json({ message: "model is required." });
    }

    let cleanBaseUrl = null;
    if (provider === "custom") {
      cleanBaseUrl = typeof baseUrl === "string" ? baseUrl.trim() : "";
      if (!cleanBaseUrl.startsWith("https://")) {
        return res.status(400).json({
          message: 'baseUrl is required and must start with "https://" for a custom provider key.',
        });
      }
    }

    const rawKey = apiKey.trim();
    const encryptedKey = encrypt(rawKey);
    const keyPreview = rawKey.slice(-4);

    const created = await ApiKey.create({
      provider,
      label: label.trim(),
      encryptedKey,
      keyPreview,
      model: model.trim(),
      baseUrl: cleanBaseUrl,
      addedBy: req.admin?._id || null,
    });

    // created.encryptedKey IS populated in memory here (see file header
    // note)   toSafeApiKey() is what keeps it out of the response.
    return res.status(201).json({ message: "API key added.", key: toSafeApiKey(created) });
  } catch (err) {
    console.error("[apiKeyController] createKey error:", err.message);
    return res.status(500).json({ message: "Could not save the API key." });
  }
}

/**
 * GET /api/admin/api-keys
 * Returns all keys, encryptedKey excluded at the query level (schema
 * default) AND again via toSafeApiKey() for defense in depth.
 */
export async function listKeys(req, res) {
  try {
    const keys = await ApiKey.find()
      .select("-encryptedKey")
      .sort({ provider: 1, label: 1 })
      .lean();

    return res.json({ keys: keys.map(toSafeApiKey) });
  } catch (err) {
    console.error("[apiKeyController] listKeys error:", err.message);
    return res.status(500).json({ message: "Could not load API keys." });
  }
}

/**
 * PATCH /api/admin/api-keys/:id/toggle
 * Flips isActive. No body needed.
 */
export async function toggleKey(req, res) {
  try {
    const existing = await ApiKey.findById(req.params.id).select("-encryptedKey");
    if (!existing) {
      return res.status(404).json({ message: "API key not found." });
    }

    existing.isActive = !existing.isActive;
    await existing.save();

    return res.json({
      message: `Key ${existing.isActive ? "activated" : "deactivated"}.`,
      key: toSafeApiKey(existing),
    });
  } catch (err) {
    console.error("[apiKeyController] toggleKey error:", err.message);
    return res.status(500).json({ message: "Could not update the API key." });
  }
}

/**
 * DELETE /api/admin/api-keys/:id
 */
export async function deleteKey(req, res) {
  try {
    const deleted = await ApiKey.findByIdAndDelete(req.params.id).select("-encryptedKey");
    if (!deleted) {
      return res.status(404).json({ message: "API key not found." });
    }

    return res.json({ message: "API key deleted.", key: toSafeApiKey(deleted) });
  } catch (err) {
    console.error("[apiKeyController] deleteKey error:", err.message);
    return res.status(500).json({ message: "Could not delete the API key." });
  }
}

/**
 * POST /api/admin/api-keys/:id/test  (Part 12   Prompt 7: now a real call)
 *
 * Decrypts the stored key, dispatches to the matching provider adapter
 * with a trivial "Say OK" / maxTokens: 5 request, and persists the
 * result onto the ApiKey document so the admin list view reflects real
 * health without needing to re-test manually every time.
 */
export async function testKey(req, res) {
  try {
    const existing = await ApiKey.findById(req.params.id).select("+encryptedKey");
    if (!existing) {
      return res.status(404).json({ message: "API key not found." });
    }

    let rawKey;
    try {
      rawKey = decrypt(existing.encryptedKey);
    } catch (decryptErr) {
      console.error("[apiKeyController] testKey decrypt failed:", decryptErr.message);
      return res.status(500).json({
        success: false,
        message:
          "Could not decrypt this key   it may have been saved with a different ENCRYPTION_KEY.",
      });
    }

    let provider;
    try {
      provider = getProvider(existing.provider);
    } catch (err) {
      console.error("[apiKeyController] testKey unknown provider:", err.message);
      return res.status(500).json({ success: false, message: "Unknown provider for this key." });
    }

    try {
      const result = await provider.chatComplete({
        apiKey: rawKey,
        model: existing.model,
        messages: [{ role: "user", content: "Say OK" }],
        maxTokens: 5,
        temperature: 0,
        baseUrl: existing.baseUrl,
      });

      // ── Success: mark healthy, reset failure streak ──────────
      existing.status = "healthy";
      existing.isActive = true;
      existing.cooldownUntil = null;
      existing.consecutiveFailures = 0;
      existing.usageCount += 1;
      existing.lastUsedAt = new Date();
      existing.lastErrorAt = null;
      existing.lastErrorMessage = null;
      await existing.save();

      return res.json({
        success: true,
        message: `${existing.provider} responded: "${result.text.slice(0, 60)}"`,
      });
    } catch (callErr) {
      // ── Failure: classify via callErr.type and persist health state ──
      const type = callErr?.type || "server_error";

      existing.consecutiveFailures += 1;
      existing.lastErrorAt = new Date();
      // Short and admin-facing only   never the key itself, and callErr
      // messages from the adapters already never include the raw key.
      existing.lastErrorMessage = String(callErr.message || "Unknown error").slice(0, 300);

      if (type === "rate_limit") {
        existing.status = "rate_limited";
        existing.cooldownUntil = new Date(Date.now() + 60_000); // 1 min; orchestrator refines this later
      } else if (type === "invalid_key") {
        existing.status = "invalid";
      } else {
        // server_error / timeout   transient, don't condemn the key itself
        existing.status = "unknown";
      }

      await existing.save();

      console.error(
        `[apiKeyController] testKey call failed provider=${existing.provider} type=${type}:`,
        callErr.message
      );

      return res.json({
        success: false,
        message: `Test call failed (${type}): ${callErr.message}`,
      });
    }
  } catch (err) {
    console.error("[apiKeyController] testKey error:", err.message);
    return res.status(500).json({ success: false, message: "Could not test this API key." });
  }
}
