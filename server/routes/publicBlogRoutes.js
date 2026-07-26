/**
 * routes/publicBlogRoutes.js
 *
 * Public-facing endpoints for the standalone admin-authored blog
 * (see models/BlogPost.js, controllers/blogController.js). No auth   the
 * blog is meant to be indexed and read by anonymous visitors.
 *
 * Mounted in index.js at /api/blog, so the routes below become:
 *   GET /api/blog/posts         listPostsPublic (paginated, published only)
 *   GET /api/blog/posts/:slug   getPostPublic   (published only, 404 otherwise)
 *
 * Kept in its own file (mirroring adminBlogRoutes.js on the admin side)
 * rather than folded into an existing public routes file, since every
 * other public*Routes.js file in this codebase is scoped to a single
 * feature area (categories, stats, settings, free tests, ...).
 */

import { Router } from "express";
import { listPostsPublic, getPostPublic } from "../controllers/blogController.js";

const router = Router();

router.get("/posts", listPostsPublic);
router.get("/posts/:slug", getPostPublic);

export default router;
