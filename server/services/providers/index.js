/**
 * services/providers/index.js  (Part 12   Prompt 7)
 *
 * Single entry point for the whole adapter layer. The orchestrator
 * (next prompt) reads a provider name out of the ApiKey document and
 * calls getProvider(name).chatComplete({...})   it never imports an
 * individual provider file directly, so adding a 6th provider later only
 * means adding one file here plus one line in this map.
 */

import * as groqProvider from "./groqProvider.js";
import * as geminiProvider from "./geminiProvider.js";
import * as openaiProvider from "./openaiProvider.js";
import * as anthropicProvider from "./anthropicProvider.js";
import * as openrouterProvider from "./openrouterProvider.js";

export const providers = {
  groq: groqProvider,
  gemini: geminiProvider,
  openai: openaiProvider,
  anthropic: anthropicProvider,
  openrouter: openrouterProvider,
};

/**
 * @param {string} providerName   one of: "groq" | "gemini" | "openai" |
 *   "anthropic" | "openrouter"
 * @returns {{ chatComplete: Function }}
 * @throws {Error} if providerName isn't a known adapter   this is a
 *   defensive check since the caller (Prompt 6's ApiKey vault) reads
 *   provider names out of the database, and the schema enum can't fully
 *   protect against, e.g., a document written before a provider was
 *   removed from the enum.
 */
export function getProvider(providerName) {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(
      `Unknown provider "${providerName}". Known providers: ${Object.keys(providers).join(", ")}.`
    );
  }
  return provider;
}
