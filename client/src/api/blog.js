/**
 * src/api/blog.js  (Prompt 4 — Blog Admin UI)
 *
 * Talks to the standalone blog endpoints mounted at /api/admin/blog
 * (server/routes/adminBlogRoutes.js, all behind verifyAdmin):
 *
 *   GET    /api/admin/blog/posts                → listPosts(params)
 *   GET    /api/admin/blog/posts/:id             → getPost(id)
 *   POST   /api/admin/blog/posts                 → createPost(payload)
 *   PATCH  /api/admin/blog/posts/:id              → updatePost(id, payload)
 *   DELETE /api/admin/blog/posts/:id              → deletePost(id)
 *   POST   /api/admin/blog/upload-cover           → uploadCoverImage(file)
 *   POST   /api/admin/blog/upload-content-image    → uploadContentImage(file)
 *
 * Also talks to the public-facing endpoints mounted at /api/blog
 * (server/routes/publicBlogRoutes.js, no auth, published posts only):
 *
 *   GET /api/blog/posts        → listPostsPublic(params)
 *   GET /api/blog/posts/:slug  → getPostPublic(slug)
 *
 * Uses the shared `api` axios instance from src/api/axios.js (withCredentials
 * + the ACCESS_EXPIRED interceptor) — same instance every other admin API
 * client (apiKeys.js, adminApi.js) uses. Every call here returns the raw
 * axios response (callers read `.data`), matching src/api/apiKeys.js, so
 * error handling stays at the call site where the toast/UI context lives.
 */

import api from "./axios";

/**
 * GET a paginated, admin-visible list of posts.
 * @param {{ page?: number, limit?: number, status?: "draft"|"published" }} params
 */
export function listPosts(params = {}) {
  return api.get("/admin/blog/posts", { params });
}

/** GET one post (all fields) for the editor. */
export function getPost(id) {
  return api.get(`/admin/blog/posts/${id}`);
}

/** POST a new post. `payload.status` defaults to "draft" server-side. */
export function createPost(payload) {
  return api.post("/admin/blog/posts", payload);
}

/** PATCH an existing post — only send the fields that changed. */
export function updatePost(id, payload) {
  return api.patch(`/admin/blog/posts/${id}`, payload);
}

/** DELETE a post permanently (also cleans up its Cloudinary cover image). */
export function deletePost(id) {
  return api.delete(`/admin/blog/posts/${id}`);
}

/**
 * POST the single cover-image slot for a post.
 * @param {File} file
 * @returns {Promise<{ data: { url: string, publicId: string } }>}
 */
export function uploadCoverImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  return api.post("/admin/blog/upload-cover", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

/**
 * POST an in-body content image (inserted as an <img> tag at the cursor
 * by the caller, same pattern as CategoryPage.jsx's insert-at-cursor helper).
 * @param {File} file
 * @returns {Promise<{ data: { url: string, publicId: string } }>}
 */
export function uploadContentImage(file) {
  const formData = new FormData();
  formData.append("image", file);
  return api.post("/admin/blog/upload-content-image", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
}

// ── Public (no auth) ─────────────────────────────────────────────

/**
 * GET a paginated, public list of published posts (listing-card fields only).
 * @param {{ page?: number, limit?: number, tag?: string }} params
 */
export function listPostsPublic(params = {}) {
  return api.get("/blog/posts", { params });
}

/** GET one published post (all fields) by slug. 404s for drafts/missing. */
export function getPostPublic(slug) {
  return api.get(`/blog/posts/${slug}`);
}
