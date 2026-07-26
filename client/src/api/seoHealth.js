/**
 * src/api/seoHealth.js
 *
 * Talks to the single read-only diagnostic endpoint mounted at
 * /api/admin/seo-health (server/routes/adminSeoHealth.js, behind
 * verifyAdmin). Uses the shared `api` axios instance from
 * src/api/axios.js, same as src/api/blog.js and src/api/adminApi.js,
 * so admin session/expiry handling stays consistent.
 */

import api from "./axios";

/**
 * GET the SEO health report.
 * @returns {Promise<{ data: {
 *   categoriesMissingSeo:   { count: number, items: { name, slug }[] },
 *   testGroupsMissingSeo:   { count: number, items: { name, slug, categorySlug }[] },
 *   thinContentPosts:       { count: number, items: { title, slug, id, wordCount }[] },
 *   noInternalLinkPosts:    { count: number, items: { title, slug, id }[] },
 * } }>}
 */
export function getSeoHealth() {
  return api.get("/admin/seo-health");
}
