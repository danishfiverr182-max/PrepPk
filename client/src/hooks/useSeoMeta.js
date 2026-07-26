/**
 * src/hooks/useSeoMeta.js  (Prompt 69 SEO Essentials)
 *
 * Returns the title, description, and JSON-LD structured-data object
 * for a given page type.  Components pass the returned values straight
 * into <Helmet> tags so logic stays out of the JSX.
 *
 * Supported page types:
 *   "home"         platform homepage
 *   "category"     per-category test listing
 *   "free-tests"   free mock tests listing
 *   "test"         individual test hub (takes testTitle)
 *   "blog"         blog listing page
 *   "blog-post"    individual blog post (takes a `post` object)
 *
 * Usage:
 *   const { title, description, jsonLd } = useSeoMeta("category", {
 *     categoryName: "Pakistan Army",
 *     testCount: 12,
 *   });
 */

const SITE_NAME = "PrepPK";
const BASE_URL  = import.meta.env.VITE_PUBLIC_URL || "https://www.prepkp.com";

// ── Shared Organisation JSON-LD ───────────────────────────────
const orgSchema = {
  "@type": "Organization",
  "@id":   `${BASE_URL}/#organization`,
  name:    SITE_NAME,
  url:     BASE_URL,
};

// ── WebSite schema (used on every page) ──────────────────────
const websiteSchema = {
  "@context": "https://schema.org",
  "@type":    "WebSite",
  "@id":      `${BASE_URL}/#website`,
  url:        BASE_URL,
  name:       SITE_NAME,
  publisher:  { "@id": `${BASE_URL}/#organization` },
  potentialAction: {
    "@type":       "SearchAction",
    target:        `${BASE_URL}/search?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
};

// ── EducationalOrganisation schema ─────────────────────────────
const eduOrgSchema = {
  "@context": "https://schema.org",
  "@type":    "EducationalOrganization",
  "@id":      `${BASE_URL}/#eduorg`,
  name:       SITE_NAME,
  url:        BASE_URL,
  description:
    "Pakistan's competitive exam prep platform for Army, Navy & Air Force initial tests.",
};

// ── Page configs ──────────────────────────────────────────────
function buildMeta(type, opts = {}) {
  switch (type) {
    // ── Home ─────────────────────────────────────────────────
    case "home": {
      const title = `${SITE_NAME} | Free Pakistan Army, Navy & Air Force Mock Tests 2025`;
      const description =
        "Prepare for Pakistan Army, Navy, and Air Force initial tests with free mock tests. 500+ MCQs covering Verbal, Non-Verbal, and Academic sections.";
      const jsonLd = [
        websiteSchema,
        eduOrgSchema,
        {
          "@context": "https://schema.org",
          "@type":    "WebPage",
          "@id":      `${BASE_URL}/#webpage`,
          url:        BASE_URL,
          name:       title,
          description,
          isPartOf:   { "@id": `${BASE_URL}/#website` },
          publisher:  orgSchema,
        },
      ];
      return { title, description, jsonLd };
    }

    // ── Category ──────────────────────────────────────────────
    case "category": {
      const { categoryName = "", slug = "", testCount } = opts;
      const title = `${categoryName} Mock Test 2025 | Online Practice | ${SITE_NAME}`;
      const description = `Prepare for ${categoryName} initial test with official-style MCQs. ${
        testCount ? `${testCount} tests available ` : ""
      }Free and premium mock tests covering Verbal, Non-Verbal, and Academic sections.`;
      const pageUrl = `${BASE_URL}/category/${slug}`;
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type":    "Course",
          "@id":      `${pageUrl}#course`,
          name:       `${categoryName} Initial Test Preparation`,
          description,
          url:        pageUrl,
          provider:   orgSchema,
          educationalLevel: "competitive exam",
          hasCourseInstance: {
            "@type":         "CourseInstance",
            courseMode:      "online",
            instructor:      orgSchema,
          },
        },
        {
          "@context": "https://schema.org",
          "@type":    "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home",     item: BASE_URL },
            { "@type": "ListItem", position: 2, name: categoryName, item: pageUrl },
          ],
        },
      ];
      return { title, description, jsonLd };
    }

    // ── Free Tests ───────────────────────────────────────────
    case "free-tests": {
      const title = `Free Mock Tests | Pakistan Competitive Exam Practice | ${SITE_NAME}`;
      const description =
        "Access free mock tests for Pakistan Army, Navy, and Air Force initial exams. Practice Verbal, Non-Verbal, and Academic MCQs no signup required.";
      const pageUrl = `${BASE_URL}/free-mock-tests`;
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type":    "WebPage",
          "@id":      `${pageUrl}#webpage`,
          url:        pageUrl,
          name:       title,
          description,
          isPartOf:   { "@id": `${BASE_URL}/#website` },
        },
        {
          "@context": "https://schema.org",
          "@type":    "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home",           item: BASE_URL },
            { "@type": "ListItem", position: 2, name: "Free Mock Tests", item: pageUrl },
          ],
        },
      ];
      return { title, description, jsonLd };
    }

    // ── Individual test hub ──────────────────────────────────
    case "test": {
      const { testTitle = "Mock Test", categoryName = "" } = opts;
      const title = `${testTitle}${categoryName ? ` ${categoryName}` : ""} | ${SITE_NAME}`;
      const description = `Take the ${testTitle} online practice test${
        categoryName ? ` for ${categoryName}` : ""
      }. Timed MCQs for Verbal, Non-Verbal, and Academic sections.`;
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type":    "Quiz",
          name:       testTitle,
          description,
          provider:   orgSchema,
          educationalUse: "practice",
        },
      ];
      return { title, description, jsonLd };
    }

    // ── Blog listing ─────────────────────────────────────────
    case "blog": {
      const title = `Blog | ${SITE_NAME}`;
      const description =
        "Tips, guides, and updates on preparing for Pakistan Army, Navy, and Air Force initial tests.";
      const pageUrl = `${BASE_URL}/blog`;
      const jsonLd = [
        {
          "@context": "https://schema.org",
          "@type":    "WebPage",
          "@id":      `${pageUrl}#webpage`,
          url:        pageUrl,
          name:       title,
          description,
          isPartOf:   { "@id": `${BASE_URL}/#website` },
        },
        {
          "@context": "https://schema.org",
          "@type":    "BreadcrumbList",
          itemListElement: [
            { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
            { "@type": "ListItem", position: 2, name: "Blog", item: pageUrl },
          ],
        },
      ];
      return { title, description, jsonLd };
    }

    // ── Individual blog post ─────────────────────────────────
    // opts.post is the raw BlogPost document (title, slug, excerpt,
    // seoTitle, seoDescription, coverImageUrl, publishedAt, updatedAt).
    case "blog-post": {
      const { post = {} } = opts;
      const title = `${post.seoTitle || post.title || "Blog"} | ${SITE_NAME}`;
      const description =
        post.seoDescription || post.excerpt || "Read the latest from PrepPK.";
      const pageUrl = `${BASE_URL}/blog/${post.slug || ""}`;
      const blogUrl = `${BASE_URL}/blog`;

      const articleSchema = {
        "@context": "https://schema.org",
        "@type":    "BlogPosting",
        "@id":      `${pageUrl}#article`,
        headline:   post.title || "",
        description,
        image:      post.coverImageUrl || undefined,
        datePublished: post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined,
        dateModified:  post.updatedAt ? new Date(post.updatedAt).toISOString() : undefined,
        author:    { "@type": "Organization", name: SITE_NAME },
        publisher: {
          "@type": "Organization",
          name:    SITE_NAME,
          "@id":   `${BASE_URL}/#organization`,
        },
        mainEntityOfPage: { "@type": "WebPage", "@id": pageUrl },
      };

      const breadcrumbSchema = {
        "@context": "https://schema.org",
        "@type":    "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
          { "@type": "ListItem", position: 2, name: "Blog", item: blogUrl },
          { "@type": "ListItem", position: 3, name: post.title || "", item: pageUrl },
        ],
      };

      return { title, description, jsonLd: [articleSchema, breadcrumbSchema], url: pageUrl };
    }

    // ── Fallback ──────────────────────────────────────────────
    default:
      return {
        title:       `${SITE_NAME} | Pakistan Exam Preparation`,
        description: "Pakistan's competitive exam prep platform.",
        jsonLd:      [],
      };
  }
}

/**
 * useSeoMeta(type, opts)
 *
 * @param {string} type  "home" | "category" | "free-tests" | "test"
 * @param {object} opts  page-specific options (categoryName, slug, etc.)
 * @returns {{ title: string, description: string, jsonLd: object[], url?: string }}
 *   `url` is only returned by page types that need a non-default canonical
 *   URL (currently "blog-post"); callers of other types keep passing their
 *   own `url` prop to <SeoHead> (or rely on its DEFAULT_URL).
 */
export function useSeoMeta(type, opts = {}) {
  return buildMeta(type, opts);
}
