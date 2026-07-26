/**
 * routes/publicStats.js
 *
 * Public GET /api/stats/mcq-count
 * Returns the total number of MCQs across all published tests, across
 * BOTH storage paths used in this codebase:
 *
 *   1. Default category tests (Army, Navy, Air Force):
 *      MCQs live in Section documents (Section.mcqs[]).
 *      Tests reference sections via Test.sections.{verbal|nonVerbal|academic}.sectionRef.
 *      Sections do NOT store a back-reference to their Test (no testId field),
 *      so this count is derived by walking Test -> sectionRef, not by
 *      querying Section for a testId. Only isPublished: true tests count.
 *
 *   2. Standalone custom category tests (FPSC/KPPSC-style, premium):
 *      MCQs live in the Mcq collection (models/Mcq.js), linked via
 *      testId/testModel: "Test". Test.mcqCount is a denormalized counter
 *      kept in sync by the app layer — sum it directly rather than counting
 *      Mcq documents, since that's already the source of truth used
 *      elsewhere (getTestById, publishTest, etc). Only status: "published"
 *      tests count.
 *
 *   3. Free custom category tests:
 *      Same pattern as #2 — sum FreeCustomTest.mcqCount for status:
 *      "published" documents.
 *
 * Previously this endpoint only counted source #1, so any MCQs added
 * through the custom-category (standalone premium or free) flow were
 * silently missing from the public total. It was later updated to also
 * sum sources #2/#3, but via `$size` on the embedded `mcqs` array — which
 * broke again once the MCQ storage refactor removed that field in favor
 * of the `Mcq` collection + `mcqCount` counter. This version reads
 * `mcqCount` directly, matching the current schema.
 *
 * All three counts are computed via aggregation ($sum) so MongoDB does the
 * counting — no MCQ documents are pulled into the app, keeping this
 * endpoint cheap regardless of how many MCQs exist.
 *
 * Cache-Control: public, max-age=30 short cache so the number feels live
 * but avoids hammering the DB on every page load.
 */

import { Router } from "express";
import Test           from "../models/Test.js";
import Section         from "../models/Section.js";
import FreeCustomTest   from "../models/FreeCustomTest.js";

const router = Router();

// GET /api/stats/mcq-count
router.get("/mcq-count", async (_req, res) => {
  try {
    // ── Source 1: Default category tests (MCQs live on Section docs) ──
    // Sections do NOT store a back-reference to their Test (no testId field)
    // the link only exists in the other direction, via
    // Test.sections.{verbal|nonVerbal|academic}.sectionRef. We still need
    // this lookup to finish before we know which section IDs to sum, so it
    // stays a two-step chain — but sources #2 and #3 don't depend on it or
    // on each other, so all three sources run concurrently below instead
    // of as four sequential round trips to Atlas.
    const defaultTotalPromise = Test.find(
      { isPublished: true, isStandalone: false },
      "sections"
    )
      .lean()
      .then((publishedDefaultTests) => {
        const sectionIds = [];
        for (const t of publishedDefaultTests) {
          const slots = t.sections || {};
          for (const key of ["verbal", "nonVerbal", "academic"]) {
            const ref = slots[key]?.sectionRef;
            if (ref) sectionIds.push(ref);
          }
        }

        return Section.aggregate([
          // Only sections referenced by published tests
          { $match: { _id: { $in: sectionIds } } },
          // Project the size of each section's MCQ array
          { $project: { mcqCount: { $size: { $ifNull: ["$mcqs", []] } } } },
          // Sum all MCQ counts
          { $group: { _id: null, total: { $sum: "$mcqCount" } } },
        ]);
      })
      .then((sectionResult) => sectionResult[0]?.total ?? 0);

    // ── Source 2: Standalone custom category tests (premium) ──
    // These use `status`, not `isPublished`. MCQs now live in the Mcq
    // collection — mcqCount is the denormalized counter kept in sync by
    // the app layer, so just sum it directly.
    const standaloneTotalPromise = Test.aggregate([
      { $match: { isStandalone: true, status: "published" } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$mcqCount", 0] } } } },
    ]).then((standaloneResult) => standaloneResult[0]?.total ?? 0);

    // ── Source 3: Free custom category tests ──
    const freeCustomTotalPromise = FreeCustomTest.aggregate([
      { $match: { status: "published" } },
      { $group: { _id: null, total: { $sum: { $ifNull: ["$mcqCount", 0] } } } },
    ]).then((freeCustomResult) => freeCustomResult[0]?.total ?? 0);

    const [defaultTotal, standaloneTotal, freeCustomTotal] = await Promise.all([
      defaultTotalPromise,
      standaloneTotalPromise,
      freeCustomTotalPromise,
    ]);

    const totalMcqs = defaultTotal + standaloneTotal + freeCustomTotal;

    res.set("Cache-Control", "public, max-age=30");
    return res.json({ totalMcqs });
  } catch (err) {
    console.error("GET /api/stats/mcq-count error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;