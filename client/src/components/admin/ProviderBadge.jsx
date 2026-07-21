/**
 * components/admin/ProviderBadge.jsx  (Part 12   Prompt 9: Key Pool Admin UI)
 *
 * Small "colored dot + label" badge for each of the five providers the
 * ApiKey vault supports (server/models/ApiKey.js's PROVIDERS enum). No
 * brand logos   just a scannable color so the key pool table reads at a
 * glance, same spirit as the existing status Badge component.
 *
 * Also exports PROVIDER_META so the Add-Key modal's provider dropdown and
 * per-provider model-name placeholder hint can share the exact same list
 * instead of duplicating it. The example model names below match the
 * `@param model e.g. "..."` hints already documented in each adapter file
 * (server/services/providers/*.js), so the UI's suggestion is guaranteed
 * to match what that adapter actually expects.
 */

export const PROVIDER_META = {
  groq: {
    label: "Groq",
    dot: "bg-orange-500",
    modelHint: "llama-3.3-70b-versatile",
  },
  gemini: {
    label: "Gemini",
    dot: "bg-blue-500",
    modelHint: "gemini-2.0-flash",
  },
  openai: {
    label: "OpenAI",
    dot: "bg-emerald-500",
    modelHint: "gpt-4o-mini",
  },
  anthropic: {
    label: "Anthropic",
    dot: "bg-amber-600",
    modelHint: "claude-sonnet-4-6",
  },
  openrouter: {
    label: "OpenRouter",
    dot: "bg-indigo-500",
    modelHint: "meta-llama/llama-3.3-70b-instruct",
  },
};

// Stable ordering for the dropdown / grouped table sections.
export const PROVIDER_ORDER = ["groq", "gemini", "openai", "anthropic", "openrouter"];

export default function ProviderBadge({ provider, className = "" }) {
  const meta = PROVIDER_META[provider] || { label: provider || "Unknown", dot: "bg-txt-muted" };

  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium text-txt-secondary ${className}`}
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}
