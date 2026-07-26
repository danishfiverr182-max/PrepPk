/**
 * src/utils/slugify.js  (Prompt 4 — Blog Admin UI)
 *
 * Client-side mirror of server/utils/slugify.js's generateSlug — used
 * for the live slug preview in BlogEditorPage.jsx as the admin types a
 * title. Deliberately duplicated rather than imported (client and
 * server are separate bundles); keep this in sync with the server copy
 * if that logic ever changes. Note the server is still the source of
 * truth for uniqueness (the -2/-3/... suffix on collision) — this
 * client copy only produces the base slug for preview purposes.
 */

export function generateSlug(str) {
  return (str || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "") // remove special chars
    .replace(/\s+/g, "-") // spaces → hyphens
    .replace(/-+/g, "-"); // collapse multiple hyphens
}

export default generateSlug;
