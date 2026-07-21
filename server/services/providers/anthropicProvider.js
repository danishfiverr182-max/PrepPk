/**
 * services/providers/anthropicProvider.js  (Part 12   Prompt 7)
 *
 * Anthropic's Messages API differs from the OpenAI-style shape in three
 * ways this adapter has to handle:
 *
 *   1. Auth header is `x-api-key: <key>`, NOT `Authorization: Bearer <key>`.
 *   2. A required `anthropic-version` header (dated API version string).
 *   3. The system prompt is NOT a message with role "system" inside the
 *      `messages` array   Anthropic wants it as a separate top-level
 *      `system` string field. Our internal message format follows the
 *      OpenAI convention of a {role:"system", content} entry at the
 *      front, so this adapter pulls any/all "system" entries out of the
 *      incoming `messages` array, joins them, and sends that as the
 *      top-level `system` field   the `messages` array sent to Anthropic
 *      then contains only "user"/"assistant" turns, which Anthropic uses
 *      unchanged (no role renaming needed there, unlike Gemini).
 *
 * Response shape is also different: Anthropic returns
 *   { content: [ { type: "text", text: "..." }, ... ], usage: { input_tokens, output_tokens } }
 * (an array of content blocks, not a single choices[0].message.content
 * string)   so this adapter joins every "text"-type block together.
 */

import { ProviderError, fetchWithTimeout, throwForStatus } from "./httpUtils.js";

const ANTHROPIC_ENDPOINT = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

/**
 * Splits our internal {role, content}[] into:
 *   - system: a single joined string (from any role:"system" entries)
 *   - messages: only the user/assistant turns, unchanged
 */
function splitSystemPrompt(messages) {
  const systemParts = [];
  const conversation = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
    } else {
      conversation.push(msg);
    }
  }

  return { system: systemParts.join("\n\n"), conversation };
}

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model   e.g. "claude-sonnet-4-6"
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]   Anthropic requires max_tokens
 * @param {number} [params.temperature=0.4]
 * @returns {Promise<{ text: string, usage: { promptTokens, completionTokens, totalTokens } | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({ apiKey, model, messages, maxTokens = 1024, temperature = 0.4 }) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No Anthropic API key provided.", null);
  }

  const { system, conversation } = splitSystemPrompt(messages);

  const response = await fetchWithTimeout(ANTHROPIC_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens, // required by Anthropic, unlike the other providers
      temperature,
      system: system || undefined, // omit entirely if there was no system content
      messages: conversation,
    }),
  });

  if (!response.ok) {
    await throwForStatus(response, "Anthropic");
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse Anthropic response: ${parseErr.message}`,
      502
    );
  }

  // Anthropic returns an array of content blocks, not a single string.
  // Join every text block   in normal chat use there's exactly one, but
  // this stays correct if a future model ever splits its reply into
  // multiple text blocks.
  const text = Array.isArray(data?.content)
    ? data.content
        .filter((block) => block.type === "text")
        .map((block) => block.text)
        .join("")
    : "";

  if (!text) {
    throw new ProviderError("server_error", "Anthropic response had no text content.", 502);
  }

  const usage = data.usage
    ? {
        promptTokens: data.usage.input_tokens ?? null,
        completionTokens: data.usage.output_tokens ?? null,
        totalTokens:
          data.usage.input_tokens != null && data.usage.output_tokens != null
            ? data.usage.input_tokens + data.usage.output_tokens
            : null,
      }
    : null;

  return { text: text.trim(), usage };
}
