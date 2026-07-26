/**
 * src/hooks/useTestProgress.js
 *
 * Persists in-progress test state (answers, current question, attempt start
 * time) to localStorage so a page refresh, accidental tab close, or crash
 * resumes the user exactly where they left off instead of restarting the
 * section from question 1.
 *
 * This mirrors the approach already used for the countdown timer
 * (see hooks/useTimer.js), which survives refresh via localStorage +
 * Date.now() timestamps. Progress and timer are deliberately kept as
 * separate storage entries so either can be cleared independently.
 *
 * Why restoring answers by array index is safe:
 *   Each section's MCQ order is a deterministic seeded shuffle keyed by
 *   `${testId}:${sectionKey}` (see server/utils/seededShuffle.js) — the
 *   seed depends only on the test/section identity, not the user, session,
 *   or request time. Re-fetching the same section always returns questions
 *   in the same on-screen order, so an index-keyed `answers` map such as
 *   `{ 0: 2, 3: 1 }` safely rehydrates against a freshly re-fetched `mcqs`
 *   array. As a defense-in-depth check, the snapshot also stores the fetched
 *   MCQ ids and is discarded if they don't match on restore (e.g. the admin
 *   edited the question pool since the attempt started).
 *
 * Staleness guards:
 *   - Snapshot is dropped if the freshly fetched mcq _id sequence differs.
 *   - Snapshot is dropped once older than MAX_AGE_MS so a long-abandoned
 *     attempt doesn't resurrect days later.
 *   - Snapshot is cleared on successful submit (call clearTestProgress),
 *     so retaking a finished test always starts clean.
 */

import safeStorage from "../public/utils/safeStorage";

const MAX_AGE_MS = 6 * 60 * 60 * 1000; // 6 hours

function progressKey(storagePrefix, testId, sectionKey) {
  return `${storagePrefix}_progress_${testId}_${sectionKey ?? "default"}`;
}

/**
 * Validate and read a saved snapshot against a freshly fetched mcq list.
 * Returns null if there is nothing usable to restore (none saved, expired,
 * or the question set no longer matches).
 */
export function loadTestProgress(storagePrefix, testId, sectionKey, mcqs) {
  const key = progressKey(storagePrefix, testId, sectionKey);
  const snapshot = safeStorage.getJson(key, null);
  if (!snapshot || typeof snapshot !== "object") return null;

  const { answers, currentIndex, startTime, mcqIds, savedAt } = snapshot;

  if (!Number.isFinite(savedAt) || Date.now() - savedAt > MAX_AGE_MS) {
    safeStorage.removeItem(key);
    return null;
  }

  const freshIds = mcqs.map((m) => m._id);
  const sameQuestionSet =
    Array.isArray(mcqIds) &&
    mcqIds.length === freshIds.length &&
    mcqIds.every((id, i) => id === freshIds[i]);

  if (!sameQuestionSet) {
    // Question pool/order changed since the snapshot was written — resuming
    // would map old answers onto the wrong questions, so start clean.
    safeStorage.removeItem(key);
    return null;
  }

  return {
    answers: answers && typeof answers === "object" ? answers : {},
    currentIndex:
      Number.isInteger(currentIndex) &&
      currentIndex >= 0 &&
      currentIndex < freshIds.length
        ? currentIndex
        : 0,
    startTime: Number.isFinite(startTime) ? startTime : Date.now(),
  };
}

/**
 * Write the current attempt state. Cheap synchronous write (small JSON
 * blob), so it's safe to call on every answer/navigation change without
 * debouncing.
 */
export function saveTestProgress(
  storagePrefix,
  testId,
  sectionKey,
  { answers, currentIndex, startTime, mcqs },
) {
  const key = progressKey(storagePrefix, testId, sectionKey);
  safeStorage.setJson(key, {
    answers,
    currentIndex,
    startTime,
    mcqIds: mcqs.map((m) => m._id),
    savedAt: Date.now(),
  });
}

/** Call after a successful submit (alongside clearTimerStorage). */
export function clearTestProgress(storagePrefix, testId, sectionKey) {
  safeStorage.removeItem(progressKey(storagePrefix, testId, sectionKey));
}
