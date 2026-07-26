/**
 * models/TestGroup.js
 *
 * A named collection of tests within a custom category.
 * Sits between Category and Test in the 3-level hierarchy:
 *   Category → TestGroup → Test
 *
 * Only used by custom categories (isDefault: false).
 * Default categories (Army, Navy, Air Force) never have TestGroups.
 */

import mongoose from "mongoose";

const { Schema } = mongoose;

const testGroupSchema = new Schema(
  {
    // Human-readable group name typed by the admin. E.g. "SSC Teaching"
    name: {
      type: String,
      required: [true, "name is required"],
      trim: true,
    },

    // URL-safe version of name. Auto-generated from name on creation.
    // E.g. "SSC Teaching" → "ssc-teaching"
    slug: {
      type: String,
      required: [true, "slug is required"],
      lowercase: true,
    },

    // The category this group belongs to
    categoryId: {
      type: Schema.Types.ObjectId,
      ref: "Category",
      required: [true, "categoryId is required"],
    },

    // Stored for fast lookups without joining Category collection
    categorySlug: {
      type: String,
      required: [true, "categorySlug is required"],
      lowercase: true,
    },

    // Tracks how many tests have been created in this group.
    // Incremented on each test creation; used for auto-numbering.
    testCount: {
      type: Number,
      default: 0,
    },

    // Tracks how many FREE tests have been created in this group (auto-numbering).
    freeTestCount: {
      type: Number,
      default: 0,
    },

    // Count of published free tests (for admin display).
    publishedFreeTestCount: {
      type: Number,
      default: 0,
    },

    // Optional short description of what this group covers
    description: {
      type: String,
      default: "",
    },

    // Admin-authored HTML blog content for this group's public page section.
    // Shown on the user-facing category page when this specific group is selected.
    blogContent: {
      type: String,
      default: "",
    },

    // ── SEO fields (matches Category's seoTitle/seoDescription pattern) ──
    // Admin-written <title> tag for this group's own public page
    // (GET /category/:categorySlug/:groupSlug), shown in Google search results.
    seoTitle: {
      type: String,
      default: "",
    },
    // Admin-written meta description shown under the title in search results.
    seoDescription: {
      type: String,
      default: "",
    },

    // Controls display order of groups within a category
    order: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

// Compound unique index: a slug must be unique within a category
testGroupSchema.index({ categoryId: 1, slug: 1 }, { unique: true });

// Index for category lookups
testGroupSchema.index({ categoryId: 1, order: 1, createdAt: 1 });
testGroupSchema.index({ categorySlug: 1 });

const TestGroup = mongoose.model("TestGroup", testGroupSchema);
export default TestGroup;
