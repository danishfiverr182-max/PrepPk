/**
 * src/public/context/PublicCategoriesContext.jsx  (updated Part 9   Prompt 6)
 *
 * Changes from Prompt 70 Final QA:
 *  - The categories array now preserves hasAccess and userExpired fields
 *    returned by GET /api/categories when a user is logged in (Part 9
 *    Prompt 5).  When the user is anonymous these fields are simply absent
 *    from the response and the shape is unchanged.
 *
 * All consumers (CategoryCardsSection, Navbar, etc.) receive the full
 * category objects including any per-user access flags.
 */

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";

// ── Static fallback ───────────────────────────────────────────
const FALLBACK_CATEGORIES = [
  { _id: "fallback-army", name: "Pakistan Army Tests",      slug: "pakistan-army-tests",      order: 0 },
  { _id: "fallback-navy", name: "Pakistan Navy Tests",      slug: "pakistan-navy-tests",      order: 1 },
  { _id: "fallback-paf",  name: "Pakistan Air Force Tests", slug: "pakistan-air-force-tests", order: 2 },
];

const PublicCategoriesContext = createContext(null);

export function PublicCategoriesProvider({ children }) {
  const [categories, setCategories] = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState(null);

  useEffect(() => {
    let cancelled = false;

    api
      .get("/categories")
      .then((res) => {
        if (!cancelled) {
          // Preserve the full objects including any hasAccess / userExpired
          // fields the server adds for logged-in users (Prompt 5).
          const data = Array.isArray(res.data) ? res.data : [];
          setCategories(data);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          const msg = err.response?.data?.message || "Failed to load categories.";
          setError(msg);
          setCategories(FALLBACK_CATEGORIES);
          toast.error("Could not load categories showing defaults.", {
            id:       "pub-cat-fail",
            duration: 4000,
          });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, []);

  // Memoized so the many consumers of this context across the public site
  // only re-render when the categories data actually changes, not on every
  // render of this provider.
  const value = useMemo(
    () => ({ categories, loading, error }),
    [categories, loading, error]
  );

  return (
    <PublicCategoriesContext.Provider value={value}>
      {children}
    </PublicCategoriesContext.Provider>
  );
}

export function usePublicCategories() {
  const ctx = useContext(PublicCategoriesContext);
  if (!ctx) {
    throw new Error("usePublicCategories must be used inside <PublicCategoriesProvider>");
  }
  return ctx;
}
