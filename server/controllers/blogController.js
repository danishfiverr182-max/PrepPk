/**
 * controllers/blogController.js
 *
 * Standalone admin-authored blog, fully decoupled from the
 * Category/TestGroup/Test hierarchy.
 *
 * createPost          admin: create a draft post, auto-slugged + deduped
 * listPostsAdmin      admin: paginated list, any status, optional ?status= filter
 * getPostAdmin        admin: fetch one post (all fields) for editing
 * updatePost          admin: edit any field; handles publishedAt + slug re-dedup
 * deletePost          admin: cleans up Cloudinary cover image, then deletes the doc
 * uploadCoverImage    admin: multer + Cloudinary, folder "blog-covers"
 * uploadContentImage  admin: multer + Cloudinary, folder "blog-content"
 *
 * listPostsPublic     public: paginated, status: "published" only, listing-card fields
 * getPostPublic       public: single post by slug, status: "published" only, increments viewCount
 */

import BlogPost from "../models/BlogPost.js";
import cloudinary from "../config/cloudinary.js";
import { generateSlug } from "../utils/slugify.js";

// ── Utility: generate a slug guaranteed to be unique ─────────────
// Appends -2, -3, ... until a free slug is found, rather than erroring
// out — a needless blocker for an admin drafting quickly. `excludeId`
// lets updatePost check uniqueness while ignoring the post being
// edited itself.
async function generateUniqueSlug(title, excludeId = null) {
  const base = generateSlug(title);
  let candidate = base;
  let suffix = 2;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const query = { slug: candidate };
    if (excludeId) query._id = { $ne: excludeId };

    const existing = await BlogPost.findOne(query).select("_id").lean();
    if (!existing) return candidate;

    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}

// ── Editable fields shared between createPost and updatePost ────
const EDITABLE_FIELDS = [
  "title",
  "excerpt",
  "content",
  "coverImageUrl",
  "coverImagePublicId",
  "seoTitle",
  "seoDescription",
  "tags",
  "relatedCategorySlug",
  "status",
  "authorName",
  "authorAvatarUrl",
  "authorBio",
  "category",
];

// ── POST /api/admin/blog/posts ────────────────────────────────
// Admin only. Creates a new draft (or published, if status is passed)
// post. Slug is generated from title and de-duplicated automatically.
export async function createPost(req, res) {
  try {
    const { title } = req.body ?? {};

    if (!title || !title.trim()) {
      return res.status(400).json({ message: "title is required." });
    }

    const slug = await generateUniqueSlug(title.trim());

    const {
      excerpt,
      content,
      coverImageUrl,
      coverImagePublicId,
      seoTitle,
      seoDescription,
      tags,
      relatedCategorySlug,
      status,
    } = req.body ?? {};

    const post = new BlogPost({
      title: title.trim(),
      slug,
      excerpt: excerpt || "",
      content: content || "",
      coverImageUrl: coverImageUrl || "",
      coverImagePublicId: coverImagePublicId || "",
      seoTitle: seoTitle || "",
      seoDescription: seoDescription || "",
      tags: Array.isArray(tags) ? tags : [],
      relatedCategorySlug: relatedCategorySlug || null,
      status: status === "published" ? "published" : "draft",
    });

    // Creating directly as "published" still needs publishedAt set —
    // mirror the same first-publish-only rule used in updatePost.
    if (post.status === "published") {
      post.publishedAt = new Date();
    }

    await post.save();
    return res.status(201).json(post);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A post with this slug already exists." });
    }
    console.error("POST /api/admin/blog/posts error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/admin/blog/posts ──────────────────────────────────
// Admin only. Paginated list, every status, optional ?status= filter,
// sorted by updatedAt descending (most recently edited first).
export async function listPostsAdmin(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const { status } = req.query;

    const filter = {};
    if (status === "draft" || status === "published") {
      filter.status = status;
    }

    const [posts, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("-content")
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    return res.json({
      posts,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error("GET /api/admin/blog/posts error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/admin/blog/posts/:id ──────────────────────────────
// Admin only. Fetch one post, all fields, for the edit form.
export async function getPostAdmin(req, res) {
  try {
    const { id } = req.params;
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }
    return res.json(post);
  } catch (err) {
    console.error("GET /api/admin/blog/posts/:id error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── PATCH /api/admin/blog/posts/:id ────────────────────────────
// Admin only. Updates any editable field.
//  - draft → published (publishedAt still null): sets publishedAt = now,
//    and never overwrites it again on subsequent edits.
//  - slug change: re-checked for uniqueness the same way as createPost.
// Loads the document and calls .save() (rather than findByIdAndUpdate)
// so the pre-save hook recomputing readTimeMinutes from `content`
// actually runs.
export async function updatePost(req, res) {
  try {
    const { id } = req.params;
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    const body = req.body ?? {};

    // ── Optional slug change ───────────────────────────────────
    // Note: changing `title` alone does NOT change `slug` — admins
    // change slug explicitly via the `slug` field so published links
    // never break as a side effect of a title edit.
    if (typeof body.slug === "string" && body.slug.trim() && body.slug.trim() !== post.slug) {
      post.slug = await generateUniqueSlug(body.slug.trim(), post._id);
    }

    for (const field of EDITABLE_FIELDS) {
      if (body[field] === undefined) continue;
      if (field === "tags") {
        post.tags = Array.isArray(body.tags) ? body.tags : post.tags;
        continue;
      }
      if (field === "title") {
        post.title = body.title.trim();
        continue;
      }
      post[field] = body[field];
    }

    // ── First-publish-only publishedAt rule ────────────────────
    if (post.status === "published" && !post.publishedAt) {
      post.publishedAt = new Date();
    }

    await post.save();
    return res.json(post);
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ message: "A post with this slug already exists." });
    }
    console.error("PATCH /api/admin/blog/posts/:id error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── DELETE /api/admin/blog/posts/:id ───────────────────────────
// Admin only. Cleans up the Cloudinary cover image first (non-fatal —
// a Cloudinary failure is logged but doesn't block the DB delete,
// matching the pattern in routes/adminCategories.js's category delete
// cascade), then deletes the BlogPost document.
export async function deletePost(req, res) {
  try {
    const { id } = req.params;
    const post = await BlogPost.findById(id);
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    if (post.coverImagePublicId) {
      try {
        await cloudinary.uploader.destroy(post.coverImagePublicId);
      } catch (cleanupErr) {
        console.error(
          `DELETE /api/admin/blog/posts/${id} Cloudinary cleanup failed:`,
          cleanupErr.message
        );
        // Non-fatal   continue with the delete regardless.
      }
    }

    await BlogPost.findByIdAndDelete(id);
    return res.json({ message: "Post deleted." });
  } catch (err) {
    console.error("DELETE /api/admin/blog/posts/:id error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── POST /api/admin/blog/upload-cover ──────────────────────────
// Admin only. Identical pattern to adminCategories.js's upload-cover,
// folder "blog-covers" instead of "category-covers".
// Body: multipart/form-data with field name "image"
// Response: { url, publicId }
export async function uploadCoverImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "blog-covers",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    });

    return res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error("POST /api/admin/blog/upload-cover error:", err.message);
    return res.status(500).json({ message: "Image upload failed. Please try again." });
  }
}

// ── POST /api/admin/blog/upload-content-image ──────────────────
// Admin only. Same pattern as uploadCoverImage, folder "blog-content" —
// used for images inserted into the post body, separate from the
// cover image so they can be cleaned up/tracked independently.
// Body: multipart/form-data with field name "image"
// Response: { url, publicId }
export async function uploadContentImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No image file provided." });
    }

    const b64 = req.file.buffer.toString("base64");
    const dataUri = `data:${req.file.mimetype};base64,${b64}`;

    const result = await cloudinary.uploader.upload(dataUri, {
      folder: "blog-content",
      resource_type: "image",
      allowed_formats: ["jpg", "jpeg", "png", "gif", "webp"],
    });

    return res.status(200).json({
      url: result.secure_url,
      publicId: result.public_id,
    });
  } catch (err) {
    console.error("POST /api/admin/blog/upload-content-image error:", err.message);
    return res.status(500).json({ message: "Image upload failed. Please try again." });
  }
}

// ── GET /api/blog/posts ─────────────────────────────────────────
// Public, no auth. Paginated, status: "published" ONLY   drafts must
// never leak here. Sorted by publishedAt descending (newest first).
// Field selection is deliberately narrow   only what a listing card
// needs   so this can't be used to fetch full post `content` in bulk.
export async function listPostsPublic(req, res) {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);

    const filter = { status: "published" };

    // Optional single-tag filter (?tag=), used by the /blog listing page.
    const { tag } = req.query;
    if (tag && typeof tag === "string") {
      filter.tags = tag;
    }

    const [posts, total] = await Promise.all([
      BlogPost.find(filter)
        .sort({ publishedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("title slug excerpt coverImageUrl tags category publishedAt readTimeMinutes")
        .lean(),
      BlogPost.countDocuments(filter),
    ]);

    res.set("Cache-Control", "public, max-age=60");

    return res.json({
      posts,
      page,
      limit,
      total,
      totalPages: Math.max(Math.ceil(total / limit), 1),
    });
  } catch (err) {
    console.error("GET /api/blog/posts error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}

// ── GET /api/blog/posts/:slug ───────────────────────────────────
// Public, no auth. status: "published" ONLY   a draft (or unknown slug)
// returns 404, never leaking its existence/content. Fires a
// fire-and-forget $inc on viewCount so the response isn't held up
// waiting on the write to complete.
export async function getPostPublic(req, res) {
  try {
    const { slug } = req.params;

    const post = await BlogPost.findOne({ slug, status: "published" }).lean();
    if (!post) {
      return res.status(404).json({ message: "Post not found." });
    }

    // Fire-and-forget view counter   errors here shouldn't affect the
    // response the reader is waiting on, so they're only logged.
    BlogPost.updateOne({ _id: post._id }, { $inc: { viewCount: 1 } }).catch((err) => {
      console.error(`viewCount increment failed for post ${post._id}:`, err.message);
    });

    res.set("Cache-Control", "public, max-age=30");

    return res.json(post);
  } catch (err) {
    console.error("GET /api/blog/posts/:slug error:", err.message);
    return res.status(500).json({ message: err.message || "Internal server error." });
  }
}
