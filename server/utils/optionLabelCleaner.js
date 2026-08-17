/**
 * utils/optionLabelCleaner.js
 *
 * The test UI renders its own styled A/B/C/D option labels. Some imported
 * (or hand-typed) MCQ JSON already bakes the same label into the option
 * text itself — e.g. "A) 1793" — which used to make the UI show the label
 * twice ("A" followed by "A) 1793").
 *
 * This module removes ONLY a genuine leading option-label prefix such as:
 *   "A) 1793"   -> "1793"
 *   "B. Paris"  -> "Paris"
 *   "C - Rome"  -> "Rome"
 *   "D: Cairo"  -> "Cairo"
 *   "A)Paris"   -> "Paris"   (no space after the delimiter)
 *
 * It deliberately does NOT touch a letter that merely appears somewhere in
 * the text, e.g. "The answer is A) because..." is left untouched, because
 * the prefix has to be the letter, and it has to be at the very start of
 * the string.
 *
 * Only A, B, C, D are recognised (the fixed 4-option scheme the site uses),
 * and only when followed by one of the common label delimiters: `)` `.`
 * `-` `:`. A bare letter with no delimiter (e.g. "A Paris") is left alone,
 * since that's ambiguous with an option that legitimately starts with the
 * word "A".
 */

// Leading whitespace, a single A-D letter, optional whitespace, one of the
// recognised delimiters, then optional whitespace before the real text.
const OPTION_LABEL_PREFIX = /^\s*[A-Da-d]\s*[).:-]\s*/;

/**
 * Strips a leading "A)"/"B."/"C -"/"D:" style label from a single option
 * string, if present. Safe to call on already-clean text (no-op).
 */
export function stripOptionLabelPrefix(text) {
  if (typeof text !== "string") return text;
  return text.replace(OPTION_LABEL_PREFIX, "").trim();
}

/**
 * Cleans a 4-option (or N-option) array in place-safe fashion, returning a
 * new array. Non-string / empty entries are passed through untouched so
 * this never throws on malformed data — validation elsewhere is still
 * responsible for rejecting genuinely bad entries.
 */
export function cleanOptionsArray(options) {
  if (!Array.isArray(options)) return options;
  return options.map((opt) => (typeof opt === "string" ? stripOptionLabelPrefix(opt) : opt));
}

/**
 * Mutates a single lean/hydrated MCQ-like object's `options` array in
 * place (works for both plain objects returned by `.lean()` and real
 * Mongoose documents, since both support plain property assignment).
 */
function cleanMcqInPlace(mcq) {
  if (mcq && Array.isArray(mcq.options)) {
    mcq.options = cleanOptionsArray(mcq.options);
  }
}

/**
 * Walks a query result that may be:
 *   - a single MCQ-shaped doc/object (has `.options` directly), or
 *   - a single container doc/object with a nested `.mcqs` array, or
 *   - an array of either of the above, or
 *   - null/undefined (e.g. findOne found nothing)
 * and cleans option-label prefixes throughout, in place.
 */
export function cleanOptionLabelsDeep(result) {
  if (!result) return result;

  const items = Array.isArray(result) ? result : [result];

  for (const item of items) {
    if (!item || typeof item !== "object") continue;

    if (Array.isArray(item.options)) {
      cleanMcqInPlace(item);
    }

    if (Array.isArray(item.mcqs)) {
      for (const mcq of item.mcqs) cleanMcqInPlace(mcq);
    }
  }

  return result;
}
