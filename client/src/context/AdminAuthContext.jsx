/**
 * AdminAuthContext (Part 2 secret-path admin auth)
 *
 * Owns session state for the new admin auth system:
 *   - admin            { name, email, avatar } or null
 *   - loading           true while the initial /me check is in flight
 *   - isAuthenticated   derived boolean true once /me has confirmed a session
 *   - setAdmin          update after sign-up / login / OAuth
 *   - logout            clears cookie + state + redirects to the secret login page
 *
 * On mount, this calls GET /me so a page refresh restores the session
 * instead of bouncing the admin back to the login form.
 *
 * Usage:
 *   import { useAdminAuth } from "../../context/AdminAuthContext";
 *   const { admin, isAuthenticated, loading, setAdmin, logout } = useAdminAuth();
 */

import { createContext, useContext, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import adminApi from "../api/adminApi";

const AdminAuthContext = createContext(null);

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || "/admin-x9k2";

export function AdminAuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // ── Restore session on mount (e.g. after a page refresh) ─────
  //
  // Perf note: this provider wraps the entire app (App.jsx), but every
  // consumer of useAdminAuth() lives inside admin-only pages/components.
  // Public visitors — the vast majority of pageviews — never need this,
  // so firing it unconditionally cost every public pageview one extra
  // wasted round-trip to the server. Same fix already applied to the
  // other admin session check in AuthContext.jsx.
  useEffect(() => {
    let isMounted = true;

    if (!window.location.pathname.startsWith("/admin")) {
      setLoading(false);
      return;
    }

    adminApi
      .get("/me")
      .then(({ data }) => {
        if (isMounted) setAdmin(data);
      })
      .catch(() => {
        if (isMounted) setAdmin(null);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const logout = useCallback(async () => {
    try {
      await adminApi.post("/logout");
    } catch {
      // Swallow cookie will be cleared server-side; if the request fails
      // we still clear local state and redirect.
    }
    setAdmin(null);
    navigate(ADMIN_PATH, { replace: true });
  }, [navigate]);

  const value = useMemo(
    () => ({
      admin,                    // { name, email, avatar } | null
      setAdmin,                 // update after sign-up / login / OAuth
      loading,                  // true while the initial /me check is in flight
      isAuthenticated: !!admin, // derived convenience flag
      logout,                   // clears cookie + state + redirects
    }),
    [admin, loading, logout]
  );

  return (
    <AdminAuthContext.Provider value={value}>
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth() {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) {
    throw new Error("useAdminAuth must be used inside <AdminAuthProvider>");
  }
  return ctx;
}