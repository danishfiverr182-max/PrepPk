/**
 * services/providers/groqProvider.js  (Part 12   Prompt 7)
 *
 * Groq's chat completions endpoint is OpenAI-compatible   same request
 * shape (model/messages/max_tokens/temperature), same response shape
 * (choices[0].message.content, usage.{prompt,completion,total}_tokens).
 *
 * This is the logic that used to live in server/config/groq.js (now
 * deprecated   see that file's replacement comment). Behavior is
 * unchanged; it's just reshaped to the common chatComplete() interface
 * so the orchestrator can call any provider identically.
 */

import { ProviderError, fetchWithTimeout, throwForStatus } from "./httpUtils.js";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.4]
 * @returns {Promise<{ text: string, usage: { promptTokens, completionTokens, totalTokens } | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({ apiKey, model, messages, maxTokens = 1024, temperature = 0.4 }) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No Groq API key provided.", null);
  }

  const response = await fetchWithTimeout(GROQ_ENDPOINT, {
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
    await throwForStatus(response, "Groq");
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse Groq response: ${parseErr.message}`,
      502
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError("server_error", "Groq response had no message content.", 502);
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
