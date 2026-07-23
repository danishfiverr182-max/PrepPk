/**
 * controllers/customTestController.js
 *
 * Handles creating and fetching tests for custom categories
 * (tests with groupId set). The existing test controller handles
 * default categories   do not modify it.
 *
 * createCustomTest      admin: create a new auto-numbered test in a group
 * getTestsByGroup       public: list tests in a group sorted by testNumber
 * getTestsByCategory    public: all groups + published tests for a category page
 * addMcqs               admin: DEPRECATED — legacy full-array replace, returns 410
 * addMcqsBatch          admin: bulk-add new MCQs to the Mcq collection (insertMany)
 * updateMcq             admin: edit a single MCQ by its Mcq _id
 * deleteMcq             admin: delete a single MCQ by its Mcq _id
 * getMcqsPaginated      admin: paginated list of MCQs for a test
 * publishTest           admin: publish a standalone custom test
 * getTestById           admin/public: fetch a single test by ID
 * saveTestSettings      admin: save timeLimitSeconds and totalMcqs
 *
 * STAGE 2 NOTE: MCQs for standalone custom tests now live in their own
 * collection (see models/Mcq.js), linked via testId + testModel: "Test".
 * The old `test.mcqs` embedded array no longer exists on the schema
 * (removed in Stage 1) — every function below that used to read it or
 * compute a count from it has been updated to use `test.mcqCount` (a
 * denormalized counter) or to query the Mcq collection directly.
 */

import TestGroup from "../models/TestGroup.js";
import Test from "../models/Test.js";
import Category from "../models/Category.js";
import Mcq from "../models/Mcq.js";
import { sanitiseSubjectBreakdown } from "../utils/subjectBreakdown.js";
import { createWithNextTestNumber } from "../utils/nextTestNumber.js";

// ── POST /api/test-groups/:groupId/tests ─────────────────────
// Admin only. Creates a new test inside the given group.
// Auto-numbers the test by incrementing the group's testCount.
export async function createCustomTest(req, res) {
  try {
    const { groupId } = req.params;
    const { timeLimitSeconds, totalMcqs } = req.body ?? {};

    // Look up the group (no counter increment here anymore — see
    // utils/nextTestNumber.js for why a persistent counter caused
    // permanent numbering gaps after a failed/deleted test).
    const group = await TestGroup.findById(groupId);

    if (!group) {
      return res.status(404).json({ message: "Test group not found." });
    }

    // FIX: Guard against missing categoryId on the group document.
    // Without this, Test.create() throws a Mongoose validation error
    // ("category is required") which surfaces as a 500.
    if (!group.categoryId) {
      return res.status(400).json({
        message: "Test group is missing a categoryId. Please re-create the group.",
      });
    }

    // Create the test document. testNumber is computed fresh from the
    // tests that actually exist in this group right now, so deleting a
    // failed/incomplete test frees its number for reuse instead of
    // leaving a permanent gap (e.g. Test 6 fails → deleted → the next
    // test created becomes Test 6 again, not Test 7).
    // isStandalone: true is critical   it tells the partial index on
    // { category, testNumber } to exclude this document, preventing a
    // duplicate-key collision when multiple groups share the same category.
    const test = await createWithNextTestNumber(Test, groupId, (testNumber) => ({
      category: group.categoryId,
      groupId: group._id,
      groupSlug: group.slug,
      testNumber,
      isStandalone: true,          // ← must be true so the correct unique index applies
      passMarkPercentage: 80,
      status: "settings_pending",  // admin must save timer + MCQ count before adding MCQs
      timeLimitSeconds: null,
      totalMcqs: null,
    }));

    // Return the test with its group info populated
    const populated = await Test.findById(test._id).lean();
    return res.status(201).json({
      ...populated,
      groupName: group.name,
    });
  } catch (err) {
    // Log the full error server-side for easier debugging
    console.error("[createCustomTest] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/test-groups/:groupId/tests ──────────────────────
// Public. Returns all tests in a group sorted by testNumber ascending.
export async function getTestsByGroup(req, res) {
  try {
    const { groupId } = req.params;

    // Return ALL tests in the group (published + in-progress) so the admin
    // panel can show "Continue" links for unpublished tests too.
    // NOTE: mcqs is excluded via .select() as a safety net — the embedded
    // array field was removed from the schema in Stage 1, but this guards
    // against any stale documents that haven't gone through the cleanup
    // script yet from leaking the old array into the response.
    const tests = await Test.find({ groupId, isStandalone: true })
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
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
    }));

    return res.json(enriched);
  } catch (err) {
    console.error("[getTestsByGroup] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/custom-tests/:categorySlug ──────────────────────
// Public. Returns all groups + published tests for a category page.
// Optional ?search=query filters tests by group name OR display name.
//
// Response without search:
//   { groups: [ { id, name, slug, description, tests: [...] } ] }
// Response with search:
//   { results: [ { testId, displayName, groupName, timeLimitSeconds, totalMcqs } ] }
export async function getTestsByCategory(req, res) {
  try {
    const { categorySlug } = req.params;
    const search = req.query.search?.trim() || "";

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) {
      if (search) return res.json({ results: [] });
      return res.json({ groups: [] });
    }

    const groupIds = groups.map((g) => g._id);

    // .select("-mcqs") is a safety net — the embedded array field was
    // removed from the schema in Stage 1, but this guards against any
    // stale documents that haven't gone through the cleanup script yet.
    const publishedTests = await Test.find({
      groupId: { $in: groupIds },
      status: "published",
    })
      .select("-mcqs")
      .sort({ testNumber: 1 })
      .lean();

    // Build a lookup map: groupId → group
    const groupMap = {};
    for (const group of groups) {
      groupMap[group._id.toString()] = group;
    }

    // Compute access once   used by both search and normal mode
    const user = req.user || null;
    const categoryAccessible = user
      ? !user.isExpired() && user.hasAccessTo(categorySlug)
      : false;

    // ── Search mode ───────────────────────────────────────────
    if (search) {
      const lower = search.toLowerCase();
      const results = [];

      for (const test of publishedTests) {
        const group = groupMap[test.groupId.toString()];
        if (!group) continue;

        const displayName = `${group.name}   Test ${test.testNumber}`;

        // Match against group name OR display name (case-insensitive)
        if (
          group.name.toLowerCase().includes(lower) ||
          displayName.toLowerCase().includes(lower)
        ) {
          results.push({
            testId: test._id,
            displayName,
            groupName: group.name,
            timeLimitSeconds: test.timeLimitSeconds,
            totalMcqs: test.totalMcqs,
            locked: !categoryAccessible,
          });
        }
      }

      return res.json({ results });
    }

    // ── Normal mode   nested groups ───────────────────────────
    // Determine access for the logged-in user (req.user may be null for visitors)
    // PremiumUser has access to ALL categories (no per-group gating).

    const testsByGroup = {};
    for (const test of publishedTests) {
      const key = test.groupId.toString();
      const group = groupMap[key];
      if (!group) continue;

      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        id: test._id,
        testNumber: test.testNumber,
        displayName: `${group.name}   Test ${test.testNumber}`,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
        // Access flag for frontend lock UI   never relied on server-side for actual gate.
        // Premium users get access to all groups within an accessible category.
        locked: !categoryAccessible,
      });
    }

    const result = groups.map((group) => ({
      id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description || "",
      blogContent: group.blogContent || "",
      locked: !categoryAccessible,
      tests: testsByGroup[group._id.toString()] || [],
    }));

    return res.json({ groups: result, isPremium: true });
  } catch (err) {
    console.error("[getTestsByCategory] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/custom-tests/test/:testId ───────────────────────
// Admin. Fetches a single test document by ID with group name.
export async function getTestById(req, res) {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId).lean();
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    // Fetch group name for display
    let groupName = "";
    if (test.groupId) {
      const group = await TestGroup.findById(test.groupId).lean();
      groupName = group ? group.name : "";
    }

    return res.json({
      ...test,
      groupName,
      mcqCount: test.mcqCount || 0,
    });
  } catch (err) {
    console.error("[getTestById] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── PATCH /api/custom-tests/:testId/settings ─────────────────
// Admin only. Saves timeLimitSeconds and totalMcqs to the test.
export async function saveTestSettings(req, res) {
  try {
    const { testId } = req.params;
    const { timeLimitSeconds, totalMcqs, subjectBreakdown } = req.body ?? {};

    if (!timeLimitSeconds || !totalMcqs) {
      return res.status(400).json({ message: "timeLimitSeconds and totalMcqs are required." });
    }

    if (Number(totalMcqs) < 1) {
      return res.status(400).json({ message: "totalMcqs must be at least 1." });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    if (!test.isStandalone) {
      return res.status(400).json({ message: "Settings can only be saved for standalone tests." });
    }

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
    console.error("[saveTestSettings] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── POST /api/custom-tests/:testId/mcqs ──────────────────────
// DEPRECATED (Stage 2). This endpoint used to replace the ENTIRE
// test.mcqs array on every call — that embedded array no longer exists
// (removed in Stage 1). Returns 410 Gone so any client still on the old
// path fails loudly instead of silently no-op'ing against a field that
// isn't on the schema anymore. Use POST /:testId/mcqs/batch instead.
export async function addMcqs(req, res) {
  return res.status(410).json({
    message:
      "This endpoint has been removed. MCQs are no longer stored as a full array on the test document — use POST /api/custom-tests/:testId/mcqs/batch to add new MCQs instead.",
  });
}

// ── POST /api/custom-tests/:testId/mcqs/batch ─────────────────
// Admin only. Bulk-adds NEW MCQs only (never the full existing set) into
// the Mcq collection via insertMany, continuing `order` from the test's
// current mcqCount. mcqCount is incremented atomically with $inc via
// findByIdAndUpdate — never by reading mcqCount, adding in JS, then
// saving — so two overlapping batch saves for the same test can never
// stomp on each other's order range or under-count the total.
export async function addMcqsBatch(req, res) {
  try {
    const { testId } = req.params;
    const { mcqs } = req.body ?? {};

    if (!Array.isArray(mcqs) || mcqs.length === 0) {
      return res.status(400).json({ message: "mcqs must be a non-empty array." });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    if (!test.isStandalone) {
      return res.status(400).json({ message: "MCQs can only be added to standalone custom tests." });
    }
    if (test.status === "settings_pending") {
      return res.status(400).json({ message: "Save settings before adding MCQs." });
    }
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

    // Atomically reserve this batch's order range. { new: false } returns
    // the document as it was BEFORE the increment, so `previous.mcqCount`
    // is exactly the first free order slot for this batch — even if
    // another batch save for the same test is racing this one, MongoDB
    // guarantees each $inc is applied atomically and serially, so no two
    // batches can ever be handed the same starting order.
    const previous = await Test.findByIdAndUpdate(
      testId,
      { $inc: { mcqCount: mcqs.length } },
      { new: false }
    );
    if (!previous) {
      return res.status(404).json({ message: "Test not found." });
    }
    const startOrder = previous.mcqCount || 0;

    const docs = mcqs.map((mcq, i) => ({
      testId,
      testModel: "Test",
      question: mcq.question.trim(),
      options: mcq.options.map((o) => o.trim()),
      correctOption: mcq.correctOption,
      order: startOrder + i,
    }));

    try {
      await Mcq.insertMany(docs, { ordered: true });
    } catch (insertErr) {
      // Roll back the reserved count so mcqCount doesn't drift ahead of
      // what's actually in the Mcq collection.
      await Test.findByIdAndUpdate(testId, { $inc: { mcqCount: -mcqs.length } });
      throw insertErr;
    }

    return res.json({
      saved: true,
      insertedCount: docs.length,
      totalSaved: startOrder + docs.length,
    });
  } catch (err) {
    console.error("[addMcqsBatch] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── PATCH /api/custom-tests/:testId/mcqs/:mcqId ───────────────
// Admin only. Updates question/options/correctOption on exactly ONE Mcq
// document. No other MCQ for this test is read or rewritten.
export async function updateMcq(req, res) {
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
      { _id: mcqId, testId, testModel: "Test" },
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
    console.error("[updateMcq] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── DELETE /api/custom-tests/:testId/mcqs/:mcqId ──────────────
// Admin only. Removes exactly ONE Mcq document and decrements the
// parent test's mcqCount by 1 (atomic $inc, not a read-modify-save).
export async function deleteMcq(req, res) {
  try {
    const { testId, mcqId } = req.params;

    const deleted = await Mcq.findOneAndDelete({ _id: mcqId, testId, testModel: "Test" });
    if (!deleted) {
      return res.status(404).json({ message: "MCQ not found for this test." });
    }

    await Test.findByIdAndUpdate(testId, { $inc: { mcqCount: -1 } });

    return res.json({ deleted: true, mcqId });
  } catch (err) {
    console.error("[deleteMcq] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/custom-tests/:testId/mcqs/list ───────────────────
// Admin only. Paginated list of MCQs for the admin editor, sorted by
// `order`. Query params: ?page=1&limit=20 (defaults). The admin UI can
// also pass a larger limit (e.g. ?limit=100000) to load everything for a
// test in one call when resuming an in-progress test.
export async function getMcqsPaginated(req, res) {
  try {
    const { testId } = req.params;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 20);
    const skip = (page - 1) * limit;

    const filter = { testId, testModel: "Test" };

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
    console.error("[getMcqsPaginated] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── POST /api/custom-tests/:testId/publish ───────────────────
// Admin only. Publishes the test if all MCQs are in place.
export async function publishTest(req, res) {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    if (!test.isStandalone) {
      return res.status(400).json({ message: "Only standalone custom tests can be published via this endpoint." });
    }

    const targetCount = test.totalMcqs;
    if (!targetCount) {
      return res.status(400).json({ message: "Test settings (time limit and MCQ count) must be saved before publishing." });
    }

    // Count actual Mcq documents rather than trusting the denormalized
    // mcqCount alone — this is the source of truth.
    const actualCount = await Mcq.countDocuments({ testId: test._id, testModel: "Test" });

    // Sanity-check the denormalized counter against the real count. If
    // these ever disagree it means mcqCount drifted (e.g. a failed
    // insertMany that didn't roll back, or a direct DB edit) and we
    // should surface that rather than publish an inconsistent test.
    if (actualCount !== test.mcqCount) {
      return res.status(409).json({
        message: `MCQ count is out of sync (recorded ${test.mcqCount}, found ${actualCount} saved MCQs). Please refresh and try again.`,
      });
    }

    if (actualCount !== targetCount) {
      return res.status(400).json({
        message: `Cannot publish. Expected ${targetCount} MCQs but only ${actualCount} are saved.`,
      });
    }

    // Final integrity check on all MCQs, now sourced from the Mcq collection.
    const mcqDocs = await Mcq.find({ testId: test._id, testModel: "Test" })
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

    return res.json({ published: true, testId: test._id });
  } catch (err) {
    console.error("[publishTest] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}
// ── GET /api/custom-tests/category/:categorySlug ─────────────
// Public. Returns all groups for a category with their published tests nested.
// No user-access flags   purely structural listing for the public category page.
//
// Optional ?search=keyword   filters tests where group name OR displayName
// contains the keyword (case-insensitive). When present returns a flat list:
//   { results: [{ testId, displayName, groupName, groupSlug,
//                 timeLimitSeconds, totalMcqs }] }
// When absent returns grouped structure:
//   { groups: [{ id, name, slug, description, tests: [...] }] }
export async function getAllTestsByCategory(req, res) {
  try {
    const { categorySlug } = req.params;
    const search = req.query.search?.trim() || "";

    const groups = await TestGroup.find({ categorySlug })
      .sort({ order: 1, createdAt: 1 })
      .lean();

    if (!groups.length) {
      if (search) return res.json({ results: [] });
      return res.json({ groups: [] });
    }

    const groupIds = groups.map((g) => g._id);

    const publishedTests = await Test.find({
      groupId: { $in: groupIds },
      status: "published",
      isStandalone: true,
    })
      .sort({ testNumber: 1 })
      .select("_id testNumber groupId timeLimitSeconds totalMcqs")
      .lean();

    // Build a lookup map: groupId → group
    const groupMap = {};
    for (const group of groups) {
      groupMap[group._id.toString()] = group;
    }

    // ── Search mode ───────────────────────────────────────────
    if (search) {
      const lower = search.toLowerCase();
      const results = [];

      for (const test of publishedTests) {
        const group = groupMap[test.groupId.toString()];
        if (!group) continue;

        const displayName = `${group.name}   Test ${test.testNumber}`;

        if (
          group.name.toLowerCase().includes(lower) ||
          displayName.toLowerCase().includes(lower)
        ) {
          results.push({
            testId: test._id,
            displayName,
            groupName: group.name,
            groupSlug: group.slug,
            timeLimitSeconds: test.timeLimitSeconds,
            totalMcqs: test.totalMcqs,
          });
        }
      }

      return res.json({ results });
    }

    // ── Normal mode   nested groups ───────────────────────────
    const testsByGroup = {};
    for (const test of publishedTests) {
      const key = test.groupId.toString();
      const group = groupMap[key];
      if (!group) continue;
      if (!testsByGroup[key]) testsByGroup[key] = [];
      testsByGroup[key].push({
        id: test._id,
        testNumber: test.testNumber,
        displayName: `${group.name}   Test ${test.testNumber}`,
        timeLimitSeconds: test.timeLimitSeconds,
        totalMcqs: test.totalMcqs,
      });
    }

    const result = groups.map((group) => ({
      id: group._id,
      name: group.name,
      slug: group.slug,
      description: group.description || "",
      tests: testsByGroup[group._id.toString()] || [],
    }));

    return res.json({ groups: result });
  } catch (err) {
    console.error("[getAllTestsByCategory] error:", err);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}