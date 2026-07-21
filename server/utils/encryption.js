/**
 * utils/encryption.js  (Part 12   API Key Vault)
 *
 * Symmetric encryption for provider API keys (Groq, Gemini, OpenAI, etc.)
 * before they're stored in MongoDB. Uses Node's built-in `crypto` module
 * only   no extra dependency.
 *
 * Algorithm: AES-256-GCM
 *   - 256-bit key, derived from the ENCRYPTION_KEY env var (a 64-char hex
 *     string = 32 raw bytes, decoded directly as the AES key   no KDF
 *     needed since ENCRYPTION_KEY is already high-entropy random bytes,
 *     not a human password).
 *   - A fresh random 12-byte IV is generated for every encrypt() call, so
 *     encrypting the same plaintext twice produces different ciphertext.
 *   - GCM's auth tag (16 bytes) is captured and stored alongside the
 *     ciphertext, so decrypt() can detect tampering/corruption and throw
 *     rather than silently returning garbage.
 *
 * Storage format: a single string, three base64 segments joined by ':'
 *   "<iv_base64>:<authTag_base64>:<ciphertext_base64>"
 * This round-trips cleanly through MongoDB as a plain String field   no
 * Buffer/BSON binary handling needed on the model side.
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96-bit IV is the GCM-recommended size

function getKeyBuffer() {
  const hex = process.env.ENCRYPTION_KEY;

  if (!hex) {
    // Should never happen in practice   ENCRYPTION_KEY is in REQUIRED_ENV
    // and the server fails fast at boot if it's missing. This is a
    // defensive guard in case encrypt()/decrypt() is ever called before
    // that check runs (e.g. in a script or test).
    throw new Error("ENCRYPTION_KEY is not configured.");
  }

  const buffer = Buffer.from(hex, "hex");
  if (buffer.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to exactly 32 bytes (64 hex characters), got ${buffer.length} bytes.`
    );
  }

  return buffer;
}

/**
 * @param {string} text   plaintext to encrypt (e.g. a raw provider API key)
 * @returns {string} "<iv>:<authTag>:<ciphertext>", each base64-encoded
 */
export function encrypt(text) {
  if (typeof text !== "string" || text.length === 0) {
    throw new Error("encrypt() requires a non-empty string.");
  }

  const key = getKeyBuffer();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(
    ":"
  );
}

/**
 * @param {string} payload   the "<iv>:<authTag>:<ciphertext>" string
 *   produced by encrypt()
 * @returns {string} the original plaintext
 * @throws if the payload is malformed, the auth tag doesn't match
 *   (tampering/corruption), or ENCRYPTION_KEY doesn't match what was
 *   used to encrypt it
 */
export function decrypt(payload) {
  if (typeof payload !== "string" || payload.length === 0) {
    throw new Error("decrypt() requires a non-empty string.");
  }

  const parts = payload.split(":");
  if (parts.length !== 3) {
    throw new Error("decrypt() received a malformed payload (expected iv:authTag:ciphertext).");
  }

  const [ivB64, authTagB64, ciphertextB64] = parts;
  const key = getKeyBuffer();
  const iv = Buffer.from(ivB64, "base64");
  const authTag = Buffer.from(authTagB64, "base64");
  const ciphertext = Buffer.from(ciphertextB64, "base64");

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}
