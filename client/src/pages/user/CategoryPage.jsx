/**
 * src/pages/user/CategoryPage.jsx  (Prompt 3   Expiry Enforcement & Access Control)
 *
 * Changes:
 *  - Removed serverHasAccess and serverUserExpired state   the server no longer
 *    returns per-category access flags. Access is determined purely client-side.
 *  - New rule: hasAccess = !!premiumUser (logged in and not expired).
 *    A logged-in, non-expired premium user sees every category unlocked.
 *  - userExpired is now derived from AuthContext's sessionExpired flag instead
 *    of a per-category server response.
 *  - fetch logic no longer reads hasAccess / userExpired from API response.
 *  - All SEO, blog content, and skeleton/error UI is unchanged.
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, useOutletContext, Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import CategoryLockMessage from "../../public/components/CategoryLockMessage";
import CustomCategoryLayout from "../../components/user/CustomCategoryLayout";
import AboutSection from "../../components/user/AboutSection";

const SITE_NAME = "PrepPK";

// ── Section badge ─────────────────────────────────────────────
function SectionBadge({ label, status }) {
  const done = status === "ready";
  return (
    <span
      className={`inline-block text-xs px-3 py-1 rounded-full font-medium ${
        done
          ? "text-brand bg-brand-light dark:text-blue-300 dark:bg-blue-900/30"
          : "bg-bg text-txt-muted dark:bg-dark-surface2 dark:text-slate-500"
      }`}
    >
      {label}
    </span>
  );
}

// ── Test Card ─────────────────────────────────────────────────
function TestCard({
  test,
  isLoggedIn,
  hasAccess,
  userExpired,
  categoryName,
  onLockedClick,
}) {
  const isLocked = !hasAccess || userExpired;

  return (
    <div
      className={`bg-surface dark:bg-dark-surface rounded-xl border shadow-sm transition-all ${
        isLocked
          ? "border-border dark:border-dark-border opacity-90"
          : "border-border dark:border-dark-border hover:shadow-md hover:border-brand-light dark:hover:border-dark-border"
      }`}
    >
      <div className="p-5 space-y-3">
        {/* Header row: title + section badges */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-txt-primary dark:text-slate-100">{test.title}</h3>
            <div className="flex flex-wrap gap-1.5 mt-2">
              <SectionBadge label="Verbal"     status={test.sections.verbal} />
              <SectionBadge label="Non-Verbal" status={test.sections.nonVerbal} />
              <SectionBadge label="Academic"   status={test.sections.academic} />
            </div>
          </div>
        </div>

        {/* Action / lock message */}
        <CategoryLockMessage
          isLoggedIn={isLoggedIn}
          hasAccess={hasAccess}
          userExpired={userExpired}
          categoryName={categoryName}
          onBuyClick={() => onLockedClick(test)}
          renderUnlocked={
            <Link
              to={`/test/${test._id}`}
              className="inline-flex items-center text-xs font-bold bg-brand dark:bg-blue-500 hover:bg-brand-dark dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
            >
              Start Test
            </Link>
          }
        />
      </div>
    </div>
  );
}

// ── Error card ────────────────────────────────────────────────
function ErrorCard({ message, onRetry }) {
  const isOffline = !navigator.onLine;
  return (
    <div className="bg-danger-light dark:bg-red-900/30 border border-danger/30 dark:border-red-700/30 rounded-xl p-6 text-center">
      <p className="text-sm font-semibold text-danger dark:text-red-300 mb-1">
        {isOffline ? "You appear to be offline." : "Could not load tests."}
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

// ── Skeleton ──────────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-sm p-5 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="space-y-2 flex-1">
          <div className="h-4 bg-border dark:bg-dark-border rounded w-40" />
          <div className="flex gap-2 mt-2">
            <div className="h-5 bg-bg dark:bg-dark-bg rounded-full w-16" />
            <div className="h-5 bg-bg dark:bg-dark-bg rounded-full w-20" />
            <div className="h-5 bg-bg dark:bg-dark-bg rounded-full w-16" />
          </div>
        </div>
        <div className="h-8 w-20 bg-border dark:bg-dark-border rounded-lg" />
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function CategoryPage() {
  const { slug } = useParams();
  const { premiumUser, sessionExpired } = useAuth();
  const { openPremiumPopup, openLoginModal } = useOutletContext();

  const [tests,          setTests]          = useState([]);
  const [catName,        setCatName]        = useState("");
  const [catDescription, setCatDescription] = useState("");
  const [isDefault,      setIsDefault]      = useState(null); // null = loading
  const [blogContent,    setBlogContent]    = useState("");
  const [seoTitle,       setSeoTitle]       = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [loading,        setLoading]        = useState(true);
  const [error,          setError]          = useState(null);

  const isLoggedIn = !!premiumUser;

  // New access rule: any logged-in, non-expired premium user has full access.
  // No per-category check   if you're logged in and not expired, everything is unlocked.
  const hasAccess  = isLoggedIn && !sessionExpired;
  const userExpired = sessionExpired;

  const displayName =
    catName ||
    slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  // ── SEO values: use admin-set values or auto-generate ────────
  const pageTitle =
    seoTitle ||
    `${displayName} Mock Test 2025 | Online Practice | ${SITE_NAME}`;

  const pageDescription =
    seoDescription ||
    `Prepare for ${displayName} initial test with official-style MCQs. Free and premium mock tests covering Verbal, Non-Verbal, and Academic sections.`;

  const fetchTests = useCallback(() => {
    setLoading(true);
    setError(null);

    api
      .get(`/tests/category/${slug}`)
      .then(({ data }) => {
        setCatName(data.category?.name || "");
        setCatDescription(data.category?.description || "");
        setIsDefault(data.category?.isDefault !== false);
        setTests(data.tests || []);
        setBlogContent(data.category?.blogContent || "");
        setSeoTitle(data.category?.seoTitle || "");
        setSeoDescription(data.category?.seoDescription || "");
        // Note: we no longer read hasAccess / userExpired from the API response.
        // Access is determined entirely by AuthContext (isLoggedIn + sessionExpired).
      })
      .catch((err) => {
        const msg =
          err.code === "ERR_NETWORK" || err.message === "Network Error"
            ? "Network error   check your connection."
            : "Failed to load tests. Please try again.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  // Handler for locked-card click   only for non-logged-in visitors
  function handleLockedClick(test) {
    const intent = test
      ? {
          pathname:     `/category/${slug}`,
          action:       "start-test",
          testId:       test._id,
          categorySlug: slug,
        }
      : { pathname: `/category/${slug}` };

    openPremiumPopup({ mode: "visitor", intent });
  }

  // ── Header subtitle ────────────────────────────────────────
  function accessSubtitle() {
    if (!isLoggedIn)  return "Login or buy premium to unlock all tests.";
    if (userExpired)  return "Your subscription has expired. Contact admin to renew.";
    return "You have full access to all tests in this category.";
  }

  function accessBadge() {
    if (!isLoggedIn) return null;
    if (userExpired) {
      return (
        <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-1 rounded-full border bg-danger-light dark:bg-red-900/30 text-danger dark:text-red-300 border-danger/30 dark:border-red-700/30">
          ⚠ Subscription Expired
        </div>
      );
    }
    return (
      <div className="inline-flex items-center gap-1.5 mt-3 text-xs font-semibold px-3 py-1 rounded-full border bg-success-light dark:bg-green-900/30 text-green-700 dark:text-green-300 border-success/30 dark:border-green-700/30">
        ✓ Full Access
      </div>
    );
  }

  // ── Custom category: render CustomCategoryLayout ────────────
  if (!loading && isDefault === false) {
    const categoryObj = {
      name: displayName,
      slug,
      description: catDescription,
    };
    return (
      <>
        <Helmet>
          <title>{pageTitle}</title>
          <meta name="description" content={pageDescription} />
        </Helmet>
        <CustomCategoryLayout
          category={categoryObj}
          user={premiumUser}
          openLoginModal={openLoginModal}
          openPremiumPopup={openPremiumPopup}
        />
      </>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 dark:bg-dark-bg">
      {/* SEO meta tags */}
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
      </Helmet>

      {/* Page header */}
      <div className="mb-8">
        <p className="text-xs text-brand dark:text-blue-400 font-semibold uppercase tracking-widest mb-1">
          Mock Tests
        </p>
        <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100">{displayName}</h1>
        <p className="text-txt-secondary dark:text-slate-300 font-semibold text-sm mt-1">{accessSubtitle()}</p>
        {accessBadge()}
      </div>

      {/* Test list */}
      {loading ? (
        <div className="space-y-3">
          <SkeletonCard /><SkeletonCard /><SkeletonCard />
        </div>
      ) : error ? (
        <ErrorCard message={error} onRetry={fetchTests} />
      ) : tests.length === 0 ? (
        <div className="bg-bg dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl p-10 text-center text-txt-secondary dark:text-slate-300 text-sm">
          No published tests yet for this category.
        </div>
      ) : (
        <div className="space-y-3">
          {tests.map((test) => (
            <TestCard
              key={test._id}
              test={test}
              isLoggedIn={isLoggedIn}
              hasAccess={hasAccess}
              userExpired={userExpired}
              categoryName={displayName}
              onLockedClick={handleLockedClick}
            />
          ))}
        </div>
      )}

      {/* Bottom CTA for visitors only */}
      {!isLoggedIn && !loading && (
        <div className="mt-10 bg-brand-dark text-white rounded-2xl p-6 text-center">
          <p className="font-bold text-base mb-1">Ready to unlock all tests?</p>
          <p className="text-blue-200 text-sm mb-4">1 Week Rs. 300 · 1 Month Rs. 1,000</p>
          <button
            onClick={() => openPremiumPopup({ mode: "visitor" })}
            className="bg-accent hover:bg-accent-dark text-white font-bold text-sm px-6 py-2.5 rounded-full transition"
          >
            Buy Premium
          </button>
        </div>
      )}

      {/* About This Exam   SEO blog content section */}
      {!loading && !error && (
        <AboutSection blogContent={blogContent} />
      )}
    </div>
  );
}
