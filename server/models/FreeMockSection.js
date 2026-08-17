/**
 * models/FreeMockSection.js  (Part 5 Prompt 01)
 *
 * FreeMockSection stores the MCQs for one section of a Free Mock Test.
 *
 * KEY RULE NO SHARING:
 *   isShared is always false. The server enforces this regardless of what
 *   the client sends. Every Free Mock Test category gets its own independent
 *   section documents.
 *
 * Fields mirror Section.js from Part 4 but with the sharing concept removed.
 */

import mongoose from "mongoose";
import { cleanOptionsArray, cleanOptionLabelsDeep } from "../utils/optionLabelCleaner.js";

const { Schema, model } = mongoose;

// ── MCQ sub-schema (reuses the same shape as Part 4 Section) ──
const mcqSchema = new Schema(
  {
    question:      { type: String, trim: true, default: "" },
    options:       { type: [String], required: true },
    correctIndex:  { type: Number, required: true },      // 0-based index
    explanation:   { type: String, trim: true, default: "" },
    imageUrl:      { type: String, default: "" },         // Cloudinary URL
    imagePublicId: { type: String, default: "" },          // Cloudinary public_id needed for destroy() on delete (Prompt 09)
  },
  { _id: true }
);

// ── Subject breakdown sub-schema (see Section.js for details) ──
const subjectBreakdownSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

// ── FreeMockSection schema ────────────────────────────────────
const freeMockSectionSchema = new Schema(
  {
    type: {
      type:     String,
      enum:     ["verbal", "nonVerbal", "academic"],
      required: true,
    },

    // Which FreeMockTest this section belongs to unique upsert key per test
    // so multiple tests in the same category never collide on draft saves.
    testRef: {
      type:  Schema.Types.ObjectId,
      ref:   "FreeMockTest",
      index: true,
    },

    // Always set Free Mock Sections are never shared
    category: {
      type:     Schema.Types.ObjectId,
      ref:      "Category",
      required: true,
    },

    timeLimit:  { type: Number, required: true },   // seconds
    totalMCQs:  { type: Number, required: true },
    subjectBreakdown: { type: [subjectBreakdownSchema], default: [] },

    // Total marks for this section (editable, default 100). Each MCQ is
    // worth (totalMarks / totalMCQs) marks.
    totalMarks: { type: Number, default: 100, min: 1 },

    // Negative marking: when enabled, deducts marksPerWrong per wrong
    // (attempted) answer. Unanswered questions are never penalised.
    negativeMarking: {
      enabled:       { type: Boolean, default: false },
      marksPerWrong: { type: Number, default: 0, min: 0 },
    },

    mcqs:       { type: [mcqSchema], default: [] },

    // Always false enforced server-side, client value ignored
    isShared:   { type: Boolean, default: false },

    isDraft:    { type: Boolean, default: true },
  },
  { timestamps: true }
);

// ── Pre-save hook: enforce isShared = false always ────────────
// Mongoose 7+ removed callback-style ("next()") middleware hooks
// must now be synchronous (just return) or async (return a Promise).
freeMockSectionSchema.pre("save", function () {
  this.isShared = false;

  // Strip any "A) "/"B."/"C -"/"D:" style label baked into imported option
  // text — the UI already renders its own A/B/C/D labels. See
  // utils/optionLabelCleaner.js for details.
  if (Array.isArray(this.mcqs)) {
    this.mcqs.forEach((mcq) => {
      if (Array.isArray(mcq.options)) {
        mcq.options = cleanOptionsArray(mcq.options);
      }
    });
  }
});

// Also clean on every read (including .lean() queries, which most read
// routes use), so sections saved months ago under the old format display
// correctly without needing a DB migration.
freeMockSectionSchema.post(/^find/, function (result) {
  cleanOptionLabelsDeep(result);
});

export default model("FreeMockSection", freeMockSectionSchema);