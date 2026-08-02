/**
 * routes/adminTests.js  (Part 4 Prompt 03)
 *
 * Admin-protected test management routes.
 * Mounted at /api/admin in server.js.
 *
 * Routes added in Prompt 03:
 *   POST /sections/verbal/draft   create/update draft verbal section
 *   GET  /sections/verbal/:testId fetch existing draft verbal section
 *
 * All routes protected by verifyAdmin.
 */

import { Router } from "express";
import mongoose from "mongoose";
import multer from "multer";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import Test from "../models/Test.js";
import Section from "../models/Section.js";
import Category from "../models/Category.js";
import Mcq from "../models/Mcq.js";
import cloudinary from "../config/cloudinary.js";
import { formatSectionStatusResponse, getOrCreateSiblingTest } from "../utils/testHelpers.js";
import { registerIncrementalMcqRoutes } from "../utils/incrementalMcqRoutes.js";
import { sanitiseSubjectBreakdown } from "../utils/subjectBreakdown.js";

const router = Router();

// ── Incremental MCQ save routes (perf fix) ─────────────────────
// Adds:
//   PATCH /api/admin/sections/:urlType/mcq/:testId
//   POST  /api/admin/sections/:urlType/mcq-batch/:testId
//   PATCH /api/admin/sections/:urlType/mcq-truncate/:testId
// These let the editor save ONE changed MCQ instead of resending the
// whole section's mcqs array on every keystroke. Sharing across the
// 3 default military categories is untouched — it still happens via
// the single shared `sectionRef` in the existing .../save/:testId routes.
registerIncrementalMcqRoutes(router, {
  TestModel: Test,
  SectionModel: Section,
  basePath: "/sections",
  types: { verbal: "verbal", nonVerbal: "nonVerbal", academic: "academic" },
  authMiddleware: verifyAdmin,
});

// ── Multer memory storage for Cloudinary uploads ────────────
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 10 * 1024 * 1024 }, // 10 MB hard cap
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed."));
  },
});

// ── Shared military slugs (used in save endpoints) ────────────
const MILITARY_SLUGS = ["pak-army", "pak-navy", "pak-air-force"];

// ── GET /api/admin/tests/:testId/section-status ───────────────
router.get("/tests/:testId/section-status", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;
    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }
    const test = await Test.findById(testId).select("sections");
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }
    return res.json(formatSectionStatusResponse(test));
  } catch (err) {
    console.error("GET /api/admin/tests/:testId/section-status error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/categories/:slug/tests ────────────────────
router.post("/categories/:slug/tests", verifyAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const existing = await Test.findOne({
      category: category._id,
      isPublished: false,
    }).sort({ createdAt: -1 });

    if (existing) {
      return res.status(200).json({
        testId:     existing._id,
        testNumber: existing.testNumber,
        sections: {
          verbal:    { status: existing.sections.verbal.status },
          nonVerbal: { status: existing.sections.nonVerbal.status },
          academic:  { status: existing.sections.academic.status },
        },
        ...formatSectionStatusResponse(existing),
      });
    }

    const testCount = await Test.countDocuments({ category: category._id });
    const newTest = await Test.create({
      category:   category._id,
      testNumber: testCount + 1,
    });

    return res.status(201).json({
      testId:     newTest._id,
      testNumber: newTest.testNumber,
      sections: {
        verbal:    { status: newTest.sections.verbal.status },
        nonVerbal: { status: newTest.sections.nonVerbal.status },
        academic:  { status: newTest.sections.academic.status },
      },
      ...formatSectionStatusResponse(newTest),
    });
  } catch (err) {
    console.error("POST /api/admin/categories/:slug/tests error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/categories/:slug/tests/in-progress ─────────
router.get("/categories/:slug/tests/in-progress", verifyAdmin, async (req, res) => {
  try {
    const { slug } = req.params;
    const category = await Category.findOne({ slug });
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const test = await Test.findOne({
      category:    category._id,
      isPublished: false,
    }).sort({ createdAt: -1 });

    if (!test) return res.status(200).json({ test: null });

    return res.status(200).json({
      test: {
        testId:     test._id,
        testNumber: test.testNumber,
        sections: {
          verbal:    { status: test.sections.verbal.status },
          nonVerbal: { status: test.sections.nonVerbal.status },
          academic:  { status: test.sections.academic.status },
        },
        ...formatSectionStatusResponse(test),
      },
    });
  } catch (err) {
    console.error("GET /api/admin/categories/:slug/tests/in-progress error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/sections/verbal/draft ─────────────────────
//
// Creates or updates the draft verbal section for a given testId.
// Does NOT mark the section as complete that is Prompt 04's job.
//
// Body:     { testId, timeLimit (seconds), totalMCQs, mcqs[] }
// Response: { sectionId, savedAt }
router.post("/sections/verbal/draft", verifyAdmin, async (req, res) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs = [], subjectBreakdown, totalMarks, negativeMarking } = req.body;

    // ── Validation ────────────────────────────────────────────
    if (!testId || !testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Valid testId is required." });
    }
    if (timeLimit === undefined || timeLimit === null) {
      return res.status(400).json({ message: "timeLimit is required." });
    }
    if (Number(timeLimit) < 60) {
      return res.status(400).json({ message: "timeLimit must be at least 60 seconds (1 minute)." });
    }
    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually get imported (via JSON). A draft save
    // with no MCQs yet (e.g. the admin only set the timer, subject
    // breakdown, or marks so far) is valid and should persist normally
    // instead of being blocked here.
    const resolvedTotalMCQs = Number(totalMCQs) || 0;
    if (totalMarks !== undefined && totalMarks !== null && Number(totalMarks) < 1) {
      return res.status(400).json({ message: "totalMarks must be at least 1." });
    }
    if (
      negativeMarking &&
      negativeMarking.enabled &&
      (typeof negativeMarking.marksPerWrong !== "number" || negativeMarking.marksPerWrong < 0)
    ) {
      return res.status(400).json({ message: "marksPerWrong must be 0 or greater." });
    }

    const resolvedTotalMarks = totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
      ? Number(totalMarks)
      : 100;
    const resolvedNegativeMarking = {
      enabled: negativeMarking?.enabled === true,
      marksPerWrong: negativeMarking?.enabled === true
        ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
        : 0,
    };

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    // ── Sanitise MCQs for storage ─────────────────────────────
    // We store partial state (for resume). Only MCQs with at least a question
    // string are persisted. correctIndex defaults to 0 if not yet chosen
    // (the finalise endpoint in Prompt 04 enforces completeness).
    const sanitisedMcqs = mcqs
      .filter((m) => m && typeof m.question === "string" && m.question.trim().length > 0)
      .map((m) => ({
        question:     m.question.trim(),
        options:      [
          String(m.options?.[0] ?? ""),
          String(m.options?.[1] ?? ""),
          String(m.options?.[2] ?? ""),
          String(m.options?.[3] ?? ""),
        ],
        // -1 means "not yet chosen" in the UI; map to 0 to satisfy Mongoose min:0
        correctIndex: typeof m.correctIndex === "number" && m.correctIndex >= 0
          ? m.correctIndex
          : 0,
        explanation: m.explanation || "",
      }));

    // ── Upsert Section ────────────────────────────────────────
    // If a sectionRef already exists on this test, update that document.
    // If not, create a new Section and write the ref back to the test.
    let section;

    if (test.sections.verbal.sectionRef) {
      // Update existing section document
      section = await Section.findByIdAndUpdate(
        test.sections.verbal.sectionRef,
        {
          $set: {
            timeLimit: Number(timeLimit),
            totalMCQs: resolvedTotalMCQs,
            subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
            totalMarks: resolvedTotalMarks,
            negativeMarking: resolvedNegativeMarking,
            mcqs:      sanitisedMcqs,
            category:  test.category,
          },
        },
        { new: true, runValidators: false }
      );

      // Ref may point to a deleted document fall through to create if null
    }

    if (!section) {
      // Create a fresh Section document
      section = await Section.create({
        type:      "verbal",
        category:  test.category,
        timeLimit: Number(timeLimit),
        totalMCQs: resolvedTotalMCQs,
        subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
        totalMarks: resolvedTotalMarks,
        negativeMarking: resolvedNegativeMarking,
        mcqs:      sanitisedMcqs,
      });

      // Write the new sectionRef onto the test
      await Test.findByIdAndUpdate(testId, {
        "sections.verbal.sectionRef": section._id,
      });
    }

    return res.status(200).json({
      sectionId: section._id,
      savedAt:   section.updatedAt,
    });
  } catch (err) {
    console.error("POST /api/admin/sections/verbal/draft error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/sections/verbal/:testId ────────────────────
//
// Returns the existing draft verbal section for a test so the admin
// can resume editing after navigating away.
//
// Response: { section: { sectionId, timeLimit, totalMCQs, mcqs[] } } | { section: null }
router.get("/sections/verbal/:testId", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await Test.findById(testId).select("sections");
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    const sectionRef = test.sections.verbal.sectionRef;
    if (!sectionRef) {
      return res.status(200).json({ section: null });
    }

    const section = await Section.findById(sectionRef);
    if (!section) {
      return res.status(200).json({ section: null });
    }

    return res.status(200).json({
      section: {
        sectionId:  section._id,
        timeLimit:  section.timeLimit,
        totalMCQs:  section.totalMCQs,
        subjectBreakdown: section.subjectBreakdown || [],
        totalMarks: typeof section.totalMarks === "number" ? section.totalMarks : 100,
        negativeMarking: section.negativeMarking || { enabled: false, marksPerWrong: 0 },
        mcqs:       section.mcqs.map((m) => ({
          _id:          m._id,
          question:     m.question,
          options:      m.options,
          correctIndex: m.correctIndex,
          explanation:  m.explanation,
        })),
        updatedAt: section.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/sections/verbal/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/sections/verbal/save/:testId ──────────────
//
// Finalises the verbal section for a test:
//   1. Validates all MCQs are complete (question + options + correctIndex)
//   2. Marks the Section as isDraft:false
//   3. Sets test.sections.verbal.status = 'complete'
//   4. Sharing logic: if this test belongs to one of the three default military
//      categories (isDeletable:false), runs a transaction to link the same
//      Section document to Pak Army, Pak Navy, and Pak Air Force in-progress tests.
//      Sets section.isShared = true.
//      Custom category tests skip sharing entirely.
//
// Response: 200 { message, nextRequired: 'nonVerbal' }
router.post("/sections/verbal/save/:testId", verifyAdmin, async (req, res) => {
  const { testId } = req.params;

  if (!testId.match(/^[a-f\d]{24}$/i)) {
    return res.status(400).json({ message: "Invalid test ID format." });
  }

  // ── Load test + its section ───────────────────────────────
  const test = await Test.findById(testId).populate("category");
  if (!test) {
    return res.status(404).json({ message: "Test not found." });
  }

  const sectionRef = test.sections.verbal.sectionRef;
  if (!sectionRef) {
    return res
      .status(400)
      .json({ message: "No verbal section draft found. Please save a draft first." });
  }

  const section = await Section.findById(sectionRef);
  if (!section) {
    return res
      .status(400)
      .json({ message: "Verbal section draft not found in database." });
  }

  // ── Validate completeness ─────────────────────────────────
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
      return res.status(400).json({ message: `MCQ #${num} has an empty question.` });
    }

    if (
      !Array.isArray(mcq.options) ||
      mcq.options.length !== 4 ||
      mcq.options.some((o) => !o || o.trim().length === 0)
    ) {
      return res
        .status(400)
        .json({ message: `MCQ #${num} has an empty answer option.` });
    }

    if (
      typeof mcq.correctIndex !== "number" ||
      mcq.correctIndex < 0 ||
      mcq.correctIndex > 3
    ) {
      return res
        .status(400)
        .json({ message: `All MCQs must have a correct answer selected. MCQ #${num} is missing a correct answer.` });
    }
  }

  // ── Determine if this is a default military category ──────
  const owningCategory = test.category; // populated
  const isDefaultMilitary =
    owningCategory &&
    !owningCategory.isDeletable &&
    MILITARY_SLUGS.includes(owningCategory.slug);

  // ── Apply sharing logic via transaction (if military) ─────
  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      // Mark section as final
      section.isDraft   = false;
      section.isShared  = isDefaultMilitary ? true : section.isShared;
      await section.save({ session: mongoSession });

      if (isDefaultMilitary) {
        // Find all three default military categories
        const militaryCategories = await Category.find({
          slug: { $in: MILITARY_SLUGS },
        }).session(mongoSession);

        // Find-or-create the SAME numbered test in each of the 3 default
        // categories (matching by testNumber, not publish status, so an
        // earlier still-incomplete test in a sibling category never gets
        // overwritten by a later one).
        for (const cat of militaryCategories) {
          const t = await getOrCreateSiblingTest(Test, cat._id, test.testNumber, mongoSession);
          t.sections.verbal.sectionRef = section._id;
          t.sections.verbal.status     = "complete";
          await t.save({ session: mongoSession });
        }
      } else {
        // Custom category only update the current test
        test.sections.verbal.sectionRef = section._id;
        test.sections.verbal.status     = "complete";
        await test.save({ session: mongoSession });
      }
    });
  } catch (err) {
    await mongoSession.endSession();
    console.error("POST /api/admin/sections/verbal/save/:testId transaction error:", err.message);
    return res.status(500).json({ message: "Failed to save verbal section. Please try again." });
  }

  await mongoSession.endSession();

  return res.status(200).json({
    message:      "Verbal section saved",
    nextRequired: "nonVerbal",
  });
});

// ── POST /api/admin/upload-image ──────────────────────────────
//
// Accepts a multipart image upload, sends it to Cloudinary, and returns
// the secure URL and public_id.
//
// Body: multipart/form-data with field name "image"
// Response: { url, publicId }
router.post(
  "/upload-image",
  verifyAdmin,
  upload.single("image"),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No image file provided." });
      }

      // Convert buffer to base64 data URI for Cloudinary SDK
      const b64    = req.file.buffer.toString("base64");
      const dataUri = `data:${req.file.mimetype};base64,${b64}`;

      const result = await cloudinary.uploader.upload(dataUri, {
        folder:         "nonverbal-mcqs",
        resource_type:  "image",
        // Limit transformations to keep storage tidy
        allowed_formats: ["jpg", "jpeg", "png", "gif", "webp", "svg"],
      });

      return res.status(200).json({
        url:      result.secure_url,
        publicId: result.public_id,
      });
    } catch (err) {
      console.error("POST /api/admin/upload-image error:", err.message);
      return res.status(500).json({ message: "Image upload failed. Please try again." });
    }
  }
);

// ── POST /api/admin/sections/nonverbal/draft ──────────────────
//
// Creates or updates the draft non-verbal section for a given testId.
// Each MCQ may have: questionText (optional), imageUrl (required for
// finalisation), imagePublicId, options[4], correctIndex.
//
// Body:     { testId, timeLimit (seconds), totalMCQs, mcqs[] }
// Response: { sectionId, savedAt }
router.post("/sections/nonverbal/draft", verifyAdmin, async (req, res) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs = [], subjectBreakdown, totalMarks, negativeMarking } = req.body;

    if (!testId || !testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Valid testId is required." });
    }
    if (timeLimit === undefined || timeLimit === null) {
      return res.status(400).json({ message: "timeLimit is required." });
    }
    if (Number(timeLimit) < 60) {
      return res.status(400).json({ message: "timeLimit must be at least 60 seconds." });
    }
    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually get imported (via JSON). A draft save
    // with no MCQs yet (e.g. the admin only set the timer, subject
    // breakdown, or marks so far) is valid and should persist normally
    // instead of being blocked here.
    const resolvedTotalMCQs = Number(totalMCQs) || 0;
    if (totalMarks !== undefined && totalMarks !== null && Number(totalMarks) < 1) {
      return res.status(400).json({ message: "totalMarks must be at least 1." });
    }
    if (
      negativeMarking &&
      negativeMarking.enabled &&
      (typeof negativeMarking.marksPerWrong !== "number" || negativeMarking.marksPerWrong < 0)
    ) {
      return res.status(400).json({ message: "marksPerWrong must be 0 or greater." });
    }

    const resolvedTotalMarks = totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
      ? Number(totalMarks)
      : 100;
    const resolvedNegativeMarking = {
      enabled: negativeMarking?.enabled === true,
      marksPerWrong: negativeMarking?.enabled === true
        ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
        : 0,
    };

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    // Sanitise MCQs store partial state; imageUrl may be empty at draft stage
    const sanitisedMcqs = mcqs
      .filter((m) => m != null)
      .map((m) => ({
        question:      typeof m.question === "string" ? m.question.trim() : "",
        options:       [
          String(m.options?.[0] ?? ""),
          String(m.options?.[1] ?? ""),
          String(m.options?.[2] ?? ""),
          String(m.options?.[3] ?? ""),
        ],
        correctIndex:  typeof m.correctIndex === "number" && m.correctIndex >= 0
          ? m.correctIndex
          : 0,
        explanation:   m.explanation || "",
        imageUrl:      m.imageUrl      || "",
        imagePublicId: m.imagePublicId || "",
      }));

    let section;

    if (test.sections.nonVerbal.sectionRef) {
      section = await Section.findByIdAndUpdate(
        test.sections.nonVerbal.sectionRef,
        {
          $set: {
            timeLimit: Number(timeLimit),
            totalMCQs: resolvedTotalMCQs,
            subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
            totalMarks: resolvedTotalMarks,
            negativeMarking: resolvedNegativeMarking,
            mcqs:      sanitisedMcqs,
            category:  test.category,
          },
        },
        { new: true, runValidators: false }
      );
    }

    if (!section) {
      section = await Section.create({
        type:      "nonVerbal",
        category:  test.category,
        timeLimit: Number(timeLimit),
        totalMCQs: resolvedTotalMCQs,
        subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
        totalMarks: resolvedTotalMarks,
        negativeMarking: resolvedNegativeMarking,
        mcqs:      sanitisedMcqs,
      });

      await Test.findByIdAndUpdate(testId, {
        "sections.nonVerbal.sectionRef": section._id,
      });
    }

    return res.status(200).json({
      sectionId: section._id,
      savedAt:   section.updatedAt,
    });
  } catch (err) {
    console.error("POST /api/admin/sections/nonverbal/draft error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/sections/nonverbal/:testId ─────────────────
//
// Returns the existing draft non-verbal section for a test (for resume).
//
// Response: { section: { sectionId, timeLimit, totalMCQs, mcqs[] } } | { section: null }
router.get("/sections/nonverbal/:testId", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await Test.findById(testId).select("sections");
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    const sectionRef = test.sections.nonVerbal.sectionRef;
    if (!sectionRef) return res.status(200).json({ section: null });

    const section = await Section.findById(sectionRef);
    if (!section)   return res.status(200).json({ section: null });

    return res.status(200).json({
      section: {
        sectionId:  section._id,
        timeLimit:  section.timeLimit,
        totalMCQs:  section.totalMCQs,
        subjectBreakdown: section.subjectBreakdown || [],
        totalMarks: typeof section.totalMarks === "number" ? section.totalMarks : 100,
        negativeMarking: section.negativeMarking || { enabled: false, marksPerWrong: 0 },
        mcqs:       section.mcqs.map((m) => ({
          _id:           m._id,
          question:      m.question,
          options:       m.options,
          correctIndex:  m.correctIndex,
          explanation:   m.explanation,
          imageUrl:      m.imageUrl,
          imagePublicId: m.imagePublicId,
        })),
        updatedAt: section.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/sections/nonverbal/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/sections/nonverbal/save/:testId ───────────
//
// Finalises the non-verbal section:
//   1. Validates every MCQ has an imageUrl and a correct answer
//   2. Marks section isDraft:false
//   3. Sets test.sections.nonVerbal.status = 'complete'
//   4. Applies the same military sharing rule as the verbal save endpoint
//
// Response: 200 { message, nextRequired: 'academic' }
router.post("/sections/nonverbal/save/:testId", verifyAdmin, async (req, res) => {
  const { testId } = req.params;

  if (!testId.match(/^[a-f\d]{24}$/i)) {
    return res.status(400).json({ message: "Invalid test ID format." });
  }

  const test = await Test.findById(testId).populate("category");
  if (!test) {
    return res.status(404).json({ message: "Test not found." });
  }

  const sectionRef = test.sections.nonVerbal.sectionRef;
  if (!sectionRef) {
    return res.status(400).json({ message: "No non-verbal section draft found. Please save a draft first." });
  }

  const section = await Section.findById(sectionRef);
  if (!section) {
    return res.status(400).json({ message: "Non-verbal section draft not found in database." });
  }

  // ── Validate completeness ─────────────────────────────────
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
    const num  = i + 1;

    if (!mcq.imageUrl || mcq.imageUrl.trim().length === 0) {
      return res.status(400).json({ message: `MCQ #${num} requires an image.` });
    }

    if (
      !Array.isArray(mcq.options) ||
      mcq.options.length !== 4 ||
      mcq.options.some((o) => !o || o.trim().length === 0)
    ) {
      return res.status(400).json({ message: `MCQ #${num} has an empty answer option.` });
    }

    if (
      typeof mcq.correctIndex !== "number" ||
      mcq.correctIndex < 0 ||
      mcq.correctIndex > 3
    ) {
      return res.status(400).json({ message: `All MCQs must have a correct answer selected. MCQ #${num} is missing a correct answer.` });
    }
  }

  // ── Sharing logic ─────────────────────────────────────────
  const owningCategory  = test.category;
  const isDefaultMilitary =
    owningCategory &&
    !owningCategory.isDeletable &&
    MILITARY_SLUGS.includes(owningCategory.slug);

  const mongoSession = await mongoose.startSession();
  try {
    await mongoSession.withTransaction(async () => {
      section.isDraft  = false;
      section.isShared = isDefaultMilitary ? true : section.isShared;
      await section.save({ session: mongoSession });

      if (isDefaultMilitary) {
        const militaryCategories = await Category.find({
          slug: { $in: MILITARY_SLUGS },
        }).session(mongoSession);

        // Find-or-create the SAME numbered test in each of the 3 default
        // categories (matching by testNumber, not publish status, so an
        // earlier still-incomplete test in a sibling category never gets
        // overwritten by a later one).
        for (const cat of militaryCategories) {
          const t = await getOrCreateSiblingTest(Test, cat._id, test.testNumber, mongoSession);
          t.sections.nonVerbal.sectionRef = section._id;
          t.sections.nonVerbal.status     = "complete";
          await t.save({ session: mongoSession });
        }
      } else {
        test.sections.nonVerbal.sectionRef = section._id;
        test.sections.nonVerbal.status     = "complete";
        await test.save({ session: mongoSession });
      }
    });
  } catch (err) {
    await mongoSession.endSession();
    console.error("POST /api/admin/sections/nonverbal/save/:testId error:", err.message);
    return res.status(500).json({ message: "Failed to save non-verbal section. Please try again." });
  }

  await mongoSession.endSession();

  return res.status(200).json({
    message:      "Non-verbal section saved",
    nextRequired: "academic",
  });
});

// ── POST /api/admin/sections/academic/draft ───────────────────
//
// Creates or updates the draft academic section for a given testId.
// Academic sections are ALWAYS per-category never shared, regardless
// of category type (even the default military categories). The client
// is never trusted to set isShared; it is force-set to false here and
// again at finalisation time.
//
// Body:     { testId, timeLimit (seconds), totalMCQs, mcqs[] }
// Response: { sectionId, savedAt }
router.post("/sections/academic/draft", verifyAdmin, async (req, res) => {
  try {
    const { testId, timeLimit, totalMCQs, mcqs = [], subjectBreakdown, totalMarks, negativeMarking } = req.body;

    if (!testId || !testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Valid testId is required." });
    }
    if (timeLimit === undefined || timeLimit === null) {
      return res.status(400).json({ message: "timeLimit is required." });
    }
    if (Number(timeLimit) < 60) {
      return res.status(400).json({ message: "timeLimit must be at least 60 seconds (1 minute)." });
    }
    // totalMCQs is no longer admin-entered up front — it's derived from
    // however many MCQs actually get imported (via JSON). A draft save
    // with no MCQs yet (e.g. the admin only set the timer, subject
    // breakdown, or marks so far) is valid and should persist normally
    // instead of being blocked here.
    const resolvedTotalMCQs = Number(totalMCQs) || 0;
    if (totalMarks !== undefined && totalMarks !== null && Number(totalMarks) < 1) {
      return res.status(400).json({ message: "totalMarks must be at least 1." });
    }
    if (
      negativeMarking &&
      negativeMarking.enabled &&
      (typeof negativeMarking.marksPerWrong !== "number" || negativeMarking.marksPerWrong < 0)
    ) {
      return res.status(400).json({ message: "marksPerWrong must be 0 or greater." });
    }

    const resolvedTotalMarks = totalMarks !== undefined && totalMarks !== null && Number(totalMarks) >= 1
      ? Number(totalMarks)
      : 100;
    const resolvedNegativeMarking = {
      enabled: negativeMarking?.enabled === true,
      marksPerWrong: negativeMarking?.enabled === true
        ? Math.max(0, Number(negativeMarking.marksPerWrong) || 0)
        : 0,
    };

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    const sanitisedMcqs = mcqs
      .filter((m) => m && typeof m.question === "string" && m.question.trim().length > 0)
      .map((m) => ({
        question:     m.question.trim(),
        options:      [
          String(m.options?.[0] ?? ""),
          String(m.options?.[1] ?? ""),
          String(m.options?.[2] ?? ""),
          String(m.options?.[3] ?? ""),
        ],
        correctIndex: typeof m.correctIndex === "number" && m.correctIndex >= 0
          ? m.correctIndex
          : 0,
        explanation: m.explanation || "",
      }));

    let section;

    if (test.sections.academic.sectionRef) {
      section = await Section.findByIdAndUpdate(
        test.sections.academic.sectionRef,
        {
          $set: {
            timeLimit: Number(timeLimit),
            totalMCQs: resolvedTotalMCQs,
            subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
            totalMarks: resolvedTotalMarks,
            negativeMarking: resolvedNegativeMarking,
            mcqs:      sanitisedMcqs,
            category:  test.category,
            // Never trust the client academic sections are never shared.
            isShared:  false,
          },
        },
        { new: true, runValidators: false }
      );
    }

    if (!section) {
      section = await Section.create({
        type:      "academic",
        category:  test.category,
        timeLimit: Number(timeLimit),
        totalMCQs: resolvedTotalMCQs,
        subjectBreakdown: sanitiseSubjectBreakdown(subjectBreakdown),
        totalMarks: resolvedTotalMarks,
        negativeMarking: resolvedNegativeMarking,
        mcqs:      sanitisedMcqs,
        // Force false regardless of anything the client might send.
        isShared:  false,
      });

      await Test.findByIdAndUpdate(testId, {
        "sections.academic.sectionRef": section._id,
      });
    }

    return res.status(200).json({
      sectionId: section._id,
      savedAt:   section.updatedAt,
    });
  } catch (err) {
    console.error("POST /api/admin/sections/academic/draft error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── GET /api/admin/sections/academic/:testId ──────────────────
//
// Returns the existing draft academic section for a test (for resume).
//
// Response: { section: { sectionId, timeLimit, totalMCQs, mcqs[] } } | { section: null }
router.get("/sections/academic/:testId", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await Test.findById(testId).select("sections");
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    const sectionRef = test.sections.academic.sectionRef;
    if (!sectionRef) return res.status(200).json({ section: null });

    const section = await Section.findById(sectionRef);
    if (!section)   return res.status(200).json({ section: null });

    return res.status(200).json({
      section: {
        sectionId:  section._id,
        timeLimit:  section.timeLimit,
        totalMCQs:  section.totalMCQs,
        subjectBreakdown: section.subjectBreakdown || [],
        totalMarks: typeof section.totalMarks === "number" ? section.totalMarks : 100,
        negativeMarking: section.negativeMarking || { enabled: false, marksPerWrong: 0 },
        mcqs:       section.mcqs.map((m) => ({
          _id:          m._id,
          question:     m.question,
          options:      m.options,
          correctIndex: m.correctIndex,
          explanation:  m.explanation,
        })),
        updatedAt: section.updatedAt,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/sections/academic/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── POST /api/admin/sections/academic/save/:testId ────────────
//
// Finalises the academic section for a test:
//   1. Validates all MCQs are complete (question + options + correctIndex)
//   2. Marks the Section as isDraft:false and isShared:false (always  
//      academic content is exclusive to its own category, even for the
//      default military categories which DO share verbal/non-verbal).
//   3. Sets test.sections.academic.status = 'complete'
//   4. Checks whether all three sections are now complete if so,
//      automatically publishes the test (test.isPublished = true) and
//      increments the owning category's testCount.
//
// No sharing/transaction-across-categories logic runs here at all.
//
// Response: 200 { message, published: boolean }
router.post("/sections/academic/save/:testId", verifyAdmin, async (req, res) => {
  const { testId } = req.params;

  if (!testId.match(/^[a-f\d]{24}$/i)) {
    return res.status(400).json({ message: "Invalid test ID format." });
  }

  const test = await Test.findById(testId).populate("category");
  if (!test) {
    return res.status(404).json({ message: "Test not found." });
  }

  const sectionRef = test.sections.academic.sectionRef;
  if (!sectionRef) {
    return res.status(400).json({ message: "No academic section draft found. Please save a draft first." });
  }

  const section = await Section.findById(sectionRef);
  if (!section) {
    return res.status(400).json({ message: "Academic section draft not found in database." });
  }

  // ── Validate completeness ─────────────────────────────────
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
      return res.status(400).json({ message: `MCQ #${num} has an empty question.` });
    }

    if (
      !Array.isArray(mcq.options) ||
      mcq.options.length !== 4 ||
      mcq.options.some((o) => !o || o.trim().length === 0)
    ) {
      return res.status(400).json({ message: `MCQ #${num} has an empty answer option.` });
    }

    if (
      typeof mcq.correctIndex !== "number" ||
      mcq.correctIndex < 0 ||
      mcq.correctIndex > 3
    ) {
      return res.status(400).json({ message: `All MCQs must have a correct answer selected. MCQ #${num} is missing a correct answer.` });
    }
  }

  const mongoSession = await mongoose.startSession();
  let justPublished = false;

  try {
    await mongoSession.withTransaction(async () => {
      // Academic sections are NEVER shared regardless of category type.
      section.isDraft  = false;
      section.isShared = false;
      await section.save({ session: mongoSession });

      // Academic content is always per-category only this test is touched.
      test.sections.academic.sectionRef = section._id;
      test.sections.academic.status     = "complete";

      const allComplete =
        test.sections.verbal.status    === "complete" &&
        test.sections.nonVerbal.status === "complete" &&
        test.sections.academic.status  === "complete";

      if (allComplete && !test.isPublished) {
        test.isPublished = true;
        justPublished     = true;
      }

      await test.save({ session: mongoSession });

      if (justPublished && test.category) {
        await Category.findByIdAndUpdate(
          test.category._id,
          { $inc: { testCount: 1 } },
          { session: mongoSession }
        );
      }
    });
  } catch (err) {
    await mongoSession.endSession();
    console.error("POST /api/admin/sections/academic/save/:testId error:", err.message);
    return res.status(500).json({ message: "Failed to save academic section. Please try again." });
  }

  await mongoSession.endSession();

  return res.status(200).json({
    message: justPublished
      ? "Academic section saved. Test is now published and visible to users."
      : "Academic section saved.",
    published: justPublished,
  });
});



// ── GET /api/admin/tests/:testId/full ─────────────────────────
// Returns a fully populated test with all section MCQs for admin preview.
router.get("/tests/:testId/full", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    const test = await Test.findById(testId)
      .populate("sections.verbal.sectionRef")
      .populate("sections.nonVerbal.sectionRef")
      .populate("sections.academic.sectionRef")
      .populate("category", "name slug")
      .lean();

    if (!test) return res.status(404).json({ message: "Test not found." });

    function shapeSection(slot) {
      const ref = slot?.sectionRef || null;
      return {
        status:    slot?.status ?? "pending",
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
    console.error("GET /api/admin/tests/:testId/full error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── DELETE /api/admin/tests/:testId ───────────────────────────
//
// Deletes a test with full cleanup:
//   1. For each section (verbal, nonVerbal, academic):
//      - isShared + other tests still reference it → unlink only (skip delete)
//      - isShared + last referencing test → delete section + Cloudinary images
//      - not shared → delete section + Cloudinary images
//   2. Cloudinary cleanup uses Promise.allSettled so one failed destroy
//      does not abort the overall deletion.
//   3. Deletes the Test document.
//   4. Decrements category.testCount by 1 (only if test was published).
//
// Response: 200 { message, imagesDeleted: N }
router.delete("/tests/:testId", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    let imagesDeleted    = 0;
    const cloudinaryFailed = [];

    // ── Delete Cloudinary images for a nonVerbal section ──────
    const deleteCloudinaryImages = async (section) => {
      if (!section || section.type !== "nonVerbal") return;
      const publicIds = section.mcqs.map((m) => m.imagePublicId).filter(Boolean);
      if (publicIds.length === 0) return;

      const results = await Promise.allSettled(
        publicIds.map((id) => cloudinary.uploader.destroy(id))
      );

      results.forEach((r, i) => {
        if (r.status === "fulfilled") {
          imagesDeleted++;
        } else {
          cloudinaryFailed.push(publicIds[i]);
          console.error(
            `DELETE /api/admin/tests/:testId Cloudinary destroy failed for "${publicIds[i]}":`,
            r.reason?.message || r.reason
          );
        }
      });
    };

    // ── Handle one section slot ───────────────────────────────
    const handleSection = async (sectionRef, slotType) => {
      if (!sectionRef) return;

      const section = await Section.findById(sectionRef);
      if (!section) return;

      if (section.isShared) {
        // Count other tests still pointing at this section
        const refField   = `sections.${slotType}.sectionRef`;
        const otherCount = await Test.countDocuments({
          _id:       { $ne: testId },
          [refField]: section._id,
        });

        if (otherCount > 0) {
          // Other tests still use it only unlink, never delete
          return;
        }
        // Last test using it fall through to full delete
      }

      await deleteCloudinaryImages(section);
      await Section.findByIdAndDelete(section._id);
    };

    await Promise.all([
      handleSection(test.sections.verbal.sectionRef,    "verbal"),
      handleSection(test.sections.nonVerbal.sectionRef, "nonVerbal"),
      handleSection(test.sections.academic.sectionRef,  "academic"),
    ]);

    // ── Standalone (custom category) tests: delete their MCQ docs too ──
    // These tests store MCQs in the separate Mcq collection, not in Section.
    if (test.isStandalone) {
      await Mcq.deleteMany({ testId: test._id, testModel: "Test" });
    }

    // ── Delete the Test document ──────────────────────────────
    const wasPublished = test.isPublished;
    await Test.findByIdAndDelete(testId);

    // ── Decrement category testCount ──────────────────────────
    // Only default-category tests increment Category.testCount on publish;
    // standalone custom tests never touch it (see publishTest), so skip here too.
    if (!test.isStandalone && wasPublished && test.category) {
      await Category.findByIdAndUpdate(test.category, {
        $inc: { testCount: -1 },
      });
    }

    return res.status(200).json({
      message: cloudinaryFailed.length > 0
        ? "Test deleted (some images may need manual cleanup)"
        : "Test deleted",
      imagesDeleted,
      ...(cloudinaryFailed.length > 0 && { failedImageIds: cloudinaryFailed }),
    });
  } catch (err) {
    console.error("DELETE /api/admin/tests/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

// ── DELETE /api/admin/sections/draft/:testId ──────────────────
//
// Prompt 10 "start over" helper.
// Deletes all draft (isDraft: true) sections for a test and resets
// the test's section statuses back to 'pending'.
//
// Only sections that are STILL drafts are deleted any section that
// has already been finalised (isDraft: false) is left untouched so the
// admin cannot accidentally wipe completed work by hitting this route
// on a partially-published test.
//
// Cloudinary images for deleted non-verbal draft sections are cleaned up
// with Promise.allSettled (same pattern as the test-delete route).
//
// Response: 200 { message, deletedSections: ['verbal'|'nonVerbal'|'academic', ...] }
router.delete("/sections/draft/:testId", verifyAdmin, async (req, res) => {
  try {
    const { testId } = req.params;

    if (!testId.match(/^[a-f\d]{24}$/i)) {
      return res.status(400).json({ message: "Invalid test ID format." });
    }

    const test = await Test.findById(testId);
    if (!test) {
      return res.status(404).json({ message: "Test not found." });
    }

    if (test.isPublished) {
      return res
        .status(400)
        .json({ message: "Cannot reset a published test. Create a new test instead." });
    }

    const deletedSections = [];

    const resetSlot = async (slotKey, sectionRefPath) => {
      const sectionId = test.sections[slotKey]?.sectionRef;
      if (!sectionId) return;

      const section = await Section.findById(sectionId);
      if (!section || !section.isDraft) {
        // Already finalised do not touch it
        return;
      }

      // Clean up Cloudinary images for non-verbal drafts
      if (section.type === "nonVerbal") {
        const publicIds = section.mcqs.map((m) => m.imagePublicId).filter(Boolean);
        if (publicIds.length > 0) {
          await Promise.allSettled(
            publicIds.map((id) => cloudinary.uploader.destroy(id))
          );
        }
      }

      await Section.findByIdAndDelete(sectionId);
      deletedSections.push(slotKey);

      // Reset the slot on the test document
      test.sections[slotKey].sectionRef = undefined;
      test.sections[slotKey].status     = "pending";
    };

    await Promise.all([
      resetSlot("verbal",    "sections.verbal.sectionRef"),
      resetSlot("nonVerbal", "sections.nonVerbal.sectionRef"),
      resetSlot("academic",  "sections.academic.sectionRef"),
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
    console.error("DELETE /api/admin/sections/draft/:testId error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;



