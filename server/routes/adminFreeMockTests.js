/**
 * routes/adminFreeMockTests.js  (Part 5 Prompt 01 + 02 + 03 + 04 + 05 + 06)
 *
 * Admin endpoints for Free Mock Test management.
 * All routes are protected by verifyAdmin middleware.
 *
 * Mounted at /api/admin in server.js full paths:
 *   GET  /api/admin/free-mock-tests
 *   POST /api/admin/free-mock-tests/categories/:slug/start
 *   GET  /api/admin/free-mock-tests/categories/:slug/in-progress
 *   POST /api/admin/free-mock-tests/sections/verbal/draft
 *   GET  /api/admin/free-mock-tests/sections/verbal/:testId
 *   POST /api/admin/free-mock-tests/sections/verbal/save/:testId
 *   POST /api/admin/free-mock-tests/sections/nonverbal/draft
 *   GET  /api/admin/free-mock-tests/sections/nonverbal/:testId
 *   POST /api/admin/free-mock-tests/sections/nonverbal/save/:testId
 *   POST /api/admin/free-mock-tests/sections/academic/draft       ← Prompt 06
 *   GET  /api/admin/free-mock-tests/sections/academic/:testId     ← Prompt 06
 *   POST /api/admin/free-mock-tests/sections/academic/save/:testId ← Prompt 06 (auto-publish)
 */

import express from "express";
import Category         from "../models/Category.js";
import FreeMockTest     from "../models/FreeMockTest.js";
import FreeMockSection  from "../models/FreeMockSection.js";
import verifyAdmin      from "../middleware/verifyAdmin.js";
import cloudinary       from "../config/cloudinary.js";
import { getFreeMockSectionStatus } from "../utils/testHelpers.js";
import { registerIncrementalMcqRoutes } from "../utils/incrementalMcqRoutes.js";
import { sanitiseSubjectBreakdown } from "../utils/subjectBreakdown.js";

const router = express.Router();

// ── All routes require admin auth ────────────────────────────
router.use(verifyAdmin);

// ── Incremental MCQ save routes (perf fix) ─────────────────────
// Adds:
//   PATCH /api/admin/free-mock-tests/sections/:urlType/mcq/:testId
//   POST  /api/admin/free-mock-tests/sections/:urlType/mcq-batch/:testId
//   PATCH /api/admin/free-mock-tests/sections/:urlType/mcq-truncate/:testId
// Free Mock sections are never shared (each category is independent), so
// this is purely a payload-size fix — one changed MCQ instead of the
// whole section resent on every keystroke.
registerIncrementalMcqRoutes(router, {
  TestModel: FreeMockTest,
  SectionModel: FreeMockSection,
  basePath: "/free-mock-tests/sections",
  types: { verbal: "verbal", nonverbal: "nonVerbal", academic: "academic" },
});

// ── Helper: build section-status response shape ───────────────
function buildStatusResponse(test, category) {
  const nextRequired = getFreeMockSectionStatus(test);
  return {
    testId:       test._id,
    testNumber:   test.testNumber,
    nextRequired,
    sections: {
      verbal:    { status: test.sections.verbal.status },
      nonVerbal: { status: test.sections.nonVerbal.status },
      academic:  { status: test.sections.academic.status },
    },
    categoryName: category.name,
    categorySlug: category.slug,
  };
}

// ─────────────────────────────────────────────────────────────
//  CATEGORY LIST
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/free-mock-tests
 */
router.get("/free-mock-tests", async (req, res, next) => {
  try {
    const categories = await Category.find({})
      .sort({ order: 1 })
      .select("_id name slug isDefault")
      .lean();

    const enriched = await Promise.all(
      categories.map(async (cat) => {
        // Custom categories (Prompt 14) use the single-section group → test
        // flow (FreeCustomTest model), not the 3-section FreeMockTest model,
        // so the counts below don't apply to them. The frontend fetches
        // grouped free-test data separately via the /custom/summary route.
        if (cat.isDefault === false) {
          return {
            _id:        cat._id,
            name:       cat.name,
            slug:       cat.slug,
            isDefault:  false,
          };
        }

        const publishedCount = await FreeMockTest.countDocuments({
          category:    cat._id,
          isPublished: true,
        });

        const inProgressTest = await FreeMockTest.findOne({
          category:    cat._id,
          isPublished: false,
          $or: [
            { "sections.verbal.status":    "pending" },
            { "sections.nonVerbal.status": "pending" },
            { "sections.academic.status":  "pending" },
          ],
        })
          .select("_id")
          .lean();

        const result = {
          _id:           cat._id,
          name:          cat.name,
          slug:          cat.slug,
          isDefault:     true,
          publishedCount,
          hasInProgress: !!inProgressTest,
        };

        if (inProgressTest) result.inProgressTestId = inProgressTest._id;

        return result;
      })
    );

    return res.json({ categories: enriched });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  START / IN-PROGRESS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/categories/:slug/start
 */
router.post("/free-mock-tests/categories/:slug/start", async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug }).lean();
    if (!category) return res.status(404).json({ message: "Category not found." });

    let test = await FreeMockTest.findOne({
      category:    category._id,
      isPublished: false,
      $or: [
        { "sections.verbal.status":    "pending" },
        { "sections.nonVerbal.status": "pending" },
        { "sections.academic.status":  "pending" },
      ],
    });

    if (!test) {
      const existingCount = await FreeMockTest.countDocuments({ category: category._id });
      test = await FreeMockTest.create({
        category:   category._id,
        testNumber: existingCount + 1,
        sections: {
          verbal:    { status: "pending", sectionRef: null },
          nonVerbal: { status: "pending", sectionRef: null },
          academic:  { status: "pending", sectionRef: null },
        },
        isPublished: false,
      });
    }

    return res.json(buildStatusResponse(test, category));
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/free-mock-tests/categories/:slug/in-progress
 */
router.get("/free-mock-tests/categories/:slug/in-progress", async (req, res, next) => {
  try {
    const { slug } = req.params;

    const category = await Category.findOne({ slug }).lean();
    if (!category) return res.status(404).json({ message: "Category not found." });

    const test = await FreeMockTest.findOne({
      category:    category._id,
      isPublished: false,
      $or: [
        { "sections.verbal.status":    "pending" },
        { "sections.nonVerbal.status": "pending" },
        { "sections.academic.status":  "pending" },
      ],
    });

    if (!test) return res.json({ test: null });

    return res.json({ test: buildStatusResponse(test, category) });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  VERBAL SECTION DRAFT ENDPOINTS
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/verbal/draft
 */
router.post("/free-mock-tests/sections/verbal/draft", async (req, res, next) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs, subjectBreakdown, totalMarks, negativeMarking } = req.body;

    if (!testId) return res.status(400).json({ message: "testId is required." });

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    const section = await FreeMockSection.findOneAndUpdate(
      test.sections.verbal.sectionRef
        ? { _id: test.sections.verbal.sectionRef }
        : { testRef: testId, type: "verbal" },
      {
        $set: {
          type:      "verbal",
          category:  test.category,
          testRef:   test._id,
          timeLimit: Number(timeLimit) || 0,
          totalMCQs: Number(totalMCQs) || 0,
          subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
          totalMarks: totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
            ? Number(totalMarks)
            : 100,
          negativeMarking: {
            enabled: negativeMarking?.enabled === true,
            marksPerWrong: negativeMarking?.enabled === true
              ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
              : 0,
          },
          mcqs:      mcqs || [],
          isShared:  false,
          isDraft:   true,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: false }
    );

    if (!test.sections.verbal.sectionRef) {
      test.sections.verbal.sectionRef = section._id;
      await test.save();
    }

    return res.json({ sectionId: section._id, savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/free-mock-tests/sections/verbal/:testId
 */
router.get("/free-mock-tests/sections/verbal/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    if (!test.sections.verbal.sectionRef) {
      return res.json({ section: null });
    }

    const section = await FreeMockSection.findById(
      test.sections.verbal.sectionRef
    ).lean();

    return res.json({ section: section || null });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  VERBAL SECTION SAVE (FINALIZE)
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/verbal/save/:testId
 */
router.post("/free-mock-tests/sections/verbal/save/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    if (!test.sections.verbal.sectionRef) {
      return res.status(400).json({ message: "No verbal section draft found for this test." });
    }

    const section = await FreeMockSection.findById(test.sections.verbal.sectionRef);
    if (!section) {
      return res.status(400).json({ message: "Verbal section draft not found." });
    }

    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually ended up here (normally via JSON
    // import). Just require at least one, then sync totalMCQs to match
    // reality rather than validating against a separate target.
    if (section.mcqs.length === 0) {
      return res.status(400).json({
        message: "Import a JSON file with at least one MCQ before saving this section.",
      });
    }
    section.totalMCQs = section.mcqs.length;

    for (let i = 0; i < section.mcqs.length; i++) {
      const mcq = section.mcqs[i];
      const num = i + 1;

      if (!mcq.question || mcq.question.trim().length === 0) {
        return res.status(400).json({ message: `MCQ #${num} is missing a question.` });
      }

      if (typeof mcq.correctIndex !== "number" || mcq.correctIndex < 0) {
        return res.status(400).json({ message: `MCQ #${num} is missing a correct answer.` });
      }
    }

    const category = await Category.findById(test.category).select("name").lean();
    const categoryName = category?.name || "Unknown";

    section.isDraft  = false;
    section.isShared = false;
    await section.save();

    test.sections.verbal.status     = "complete";
    test.sections.verbal.sectionRef = section._id;
    await test.save();

    return res.json({
      message:      "Verbal section saved",
      nextRequired: "nonVerbal",
      categoryName,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  NON-VERBAL SECTION DRAFT ENDPOINTS  ← Prompt 05
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/nonverbal/draft
 */
router.post("/free-mock-tests/sections/nonverbal/draft", async (req, res, next) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs, subjectBreakdown, totalMarks, negativeMarking } = req.body;

    if (!testId) return res.status(400).json({ message: "testId is required." });

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    const section = await FreeMockSection.findOneAndUpdate(
      test.sections.nonVerbal.sectionRef
        ? { _id: test.sections.nonVerbal.sectionRef }
        : { testRef: testId, type: "nonVerbal" },
      {
        $set: {
          type:      "nonVerbal",
          category:  test.category,
          testRef:   test._id,
          timeLimit: Number(timeLimit) || 0,
          totalMCQs: Number(totalMCQs) || 0,
          subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
          totalMarks: totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
            ? Number(totalMarks)
            : 100,
          negativeMarking: {
            enabled: negativeMarking?.enabled === true,
            marksPerWrong: negativeMarking?.enabled === true
              ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
              : 0,
          },
          mcqs:      mcqs || [],
          isShared:  false,
          isDraft:   true,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: false }
    );

    if (!test.sections.nonVerbal.sectionRef) {
      test.sections.nonVerbal.sectionRef = section._id;
      await test.save();
    }

    return res.json({ sectionId: section._id, savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/free-mock-tests/sections/nonverbal/:testId
 */
router.get("/free-mock-tests/sections/nonverbal/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    if (!test.sections.nonVerbal.sectionRef) {
      return res.json({ section: null });
    }

    const section = await FreeMockSection.findById(
      test.sections.nonVerbal.sectionRef
    ).lean();

    return res.json({ section: section || null });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  NON-VERBAL SECTION SAVE (FINALIZE)  ← Prompt 05
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/nonverbal/save/:testId
 */
router.post("/free-mock-tests/sections/nonverbal/save/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    if (!test.sections.nonVerbal.sectionRef) {
      return res.status(400).json({ message: "No non-verbal section draft found for this test." });
    }

    const section = await FreeMockSection.findById(test.sections.nonVerbal.sectionRef);
    if (!section) {
      return res.status(400).json({ message: "Non-verbal section draft not found." });
    }

    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually ended up here (normally via JSON
    // import). Just require at least one, then sync totalMCQs to match
    // reality rather than validating against a separate target.
    if (section.mcqs.length === 0) {
      return res.status(400).json({
        message: "Import a JSON file with at least one MCQ before saving this section.",
      });
    }
    section.totalMCQs = section.mcqs.length;

    for (let i = 0; i < section.mcqs.length; i++) {
      const mcq = section.mcqs[i];
      const num = i + 1;

      if (!mcq.imageUrl || mcq.imageUrl.trim().length === 0) {
        return res.status(400).json({ message: `MCQ #${num} requires an image.` });
      }

      if (typeof mcq.correctIndex !== "number" || mcq.correctIndex < 0) {
        return res.status(400).json({ message: `MCQ #${num} is missing a correct answer.` });
      }
    }

    const category = await Category.findById(test.category).select("name").lean();
    const categoryName = category?.name || "Unknown";

    section.isDraft  = false;
    section.isShared = false;
    await section.save();

    test.sections.nonVerbal.status     = "complete";
    test.sections.nonVerbal.sectionRef = section._id;
    await test.save();

    return res.json({
      message:      "Non-verbal section saved",
      nextRequired: "academic",
      categoryName,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  ACADEMIC SECTION DRAFT ENDPOINTS  ← Prompt 06
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/academic/draft
 *
 * Creates or updates the draft FreeMockSection for the academic slot.
 * Text MCQs only no image fields.
 *
 * Enforced server-side:
 *  - category always taken from the FreeMockTest document, never from request body.
 *  - isShared always false academic content is per-category, never shared.
 */
router.post("/free-mock-tests/sections/academic/draft", async (req, res, next) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs, subjectBreakdown, totalMarks, negativeMarking } = req.body;

    if (!testId) return res.status(400).json({ message: "testId is required." });

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    const section = await FreeMockSection.findOneAndUpdate(
      test.sections.academic.sectionRef
        ? { _id: test.sections.academic.sectionRef }
        : { testRef: testId, type: "academic" },
      {
        $set: {
          type:      "academic",
          category:  test.category,   // always from test never from client
          testRef:   test._id,
          timeLimit: Number(timeLimit) || 0,
          totalMCQs: Number(totalMCQs) || 0,
          subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
          totalMarks: totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
            ? Number(totalMarks)
            : 100,
          negativeMarking: {
            enabled: negativeMarking?.enabled === true,
            marksPerWrong: negativeMarking?.enabled === true
              ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
              : 0,
          },
          mcqs:      mcqs || [],
          isShared:  false,           // enforced client value ignored
          isDraft:   true,
        },
      },
      { upsert: true, returnDocument: "after", runValidators: false }
    );

    if (!test.sections.academic.sectionRef) {
      test.sections.academic.sectionRef = section._id;
      await test.save();
    }

    return res.json({ sectionId: section._id, savedAt: new Date().toISOString() });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/free-mock-tests/sections/academic/:testId
 *
 * Returns the existing draft FreeMockSection for the academic slot.
 * Returns { section: null } (not a 404) when no draft exists yet.
 */
router.get("/free-mock-tests/sections/academic/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId).lean();
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    if (!test.sections.academic.sectionRef) {
      return res.json({ section: null });
    }

    const section = await FreeMockSection.findById(
      test.sections.academic.sectionRef
    ).lean();

    return res.json({ section: section || null });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  ACADEMIC SECTION SAVE + AUTO-PUBLISH  ← Prompt 06
// ─────────────────────────────────────────────────────────────

/**
 * POST /api/admin/free-mock-tests/sections/academic/save/:testId
 *
 * Validates the draft FreeMockSection for academic, marks it final,
 * updates freeMockTest.sections.academic.status to 'complete', then
 * checks whether all three sections are complete. If they are:
 *   - Sets freeMockTest.isPublished = true  (auto-publish no manual step)
 *   - Increments category.freeMockTestCount by 1
 *
 * Validation:
 *  - mcqs.length must equal section.totalMCQs
 *  - Every MCQ must have question (non-empty) no image required
 *  - Every MCQ must have correctAnswer (valid 0-based index)
 *
 * Enforced:
 *  - isShared always false never trusted from client
 *  - category always from FreeMockTest never from client
 *
 * Response: 200 { message, isPublished, categoryName }
 */
router.post("/free-mock-tests/sections/academic/save/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    // ── Load the parent FreeMockTest ─────────────────────────
    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    // ── Load the linked FreeMockSection draft ────────────────
    if (!test.sections.academic.sectionRef) {
      return res.status(400).json({ message: "No academic section draft found for this test." });
    }

    const section = await FreeMockSection.findById(test.sections.academic.sectionRef);
    if (!section) {
      return res.status(400).json({ message: "Academic section draft not found." });
    }

    // ── Validation: MCQ count must match totalMCQs ───────────
    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually ended up here (normally via JSON
    // import). Just require at least one, then sync totalMCQs to match
    // reality rather than validating against a separate target.
    if (section.mcqs.length === 0) {
      return res.status(400).json({
        message: "Import a JSON file with at least one MCQ before saving this section.",
      });
    }
    section.totalMCQs = section.mcqs.length;

    // ── Validation: every MCQ must have question + correctAnswer ─
    for (let i = 0; i < section.mcqs.length; i++) {
      const mcq = section.mcqs[i];
      const num = i + 1;

      if (!mcq.question || mcq.question.trim().length === 0) {
        return res.status(400).json({ message: `MCQ #${num} is missing a question.` });
      }

      if (typeof mcq.correctIndex !== "number" || mcq.correctIndex < 0) {
        return res.status(400).json({ message: `MCQ #${num} is missing a correct answer.` });
      }
    }

    // ── Mark section as final enforce isShared = false ─────
    section.isDraft  = false;
    section.isShared = false;
    await section.save();

    // ── Update FreeMockTest: academic status → complete ───────
    test.sections.academic.status     = "complete";
    test.sections.academic.sectionRef = section._id;

    // ── Auto-publish: check if all three sections are complete ─
    const allComplete =
      test.sections.verbal.status    === "complete" &&
      test.sections.nonVerbal.status === "complete" &&
      test.sections.academic.status  === "complete";

    if (allComplete) {
      test.isPublished = true;
    }

    await test.save();

    // ── Resolve category for name + freeMockTestCount increment ─
    const category = await Category.findById(test.category).select("name freeMockTestCount");
    const categoryName = category?.name || "Unknown";

    if (allComplete && category) {
      category.freeMockTestCount = (category.freeMockTestCount || 0) + 1;
      await category.save();
    }

    return res.status(200).json({
      message:      "Academic section saved",
      isPublished:  test.isPublished,
      categoryName,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  PUBLISHED TEST LIST PER CATEGORY  ← Prompt 07
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/free-mock-tests/categories/:slug/tests
 *
 * Returns all FreeMockTest documents for a category, sorted by createdAt
 * descending, with section refs populated (totalMCQs + timeLimit only).
 * Supports ?page=1&limit=10 pagination.
 *
 * Response shape:
 *   { tests: [...], total, page, totalPages }
 *
 * Each test item:
 *   { _id, testNumber, isPublished, createdAt,
 *     sections: {
 *       verbal:    { status, totalMCQs, timeLimit },
 *       nonVerbal: { status, totalMCQs, timeLimit },
 *       academic:  { status, totalMCQs, timeLimit }
 *     }
 *   }
 */
router.get("/free-mock-tests/categories/:slug/tests", async (req, res, next) => {
  try {
    const { slug } = req.params;
    const page  = Math.max(1, parseInt(req.query.page,  10) || 1);
    const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
    const skip  = (page - 1) * limit;

    const category = await Category.findOne({ slug }).lean();
    if (!category) return res.status(404).json({ message: "Category not found." });

    const total = await FreeMockTest.countDocuments({ category: category._id });

    const rawTests = await FreeMockTest.find({ category: category._id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .populate("sections.verbal.sectionRef",    "totalMCQs timeLimit")
      .populate("sections.nonVerbal.sectionRef", "totalMCQs timeLimit")
      .populate("sections.academic.sectionRef",  "totalMCQs timeLimit")
      .lean();

    // Shape: flatten section refs into flat status/totalMCQs/timeLimit objects
    const tests = rawTests.map((t) => ({
      _id:         t._id,
      testNumber:  t.testNumber,
      isPublished: t.isPublished,
      createdAt:   t.createdAt,
      sections: {
        verbal: {
          status:    t.sections.verbal.status,
          totalMCQs: t.sections.verbal.sectionRef?.totalMCQs ?? null,
          timeLimit: t.sections.verbal.sectionRef?.timeLimit  ?? null,
        },
        nonVerbal: {
          status:    t.sections.nonVerbal.status,
          totalMCQs: t.sections.nonVerbal.sectionRef?.totalMCQs ?? null,
          timeLimit: t.sections.nonVerbal.sectionRef?.timeLimit  ?? null,
        },
        academic: {
          status:    t.sections.academic.status,
          totalMCQs: t.sections.academic.sectionRef?.totalMCQs ?? null,
          timeLimit: t.sections.academic.sectionRef?.timeLimit  ?? null,
        },
      },
    }));

    return res.json({
      tests,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  FULL TEST DETAIL READ-ONLY VIEW  ← Prompt 08
// ─────────────────────────────────────────────────────────────

/**
 * GET /api/admin/free-mock-tests/:testId/full
 *
 * Returns the complete FreeMockTest with all three FreeMockSection
 * documents deeply populated (full mcqs arrays, timeLimit, totalMCQs
 * per section). Used by the read-only admin FreeMockTestViewPage.
 *
 * Response shape:
 *   {
 *     testId, testNumber, category: { name, slug }, isPublished,
 *     sections: {
 *       verbal:    { timeLimit, totalMCQs, mcqs: [...] },
 *       nonVerbal: { timeLimit, totalMCQs, mcqs: [...] },
 *       academic:  { timeLimit, totalMCQs, mcqs: [...] }
 *     }
 *   }
 */
router.get("/free-mock-tests/:testId/full", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId)
      .populate("sections.verbal.sectionRef")
      .populate("sections.nonVerbal.sectionRef")
      .populate("sections.academic.sectionRef")
      .populate("category", "name slug")
      .lean();

    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    function shapeSection(slot) {
      const ref = slot?.sectionRef || null;
      return {
        timeLimit: ref?.timeLimit ?? 0,
        totalMCQs: ref?.totalMCQs ?? 0,
        mcqs:      ref?.mcqs ?? [],
      };
    }

    return res.json({
      testId:      test._id,
      testNumber:  test.testNumber,
      category: {
        name: test.category?.name || "Unknown",
        slug: test.category?.slug || "",
      },
      isPublished: test.isPublished,
      sections: {
        verbal:    shapeSection(test.sections.verbal),
        nonVerbal: shapeSection(test.sections.nonVerbal),
        academic:  shapeSection(test.sections.academic),
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  DELETE FREE MOCK TEST WITH CLOUDINARY CLEANUP  ← Prompt 09
// ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/admin/free-mock-tests/:testId
 *
 * Deletes a Free Mock Test with full cleanup. No shared-section
 * complexity every FreeMockSection belongs exclusively to one test,
 * so deletion is always safe (unlike Part 4's Test delete route).
 *
 *   1. Find and verify the FreeMockTest exists.
 *   2. For the Non-Verbal section: collect all imagePublicId values
 *      from its mcqs array and destroy them on Cloudinary via
 *      Promise.allSettled (one failure does not abort deletion).
 *   3. Delete all three FreeMockSection documents (verbal, nonVerbal,
 *      academic) by their sectionRef IDs.
 *   4. Delete the FreeMockTest document.
 *   5. Decrement category.freeMockTestCount by 1.
 *
 * Response: 200 { message, imagesDeleted: N, imagesFailed: M }
 */
router.delete("/free-mock-tests/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "FreeMockTest not found." });

    let imagesDeleted = 0;
    let imagesFailed  = 0;

    // ── Cloudinary cleanup for the Non-Verbal section ──────────
    const nonVerbalRef = test.sections.nonVerbal.sectionRef;
    if (nonVerbalRef) {
      const nonVerbalSection = await FreeMockSection.findById(nonVerbalRef).lean();
      const publicIds = (nonVerbalSection?.mcqs || [])
        .map((m) => m.imagePublicId)
        .filter(Boolean);

      if (publicIds.length > 0) {
        const results = await Promise.allSettled(
          publicIds.map((id) => cloudinary.uploader.destroy(id))
        );

        results.forEach((r, i) => {
          if (r.status === "fulfilled") {
            imagesDeleted++;
          } else {
            imagesFailed++;
            console.error(
              `DELETE /api/admin/free-mock-tests/:testId Cloudinary destroy failed for "${publicIds[i]}":`,
              r.reason?.message || r.reason
            );
          }
        });
      }
    }

    // ── Delete all three FreeMockSection documents ─────────────
    const sectionIds = [
      test.sections.verbal.sectionRef,
      test.sections.nonVerbal.sectionRef,
      test.sections.academic.sectionRef,
    ].filter(Boolean);

    if (sectionIds.length > 0) {
      await FreeMockSection.deleteMany({ _id: { $in: sectionIds } });
    }

    // ── Delete the FreeMockTest document ───────────────────────
    await FreeMockTest.findByIdAndDelete(testId);

    // ── Decrement category.freeMockTestCount ───────────────────
    if (test.category) {
      await Category.findByIdAndUpdate(test.category, {
        $inc: { freeMockTestCount: -1 },
      });
    }

    return res.status(200).json({
      message: imagesFailed > 0
        ? "Free Mock Test deleted (some images may need manual cleanup)"
        : "Free Mock Test deleted",
      imagesDeleted,
      imagesFailed,
    });
  } catch (err) {
    next(err);
  }
});

// ─────────────────────────────────────────────────────────────
//  RESET DRAFT SECTIONS "START OVER" HELPER  ← Prompt 10
// ─────────────────────────────────────────────────────────────

/**
 * DELETE /api/admin/free-mock-tests/sections/draft/:testId
 *
 * Deletes all draft (isDraft: true) FreeMockSection documents for a
 * test and resets the corresponding section statuses back to
 * 'pending'. Lets the admin start over on an in-progress test
 * without creating a brand new one.
 *
 * Only sections that are STILL drafts are deleted any section that
 * has already been finalised (isDraft: false) is left untouched so
 * this route can never wipe completed work on a partially-published
 * test.
 *
 * Cloudinary images for a deleted non-verbal draft are cleaned up
 * with Promise.allSettled (same pattern as the test-delete route).
 *
 * Response: 200 { message, deletedSections: ['verbal'|'nonVerbal'|'academic', ...] }
 */
router.delete("/free-mock-tests/sections/draft/:testId", async (req, res, next) => {
  try {
    const { testId } = req.params;

    const test = await FreeMockTest.findById(testId);
    if (!test) return res.status(404).json({ message: "Free Mock Test not found." });

    if (test.isPublished) {
      return res
        .status(400)
        .json({ message: "Cannot reset a published test. Create a new test instead." });
    }

    const deletedSections = [];

    const resetSlot = async (slotKey) => {
      const sectionId = test.sections[slotKey]?.sectionRef;
      if (!sectionId) return;

      const section = await FreeMockSection.findById(sectionId);
      if (!section || !section.isDraft) {
        // Already finalised do not touch it
        return;
      }

      // Clean up Cloudinary images for a non-verbal draft
      if (section.type === "nonVerbal") {
        const publicIds = section.mcqs.map((m) => m.imagePublicId).filter(Boolean);
        if (publicIds.length > 0) {
          await Promise.allSettled(
            publicIds.map((id) => cloudinary.uploader.destroy(id))
          );
        }
      }

      await FreeMockSection.findByIdAndDelete(sectionId);
      deletedSections.push(slotKey);

      // Reset the slot on the test document
      test.sections[slotKey].sectionRef = undefined;
      test.sections[slotKey].status     = "pending";
    };

    await Promise.all([
      resetSlot("verbal"),
      resetSlot("nonVerbal"),
      resetSlot("academic"),
    ]);

    if (deletedSections.length > 0) {
      await test.save();
    }

    return res.status(200).json({
      message: deletedSections.length > 0
        ? `Draft section(s) reset: ${deletedSections.join(", ")}.`
        : "No draft sections found to reset.",
      deletedSections,
    });
  } catch (err) {
    next(err);
  }
});

export default router;

