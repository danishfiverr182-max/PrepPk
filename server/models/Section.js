/**
 * models/Section.js  (Part 4 Prompt 05)
 *
 * Represents one section (Verbal, Non-Verbal, or Academic) of a mock test.
 *
 * Changes in Prompt 05:
 *   - MCQ sub-schema gains imageUrl and imagePublicId fields for
 *     Non-Verbal MCQ image storage (Cloudinary).
 *   - question is no longer required at the schema level Non-Verbal MCQs
 *     may have an image with no text.  Completeness is enforced at the
 *     application layer (save endpoint).
 *   - isDraft field added (Prompt 04).
 */

import mongoose from "mongoose";
import { cleanOptionsArray, cleanOptionLabelsDeep } from "../utils/optionLabelCleaner.js";

const { Schema } = mongoose;

// ── MCQ sub-schema ────────────────────────────────────────────
const mcqSchema = new Schema(
  {
    // Optional for non-verbal MCQs (image may replace question text)
    question: {
      type:    String,
      default: "",
      trim:    true,
    },
    options: {
      type: [String],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length >= 2 && arr.length <= 6,
        message:   "An MCQ must have between 2 and 6 options.",
      },
    },
    // Zero-based index into the options array
    correctIndex: {
      type: Number,
      min:  0,
    },
    // Optional explanation shown after the test
    explanation: {
      type:    String,
      default: "",
    },
    // ── Non-Verbal image fields (Prompt 05) ──────────────────
    // Cloudinary secure_url stored here; empty string for verbal MCQs
    imageUrl: {
      type:    String,
      default: "",
    },
    // Cloudinary public_id needed for deletion / transformation later
    imagePublicId: {
      type:    String,
      default: "",
    },
  },
  { _id: true }
);

// ── Subject breakdown sub-schema ─────────────────────────────
// Admin-entered breakdown of what subjects make up this section, e.g.
// [{ subject: "Math", percentage: 40 }, { subject: "English", percentage: 60 }].
// Purely informational — shown to the user on the Start Test popup so
// they know the mix before committing. Not validated to sum to 100 at
// the schema level (enforced softly in the UI instead).
const subjectBreakdownSchema = new Schema(
  {
    subject: { type: String, required: true, trim: true },
    percentage: { type: Number, required: true, min: 0, max: 100 },
  },
  { _id: false }
);

// ── Section schema ────────────────────────────────────────────
const sectionSchema = new Schema(
  {
    type: {
      type: String,
      enum: {
        values:  ["verbal", "nonVerbal", "academic"],
        message: "type must be one of: verbal, nonVerbal, academic",
      },
      required: [true, "section type is required"],
    },

    // Null for shared verbal/nonVerbal sections; owning category ObjectId
    // for academic sections and category-specific verbal/nonVerbal.
    category: {
      type:    Schema.Types.ObjectId,
      ref:     "Category",
      default: null,
    },

    // Duration in seconds (e.g. 600 = 10 min, 1200 = 20 min)
    timeLimit: {
      type:     Number,
      required: [true, "timeLimit (in seconds) is required"],
      min:      [60, "timeLimit must be at least 60 seconds"],
    },

    // Total number of MCQs expected in this section.
    totalMCQs: {
      type:     Number,
      required: [true, "totalMCQs is required"],
      min:      [1, "totalMCQs must be at least 1"],
    },

    // Admin-entered subject % breakdown for this section (see above).
    subjectBreakdown: {
      type:    [subjectBreakdownSchema],
      default: [],
    },

    // Total marks for this section. Editable by admin — no longer hardcoded
    // to 100 in scoring. Each MCQ is worth (totalMarks / totalMCQs) marks.
    totalMarks: {
      type:    Number,
      default: 100,
      min:     [1, "totalMarks must be at least 1"],
    },

    // Negative marking configuration. When enabled, each wrong (attempted)
    // answer deducts marksPerWrong marks from the score. Unanswered
    // questions are never penalised.
    negativeMarking: {
      enabled:       { type: Boolean, default: false },
      marksPerWrong: { type: Number, default: 0, min: [0, "marksPerWrong cannot be negative"] },
    },

    // The actual MCQ array
    mcqs: {
      type:    [mcqSchema],
      default: [],
    },

    // true  → shared verbal/nonVerbal pool across Army, Navy, Air Force
    // false → belongs exclusively to one category/test
    isShared: {
      type:    Boolean,
      default: false,
    },

    // true  → still being edited (draft)
    // false → finalised via the save endpoint
    isDraft: {
      type:    Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// ── Option-label cleanup ────────────────────────────────────────
// The test UI renders its own A/B/C/D labels, so any "A) ", "B.", "C -",
// "D:" style prefix baked into imported option text would show up
// duplicated. Cleaning on save keeps newly-saved data tidy at rest, and
// cleaning on every find/findOne (including .lean() queries, which most
// read routes use) means MCQs imported/stored months ago under the old
// format are shown correctly too, with no DB migration required.
sectionSchema.pre("save", function () {
  if (Array.isArray(this.mcqs)) {
    this.mcqs.forEach((mcq) => {
      if (Array.isArray(mcq.options)) {
        mcq.options = cleanOptionsArray(mcq.options);
      }
    });
  }
});

sectionSchema.post(/^find/, function (result) {
  cleanOptionLabelsDeep(result);
});

// ── Indexes ───────────────────────────────────────────────────
sectionSchema.index({ category: 1, type: 1 });
sectionSchema.index({ isShared: 1, type: 1 });

const Section = mongoose.model("Section", sectionSchema);
export default Section;
