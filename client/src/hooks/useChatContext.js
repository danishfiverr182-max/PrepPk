/**
 * src/hooks/useChatContext.js  (Part 11   Prompt 4)
 *
 * Derives { categoryName, testName } from the current route so the AI
 * assistant knows what the user is looking at, WITHOUT guessing: it hits
 * the same read endpoints the actual pages already use
 * (CategoryPage.jsx → GET /tests/category/:slug, TestHubPage.jsx →
 * GET /tests/:testId), so the name shown to the assistant matches what's
 * really on screen rather than a slug-derived approximation.
 *
 * Routes recognised:
 *   /category/:slug                                → { categoryName }
 *   /test/:testId                                   → { categoryName, testName }
 *   /test/:testId/section/:sectionKey[/result|review] → { categoryName, testName }
 * Anything else (custom-category tests, free-mock tests, home, admin, etc.)
 * → null. Keeping this to the two page types explicitly wired here avoids
 * guessing at data shapes for pages this prompt didn't inspect.
 *
 * Results are cached per slug/testId for the life of the tab (a small
 * in-memory ref, not sessionStorage) so navigating between a test's
 * sections doesn't re-fetch the same test metadata repeatedly.
 */

import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import api from "../api/axios";

const CATEGORY_PAGE_RE = /^\/category\/([^/]+)\/?$/;
const TEST_HUB_RE = /^\/test\/([^/]+)\/?$/;
const TEST_SECTION_RE = /^\/test\/([^/]+)\/section\/[^/]+/;

function titleCaseSlug(slug) {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export default function useChatContext() {
  const location = useLocation();
  const [pageContext, setPageContext] = useState(null);
  const cacheRef = useRef({}); // "category:slug" | "test:testId" -> context object

  useEffect(() => {
    let cancelled = false;
    const pathname = location.pathname;

    const categoryMatch = pathname.match(CATEGORY_PAGE_RE);
    const testMatch = pathname.match(TEST_HUB_RE) || pathname.match(TEST_SECTION_RE);

    if (categoryMatch) {
      const slug = categoryMatch[1];
      const cacheKey = `category:${slug}`;

      if (cacheRef.current[cacheKey]) {
        setPageContext(cacheRef.current[cacheKey]);
        return;
      }

      api
        .get(`/tests/category/${slug}`)
        .then(({ data }) => {
          if (cancelled) return;
          const ctx = {
            categoryName: data.category?.name || titleCaseSlug(slug),
            testName: null,
          };
          cacheRef.current[cacheKey] = ctx;
          setPageContext(ctx);
        })
        .catch(() => {
          if (cancelled) return;
          // Same fallback CategoryPage itself uses before catName loads.
          setPageContext({ categoryName: titleCaseSlug(slug), testName: null });
        });

      return () => {
        cancelled = true;
      };
    }

    if (testMatch) {
      const testId = testMatch[1];
      const cacheKey = `test:${testId}`;

      if (cacheRef.current[cacheKey]) {
        setPageContext(cacheRef.current[cacheKey]);
        return;
      }

      api
        .get(`/tests/${testId}`)
        .then(({ data }) => {
          if (cancelled) return;
          const ctx = {
            categoryName: data.category?.name || null,
            testName: data.title || null,
          };
          cacheRef.current[cacheKey] = ctx;
          setPageContext(ctx);
        })
        .catch(() => {
          if (cancelled) return;
          setPageContext(null);
        });

      return () => {
        cancelled = true;
      };
    }

    // Not on a category or test page   no page-specific context.
    setPageContext(null);
  }, [location.pathname]);

  return pageContext;
}
