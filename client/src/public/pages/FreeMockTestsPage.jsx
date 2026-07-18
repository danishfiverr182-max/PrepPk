/**
 * src/public/pages/FreeMockTestsPage.jsx  (Part 8 Prompt 01, redesigned)
 *
 * Lists every published Free Mock Test across all categories.
 *
 * Route:  /free-mock-tests  (inside UserLayout / PublicLayout)
 * Data:   GET /api/free-tests  (public, no auth)
 *
 * ── Redesign notes ────────────────────────────────────────────
 * As the number of categories and tests grows into the hundreds, a flat
 * page with every test expanded became an endless scroll, and there was
 * no way to jump straight to a category or know it even existed without
 * scrolling past everything above it.
 *
 * This version adds:
 *   1. A category quick-jump menu (chips) pinned near the top. Clicking a
 *      chip expands that one category and smooth-scrolls to it.
 *   2. Each category is now a collapsible accordion section (collapsed
 *      by default) instead of always-expanded — only one is open at a
 *      time, so the list stays short and scannable no matter how many
 *      categories or tests exist.
 *   3. A search box to filter the quick-jump menu by category name,
 *      for when there are far too many categories to scan visually.
 *
 * Data fetching (fetchGroups / fetchCustomGroups) is unchanged from the
 * previous version — this is a presentation-layer change only.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import api from "../../api/axios";
import SeoHead from "../../components/SeoHead";
import { useSeoMeta } from "../../hooks/useSeoMeta";
import { usePublicCategories } from "../context/PublicCategoriesContext";
import FreeTestCard from "../components/FreeTestCard";
import FreeCustomTestCard from "../components/FreeCustomTestCard";

// ── Skeleton loader ───────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div className="mb-4">
      <div className="h-14 bg-bg dark:bg-dark-bg rounded-xl animate-pulse" />
    </div>
  );
}

// ── Chevron icon (rotates when expanded) ───────────────────────
function ChevronIcon({ open }) {
  return (
    <svg
      className={`w-4 h-4 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// ── Accordion header shared by both group types ───────────────
function GroupHeader({ dotClassName, name, count, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-bg/60 dark:hover:bg-dark-bg/40 transition-colors rounded-xl"
    >
      <span className={`w-1 h-5 rounded-full shrink-0 ${dotClassName}`} />
      <span className="text-base font-bold text-txt-primary dark:text-slate-100 flex-1 min-w-0 truncate">
        {name}
      </span>
      <span className="text-xs text-txt-muted dark:text-slate-500 font-medium shrink-0">
        {count} {count === 1 ? "test" : "tests"}
      </span>
      <ChevronIcon open={open} />
    </button>
  );
}

// ── Category group (default categories — 3-section tests) ──────
function CategoryGroup({ categoryName, tests, open, onToggle, sectionRef }) {
  return (
    <section
      ref={sectionRef}
      className="mb-3 bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl scroll-mt-24 overflow-hidden"
    >
      <GroupHeader
        dotClassName="bg-accent"
        name={categoryName}
        count={tests.length}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <div className="px-5 pb-5 space-y-3">
          {tests.map((test) => (
            <FreeTestCard key={test._id} test={test} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Category group (custom categories — single-section group tests) ──
function CustomCategoryGroup({ categoryName, categorySlug, tests, open, onToggle, sectionRef }) {
  return (
    <section
      ref={sectionRef}
      className="mb-3 bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl scroll-mt-24 overflow-hidden"
    >
      <GroupHeader
        dotClassName="bg-success"
        name={categoryName}
        count={tests.length}
        open={open}
        onToggle={onToggle}
      />
      {open && (
        <div className="px-5 pb-5 space-y-3">
          <a
            href={`/category/${categorySlug}`}
            className="inline-block text-xs font-semibold text-success hover:underline mb-1"
          >
            View full category →
          </a>
          {tests.map((test) => (
            <FreeCustomTestCard key={test.id} test={test} />
          ))}
        </div>
      )}
    </section>
  );
}

// ── Empty state ───────────────────────────────────────────────
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

  // ── Accordion + quick-jump state ──────────────────────────────
  // expandedKey identifies the single open section, e.g. "default:pak-army"
  // or "custom:some-slug". null means everything is collapsed.
  const [expandedKey, setExpandedKey] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const sectionRefs = useRef({});

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

  const totalTests = groups.reduce((sum, g) => sum + g.tests.length, 0);
  const totalCustomTests = customGroups.reduce((sum, g) => sum + g.tests.length, 0);
  const grandTotalTests = totalTests + totalCustomTests;
  const grandTotalCategories = groups.length + customGroups.length;

  // ── Combined chip list for the quick-jump menu ─────────────────
  const allChips = useMemo(() => {
    const defaultChips = groups.map((g) => ({
      key: `default:${g.categorySlug}`,
      name: g.categoryName,
      count: g.tests.length,
      dotClassName: "bg-accent",
    }));
    const customChips = customGroups.map((g) => ({
      key: `custom:${g.categorySlug}`,
      name: g.categoryName,
      count: g.tests.length,
      dotClassName: "bg-success",
    }));
    return [...defaultChips, ...customChips];
  }, [groups, customGroups]);

  const filteredChips = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return allChips;
    return allChips.filter((c) => c.name.toLowerCase().includes(q));
  }, [allChips, searchQuery]);

  function handleChipClick(key) {
    setExpandedKey(key);
    // Wait for the section to render open before scrolling to it
    requestAnimationFrame(() => {
      sectionRefs.current[key]?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function toggleSection(key) {
    setExpandedKey((prev) => (prev === key ? null : key));
  }

  // ── SEO ──────────────────────────────────────────────────────
  const { title, description, jsonLd } = useSeoMeta("free-tests");

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
        {(loading || customLoading) && (
          <>
            <CategorySkeleton />
            <CategorySkeleton />
            <CategorySkeleton />
          </>
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
        {!loading && !customLoading && !error && grandTotalCategories === 0 && <EmptyState />}

        {/* Quick-jump menu + accordion list */}
        {!loading && !customLoading && !error && grandTotalCategories > 0 && (
          <>
            {/* Summary pill */}
            <div className="mb-4 flex items-center gap-2 text-xs text-txt-secondary dark:text-slate-300">
              <span className="font-semibold text-txt-primary dark:text-slate-100">{grandTotalTests}</span>
              {grandTotalTests === 1 ? "free test" : "free tests"} across{" "}
              <span className="font-semibold text-txt-primary dark:text-slate-100">{grandTotalCategories}</span>{" "}
              {grandTotalCategories === 1 ? "category" : "categories"}
            </div>

            {/* Search box — only worth showing once there's enough to search through */}
            {allChips.length > 6 && (
              <div className="relative mb-3">
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
                  placeholder="Search a category…"
                  className="w-full pl-10 pr-4 py-2.5 text-sm bg-surface dark:bg-dark-surface border border-border dark:border-dark-border rounded-lg text-txt-primary dark:text-slate-100 placeholder:text-txt-muted dark:placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:border-brand"
                />
              </div>
            )}

            {/* Quick-jump chip menu */}
            <div className="mb-6">
              {filteredChips.length === 0 ? (
                <NoMatches query={searchQuery} />
              ) : (
                <div className="flex flex-wrap gap-2">
                  {filteredChips.map((chip) => {
                    const isActive = expandedKey === chip.key;
                    return (
                      <button
                        key={chip.key}
                        type="button"
                        onClick={() => handleChipClick(chip.key)}
                        className={`inline-flex items-center gap-2 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors ${
                          isActive
                            ? "bg-brand text-white border-brand"
                            : "bg-surface dark:bg-dark-surface text-txt-primary dark:text-slate-100 border-border dark:border-dark-border hover:border-brand hover:text-brand"
                        }`}
                      >
                        <span className={`w-1.5 h-1.5 rounded-full ${isActive ? "bg-white" : chip.dotClassName}`} />
                        {chip.name}
                        <span className={isActive ? "text-white/75" : "text-txt-muted dark:text-slate-500"}>
                          {chip.count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Accordion sections */}
            {groups.map((group) => {
              const key = `default:${group.categorySlug}`;
              return (
                <CategoryGroup
                  key={key}
                  categoryName={group.categoryName}
                  tests={group.tests}
                  open={expandedKey === key}
                  onToggle={() => toggleSection(key)}
                  sectionRef={(el) => { sectionRefs.current[key] = el; }}
                />
              );
            })}

            {customGroups.map((group) => {
              const key = `custom:${group.categorySlug}`;
              return (
                <CustomCategoryGroup
                  key={key}
                  categoryName={group.categoryName}
                  categorySlug={group.categorySlug}
                  tests={group.tests}
                  open={expandedKey === key}
                  onToggle={() => toggleSection(key)}
                  sectionRef={(el) => { sectionRefs.current[key] = el; }}
                />
              );
            })}
          </>
        )}
      </div>
    </>
  );
}