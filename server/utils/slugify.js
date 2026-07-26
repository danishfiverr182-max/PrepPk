/**
 * utils/slugify.js
 *
 * Shared URL-safe slug generator. Originally lived only inside
 * controllers/testGroupController.js; moved here so any feature that
 * needs slugs (TestGroup, and now the standalone BlogPost feature) can
 * import the same logic instead of keeping duplicate copies.
 */

// ── generateSlug: lowercase, strip special chars, spaces → hyphens ──
export function generateSlug(str) {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")   // remove special chars
    .replace(/\s+/g, "-")            // spaces → hyphens
    .replace(/-+/g, "-");            // collapse multiple hyphens
}

export default generateSlug;
