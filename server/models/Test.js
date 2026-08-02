/**
 * models/Test.js  (updated   custom category support)
 *
 * Represents a single mock test belonging to a Category.
 *
 * Key design decisions:
 *   - testNumber is auto-incremented per category (not globally).
 *     The application layer (route/service) is responsible for computing
 *     the next testNumber before saving. A compound unique index enforces
 *     uniqueness at the DB level.
 *   - Each test tracks three sections independently: verbal, nonVerbal, academic.
 *     Each section slot holds a status ('pending' | 'complete') and an optional
 *     ref to the Section document once that section has been created.
 *   - isPublished defaults to false   tests are draft until explicitly published.
 *
 * New fields for custom categories:
 *   - groupId / groupSlug: link to the TestGroup this test belongs to.
 *     NULL for default category tests (Army, Navy, Air Force).
 *   - testNumber: reused field   for grouped tests it is auto-assigned
 *     per group (not per category).
 *   - isStandalone: true for custom category tests (single section, no split).
 *   - passMarkPercentage: 50 for default tests, 80 for standalone custom tests.
 *   - timeLimitSeconds / totalMcqs: used by standalone custom tests only.
 *   - status: "in_progress" | "published"   replaces isPublished for grouped tests.
 *
 * Compound unique index: { category, testNumber }
 *   Ensures test numbers are unique per category (e.g. Army Test 1, Army Test 2)
 *   but the same testNumber can exist in different categories.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Section slot sub-schema ───────────────────────────────────
// Reused for verbal, nonVerbal, and academic slots.
const sectionSlotSchema = new Schema(
  {
    status: {
      type: String,
      enum: ["pending", "complete"],
      default: "pending",
    },
    // Null until the section is actually created by the admin.
    sectionRef: {
      type: Schema.Types.ObjectId,
      ref: "Section",
      default: null,
    },
  },
  { _id: false } // no separate _id for sub-docs
);

// ── Subject breakdown sub-schema ─────────────────────────────
// Admin-entered breakdown of what subjects make up a standalone test,
// e.g. [{ subject: "Math", percentage: 40 }, { subject: "English", percentage: 60 }].
// Purely informational, shown on the user's Start Test popup.
const subjectBreakdownSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

// ── Test schema ───────────────────────────────────────────────
const testSchema = new Schema(
  {
    // Which category this test belongs to
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "category is required"],
    },

    // Sequential number within the category set by the application layer.
    // Compound unique index below ensures (category, testNumber) is unique.
    testNumber: {
      type: Number,
      required: [true, "testNumber is required"],
      min: [1, "testNumber must be at least 1"],
    },

    // Three section slots   each starts pending with no sectionRef.
    // Only used by default category tests (isStandalone: false).
    sections: {
      verbal:    { type: sectionSlotSchema, default: () => ({}) },
      nonVerbal: { type: sectionSlotSchema, default: () => ({}) },
      academic:  { type: sectionSlotSchema, default: () => ({}) },
    },

    // Draft until the admin explicitly publishes.
    // Used by default category tests. Custom category tests use `status` field.
    isPublished: {
      type: Boolean,
      default: false,
    },

    // ── Custom category fields (null for default category tests) ──────────

    // Reference to the TestGroup this test belongs to.
    // NULL for default category tests (Army, Navy, Air Force).
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "TestGroup",
      default: null,
    },

    // Stored alongside groupId for fast lookups without joining TestGroup.
    // E.g. "ssc-teaching". NULL for default category tests.
    groupSlug: {
      type: String,
      default: null,
    },

    // true for custom category tests (single section, no Verbal/NonVerbal/Academic split).
    // false for default category tests (Army, Navy, Air Force).
    isStandalone: {
      type: Boolean,
      default: false,
    },

    // Pass mark percentage. 50 for default 3-section tests, 80 for standalone tests.
    // Set automatically by the backend on creation based on isStandalone.
    passMarkPercentage: {
      type: Number,
      default: 50,
    },

    // Time limit in seconds for standalone custom category tests.
    // Not used by default category tests.
    timeLimitSeconds: {
      type: Number,
      default: null,
    },

    // Total expected MCQ count for standalone custom category tests.
    // Not used by default category tests.
    totalMcqs: {
      type: Number,
      default: null,
    },

    // Admin-entered subject % breakdown for standalone custom tests
    // (see subjectBreakdownSchema above). Not used by default category tests.
    subjectBreakdown: {
      type: [subjectBreakdownSchema],
      default: [],
    },

    // Total marks for standalone custom tests (editable, default 100).
    // Each MCQ is worth (totalMarks / totalMcqs) marks. Not used by
    // default category tests (those set totalMarks per-section instead).
    totalMarks: {
      type: Number,
      default: 100,
      min: 1,
    },

    // Negative marking for standalone custom tests. When enabled, each
    // wrong (attempted) answer deducts marksPerWrong marks. Unanswered
    // questions are never penalised.
    negativeMarking: {
      enabled:       { type: Boolean, default: false },
      marksPerWrong: { type: Number, default: 0, min: 0 },
    },

    // Lifecycle status for standalone custom category tests.
    // "settings_pending" = just created, timer/MCQ count not yet set.
    // "mcqs_pending"     = settings saved, MCQs being added.
    // "in_progress"      = legacy alias for mcqs_pending (kept for backward compat).
    // "published"        = live to users.
    // Default category tests use isPublished instead; status stays null.
    status: {
      type: String,
      enum: ["settings_pending", "mcqs_pending", "in_progress", "published"],
      default: null,
    },

    // ── MCQ storage for standalone custom category tests ──────────
    // Default category tests store MCQs in the Section model.
    // Standalone tests used to embed MCQs directly on the Test document
    // (see the `mcqs` array). As of the MCQ storage refactor, MCQs live in
    // their own collection (see models/Mcq.js, linked via testId/testModel).
    // `mcqCount` is a denormalized counter kept in sync by the app layer so
    // list views don't need to query the Mcq collection just to show a count.
    mcqCount: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true, // adds createdAt and updatedAt
  }
);

// ── Compound unique index: one testNumber per category ──────────
// This enforces uniqueness for DEFAULT category tests (Army, Navy, Air Force).
// For standalone (custom) tests, uniqueness is enforced per groupId instead
// via the partial index below.
// Partial index for DEFAULT tests only (isStandalone false OR missing).
// MongoDB partial filters only support equality, $exists, $type, $and, $or.
// We use { isStandalone: { $exists: false } } OR { isStandalone: false }
// by creating TWO indexes that together cover both cases, OR we simply
// drop uniqueness enforcement here and rely on the groupId index for customs.
// Simplest correct approach: use { groupId: null } to match only default tests
// since default tests never have a groupId.
testSchema.index(
  { category: 1, testNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { groupId: null },
    name: "unique_testNumber_per_category_default",
  }
);

// Unique testNumber per group for CUSTOM (standalone) tests.
testSchema.index(
  { groupId: 1, testNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { isStandalone: true },
    name: "unique_testNumber_per_group_standalone",
  }
);

// ── Single-field indexes for common queries ───────────────────
testSchema.index({ category: 1 });    // fetch all tests for a category
testSchema.index({ isPublished: 1 }); // filter published tests for the public site

const Test = mongoose.model("Test", testSchema);
export default Test;