/**
 * routes/premiumTestSection.js
 *
 * Premium test engine routes mirrors the free-test engine but
 * uses the Section model (not FreeMockSection) and requires a
 * logged-in premium user via userProtect middleware.
 *
 * Routes (all mounted under /api/tests by server/index.js):
 *   GET  /api/tests/:testId/section/:sectionKey/mcqs
 *   POST /api/tests/:testId/section/:sectionKey/submit
 *   GET  /api/tests/:testId/section/:sectionKey/review
 */

import { Router }  from "express";
import mongoose    from "mongoose";
import Test        from "../models/Test.js";
import Section     from "../models/Section.js";
import Category    from "../models/Category.js";
import { userProtect } from "../middleware/userAuth.js";
import { seededShuffle } from "../utils/seededShuffle.js";

const router = Router();

const SECTION_KEYS = ["verbal", "nonVerbal", "academic"];
const SECTION_NAMES = { verbal: "Verbal", nonVerbal: "Non-Verbal", academic: "Academic" };

// ── Shared guard: load a published Test and validate the sectionKey ──
async function getPublishedTest(testId, sectionKey, res) {
  if (!mongoose.Types.ObjectId.isValid(testId)) {
    res.status(404).json({ message: "Test not found." });
    return null;
  }
  if (!SECTION_KEYS.includes(sectionKey)) {
    res.status(404).json({ message: "Section not found." });
    return null;
  }
  const test = await Test.findById(testId).populate("category", "slug").lean();
  if (!test || !test.isPublished) {
    res.status(404).json({ message: "Test not found." });
    return null;
  }
  return test;
}

// ── Access guard: verifies the logged-in user has category access ──
// Returns false and writes the response if the user fails; returns true to proceed.
async function checkUserAccess(req, res, test) {
  const user = req.user;
  const categorySlug = test.category?.slug;

  // Expired check
  if (user.isExpired()) {
    res.status(403).json({
      message: "Your access has expired. Please contact the admin to renew your subscription.",
    });
    return false;
  }

  // Category access check
  if (categorySlug && !user.hasAccessTo(categorySlug)) {
    res.status(403).json({
      message: `You do not have access to this category.`,
    });
    return false;
  }

  return true;
}

// ──────────────────────────────────────────────────────────────
// GET /api/tests/:testId/section/:sectionKey/mcqs
// Returns shuffled MCQs (no correctIndex/explanation) for the test session.
// ──────────────────────────────────────────────────────────────
router.get("/:testId/section/:sectionKey/mcqs", userProtect, async (req, res) => {
  try {
    const { testId, sectionKey } = req.params;

    const test = await getPublishedTest(testId, sectionKey, res);
    if (!test) return;

    // Server-side access gate: 401 handled by userProtect; 403 for expired/no-access
    const allowed = await checkUserAccess(req, res, test);
    if (!allowed) return;

    const slot   = test.sections?.[sectionKey];
    const status = slot?.status ?? "pending";

    if (status !== "complete" || !slot?.sectionRef) {
      return res.status(404).json({ message: "Section not available." });
    }

    const section = await Section.findById(slot.sectionRef)
      .select("type timeLimit totalMCQs mcqs")
      .lean();

    if (!section) {
      return res.status(404).json({ message: "Section not found." });
    }

    if (!section.mcqs || section.mcqs.length === 0) {
      return res.status(404).json({ message: "This section has no questions yet." });
    }

    // Deterministic, per-test order (stable across reloads) — and cap to
    // totalMCQs so a shared pool (Army/Navy/Air Force) never ships more
    // questions than this test is actually configured to show.
    const ordered = seededShuffle(section.mcqs, `${testId}:${sectionKey}`);
    const limit   = section.totalMCQs > 0 ? section.totalMCQs : ordered.length;

    const safeMcqs = ordered.slice(0, limit).map((mcq) => ({
      _id:      mcq._id,
      question: mcq.question,
      options:  mcq.options,
      imageUrl: mcq.imageUrl || "",
      // correctIndex and explanation intentionally omitted
    }));

    res.set("Cache-Control", "no-store");

    return res.json({
      sectionKey,
      sectionName:      SECTION_NAMES[sectionKey],
      timeLimitSeconds: section.timeLimit ?? 0,
      mcqs:             safeMcqs,
    });
  } catch (err) {
    console.error("[premiumTestSection] GET mcqs →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ──────────────────────────────────────────────────────────────
// POST /api/tests/:testId/section/:sectionKey/submit
// Grades the submitted answers and returns the result.
// ──────────────────────────────────────────────────────────────
router.post("/:testId/section/:sectionKey/submit", userProtect, async (req, res) => {
  try {
    const { testId, sectionKey } = req.params;
    const { answers } = req.body || {};

    if (
      answers === undefined ||
      answers === null ||
      typeof answers !== "object" ||
      Array.isArray(answers)
    ) {
      return res.status(400).json({ message: "Answers are required." });
    }

    const test = await getPublishedTest(testId, sectionKey, res);
    if (!test) return;

    // Server-side access gate
    const allowed = await checkUserAccess(req, res, test);
    if (!allowed) return;

    const slot = test.sections?.[sectionKey];
    if (!slot || slot.status !== "complete" || !slot.sectionRef) {
      return res.status(404).json({ message: "Section not available." });
    }

    // Load WITH correctIndex for grading
    const section = await Section.findById(slot.sectionRef)
      .select("mcqs")
      .lean();

    if (!section) {
      return res.status(404).json({ message: "Section not found." });
    }

    const mcqs  = section.mcqs ?? [];
    const total = mcqs.length;

    let score = 0;
    for (const mcq of mcqs) {
      const submitted = answers[mcq._id.toString()];
      if (typeof submitted === "number" && submitted === mcq.correctIndex) {
        score += 1;
      }
    }

    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed      = percentage >= 50;

    res.set("Cache-Control", "no-store");

    return res.json({ score, total, percentage, passed });
  } catch (err) {
    console.error("[premiumTestSection] POST submit →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

// ──────────────────────────────────────────────────────────────
// GET /api/tests/:testId/section/:sectionKey/review
// Returns MCQs WITH correctIndex for post-test review.
// ──────────────────────────────────────────────────────────────
router.get("/:testId/section/:sectionKey/review", userProtect, async (req, res) => {
  try {
    const { testId, sectionKey } = req.params;

    const test = await getPublishedTest(testId, sectionKey, res);
    if (!test) return;

    // Server-side access gate
    const allowed = await checkUserAccess(req, res, test);
    if (!allowed) return;

    const slot = test.sections?.[sectionKey];
    if (!slot || slot.status !== "complete" || !slot.sectionRef) {
      return res.status(404).json({ message: "Section not available." });
    }

    const section = await Section.findById(slot.sectionRef)
      .select("type totalMCQs mcqs")
      .lean();

    if (!section) {
      return res.status(404).json({ message: "Section not found." });
    }

    // Same deterministic order AND same cap used by the mcqs route above
    // (`${testId}:${sectionKey}` seed, sliced to totalMCQs) — review must
    // reproduce the EXACT sequence the user actually saw while taking the
    // test, otherwise "Question 1" here can be a completely different MCQ
    // than "Question 1" was during the attempt, which makes every stored
    // answer look mismatched even when it's actually correct.
    const ordered = seededShuffle(section.mcqs ?? [], `${testId}:${sectionKey}`);
    const limit   = section.totalMCQs > 0 ? section.totalMCQs : ordered.length;

    const mcqs = ordered.slice(0, limit).map((mcq) => ({
      _id:          mcq._id,
      question:     mcq.question,
      options:      mcq.options,
      imageUrl:     mcq.imageUrl || "",
      correctIndex: mcq.correctIndex,
    }));

    res.set("Cache-Control", "no-store");

    return res.json({
      sectionKey,
      sectionName: SECTION_NAMES[sectionKey],
      mcqs,
    });
  } catch (err) {
    console.error("[premiumTestSection] GET review →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

export default router;