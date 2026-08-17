/**
 * utils/mcqJsonImport.js
 *
 * Shared parsing + validation logic for bulk-importing MCQs from a JSON file.
 * Used by JsonMcqImportButton.jsx, which is in turn used by:
 *   - Verbal / Non-Verbal / Academic section pages (premium + free mock)   via normalizeForContainerMcqs()
 *   - AdminCustomTestPage / AdminFreeCustomTestPage                       via normalizeForCustomTestMcqs()
 *
 * Expected JSON shape (either works):
 *
 *   [
 *     {
 *       "question": "What is the capital of Pakistan?",
 *       "options": ["Lahore", "Karachi", "Islamabad", "Peshawar"],
 *       "correctAnswer": "C",
 *       "explanation": "Islamabad has been the capital since 1960."
 *     },
 *     ...
 *   ]
 *
 *   OR wrapped:  { "mcqs": [ ... same array ... ] }
 *
 * Rules for "correctAnswer" (aliases accepted: correctOption, correctIndex, answer, correct):
 *   - A letter "A" | "B" | "C" | "D" (case-insensitive)   ← recommended, unambiguous
 *   - The exact text of one of the 4 options (case-insensitive, whitespace-trimmed)
 *   - A 0-based integer 0-3 (0 = A, 1 = B, 2 = C, 3 = D)
 *
 * "explanation" is optional. "imageUrl" is optional and only used for
 * Non-Verbal sections (paste-URL style, same as the manual "Paste URL" tab).
 *
 * Every question REQUIRES its own correctAnswer   there is no default/fallback
 * to a fixed option, which is what would cause every imported MCQ to end up
 * with the same "correct" answer if the parsing logic were sloppy. Each
 * question is resolved independently from its own JSON entry only.
 */

const LETTER_TO_INDEX = { a: 0, b: 1, c: 2, d: 3 };
const INDEX_TO_LETTER = ["A", "B", "C", "D"];

// The website's test UI already renders its own styled A/B/C/D option
// labels. Some source JSON bakes the same label into the option text
// itself (e.g. "A) 1793"), which would otherwise show up duplicated
// ("A" followed by "A) 1793"). Strip only a genuine leading label — the
// letter must be at the very start of the string, immediately (allowing
// whitespace) followed by one of the common label delimiters `)` `.` `-`
// `:`. Text like "The answer is A) because..." is left untouched since
// the letter isn't at the start of the string.
const OPTION_LABEL_PREFIX = /^\s*[A-Da-d]\s*[).:-]\s*/;

/** Strips a leading "A)"/"B."/"C -"/"D:" style label, if present. */
function stripOptionLabelPrefix(text) {
  if (typeof text !== "string") return text;
  return text.replace(OPTION_LABEL_PREFIX, "").trim();
}

// ── Low-level helpers ──────────────────────────────────────────

function extractRawList(parsedJson) {
  if (Array.isArray(parsedJson)) return parsedJson;
  if (parsedJson && Array.isArray(parsedJson.mcqs)) return parsedJson.mcqs;
  throw new Error(
    'The JSON must be an array of MCQs, or an object shaped like { "mcqs": [ ... ] }.'
  );
}

function validateOptions(raw, position) {
  const options = raw.options;
  if (!Array.isArray(options) || options.length !== 4) {
    throw new Error(`Question ${position}: "options" must be an array of exactly 4 answers.`);
  }
  const cleaned = options.map((o) => stripOptionLabelPrefix(o == null ? "" : String(o).trim()));
  if (cleaned.some((o) => o.length === 0)) {
    throw new Error(`Question ${position}: all 4 options must be non-empty.`);
  }
  return cleaned;
}

/**
 * Resolves the correct-answer index (0-3) for ONE question, using ONLY that
 * question's own data. Throws a specific, per-question error rather than
 * ever silently defaulting to a fixed option.
 */
function resolveCorrectIndex(raw, options, position) {
  const rawAnswer =
    raw.correctAnswer ?? raw.correctOption ?? raw.correctIndex ?? raw.answer ?? raw.correct;

  if (rawAnswer === undefined || rawAnswer === null || rawAnswer === "") {
    throw new Error(
      `Question ${position}: missing a correct answer. Add "correctAnswer": "A" (or "B"/"C"/"D").`
    );
  }

  if (typeof rawAnswer === "string") {
    const trimmed = rawAnswer.trim();
    const lower = trimmed.toLowerCase();

    // Letter form: "A" / "b" / " C "
    if (lower.length === 1 && Object.prototype.hasOwnProperty.call(LETTER_TO_INDEX, lower)) {
      return LETTER_TO_INDEX[lower];
    }

    // Fallback: the full option text was given instead of a letter. Options
    // have already had any "A) "-style label stripped by this point, so
    // strip the same label from the candidate text before comparing —
    // this only affects matching, never the stored correctAnswer value.
    const strippedLower = stripOptionLabelPrefix(trimmed).toLowerCase();
    const matchIndex = options.findIndex(
      (opt) => opt.toLowerCase() === lower || opt.toLowerCase() === strippedLower
    );
    if (matchIndex !== -1) return matchIndex;

    throw new Error(
      `Question ${position}: correctAnswer "${rawAnswer}" is not A/B/C/D and doesn't match any of the 4 options.`
    );
  }

  if (typeof rawAnswer === "number" && Number.isInteger(rawAnswer)) {
    if (rawAnswer >= 0 && rawAnswer <= 3) return rawAnswer;
    throw new Error(
      `Question ${position}: numeric correctAnswer must be 0-3 (0-based). Got ${rawAnswer}.`
    );
  }

  throw new Error(`Question ${position}: could not understand the correctAnswer value.`);
}

// ── Public API ──────────────────────────────────────────────────

/** Reads a browser File object as text. */
export function readFileAsText(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Could not read the file."));
    reader.readAsText(file);
  });
}

/** Parses raw JSON text into an array of MCQ entries (unvalidated). */
export function parseMcqJsonText(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("That file isn't valid JSON. Check for a missing comma, quote, or bracket.");
  }
  const rawList = extractRawList(parsed);
  if (rawList.length === 0) {
    throw new Error("The JSON file doesn't contain any MCQs.");
  }
  return rawList;
}

/**
 * Normalizes raw MCQ entries into the shape used by MCQContainer/MCQList
 * (Verbal, Non-Verbal, Academic   premium and free mock).
 *
 * allowEmptyQuestion: pass true for Non-Verbal, where the question text is
 * optional (the image is the question).
 */
export function normalizeForContainerMcqs(rawList, { allowEmptyQuestion = false } = {}) {
  const distribution = [0, 0, 0, 0];

  const mcqs = rawList.map((raw, i) => {
    const position = i + 1;
    if (!raw || typeof raw !== "object") {
      throw new Error(`Question ${position}: each entry must be a JSON object.`);
    }

    const question = raw.question == null ? "" : String(raw.question).trim();
    if (!question && !allowEmptyQuestion) {
      throw new Error(`Question ${position}: "question" is required.`);
    }

    const options = validateOptions(raw, position);
    const correctIndex = resolveCorrectIndex(raw, options, position);
    distribution[correctIndex] += 1;

    return {
      question,
      options,
      correctIndex,
      explanation: raw.explanation ? String(raw.explanation).trim() : "",
      imageUrl: raw.imageUrl ? String(raw.imageUrl).trim() : "",
      imagePublicId: "",
    };
  });

  return { mcqs, distribution };
}

/**
 * Normalizes raw MCQ entries into the shape used by AdminCustomTestPage /
 * AdminFreeCustomTestPage (correctOption instead of correctIndex, no
 * explanation/image fields in that subsystem).
 */
export function normalizeForCustomTestMcqs(rawList) {
  const distribution = [0, 0, 0, 0];

  const mcqs = rawList.map((raw, i) => {
    const position = i + 1;
    if (!raw || typeof raw !== "object") {
      throw new Error(`Question ${position}: each entry must be a JSON object.`);
    }

    const question = raw.question == null ? "" : String(raw.question).trim();
    if (!question) {
      throw new Error(`Question ${position}: "question" is required.`);
    }

    const options = validateOptions(raw, position);
    const correctOption = resolveCorrectIndex(raw, options, position);
    distribution[correctOption] += 1;

    return { question, options, correctOption };
  });

  return { mcqs, distribution };
}

/**
 * Returns a warning string when the imported answers look suspiciously
 * lopsided (e.g. 90%+ all marked "A"), which is the exact bug pattern to
 * guard against   without ever changing what was actually parsed.
 * Returns "" when the distribution looks fine.
 */
export function distributionWarning(distribution, total) {
  if (total < 5) return "";
  const max = Math.max(...distribution);
  if (max / total >= 0.9) {
    const letter = INDEX_TO_LETTER[distribution.indexOf(max)];
    return `Heads up: ${max} of ${total} imported questions have "${letter}" marked as correct. Double-check your JSON file if that doesn't look right.`;
  }
  return "";
}
