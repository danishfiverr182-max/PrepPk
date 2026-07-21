/**
 * config/groq.js  DEPRECATED (Part 12   Prompt 7)
 *
 * This file's logic has been fully migrated to
 * server/services/providers/groqProvider.js, as part of the normalized
 * multi-provider adapter layer (Groq/Gemini/OpenAI/Anthropic/OpenRouter
 * all behind one `chatComplete({ apiKey, model, messages, maxTokens,
 * temperature })` interface   see services/providers/index.js).
 *
 * server/controllers/chatController.js was updated to import
 * `getProvider("groq")` from services/providers/index.js instead of
 * `callGroq`/`GroqError` from here.
 *
 * This stub is left in place (rather than deleting the file outright) so
 * that if anything still imports from this path, it fails loudly and
 * points straight at the replacement, instead of silently breaking or
 * being confused with a missing-module error.
 *
 * Safe to delete this file entirely once you've confirmed nothing else
 * in the codebase imports "../config/groq.js" (a repo-wide grep for
 * "config/groq" turned up zero other references as of this migration).
 */

function deprecatedGroqImport() {
  throw new Error(
    'server/config/groq.js is deprecated. Import getProvider("groq") from ' +
      '"../services/providers/index.js" instead, and call ' +
      "provider.chatComplete({ apiKey, model, messages, maxTokens, temperature })."
  );
}

export function callGroq() {
  deprecatedGroqImport();
}

export class GroqError extends Error {
  constructor() {
    super("GroqError is deprecated.");
    deprecatedGroqImport();
  }
}
