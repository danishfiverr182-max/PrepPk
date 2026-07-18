/**
 * src/context/ThemeContext.jsx
 *
 * Prompt 25 — Dark Mode theme system.
 * Holds the current theme ("light" | "dark"), persists it to
 * localStorage ("prepPkTheme"), and toggles the "dark" class on
 * <html> so Tailwind's class-based dark mode + CSS variables react.
 *
 * Dark mode is only ever toggled from the user-facing site — the
 * admin panel never reads or renders this context.
 */

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

const THEME_STORAGE_KEY = "prepPkTheme";

const ThemeContext = createContext(undefined);

function getInitialTheme() {
  if (typeof window === "undefined") return "light";
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "dark" || stored === "light") return stored;

  // First-time visitor — no stored preference yet, fall back to the
  // OS-level color scheme. Once they toggle manually, localStorage
  // always wins over this on subsequent visits.
  if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    return "dark";
  }
  return "light";
}

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
    window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  }, []);

  // Memoized so every consumer across the whole app (this provider wraps
  // everything, in main.jsx) only re-renders when the theme actually
  // changes, not on every render of this provider.
  const value = useMemo(
    () => ({ theme, toggleTheme }),
    [theme, toggleTheme]
  );

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (ctx === undefined) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return ctx;
}

export default ThemeContext;
