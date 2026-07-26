/**
 * src/components/SeoHead.jsx  (Prompt 69 SEO Essentials; updated — noIndex)
 *
 * Thin wrapper around react-helmet-async's <Helmet> that injects:
 *   1. <title>
 *   2. <meta name="description">
 *   3. Open Graph tags (og:title, og:description, og:type, og:url)
 *   4. One or more <script type="application/ld+json"> blocks
 *   5. Optionally, <meta name="robots" content="noindex, nofollow"> and no
 *      canonical link, for pages that should never be indexed (404s, etc.)
 *
 * Usage:
 *   <SeoHead
 *     title="Pakistan Army Mock Test 2025 | PrepPK"
 *     description="Practice MCQs for ..."
 *     url="https://www.prepkp.com/category/pakistan-army"
 *     jsonLd={[courseSchema, breadcrumbSchema]}
 *   />
 *
 *   <SeoHead title="Page Not Found | PrepPK" noIndex />
 *
 * This is the ONE SEO mechanism used across the entire public site — every
 * public page renders its meta tags through this component rather than a
 * raw <Helmet>, so title/description/OG/Twitter/canonical/JSON-LD (and now
 * noindex) all stay consistent by construction. (Admin-only pages, which
 * are never meant to be indexed or shared and already sit behind
 * robots.txt's Disallow, are out of scope for this and keep their own
 * minimal <Helmet> title-only usage.)
 *
 * All props are optional   defaults are safe generic values.
 */

import { Helmet } from "react-helmet-async";

const DEFAULT_TITLE       = "PrepPK | Pakistan Army, Navy & Air Force Mock Tests";
const DEFAULT_DESCRIPTION =
  "Prepare for Pakistan competitive initial tests with free and premium mock tests.";
const DEFAULT_URL         = import.meta.env.VITE_PUBLIC_URL || "https://www.prepkp.com";

export default function SeoHead({
  title       = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  url         = DEFAULT_URL,
  ogType      = "website",
  jsonLd      = [],
  noIndex     = false,
}) {
  // Normalise jsonLd to always be an array so we can .map() it
  const schemas = Array.isArray(jsonLd) ? jsonLd : [jsonLd];

  return (
    <Helmet>
      {/* ── Primary meta ──────────────────────────────────── */}
      <title>{title}</title>
      <meta name="description" content={description} />

      {/* ── Robots override for pages that should never be indexed
          (404s, etc.) — canonical link is skipped too in this case,
          since there's no "real" canonical URL for a not-found page. ── */}
      {noIndex && <meta name="robots" content="noindex, nofollow" />}

      {/* ── Open Graph ───────────────────────────────────── */}
      <meta property="og:title"       content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:type"        content={ogType} />
      <meta property="og:url"         content={url} />
      <meta property="og:site_name"   content="PrepPK" />

      {/* ── Twitter Card ─────────────────────────────────── */}
      <meta name="twitter:card"        content="summary" />
      <meta name="twitter:title"       content={title} />
      <meta name="twitter:description" content={description} />

      {/* ── Canonical ────────────────────────────────────── */}
      {!noIndex && <link rel="canonical" href={url} />}

      {/* ── JSON-LD structured data ───────────────────────
          One <script> tag per schema object.
          Using dangerouslySetInnerHTML is the standard helmet
          pattern for injecting JSON blobs safely.
      ─────────────────────────────────────────────────── */}
      {schemas.map((schema, i) => (
        <script
          key={i}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      ))}
    </Helmet>
  );
}
