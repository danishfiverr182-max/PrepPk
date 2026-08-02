/**
 * src/components/user/CustomCategoryLayout.jsx  (updated   premium gates + free tests tab)
 *
 * Changes:
 *  - Premium tests show a lock icon when the user is not logged in or lacks access.
 *    Clicking a locked test opens the LoginModal instead of navigating.
 *  - A "Free Tests" tab appears alongside the group sub-menu when free custom tests
 *    exist for this category (fetched from /api/free-custom-tests/:categorySlug).
 *  - Free tests are accessible without login and navigate to /test/free-custom/:id.
 *  - Premium tests navigate to /test/custom/:id (existing behaviour, now gated).
 *
 * Props:
 *   category  object  { name, slug, description }
 *   user      object|null  (from AuthContext   null if not logged in)
 */

import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import AboutSection from "./AboutSection";

// ── Helpers ───────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds) return " ";
  const m = Math.round(seconds / 60);
  return `${m} minute${m !== 1 ? "s" : ""}`;
}

function SkeletonGroup() {
  return (
    <div className="animate-pulse space-y-3">
      <div className="h-5 w-32 bg-border dark:bg-dark-border rounded" />
      {[1, 2].map((i) => <div key={i} className="h-20 bg-bg dark:bg-dark-bg rounded-xl" />)}
    </div>
  );
}

// ── Premium test card ─────────────────────────────────────────
export function PremiumTestCard({ test, onStart, onLocked }) {
  const locked = test.locked;
  return (
    <div className={`bg-surface dark:bg-dark-surface rounded-xl border shadow-sm transition-all p-4 flex items-center justify-between gap-4 ${
      locked ? "border-border dark:border-dark-border opacity-80" : "border-border dark:border-dark-border hover:shadow-md hover:border-brand-light dark:hover:border-dark-border"
    }`}>
      <div className="min-w-0 flex items-start gap-3">
        {locked && (
          <div className="flex-shrink-0 mt-0.5">
            <svg className="w-4 h-4 text-txt-muted dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
        )}
        <div>
          <p className="text-sm font-bold text-txt-primary dark:text-slate-100 truncate">{test.displayName}</p>
          <p className="text-xs text-txt-secondary dark:text-slate-300 mt-1">
            {test.totalMcqs ? `${test.totalMcqs} MCQs` : " "}
            {test.timeLimitSeconds ? ` · ${formatTime(test.timeLimitSeconds)}` : ""}
            {locked && <span className="ml-2 text-amber-700 dark:text-amber-300 font-medium">Premium</span>}
          </p>
        </div>
      </div>
      <button
        onClick={() => locked ? onLocked(test) : onStart(test)}
        className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition ${
          locked
            ? "bg-bg dark:bg-dark-surface2 hover:bg-accent-light dark:hover:bg-amber-900/30 text-txt-secondary dark:text-slate-300 hover:text-amber-700 dark:hover:text-amber-300 border border-border dark:border-dark-border"
            : "bg-brand dark:bg-blue-500 hover:bg-brand-dark dark:hover:bg-blue-600 text-white"
        }`}
      >
        {locked ? "Unlock" : "Start Test"}
      </button>
    </div>
  );
}

// ── Free test card ────────────────────────────────────────────
export function FreeTestCard({ test, onStart }) {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-success/30 dark:border-green-700/30 shadow-sm hover:shadow-md hover:border-success dark:hover:border-green-600 transition-all p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <p className="text-sm font-bold text-txt-primary dark:text-slate-100 truncate">{test.displayName}</p>
          <span className="text-xs bg-success-light dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-success/30 dark:border-green-700/30 px-1.5 py-0.5 rounded-full font-semibold flex-shrink-0">FREE</span>
        </div>
        <p className="text-xs text-txt-secondary dark:text-slate-300">
          {test.totalMcqs ? `${test.totalMcqs} MCQs` : " "}
          {test.timeLimitSeconds ? ` · ${formatTime(test.timeLimitSeconds)}` : ""}
        </p>
      </div>
      <button
        onClick={() => onStart(test)}
        className="shrink-0 text-xs font-bold bg-success dark:bg-green-600 hover:bg-green-700 dark:hover:bg-green-700 text-white px-4 py-2 rounded-lg transition"
      >
        Start Test
      </button>
    </div>
  );
}

// ── Search result card ────────────────────────────────────────
function SearchResultCard({ result, onStart, onLocked }) {
  const locked = result.locked;
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-sm hover:shadow-md hover:border-brand-light dark:hover:border-dark-border transition-all p-4 flex items-center justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-bold text-txt-primary dark:text-slate-100 truncate">{result.displayName}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="inline-block text-xs font-semibold bg-brand-light dark:bg-blue-900/30 text-brand dark:text-blue-300 border border-brand/30 dark:border-blue-700/30 px-2 py-0.5 rounded-full">
            {result.groupName}
          </span>
          <span className="text-xs text-txt-muted dark:text-slate-500">
            {result.totalMcqs ? `${result.totalMcqs} MCQs` : ""}
            {result.timeLimitSeconds ? ` · ${formatTime(result.timeLimitSeconds)}` : ""}
          </span>
          {locked && <span className="text-xs text-amber-700 dark:text-amber-300 font-medium">Premium</span>}
        </div>
      </div>
      <button
        onClick={() => locked ? onLocked(result) : onStart(result)}
        className={`shrink-0 text-xs font-bold px-4 py-2 rounded-lg transition ${
          locked ? "bg-bg dark:bg-dark-surface2 text-txt-muted dark:text-slate-500 border border-border dark:border-dark-border" : "bg-brand dark:bg-blue-500 hover:bg-brand-dark dark:hover:bg-blue-600 text-white"
        }`}
      >
        {locked ? "Unlock" : "Start Test"}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function CustomCategoryLayout({ category, user, openLoginModal, openPremiumPopup }) {
  const navigate = useNavigate();
  const { name: catName, slug: catSlug, description: catDescription } = category;

  // View mode: "premium" | "free"
  const [viewMode, setViewMode] = useState("premium");

  // Premium tests
  const [groups, setGroups]               = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activeGroup, setActiveGroup]     = useState("all");

  // Free tests
  const [freeGroups, setFreeGroups]           = useState([]);
  const [freeGroupsLoading, setFreeGroupsLoading] = useState(true);
  const [hasFreeTests, setHasFreeTests]       = useState(false);
  const [activeFreeGroup, setActiveFreeGroup] = useState("all");

  // Search
  const [searchQuery, setSearchQuery]     = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef(null);

  // ── Fetch premium groups ──────────────────────────────────
  // Depends on `user` (in addition to catSlug) because the server computes
  // each test's `locked` flag per-request from the caller's auth state
  // (optionalUserAuth). Without `user` in the deps, logging in/out while
  // already sitting on this page left the previously-fetched `locked`
  // values stale until a full page reload remounted the component — this
  // is what caused tests to keep showing "Unlock" right after login (and
  // vice versa right after logout) until the user manually refreshed.
  useEffect(() => {
    if (!catSlug) return;
    setGroupsLoading(true);
    api
      .get(`/custom-tests/${catSlug}`)
      .then(({ data }) => setGroups(data.groups || []))
      .catch(() => setGroups([]))
      .finally(() => setGroupsLoading(false));
  }, [catSlug, user]);

  // ── Fetch free groups ─────────────────────────────────────
  useEffect(() => {
    if (!catSlug) return;
    setFreeGroupsLoading(true);
    api
      .get(`/free-custom-tests/${catSlug}`)
      .then(({ data }) => {
        const g = data.groups || [];
        setFreeGroups(g);
        setHasFreeTests(g.length > 0);
      })
      .catch(() => {
        setFreeGroups([]);
        setHasFreeTests(false);
      })
      .finally(() => setFreeGroupsLoading(false));
  }, [catSlug]);

  // ── Debounced search ──────────────────────────────────────
  const handleSearchChange = useCallback((e) => {
    const q = e.target.value;
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      const endpoint = viewMode === "free"
        ? `/free-custom-tests/${catSlug}?search=${encodeURIComponent(q.trim())}`
        : `/custom-tests/${catSlug}?search=${encodeURIComponent(q.trim())}`;
      api
        .get(endpoint)
        .then(({ data }) => setSearchResults(data.results || []))
        .catch(() => setSearchResults([]))
        .finally(() => setSearchLoading(false));
    }, 300);
  }, [catSlug, viewMode]);

  // ── Navigation ────────────────────────────────────────────
  function handleStartPremiumTest(test) {
    navigate(`/test/custom/${test.testId || test.id}`);
  }

  function handleStartFreeTest(test) {
    navigate(`/test/free-custom/${test.testId || test.id}`);
  }

  function handleLockedTest(test) {
    if (!user) {
      // Not logged in   open login modal if available, else navigate
      if (openLoginModal) {
        openLoginModal();
      } else {
        navigate("/login");
      }
    } else {
      // Logged in but expired   open premium popup
      if (openPremiumPopup) {
        openPremiumPopup({ mode: "expired" });
      } else {
        navigate("/login");
      }
    }
  }

  // ── Derived data ──────────────────────────────────────────
  const isSearchActive = searchQuery.trim().length > 0;

  function getDisplayGroups() {
    const source = viewMode === "free" ? freeGroups : groups;
    const active = viewMode === "free" ? activeFreeGroup : activeGroup;
    if (active === "all") return source;
    return source.filter((g) => g.id?.toString() === active);
  }

  const displayGroups = getDisplayGroups();
  const currentActive = viewMode === "free" ? activeFreeGroup : activeGroup;
  const setCurrentActive = viewMode === "free" ? setActiveFreeGroup : setActiveGroup;

  const menuItems = [
    { id: "all", label: "All Tests" },
    ...(viewMode === "free" ? freeGroups : groups).map((g) => ({
      id: g.id?.toString(),
      label: g.name,
      slug: g.slug,
    })),
  ];

  const isLoading = viewMode === "free" ? freeGroupsLoading : groupsLoading;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-8 py-10 dark:bg-dark-bg">
      {/* ── Header ──────────────────────────────────────── */}
      <div className="mb-8">
        <p className="text-xs text-brand dark:text-blue-400 font-semibold uppercase tracking-widest mb-1">Mock Tests</p>
        <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100">{catName} Mock Tests</h1>
        {catDescription && <p className="text-sm text-txt-secondary dark:text-slate-300 mt-2 max-w-2xl">{catDescription}</p>}

        {/* View mode tabs */}
        {hasFreeTests && (
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setViewMode("premium"); setSearchQuery(""); setSearchResults([]); }}
              className={`text-sm font-semibold px-4 py-2 rounded-full border transition ${
                viewMode === "premium"
                  ? "bg-brand-dark dark:bg-blue-900/40 text-accent dark:text-amber-300 border-brand-dark dark:border-blue-700/40"
                  : "text-txt-secondary dark:text-slate-300 border-border dark:border-dark-border hover:border-txt-muted dark:hover:border-slate-500"
              }`}
            >
              🔒 Premium Tests
            </button>
            <button
              onClick={() => { setViewMode("free"); setSearchQuery(""); setSearchResults([]); }}
              className={`text-sm font-semibold px-4 py-2 rounded-full border transition ${
                viewMode === "free"
                  ? "bg-success dark:bg-green-600 text-white border-success dark:border-green-600"
                  : "text-txt-secondary dark:text-slate-300 border-border dark:border-dark-border hover:border-txt-muted dark:hover:border-slate-500"
              }`}
            >
              ✅ Free Tests
            </button>
          </div>
        )}

        {/* Search bar */}
        <div className="relative mt-5 max-w-lg">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="w-4 h-4 text-txt-muted dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search tests… e.g., Forest, Police, Teaching"
            className="w-full pl-9 pr-4 py-2.5 text-sm border border-border dark:border-dark-border rounded-xl bg-surface dark:bg-dark-surface text-txt-primary dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => { setSearchQuery(""); setSearchResults([]); }}
              className="absolute inset-y-0 right-3 flex items-center text-txt-muted dark:text-slate-500 hover:text-txt-secondary dark:hover:text-slate-300 transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* ── Premium mode: not logged in banner ──────────── */}
      {viewMode === "premium" && !user && groups.length > 0 && (
        <div className="mb-5 bg-accent-light dark:bg-amber-900/30 border border-accent/30 dark:border-amber-700/30 rounded-xl px-4 py-3 flex items-center gap-3">
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

      {/* ── Search Results ───────────────────────────────── */}
      {isSearchActive ? (
        <div className="space-y-3">
          {searchLoading ? (
            <div className="flex items-center gap-2 text-sm text-txt-muted dark:text-slate-500 py-6">
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
              Searching…
            </div>
          ) : searchResults.length === 0 ? (
            <div className="bg-bg dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl p-8 text-center text-sm text-txt-secondary dark:text-slate-300">
              No tests found for <span className="font-semibold">"{searchQuery}"</span>. Try a different keyword.
            </div>
          ) : (
            searchResults.map((result) =>
              viewMode === "free" ? (
                <FreeTestCard key={result.testId} test={result} onStart={handleStartFreeTest} />
              ) : (
                <SearchResultCard key={result.testId} result={result} onStart={handleStartPremiumTest} onLocked={handleLockedTest} />
              )
            )
          )}
        </div>
      ) : (
        /* ── Normal Mode ─────────────────────────────────── */
        <div>
          {isLoading ? (
            <SkeletonGroup />
          ) : displayGroups.length === 0 && menuItems.length <= 1 ? (
            <div className="bg-bg dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl p-12 text-center text-txt-secondary dark:text-slate-300 text-sm">
              {viewMode === "free" ? "No free tests available for this category yet." : "Tests for this category are coming soon."}
            </div>
          ) : (
            <div className="md:flex md:gap-8">
              {/* ── Sub-Menu ──────────────────────────────── */}
              <aside className="hidden md:block shrink-0 w-48">
                <nav className="space-y-1 sticky top-6">
                  {menuItems.map((item) => {
                    const active = currentActive === item.id;
                    const activeClasses = viewMode === "free"
                      ? "bg-success dark:bg-green-600 text-white"
                      : "bg-brand-dark dark:bg-blue-900/40 text-accent dark:text-blue-300";
                    const inactiveClasses = "text-txt-secondary dark:text-slate-200 hover:bg-bg dark:hover:bg-dark-surface2 hover:text-txt-primary dark:hover:text-slate-100";

                    // "All Tests" stays an in-page filter (no URL of its own).
                    // Individual groups now navigate to their own indexable
                    // public page (/category/:catSlug/:groupSlug) instead of
                    // just swapping which blogContent/tests are shown here.
                    if (item.id === "all") {
                      return (
                        <button
                          key={item.id}
                          onClick={() => setCurrentActive(item.id)}
                          className={`w-full text-left text-sm font-semibold px-4 py-2.5 rounded-xl transition ${
                            active ? activeClasses : inactiveClasses
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        to={`/category/${catSlug}/${item.slug}`}
                        className={`block w-full text-left text-sm font-semibold px-4 py-2.5 rounded-xl transition ${
                          active ? activeClasses : inactiveClasses
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </nav>
              </aside>

              {/* Mobile horizontal tab bar — active tab gets a gold underline */}
              <div className="md:hidden -mx-4 px-4 mb-5 overflow-x-auto border-b border-border dark:border-dark-border">
                <div className="flex gap-5 pb-0">
                  {menuItems.map((item) => {
                    const active = currentActive === item.id;
                    const activeClasses = "text-txt-primary dark:text-slate-100 border-accent";
                    const inactiveClasses = "text-txt-muted dark:text-slate-500 border-transparent hover:text-txt-secondary dark:hover:text-slate-300";

                    if (item.id === "all") {
                      return (
                        <button
                          key={item.id}
                          onClick={() => setCurrentActive(item.id)}
                          className={`shrink-0 text-sm font-semibold pb-2.5 pt-1 transition whitespace-nowrap border-b-2 ${
                            active ? activeClasses : inactiveClasses
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    }

                    return (
                      <Link
                        key={item.id}
                        to={`/category/${catSlug}/${item.slug}`}
                        className={`shrink-0 text-sm font-semibold pb-2.5 pt-1 transition whitespace-nowrap border-b-2 ${
                          active ? activeClasses : inactiveClasses
                        }`}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>

              {/* ── Test Listings ─────────────────────────── */}
              <div className="flex-1 min-w-0 space-y-8">
                {displayGroups.map((group) => (
                  <div key={group.id}>
                    {/* Group header in "All Tests" mode — links to the group's
                        own public page too, so link authority isn't only
                        distributed via the sidebar/tab menu above. */}
                    {currentActive === "all" && (
                      <div className="flex items-center gap-2 mb-3">
                        <Link
                          to={`/category/${catSlug}/${group.slug}`}
                          className="text-xs font-bold uppercase tracking-widest text-txt-muted dark:text-slate-500 hover:text-txt-secondary dark:hover:text-slate-300 transition"
                        >
                          {group.name}
                        </Link>
                        {viewMode === "premium" && group.locked && (
                          <span className="text-xs bg-accent-light dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 border border-accent/30 dark:border-amber-700/30 px-1.5 py-0.5 rounded-full">
                            Requires access
                          </span>
                        )}
                      </div>
                    )}

                    {group.tests.length === 0 ? (
                      <p className="text-sm text-txt-muted dark:text-slate-500 italic">No published tests in this group yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {group.tests.map((test) =>
                          viewMode === "free" ? (
                            <FreeTestCard key={test.id} test={test} onStart={handleStartFreeTest} />
                          ) : (
                            <PremiumTestCard
                              key={test.id}
                              test={test}
                              onStart={handleStartPremiumTest}
                              onLocked={handleLockedTest}
                            />
                          )
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {displayGroups.length === 0 && (
                  <p className="text-sm text-txt-muted dark:text-slate-500 italic">No tests available.</p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* About This Exam — SEO blog content section */}
      {!isLoading && !isSearchActive && currentActive !== "all" && (() => {
        const source = viewMode === "free" ? freeGroups : groups;
        const activeGroup = source.find((g) => g.id?.toString() === currentActive);
        return activeGroup?.blogContent
          ? <AboutSection blogContent={activeGroup.blogContent} />
          : null;
      })()}
    </div>
  );
}