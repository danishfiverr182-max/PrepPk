/**
 * services/providers/openaiProvider.js  (Part 12   Prompt 7, param fix Prompt 11)
 *
 * Standard OpenAI chat completions shape   this is the same shape Groq
 * and OpenRouter both mirror, so this file and groqProvider.js /
 * openrouterProvider.js look almost identical on purpose.
 *
 * ── max_completion_tokens, not max_tokens (Part 12   Prompt 11) ────────
 * OpenAI's reasoning-model family (o1, o3, o4-mini, gpt-5, etc.) rejects
 * the classic `max_tokens` field outright with a 400
 * ("Unsupported parameter: 'max_tokens' is not supported with this
 * model. Use 'max_completion_tokens' instead."), and OpenAI's own API
 * reference now marks `max_tokens` deprecated across the whole Chat
 * Completions endpoint, not just for reasoning models. `max_completion_tokens`
 * is the forward-compatible field name and works on both older
 * (gpt-4o-mini, gpt-4o, etc.) and newer reasoning models, so we send that
 * unconditionally here rather than trying to sniff the model family from
 * its name (which OpenAI doesn't document as a stable naming scheme).
 *
 * This is OpenAI-specific: Groq's and OpenRouter's adapters intentionally
 * still send `max_tokens`, since those are separate OpenAI-*compatible*
 * APIs (not OpenAI itself) whose own model catalogs still expect it.
 */

import { ProviderError, fetchWithTimeout, throwForStatus } from "./httpUtils.js";

const OPENAI_ENDPOINT = "https://api.openai.com/v1/chat/completions";

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model   e.g. "gpt-4o-mini", "o3-mini"
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.4]
 * @returns {Promise<{ text: string, usage: object | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({ apiKey, model, messages, maxTokens = 1024, temperature = 0.4 }) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No OpenAI API key provided.", null);
  }

  const response = await fetchWithTimeout(OPENAI_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_completion_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    await throwForStatus(response, "OpenAI");
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse OpenAI response: ${parseErr.message}`,
      502
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError("server_error", "OpenAI response had no message content.", 502);
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
