/**
 * models/BlogPost.js
 *
 * Standalone admin-authored blog, fully decoupled from the
 * Category → TestGroup → Test hierarchy. Content here doesn't have to
 * attach to any specific exam category — relatedCategorySlug is an
 * optional soft link only, used for an internal-link CTA block on the
 * public post page (built separately).
 *
 * Admin-authored only — there is no public submission path, so
 * `content` (HTML) is safe to render with dangerouslySetInnerHTML on
 * the frontend, same trust model as Category.blogContent / TestGroup.blogContent.
 */

import mongoose from "mongoose";
import { computeReadTimeMinutes } from "../utils/wordCount.js";

const { Schema } = mongoose;

const blogPostSchema = new Schema(
  {
    title: {
      type: String,
      required: [true, "title is required"],
      trim: true,
    },

    // URL-safe, unique across all posts. Auto-generated from title on
    // creation (see controllers/blogController.js), auto-deduplicated
    // with a -2/-3/... suffix rather than erroring on collision.
    slug: {
      type: String,
      required: [true, "slug is required"],
      unique: true,
      lowercase: true,
      index: true,
    },

    // Short summary shown on the /blog listing page. Also used as the
    // meta-description fallback when seoDescription is empty.
    excerpt: {
      type: String,
      default: "",
    },

    // Admin-authored HTML body.
    content: {
      type: String,
      default: "",
    },

    coverImageUrl: {
      type: String,
      default: "",
    },

    // Cloudinary public_id for the cover image, needed to clean up the
    // asset on delete/replace (same pattern as Category.imagePublicId).
    coverImagePublicId: {
      type: String,
      default: "",
    },

    // Falls back to `title` on the frontend when empty.
    seoTitle: {
      type: String,
      default: "",
    },

    // Falls back to `excerpt` on the frontend when empty.
    seoDescription: {
      type: String,
      default: "",
    },

    tags: {
      type: [String],
      default: [],
    },

    // Optional display-only fields for the byline/category shown above
    // the article (used by the Medium-style reading theme). Entirely
    // optional — existing posts with none of these set just fall back
    // to sensible defaults on the frontend, so no backfill is required.
    authorName: {
      type: String,
      default: "",
    },
    authorAvatarUrl: {
      type: String,
      default: "",
    },
    authorBio: {
      type: String,
      default: "",
    },
    // Single display category (distinct from `tags`), e.g. "Career Tips".
    // Purely cosmetic — does not affect relatedCategorySlug's CTA link.
    category: {
      type: String,
      default: "",
    },

    // Optional soft link to a Category (by slug, not a ref/ObjectId   this
    // blog is intentionally decoupled from the Category/TestGroup
    // hierarchy). Used to render an internal-link CTA block on the
    // public post pointing readers at a relevant exam category.
    relatedCategorySlug: {
      type: String,
      default: null,
    },

    status: {
      type: String,
      enum: ["draft", "published"],
      default: "draft",
    },

    // Set the first time status transitions to "published"; never
    // overwritten after that so republishing edits doesn't reset the
    // original publish date (matters for freshness signals and
    // author credibility). See controllers/blogController.js updatePost.
    publishedAt: {
      type: Date,
      default: null,
    },

    viewCount: {
      type: Number,
      default: 0,
    },

    // Computed server-side on save from a plain-text word count of
    // `content` (~200 words/minute, rounded up, minimum 1).
    readTimeMinutes: {
      type: Number,
      default: null,
    },
  },
  { timestamps: true } // createdAt/updatedAt   updatedAt drives sitemap lastmod + a "last updated" note for readers
);

// ── Pre-save hook: keep readTimeMinutes in sync with content ────────
// Plain synchronous function, no `next` callback   Mongoose 7+ (this
// project is on 9.7.2) dropped callback-style middleware, so a hook
// that declares a `next` param and calls it will throw
// "next is not a function" (next is simply undefined now). Hooks just
// run synchronously (or return a Promise for async work) instead.
blogPostSchema.pre("save", function () {
  if (this.isModified("content") || this.isNew) {
    this.readTimeMinutes = computeReadTimeMinutes(this.content);
  }
});

// Sort index for admin listing (sorted by updatedAt desc) and public
// listing filtered by status.
blogPostSchema.index({ updatedAt: -1 });
blogPostSchema.index({ status: 1, publishedAt: -1 });

const BlogPost = mongoose.model("BlogPost", blogPostSchema);
export default BlogPost;
