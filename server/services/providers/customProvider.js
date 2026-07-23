/**
 * services/providers/customProvider.js  (Part 12   Custom OpenAI-compatible provider)
 *
 * Most free-tier LLM APIs (Mistral, Cerebras, DeepSeek, Together AI,
 * Fireworks AI, GitHub Models, and many more) expose the exact same
 * request/response shape as OpenAI's chat completions endpoint   only
 * the base URL, model name, and key differ. Rather than writing a new
 * dedicated adapter file for every one of these (as groqProvider.js and
 * openrouterProvider.js already do individually), this adapter is
 * generic: the ApiKey document supplies its own `baseUrl`, and this file
 * just POSTs the standard OpenAI-shaped body there.
 *
 * This intentionally mirrors groqProvider.js line-for-line in structure
 * (timeout handling, error classification, response parsing) so it slots
 * into aiKeyPool.js's failover logic identically to every other adapter.
 * Only Gemini and Anthropic need bespoke adapters, since their
 * request/response shapes genuinely differ from the OpenAI standard   see
 * geminiProvider.js / anthropicProvider.js.
 */

import { ProviderError, fetchWithTimeout, throwForStatus } from "./httpUtils.js";

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.4]
 * @param {string} params.baseUrl   FULL chat-completions endpoint URL, e.g.
 *   "https://api.mistral.ai/v1/chat/completions" — used exactly as given,
 *   never guessed or appended to, since providers vary on whether the
 *   path already includes "/v1".
 * @returns {Promise<{ text: string, usage: { promptTokens, completionTokens, totalTokens } | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({
  apiKey,
  model,
  messages,
  maxTokens = 1024,
  temperature = 0.4,
  baseUrl,
}) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No API key provided for this custom provider.", null);
  }

  if (!baseUrl || typeof baseUrl !== "string" || !baseUrl.trim().startsWith("https://")) {
    // Not a provider-side failure   a misconfigured ApiKey document. Treat
    // as invalid_key so the pool marks this specific key unhealthy rather
    // than retrying it forever, without crashing the whole request.
    throw new ProviderError(
      "invalid_key",
      "This custom provider key has no valid baseUrl configured (must start with https://).",
      null
    );
  }

  const response = await fetchWithTimeout(baseUrl.trim(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    await throwForStatus(response, "Custom provider");
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse custom provider response: ${parseErr.message}`,
      502
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError(
      "server_error",
      "Custom provider response had no message content (unexpected response shape   confirm this endpoint is truly OpenAI-compatible).",
      502
    );
  }

  const usage = data.usage
    ? {
        promptTokens: data.usage.prompt_tokens ?? null,
        completionTokens: data.usage.completion_tokens ?? null,
        totalTokens: data.usage.total_tokens ?? null,
      }
    : null;

  return { text: text.trim(), usage };
}
