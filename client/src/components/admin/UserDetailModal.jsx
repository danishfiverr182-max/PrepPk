import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import { useCategories } from "../../hooks/useCategories";

// ── Copyable field (same flash behavior as CreateUserModal) ───
function CopyField({ value, mono = false }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed please copy manually.");
    }
  }

  return (
    <div className="flex items-center gap-2 min-w-0">
      <span
        className={`flex-1 text-sm break-all ${
          mono ? "font-mono text-amber-600 tracking-wider" : "text-txt-primary"
        }`}
      >
        {value}
      </span>
      <button
        type="button"
        onClick={handleCopy}
        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition font-semibold ${
          copied
            ? "bg-success-light/20 text-success border border-success/40"
            : "bg-bg hover:bg-bg text-txt-secondary"
        }`}
      >
        {copied ? (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
            Copied!
          </>
        ) : (
          <>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            Copy
          </>
        )}
      </button>
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────
function formatDateTime(dateStr) {
  if (!dateStr) return " ";
  const d = new Date(dateStr);
  const date = d.toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const time = d.toLocaleTimeString("en-PK", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  return `${date} at ${time}`;
}

function formatDate(dateStr) {
  if (!dateStr) return " ";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Info row ─────────────────────────────────────────────────
function InfoRow({ label, children }) {
  return (
    <div className="grid grid-cols-[130px_1fr] gap-3 py-3 border-b border-border last:border-0 items-start">
      <span className="text-xs text-txt-muted uppercase tracking-widest pt-0.5">{label}</span>
      <div>{children}</div>
    </div>
  );
}

// ── Main Modal ────────────────────────────────────────────────
export default function UserDetailModal({ userId, onClose }) {
  const [user,            setUser]            = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState("");
  const [retrieving,      setRetrieving]      = useState(false);
  const [plainPassword,   setPlainPassword]   = useState(null);   // string | null | "expired"
  const [forcingLogout,   setForcingLogout]   = useState(false);
  // Cosmetic-only favorite-categories editing (navbar highlight, no access effect)
  const [savingFavorites, setSavingFavorites] = useState(false);
  const { categories: allCategories, loading: catsLoading } = useCategories();
  const overlayRef = useRef(null);

  async function toggleFavoriteCategory(slug) {
    if (!user) return;
    const current = user.favoriteCategories || [];
    const next = current.includes(slug)
      ? current.filter((s) => s !== slug)
      : [...current, slug];

    // Optimistic update
    setUser((prev) => ({ ...prev, favoriteCategories: next }));
    setSavingFavorites(true);
    try {
      await api.patch(`/admin/users/${userId}/favorite-categories`, {
        favoriteCategories: next,
      });
    } catch (err) {
      // Revert on failure
      setUser((prev) => ({ ...prev, favoriteCategories: current }));
      toast.error(err.response?.data?.message || "Failed to update favorite categories.");
    } finally {
      setSavingFavorites(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/admin/users/${userId}`)
      .then((res) => setUser(res.data))
      .catch((err) => setError(err.response?.data?.message || "Failed to load user."))
      .finally(() => setLoading(false));
  }, [userId]);

  // Close on Escape key
  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function handleRetrievePassword() {
    setRetrieving(true);
    try {
      const res = await api.get(`/admin/users/${userId}/retrieve-password`);
      if (res.data.password) {
        setPlainPassword(res.data.password);
      } else {
        setPlainPassword("expired");
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to retrieve password.");
    } finally {
      setRetrieving(false);
    }
  }

  // Click outside to close
  function handleOverlayClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  async function handleForceLogout() {
    setForcingLogout(true);
    try {
      await api.post(`/admin/users/${userId}/force-logout`);
      setUser((prev) => (prev ? { ...prev, hasActiveSession: false } : prev));
      toast.success("Session cleared. The user can log in on a new device now.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear session.");
    } finally {
      setForcingLogout(false);
    }
  }

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 px-4"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-txt-primary">Account Details</h2>
          <button
            onClick={onClose}
            className="text-txt-secondary hover:text-txt-primary transition p-1 rounded-lg hover:bg-surface"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-4">

          {/* Loading spinner */}
          {loading && (
            <div className="flex items-center justify-center py-16">
              <span className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {/* Error */}
          {!loading && error && (
            <p className="text-danger text-sm text-center py-8">{error}</p>
          )}

          {/* Content */}
          {!loading && !error && user && (
            <div>
              {/* Info grid */}
              <div className="mb-6">
                <InfoRow label="Email">
                  <CopyField value={user.email} />
                </InfoRow>

                <InfoRow label="Status">
                  {user.isExpired ? (
                    <span className="text-xs bg-danger-light/15 text-danger border border-danger/30 px-2.5 py-1 rounded-full font-semibold">
                      Expired
                    </span>
                  ) : (
                    <span className="text-xs bg-success-light/15 text-success border border-success/30 px-2.5 py-1 rounded-full font-semibold">
                      Active
                    </span>
                  )}
                </InfoRow>

                <InfoRow label="Expiry Date">
                  <span className={`text-sm ${user.isExpired ? "text-danger" : "text-txt-primary"}`}>
                    {formatDateTime(user.expiresAt)}
                  </span>
                </InfoRow>

                <InfoRow label="Created">
                  <span className="text-sm text-txt-primary">{formatDate(user.createdAt)}</span>
                </InfoRow>

                <InfoRow label="Plan">
                  <span className="text-sm text-txt-secondary capitalize">
                    {user.duration?.replace("-", " ") || " "}
                  </span>
                </InfoRow>

                <InfoRow label="Access Level">
                  <span className="text-xs bg-green-900/50 text-green-300 border border-green-700/40 px-2.5 py-0.5 rounded-full font-medium">
                    All Categories
                  </span>
                </InfoRow>

                <InfoRow label="Session">
                  <div className="flex items-center gap-3 flex-wrap">
                    {user.hasActiveSession ? (
                      <span className="text-xs bg-amber-900/30 text-amber-400 border border-amber-700/40 px-2.5 py-1 rounded-full font-semibold">
                        Logged in on a device
                      </span>
                    ) : (
                      <span className="text-xs bg-bg text-txt-muted border border-border px-2.5 py-1 rounded-full font-semibold">
                        No active session
                      </span>
                    )}
                    {user.hasActiveSession && (
                      <button
                        onClick={handleForceLogout}
                        disabled={forcingLogout}
                        className="flex items-center gap-1.5 text-xs font-semibold text-danger hover:underline disabled:opacity-60"
                      >
                        {forcingLogout && (
                          <span className="w-3 h-3 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                        )}
                        {forcingLogout ? "Clearing…" : "Force Logout"}
                      </button>
                    )}
                  </div>
                </InfoRow>

                <InfoRow label="Notes">
                  {user.notes ? (
                    <span className="text-sm text-txt-primary whitespace-pre-wrap">{user.notes}</span>
                  ) : (
                    <span className="text-sm text-txt-muted">No notes</span>
                  )}
                </InfoRow>
              </div>

              {/* Favorite categories   cosmetic navbar highlight only, no access effect */}
              <div className="border border-border rounded-xl p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs text-txt-muted uppercase tracking-widest">
                    Favorite Categories
                  </p>
                  {savingFavorites && (
                    <span className="w-3 h-3 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  )}
                </div>
                <p className="text-xs text-txt-muted">
                  Briefly highlighted in this user's navbar after login. Doesn't limit access.
                </p>
                {catsLoading ? (
                  <p className="text-xs text-txt-muted">Loading categories…</p>
                ) : (
                  <div className="flex flex-wrap gap-2 pt-1">
                    {allCategories.map((cat) => {
                      const checked = (user.favoriteCategories || []).includes(cat.slug);
                      return (
                        <label
                          key={cat._id}
                          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer transition ${
                            checked
                              ? "border-brand bg-brand-light text-txt-primary font-medium"
                              : "border-border text-txt-secondary hover:border-txt-muted"
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleFavoriteCategory(cat.slug)}
                            className="accent-brand"
                          />
                          {cat.name}
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Retrieve Password section */}
              <div className="border border-border rounded-xl p-4 space-y-3">
                <p className="text-xs text-txt-muted uppercase tracking-widest">Password Retrieval</p>

                {/* Already retrieved show copyable field */}
                {plainPassword && plainPassword !== "expired" && (
                  <div className="bg-surface rounded-lg px-3 py-2.5">
                    <CopyField value={plainPassword} mono />
                  </div>
                )}

                {/* Expired message */}
                {plainPassword === "expired" && (
                  <p className="text-sm text-amber-400">
                    Password no longer available use Reset Password instead.
                  </p>
                )}

                {/* Button */}
                {!plainPassword && (
                  user.hasPlainPassword ? (
                    <button
                      onClick={handleRetrievePassword}
                      disabled={retrieving}
                      className="flex items-center gap-2 bg-green-600 hover:bg-success-light disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
                    >
                      {retrieving && (
                        <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      )}
                      {retrieving ? "Retrieving…" : "Retrieve Password"}
                    </button>
                  ) : (
                    <div className="relative group inline-block">
                      <button
                        disabled
                        className="flex items-center gap-2 bg-bg text-txt-muted text-sm font-semibold px-4 py-2 rounded-xl cursor-not-allowed"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                        </svg>
                        Retrieve Password
                      </button>
                      {/* Tooltip */}
                      <span className="absolute bottom-full left-0 mb-2 w-56 bg-surface text-amber-400 text-xs rounded-lg px-3 py-2 opacity-0 group-hover:opacity-100 transition pointer-events-none border border-border z-10">
                        Password window expired use Reset Password instead.
                      </span>
                    </div>
                  )
                )}

                {/* After retrieval, show a note */}
                {plainPassword && plainPassword !== "expired" && (
                  <p className="text-xs text-txt-muted">
                    Store this securely it will not be available after 24 hours from account creation.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
            className="w-full text-sm text-txt-secondary hover:text-txt-primary border border-border hover:border-txt-muted py-2.5 rounded-xl transition"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
