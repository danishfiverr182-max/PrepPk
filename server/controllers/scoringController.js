/**
 * controllers/scoringController.js  (Part 10   Prompts 1 + 5)
 *
 * Handles submission, scoring, and result retrieval for both premium sections
 * (referenced by Test documents) and free tests (FreeMockTest documents).
 *
 * The controller follows exactly the 9-step algorithm specified in the prompt:
 *
 *  1. Read request body: { testId, sectionType, answers, timeTaken }
 *  2. Find the Test document (or FreeMockTest for free tests)
 *  3. Locate the correct section inside the test
 *  4. Determine passMarkUsed: 50 for 3-section tests, 80 for standalone
 *  5. Score the answers against each MCQ's correctIndex
 *  6. Calculate percentage (rounded to 2 decimal places)
 *  7. Determine passed: percentage >= passMarkUsed
 *  8. Save a new TestResult document
 *  9. Return { score, totalMcqs, percentage, passed, passMarkUsed, resultId }
 *
 * Pass-mark rules (enforced here, not on the frontend):
 *  - 3-section tests (verbal + nonVerbal + academic)  → 50%
 *  - Standalone tests (sectionType === "standalone")  → 80%
 *
 * No negative marking: unanswered or wrong answers contribute 0 to the score.
 *
 * userId:
 *  - For premium users the caller passes req.user._id (set by userProtect).
 *  - For guest/free tests the userId is the string "guest".
 *  - The route decides which to use; this controller accepts userId as a param.
 */

import mongoose from "mongoose";
import Test        from "../models/Test.js";
import Section     from "../models/Section.js";
import TestResult  from "../models/TestResult.js";
import Category    from "../models/Category.js";
import Mcq          from "../models/Mcq.js";

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Determines the pass mark for a test.
 * A test is "standalone" when the sectionType submitted is "standalone", or
 * when only one of the three section slots on the Test document is complete.
 */
function determinePassMark(test, sectionType) {
  // Standalone custom-category tests carry their own pass mark on the
  // Test document itself (set to 80 at creation time). Prefer that value
  // over a hardcoded constant so it stays in sync with the schema.
  if (test.isStandalone === true || sectionType === "standalone") {
    return typeof test.passMarkPercentage === "number" ? test.passMarkPercentage : 80;
  }

  // Count completed sections on this Test document.
  // If all three are present the test uses 3-section rules (50%).
  // A test with only 1 complete section is treated as standalone (80%).
  const slots = test.sections ?? {};
  const completedCount = ["verbal", "nonVerbal", "academic"].filter(
    (key) => slots[key]?.status === "complete" && slots[key]?.sectionRef
  ).length;

  return completedCount >= 2 ? 50 : 80;
}

/**
 * Reads { totalMarks, negativeMarking } off a Section or standalone Test
 * document, with safe fallbacks for older documents saved before these
 * fields existed (default totalMarks = 100, negative marking off).
 */
function getMarksConfig(doc) {
  const totalMarks = typeof doc?.totalMarks === "number" && doc.totalMarks > 0
    ? doc.totalMarks
    : 100;
  const negEnabled = doc?.negativeMarking?.enabled === true;
  const marksPerWrong = negEnabled && typeof doc.negativeMarking.marksPerWrong === "number"
    ? Math.max(0, doc.negativeMarking.marksPerWrong)
    : 0;
  return { totalMarks, negativeMarkingEnabled: negEnabled, marksPerWrong };
}

/**
 * Computes marks-based results from a correct/wrong/total breakdown.
 * Each MCQ is worth (totalMarks / totalMcqs) marks. Wrong (attempted)
 * answers deduct marksPerWrong marks each when negative marking is
 * enabled. Unanswered questions are never penalised. obtainedMarks is
 * NOT clamped to 0 — a heavily negative-marked attempt can legitimately
 * score below zero, same as on paper.
 */
function computeMarks({ correctCount, wrongCount, totalMcqs, config }) {
  const { totalMarks, negativeMarkingEnabled, marksPerWrong } = config;
  const marksPerQuestion = totalMcqs > 0 ? totalMarks / totalMcqs : 0;

  const obtainedMarks =
    correctCount * marksPerQuestion -
    (negativeMarkingEnabled ? wrongCount * marksPerWrong : 0);

  const percentage =
    totalMarks > 0
      ? Math.round((obtainedMarks / totalMarks) * 10000) / 100
      : 0;

  return {
    totalMarks,
    obtainedMarks: Math.round(obtainedMarks * 100) / 100,
    percentage,
    negativeMarkingApplied: negativeMarkingEnabled,
  };
}

// ── submitSection ─────────────────────────────────────────────────────────────
/**
 * POST /api/results/submit
 *
 * Body: { testId, sectionType, answers: [{ mcqId, selectedOption }], timeTaken? }
 * Headers: cookie with userToken (optional   guests are allowed)
 *
 * The route layer passes userId (ObjectId or "guest") so this controller
 * stays decoupled from req.user.
 */
export async function submitSection(req, res) {
  try {
    // ── Step 1: Read request body ─────────────────────────────────────────
    const {
      testId,
      sectionType,
      answers = [],
      timeTaken = 0,
    } = req.body;

    // userId is injected by the route (either req.user._id or "guest")
    const userId = req.userId ?? "guest";

    if (!testId || !sectionType) {
      return res
        .status(400)
        .json({ message: "testId and sectionType are required." });
    }

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }

    const VALID_SECTION_TYPES = ["verbal", "nonVerbal", "academic", "standalone"];
    if (!VALID_SECTION_TYPES.includes(sectionType)) {
      return res.status(400).json({
        message: `sectionType must be one of: ${VALID_SECTION_TYPES.join(", ")}.`,
      });
    }

    // ── Step 2: Find the Test ─────────────────────────────────────────────
    // NOTE: deliberately NOT using .populate("category") here. If the
    // Category document behind test.category was ever deleted (a dangling
    // ref — seen on some older standalone/custom-category tests), populate()
    // silently resolves the field to null AND discards the original
    // ObjectId, so there'd be no way to recover it afterward. Instead we
    // keep the raw ObjectId on `test.category` and look the Category up
    // manually below, with a safe fallback if it's missing.
    const test = await Test.findById(testId).lean();

    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    let categorySlug = "";
    if (test.category) {
      const categoryDoc = await Category.findById(test.category)
        .select("slug")
        .lean();
      categorySlug = categoryDoc?.slug ?? "";
    }

    // TestResult requires a non-empty categorySlug. Fall back to the test's
    // own groupSlug (set for custom-category tests) or a generic default
    // rather than letting a stale/deleted category reference 500 the whole
    // submission — this is what previously surfaced as:
    // "TestResult validation failed: categorySlug: Path `categorySlug` is
    // required."
    if (!categorySlug) {
      categorySlug = test.groupSlug || "uncategorized";
    }

    // ── Step 3: Find the section inside the test ──────────────────────────
    // Standalone custom-category tests used to embed their MCQs directly on
    // the Test document (test.mcqs). As of the MCQ storage refactor, those
    // MCQs live in their own collection — query it here instead, sorted by
    // `order` so scoring sees MCQs in the same order they were saved/shown.
    // This skips the Section lookup entirely, same as before.
    let mcqs;
    let totalMcqs;
    let marksConfig;

    if (test.isStandalone === true) {
      mcqs = await Mcq.find({ testId: test._id, testModel: "Test" })
        .sort({ order: 1 })
        .lean();
      totalMcqs = mcqs.length;
      // Standalone tests carry their own totalMarks/negativeMarking.
      marksConfig = getMarksConfig(test);
    } else {
      // For "standalone" sectionType on a non-flagged test we look for
      // whichever single slot is complete (legacy fallback).
      let sectionRefId = null;

      if (sectionType === "standalone") {
        // Find the first complete slot
        for (const key of ["verbal", "nonVerbal", "academic"]) {
          const slot = test.sections?.[key];
          if (slot?.status === "complete" && slot?.sectionRef) {
            sectionRefId = slot.sectionRef;
            break;
          }
        }
      } else {
        const slot = test.sections?.[sectionType];
        if (slot?.status === "complete" && slot?.sectionRef) {
          sectionRefId = slot.sectionRef;
        }
      }

      if (!sectionRefId) {
        return res.status(404).json({ message: "Section not found or not yet published." });
      }

      const section = await Section.findById(sectionRefId)
        .select("mcqs totalMarks negativeMarking")
        .lean();
      if (!section) {
        return res.status(404).json({ message: "Section data not found." });
      }

      mcqs = section.mcqs ?? [];
      totalMcqs = mcqs.length;
      marksConfig = getMarksConfig(section);
    }

    // ── Step 4: Determine pass mark ───────────────────────────────────────
    const passMarkUsed = determinePassMark(test, sectionType);

    // ── Step 5: Score the answers ─────────────────────────────────────────
    // Build a lookup map: mcqId (string) → selectedOption (number | null)
    const answerMap = new Map();
    const answerDocs = [];

    for (const a of answers) {
      if (!a.mcqId) continue;
      const mcqIdStr = a.mcqId.toString();
      const selected  = typeof a.selectedOption === "number" ? a.selectedOption : null;
      answerMap.set(mcqIdStr, selected);
    }

    let score = 0;
    let wrongCount = 0;

    for (const mcq of mcqs) {
      const mcqIdStr = mcq._id.toString();
      const selected  = answerMap.has(mcqIdStr) ? answerMap.get(mcqIdStr) : null;

      // Standalone (custom-category) MCQs store the answer key as
      // `correctOption`; default Section-based MCQs use `correctIndex`.
      const correctAnswer = test.isStandalone === true ? mcq.correctOption : mcq.correctIndex;

      if (typeof selected === "number" && selected === correctAnswer) {
        score += 1;
      } else if (typeof selected === "number") {
        // Attempted but wrong — only these count toward negative marking.
        wrongCount += 1;
      }

      // Always record the answer (null for unanswered)
      answerDocs.push({
        mcqId:          mcq._id,
        selectedOption: selected,
      });
    }

    // ── Step 6: Calculate marks-based score & percentage ───────────────────
    const { totalMarks, obtainedMarks, percentage, negativeMarkingApplied } =
      computeMarks({ correctCount: score, wrongCount, totalMcqs, config: marksConfig });

    // ── Step 7: Determine passed ──────────────────────────────────────────
    const passed = percentage >= passMarkUsed;

    // ── Step 8: Save result ───────────────────────────────────────────────
    const result = await TestResult.create({
      userId,
      testId:      test._id,
      categorySlug,
      sectionType,
      answers:     answerDocs,
      score,
      totalMcqs,
      totalMarks,
      obtainedMarks,
      negativeMarkingApplied,
      percentage,
      passed,
      passMarkUsed,
      timeTaken:   Number(timeTaken) || 0,
      submittedAt: new Date(),
    });

    // ── Step 9: Return response ───────────────────────────────────────────
    return res.status(201).json({
      score,
      totalMcqs,
      totalMarks,
      obtainedMarks,
      negativeMarkingApplied,
      percentage,
      passed,
      passMarkUsed,
      resultId: result._id,
    });

  } catch (err) {
    console.error("[scoringController] submitSection →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ── getResult ─────────────────────────────────────────────────────────────────
/**
 * GET /api/results/:testId/:sectionType
 *
 * Returns the most recent result for the given test + section.
 * If the user is authenticated (req.user set by optional middleware), returns
 * only their result.  For guests returns the most recent guest result for
 * that test (good enough for free tests where there's no auth).
 */
export async function getResult(req, res) {
  try {
    const { testId, sectionType } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Result not found." });
    }

    // userId from the route injection (set if cookie present), else "guest"
    const userId = req.userId ?? req.user?._id ?? "guest";

    const result = await TestResult.findOne(
      { testId, sectionType, userId },
      { answers: 0 } // exclude large answers array from this summary fetch
    )
      .sort({ submittedAt: -1 })
      .lean();

    if (!result) {
      return res.status(404).json({ message: "No result found for this section." });
    }

    return res.json(result);
  } catch (err) {
    console.error("[scoringController] getResult →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ── resetResults ───────────────────────────────────────────────────────────
/**
 * DELETE /api/results/reset/:testId
 *
 * Removes all stored results for the current user and test so the user can
 * retake the test from a clean slate.
 */
export async function resetResults(req, res) {
  try {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }

    const userId = req.userId ?? req.user?._id ?? "guest";
    const result = await TestResult.deleteMany({ testId, userId });

    return res.json({
      success: true,
      deletedCount: result.deletedCount ?? 0,
    });
  } catch (err) {
    console.error("[scoringController] resetResults →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}

// ── getOverallResult ──────────────────────────────────────────────────────────
/**
 * GET /api/results/overall/:testId   (Prompt 5)
 *
 * Returns all section results for the calling user (or "guest") and applies
 * the strict overall pass rule: EVERY section must have passed === true.
 *
 * Response:
 * {
 *   sections: [
 *     { sectionType, sectionName, score, totalMcqs, percentage, passed, passMarkUsed }
 *   ],
 *   overallPassed:  boolean,
 *   totalSections:  number,
 *   passedSections: number,
 * }
 *
 * A 404 is returned when no results exist for this test+user combination.
 */
export async function getOverallResult(req, res) {
  try {
    const { testId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }

    const userId = req.userId ?? req.user?._id ?? "guest";

    // Check if this is a standalone (custom category) test.
    const testDoc = await Test.findById(testId).select("isStandalone").lean();
    const isStandalone = testDoc?.isStandalone === true;

    // Fetch the most recent result per section type for this user + test.
    // We use an aggregation pipeline so we get exactly one document per
    // sectionType (the latest), avoiding duplicates from retakes.
    const pipeline = [
      { $match: { testId: new mongoose.Types.ObjectId(testId), userId } },
      { $sort:  { submittedAt: -1 } },
      {
        $group: {
          _id:          "$sectionType",
          sectionType:  { $first: "$sectionType" },
          score:        { $first: "$score" },
          totalMcqs:    { $first: "$totalMcqs" },
          percentage:   { $first: "$percentage" },
          passed:       { $first: "$passed" },
          passMarkUsed: { $first: "$passMarkUsed" },
          submittedAt:  { $first: "$submittedAt" },
        },
      },
      { $sort: { sectionType: 1 } }, // stable order: academic, nonVerbal, verbal
    ];

    const rawSections = await TestResult.aggregate(pipeline);

    if (!rawSections || rawSections.length === 0) {
      return res.status(404).json({ message: "No results found for this test." });
    }

    // Map sectionType → human-readable name
    const SECTION_NAMES = {
      verbal:    "Verbal Reasoning",
      nonVerbal: "Non-Verbal Reasoning",
      academic:  "Academic",
      standalone: "Test",
    };

    const sections = rawSections.map((r) => ({
      sectionType:  r.sectionType,
      sectionName:  SECTION_NAMES[r.sectionType] ?? r.sectionType,
      score:        r.score,
      totalMcqs:    r.totalMcqs,
      percentage:   r.percentage,
      passed:       r.passed,
      passMarkUsed: r.passMarkUsed,
    }));

    // ── Overall pass rule ─────────────────────────────────────────────────
    // For standalone tests: overall result = the single section result.
    // For default 3-section tests: ALL sections must have passed === true.
    const overallPassed = isStandalone
      ? sections[0]?.passed === true
      : sections.every((s) => s.passed === true);
    const passedSections = sections.filter((s) => s.passed).length;

    return res.json({
      sections,
      overallPassed,
      totalSections:  sections.length,
      passedSections,
    });

  } catch (err) {
    console.error("[scoringController] getOverallResult →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
}