/**
 * routes/publicTestSection.js  (Prompt 80 hardened)
 *
 * Changes vs Prompt 08:
 *   - Uses shared getPublishedFreeTest() helper.
 *   - Zero-MCQ guard: if a section's MCQ array is empty, returns 404
 *     { message: 'This section has no questions yet.' } instead of
 *     an empty array that would break the test screen.
 *
 * GET /api/free-tests/:testId/section/:sectionKey/mcqs
 */

import { Router }      from "express";
import FreeMockSection from "../models/FreeMockSection.js";
import { SECTION_KEYS, SECTION_DISPLAY_NAMES as SECTION_NAMES } from "../config/freeTestSections.js";
import { getPublishedFreeTest } from "../utils/getPublishedFreeTest.js";
import { seededShuffle } from "../utils/seededShuffle.js";

const router = Router();

router.get("/:testId/section/:sectionKey/mcqs", async (req, res) => {
  try {
    const { testId, sectionKey } = req.params;

    // Validate section key
    if (!SECTION_KEYS.includes(sectionKey)) {
      return res.status(404).json({ message: "Section not found." });
    }

    // Shared published guard
    const { test, error, status } = await getPublishedFreeTest(testId);
    if (error) return res.status(status).json({ message: error });

    // Resolve section ref
    const sectionMeta = test.sections?.[sectionKey];
    if (!sectionMeta || sectionMeta.status !== "complete" || !sectionMeta.sectionRef) {
      return res.status(404).json({ message: "Section not available." });
    }

    // Load the FreeMockSection
    const section = await FreeMockSection.findById(sectionMeta.sectionRef)
      .select("type timeLimit totalMCQs mcqs")
      .lean();

    if (!section) {
      return res.status(404).json({ message: "Section not found." });
    }

    // Zero-MCQ guard if no questions exist, return a clear 404 rather than
    // an empty array that would render a broken test screen on the frontend.
    if (!section.mcqs || section.mcqs.length === 0) {
      return res.status(404).json({ message: "This section has no questions yet." });
    }

    // Deterministic, per-test order (stable across reloads) — and cap to
    // totalMCQs so a shared pool never ships more questions than this
    // test is actually configured to show.
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
    console.error("[publicTestSection] GET mcqs →", err.message);
    return res.status(500).json({ message: "Server error. Please try again." });
  }
});

export default router;