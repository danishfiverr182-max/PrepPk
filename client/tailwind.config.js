import typography from "@tailwindcss/typography";

// ── Theme-aware color helper ────────────────────────────────────────
// Reads an "R G B" CSS custom property (defined in src/styles/globals.css,
// with a light-mode value under :root and a dark-mode override under
// .dark) and turns it into a Tailwind color function that still supports
// opacity modifiers like `bg-surface/60`.
//
// This is the piece that was previously MISSING: globals.css already
// defined --color-txt-primary etc. with correct light/dark values, but
// nothing in this config ever read them — every token below was a
// hardcoded hex value, so `dark:` class toggling had no visible effect
// on text-txt-primary, bg-surface, bg-bg, border-border, brand, accent,
// success, or danger anywhere they were used without an explicit
// `dark:` override.
function withOpacity(variableName) {
  return ({ opacityValue }) =>
    opacityValue === undefined
      ? `rgb(var(${variableName}))`
      : `rgb(var(${variableName}) / ${opacityValue})`;
}

/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        heading: ['Outfit', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        // ── Core brand ──────────────────────────────────────────────
        brand: {
          DEFAULT: withOpacity('--color-brand'),   // electric indigo
          dark: withOpacity('--color-brand-dark'),
          darker: withOpacity('--color-brand-darker'),
          light: withOpacity('--color-brand-light'),
        },
        // ── Gold accent for premium / CTAs ───────────────────────────
        accent: {
          DEFAULT: withOpacity('--color-accent'),
          dark: withOpacity('--color-accent-dark'),
          darker: withOpacity('--color-accent-darker'),
          light: withOpacity('--color-accent-light'),
        },
        // ── Deep navy for hero/navbar ──────────────────────────────
        navy: {
          DEFAULT: withOpacity('--color-navy'),
          mid: withOpacity('--color-navy-mid'),
          light: withOpacity('--color-navy-light'),
        },
        // ── Success ────────────────────────────────────────────────
        success: {
          DEFAULT: withOpacity('--color-success'),
          dark: withOpacity('--color-success-dark'),
          darker: withOpacity('--color-success-darker'),
          light: withOpacity('--color-success-light'),
        },
        // ── Danger ─────────────────────────────────────────────────
        danger: {
          DEFAULT: withOpacity('--color-danger'),
          dark: withOpacity('--color-danger-dark'),
          darker: withOpacity('--color-danger-darker'),
          light: withOpacity('--color-danger-light'),
        },
        // ── Neutral surfaces — now theme-aware ──────────────────────
        surface: withOpacity('--color-surface'),
        bg: withOpacity('--color-bg'),
        border: withOpacity('--color-border'),
        txt: {
          primary: withOpacity('--color-txt-primary'),
          secondary: withOpacity('--color-txt-secondary'),
          muted: withOpacity('--color-txt-muted'),
          onPrimary: withOpacity('--color-txt-on-primary'),
        },
        // ── Fixed dark-mode-only tokens (unchanged) ─────────────────
        // These stay static hex on purpose — components that already
        // pair them with an explicit `dark:` prefix (e.g.
        // `bg-surface dark:bg-dark-surface`) keep working exactly as
        // before; they simply become redundant-but-harmless now that
        // bg-surface itself is also theme-aware.
        'dark-bg': '#090d16',
        'dark-surface': '#111827',
        'dark-surface2': '#1f2937',
        'dark-border': '#374151',
      },
      backgroundImage: {
        'hero-gradient': 'linear-gradient(135deg, #090d16 0%, #111827 50%, #1f2937 100%)',
        'premium-gradient': 'linear-gradient(135deg, #6C63FF 0%, #a855f7 50%, #ec4899 100%)',
        'gold-gradient': 'linear-gradient(135deg, #f5c542 0%, #f09819 100%)',
        'card-gradient': 'linear-gradient(145deg, rgba(108,99,255,0.1) 0%, rgba(168,85,247,0.05) 100%)',
        'glass': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
      },
      boxShadow: {
        'glow': '0 0 20px rgba(108, 99, 255, 0.4)',
        'glow-gold': '0 0 20px rgba(245, 197, 66, 0.4)',
        'glow-green': '0 0 20px rgba(0, 230, 118, 0.3)',
        'card-lift': '0 20px 60px rgba(108, 99, 255, 0.15)',
        'premium': '0 8px 32px rgba(108, 99, 255, 0.3)',
        'inner-glow': 'inset 0 0 20px rgba(108, 99, 255, 0.1)',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(30px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-12px)' },
        },
        glowPulse: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(108, 99, 255, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(108, 99, 255, 0.7), 0 0 60px rgba(108, 99, 255, 0.3)' },
        },
        glowPulseGold: {
          '0%, 100%': { boxShadow: '0 0 10px rgba(245, 197, 66, 0.3)' },
          '50%': { boxShadow: '0 0 30px rgba(245, 197, 66, 0.7), 0 0 60px rgba(245, 197, 66, 0.3)' },
        },
        bounceIn: {
          '0%': { opacity: '0', transform: 'scale(0.3)' },
          '50%': { opacity: '1', transform: 'scale(1.05)' },
          '70%': { transform: 'scale(0.9)' },
          '100%': { transform: 'scale(1)' },
        },
        spinSlow: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        ring: {
          '0%': { transform: 'scale(1)', opacity: '1' },
          '100%': { transform: 'scale(1.8)', opacity: '0' },
        },
      },
      animation: {
        'fadeIn': 'fadeIn 0.25s ease-out',
        'slideUp': 'slideUp 0.5s ease-out',
        'shimmer': 'shimmer 2.5s linear infinite',
        'float': 'float 3s ease-in-out infinite',
        'float-slow': 'float 5s ease-in-out infinite',
        'glow-pulse': 'glowPulse 2s ease-in-out infinite',
        'glow-pulse-gold': 'glowPulseGold 2s ease-in-out infinite',
        'bounce-in': 'bounceIn 0.6s cubic-bezier(0.36, 0.07, 0.19, 0.97)',
        'spin-slow': 'spinSlow 8s linear infinite',
        'gradient-shift': 'gradientShift 4s ease infinite',
        'count-up': 'countUp 0.5s ease-out',
        'ring': 'ring 1.5s cubic-bezier(0,0,0.2,1) infinite',
      },
    },
  },
  plugins: [typography],
}