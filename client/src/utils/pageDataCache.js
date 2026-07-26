/**
 * src/utils/pageDataCache.js
 *
 * Tiny in-memory, module-level cache shared across components/hooks that
 * independently need the same "what page am I on" data — e.g. CategoryPage
 * fetches GET /tests/category/:slug for its own rendering, and
 * useChatContext also wants the category name for the AI assistant. Without
 * this, both fire the same request separately on every category page load.
 *
 * This is intentionally NOT sessionStorage/localStorage — it only needs to
 * live for the current tab session, and plain module state is simpler and
 * avoids serialization overhead for data this small and short-lived.
 *
 * Usage:
 *   pageDataCache.set("category:some-slug", { name: "Pak Army" });
 *   const cached = pageDataCache.get("category:some-slug"); // or undefined
 */

const cache = new Map();

export function getCached(key) {
  return cache.get(key);
}

export function setCached(key, value) {
  cache.set(key, value);
  return value;
}

export default { get: getCached, set: setCached };
