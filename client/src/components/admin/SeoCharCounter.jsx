/**
 * components/admin/SeoCharCounter.jsx
 *
 * Small reusable "N/soft characters" counter, extracted from the SEO
 * Title/Description fields originally built inline in CategoryPage.jsx
 * (Prompt 2) so BlogEditorPage.jsx can use the exact same component
 * rather than a second copy of the coloring logic.
 *
 * Thresholds mirror where Google actually truncates search results —
 * ~60 chars for titles, ~160 for meta descriptions — with a soft ceiling
 * (amber) and hard ceiling (red) past that. `min`, when provided, also
 * flags amber under that floor (too short to be a useful SEO field),
 * which is the same 30/70-char floor the SEO Assistant checklist in
 * BlogEditorPage checks against — kept here as exported constants so
 * both places always agree.
 *
 * Props:
 *   length  current character count (number)
 *   min     optional soft floor — below this, amber (e.g. 30 for titles)
 *   soft    soft ceiling — above this, amber (e.g. 60 for titles)
 *   hard    hard ceiling — above this, red (e.g. 70 for titles)
 *   unit    label suffix (default: "characters")
 */

// Title: Google truncates around ~60 chars in search results.
export const SEO_TITLE_MIN = 30;
export const SEO_TITLE_SOFT_LIMIT = 60;
export const SEO_TITLE_HARD_LIMIT = 70;

// Description: Google truncates around ~160 chars in search results.
export const SEO_DESC_MIN = 70;
export const SEO_DESC_SOFT_LIMIT = 160;
export const SEO_DESC_HARD_LIMIT = 175;

export function seoCounterColorClass(length, min, soft, hard) {
  if (length > hard) return "text-danger dark:text-red-400 font-semibold";
  if (length > soft) return "text-amber-600 dark:text-amber-400 font-semibold";
  if (min && length > 0 && length < min) {
    return "text-amber-600 dark:text-amber-400 font-semibold";
  }
  return "text-txt-secondary";
}

export default function SeoCharCounter({ length, min, soft, hard, unit = "characters" }) {
  return (
    <p className={`text-xs mt-1 ${seoCounterColorClass(length, min, soft, hard)}`}>
      {length}/{soft} {unit}
    </p>
  );
}
