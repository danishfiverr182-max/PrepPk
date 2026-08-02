/**
 * models/FreeCustomTest.js
 *
 * Stores free (no-login-required) tests for custom categories.
 * These follow the same group → test structure as premium custom tests
 * but have no access gate   anyone can take them.
 *
 * Unlike the standard FreeMockTest (3-section verbal/nonVerbal/academic),
 * a FreeCustomTest is a standalone single-section test with its own MCQ array,
 * exactly mirroring the premium Test model (isStandalone: true).
 *
 * Hierarchy:
 *   Category → TestGroup → FreeCustomTest
 *
 * A TestGroup can have BOTH premium Tests AND FreeCustomTests.
 * The admin decides when creating whether a test is premium or free.
 */

import mongoose from "mongoose";

const { Schema, model } = mongoose;

// ── Subject breakdown sub-schema (see Test.js for details) ──
const subjectBreakdownSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

const freeCustomTestSchema = new Schema(
  {
    // The Category this test belongs to (denormalized from TestGroup for fast lookups)
    category: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: true,
    },

    // The TestGroup this test belongs to
    groupId: {
      type: Schema.Types.ObjectId,
      ref: "TestGroup",
      required: true,
    },

    // Denormalized for fast slug lookups without joining
    groupSlug: { type: String, required: true },
    categorySlug: { type: String, required: true },

    // Auto-incremented per group via TestGroup.freeTestCount
    testNumber: { type: Number, required: true, min: 1 },

    // Test settings set by admin before adding MCQs
    timeLimitSeconds: { type: Number, default: null },
    totalMcqs: { type: Number, default: null },
    passMarkPercentage: { type: Number, default: 80 },

    // Admin-entered subject % breakdown, shown on the user's Start Test popup.
    subjectBreakdown: { type: [subjectBreakdownSchema], default: [] },

    // Total marks for this test (editable, default 100). Each MCQ is
    // worth (totalMarks / totalMcqs) marks.
    totalMarks: { type: Number, default: 100, min: 1 },

    // Negative marking: when enabled, deducts marksPerWrong per wrong
    // (attempted) answer. Unanswered questions are never penalised.
    negativeMarking: {
      enabled:       { type: Boolean, default: false },
      marksPerWrong: { type: Number, default: 0, min: 0 },
    },

    // Prompt 13 — explicit flags (always true/true for this model, but kept
    // literal on the document so admin tooling and queries don't have to
    // infer them from "which collection is this").
    isFree:       { type: Boolean, default: true },
    isStandalone: { type: Boolean, default: true },

    // MCQs used to be stored directly (same as standalone premium Test).
    // As of the MCQ storage refactor, MCQs live in their own collection
    // (see models/Mcq.js, linked via testId/testModel). `mcqCount` is a
    // denormalized counter kept in sync by the app layer.
    mcqCount: { type: Number, default: 0 },

    // "settings_pending" until timer+MCQ count saved, then "mcqs_pending"
    // while MCQs are being added, "published" once live. "in_progress" is
    // kept for back-compat with the legacy /test-groups/:groupId/free-tests
    // creation path.
    status: {
      type: String,
      enum: ["settings_pending", "mcqs_pending", "in_progress", "published"],
      default: "settings_pending",
    },
  },
  { timestamps: true }
);

// Unique testNumber per group for free tests
freeCustomTestSchema.index(
  { groupId: 1, testNumber: 1 },
  { unique: true, name: "unique_free_test_number_per_group" }
);

freeCustomTestSchema.index({ groupId: 1, status: 1 });
freeCustomTestSchema.index({ category: 1, status: 1 });
freeCustomTestSchema.index({ categorySlug: 1, status: 1 });

const FreeCustomTest = model("FreeCustomTest", freeCustomTestSchema);
export default FreeCustomTest;