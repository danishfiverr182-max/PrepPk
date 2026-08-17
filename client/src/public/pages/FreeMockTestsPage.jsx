/**
 * src/public/pages/FreeMockTestsPage.jsx  (Part 8 Prompt 01, redesigned)
 *
 * Lists every published Free Mock Test across all categories.
 *
 * Route:  /free-mock-tests  (inside UserLayout / PublicLayout)
 * Data:   GET /api/free-tests  (public, no auth)
 *
 * ── Redesign notes (2nd pass) ───────────────────────────────────
 * The previous version paired a chip quick-jump menu with an accordion
 * list right below it — both showing the same category names at once,
 * plus a "which of these N sections is currently open" state to track.
 * That doubled-up navigation was the main source of confusion.
 *
 * This version uses one navigation surface instead of two:
 *   1. Browse — a single grid of category cards (name + free-test count).
 *      A search box filters this grid directly.
 *   2. Pick one — clicking a card swaps the grid for that category's test
 *      list, with a "← All categories" link back to the grid.
 * Only the selected category's tests are ever in the DOM, so this still
 * scales to hundreds of categories without turning into a long scroll —
 * without needing an accordion to hide the others.
 *
 * Data fetching (fetchGroups / fetchCustomGroups) is unchanged from the
 * previous version — this is a presentation-layer change only.
 */

import { useEffect, useMemo, useState } from "react";
import api from "../../api/axios";
import SeoHead from "../../components/SeoHead";
import { useSeoMeta } from "../../hooks/useSeoMeta";
import { usePublicCategories } from "../context/PublicCategoriesContext";
import FreeTestCard from "../components/FreeTestCard";
import FreeCustomTestCard from "../components/FreeCustomTestCard";

// ── Skeletons ────────────────────────────────────────────────
function CategoryCardSkeleton() {
  return <div className="h-20 rounded-xl bg-bg dark:bg-dark-bg animate-pulse" />;
}

// ── Category card (the grid) ────────────────────────────────────
function CategoryCard({ name, count, dotClassName, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-5 py-4 bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl text-left hover:border-brand hover:shadow-md transition-all"
    >
      <span className={`w-2 h-2 rounded-full shrink-0 ${dotClassName}`} />
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-txt-primary dark:text-slate-100 truncate">
          {name}
        </span>
        <span className="block text-xs text-txt-muted dark:text-slate-500 mt-0.5">
          {count} free {count === 1 ? "test" : "tests"}
        </span>
      </span>
      <svg className="w-4 h-4 text-txt-muted dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}

// ── Empty state (no tests published anywhere yet) ───────────────
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center py-24 text-center px-4">
      <div className="text-5xl mb-4">📋</div>
      <h3 className="text-lg font-bold text-txt-secondary dark:text-slate-300 mb-2">
        No free mock tests are available yet. Check back soon!
      </h3>
      <p className="text-sm text-txt-muted dark:text-slate-500 max-w-xs">
        Free tests are added regularly across all categories.
      </p>
    </div>
  );
}

// ── No search matches ───────────────────────────────────────────
function NoMatches({ query }) {
  return (
    <div className="text-center py-10 px-4">
      <p className="text-sm text-txt-secondary dark:text-slate-300">
        No categories match <span className="font-semibold">"{query}"</span>.
      </p>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function FreeMockTestsPage() {
  const [groups, setGroups]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState("");

  // Custom-category free tests (group-based, single-section)
  const [customGroups, setCustomGroups]   = useState([]);
  const [customLoading, setCustomLoading] = useState(true);

  // Which single category (if any) is currently open. null = showing the
  // browse grid. This is the only piece of navigation state on the page.
  const [selectedKey, setSelectedKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  function fetchGroups() {
    setLoading(true);
    setError("");
    api
      .get("/free-tests")
      .then((res) => { setGroups(res.data); })
      .catch((err) => {
        const msg =
          err.code === "ERR_NETWORK" || err.message === "Network Error"
            ? "Network error check your connection."
            : "Failed to load free mock tests. Please try again.";
        setError(msg);
      })
      .finally(() => { setLoading(false); });
  }

  // Categories are already fetched once by <PublicCategoriesProvider> at the
  // layout level and shared via context — reusing that here (instead of this
  // page firing its own separate GET /api/categories) removes a duplicate
  // network round-trip and the waterfall it caused, since the per-category
  // free-test requests below no longer have to wait on a second categories
  // fetch that had already happened elsewhere.
  const { categories, loading: categoriesLoading } = usePublicCategories();

  // Fetch free tests for every custom (non-default) category in parallel,
  // and keep only the categories that actually have published free tests.
  async function fetchCustomGroups(categoryList) {
    setCustomLoading(true);
    try {
      const customCategories = (categoryList || []).filter((c) => c.isDefault === false);

      const results = await Promise.all(
        customCategories.map((cat) =>
          api
            .get(`/free-mock-tests/custom/${cat.slug}`)
            .then(({ data }) => ({
              categorySlug: cat.slug,
              categoryName: cat.name,
              tests: (data.groups || []).flatMap((g) => g.tests || []),
            }))
            .catch(() => ({ categorySlug: cat.slug, categoryName: cat.name, tests: [] }))
        )
      );

      setCustomGroups(results.filter((r) => r.tests.length > 0));
    } catch {
      setCustomGroups([]);
    } finally {
      setCustomLoading(false);
    }
  }

  useEffect(() => {
    fetchGroups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    // Wait until the shared categories context has resolved (it started
    // fetching as soon as the layout mounted, so this is usually instant
    // by the time this page loads) rather than kicking off a second fetch.
    if (categoriesLoading) return;
    fetchCustomGroups(categories);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoriesLoading]);

  // ── One combined, alphabetised list of categories ───────────────
  // Sorted by name (rather than default-first-then-custom) so the grid
  // reads like a single scannable directory instead of two stacked lists —
  // the "default vs custom" split is an internal admin distinction, not
  // something a visitor needs to reason about.
  const allGroups = useMemo(() => {
    const d = groups.map((g) => ({
      key: `default:${g.categorySlug}`,
      categorySlug: g.categorySlug,
      categoryName: g.categoryName,
      tests: g.tests,
      kind: "default",
    }));
    const c = customGroups.map((g) => ({
      key: `custom:${g.categorySlug}`,
      categorySlug: g.categorySlug,
      categoryName: g.categoryName,
      tests: g.tests,
      kind: "custom",
    }));
    return [...d, ...c].sort((a, b) => a.categoryName.localeCompare(b.categoryName));
  }, [groups, customGroups]);

  const totalTests = useMemo(
    () => allGroups.reduce((sum, g) => sum + g.tests.length, 0),
    [allGroups]
  );

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allGroups;
    return allGroups.filter((g) => g.categoryName.toLowerCase().includes(q));
  }, [allGroups, searchQuery]);

  const selectedGroup = allGroups.find((g) => g.key === selectedKey) || null;

  function openCategory(key) {
    setSelectedKey(key);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function backToCategories() {
    setSelectedKey(null);
  }

  // ── SEO ──────────────────────────────────────────────────────
  const { title, description, jsonLd } = useSeoMeta("free-tests");

  const isLoading = loading || customLoading;

  return (
    <>
      <SeoHead title={title} description={description} jsonLd={jsonLd} />

      <div className="max-w-3xl mx-auto px-4 py-10 dark:bg-dark-bg">
        {/* Page header */}
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-300 bg-accent-light dark:bg-amber-900/30 border border-accent/30 dark:border-amber-700/30 px-3 py-1 rounded-full mb-3">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                clipRule="evenodd"
              />
            </svg>
            Free Access
          </div>
          <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100 mb-2">
            Free Mock Tests
          </h1>
          <p className="text-sm text-txt-secondary dark:text-slate-300">
            Practice with real-format questions for Pakistan Armed Forces exams no account needed.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <CategoryCardSkeleton />
            <CategoryCardSkeleton />
            <CategoryCardSkeleton />
            <CategoryCardSkeleton />
          </div>
        )}

        {/* Error (default-category fetch only — custom groups fail silently) */}
        {!loading && error && (
          <div className="bg-danger-light dark:bg-red-900/30 border border-danger/30 dark:border-red-700/30 rounded-xl px-5 py-6 text-center">
            <p className="text-sm font-semibold text-danger dark:text-red-300 mb-1">
              {!navigator.onLine ? "You appear to be offline." : "Something went wrong."}
            </p>
            <p className="text-xs text-danger dark:text-red-300 mb-4">{error}</p>
            <button
              onClick={fetchGroups}
              className="text-xs font-bold bg-danger hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
            >
              Try Again
            </button>
          </div>
        )}

        {/* Empty */}
        {!isLoading && !error && allGroups.length === 0 && <EmptyState />}

        {/* ═══════════════ Detail view: one category's tests ═══════════════ */}
        {!isLoading && !error && selectedGroup && (
          <>
            <button
              type="button"
              onClick={backToCategories}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand dark:text-blue-400 hover:underline mb-4"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              All categories
            </button>

            <div className="flex items-center justify-between gap-3 mb-4">
              <h2 className="text-lg font-bold text-txt-primary dark:text-slate-100">
                {selectedGroup.categoryName}
              </h2>
              <a
                href={`/category/${selectedGroup.categorySlug}`}
                className="text-xs font-semibold text-brand dark:text-blue-400 hover:underline shrink-0"
              >
                View full category →
              </a>
            </div>

            <div className="space-y-3">
              {selectedGroup.tests.map((test) =>
                selectedGroup.kind === "default" ? (
                  <FreeTestCard key={test._id} test={test} />
                ) : (
                  <FreeCustomTestCard key={test.id} test={test} />
                )
              )}
            </div>
          </>
        )}

        {/* ═══════════════ Browse view: all categories ═══════════════ */}
        {!isLoading && !error && !selectedGroup && allGroups.length > 0 && (
          <>
            {/* Summary line */}
            <div className="mb-4 text-xs text-txt-secondary dark:text-slate-300">
              <span className="font-semibold text-txt-primary dark:text-slate-100">{totalTests}</span>{" "}
              {totalTests === 1 ? "free test" : "free tests"} across{" "}
              <span className="font-semibold text-txt-primary dark:text-slate-100">{allGroups.length}</span>{" "}
              {allGroups.length === 1 ? "category" : "categories"}
            </div>

            {/* Search — only worth showing once there's enough to search through */}
            {allGroups.length > 6 && (
              <div className="relative mb-4">
                <svg
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted dark:text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-4.35-4.35m1.35-5.65a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search for your exam…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-lg text-txt-primary dark:text-slate-100 placeholder:text-txt-muted dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                />
              </div>
            )}

            {/* Category grid — the single navigation surface on this page */}
            {filteredGroups.length === 0 ? (
              <NoMatches query={searchQuery} />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {filteredGroups.map((group) => (
                  <CategoryCard
                    key={group.key}
                    name={group.categoryName}
                    count={group.tests.length}
                    dotClassName={group.kind === "default" ? "bg-accent" : "bg-success"}
                    onClick={() => openCategory(group.key)}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
