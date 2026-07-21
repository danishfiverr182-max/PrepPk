/**
 * src/utils/formatRelativeTime.js  (Part 12   Prompt 9: Key Pool Admin UI)
 *
 * Converts a Date/ISO-string/null into a short relative-time label for
 * display, e.g. "just now", "3 min ago", "2 hr ago", "5 days ago". Falls
 * back to a plain date once something is more than 30 days old, since
 * "47 days ago" is less useful to an admin than an actual date at that
 * point.
 *
 * Examples:
 *   formatRelativeTime(null)                        → "Never"
 *   formatRelativeTime(new Date())                   → "just now"
 *   formatRelativeTime(Date.now() - 90 * 1000)       → "1 min ago"
 *   formatRelativeTime(Date.now() - 3 * 3600 * 1000) → "3 hr ago"
 */
export function formatRelativeTime(value) {
  if (!value) return "Never";

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "Never";

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) return "just now"; // clock skew guard

  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 45) return "just now";

  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} min ago`;

  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hr ago`;

  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 30) return `${diffDay} day${diffDay === 1 ? "" : "s"} ago`;

  return date.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
