/**
 * routes/testGroupRoutes.js  (updated — premium gate + free custom tests)
 *
 * CHANGES:
 *  1. Public listing routes (getTestsByCategory, getTestsByGroup) now use
 *     optionalUserAuth middleware — they still respond publicly but include
 *     an `accessGranted` flag per test so the UI can show a lock icon.
 *
 *  2. MCQ-serving and hub routes for PREMIUM custom tests now require
 *     userProtect + group-level access check.
 *
 *  3. New FREE CUSTOM TEST routes — custom categories can also have free
 *     tests (no login required) using the same group→test structure.
 *     These are stored in a new FreeCustomTest model and served publicly.
 *
 * Admin routes:
 *   POST   /api/test-groups                            → createGroup
 *   DELETE /api/test-groups/:groupId                   → deleteGroup
 *   POST   /api/test-groups/:groupId/tests             → createCustomTest (premium)
 *   GET    /api/custom-tests/test/:testId              → getTestById (admin)
 *   PATCH  /api/custom-tests/:testId/settings          → saveTestSettings
 *   POST   /api/custom-tests/:testId/mcqs              → addMcqs — DEPRECATED, 410 Gone
 *   POST   /api/custom-tests/:testId/mcqs/batch        → addMcqsBatch (bulk-add into Mcq collection)
 *   PATCH  /api/custom-tests/:testId/mcqs/:mcqId       → updateMcq (edit one MCQ)
 *   DELETE /api/custom-tests/:testId/mcqs/:mcqId       → deleteMcq (delete one MCQ)
 *   GET    /api/custom-tests/:testId/mcqs/list         → getMcqsPaginated (admin, paginated)
 *   POST   /api/custom-tests/:testId/publish           → publishTest
 *
 *   POST   /api/test-groups/:groupId/free-tests        → createFreeCustomTest (admin)
 *   GET    /api/free-custom-tests/test/:testId         → getFreeCustomTestById (admin)
 *   PATCH  /api/free-custom-tests/:testId/settings     → saveFreeCustomTestSettings
 *   POST   /api/free-custom-tests/:testId/mcqs         → DEPRECATED, 410 Gone
 *   POST   /api/free-custom-tests/:testId/publish      → publishFreeCustomTest
 *   POST   /api/free-mock-tests/custom/:testId/mcqs           → DEPRECATED, 410 Gone
 *   POST   /api/free-mock-tests/custom/:testId/mcqs/batch     → bulk-add into Mcq collection
 *   PATCH  /api/free-mock-tests/custom/:testId/mcqs/:mcqId    → edit one MCQ
 *   DELETE /api/free-mock-tests/custom/:testId/mcqs/:mcqId    → delete one MCQ
 *   GET    /api/free-mock-tests/custom/:testId/mcqs/list      → paginated admin list
 *
 * Public routes (premium tests — gated):
 *   GET    /api/test-groups/:categorySlug              → getGroupsByCategory
 *   GET    /api/custom-tests/:categorySlug             → getTestsByCategory (with auth flags)
 *   GET    /api/custom-tests/hub/:testId               → getCustomTestHub  (userProtect)
 *   GET    /api/custom-tests/:testId/mcqs              → serve MCQs         (userProtect)
 *   GET    /api/custom-tests/:testId/review            → review MCQs        (userProtect)
 *   POST   /api/custom-tests/:testId/submit            → grade answers      (userProtect)
 *
 * Public routes (free custom tests — no auth):
 *   GET    /api/free-custom-tests/:categorySlug        → getFreeTestsByCategory
 *   GET    /api/free-custom-tests/hub/:testId          → getFreeCustomTestHub
 *   GET    /api/free-custom-tests/:testId/mcqs         → serve free MCQs
 *   POST   /api/free-custom-tests/:testId/submit       → grade free answers
 *   GET    /api/free-custom-tests/:testId/review       → review free MCQs
 */

import { Router } from "express";
import mongoose from "mongoose";
import { protect as adminAuth } from "../middleware/adminAuth.js";
import { userProtect, optionalUserAuth } from "../middleware/userAuth.js";
import {
  createGroup,
  getGroupsByCategory,
  deleteGroup,
} from "../controllers/testGroupController.js";
import {
  createCustomTest,
  getTestsByGroup,
  getTestsByCategory,
  getAllTestsByCategory,
  getTestById,
  saveTestSettings,
  addMcqs,
  addMcqsBatch,
  updateMcq,
  deleteMcq,
  getMcqsPaginated,
  publishTest,
} from "../controllers/customTestController.js";
import Test from "../models/Test.js";
import TestGroup from "../models/TestGroup.js";
import FreeCustomTest from "../models/FreeCustomTest.js";
import Mcq from "../models/Mcq.js";
import { sanitiseSubjectBreakdown } from "../utils/subjectBreakdown.js";
import { seededShuffle } from "../utils/seededShuffle.js";
import { createWithNextTestNumber } from "../utils/nextTestNumber.js";

// ── STAGE 2 NOTE (MCQ storage refactor) ────────────────────────
// FreeCustomTest MCQs now live in the same Mcq collection as premium Test
// MCQs (see models/Mcq.js), linked via testId + testModel: "FreeCustomTest".
// The old `mcqs` embedded array no longer exists on the FreeCustomTest
// schema (removed in Stage 1). Every route below that used to read
// test.mcqs or compute a count from test.mcqs.length has been updated to
// use test.mcqCount or to query the Mcq collection directly.

const router = Router();

// NOTE: the old local shuffle() (Math.random()-based Fisher-Yates) was
// removed from here. It re-rolled a brand new random order on every
// single request, so the /mcqs route (take-test) and /review route always
// produced different orders even for the same test session — Review
// Question 1 could be a totally different MCQ than Test Question 1, with
// the user's stored answer silently misapplied to whatever landed in that
// position. seededShuffle(arr, testId) below is deterministic: the same
// testId always produces the same order, on every load, including review.

// ─────────────────────────────────────────────────────────────
//  ADMIN ROUTES — PREMIUM CUSTOM TESTS
// ─────────────────────────────────────────────────────────────

router.post("/test-groups", adminAuth, createGroup);
router.delete("/test-groups/:groupId", adminAuth, deleteGroup);

/**
 * PATCH /api/test-groups/:groupId/blog
 * Admin only. Saves blogContent for a specific group.
 * Body: { blogContent: string }
 */
router.patch("/test-groups/:groupId/blog", adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { blogContent } = req.body ?? {};

    const group = await TestGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }

    group.blogContent = typeof blogContent === "string" ? blogContent : "";
    await group.save();

    return res.json({ saved: true, groupId: group._id, blogContent: group.blogContent });
  } catch (err) {
    console.error("[saveGroupBlog] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

router.post("/test-groups/:groupId/tests", adminAuth, createCustomTest);
router.get("/custom-tests/test/:testId", adminAuth, getTestById);
router.patch("/custom-tests/:testId/settings", adminAuth, saveTestSettings);
router.post("/custom-tests/:testId/mcqs", adminAuth, addMcqs); // DEPRECATED: returns 410 Gone (see customTestController.addMcqs)
router.post("/custom-tests/:testId/mcqs/batch", adminAuth, addMcqsBatch); // bulk-add new MCQs into the Mcq collection
router.patch("/custom-tests/:testId/mcqs/:mcqId", adminAuth, updateMcq); // edit exactly one MCQ
router.delete("/custom-tests/:testId/mcqs/:mcqId", adminAuth, deleteMcq); // delete exactly one MCQ
router.get("/custom-tests/:testId/mcqs/list", adminAuth, getMcqsPaginated); // paginated admin list (?page=&limit=)
router.post("/custom-tests/:testId/publish", adminAuth, publishTest);

/**
 * GET /api/admin/custom-tests/summary/:categorySlug
 * Admin only. Returns all groups + ALL tests (every status) for the
 * dashboard summary panel. Unlike the public route which only shows
 * published tests, this includes settings_pending / mcqs_pending /
 * in_progress so the admin can see Continue links for unfinished tests.
 */
router.get("/admin/custom-tests/summary/:categorySlug", adminAuth, async (req, res) => {
  try {
    const { categorySlug } = req.params;

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) return res.json({ groups: [] });

    const groupIds = groups.map((g) => g._id);

    const allTests = await Test.find({ groupId: { $in: groupIds }, isStandalone: true })
      .sort({ testNumber: 1 })
      .select("_id testNumber status groupId timeLimitSeconds totalMcqs mcqCount")
      .lean();

    const testsByGroup = {};
    for (const test of allTests) {
      const key = test.groupId.toString();
      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        _id: test._id,
        testNumber: test.testNumber,
        status: test.status,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
        mcqCount: test.mcqCount || 0,
      });
    }

    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      slug: g.slug,
      tests: testsByGroup[g._id.toString()] || [],
    }));

    return res.json({ groups: result });
  } catch (err) {
    console.error("[adminCustomTestsSummary] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

/**
 * ─────────────────────────────────────────────────────────────
 *  PROMPT 13 — Free Mock Test endpoints for CUSTOM categories
 * ─────────────────────────────────────────────────────────────
 * These are deliberately separate paths (/api/free-mock-tests/custom/...)
 * from the default-category Free Mock Test endpoints (which live under
 * /api/admin/free-mock-tests/... in adminFreeMockTests.js and use the
 * 3-section verbal/nonVerbal/academic FreeMockTest model).
 *
 * Custom categories never use the 3-section flow — a free mock test for a
 * custom category is a single-section test, identical in shape to a
 * premium custom test, just flagged isFree: true. Storage-wise these reuse
 * the existing FreeCustomTest model (group → test, mcqs[], passMarkPercentage),
 * which already only supports the single-section shape.
 */

// ── POST /api/free-mock-tests/custom/create ───────────────────
// Admin only. Body: { groupId }. Creates a free mock test inside the group,
// auto-numbered via TestGroup.freeTestCount (same counter used by the
// existing /test-groups/:groupId/free-tests route).
router.post("/free-mock-tests/custom/create", adminAuth, async (req, res) => {
  try {
    const { groupId } = req.body ?? {};
    if (!groupId) {
      return res.status(400).json({ message: "groupId is required." });
    }

    const group = await TestGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }
    if (!group.categoryId) {
      return res.status(400).json({ message: "Test group is missing a categoryId." });
    }

    // testNumber computed fresh from live data — see utils/nextTestNumber.js.
    // Self-healing: deleting a failed/incomplete free test frees its
    // number for reuse instead of leaving a permanent gap.
    const test = await createWithNextTestNumber(FreeCustomTest, groupId, (testNumber) => ({
      category: group.categoryId,
      groupId: group._id,
      groupSlug: group.slug,
      categorySlug: group.categorySlug,
      testNumber,
      isFree: true,
      isStandalone: true,
      passMarkPercentage: 80,
      timeLimitSeconds: null,
      totalMcqs: null,
      status: "settings_pending", // admin must save timer + MCQ count before adding MCQs
    }));

    return res.status(201).json({ ...test.toObject(), groupName: group.name });
  } catch (err) {
    console.error("[createCustomFreeMockTest] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── PATCH /api/free-mock-tests/custom/:testId/settings ────────
// Admin only. Saves timeLimitSeconds and totalMcqs   identical to the
// premium custom-test settings save.
router.patch("/free-mock-tests/custom/:testId/settings", adminAuth, async (req, res) => {
  try {
    const { timeLimitSeconds, totalMcqs, subjectBreakdown } = req.body ?? {};
    if (!timeLimitSeconds || !totalMcqs) {
      return res.status(400).json({ message: "timeLimitSeconds and totalMcqs are required." });
    }
    if (Number(totalMcqs) < 1) {
      return res.status(400).json({ message: "totalMcqs must be at least 1." });
    }

    const test = await FreeCustomTest.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found." });

    test.timeLimitSeconds = Number(timeLimitSeconds);
    test.totalMcqs = Number(totalMcqs);
    test.subjectBreakdown = sanitiseSubjectBreakdown(subjectBreakdown);
    test.status = "mcqs_pending"; // unlock MCQ adding
    await test.save();

    return res.json({
      saved: true,
      timeLimitSeconds: test.timeLimitSeconds,
      totalMcqs: test.totalMcqs,
      subjectBreakdown: test.subjectBreakdown,
      status: test.status,
    });
  } catch (err) {
    console.error("[saveCustomFreeMockTestSettings] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── POST /api/free-mock-tests/custom/:testId/mcqs ──────────────
// DEPRECATED (Stage 2). Used to replace the ENTIRE test.mcqs array on
// every call — that embedded array no longer exists (removed in Stage 1).
// Returns 410 Gone so any client still on the old path fails loudly.
// Use POST /:testId/mcqs/batch instead.
router.post("/free-mock-tests/custom/:testId/mcqs", adminAuth, async (req, res) => {
  return res.status(410).json({
    message:
      "This endpoint has been removed. MCQs are no longer stored as a full array on the test document — use POST /api/free-mock-tests/custom/:testId/mcqs/batch to add new MCQs instead.",
  });
});

// ── POST /api/free-mock-tests/custom/:testId/mcqs/batch ────────
// Admin only. Bulk-adds NEW MCQs only into the Mcq collection via
// insertMany, continuing `order` from the test's current mcqCount.
// mcqCount is incremented atomically with $inc via findByIdAndUpdate
// (never read-modify-save), so two overlapping batch saves for the same
// test can never be handed the same order range.
router.post("/free-mock-tests/custom/:testId/mcqs/batch", adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const { mcqs } = req.body ?? {};

    if (!Array.isArray(mcqs) || mcqs.length === 0) {
      return res.status(400).json({ message: "mcqs must be a non-empty array." });
    }

    const test = await FreeCustomTest.findById(testId);
    if (!test) return res.status(404).json({ message: "Test not found." });

    if (test.status === "published") {
      return res.status(400).json({ message: "Cannot modify MCQs on a published test." });
    }

    for (let i = 0; i < mcqs.length; i++) {
      const mcq = mcqs[i];
      const num = i + 1;
      if (!mcq.question || !mcq.question.trim()) {
        return res.status(400).json({ message: `MCQ #${num}: question is required.` });
      }
      if (!Array.isArray(mcq.options) || mcq.options.length !== 4) {
        return res.status(400).json({ message: `MCQ #${num}: exactly 4 options are required.` });
      }
      for (let j = 0; j < 4; j++) {
        if (!mcq.options[j] || !mcq.options[j].trim()) {
          return res.status(400).json({ message: `MCQ #${num}: option ${j + 1} is empty.` });
        }
      }
      if (
        typeof mcq.correctOption !== "number" ||
        mcq.correctOption < 0 ||
        mcq.correctOption > 3
      ) {
        return res.status(400).json({ message: `MCQ #${num}: correctOption must be 0–3.` });
      }
    }

    const previous = await FreeCustomTest.findByIdAndUpdate(
      testId,
      { $inc: { mcqCount: mcqs.length } },
      { new: false }
    );
    if (!previous) return res.status(404).json({ message: "Test not found." });
    const startOrder = previous.mcqCount || 0;

    const docs = mcqs.map((mcq, i) => ({
      testId,
      testModel: "FreeCustomTest",
      question: mcq.question.trim(),
      options: mcq.options.map((o) => o.trim()),
      correctOption: mcq.correctOption,
      order: startOrder + i,
    }));

    try {
      await Mcq.insertMany(docs, { ordered: true });
    } catch (insertErr) {
      await FreeCustomTest.findByIdAndUpdate(testId, { $inc: { mcqCount: -mcqs.length } });
      throw insertErr;
    }

    return res.json({
      saved: true,
      insertedCount: docs.length,
      totalSaved: startOrder + docs.length,
    });
  } catch (err) {
    console.error("[addCustomFreeMockMcqsBatch] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── PATCH /api/free-mock-tests/custom/:testId/mcqs/:mcqId ──────
// Admin only. Updates question/options/correctOption on exactly ONE
// Mcq document belonging to this free custom test.
router.patch("/free-mock-tests/custom/:testId/mcqs/:mcqId", adminAuth, async (req, res) => {
  try {
    const { testId, mcqId } = req.params;
    const { question, options, correctOption } = req.body ?? {};

    if (!question || !question.trim()) {
      return res.status(400).json({ message: "question is required." });
    }
    if (!Array.isArray(options) || options.length !== 4) {
      return res.status(400).json({ message: "exactly 4 options are required." });
    }
    for (let j = 0; j < 4; j++) {
      if (!options[j] || !options[j].trim()) {
        return res.status(400).json({ message: `option ${j + 1} is empty.` });
      }
    }
    if (typeof correctOption !== "number" || correctOption < 0 || correctOption > 3) {
      return res.status(400).json({ message: "correctOption must be 0–3." });
    }

    const updated = await Mcq.findOneAndUpdate(
      { _id: mcqId, testId, testModel: "FreeCustomTest" },
      {
        $set: {
          question: question.trim(),
          options: options.map((o) => o.trim()),
          correctOption,
        },
      },
      { new: true }
    );

    if (!updated) {
      return res.status(404).json({ message: "MCQ not found for this test." });
    }

    return res.json({ saved: true, mcq: updated });
  } catch (err) {
    console.error("[updateCustomFreeMockMcq] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── DELETE /api/free-mock-tests/custom/:testId/mcqs/:mcqId ─────
// Admin only. Removes exactly ONE Mcq document and decrements the
// parent test's mcqCount by 1 (atomic $inc, not a read-modify-save).
router.delete("/free-mock-tests/custom/:testId/mcqs/:mcqId", adminAuth, async (req, res) => {
  try {
    const { testId, mcqId } = req.params;

    const deleted = await Mcq.findOneAndDelete({ _id: mcqId, testId, testModel: "FreeCustomTest" });
    if (!deleted) {
      return res.status(404).json({ message: "MCQ not found for this test." });
    }

    await FreeCustomTest.findByIdAndUpdate(testId, { $inc: { mcqCount: -1 } });

    return res.json({ deleted: true, mcqId });
  } catch (err) {
    console.error("[deleteCustomFreeMockMcq] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── GET /api/free-mock-tests/custom/:testId/mcqs/list ───────────
// Admin only. Paginated list of MCQs for the admin editor, sorted by
// `order`. Query params: ?page=1&limit=20 (defaults). Pass a larger
// limit (e.g. ?limit=100000) to load everything for a test in one call.
router.get("/free-mock-tests/custom/:testId/mcqs/list", adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { testId, testModel: "FreeCustomTest" };

    const [mcqs, total] = await Promise.all([
      Mcq.find(filter).sort({ order: 1 }).skip(skip).limit(limit).lean(),
      Mcq.countDocuments(filter),
    ]);

    return res.json({
      mcqs,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit) || 1,
    });
  } catch (err) {
    console.error("[getCustomFreeMockMcqsPaginated] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── POST /api/free-mock-tests/custom/:testId/publish ───────────
// Admin only. Publishes the free mock test once every required MCQ is saved.
router.post("/free-mock-tests/custom/:testId/publish", adminAuth, async (req, res) => {
  try {
    const test = await FreeCustomTest.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found." });

    const targetCount = test.totalMcqs;
    if (!targetCount) {
      return res.status(400).json({ message: "Save test settings before publishing." });
    }

    const actualCount = await Mcq.countDocuments({ testId: test._id, testModel: "FreeCustomTest" });

    if (actualCount !== test.mcqCount) {
      return res.status(409).json({
        message: `MCQ count is out of sync (recorded ${test.mcqCount}, found ${actualCount} saved MCQs). Please refresh and try again.`,
      });
    }

    if (actualCount !== targetCount) {
      return res.status(400).json({
        message: `Cannot publish. Expected ${targetCount} MCQs but only ${actualCount} saved.`,
      });
    }

    // Final integrity check on all MCQs, sourced from the Mcq collection.
    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "FreeCustomTest" })
      .sort({ order: 1 })
      .lean();

    for (let i = 0; i < mcqDocs.length; i++) {
      const mcq = mcqDocs[i];
      if (!mcq.question || !mcq.question.trim()) {
        return res.status(400).json({ message: `MCQ #${i + 1}: question is empty.` });
      }
      if (!Array.isArray(mcq.options) || mcq.options.length !== 4) {
        return res.status(400).json({ message: `MCQ #${i + 1}: must have 4 options.` });
      }
      for (let j = 0; j < 4; j++) {
        if (!mcq.options[j] || !mcq.options[j].trim()) {
          return res.status(400).json({ message: `MCQ #${i + 1}: option ${j + 1} is empty.` });
        }
      }
      if (mcq.correctOption < 0 || mcq.correctOption > 3) {
        return res.status(400).json({ message: `MCQ #${i + 1}: invalid correctOption.` });
      }
    }

    test.status = "published";
    await test.save();

    if (test.groupId) {
      await TestGroup.findByIdAndUpdate(test.groupId, { $inc: { publishedFreeTestCount: 1 } });
    }

    return res.json({ published: true, testId: test._id });
  } catch (err) {
    console.error("[publishCustomFreeMockTest] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── DELETE /api/free-mock-tests/custom/:testId ──────────────────
//
// Fully deletes a free mock test that belongs to a CUSTOM category
// (FreeCustomTest model — single-section, MCQs stored in the shared Mcq
// collection). Cleanup:
//   1. Delete every Mcq document linked to this test (testModel: "FreeCustomTest").
//   2. Delete the FreeCustomTest document itself.
//   3. If it had been published, decrement TestGroup.publishedFreeTestCount.
//      (Test numbering itself is no longer a persistent counter   see
//      utils/nextTestNumber.js. The next test created in this group will
//      automatically reclaim this testNumber if it was the highest one,
//      or leave a gap if an earlier/middle test still exists above it.)
//
// Response: 200 { message, mcqsDeleted }
router.delete("/free-mock-tests/custom/:testId", adminAuth, async (req, res) => {
  try {
    const { testId } = req.params;
    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await FreeCustomTest.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Free test not found." });
    }

    const { deletedCount: mcqsDeleted } = await Mcq.deleteMany({
      testId: test._id,
      testModel: "FreeCustomTest",
    });

    await FreeCustomTest.findByIdAndDelete(testId);

    if (test.status === "published" && test.groupId) {
      await TestGroup.findByIdAndUpdate(test.groupId, {
        $inc: { publishedFreeTestCount: -1 },
      });
    }

    return res.status(200).json({ message: "Free test deleted", mcqsDeleted });
  } catch (err) {
    console.error("DELETE /api/free-mock-tests/custom/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/free-mock-tests/custom/:categorySlug ──────────────
// Public. Returns all published free mock tests for a custom category,
// grouped by TestGroup   the single-section equivalent of the premium
// getAllTestsByCategory listing.
router.get("/free-mock-tests/custom/:categorySlug", async (req, res) => {
  try {
    const { categorySlug } = req.params;

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) return res.json({ groups: [] });

    const groupIds = groups.map((g) => g._id);
    const publishedTests = await FreeCustomTest.find({
      groupId: { $in: groupIds },
      status: "published",
    })
      .sort({ testNumber: 1 })
      .lean();

    const groupMap = {};
    for (const g of groups) groupMap[g._id.toString()] = g;

    const testsByGroup = {};
    for (const test of publishedTests) {
      const key = test.groupId.toString();
      const group = groupMap[key];
      if (!group) continue;
      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        id: test._id,
        testNumber: test.testNumber,
        displayName: `${group.name} Test ${test.testNumber}`,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
        isFree: true,
      });
    }

    const result = groups
      .map((group) => ({
        id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description || "",
        blogContent: group.blogContent || "",
        tests: testsByGroup[group._id.toString()] || [],
      }))
      .filter((g) => g.tests.length > 0);

    return res.json({ groups: result });
  } catch (err) {
    console.error("[getCustomFreeMockTestsByCategory] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── GET /api/free-mock-tests/custom/group/:groupId/tests ──────
// Admin only. Returns ALL free tests in a group (any status), for the
// "State B" listing inside the Free Mock Test Group Panel.
router.get("/free-mock-tests/custom/group/:groupId/tests", adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    // .select("-mcqs") is a safety net — the embedded array field was
    // removed from the schema in Stage 1, but this guards against any
    // stale documents that haven't gone through the cleanup script yet.
    const tests = await FreeCustomTest.find({ groupId })
      .select("-mcqs")
      .sort({ testNumber: 1 })
      .lean();

    const enriched = tests.map((t) => ({
      _id: t._id,
      testNumber: t.testNumber,
      status: t.status,
      timeLimitSeconds: t.timeLimitSeconds,
      totalMcqs: t.totalMcqs,
      mcqCount: t.mcqCount || 0,
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("[getFreeTestsByGroup] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ── GET /api/admin/free-mock-tests/custom/summary/:categorySlug ─
// Admin only. Returns all groups + ALL free tests (every status) for the
// Free Mock Tests dashboard listing on custom categories   the free-test
// equivalent of /api/admin/custom-tests/summary/:categorySlug.
router.get("/admin/free-mock-tests/custom/summary/:categorySlug", adminAuth, async (req, res) => {
  try {
    const { categorySlug } = req.params;

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) return res.json({ groups: [] });

    const groupIds = groups.map((g) => g._id);

    const allTests = await FreeCustomTest.find({ groupId: { $in: groupIds } })
      .sort({ testNumber: 1 })
      .select("_id testNumber status groupId timeLimitSeconds totalMcqs mcqCount")
      .lean();

    const testsByGroup = {};
    for (const test of allTests) {
      const key = test.groupId.toString();
      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        _id: test._id,
        testNumber: test.testNumber,
        status: test.status,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
        mcqCount: test.mcqCount || 0,
      });
    }

    const result = groups.map((g) => ({
      _id: g._id,
      name: g.name,
      slug: g.slug,
      tests: testsByGroup[g._id.toString()] || [],
    }));

    return res.json({ groups: result });
  } catch (err) {
    console.error("[adminFreeMockTestsCustomSummary] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  ADMIN ROUTES — FREE CUSTOM TESTS (legacy paths, kept for back-compat)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/test-groups/:groupId/free-tests
 * Admin only. Creates a new free (no-login) test inside the given group.
 * Auto-numbers within the group. Mirrors createCustomTest but uses FreeCustomTest.
 */
router.post("/test-groups/:groupId/free-tests", adminAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { timeLimitSeconds, totalMcqs } = req.body ?? {};

    const group = await TestGroup.findById(groupId);
    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }
    if (!group.categoryId) {
      return res.status(400).json({ message: "Test group is missing a categoryId." });
    }

    // testNumber computed fresh from live data — see utils/nextTestNumber.js.
    const test = await createWithNextTestNumber(FreeCustomTest, groupId, (testNumber) => ({
      category: group.categoryId,
      groupId: group._id,
      groupSlug: group.slug,
      categorySlug: group.categorySlug,
      testNumber,
      timeLimitSeconds: timeLimitSeconds || null,
      totalMcqs: totalMcqs || null,
      status: "in_progress",
    }));

    return res.status(201).json({ ...test.toObject(), groupName: group.name });
  } catch (err) {
    console.error("[createFreeCustomTest] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

/**
 * GET /api/free-custom-tests/test/:testId
 * Admin only. Fetch a single free custom test by ID.
 */
router.get("/free-custom-tests/test/:testId", adminAuth, async (req, res) => {
  try {
    const test = await FreeCustomTest.findById(req.params.testId).lean();
    if (!test) return res.status(404).json({ message: "Test not found." });

    let groupName = "";
    if (test.groupId) {
      const group = await TestGroup.findById(test.groupId).lean();
      groupName = group?.name || "";
    }

    return res.json({ ...test, groupName, mcqCount: test.mcqCount || 0 });
  } catch (err) {
    console.error("[getFreeCustomTestById] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
});

/**
 * PATCH /api/free-custom-tests/:testId/settings
 * Admin only. Save timeLimitSeconds and totalMcqs.
 */
router.patch("/free-custom-tests/:testId/settings", adminAuth, async (req, res) => {
  try {
    const { timeLimitSeconds, totalMcqs } = req.body ?? {};
    if (!timeLimitSeconds || !totalMcqs) {
      return res.status(400).json({ message: "timeLimitSeconds and totalMcqs are required." });
    }
    const test = await FreeCustomTest.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found." });

    test.timeLimitSeconds = Number(timeLimitSeconds);
    test.totalMcqs = Number(totalMcqs);
    await test.save();

    return res.json({ saved: true, timeLimitSeconds: test.timeLimitSeconds, totalMcqs: test.totalMcqs });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * POST /api/free-custom-tests/:testId/mcqs
 * DEPRECATED (Stage 2). Same forbidden full-array-replace pattern as the
 * other two legacy MCQ-save endpoints — removed for the same reason.
 * Returns 410 Gone. Use POST /api/free-mock-tests/custom/:testId/mcqs/batch
 * (this legacy path and the "Prompt 13" path both operate on the same
 * FreeCustomTest model, so the batch endpoint registered above covers it).
 */
router.post("/free-custom-tests/:testId/mcqs", adminAuth, async (req, res) => {
  return res.status(410).json({
    message:
      "This endpoint has been removed. MCQs are no longer stored as a full array on the test document — use POST /api/free-mock-tests/custom/:testId/mcqs/batch to add new MCQs instead.",
  });
});

/**
 * POST /api/free-custom-tests/:testId/publish
 * Admin only. Publish the free custom test.
 */
router.post("/free-custom-tests/:testId/publish", adminAuth, async (req, res) => {
  try {
    const test = await FreeCustomTest.findById(req.params.testId);
    if (!test) return res.status(404).json({ message: "Test not found." });

    const targetCount = test.totalMcqs;
    if (!targetCount) {
      return res.status(400).json({ message: "Save test settings before publishing." });
    }

    const actualCount = await Mcq.countDocuments({ testId: test._id, testModel: "FreeCustomTest" });

    if (actualCount !== test.mcqCount) {
      return res.status(409).json({
        message: `MCQ count is out of sync (recorded ${test.mcqCount}, found ${actualCount} saved MCQs). Please refresh and try again.`,
      });
    }

    if (actualCount !== targetCount) {
      return res.status(400).json({
        message: `Cannot publish. Expected ${targetCount} MCQs but only ${actualCount} saved.`,
      });
    }

    test.status = "published";
    await test.save();

    // Increment freeMockTestCount on the group for display in admin
    if (test.groupId) {
      await TestGroup.findByIdAndUpdate(test.groupId, { $inc: { publishedFreeTestCount: 1 } });
    }

    return res.json({ published: true, testId: test._id });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  PUBLIC ROUTES — CATEGORY & GROUP LISTING (with access flags)
// ─────────────────────────────────────────────────────────────

// Get all groups for a category
router.get("/test-groups/:categorySlug", getGroupsByCategory);

// Get all groups + published tests for a category — clean public listing (no access flags)
// Must be registered BEFORE /custom-tests/:categorySlug so "category" is not treated as a slug
router.get("/custom-tests/category/:categorySlug", getAllTestsByCategory);

// Get all premium tests in a group (requires auth to actually take them)
router.get("/test-groups/:groupId/tests", getTestsByGroup);

// Get all groups + published premium tests for a category page
// Uses optionalUserAuth to attach user if logged in (for access flag)
router.get("/custom-tests/:categorySlug", optionalUserAuth, getTestsByCategory);

// ─────────────────────────────────────────────────────────────
//  PUBLIC ROUTES — FREE CUSTOM TESTS (no auth required)
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/free-custom-tests/:categorySlug
 * Returns all published free custom tests grouped by their TestGroup.
 */
router.get("/free-custom-tests/:categorySlug", async (req, res) => {
  try {
    const { categorySlug } = req.params;
    const search = req.query.search?.trim() || "";

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) {
      return search ? res.json({ results: [] }) : res.json({ groups: [] });
    }

    const groupIds = groups.map((g) => g._id);
    const publishedTests = await FreeCustomTest.find({
      groupId: { $in: groupIds },
      status: "published",
    })
      .sort({ testNumber: 1 })
      .lean();

    const groupMap = {};
    for (const g of groups) groupMap[g._id.toString()] = g;

    if (search) {
      const lower = search.toLowerCase();
      const results = [];
      for (const test of publishedTests) {
        const group = groupMap[test.groupId.toString()];
        if (!group) continue;
        const displayName = `${group.name} Test ${test.testNumber}`;
        if (group.name.toLowerCase().includes(lower) || displayName.toLowerCase().includes(lower)) {
          results.push({
            testId: test._id,
            displayName,
            groupName: group.name,
            timeLimitSeconds: test.timeLimitSeconds,
            totalMcqs: test.totalMcqs,
          });
        }
      }
      return res.json({ results });
    }

    const testsByGroup = {};
    for (const test of publishedTests) {
      const key = test.groupId.toString();
      const group = groupMap[key];
      if (!group) continue;
      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        id: test._id,
        testNumber: test.testNumber,
        displayName: `${group.name} Test ${test.testNumber}`,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
      });
    }

    const result = groups
      .map((group) => ({
        id: group._id,
        name: group.name,
        slug: group.slug,
        description: group.description || "",
        blogContent: group.blogContent || "",
        tests: testsByGroup[group._id.toString()] || [],
      }))
      .filter((g) => g.tests.length > 0); // Only show groups with published free tests

    return res.json({ groups: result });
  } catch (err) {
    console.error("[getFreeTestsByCategory] error:", err);
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * GET /api/free-custom-tests/hub/:testId
 * Returns metadata for a single published free custom test.
 */
router.get("/free-custom-tests/hub/:testId", async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await FreeCustomTest.findById(testId).lean();
    if (!test || test.status !== "published") {
      return res.status(404).json({ message: "Test not found." });
    }

    let groupName = "";
    let categorySlug = test.categorySlug || "";
    if (test.groupId) {
      const group = await TestGroup.findById(test.groupId).lean();
      groupName = group?.name || "";
      if (!categorySlug) categorySlug = group?.categorySlug || "";
    }

    return res.json({
      testId: test._id,
      displayName: `${groupName} Test ${test.testNumber}`,
      groupName,
      categorySlug,
      timeLimitSeconds: test.timeLimitSeconds,
      totalMcqs: test.totalMcqs,
      passMarkPercentage: test.passMarkPercentage || 80,
      subjectBreakdown: test.subjectBreakdown || [],
      isFree: true,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * GET /api/free-custom-tests/:testId/mcqs
 * Returns shuffled MCQs (no correctOption) for a free custom test.
 */
router.get("/free-custom-tests/:testId/mcqs", async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await FreeCustomTest.findById(testId).lean();
    if (!test || test.status !== "published") {
      return res.status(404).json({ message: "Test not found." });
    }

    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "FreeCustomTest" })
      .sort({ order: 1 })
      .lean();

    const mcqs = seededShuffle(
      mcqDocs.map((m) => ({
        _id: m._id,
        question: m.question,
        options: m.options,
        // correctOption intentionally omitted
      })),
      testId
    );

    res.set("Cache-Control", "no-store");
    return res.json({
      mcqs,
      sectionName: "Test",
      timeLimitSeconds: test.timeLimitSeconds || 1800,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * POST /api/free-custom-tests/:testId/submit
 * Grades answers for a free custom test.
 */
router.post("/free-custom-tests/:testId/submit", async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await FreeCustomTest.findById(testId).lean();
    if (!test || test.status !== "published") {
      return res.status(404).json({ message: "Test not found." });
    }

    const safeAnswers = answers && typeof answers === "object" ? answers : {};
    const mcqs = await Mcq.find({ testId: test._id, testModel: "FreeCustomTest" })
      .sort({ order: 1 })
      .lean();
    let score = 0;

    for (const mcq of mcqs) {
      const submitted = safeAnswers[mcq._id.toString()];
      if (typeof submitted === "number" && submitted === mcq.correctOption) {
        score += 1;
      }
    }

    const total = mcqs.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= (test.passMarkPercentage || 80);

    res.set("Cache-Control", "no-store");
    return res.json({ score, total, percentage, passed });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * GET /api/free-custom-tests/:testId/review
 * Returns MCQs WITH correctOption for post-test review.
 */
router.get("/free-custom-tests/:testId/review", async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await FreeCustomTest.findById(testId).lean();
    if (!test || test.status !== "published") {
      return res.status(404).json({ message: "Test not found." });
    }

    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "FreeCustomTest" })
      .sort({ order: 1 })
      .lean();

    // Same deterministic order as the /mcqs route above (seeded by testId
    // alone   these are standalone tests, no sectionKey) so Review Question
    // N is guaranteed to be the exact same MCQ as Test Question N.
    const ordered = seededShuffle(mcqDocs, testId);

    const mcqs = ordered.map((m, i) => ({
      _id: m._id || String(i),
      question: m.question,
      options: m.options,
      correctIndex: m.correctOption,
    }));

    res.set("Cache-Control", "no-store");
    return res.json({ mcqs });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  PROTECTED ROUTES — PREMIUM CUSTOM TESTS (login required)
// ─────────────────────────────────────────────────────────────

// ── Shared access guard for premium custom tests ──────────────
async function checkCustomTestAccess(req, res, test) {
  const user = req.user;

  if (user.isExpired()) {
    res.status(403).json({
      code: "ACCESS_EXPIRED",
      message: "Your access has expired. Please contact the admin to renew your subscription.",
    });
    return false;
  }

  // Category access
  const categorySlug = test.groupSlug
    ? (await TestGroup.findById(test.groupId).lean())?.categorySlug
    : null;

  if (categorySlug) {
    const group = await TestGroup.findById(test.groupId).lean();
    const catSlug = group?.categorySlug;
    if (catSlug && !user.hasAccessTo(catSlug)) {
      res.status(403).json({ message: "You do not have access to this category." });
      return false;
    }
    // Sub-group access check
    if (test.groupSlug && !user.hasGroupAccess(test.groupSlug)) {
      res.status(403).json({
        message: "You do not have access to this sub-group. Contact the admin to upgrade.",
      });
      return false;
    }
  }

  return true;
}

/**
 * GET /api/custom-tests/hub/:testId  (protected)
 * Returns metadata for a published premium custom test.
 */
router.get("/custom-tests/hub/:testId", userProtect, async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await Test.findById(testId).lean();
    if (!test || test.status !== "published") {
      return res.status(404).json({ message: "Test not found." });
    }

    const allowed = await checkCustomTestAccess(req, res, test);
    if (!allowed) return;

    let groupName = "";
    let categorySlug = "";
    if (test.groupId) {
      const group = await TestGroup.findById(test.groupId).lean();
      groupName = group?.name || "";
      categorySlug = group?.categorySlug || "";
    }

    return res.json({
      testId: test._id,
      displayName: `${groupName} Test ${test.testNumber}`,
      groupName,
      categorySlug,
      timeLimitSeconds: test.timeLimitSeconds,
      totalMcqs: test.totalMcqs,
      passMarkPercentage: test.passMarkPercentage || 80,
      subjectBreakdown: test.subjectBreakdown || [],
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * GET /api/custom-tests/:testId/mcqs  (protected)
 * Returns shuffled MCQs for a premium custom test session.
 */
router.get("/custom-tests/:testId/mcqs", userProtect, async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await Test.findById(testId).lean();
    if (!test || test.status !== "published" || !test.isStandalone) {
      return res.status(404).json({ message: "Test not found." });
    }

    const allowed = await checkCustomTestAccess(req, res, test);
    if (!allowed) return;

    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "Test" })
      .sort({ order: 1 })
      .lean();

    const mcqs = seededShuffle(
      mcqDocs.map((m) => ({
        _id: m._id,
        question: m.question,
        options: m.options,
      })),
      testId
    );

    res.set("Cache-Control", "no-store");
    return res.json({
      mcqs,
      sectionName: "Test",
      timeLimitSeconds: test.timeLimitSeconds || 1800,
    });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * POST /api/custom-tests/:testId/submit  (protected)
 * Grades the submitted answers.
 */
router.post("/custom-tests/:testId/submit", userProtect, async (req, res) => {
  try {
    const { testId } = req.params;
    const { answers } = req.body || {};

    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await Test.findById(testId).lean();
    if (!test || test.status !== "published" || !test.isStandalone) {
      return res.status(404).json({ message: "Test not found." });
    }

    const allowed = await checkCustomTestAccess(req, res, test);
    if (!allowed) return;

    const safeAnswers = answers && typeof answers === "object" ? answers : {};
    const mcqs = await Mcq.find({ testId: test._id, testModel: "Test" })
      .sort({ order: 1 })
      .lean();
    let score = 0;

    for (const mcq of mcqs) {
      const submitted = safeAnswers[mcq._id.toString()];
      if (typeof submitted === "number" && submitted === mcq.correctOption) {
        score += 1;
      }
    }

    const total = mcqs.length;
    const percentage = total > 0 ? Math.round((score / total) * 100) : 0;
    const passed = percentage >= (test.passMarkPercentage || 80);

    res.set("Cache-Control", "no-store");
    return res.json({ score, total, percentage, passed });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

/**
 * GET /api/custom-tests/:testId/review  (protected)
 * Returns MCQs with correctOption for post-test review.
 */
router.get("/custom-tests/:testId/review", userProtect, async (req, res) => {
  try {
    const { testId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(testId)) {
      return res.status(404).json({ message: "Test not found." });
    }
    const test = await Test.findById(testId).lean();
    if (!test || test.status !== "published" || !test.isStandalone) {
      return res.status(404).json({ message: "Test not found." });
    }

    const allowed = await checkCustomTestAccess(req, res, test);
    if (!allowed) return;

    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "Test" })
      .sort({ order: 1 })
      .lean();

    // Same deterministic order as the /custom-tests/:testId/mcqs route
    // above (seeded by testId alone   standalone tests have no sectionKey)
    // so Review Question N is guaranteed to be the exact same MCQ as
    // Test Question N.
    const ordered = seededShuffle(mcqDocs, testId);

    const mcqs = ordered.map((m, i) => ({
      _id: m._id || String(i),
      question: m.question,
      options: m.options,
      correctIndex: m.correctOption,
    }));

    res.set("Cache-Control", "no-store");
    return res.json({ mcqs });
  } catch (err) {
    return res.status(500).json({ message: err.message || "Server error." });
  }
});

export default router;