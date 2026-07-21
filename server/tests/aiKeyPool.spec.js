/**
 * tests/aiKeyPool.spec.js  (Part 12   Prompt 10: Key Pool Verification)
 *
 * Unit-level test coverage for services/aiKeyPool.js's pool-selection and
 * failover logic.
 *
 * ── Why this file is NOT a Playwright spec (unlike tests/chatFlow.spec.js) ──
 * chatFlow.spec.js is deliberately an HTTP-level test: it hits a running
 * server + real MongoDB and treats the Groq call as a black box. That's
 * the right shape for validating request/response contracts, but it's the
 * wrong shape for aiKeyPool.js specifically, because the whole point here
 * is to exercise branches (cooldown skip, rate-limit failover, 3x
 * invalid-key auto-deactivation, empty pool) that would require either a
 * live database seeded into very specific states or real, flaky calls to
 * five different AI providers just to trigger one error branch each. That
 * is slow, non-deterministic, and burns real API quota for no reason.
 *
 * Instead, this file uses Node's built-in test runner (`node --test`,
 * zero extra dependencies   consistent with this project's "no test
 * framework installed yet" package.json) and mocks at exactly two
 * seams:
 *
 *   1. The `ApiKey` mongoose model   `.find()/.findByIdAndUpdate()` are
 *      swapped for an in-memory fixture-array implementation that mimics
 *      just enough of Mongo's query semantics (isActive / status $ne /
 *      cooldownUntil $or / lastUsedAt sort / $set / $inc) to exercise
 *      aiKeyPool.js's real query-construction and update logic against.
 *   2. `services/providers/index.js`'s `providers` registry object   its
 *      `groq` entry is swapped for a stub `{ chatComplete }` so a test can
 *      script exactly which error (or success) a given attempt returns,
 *      with zero real network calls.
 *
 * Encryption is NOT mocked: ENCRYPTION_KEY is set below and the real
 * encrypt()/decrypt() from utils/encryption.js are used to produce valid
 * fixture ciphertext, so the decrypt-just-before-use step in
 * getChatCompletion() is exercised for real, not stubbed away.
 *
 * ── HOW TO RUN ──────────────────────────────────────────────────
 *   cd server
 *   node --test tests/aiKeyPool.spec.js
 * (or `npm run test:unit`, see package.json)
 * ─────────────────────────────────────────────────────────────
 */

import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";

// Needed before importing anything that touches utils/encryption.js.
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY || "5a315d1d436a7fb33b01ad55c31b45b8dad433e6cf96c1ef49478a27176ed5f6";

import ApiKey from "../models/ApiKey.js";
import { encrypt } from "../utils/encryption.js";
import { providers } from "../services/providers/index.js";
import {
  loadActiveKeys,
  getChatCompletion,
  _resetCacheForTests,
} from "../services/aiKeyPool.js";

// ── Fixture / mock plumbing ──────────────────────────────────────────────

let nextId = 1;
function makeId() {
  // Fake-but-unique ObjectId-shaped string; only String(id) equality is
  // ever relied on anywhere in aiKeyPool.js, so a real ObjectId isn't needed.
  return `mock_id_${nextId++}`;
}

function makeKeyDoc(overrides = {}) {
  return {
    _id: makeId(),
    provider: "groq",
    label: "Test key",
    encryptedKey: encrypt("sk-test-raw-key"),
    model: "llama-3.3-70b-versatile",
    isActive: true,
    status: "healthy",
    cooldownUntil: null,
    consecutiveFailures: 0,
    usageCount: 0,
    lastUsedAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    ...overrides,
  };
}

/**
 * Installs an in-memory mock of the two ApiKey static methods aiKeyPool.js
 * actually calls, backed by `docs` (mutated in place so tests can assert
 * on it afterwards). Mimics real Mongo semantics closely enough for our
 * query shapes: isActive equality, status $ne, cooldownUntil $or, and a
 * lastUsedAt-ascending sort (nulls first, matching Mongo's null-sorts-first
 * behavior for this field).
 */
function installApiKeyMock(docs) {
  const originalFind = ApiKey.find;
  const originalFindByIdAndUpdate = ApiKey.findByIdAndUpdate;
  const updateCalls = [];

  function matchesQuery(doc, query) {
    if ("isActive" in query && doc.isActive !== query.isActive) return false;
    if (query.status?.$ne !== undefined && doc.status === query.status.$ne) return false;
    if (Array.isArray(query.$or)) {
      const now = new Date();
      const passes = query.$or.some((cond) => {
        if (Object.prototype.hasOwnProperty.call(cond, "cooldownUntil") && cond.cooldownUntil === null) {
          return doc.cooldownUntil === null || doc.cooldownUntil === undefined;
        }
        if (cond.cooldownUntil?.$lt !== undefined) {
          return doc.cooldownUntil != null && new Date(doc.cooldownUntil) < now;
        }
        return false;
      });
      if (!passes) return false;
    }
    return true;
  }

  ApiKey.find = (query = {}) => {
    const filtered = docs.filter((doc) => matchesQuery(doc, query));
    const chain = {
      select() {
        return chain;
      },
      sort(sortSpec) {
        const [field, dir] = Object.entries(sortSpec)[0];
        filtered.sort((a, b) => {
          const av = a[field] == null ? -Infinity : new Date(a[field]).getTime();
          const bv = b[field] == null ? -Infinity : new Date(b[field]).getTime();
          return dir === 1 ? av - bv : bv - av;
        });
        return chain;
      },
      lean() {
        // Mimic .lean() returning plain-object copies.
        return Promise.resolve(filtered.map((d) => ({ ...d })));
      },
    };
    return chain;
  };

  ApiKey.findByIdAndUpdate = (id, update, opts = {}) => {
    updateCalls.push({ id: String(id), update });
    const doc = docs.find((d) => String(d._id) === String(id));
    if (!doc) return Promise.resolve(null);
    if (update.$set) Object.assign(doc, update.$set);
    if (update.$inc) {
      for (const [key, amount] of Object.entries(update.$inc)) {
        doc[key] = (doc[key] || 0) + amount;
      }
    }
    return Promise.resolve(opts.new ? { ...doc } : { ...doc });
  };

  return {
    updateCalls,
    restore() {
      ApiKey.find = originalFind;
      ApiKey.findByIdAndUpdate = originalFindByIdAndUpdate;
    },
  };
}

/** Swaps providers.groq for a stub with a scripted chatComplete(). */
function installGroqStub(chatCompleteImpl) {
  const original = providers.groq;
  providers.groq = { chatComplete: chatCompleteImpl };
  return {
    restore() {
      providers.groq = original;
    },
  };
}

// ── Test suite ────────────────────────────────────────────────────────

describe("aiKeyPool", () => {
  let apiKeyMock;
  let groqStub;

  beforeEach(() => {
    _resetCacheForTests();
  });

  afterEach(() => {
    apiKeyMock?.restore();
    groqStub?.restore();
    apiKeyMock = undefined;
    groqStub = undefined;
    _resetCacheForTests();
  });

  test("loadActiveKeys() skips keys with isActive: false", async () => {
    const active = makeKeyDoc({ isActive: true });
    const inactive = makeKeyDoc({ isActive: false });
    apiKeyMock = installApiKeyMock([active, inactive]);

    const pool = await loadActiveKeys();

    assert.equal(pool.length, 1);
    assert.equal(pool[0]._id, active._id);
  });

  test("loadActiveKeys() skips keys still in cooldown", async () => {
    const cooling = makeKeyDoc({ cooldownUntil: new Date(Date.now() + 60_000) }); // future
    const expired = makeKeyDoc({ cooldownUntil: new Date(Date.now() - 60_000) }); // past, eligible again
    const neverCooled = makeKeyDoc({ cooldownUntil: null });
    apiKeyMock = installApiKeyMock([cooling, expired, neverCooled]);

    const pool = await loadActiveKeys();
    const ids = pool.map((d) => d._id);

    assert.ok(!ids.includes(cooling._id), "a key still in cooldown must be excluded");
    assert.ok(ids.includes(expired._id), "a key whose cooldown has passed must be included");
    assert.ok(ids.includes(neverCooled._id), "a key that was never cooled down must be included");
  });

  test("a simulated rate_limit response sets cooldownUntil and fails over to the next key", async () => {
    const keyA = makeKeyDoc({ label: "Key A", lastUsedAt: null });
    const keyB = makeKeyDoc({ label: "Key B", lastUsedAt: new Date(Date.now() - 1000) });
    apiKeyMock = installApiKeyMock([keyA, keyB]);

    let calls = 0;
    groqStub = installGroqStub(async ({ apiKey }) => {
      calls += 1;
      if (calls === 1) {
        const err = new Error("Rate limited by provider");
        err.type = "rate_limit";
        throw err;
      }
      return { text: "ok from second key", usage: null };
    });

    const result = await getChatCompletion({ messages: [{ role: "user", content: "hi" }] });

    assert.equal(calls, 2, "should have tried a second key after the first rate-limited");
    assert.equal(result.text, "ok from second key");

    const rateLimitUpdate = apiKeyMock.updateCalls.find(
      (c) => c.id === String(keyA._id) && c.update.$set?.status === "rate_limited"
    );
    assert.ok(rateLimitUpdate, "expected a rate_limited status update for the first key");
    assert.ok(
      rateLimitUpdate.update.$set.cooldownUntil instanceof Date &&
        rateLimitUpdate.update.$set.cooldownUntil.getTime() > Date.now(),
      "cooldownUntil should be set to a future Date"
    );
  });

  test("3 consecutive invalid_key failures auto-deactivate that key", async () => {
    const key = makeKeyDoc({ label: "Bad key" });
    apiKeyMock = installApiKeyMock([key]);

    groqStub = installGroqStub(async () => {
      const err = new Error("401 Unauthorized");
      err.type = "invalid_key";
      throw err;
    });

    for (let i = 0; i < 3; i++) {
      await assert.rejects(
        () => getChatCompletion({ messages: [{ role: "user", content: "hi" }] }),
        (err) => err.code === "ALL_KEYS_EXHAUSTED"
      );
    }

    assert.equal(key.consecutiveFailures, 3);
    assert.equal(key.status, "invalid");
    assert.equal(key.isActive, false, "key should auto-deactivate once the failure threshold is hit");
  });

  test("getChatCompletion() throws NO_KEYS_AVAILABLE when the pool is empty", async () => {
    apiKeyMock = installApiKeyMock([]);

    await assert.rejects(
      () => getChatCompletion({ messages: [{ role: "user", content: "hi" }] }),
      (err) => {
        assert.equal(err.code, "NO_KEYS_AVAILABLE");
        return true;
      }
    );
  });
});
