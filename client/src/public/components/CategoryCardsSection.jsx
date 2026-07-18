/**
 * src/public/components/CategoryCardsSection.jsx — Premium Redesign
 *
 * Gamified category grid with:
 *  - Dark glassmorphism cards
 *  - Colored gradient top border per category
 *  - Hover: card lifts with glow shadow
 *  - Locked cards: premium overlay with crown icon
 *  - Animated entrance
 */

import { Link } from "react-router-dom";
import { usePublicCategories } from "../context/PublicCategoriesContext";
import CategoryLockMessage from "./CategoryLockMessage";
import { optimizeCloudinaryUrl } from "../../utils/optimizeCloudinaryUrl";

// ── Category color themes (cycles through) ──────────────────
const CARD_THEMES = [
  { gradient: "from-purple-600 to-indigo-600", glow: "rgba(108, 99, 255, 0.4)", emoji: "🎖️" },
  { gradient: "from-blue-500 to-cyan-500",     glow: "rgba(59, 130, 246, 0.4)",  emoji: "⚓" },
  { gradient: "from-emerald-500 to-teal-600",  glow: "rgba(16, 185, 129, 0.4)", emoji: "✈️" },
  { gradient: "from-orange-500 to-red-500",    glow: "rgba(249, 115, 22, 0.4)", emoji: "🏅" },
  { gradient: "from-pink-500 to-rose-600",     glow: "rgba(236, 72, 153, 0.4)", emoji: "📋" },
  { gradient: "from-yellow-500 to-amber-600",  glow: "rgba(245, 158, 11, 0.4)", emoji: "⚡" },
];

// ── Skeleton card ─────────────────────────────────────────────
function SkeletonCard() {
  return (
    <div
      className="rounded-2xl overflow-hidden animate-pulse bg-slate-200 border border-slate-300 dark:bg-white/5 dark:border-white/10"
    >
      <div className="h-1.5 bg-slate-300 dark:bg-white/10" />
      <div className="p-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-300 dark:bg-white/10" />
          <div className="h-5 bg-slate-300 dark:bg-white/10 rounded w-2/3" />
        </div>
        <div className="h-3 bg-slate-300 dark:bg-white/10 rounded w-full" />
        <div className="h-3 bg-slate-300 dark:bg-white/10 rounded w-4/5" />
        <div className="h-10 bg-slate-300 dark:bg-white/10 rounded-xl mt-4" />
      </div>
    </div>
  );
}

// ── Single category card ──────────────────────────────────────
function CategoryCard({ category, premiumUser, onLockedClick, themeIndex }) {
  const theme = CARD_THEMES[themeIndex % CARD_THEMES.length];
  const isLoggedIn = !!premiumUser;
  const coverImageUrl = category.coverImageUrl || category.image || "";
  // Card renders at h-40 (160px), so 480px covers even a 3x-density
  // phone screen without shipping a full-resolution original.
  const optimizedCoverImageUrl = optimizeCloudinaryUrl(coverImageUrl, { width: 480 });

  return (
    <div
      className="group relative rounded-2xl overflow-hidden transition-all duration-400 cursor-pointer bg-white/60 border border-slate-300 dark:bg-white/5 dark:border-white/10 backdrop-blur-md"
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = `0 20px 60px ${theme.glow}, 0 8px 24px rgba(0,0,0,0.3)`;
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.borderColor = `var(--tw-border-opacity) ? ${theme.glow} : ${theme.glow}`; // fallback
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = "";
        e.currentTarget.style.transform = "";
        e.currentTarget.style.borderColor = "";
      }}
    >
      {/* Colored top border */}
      <div className={`h-1 bg-gradient-to-r ${theme.gradient}`} />

      {/* Cover image or gradient placeholder */}
      <div className="relative h-40 overflow-hidden">
        {coverImageUrl ? (
          <img
            src={optimizedCoverImageUrl}
            alt={category.name}
            loading="lazy"
            className="w-full h-full object-cover opacity-60 group-hover:opacity-80 group-hover:scale-105 transition-all duration-500"
            onError={(e) => {
              e.currentTarget.style.display = "none";
              e.currentTarget.nextSibling?.classList.remove("hidden");
            }}
          />
        ) : null}
        <div
          className={`${coverImageUrl ? "hidden" : ""} w-full h-full flex items-center justify-center bg-slate-200/50 dark:bg-white/5`}
        >
          <span className="text-5xl opacity-30 group-hover:opacity-50 group-hover:scale-110 transition-all duration-300">
            {theme.emoji}
          </span>
        </div>

        {/* Lock / access badge */}
        <div className="absolute top-3 right-3">
          {isLoggedIn ? (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(0, 230, 118, 0.2)", border: "1px solid rgba(0, 230, 118, 0.4)", color: "#00e676" }}
            >
              ✓ Unlocked
            </span>
          ) : (
            <span
              className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full"
              style={{ background: "rgba(245, 197, 66, 0.15)", border: "1px solid rgba(245, 197, 66, 0.35)", color: "#F5C542" }}
            >
              🔒 Premium
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <div className="flex items-start gap-3 mb-3">
          <div
            className={`w-9 h-9 rounded-xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center flex-shrink-0 text-lg shadow-sm`}
          >
            {theme.emoji}
          </div>
          <div className="min-w-0">
            <h3 className="font-heading font-bold text-slate-900 dark:text-white text-base leading-tight">
              {category.name}
            </h3>
            {category.description && (
              <p className="text-slate-500 dark:text-purple-300/70 text-xs mt-0.5 line-clamp-2">
                {category.description}
              </p>
            )}
          </div>
        </div>

        <CategoryLockMessage
          isLoggedIn={isLoggedIn}
          onBuyClick={() => onLockedClick?.(category)}
          renderUnlocked={
            <Link
              to={`/category/${category.slug}`}
              className={`block w-full text-center text-sm font-bold py-2.5 rounded-xl transition-all duration-300 hover:scale-105 text-white bg-gradient-to-r ${theme.gradient}`}
            >
              Go to Mock Tests →
            </Link>
          }
        />
      </div>
    </div>
  );
}

// ── Main section ──────────────────────────────────────────────
export default function CategoryCardsSection({ premiumUser, onLockedClick }) {
  const { categories, loading } = usePublicCategories();

  return (
    <section
      id="categories"
      className="relative px-4 md:px-8 lg:px-16 py-16 md:py-24"
    >
      {/* Background grid */}
      <div className="absolute inset-0 hero-grid opacity-30 pointer-events-none" />

      <div className="relative z-10 max-w-6xl mx-auto">
        {/* Section header */}
        <div className="text-center mb-12">
          <span
            className="inline-flex items-center gap-1.5 text-xs font-bold tracking-widest uppercase px-3 py-1.5 rounded-full mb-4 text-brand dark:text-purple-400 bg-brand/10 border border-brand/20"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            Available Categories
          </span>
          <h2 className="font-heading font-black text-3xl md:text-4xl text-slate-900 dark:text-white mb-3">
            Choose Your{" "}
            <span className="gradient-text">Category</span>
          </h2>
          <p className="text-slate-600 dark:text-purple-300/70 text-base max-w-xl mx-auto">
            Select a service branch to browse full mock tests Army, Navy, Air Force and more.
          </p>
        </div>

        {/* Cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <SkeletonCard key={i} />)
          ) : categories.length === 0 ? (
            <div className="col-span-full text-center py-16 text-slate-500 dark:text-purple-300/60">
              <div className="text-5xl mb-4">🔒</div>
              <p className="font-semibold text-slate-900 dark:text-white">More categories coming soon</p>
              <p className="text-sm mt-1">We're adding new mock test categories regularly.</p>
            </div>
          ) : (
            categories.map((category, i) => (
              <CategoryCard
                key={category._id}
                category={category}
                premiumUser={premiumUser}
                onLockedClick={onLockedClick}
                themeIndex={i}
              />
            ))
          )}
        </div>

        {/* Upsell hint for visitors */}
        {!premiumUser && !loading && categories.length > 0 && (
          <div
            className="mt-10 text-center p-6 rounded-2xl bg-brand/5 border border-brand/20 dark:bg-brand/10"
          >
            <p className="text-slate-600 dark:text-purple-200/80 text-sm">
              🔓 <strong className="text-slate-900 dark:text-white">Unlock all categories:</strong> Access Army, Navy, Air Force, KPPSC, FPSC and more with a single premium subscription.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}
