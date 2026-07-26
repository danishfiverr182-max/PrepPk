/**
 * server/utils/wordCount.js
 *
 * Shared plain-text word-count logic for admin-authored HTML content.
 * Extracted from models/BlogPost.js's readTimeMinutes pre-save hook so
 * the exact same "strip tags → split on whitespace → count" logic can
 * be reused wherever else a word count is needed, without silently
 * drifting out of sync with how read time is computed.
 *
 * Used by:
 *  - models/BlogPost.js        (readTimeMinutes pre-save hook)
 *  - routes/adminSeoHealth.js  (thin-content check: published posts
 *                                under 300 words)
 */

// ── Strip HTML tags down to plain text ──────────────────────────
// Simple regex strip (no extra dependency) — replaces tags with a
// space so "<p>Foo</p><p>Bar</p>" doesn't collapse into "FooBar".
export function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ");
}

// ── Count words in HTML content ─────────────────────────────────
export function countWords(html) {
  const text = stripHtml(html);
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ── Estimate reading time from HTML content ─────────────────────
// ~200 wpm average adult reading speed, rounded up, with a floor of
// 1 minute so an empty/very short draft doesn't show "0 min read".
export function computeReadTimeMinutes(html) {
  const words = countWords(html);
  const minutes = Math.ceil(words / 200);
  return Math.max(minutes, 1);
}
