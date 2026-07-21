/**
 * scripts/testAllKeys.js  (Part 12   Prompt 10: Key Pool Verification)
 *
 * Loops through every ApiKey document in the vault and runs the same
 * "trivial test call + persist health status" logic that the admin UI's
 * Test Now button (apiKeyController.testKey) triggers one key at a time
 * printing a single summary table at the end instead. Useful right
 * after bulk-adding several keys, so you don't have to open the admin UI
 * and click Test on each one individually.
 *
 * This intentionally mirrors apiKeyController.testKey()'s success/failure
 * persistence rules exactly (same status/cooldownUntil/consecutiveFailures
 * writes) rather than importing the Express handler directly, since that
 * handler is wired to (req, res) and isn't meant to be called outside a
 * request cycle.
 *
 * Usage:  node scripts/testAllKeys.js
 */

import "dotenv/config";
import mongoose from "mongoose";
import ApiKey from "../models/ApiKey.js";
import { decrypt } from "../utils/encryption.js";
import { getProvider } from "../services/providers/index.js";

const MONGO_URI = process.env.MONGO_URI;
if (!MONGO_URI) {
  console.error("❌  MONGO_URI is not set in .env");
  process.exit(1);
}

if (!process.env.ENCRYPTION_KEY) {
  console.error("❌  ENCRYPTION_KEY is not set in .env   can't decrypt vault keys without it.");
  process.exit(1);
}

await mongoose.connect(MONGO_URI);
console.log("✅  Connected to MongoDB\n");

const keys = await ApiKey.find().select("+encryptedKey").sort({ provider: 1, label: 1 });

if (keys.length === 0) {
  console.log("No API keys found in the vault. Add some via the admin UI first.");
  await mongoose.disconnect();
  process.exit(0);
}

console.log(`Testing ${keys.length} key(s)...\n`);

const results = [];

for (const key of keys) {
  process.stdout.write(`  ${key.provider.padEnd(11)} ${key.label.padEnd(28)} `);

  let rawKey;
  try {
    rawKey = decrypt(key.encryptedKey);
  } catch (decryptErr) {
    console.log("❌  decrypt failed");
    results.push({
      provider: key.provider,
      label: key.label,
      status: "decrypt_error",
      detail: decryptErr.message,
    });
    continue;
  }

  let provider;
  try {
    provider = getProvider(key.provider);
  } catch (registryErr) {
    console.log("❌  unknown provider");
    results.push({
      provider: key.provider,
      label: key.label,
      status: "unknown_provider",
      detail: registryErr.message,
    });
    continue;
  }

  try {
    const result = await provider.chatComplete({
      apiKey: rawKey,
      model: key.model,
      messages: [{ role: "user", content: "Say OK" }],
      maxTokens: 5,
      temperature: 0,
    });

    key.status = "healthy";
    key.isActive = true;
    key.cooldownUntil = null;
    key.consecutiveFailures = 0;
    key.usageCount += 1;
    key.lastUsedAt = new Date();
    key.lastErrorAt = null;
    key.lastErrorMessage = null;
    await key.save();

    console.log(`✅  healthy (${result.text.slice(0, 40).replace(/\s+/g, " ")})`);
    results.push({ provider: key.provider, label: key.label, status: "healthy", detail: "" });
  } catch (callErr) {
    const type = callErr?.type || "server_error";

    key.consecutiveFailures += 1;
    key.lastErrorAt = new Date();
    key.lastErrorMessage = String(callErr.message || "Unknown error").slice(0, 300);

    if (type === "rate_limit") {
      key.status = "rate_limited";
      key.cooldownUntil = new Date(Date.now() + 60_000);
    } else if (type === "invalid_key") {
      key.status = "invalid";
    } else {
      key.status = "unknown";
    }

    await key.save();

    console.log(`❌  ${type}`);
    results.push({
      provider: key.provider,
      label: key.label,
      status: type,
      detail: callErr.message,
    });
  }
}

// ── Summary table ──────────────────────────────────────────────────────
console.log("\n─────────────────────────────────────────────────────────────────");
console.log("Summary");
console.log("─────────────────────────────────────────────────────────────────");

const colWidths = { provider: 11, label: 28, status: 16 };
console.log(
  "provider".padEnd(colWidths.provider) +
    "label".padEnd(colWidths.label) +
    "status".padEnd(colWidths.status) +
    "detail"
);
console.log("-".repeat(80));

for (const r of results) {
  const detail = r.status === "healthy" ? "" : String(r.detail || "").slice(0, 60);
  console.log(
    r.provider.padEnd(colWidths.provider) +
      r.label.slice(0, colWidths.label - 1).padEnd(colWidths.label) +
      r.status.padEnd(colWidths.status) +
      detail
  );
}

const healthyCount = results.filter((r) => r.status === "healthy").length;
console.log("-".repeat(80));
console.log(`${healthyCount} / ${results.length} key(s) healthy\n`);

await mongoose.disconnect();
process.exit(0);
