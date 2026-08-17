import { useEffect, useRef } from "react";
import api from "../api/axios";

/**
 * Fires a single fire-and-forget POST /api/visits/track call whenever
 * `deps` changes, as long as `enabled` is true. Feeds the admin
 * dashboard's Visitor Stats panel (total visits, unique visitors, and a
 * per-category breakdown) — see server/routes/publicVisitTracking.js and
 * server/routes/adminDashboard.js (GET /api/admin/visit-stats).
 *
 * Deliberately silent on failure: a broken analytics call should never
 * surface as an error to a real visitor or affect the page they're on.
 *
 * Usage:
 *   useTrackVisit({ type: "home" });
 *   useTrackVisit(
 *     { type: "category", categorySlug: slug, categoryName: displayName },
 *     [slug],
 *     !loading && !error // only fire once the category actually resolved
 *   );
 */
export default function useTrackVisit(payload, deps = [], enabled = true) {
  // Guards against firing twice for the same deps in React StrictMode's
  // dev double-invoke, and against re-firing if `enabled` flips true more
  // than once for the same deps.
  const firedKeyRef = useRef(null);

  useEffect(() => {
    if (!enabled || !payload) return;
    const key = JSON.stringify(deps);
    if (firedKeyRef.current === key) return;
    firedKeyRef.current = key;

    api
      .post("/visits/track", { ...payload, path: window.location.pathname })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps]);
}
