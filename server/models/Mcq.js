/**
 * models/Mcq.js
 *
 * Stage 1 of the MCQ storage refactor.
 *
 * Previously, MCQs for standalone custom-category tests were embedded
 * directly as arrays on Test.mcqs and FreeCustomTest.mcqs. As those arrays
 * grew, every save on the parent document got slower (the whole array is
 * rewritten to disk on most updates), and very large tests risked bumping
 * into MongoDB's 16MB document-size ceiling.
 *
 * This model gives each MCQ its own document in its own collection.
 * `testId` + `testModel` link it back to the parent (either a `Test` or a
 * `FreeCustomTest`), and `order` preserves the original position for
 * stable, paginated rendering.
 *
 * NOTE (Stage 1 only): this model is additive. The embedded `mcqs` arrays
 * on Test and FreeCustomTest are NOT removed from the database yet — only
 * the schema field is removed from the two models. Controllers/routes are
 * still untouched and will be migrated in a later stage.
 */

import mongoose from "mongoose";
import { cleanOptionsArray, cleanOptionLabelsDeep } from "../utils/optionLabelCleaner.js";

const { Schema, model } = mongoose;

const mcqSchema = new Schema(
  {
    // Which parent document (Test or FreeCustomTest) this MCQ belongs to.
    testId: {
      type: Schema.Types.ObjectId,
      required: [true, "testId is required"],
      index: true,
    },

    // Which model `testId` refers to. Needed because MCQs can belong to
    // either a premium standalone Test or a FreeCustomTest.
    testModel: {
      type: String,
      enum: ["Test", "FreeCustomTest"],
      required: [true, "testModel is required"],
    },

    question: {
      type: String,
      required: [true, "question is required"],
      trim: true,
    },

    // Exactly 4 options, same rule as the previous embedded schema.
    options: {
      type: [String],
      required: [true, "options are required"],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length === 4,
        message: "Each MCQ must have exactly 4 options.",
      },
    },

    // 0-based index into options.
    correctOption: {
      type: Number,
      required: [true, "correctOption is required"],
      min: 0,
      max: 3,
    },

    // Position of this MCQ within the parent test, for stable sequencing
    // once MCQs live in their own collection instead of an array.
    order: {
      type: Number,
      required: [true, "order is required"],
    },
  },
  {
    timestamps: true,
  }
);

// Fast ordered pagination: fetch all MCQs for a test, in order.
mcqSchema.index({ testId: 1, order: 1 });

// ── Option-label cleanup ────────────────────────────────────────
// Same rationale as Section.js / FreeMockSection.js: the UI renders its
// own A/B/C/D labels, so strip any "A) "/"B."/"C -"/"D:" prefix baked into
// imported option text — on save (new/edited MCQs) and on every read,
// including .lean() queries (existing MCQs imported months ago).
mcqSchema.pre("save", function () {
  if (Array.isArray(this.options)) {
    this.options = cleanOptionsArray(this.options);
  }
});

mcqSchema.post(/^find/, function (result) {
  cleanOptionLabelsDeep(result);
});

const Mcq = model("Mcq", mcqSchema);
export default Mcq;