/**
 * models/TestResult.js  (Part 10   Prompt 1)
 *
 * Persists one document for every completed test section.
 *
 * Design decisions:
 *  - userId stores either a Mongoose ObjectId (premium user) or the string
 *    "guest" (free/anonymous test taker).  Using Mixed type so both values
 *    are valid without coercion.
 *  - sectionType uses the same camelCase enum as Section.type ("nonVerbal")
 *    so lookups across collections stay consistent.  The prompt lists
 *    "non-verbal" but all existing models use "nonVerbal".
 *  - answers is stored as an array of { mcqId, selectedOption } objects.
 *    selectedOption is null for unanswered questions (no negative marking  
 *    they just contribute 0 to the score).
 *  - passMarkUsed is denormalised onto the document so future analytics
 *    always know which rule was applied, even if the test type changes later.
 *  - percentage is pre-calculated and stored rather than computed on read
 *    to make sorting/filtering by result cheap.
 *  - timeTaken is in seconds; the frontend stopwatch measures elapsed time.
 *  - submittedAt has a default of Date.now(); timestamps: true also adds
 *    createdAt/updatedAt as a convenience.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

// ── Answer sub-schema ─────────────────────────────────────────────────────────
const answerSchema = new Schema(
  {
    mcqId: {
      type:     Schema.Types.ObjectId,
      required: true,
    },
    // 0-based index into the MCQ's options array.  null means unanswered.
    selectedOption: {
      type:    Number,
      default: null,
    },
  },
  { _id: false }
);

// ── TestResult schema ─────────────────────────────────────────────────────────
const testResultSchema = new Schema(
  {
    // ObjectId for a premium PremiumUser, or the literal string "guest"
    // for a non-logged-in visitor taking a free test.
    userId: {
      type:     Schema.Types.Mixed,
      required: true,
    },

    // The Test document this result belongs to
    testId: {
      type:     Schema.Types.ObjectId,
      ref:      "Test",
      required: true,
      index:    true,
    },

    // Denormalised from Test.category.slug   allows filtering without a join
    categorySlug: {
      type:     String,
      required: true,
      trim:     true,
      index:    true,
    },

    // Which section of the test this result covers.
    // "standalone" is used for single-section custom tests.
    sectionType: {
      type:     String,
      enum:     ["verbal", "nonVerbal", "academic", "standalone"],
      required: true,
    },

    // The user's submitted answers; one entry per MCQ attempted.
    // Unanswered MCQs are represented by selectedOption: null.
    answers: {
      type:    [answerSchema],
      default: [],
    },

    // Scoring fields   all calculated by scoringController before saving
    score:      { type: Number, required: true, min: 0 },
    totalMcqs:  { type: Number, required: true, min: 0 },
    // Marks-based scoring (supports editable totalMarks + negative marking).
    // obtainedMarks may be negative when negative marking is enabled and the
    // learner got more wrong than right, so no min is enforced here.
    totalMarks:    { type: Number, default: 100 },
    obtainedMarks: { type: Number, default: 0 },
    negativeMarkingApplied: { type: Boolean, default: false },
    // percentage is derived from obtainedMarks/totalMarks and can go
    // negative under negative marking, so the lower bound is relaxed.
    percentage: { type: Number, required: true, min: -100, max: 100 },
    passed:     { type: Boolean, required: true },

    // Either 50 (3-section test) or 80 (standalone test)
    passMarkUsed: { type: Number, required: true, enum: [50, 80] },

    // Seconds elapsed from section start to submission (0 if not tracked)
    timeTaken: { type: Number, default: 0 },

    // Explicit submittedAt in addition to timestamps.createdAt for clarity
    submittedAt: { type: Date, default: Date.now },
  },
  {
    timestamps: true,
  }
);

// Compound index: most common query shape is "latest result for a user+test+section"
testResultSchema.index({ userId: 1, testId: 1, sectionType: 1, submittedAt: -1 });

const TestResult = mongoose.model("TestResult", testResultSchema);
export default TestResult;
