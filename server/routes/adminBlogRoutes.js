/**
 * routes/adminBlogRoutes.js
 *
 * Standalone admin-authored blog — fully decoupled from the
 * Category/TestGroup/Test hierarchy. Every route here requires
 * verifyAdmin, same as every other admin route (see
 * routes/adminCategories.js for the reference pattern).
 *
 * Mounted in index.js at /api/admin/blog, so the routes below become:
 *   GET    /api/admin/blog/posts
 *   GET    /api/admin/blog/posts/:id
 *   POST   /api/admin/blog/posts
 *   PATCH  /api/admin/blog/posts/:id
 *   DELETE /api/admin/blog/posts/:id
 *   POST   /api/admin/blog/upload-cover
 *   POST   /api/admin/blog/upload-content-image
 */

import { Router } from "express";
import multer from "multer";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import {
  createPost,
  listPostsAdmin,
  getPostAdmin,
  updatePost,
  deletePost,
  uploadCoverImage,
  uploadContentImage,
} from "../controllers/blogController.js";

const router = Router();

// ── Multer memory storage for Cloudinary uploads ────────────
// Same 5MB cap + memoryStorage pattern as routes/adminCategories.js.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB cap for images
});

// ── Posts CRUD ──────────────────────────────────────────────
router.get("/posts", verifyAdmin, listPostsAdmin);
router.get("/posts/:id", verifyAdmin, getPostAdmin);
router.post("/posts", verifyAdmin, createPost);
router.patch("/posts/:id", verifyAdmin, updatePost);
router.delete("/posts/:id", verifyAdmin, deletePost);

// ── Image uploads ───────────────────────────────────────────
router.post("/upload-cover", verifyAdmin, upload.single("image"), uploadCoverImage);
router.post("/upload-content-image", verifyAdmin, upload.single("image"), uploadContentImage);

export default router;
