/**
 * src/pages/user/TestGroupPage.jsx
 *
 * Public page for a single TestGroup ("chapter") within a custom category.
 * Gives chapters their own indexable URL — /category/:slug/:groupSlug —
 * instead of only being reachable as an in-page selection on CategoryPage
 * (via CustomCategoryLayout's sub-menu, which now links here — see
 * components/user/CustomCategoryLayout.jsx).
 *
 * Data comes from GET /api/test-groups/:categorySlug/:groupSlug, which
 * returns the full TestGroup document (seoTitle, seoDescription,
 * blogContent, categorySlug, etc.) plus a `tests` summary array of
 * { _id, testNumber, isFree, status } for every published test in it.
 *
 * Mirrors CategoryPage.jsx's conventions:
 *  - <SeoHead> SEO tags (see components/SeoHead.jsx), with a fallback
 *    title/description when the admin hasn't set seoTitle/seoDescription
 *    for this group yet. Previously used a raw <Helmet> with only
 *    title/description/canonical   swapped to SeoHead so this page also
 *    gets Open Graph + Twitter card tags, consistent with the rest of the
 *    public site, plus a small BreadcrumbList jsonLd matching the visual
 *    breadcrumb already rendered below.
 *  - Also emits an ItemList jsonLd schema (each list item pointing at a
 *    test in this group   name + position), mirroring CategoryPage.jsx's
 *    own CollectionPage/ItemList block one level up. ItemList rather than
 *    Quiz/Course: this page lists tests, it doesn't administer a quiz or
 *    teach a course, so ItemList is the honest, defensible schema here
 *    too. Only emitted once `group.tests` has actually loaded.
 *  - blogContent rendered via AboutSection (same dangerouslySetInnerHTML
 *    wrapper CategoryPage.jsx already uses — admin-authored HTML only).
 *  - Loading skeleton + error-with-retry pattern.
 *  - Test cards reused from CustomCategoryLayout.jsx (PremiumTestCard /
 *    FreeTestCard) rather than a new card built from scratch.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useOutletContext, useNavigate, Link } from "react-router-dom";
import SeoHead from "../../components/SeoHead";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import AboutSection from "../../components/user/AboutSection";
import { PremiumTestCard, FreeTestCard } from "../../components/user/CustomCategoryLayout";

const SITE_NAME = "PrepPK";
const BASE_URL  = import.meta.env.VITE_PUBLIC_URL || "https://www.prepkp.com";

// ── Breadcrumb chevron ────────────────────────────────────────
function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-txt-muted dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Skeleton ──────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-sm p-4 animate-pulse flex items-center justify-between gap-4">
      <div className="space-y-2 flex-1">
        <div className="h-4 bg-border dark:bg-dark-border rounded w-40" />
        <div className="h-3 bg-bg dark:bg-dark-bg rounded w-24" />
      </div>
      <div className="h-8 w-24 bg-border dark:bg-dark-border rounded-lg" />
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────
function ErrorCard({ message, onRetry }) {
  const isOffline = !navigator.onLine;
  return (
    <div className="bg-danger-light dark:bg-red-900/30 border border-danger/30 dark:border-red-700/30 rounded-xl p-6 text-center">
      <p className="text-sm font-semibold text-danger dark:text-red-300 mb-1">
        {isOffline ? "You appear to be offline." : "Could not load this chapter."}
      </p>
      <p className="text-xs text-danger dark:text-red-300 mb-4">
        {isOffline ? "Check your internet connection and try again." : message}
      </p>
      <button
        onClick={onRetry}
        className="text-xs font-bold bg-danger hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
      >
        Try Again
      </button>
    </div>
  );
}

// ── 404: group not found ──────────────────────────────────────
function GroupNotFound({ categorySlug }) {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-2xl p-10">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-danger dark:text-red-300 bg-danger-light/10 dark:bg-red-900/20 border border-danger/20 dark:border-red-700/20 px-3 py-1 rounded-full mb-4">
          404
        </span>
        <h2 className="text-2xl font-bold text-txt-primary dark:text-slate-100 mb-2">Chapter not found</h2>
        <p className="text-txt-secondary dark:text-slate-300 text-sm mb-6">
          This chapter doesn't exist or may have been removed.
        </p>
        <Link
          to={categorySlug ? `/category/${categorySlug}` : "/"}
          className="inline-flex items-center gap-2 bg-brand dark:bg-blue-500 hover:bg-brand-dark dark:hover:bg-blue-600 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition"
        >
          {categorySlug ? "Back to Category" : "Back Home"}
        </Link>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function TestGroupPage() {
  const { slug: categorySlug, groupSlug } = useParams();
  const navigate = useNavigate();
  const { premiumUser, sessionExpired } = useAuth();
  const { openPremiumPopup, openLoginModal } = useOutletContext() ?? {};

  const [group,      setGroup]      = useState(null);
  const [categoryName, setCategoryName] = useState("");
  const [loading,    setLoading]    = useState(true);
  const [notFound,   setNotFound]   = useState(false);
  const [error,      setError]      = useState(null);

  const isLoggedIn = !!premiumUser;
  const hasAccess  = isLoggedIn && !sessionExpired;
  const userExpired = sessionExpired;

  const displayCategoryName =
    categoryName ||
    categorySlug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  const fetchGroup = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    api
      .get(`/test-groups/${categorySlug}/${groupSlug}`)
      .then(({ data }) => setGroup(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setNotFound(true);
          return;
        }
        const msg =
          err.code === "ERR_NETWORK" || err.message === "Network Error"
            ? "Network error — check your connection."
            : "Failed to load this chapter. Please try again.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [categorySlug, groupSlug]);

  useEffect(() => { fetchGroup(); }, [fetchGroup]);

  // Secondary, non-blocking fetch for the category's real display name
  // (used in the breadcrumb + SEO fallback text). Falls back to a
  // title-cased slug — same fallback CategoryPage.jsx itself uses — if
  // this fails or hasn't resolved yet, so it never blocks the page.
  useEffect(() => {
    api
      .get(`/tests/category/${categorySlug}`)
      .then(({ data }) => setCategoryName(data.category?.name || ""))
      .catch(() => {});
  }, [categorySlug]);

  function handleStartPremiumTest(test) {
    navigate(`/test/custom/${test.testId || test.id}`);
  }

  function handleStartFreeTest(test) {
    navigate(`/test/free-custom/${test.testId || test.id}`);
  }

  function handleLockedTest() {
    if (!isLoggedIn) {
      if (openLoginModal) openLoginModal();
      else navigate("/login");
    } else if (openPremiumPopup) {
      openPremiumPopup({ mode: "expired" });
    } else {
      navigate("/login");
    }
  }

  if (notFound) {
    return <GroupNotFound categorySlug={categorySlug} />;
  }

  const groupName = group?.name || "";

  // ── SEO values: admin-set values, or a sensible generated default ──
  const pageTitle =
    (group?.seoTitle) ||
    (groupName ? `${groupName} — ${displayCategoryName} Practice Tests | ${SITE_NAME}` : `Practice Tests | ${SITE_NAME}`);

  const pageDescription =
    (group?.seoDescription) ||
    (groupName
      ? `Practice ${groupName} mock tests for ${displayCategoryName} with exam-style MCQs. Free and premium tests available on ${SITE_NAME}.`
      : `Practice mock tests with exam-style MCQs on ${SITE_NAME}.`);

  const canonicalUrl = `${BASE_URL}/category/${categorySlug}/${groupSlug}`;

  // ── BreadcrumbList jsonLd ──────────────────────────────────────
  // Mirrors the visual breadcrumb rendered below (Home > Category > Chapter)
  // — a clean fit since that same three-level structure is already known
  // here, no extra data needed.
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type":    "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: BASE_URL },
      {
        "@type": "ListItem",
        position: 2,
        name: displayCategoryName,
        item: `${BASE_URL}/category/${categorySlug}`,
      },
      {
        "@type": "ListItem",
        position: 3,
        name: groupName || "Chapter",
        item: canonicalUrl,
      },
    ],
  };

  // ── ItemList jsonLd ──────────────────────────────────────────
  // Describes "this page lists N practice tests"   the same honest,
  // lightweight schema CategoryPage.jsx uses one level up, rather than
  // overclaiming with Quiz/Course schema this app doesn't actually fit.
  // Free and premium tests are both real tests on this page, so both
  // are included; position follows the order they come back in from
  // the API (group.tests), same order the page itself renders them in
  // grouped by free/premium below.
  const groupTests = group?.tests || [];
  const itemListSchema =
    groupTests.length > 0
      ? {
          "@context": "https://schema.org",
          "@type":    "ItemList",
          itemListElement: groupTests.map((t, i) => ({
            "@type":  "ListItem",
            position: i + 1,
            name:     `${groupName} Test ${t.testNumber}`,
            url:      `${BASE_URL}/test/${t.isFree ? "free-custom" : "custom"}/${t._id}`,
          })),
        }
      : null;

  const jsonLd = [breadcrumbSchema, ...(itemListSchema ? [itemListSchema] : [])];

  const premiumTests = (group?.tests || [])
    .filter((t) => !t.isFree)
    .map((t) => ({
      id: t._id,
      testId: t._id,
      displayName: `${groupName} Test ${t.testNumber}`,
      locked: !hasAccess,
    }));

  const freeTests = (group?.tests || [])
    .filter((t) => t.isFree)
    .map((t) => ({
      id: t._id,
      testId: t._id,
      displayName: `${groupName} Test ${t.testNumber}`,
    }));

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 dark:bg-dark-bg">
      {/* SEO meta tags */}
      <SeoHead
        title={pageTitle}
        description={pageDescription}
        url={canonicalUrl}
        ogType="website"
        jsonLd={jsonLd}
      />

      {/* Breadcrumb — real internal links to distribute link authority
          to Home and the parent Category page, not just visual text. */}
      <nav className="flex items-center gap-1.5 text-xs text-txt-muted dark:text-slate-500 mb-6" aria-label="Breadcrumb">
        <Link to="/" className="hover:text-txt-secondary dark:hover:text-slate-300 transition-colors">
          Home
        </Link>
        <ChevronRightIcon />
        <Link to={`/category/${categorySlug}`} className="hover:text-txt-secondary dark:hover:text-slate-300 transition-colors">
          {displayCategoryName}
        </Link>
        <ChevronRightIcon />
        <span className="text-txt-secondary dark:text-slate-300 font-medium">
          {loading ? "…" : groupName || "Chapter"}
        </span>
      </nav>

      {/* Page header */}
      {!loading && !error && (
        <div className="mb-8">
          <p className="text-xs text-brand dark:text-blue-400 font-semibold uppercase tracking-widest mb-1">
            {displayCategoryName} Mock Tests
          </p>
          <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100">{groupName}</h1>
          {group?.description && (
            <p className="text-txt-secondary dark:text-slate-300 text-sm mt-2 max-w-2xl">{group.description}</p>
          )}
          {isLoggedIn && userExpired && (
            <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-1 rounded-full border bg-danger-light dark:bg-red-900/30 text-danger dark:text-red-300 border-danger/30 dark:border-red-700/30">
              ⚠ Subscription Expired
            </div>
          )}
        </div>
      )}

      {/* Test list */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <ErrorCard message={error} onRetry={fetchGroup} />
      ) : premiumTests.length === 0 && freeTests.length === 0 ? (
        <div className="bg-bg dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl p-10 text-center text-txt-secondary dark:text-slate-300 text-sm">
          No published tests yet in this chapter.
        </div>
      ) : (
        <div className="space-y-8">
          {freeTests.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-txt-muted dark:text-slate-500 mb-3">
                Free Tests
              </h2>
              <div className="space-y-3">
                {freeTests.map((test) => (
                  <FreeTestCard key={test.id} test={test} onStart={handleStartFreeTest} />
                ))}
              </div>
            </div>
          )}

          {premiumTests.length > 0 && (
            <div>
              <h2 className="text-xs font-bold uppercase tracking-widest text-txt-muted dark:text-slate-500 mb-3">
                Premium Tests
              </h2>
              {!isLoggedIn && (
                <div className="mb-4 bg-accent-light dark:bg-amber-900/30 border border-accent/30 dark:border-amber-700/30 rounded-xl px-4 py-3 flex items-center gap-3">
                  <svg className="w-5 h-5 text-amber-700 dark:text-amber-300 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    These are premium tests.{" "}
                    <button
                      onClick={() => openPremiumPopup?.({ mode: "visitor" })}
                      className="font-semibold underline hover:text-amber-900 dark:hover:text-amber-100 transition-colors"
                    >
                      Buy Premium
                    </button>
                    {" "}to take them.
                  </p>
                </div>
              )}
              <div className="space-y-3">
                {premiumTests.map((test) => (
                  <PremiumTestCard
                    key={test.id}
                    test={test}
                    onStart={handleStartPremiumTest}
                    onLocked={handleLockedTest}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* About This Chapter — SEO blog content, same renderer CategoryPage.jsx uses */}
      {!loading && !error && (
        <AboutSection blogContent={group?.blogContent || ""} />
      )}
    </div>
  );
}
