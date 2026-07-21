/**
 * services/providers/geminiProvider.js  (Part 12   Prompt 7)
 *
 * Gemini's generateContent endpoint has the most different shape of any
 * provider here. Three mapping differences this adapter handles:
 *
 *   1. No `messages` array   Gemini uses `contents: [{ role, parts }]`,
 *      where each `parts` entry is `{ text: "..." }` rather than a plain
 *      string. Our internal {role, content}[] is mapped one-for-one into
 *      that shape.
 *
 *   2. Role names differ: Gemini only knows "user" and "model" (not
 *      "assistant")   so every internal "assistant" message becomes
 *      role: "model" here. "user" passes through unchanged.
 *
 *   3. Like Anthropic, the system prompt is NOT part of the turn array.
 *      Gemini wants it as a separate top-level `systemInstruction`
 *      object: `{ parts: [{ text: "..." }] }`. Any/all role:"system"
 *      entries in the incoming messages are pulled out, joined, and sent
 *      there instead of inside `contents`.
 *
 * Auth is also different: the API key is a `?key=` query parameter on
 * the URL, not a header at all.
 *
 * Response shape: `candidates[0].content.parts[].text` (an array of
 * parts, potentially split across multiple entries)   NOT a single
 * `choices[0].message.content` string like the OpenAI-style providers.
 */

import { ProviderError, fetchWithTimeout, classifyStatus } from "./httpUtils.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

/**
 * Splits our internal {role, content}[] into:
 *   - systemInstruction: { parts: [{ text }] } | undefined
 *   - contents: Gemini-shaped turns with "assistant" remapped to "model"
 */
function toGeminiContents(messages) {
  const systemParts = [];
  const contents = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemParts.push(msg.content);
      continue;
    }
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }

  const systemInstruction =
    systemParts.length > 0 ? { parts: [{ text: systemParts.join("\n\n") }] } : undefined;

  return { systemInstruction, contents };
}

/**
 * @param {Object} params
 * @param {string} params.apiKey
 * @param {string} params.model   e.g. "gemini-2.0-flash"
 * @param {Array<{role: string, content: string}>} params.messages
 * @param {number} [params.maxTokens=1024]
 * @param {number} [params.temperature=0.4]
 * @returns {Promise<{ text: string, usage: { promptTokens, completionTokens, totalTokens } | null }>}
 * @throws {ProviderError}
 */
export async function chatComplete({ apiKey, model, messages, maxTokens = 1024, temperature = 0.4 }) {
  if (!apiKey) {
    throw new ProviderError("invalid_key", "No Gemini API key provided.", null);
  }

  const { systemInstruction, contents } = toGeminiContents(messages);

  const url = `${GEMINI_BASE}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const response = await fetchWithTimeout(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction } : {}),
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature,
      },
    }),
  });

  if (!response.ok) {
    let bodyText = "";
    let parsedBody = null;
    try {
      bodyText = await response.text();
      parsedBody = JSON.parse(bodyText);
    } catch {
      // body wasn't JSON or was unreadable   fall through with bodyText only
    }

    // Google's API sometimes reports an invalid/unauthorized key as a 400
    // with error.status "INVALID_ARGUMENT" or "PERMISSION_DENIED", rather
    // than a 401/403 like the other providers. Check for that before
    // falling back to the shared status-code classification.
    const googleStatus = parsedBody?.error?.status;
    let type;
    if (googleStatus === "PERMISSION_DENIED" || googleStatus === "UNAUTHENTICATED") {
      type = "invalid_key";
    } else if (googleStatus === "RESOURCE_EXHAUSTED") {
      type = "rate_limit";
    } else {
      type = classifyStatus(response.status);
    }

    throw new ProviderError(
      type,
      `Gemini request failed with status ${response.status}: ${bodyText.slice(0, 300)}`,
      response.status
    );
  }

  let data;
  try {
    data = await response.json();
  } catch (parseErr) {
    throw new ProviderError(
      "server_error",
      `Failed to parse Gemini response: ${parseErr.message}`,
      502
    );
  }

  const parts = data?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts) ? parts.map((p) => p.text || "").join("") : "";

  if (!text) {
    throw new ProviderError("server_error", "Gemini response had no text content.", 502);
  }

  const usageMeta = data.usageMetadata;
  const usage = usageMeta
    ? {
        promptTokens: usageMeta.promptTokenCount ?? null,
        completionTokens: usageMeta.candidatesTokenCount ?? null,
        totalTokens: usageMeta.totalTokenCount ?? null,
      }
    : null;

  return { text: text.trim(), usage };
}
