/**
 * src/public/components/HeroSection.jsx — Cinematic Redesign
 *
 * Full-screen dark cinematic hero with:
 *  - Animated particle/grid background
 *  - Gradient headline with animated word cycling
 *  - Live MCQ counter with fire icon
 *  - Glowing CTA buttons
 *  - Trust badges as glowing stat pills
 *  - Floating decorative orbs
 */

import { useEffect, useRef, useState, memo } from "react";
import { Link } from "react-router-dom";
import api from "../../api/axios";
import { usePublicCategories } from "../context/PublicCategoriesContext";
import { SiAlwaysdata } from "react-icons/si";
import { PiTrophyFill } from "react-icons/pi";
import { FaArrowDown } from "react-icons/fa";

// ── Animated counter hook ───────────────────────────────────
function useCountUp(target, duration = 1800) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (target === null) return;
    if (target === 0) {
      setDisplay(0);
      return;
    }

    const start = performance.now();
    const startVal = 0;

    function step(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(startVal + eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(step);
      } else {
        setDisplay(target);
      }
    }

    rafRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

// ── Isolated leaf so 60fps count-up frames don't re-render the whole hero ──
const AnimatedCounter = memo(function AnimatedCounter({ target }) {
  const displayCount = useCountUp(target === false ? 0 : (target ?? null));
  return (
    <span
      className="font-heading font-black tabular-nums block gradient-text-gold"
      style={{ fontSize: "2.5rem", lineHeight: 1 }}
    >
      {displayCount.toLocaleString()}+
    </span>
  );
});

// ── Animated word cycler ────────────────────────────────────
function AnimatedForce({ forces }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (!forces.length) return;
    const interval = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % forces.length);
        setVisible(true);
      }, 350);
    }, 2200);
    return () => clearInterval(interval);
  }, [forces]);

  return (
    <span
      className="inline-block gradient-text-gold"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? "translateY(0)" : "translateY(-8px)",
        transition: "opacity 0.35s ease, transform 0.35s ease",
        minWidth: "180px",
        display: "inline-block",
        textAlign: "center",
      }}
    >
      {forces[idx] || forces[0]}
    </span>
  );
}

export default function HeroSection() {
  const { categories } = usePublicCategories();
  const forces = categories.map((c) => c.name);
  const [totalMcqs, setTotalMcqs] = useState(null);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/stats/mcq-count")
      .then((res) => {
        if (!cancelled) setTotalMcqs(res.data.totalMcqs ?? 0);
      })
      .catch(() => {
        if (!cancelled) setTotalMcqs(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section
      className="relative overflow-hidden"
      style={{ background: "var(--bg-hero)" }}
    >
      {/* ── Animated grid background ───────────────────── */}
      <div className="absolute inset-0 hero-grid opacity-60 pointer-events-none" />

      {/* ── Floating orbs ──────────────────────────────── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="orb-1 absolute -top-20 -right-20 w-96 h-96 rounded-full opacity-25"
          style={{
            background: "radial-gradient(circle, #6C63FF 0%, transparent 70%)",
          }}
        />
        <div
          className="orb-2 absolute -bottom-32 -left-20 w-80 h-80 rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, #a855f7 0%, transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[500px] h-[500px] rounded-full opacity-10 pointer-events-none"
          style={{
            background: "radial-gradient(circle, #F5C542 0%, transparent 70%)",
          }}
        />
        {/* Floating stars */}
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="absolute w-1 h-1 rounded-full bg-white/40 animate-pulse"
            style={{
              top: `${10 + i * 11}%`,
              left: `${5 + i * 12}%`,
              animationDelay: `${i * 0.4}s`,
              animationDuration: `${2 + i * 0.3}s`,
            }}
          />
        ))}
      </div>

      {/* ── Main content ────────────────────────────────── */}
      <div className="relative z-10 max-w-5xl mx-auto px-4 py-20 md:py-32 text-center">
        {/* Pakistan's #1 badge */}
        <div className="inline-flex items-center gap-2 mb-8 animate-slideUp">
          <span
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold tracking-widest uppercase"
            style={{
              background: "rgba(245, 197, 66, 0.12)",
              border: "1px solid rgba(245, 197, 66, 0.35)",
              color: "#F5C542",
            }}
          >
            <span className="flex items-center gap-2 text-[#1F2937] dark:text-slate-200">
              <PiTrophyFill className="text-yellow-500 text-lg" />
              Pakistan's #1 Mock Test Platform
            </span>
          </span>
        </div>

        {/* Main headline */}
        <h1
          className="font-heading font-black text-slate-900 dark:text-white leading-tight mb-4 animate-slideUp"
          style={{
            fontSize: "clamp(1.8rem, 4.5vw, 3.2rem)",
            animationDelay: "0.1s",
          }}
        >
          Succeed in Your <AnimatedForce forces={forces} /> Test
        </h1>

        <p
          className="text-slate-600 dark:text-purple-200/80 text-base md:text-lg max-w-2xl mx-auto mb-10 leading-relaxed animate-slideUp"
          style={{ animationDelay: "0.2s" }}
        >
          Thousands of real-pattern MCQs organised by service branch and
          subject. Mirror the{" "}
          <strong className="text-slate-900 dark:text-white">
            actual exam format
          </strong>{" "}
          so you walk in confident.
        </p>

        {/* Live MCQ Counter */}
        {totalMcqs !== false && (
          <div
            className="inline-flex items-center gap-4 mb-10 px-6 py-4 rounded-2xl animate-slideUp backdrop-blur-md bg-white/60 border border-slate-300 dark:bg-white/5 dark:border-brand/30 shadow-sm"
            style={{ animationDelay: "0.3s" }}
          >
            {totalMcqs === null ? (
              <div className="flex items-center gap-3 animate-pulse">
                <div className="h-10 w-24 bg-slate-200 dark:bg-white/10 rounded-lg" />
                <div className="h-4 w-28 bg-slate-200 dark:bg-white/10 rounded" />
              </div>
            ) : (
              <>
                <div className="text-center">
                  <AnimatedCounter target={totalMcqs} />
                  <span className="text-slate-500 dark:text-purple-300 text-xs mt-1 block tracking-wide uppercase">
                    MCQs Available
                  </span>
                </div>
                <div className="w-px h-10 bg-slate-300 dark:bg-white/10" />
                <div className="text-left">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span>
                      <SiAlwaysdata className="text-blue-400 text-xl" />
                    </span>
                    <span className="text-slate-900 dark:text-white text-base font-semibold">
                      Always Updated
                    </span>
                  </div>
                  <span className="text-slate-500 dark:text-purple-300/70 text-sm">
                    Real exam patterns
                  </span>
                </div>
              </>
            )}
          </div>
        )}

        {/* CTA Buttons */}
        <div
          className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-12 animate-slideUp"
          style={{ animationDelay: "0.35s" }}
        >
          {/* Primary: Free Test */}
          <Link
            to="/free-mock-tests"
            className="relative group w-full sm:w-auto px-8 py-4 font-heading font-bold text-sm rounded-2xl text-navy transition-all duration-300 hover:scale-105 overflow-hidden"
            style={{
              background: "linear-gradient(135deg, #F5C542 0%, #f09819 100%)",
            }}
          >
            <span className="relative z-10 flex items-center justify-center gap-2">
              <span className="text-lg">⚡</span>
              Start Free Mock Test
            </span>
            {/* Shimmer overlay */}
            <span
              className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300"
              style={{
                background:
                  "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)",
                transform: "skewX(-15deg)",
              }}
            />
          </Link>

          {/* Secondary: Browse */}
          <a
            href="#categories"
            className="w-full sm:w-auto px-8 py-4 font-heading font-semibold text-sm rounded-2xl text-slate-800 bg-white/60 border border-slate-300 dark:text-white dark:bg-white/10 dark:border-white/20 backdrop-blur-md transition-all duration-300 hover:scale-105 inline-flex items-center justify-center gap-2"
          >
            Browse Categories
            <FaArrowDown  className="w-4 h-4" />
          </a>
        </div>

        {/* Trust indicators */}
        <div
          className="flex items-center justify-center flex-wrap gap-6 animate-slideUp"
          style={{ animationDelay: "0.45s" }}
        >
          {[
            { icon: "✅", text: "Real-pattern questions" },
            { icon: "🔄", text: "Updated regularly" },
            { icon: "🆓", text: "Free tests available" },
            { icon: "🏆", text: "12,000+ students enrolled" },
          ].map(({ icon, text }) => (
            <span
              key={text}
              className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-purple-300/80"
            >
              <span>{icon}</span>
              <span>{text}</span>
            </span>
          ))}
        </div>
      </div>

      {/* ── Scroll indicator ────────────────────────────── */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 animate-bounce opacity-50">
        <span className="text-slate-500 dark:text-purple-400/60 text-xs tracking-widest uppercase">
          Scroll
        </span>
        <svg
          className="w-4 h-4 text-slate-500 dark:text-purple-400/60"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </div>
    </section>
  );
}
