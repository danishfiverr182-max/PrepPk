/**
 * utils/nextTestNumber.js
 *
 * Computes the next auto-numbered testNumber for a group by looking at
 * the tests that ACTUALLY currently exist, instead of reading a
 * persistent TestGroup.testCount / freeTestCount counter that only ever
 * increments.
 *
 * WHY THIS EXISTS
 * ─────────────────────────────────────────────────────────────
 * The old approach incremented the counter the moment test creation
 * STARTED (an empty "settings_pending" shell document), before any MCQs
 * were ever imported. If that import later failed and the admin deleted
 * the broken test, the counter was never rolled back — so the next
 * successful test skipped a number (e.g. Test 6 fails → deleted → next
 * test becomes Test 7, even though only 6 tests actually exist).
 *
 * Computing the number fresh from real data every time is self-healing:
 * whatever the highest testNumber among tests that currently exist in
 * this group is, the next one is +1. Delete the most recent test and
 * recreate it → it reclaims the same number automatically, no manual
 * counter fix-up needed.
 *
 * This does NOT renumber or touch any EXISTING test — a gap left by
 * deleting a test in the middle of the sequence (not the most recent
 * one) stays a gap, intentionally, since relabeling live tests would
 * break already-shared links, in-progress user attempts, and result
 * history keyed by testNumber.
 *
 * Race safety: both Test and FreeCustomTest have a unique compound index
 * on { groupId, testNumber } (see their model files), so if two requests
 * ever compute the same number concurrently, the second .create() throws
 * a MongoDB duplicate-key error (code 11000) instead of silently
 * colliding. Callers should retry with a freshly recomputed number on
 * that specific error — see createWithNextTestNumber() below.
 *
 * @param {import("mongoose").Model} Model   Test or FreeCustomTest
 * @param {string} groupId
 * @returns {Promise<number>}
 */
export async function getNextTestNumber(Model, groupId) {
  const highest = await Model.findOne({ groupId })
    .sort({ testNumber: -1 })
    .select("testNumber")
    .lean();
  return (highest?.testNumber ?? 0) + 1;
}

/**
 * Creates a document with an auto-computed testNumber, retrying with a
 * freshly recomputed number if a concurrent request wins a race and
 * takes the number first (unique index violation, MongoDB error code
 * 11000). Almost never triggers in practice (single-admin usage), but
 * makes the dynamic-numbering approach safe if it ever does.
 *
 * @param {import("mongoose").Model} Model
 * @param {string} groupId
 * @param {(testNumber: number) => object} buildDoc   returns the full
 *   document fields to create, given the computed testNumber
 * @param {number} [maxAttempts=3]
 */
export async function createWithNextTestNumber(Model, groupId, buildDoc, maxAttempts = 3) {
  let lastErr;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const testNumber = await getNextTestNumber(Model, groupId);
    try {
      return await Model.create(buildDoc(testNumber));
    } catch (err) {
      const isDuplicateNumberRace =
        err?.code === 11000 && Object.keys(err?.keyPattern || {}).includes("testNumber");
      if (isDuplicateNumberRace && attempt < maxAttempts - 1) {
        lastErr = err;
        continue; // another request took this number first — recompute and retry
      }
      throw err;
    }
  }
  throw lastErr;
}
