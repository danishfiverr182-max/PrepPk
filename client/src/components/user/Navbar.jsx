/**
 * src/components/user/Navbar.jsx — Premium Redesign
 *
 * Deep space purple gradient navbar with:
 *  - Glowing animated logo
 *  - Premium CTA with gold shimmer + pulse ring
 *  - Free Tests button with accent color
 *  - Smooth backdrop on scroll
 *  - Category nav links with active underline
 *  - Skeleton states preserved
 */

import { useState, useEffect } from "react";
import { Link, NavLink } from "react-router-dom";
import { useCategories } from "../../hooks/useCategories";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import toast from "react-hot-toast";
import MobileNavOverlay from "../../public/components/MobileNavOverlay";
import ThemeToggle from "../ui/ThemeToggle";
import { IoHomeSharp } from "react-icons/io5";
import { Zap } from "lucide-react";
import { PiLightningFill } from "react-icons/pi";
import { CiLogout } from "react-icons/ci";

function SkeletonLink() {
  return (
    <div className="h-3 w-16 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" />
  );
}

function SkeletonAuthPill() {
  return (
    <div className="h-8 w-20 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" />
  );
}

function HamburgerIcon() {
  return (
    <div className="flex flex-col gap-1.5 w-5">
      <span className="block h-0.5 bg-slate-800 dark:bg-white rounded-full" />
      <span className="block h-0.5 bg-slate-800 dark:bg-white rounded-full" />
      <span className="block h-0.5 bg-slate-500 dark:bg-white/60 w-3 rounded-full" />
    </div>
  );
}

function LogoutConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 px-4">
      <div
        className="w-full max-w-sm rounded-xl shadow-lg p-6"
        style={{ background: "var(--bg-nav)" }}
      >
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">
          Log out?
        </h2>
        <p className="text-xs text-slate-500 dark:text-white/60 mt-1">
          Are you sure you want to log out?
        </p>

        <div className="flex justify-end gap-2 mt-5">
          <button
            onClick={onCancel}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 dark:bg-white/10 dark:hover:bg-white/15 dark:text-white transition-all duration-200"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex items-center gap-1.5 text-xs font-semibold bg-danger hover:bg-danger-dark text-white px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105"
          >
            <CiLogout className="text-base" />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}

// How long the favorite-category glow stays visible before fading out.
// Named constant so it's easy to tune without hunting through the effect.
const FAVORITE_HIGHLIGHT_DURATION_MS = 4000;

export default function Navbar({ onLoginClick, testMode = false }) {
  const { categories, loading: catsLoading, error } = useCategories();
  const { premiumUser, setPremiumUser, isLoading: authLoading } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Cosmetic-only: category slugs to briefly glow in the nav right now.
  // This never affects what the user can click/access   every category
  // remains fully open to every premium user regardless of this list.
  const [highlightedSlugs, setHighlightedSlugs] = useState([]);

  // Fire the highlight once per browser session (sessionStorage, not
  // localStorage   clears when the user actually closes the browser/tab,
  // matching "closes everything and visits again -> plays again").
  // Scoped per-user id so a shared browser with multiple accounts doesn't
  // leak one user's highlight state into another's session.
  useEffect(() => {
    if (authLoading || !premiumUser) return;

    const favorites = premiumUser.favoriteCategories || [];
    if (favorites.length === 0) return;

    const sessionKey = `prepPk_favHighlightShown_${premiumUser.id}`;
    if (sessionStorage.getItem(sessionKey)) return;

    sessionStorage.setItem(sessionKey, "1");
    setHighlightedSlugs(favorites);

    const timer = setTimeout(() => {
      setHighlightedSlugs([]);
    }, FAVORITE_HIGHLIGHT_DURATION_MS);

    return () => clearTimeout(timer);
  }, [authLoading, premiumUser]);

  // Merges the normal active/inactive nav-link styling with a temporary
  // glow for categories in highlightedSlugs. Unmatched slugs (e.g. a
  // category was renamed/removed since the admin picked it) simply never
  // match here, so nothing breaks   they're silently skipped.
  function categoryLinkClass(cat) {
    const isHighlighted = highlightedSlugs.includes(cat.slug);
    return ({ isActive }) => {
      const base = navLinkClass({ isActive });
      if (!isHighlighted) return base;
      return `${base} ring-2 ring-yellow-400 dark:ring-yellow-300 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.55)]`;
    };
  }

  // Shadow navbar on scroll
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (error && !catsLoading) {
      toast.error("Could not load categories, showing defaults.", {
        id: "cat-load-fail",
      });
    }
  }, [error, catsLoading]);

  const navLinkClass = ({ isActive }) =>
    `text-xs font-medium transition-all px-2.5 py-1.5 rounded-md whitespace-nowrap ${
      isActive
        ? "text-yellow-600 bg-slate-200 font-semibold dark:text-yellow-300 dark:bg-white/10"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-white/75 dark:hover:text-white dark:hover:bg-white/8"
    }`;

  async function performLogout() {
    try {
      await api.post("/user/auth/logout");
    } catch {
      // proceed regardless
    }
    setPremiumUser(null);
    toast.success("Logged out.");
  }

  function requestLogout() {
    setShowLogoutConfirm(true);
  }

  async function confirmLogout() {
    setShowLogoutConfirm(false);
    await performLogout();
  }

  function AuthSlot() {
    if (authLoading) return <SkeletonAuthPill />;

    if (premiumUser) {
      return (
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-600 dark:text-purple-200 hidden md:inline max-w-[130px] truncate">
            {premiumUser.email}
          </span>
          <button
            onClick={requestLogout}
            className="flex items-center gap-1.5 text-xs font-semibold bg-danger hover:bg-danger-dark text-white px-3 py-1.5 rounded-lg transition-all duration-200 hover:scale-105"
          >
          <CiLogout className="text-sm" />
            Log Out
          </button>
        </div>
      );
    }

    return (
      <button
        onClick={onLoginClick}
        className="text-xs font-semibold border border-slate-300 hover:border-slate-400 text-slate-800 hover:bg-slate-100 dark:border-white/25 dark:hover:border-white/50 dark:text-white dark:hover:bg-white/10 px-3 py-1.5 rounded-lg transition-all duration-200"
      >
        Login
      </button>
    );
  }

  // ── Test-mode header ─────────────────────────────────────────
  // During test-taking we hide the logo/free-tests/login row entirely
  // and promote the category menu to the top so the user can still
  // jump elsewhere or bail out of the test mid-way. Light/dark toggle
  // (normally in the row we just hid) moves in here too.
  if (testMode) {
    return (
      <>
        <header
          className="sticky top-0 z-40 border-b border-slate-200 dark:border-white/8"
          style={{ background: "var(--bg-nav)" }}
        >
          <nav className="px-3 md:px-8">
            <div className="flex items-center gap-1 py-1.5">
              <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none flex-1 min-w-0">
                <NavLink to="/" end className={navLinkClass}>
                  <IoHomeSharp className="inline-block -mt-0.5 mr-2 text-lg" />
                  Home
                </NavLink>

                {catsLoading ? (
                  <>
                    <SkeletonLink />
                    <SkeletonLink />
                  </>
                ) : (
                  categories.map((cat) => (
                    <NavLink
                      key={cat._id}
                      to={`/category/${cat.slug}`}
                      className={categoryLinkClass(cat)}
                    >
                      {cat.name}
                    </NavLink>
                  ))
                )}

                <NavLink to="/free-mock-tests" className={navLinkClass}>
                  <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                    <Zap className="w-4 h-4" />
                    <span className="hidden sm:inline">Free Mock Tests</span>
                  </span>
                </NavLink>
              </div>

              {/* Right side: theme toggle + mobile hamburger */}
              <div className="flex items-center gap-1.5 shrink-0 pl-2">
                <ThemeToggle />
                <button
                  onClick={() => setMenuOpen(true)}
                  className="p-1.5 md:hidden hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
                  aria-label="Open navigation menu"
                >
                  <HamburgerIcon />
                </button>
              </div>
            </div>
          </nav>
        </header>

        <MobileNavOverlay
          isOpen={menuOpen}
          onClose={() => setMenuOpen(false)}
          categories={categories}
          loading={catsLoading}
          onLoginClick={onLoginClick}
          premiumUser={premiumUser}
          onLogout={requestLogout}
          highlightedSlugs={highlightedSlugs}
        />

        {showLogoutConfirm && (
          <LogoutConfirmModal
            onConfirm={confirmLogout}
            onCancel={() => setShowLogoutConfirm(false)}
          />
        )}
      </>
    );
  }

  return (
    <>
      <header
        className={`sticky top-0 z-40 transition-all duration-300 ${
          scrolled
            ? "shadow-[0_4px_30px_rgba(108,99,255,0.15)] dark:shadow-[0_4px_30px_rgba(108,99,255,0.25)]"
            : ""
        }`}
        style={{ background: "var(--bg-nav)" }}
      >
        {/* ── Top bar ─────────────────────────────────────── */}
        <div className="px-4 md:px-8 py-2 flex items-center justify-between border-b border-slate-200 dark:border-white/8">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 min-w-0 group">
            {/* Icon mark */}
            <div className="relative flex-shrink-0">
              <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-glow group-hover:shadow-[0_0_16px_rgba(108,99,255,0.6)] transition-all duration-300">
                <span className="text-white font-black text-sm">P</span>
              </div>
            </div>
            <div className="min-w-0 gap-1 flex flex-col leading-none">
              <span className="text-slate-900 dark:text-white font-bold text-base tracking-tight block leading-none">
                Prep
                <span className="text-yellow-600 dark:text-yellow-300">PK</span>
              </span>
              <span className="text-slate-500 dark:text-purple-300/60 text-[9px] hidden sm:block leading-none mt-0.5 tracking-widest uppercase">
                Mock Test Platform
              </span>
            </div>
          </Link>

          {/* Top-bar actions */}
          <div className="flex items-center gap-2 shrink-0">
            {/* Free Tests */}
            <Link
              to="/free-mock-tests"
              className="text-xs font-semibold text-amber-600 border border-amber-400/40 hover:border-amber-400 hover:bg-amber-100 dark:text-amber-300 dark:hover:border-amber-400/80 dark:hover:bg-amber-400/10 px-3 py-1.5 rounded-lg transition-all duration-200 hidden sm:flex items-center gap-1.5"
            >
              <PiLightningFill className="text-xs" />
              Free Mock Tests
            </Link>

            <ThemeToggle />

            <AuthSlot />

            {/* Mobile hamburger */}
            <button
              onClick={() => setMenuOpen(true)}
              className="p-1.5 md:hidden hover:bg-slate-200 dark:hover:bg-white/10 rounded-lg transition"
              aria-label="Open navigation menu"
            >
              <HamburgerIcon />
            </button>
          </div>
        </div>

        {/* ── Category nav bar ────────────────────────────── */}
        <nav className="hidden md:block px-4 md:px-8 border-b border-slate-200 dark:border-white/5">
          <div className="flex items-center gap-0.5 py-1 overflow-x-auto scrollbar-none">
            <NavLink to="/" end className={navLinkClass}>
              <IoHomeSharp className="inline-block -mt-0.5 mr-2 text-lg" />
              Home
            </NavLink>

            {catsLoading ? (
              <>
                <SkeletonLink />
                <SkeletonLink />
                <SkeletonLink />
              </>
            ) : (
              categories.map((cat) => (
                <NavLink
                  key={cat._id}
                  to={`/category/${cat.slug}`}
                  className={categoryLinkClass(cat)}
                >
                  {cat.name}
                </NavLink>
              ))
            )}

            <NavLink to="/free-mock-tests" className={navLinkClass}>
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-300">
                <Zap className="w-4 h-4" />
                Free Mock Tests
              </span>
            </NavLink>
          </div>
        </nav>
      </header>

      {/* ── Mobile slide-in overlay ─────────────────────── */}
      <MobileNavOverlay
        isOpen={menuOpen}
        onClose={() => setMenuOpen(false)}
        categories={categories}
        loading={catsLoading}
        onLoginClick={onLoginClick}
        premiumUser={premiumUser}
        onLogout={requestLogout}
        highlightedSlugs={highlightedSlugs}
      />

      {showLogoutConfirm && (
        <LogoutConfirmModal
          onConfirm={confirmLogout}
          onCancel={() => setShowLogoutConfirm(false)}
        />
      )}
    </>
  );
}