/**
 * src/public/components/MobileNavOverlay.jsx — Premium Redesign
 *
 * Sleek dark slide-in panel with:
 *  - Deep space gradient background
 *  - Glowing logo
 *  - Animated nav links
 *  - Premium CTA at bottom
 */

import { useEffect } from "react";
import { NavLink, Link } from "react-router-dom";
import ThemeToggle from "../../components/ui/ThemeToggle";

function SkeletonItem() {
  return <div className="h-5 w-40 bg-slate-200 dark:bg-white/10 rounded-full animate-pulse" />;
}

export default function MobileNavOverlay({
  isOpen,
  onClose,
  categories = [],
  loading = false,
  onLoginClick,
  premiumUser,
  onLogout,
  // Cosmetic-only: category slugs to briefly glow right now (see Navbar.jsx).
  // Never affects which links are clickable   purely a temporary visual cue.
  highlightedSlugs = [],
}) {
  useEffect(() => {
    if (!isOpen) return;
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  useEffect(() => {
    document.body.style.overflow = isOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 py-3 px-3 text-sm font-semibold rounded-xl transition-all duration-200 ${
      isActive
        ? "text-yellow-600 bg-slate-200 dark:text-yellow-300 dark:bg-white/10"
        : "text-slate-600 hover:text-slate-900 hover:bg-slate-200 dark:text-purple-200/80 dark:hover:text-white dark:hover:bg-white/8"
    }`;

  // Same glow treatment as the desktop navbar, kept in sync via the
  // highlightedSlugs prop passed down from Navbar.jsx.
  function categoryLinkClass(cat) {
    const isHighlighted = highlightedSlugs.includes(cat.slug);
    return ({ isActive }) => {
      const base = linkClass({ isActive });
      if (!isHighlighted) return base;
      return `${base} ring-2 ring-yellow-400 dark:ring-yellow-300 animate-pulse shadow-[0_0_12px_rgba(250,204,21,0.55)]`;
    };
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/50 md:hidden backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] flex flex-col md:hidden text-slate-900 dark:text-white"
        style={{
          background: "var(--bg-nav)",
          borderRight: "1px solid var(--color-border)",
          animation: "slideInLeft 0.22s ease-out",
          boxShadow: "20px 0 60px rgba(0,0,0,0.2)",
        }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-white/10"
        >
          <Link to="/" onClick={onClose} className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center">
              <span className="text-white font-black text-sm">P</span>
            </div>
            <span className="font-heading font-bold text-slate-900 dark:text-white text-base">
              Prep<span className="text-yellow-600 dark:text-yellow-300">PK</span>
            </span>
          </Link>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="w-8 h-8 flex items-center justify-center rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-purple-300 dark:hover:text-white dark:hover:bg-white/10 transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Theme toggle */}
        <div
          className="flex items-center justify-between px-5 py-3 border-b border-slate-200 dark:border-white/10"
        >
          <span className="text-xs text-slate-500 dark:text-purple-400/70 font-semibold uppercase tracking-widest">Theme</span>
          <ThemeToggle />
        </div>

        {/* Nav links */}
        <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-1">
          <NavLink to="/" end className={linkClass} onClick={onClose}>
            <span className="text-base">🏠</span>
            Home
          </NavLink>

          {/* Categories label */}
          <p
            className="text-xs font-bold uppercase tracking-widest mt-5 mb-2 px-3 text-brand dark:text-purple-400/50"
          >
            Categories
          </p>

          {loading ? (
            <div className="space-y-3 py-2">
              <SkeletonItem />
              <SkeletonItem />
              <SkeletonItem />
            </div>
          ) : (
            categories.map((cat) => (
              <NavLink
                key={cat._id}
                to={`/category/${cat.slug}`}
                className={categoryLinkClass(cat)}
                onClick={onClose}
              >
                <span className="text-purple-400 text-xs">›</span>
                {cat.name}
              </NavLink>
            ))
          )}

          {/* Divider */}
          <div className="my-3 border-t border-slate-200 dark:border-white/10" />

          <NavLink
            to="/free-mock-tests"
            className={linkClass}
            onClick={onClose}
          >
            <span className="text-base">⚡</span>
            <span className="text-amber-600 dark:text-yellow-300">Free Mock Tests</span>
          </NavLink>
        </nav>

        {/* Auth footer */}
        <div className="px-4 py-5 space-y-3 border-t border-slate-200 dark:border-white/10">
          {premiumUser ? (
            <>
              <div
                className="px-3 py-2 rounded-xl flex items-center gap-2"
                style={{ background: "rgba(0,230,118,0.08)", border: "1px solid rgba(0,230,118,0.2)" }}
              >
                <span className="text-green-400 text-xs">●</span>
                <p className="text-xs text-green-700 dark:text-green-300/80 truncate font-medium">{premiumUser.email}</p>
              </div>
              <button
                onClick={() => { onLogout(); onClose(); }}
                className="w-full text-sm font-bold text-white rounded-xl py-2.5 transition-all duration-200 hover:scale-105 bg-red-500 hover:bg-red-600 dark:bg-red-500/20 dark:border dark:border-red-500/30"
              >
                Log Out
              </button>
            </>
          ) : (
            <button
              onClick={() => { onLoginClick(); onClose(); }}
              className="w-full text-sm font-bold text-navy rounded-xl py-3 transition-all duration-200 hover:scale-105"
              style={{ background: "linear-gradient(135deg, #F5C542, #f09819)" }}
            >
              🔑 Login / Get Premium
            </button>
          )}
        </div>
      </div>
    </>
  );
}
