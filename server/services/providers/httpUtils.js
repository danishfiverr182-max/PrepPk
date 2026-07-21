/**
 * services/providers/httpUtils.js  (Part 12   Prompt 7)
 *
 * Small shared toolkit used by every provider adapter, so the
 * timeout/classification logic (the part that MUST be identical across
 * providers for the orchestrator to reason about them uniformly) lives
 * in exactly one place, while each adapter still owns its own
 * request-building and response-parsing (which genuinely differs per
 * provider).
 */

const DEFAULT_TIMEOUT_MS = 15_000;

/**
 * Typed error every provider adapter throws. `.type` is what the
 * orchestrator (next prompt) uses to decide whether to retry with a
 * different key/provider or mark this key unhealthy.
 *   type: "rate_limit" | "invalid_key" | "server_error" | "timeout"
 */
export class ProviderError extends Error {
  constructor(type, message, status = null) {
    super(message);
    this.name = "ProviderError";
    this.type = type;
    this.status = status;
  }
}

/**
 * Maps an HTTP status code to one of our four error types. Shared so
 * every adapter classifies identically for the common cases (429 → rate
 * limit, 401/403 → invalid key, 5xx → server error). Individual adapters
 * can still special-case a provider's quirks (e.g. Gemini sometimes
 * returns 400 for an invalid key) before falling back to this.
 */
export function classifyStatus(status) {
  if (status === 429) return "rate_limit";
  if (status === 401 || status === 403) return "invalid_key";
  if (status >= 500) return "server_error";
  return "server_error"; // any other unexpected non-2xx
}

/**
 * fetch() wrapped with a hard timeout via AbortController. Network
 * failures (DNS, connection refused, etc.) and timeouts are both
 * reported as ProviderError("timeout", ...)   the spec for this prompt
 * groups both under the same "timeout" classification, since from the
 * orchestrator's point of view both just mean "this call didn't
 * complete, try someone else."
 */
export async function fetchWithTimeout(url, options = {}, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } catch (err) {
    if (err.name === "AbortError") {
      throw new ProviderError("timeout", `Request timed out after ${timeoutMs}ms`, null);
    }
    throw new ProviderError("timeout", `Network error: ${err.message}`, null);
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Reads a non-OK response body as text (best-effort) and throws the
 * appropriately classified ProviderError. Shared so every adapter
 * produces a consistently-shaped error message.
 */
export async function throwForStatus(response, providerLabel, overrideType = null) {
  let bodyText = "";
  try {
    bodyText = await response.text();
  } catch {
    // ignore body read failure
  }

  const type = overrideType || classifyStatus(response.status);
  throw new ProviderError(
    type,
    `${providerLabel} request failed with status ${response.status}: ${bodyText.slice(0, 300)}`,
    response.status
  );
}
