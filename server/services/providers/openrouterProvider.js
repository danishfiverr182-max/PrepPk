/**
 * services/providers/openrouterProvider.js  (Part 12   Prompt 7)
 *
 * OpenRouter is OpenAI-compatible (same request/response shape as Groq
 * and OpenAI), but requires two extra headers for attribution:
 *   - HTTP-Referer: identifies which site is calling
 *   - X-Title:      display name shown in OpenRouter's dashboard
 *
 * HTTP-Referer is read from process.env.FRONTEND_URL (already set in
 * this project for CORS   see server/index.js) rather than hardcoding a
 * domain here, so it stays correct across dev/staging/production without
 * editing this file.
 */

import { ProviderError, fetchWithTimeout, throwForStatus } from "./httpUtils.js";

const OPENROUTER_ENDPOINT = "https://openrouter.ai/api/v1/chat/completions";
const APP_TITLE = "PrepPk AI Assistant";

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model   e.g. "meta-llama/llama-3.3-70b-instruct"
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.4]
 * @returns {Promise<{ text: string, usage: object | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({ apiKey, model, messages, maxTokens = 1024, temperature = 0.4 }) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No OpenRouter API key provided.", null);
  }

  // Falls back to a placeholder if FRONTEND_URL isn't set   OpenRouter
  // only uses this for attribution/analytics, so a missing/placeholder
  // value won't break the call, but should be set correctly in .env.
  const referer = process.env.FRONTEND_URL || "https://preppk.example.com";

  const response = await fetchWithTimeout(OPENROUTER_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      "HTTP-Referer": referer,
      "X-Title": APP_TITLE,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature,
    }),
  });

  if (!response.ok) {
    await throwForStatus(response, "OpenRouter");
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse OpenRouter response: ${parseErr.message}`,
      502
    );
  }

  const text = data?.choices?.[0]?.message?.content;
  if (!text) {
    throw new ProviderError("server_error", "OpenRouter response had no message content.", 502);
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
