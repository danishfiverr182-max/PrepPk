/**
 * src/components/user/CustomCategoryLayout.jsx  (TestHub redesign)
 *
 * Redesigned TestHub for custom categories. Renders inside the existing
 * app shell — the top navbar, main menu, and footer live in layout
 * components above/below this one and are untouched by this file.
 *
 * Structure:
 *   1. Hero — centered category header. Title in the middle, Premium/Free
 *      counts flanking it left/right. Sets up the color language (gold =
 *      premium, green = free) that continues straight down into the body.
 *   2. Utility bar — one search box + one sort control that scope both
 *      columns at once.
 *   3. Two-column body — Premium (left) / Free (right), each with its own
 *      glassmorphism subgroup rail ("All Tests" + every subgroup) and its
 *      own responsive test-card grid with client-side "Load more" paging.
 *      Columns stack on mobile, sit side-by-side with a hairline divider
 *      from md breakpoint up.
 *
 * Data/behaviour preserved from the previous version:
 *   - Same two fetches: /custom-tests/:catSlug (premium) and
 *     /free-custom-tests/:catSlug (free), re-fetched when `user` changes
 *     so locked flags stay correct across login/logout without a reload.
 *   - Same debounced server-side search endpoints, now fired for BOTH
 *     premium and free simultaneously so one search box can drive both
 *     columns at once.
 *   - Same navigation targets: /test/custom/:id (premium) and
 *     /test/free-custom/:id (free); same locked-test handling (login modal
 *     for guests, premium popup for expired users).
 *   - PremiumTestCard / FreeTestCard are still named exports with the same
 *     { test, onStart, onLocked } prop shape — TestGroupPage.jsx imports
 *     these directly and keeps working unchanged.
 *
 * New:
 *   - Difficulty badge — only rendered if the test record actually carries
 *     a `difficulty` field (nothing is fabricated; the current API/schema
 *     doesn't send one yet, so it silently stays hidden until it does).
 *   - Sort (Newest / Popular / A-Z) — client-side, since the full group
 *     list is already fetched. "Newest" and "A-Z" are exact (testNumber
 *     desc / displayName asc). "Popular" has no engagement metric in the
 *     API yet, so it currently falls back to catalogue order (testNumber
 *     asc) — wired up and ready to swap to a real signal later.
 *   - "Load more" paging per column so a subgroup with hundreds of tests
 *     never dumps them all into the DOM at once.
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import AboutSection from "./AboutSection";

const PAGE_SIZE = 9;

// ── Helpers ───────────────────────────────────────────────────
function formatTime(seconds) {
  if (!seconds) return null;
  const m = Math.round(seconds / 60);
  return `${m} min${m !== 1 ? "s" : ""}`;
}

function normaliseTest(test) {
  return {
    id: test.testId || test.id,
    displayName: test.displayName,
    groupName: test.groupName,
    totalMcqs: test.totalMcqs,
    timeLimitSeconds: test.timeLimitSeconds,
    locked: !!test.locked,
    difficulty: test.difficulty || null,
    testNumber: test.testNumber ?? null,
  };
}

function sortTests(tests, sortBy) {
  const arr = [...tests];
  if (sortBy === "newest") {
    arr.sort((a, b) => (b.testNumber ?? 0) - (a.testNumber ?? 0));
  } else if (sortBy === "az") {
    arr.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));
  } else {
    // "popular" — no engagement signal in the API yet; catalogue order
    // (oldest/most-established first) is the most defensible stand-in.
    arr.sort((a, b) => (a.testNumber ?? 0) - (b.testNumber ?? 0));
  }
  return arr;
}

// ── Difficulty badge (only renders if data provides a level) ───
function DifficultyBadge({ level }) {
  if (!level) return null;
  const key = String(level).toLowerCase();
  const styles = {
    easy: "bg-success-light dark:bg-green-900/30 text-success-dark dark:text-green-300 border-success/30 dark:border-green-700/30",
    beginner: "bg-success-light dark:bg-green-900/30 text-success-dark dark:text-green-300 border-success/30 dark:border-green-700/30",
    medium: "bg-accent-light dark:bg-amber-900/30 text-accent-darker dark:text-amber-300 border-accent/30 dark:border-amber-700/30",
    intermediate: "bg-accent-light dark:bg-amber-900/30 text-accent-darker dark:text-amber-300 border-accent/30 dark:border-amber-700/30",
    hard: "bg-danger-light dark:bg-red-900/30 text-danger dark:text-red-300 border-danger/30 dark:border-red-700/30",
    advanced: "bg-danger-light dark:bg-red-900/30 text-danger dark:text-red-300 border-danger/30 dark:border-red-700/30",
  };
  const cls = styles[key] || "bg-bg dark:bg-dark-surface2 text-txt-secondary dark:text-slate-300 border-border dark:border-dark-border";
  return (
    <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-full border capitalize ${cls}`}>
      {level}
    </span>
  );
}

// ── Meta row shared by both card types ──────────────────────────
function CardMeta({ test }) {
  const time = formatTime(test.timeLimitSeconds);
  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-2">
      {test.totalMcqs ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-txt-secondary dark:text-slate-300 bg-bg dark:bg-dark-surface2 border border-border dark:border-dark-border px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          {test.totalMcqs} Qs
        </span>
      ) : null}
      {time ? (
        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-txt-secondary dark:text-slate-300 bg-bg dark:bg-dark-surface2 border border-border dark:border-dark-border px-2 py-0.5 rounded-full">
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {time}
        </span>
      ) : null}
      <DifficultyBadge level={test.difficulty} />
    </div>
  );
}

// ── Premium test card ─────────────────────────────────────────
export function PremiumTestCard({ test, onStart, onLocked }) {
  const locked = test.locked;
  return (
    <div
      className={`group relative h-full flex flex-col justify-between rounded-2xl border p-4 transition-all duration-300 ${
        locked
          ? "bg-surface/70 dark:bg-dark-surface/60 border-border dark:border-dark-border"
          : "bg-surface dark:bg-dark-surface border-border dark:border-dark-border hover:-translate-y-1 hover:shadow-premium hover:border-accent/40 dark:hover:border-accent/40"
      }`}
    >
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-accent-darker dark:text-amber-300 bg-accent-light dark:bg-amber-900/30 border border-accent/30 dark:border-amber-700/30 px-2 py-0.5 rounded-full shrink-0">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path d="M10 1l2.6 5.9L19 8l-4.9 4.3L15.5 19 10 15.6 4.5 19l1.4-6.7L1 8l6.4-1.1L10 1z" /></svg>
            Premium
          </span>
          {locked && (
            <svg className="w-4 h-4 text-txt-muted dark:text-slate-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          )}
        </div>
        <p className="text-sm font-bold text-txt-primary dark:text-slate-100 leading-snug line-clamp-2">
          {test.displayName}
        </p>
        {test.groupName && (
          <p className="text-[11px] text-txt-muted dark:text-slate-500 mt-0.5">{test.groupName}</p>
        )}
        <CardMeta test={test} />
      </div>
      <button
        onClick={() => (locked ? onLocked(test) : onStart(test))}
        className={`mt-4 w-full text-xs font-bold px-4 py-2.5 rounded-xl transition ${
          locked
            ? "bg-bg dark:bg-dark-surface2 hover:bg-accent-light dark:hover:bg-amber-900/30 text-txt-secondary dark:text-slate-300 hover:text-accent-darker dark:hover:text-amber-300 border border-border dark:border-dark-border"
            : "bg-gradient-to-r from-accent to-accent-dark hover:shadow-glow-gold text-white"
        }`}
      >
        {locked ? "Unlock with Premium" : "Start Test →"}
      </button>
    </div>
  );
}

// ── Free test card ────────────────────────────────────────────
export function FreeTestCard({ test, onStart }) {
  return (
    <div className="group h-full flex flex-col justify-between rounded-2xl border border-border dark:border-dark-border bg-surface dark:bg-dark-surface p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-md hover:border-success/40 dark:hover:border-success/40">
      <div>
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-success-darker dark:text-green-300 bg-success-light dark:bg-green-900/30 border border-success/30 dark:border-green-700/30 px-2 py-0.5 rounded-full shrink-0">
            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.7 5.3a1 1 0 010 1.4l-7.4 7.4a1 1 0 01-1.4 0L3.3 9.5a1 1 0 111.4-1.4l3.6 3.6 6.7-6.7a1 1 0 011.4 0z" clipRule="evenodd" /></svg>
            Free
          </span>
        </div>
        <p className="text-sm font-bold text-txt-primary dark:text-slate-100 leading-snug line-clamp-2">
          {test.displayName}
        </p>
        {test.groupName && (
          <p className="text-[11px] text-txt-muted dark:text-slate-500 mt-0.5">{test.groupName}</p>
        )}
        <CardMeta test={test} />
      </div>
      <button
        onClick={() => onStart(test)}
        className="mt-4 w-full text-xs font-bold px-4 py-2.5 rounded-xl bg-gradient-to-r from-success to-success-dark hover:shadow-glow-green text-white transition"
      >
        Start Test →
      </button>
    </div>
  );
}

// ── Skeletons ────────────────────────────────────────────────
function ChipSkeleton() {
  return (
    <div className="flex gap-2 animate-pulse">
      {[1, 2, 3].map((i) => <div key={i} className="h-10 w-28 bg-bg dark:bg-dark-surface2 rounded-2xl" />)}
    </div>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="h-36 bg-bg dark:bg-dark-surface2 rounded-2xl" />
      ))}
    </div>
  );
}

// ── Full-shell skeleton ──────────────────────────────────────────
// Mirrors this component's actual hero + search/sort + two-column shape.
// CategoryPage.jsx renders this while it's still figuring out whether a
// category is "default" or "custom", so the loading state matches whichever
// layout is about to appear instead of flashing the old single-column list
// design before swapping to this one.
export function CustomCategoryLayoutSkeleton({ categoryName }) {
  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 dark:bg-dark-bg">
      {/* Hero */}
      <div className="relative mb-10">
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-0 text-center">
          <div className="md:flex-1 md:flex md:items-center md:justify-end md:pr-6">
            <div className="h-9 w-28 rounded-2xl bg-bg dark:bg-dark-surface2 animate-pulse" />
          </div>
          <div className="md:px-8">
            <div className="h-3 w-32 mx-auto rounded bg-bg dark:bg-dark-surface2 animate-pulse mb-3" />
            {categoryName ? (
              <h1 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight text-txt-primary dark:text-white">
                {categoryName}
              </h1>
            ) : (
              <div className="h-8 w-56 mx-auto rounded bg-bg dark:bg-dark-surface2 animate-pulse" />
            )}
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-accent via-brand to-success" />
          </div>
          <div className="md:flex-1 md:flex md:items-center md:justify-start md:pl-6">
            <div className="h-9 w-24 rounded-2xl bg-bg dark:bg-dark-surface2 animate-pulse" />
          </div>
        </div>
      </div>

      {/* Search + sort */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
        <div className="flex-1 h-10 rounded-xl bg-bg dark:bg-dark-surface2 animate-pulse" />
        <div className="h-10 w-32 rounded-xl bg-bg dark:bg-dark-surface2 animate-pulse shrink-0" />
      </div>

      {/* Two columns */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-0">
        <div className="md:pr-8 flex-1 min-w-0 space-y-5">
          <ChipSkeleton />
          <GridSkeleton />
        </div>
        <div className="hidden md:block w-px bg-border dark:bg-dark-border" />
        <div className="md:hidden h-px bg-border dark:bg-dark-border" />
        <div className="md:pl-8 flex-1 min-w-0 space-y-5">
          <ChipSkeleton />
          <GridSkeleton />
        </div>
      </div>
    </div>
  );
}

// ── Glass subgroup chip rail ────────────────────────────────────
function SubgroupRail({ items, activeId, onSelect, theme, catSlug }) {
  const activeGradient = theme === "premium"
    ? "bg-gradient-to-br from-accent to-accent-dark text-white border-transparent shadow-glow-gold"
    : "bg-gradient-to-br from-success to-success-dark text-white border-transparent shadow-glow-green";

  const glass = "bg-white/50 dark:bg-white/[0.04] backdrop-blur-md border-white/60 dark:border-white/10 text-txt-secondary dark:text-slate-300 hover:bg-white/80 dark:hover:bg-white/[0.09] hover:-translate-y-0.5 hover:shadow-sm";

  return (
    <nav className="flex flex-wrap gap-2" role="tablist" aria-label={`${theme === "premium" ? "Premium" : "Free"} subgroups`}>
      {items.map((item) => {
        const active = activeId === item.id;
        const base = "inline-flex items-center gap-1.5 px-3.5 py-2 rounded-2xl text-xs font-semibold border transition-all duration-300 whitespace-nowrap";

        if (item.id === "all") {
          return (
            <button
              key={item.id}
              role="tab"
              aria-selected={active}
              onClick={() => onSelect(item.id)}
              className={`${base} ${active ? activeGradient : glass}`}
            >
              {item.label}
            </button>
          );
        }
        return (
          <button
            key={item.id}
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(item.id)}
            className={`${base} ${active ? activeGradient : glass}`}
            title={catSlug ? `${item.label}` : undefined}
          >
            {item.label}
            {typeof item.count === "number" && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${active ? "bg-white/25" : "bg-bg dark:bg-dark-surface2"}`}>
                {item.count}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

// ── One column (Premium or Free) ────────────────────────────────
function TestColumn({
  theme, // "premium" | "free"
  loading,
  groups,
  activeId,
  onSelectGroup,
  isSearchActive,
  searchLoading,
  searchResults,
  sortBy,
  visibleCount,
  onLoadMore,
  onStartTest,
  onLockedTest,
  emptyLabel,
  notLoggedInBanner,
}) {
  const isPremium = theme === "premium";
  const Card = isPremium ? PremiumTestCard : FreeTestCard;

  const menuItems = [
    { id: "all", label: "All Tests" },
    ...groups.map((g) => ({ id: g.id?.toString(), label: g.name, count: g.tests?.length })),
  ];

  // Flatten whichever tests should currently be visible: search results
  // take priority; otherwise the selected subgroup (or every group under
  // "All Tests"), each normalised to a common shape and sorted.
  const flatTests = useMemo(() => {
    if (isSearchActive) {
      return sortTests(searchResults.map(normaliseTest), sortBy);
    }
    const source = activeId === "all" ? groups : groups.filter((g) => g.id?.toString() === activeId);
    const flat = source.flatMap((g) =>
      (g.tests || []).map((t) => normaliseTest({ ...t, groupName: activeId === "all" ? g.name : undefined }))
    );
    return sortTests(flat, sortBy);
  }, [isSearchActive, searchResults, groups, activeId, sortBy]);

  const visible = flatTests.slice(0, visibleCount);
  const hasMore = flatTests.length > visible.length;
  const busy = isSearchActive ? searchLoading : loading;

  return (
    <div className="flex-1 min-w-0">
      {/* Subgroup rail */}
      {!isSearchActive && (
        loading ? <ChipSkeleton /> : <SubgroupRail items={menuItems} activeId={activeId} onSelect={onSelectGroup} theme={theme} />
      )}

      {notLoggedInBanner}

      {/* Test grid */}
      <div className="mt-5">
        {busy ? (
          <GridSkeleton />
        ) : flatTests.length === 0 ? (
          <div className="bg-bg/60 dark:bg-dark-surface/60 border border-dashed border-border dark:border-dark-border rounded-2xl p-10 text-center text-sm text-txt-secondary dark:text-slate-300">
            {isSearchActive ? "No matching tests found." : emptyLabel}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {visible.map((test) => (
                <Card key={test.id} test={test} onStart={onStartTest} onLocked={onLockedTest} />
              ))}
            </div>
            {hasMore && (
              <div className="flex justify-center mt-6">
                <button
                  onClick={onLoadMore}
                  className={`text-xs font-bold px-6 py-2.5 rounded-xl border transition ${
                    isPremium
                      ? "border-accent/40 text-accent-darker dark:text-amber-300 hover:bg-accent-light dark:hover:bg-amber-900/20"
                      : "border-success/40 text-success-darker dark:text-green-300 hover:bg-success-light dark:hover:bg-green-900/20"
                  }`}
                >
                  Load more ({flatTests.length - visible.length} more)
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function CustomCategoryLayout({ category, user, openLoginModal, openPremiumPopup }) {
  const navigate = useNavigate();
  const { name: catName, slug: catSlug, description: catDescription } = category;

  // Premium tests
  const [groups, setGroups] = useState([]);
  const [groupsLoading, setGroupsLoading] = useState(true);
  const [activeGroup, setActiveGroup] = useState("all");

  // Free tests
  const [freeGroups, setFreeGroups] = useState([]);
  const [freeGroupsLoading, setFreeGroupsLoading] = useState(true);
  const [activeFreeGroup, setActiveFreeGroup] = useState("all");

  // Search (drives both columns at once)
  const [searchQuery, setSearchQuery] = useState("");
  const [premiumSearchResults, setPremiumSearchResults] = useState([]);
  const [freeSearchResults, setFreeSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const debounceRef = useRef(null);

  // Sort (shared control)
  const [sortBy, setSortBy] = useState("popular"); // "popular" | "newest" | "az"

  // Pagination (client-side "Load more")
  const [visiblePremium, setVisiblePremium] = useState(PAGE_SIZE);
  const [visibleFree, setVisibleFree] = useState(PAGE_SIZE);

  // ── Fetch premium groups ──────────────────────────────────
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
      .then(({ data }) => setFreeGroups(data.groups || []))
      .catch(() => setFreeGroups([]))
      .finally(() => setFreeGroupsLoading(false));
  }, [catSlug]);

  // ── Debounced search — fires for BOTH columns at once ──────
  function handleSearchChange(e) {
    const q = e.target.value;
    setSearchQuery(q);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setPremiumSearchResults([]);
      setFreeSearchResults([]);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    debounceRef.current = setTimeout(() => {
      const query = encodeURIComponent(q.trim());
      Promise.allSettled([
        api.get(`/custom-tests/${catSlug}?search=${query}`),
        api.get(`/free-custom-tests/${catSlug}?search=${query}`),
      ]).then(([premiumRes, freeRes]) => {
        setPremiumSearchResults(premiumRes.status === "fulfilled" ? premiumRes.value.data.results || [] : []);
        setFreeSearchResults(freeRes.status === "fulfilled" ? freeRes.value.data.results || [] : []);
      }).finally(() => setSearchLoading(false));
    }, 300);
  }

  function clearSearch() {
    setSearchQuery("");
    setPremiumSearchResults([]);
    setFreeSearchResults([]);
  }

  // Reset paging whenever the visible test set changes underneath it
  useEffect(() => { setVisiblePremium(PAGE_SIZE); }, [activeGroup, sortBy, searchQuery]);
  useEffect(() => { setVisibleFree(PAGE_SIZE); }, [activeFreeGroup, sortBy, searchQuery]);

  // ── Navigation ────────────────────────────────────────────
  function handleStartPremiumTest(test) {
    navigate(`/test/custom/${test.id || test.testId}`);
  }
  function handleStartFreeTest(test) {
    navigate(`/test/free-custom/${test.id || test.testId}`);
  }
  function handleLockedTest() {
    if (!user) {
      if (openLoginModal) openLoginModal();
      else navigate("/login");
    } else {
      if (openPremiumPopup) openPremiumPopup({ mode: "expired" });
      else navigate("/login");
    }
  }

  const isSearchActive = searchQuery.trim().length > 0;

  const premiumCount = useMemo(() => groups.reduce((sum, g) => sum + (g.tests?.length || 0), 0), [groups]);
  const freeCount = useMemo(() => freeGroups.reduce((sum, g) => sum + (g.tests?.length || 0), 0), [freeGroups]);

  const notLoggedInBanner =
    !user && groups.length > 0 ? (
      <div className="mt-4 flex items-center gap-2.5 rounded-xl border border-accent/30 dark:border-amber-700/30 bg-accent-light dark:bg-amber-900/20 px-4 py-3">
        <svg className="w-4 h-4 text-accent-darker dark:text-amber-300 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <p className="text-xs text-accent-darker dark:text-amber-300">
          These are premium tests.{" "}
          <button onClick={() => openPremiumPopup?.({ mode: "visitor" })} className="font-bold underline underline-offset-2">
            Buy Premium
          </button>{" "}
          to take them.
        </p>
      </div>
    ) : null;

  // For the "About This Exam" section — show blog content for whichever
  // specific subgroup(s) are currently selected (skipped in search mode
  // and while on "All Tests", same as before).
  const activePremiumGroup = groups.find((g) => g.id?.toString() === activeGroup);
  const activeFreeGroupObj = freeGroups.find((g) => g.id?.toString() === activeFreeGroup);

  return (
    <div className="max-w-7xl mx-auto px-4 md:px-8 py-10 dark:bg-dark-bg">
      {/* ══════════════════════ HERO ══════════════════════ */}
      <div className="relative mb-10">
        <div className="flex flex-col md:flex-row items-center md:items-stretch justify-center gap-4 md:gap-0 text-center">
          {/* Left flank — Premium count, ties to the gold column below */}
          <div className="md:flex-1 md:flex md:items-center md:justify-end md:pr-6">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-accent/30 dark:border-amber-700/30 bg-accent-light/70 dark:bg-amber-900/20 backdrop-blur-sm px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-accent" />
              <span className="text-xs font-bold text-accent-darker dark:text-amber-300">
                Premium{!groupsLoading && <> · {premiumCount}</>}
              </span>
            </div>
          </div>

          {/* Center — category title, the primary focus */}
          <div className="md:px-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-brand dark:text-blue-400 mb-1.5">
              Mock Test Hub
            </p>
            <h1 className="font-heading text-3xl md:text-4xl font-extrabold tracking-tight text-txt-primary dark:text-white">
              {catName}
            </h1>
            <div className="mx-auto mt-3 h-1 w-16 rounded-full bg-gradient-to-r from-accent via-brand to-success" />
            {catDescription && (
              <p className="text-sm text-txt-secondary dark:text-slate-300 mt-3 max-w-xl mx-auto">{catDescription}</p>
            )}
          </div>

          {/* Right flank — Free count, ties to the green column below */}
          <div className="md:flex-1 md:flex md:items-center md:justify-start md:pl-6">
            <div className="inline-flex items-center gap-2 rounded-2xl border border-success/30 dark:border-green-700/30 bg-success-light/70 dark:bg-green-900/20 backdrop-blur-sm px-4 py-2">
              <span className="w-2 h-2 rounded-full bg-success" />
              <span className="text-xs font-bold text-success-darker dark:text-green-300">
                Free{!freeGroupsLoading && <> · {freeCount}</>}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ══════════════════ SEARCH + SORT ══════════════════ */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-8">
        <div className="relative flex-1">
          <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
            <svg className="w-4 h-4 text-txt-muted dark:text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={handleSearchChange}
            placeholder="Search all tests in this category…"
            className="w-full pl-9 pr-9 py-2.5 text-sm border border-border dark:border-dark-border rounded-xl bg-surface dark:bg-dark-surface text-txt-primary dark:text-slate-100 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute inset-y-0 right-3 flex items-center text-txt-muted dark:text-slate-500 hover:text-txt-secondary dark:hover:text-slate-300 transition"
              aria-label="Clear search"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <label htmlFor="sortBy" className="text-xs font-semibold text-txt-muted dark:text-slate-500">
            Sort
          </label>
          <select
            id="sortBy"
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="text-sm border border-border dark:border-dark-border rounded-xl bg-surface dark:bg-dark-surface text-txt-primary dark:text-slate-100 px-3 py-2.5 shadow-sm focus:outline-none focus:ring-2 focus:ring-brand"
          >
            <option value="popular">Popular</option>
            <option value="newest">Newest</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>

      {/* ══════════════════ TWO-COLUMN BODY ══════════════════ */}
      <div className="flex flex-col md:flex-row gap-8 md:gap-0">
        <div className="md:pr-8 flex-1 min-w-0">
          <TestColumn
            theme="premium"
            loading={groupsLoading}
            groups={groups}
            activeId={activeGroup}
            onSelectGroup={setActiveGroup}
            isSearchActive={isSearchActive}
            searchLoading={searchLoading}
            searchResults={premiumSearchResults}
            sortBy={sortBy}
            visibleCount={visiblePremium}
            onLoadMore={() => setVisiblePremium((v) => v + PAGE_SIZE)}
            onStartTest={handleStartPremiumTest}
            onLockedTest={handleLockedTest}
            emptyLabel="Tests for this category are coming soon."
            notLoggedInBanner={notLoggedInBanner}
          />
        </div>

        {/* Divider — vertical on desktop, horizontal on mobile */}
        <div className="hidden md:block w-px bg-border dark:bg-dark-border" />
        <div className="md:hidden h-px bg-border dark:bg-dark-border" />

        <div className="md:pl-8 flex-1 min-w-0">
          <TestColumn
            theme="free"
            loading={freeGroupsLoading}
            groups={freeGroups}
            activeId={activeFreeGroup}
            onSelectGroup={setActiveFreeGroup}
            isSearchActive={isSearchActive}
            searchLoading={searchLoading}
            searchResults={freeSearchResults}
            sortBy={sortBy}
            visibleCount={visibleFree}
            onLoadMore={() => setVisibleFree((v) => v + PAGE_SIZE)}
            onStartTest={handleStartFreeTest}
            onLockedTest={handleLockedTest}
            emptyLabel="No free tests available for this category yet."
            notLoggedInBanner={null}
          />
        </div>
      </div>

      {/* ── About This Exam — SEO blog content for active subgroup(s) ── */}
      {!isSearchActive && (activePremiumGroup?.blogContent || activeFreeGroupObj?.blogContent) && (
        <AboutSection blogContent={activePremiumGroup?.blogContent || activeFreeGroupObj?.blogContent} />
      )}
    </div>
  );
}
