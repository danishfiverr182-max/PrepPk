/**
 * components/admin/CreateUserModal.jsx  (Prompt 4   Simplify Create User Form)
 *
 * Changes:
 *  - Success screen now reads:
 *    "This user has full premium access to all categories until [expiresAt date]."
 *    instead of the generic "Full access to all categories" line.
 *  - formatDate updated to use long month format: "30 December 2025".
 *  - Form already has no category checkboxes (removed in Prompt 1).
 *    Form remains: Generated Password → Email → Duration (radio) → Notes → Create Account.
 *  - All other behaviour (copy/regenerate password, Escape-to-close) is unchanged.
 */

import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import { useCategories } from "../../hooks/useCategories";

// ── Client-side password generator ───────────────────────────
const CHARSET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
function generatePasswordLocally() {
  let pw = "";
  const arr = new Uint8Array(12);
  crypto.getRandomValues(arr);
  for (let i = 0; i < 12; i++) {
    pw += CHARSET[arr[i] % CHARSET.length];
  }
  return pw;
}

// Format date as "30 December 2025"
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    day:   "numeric",
    month: "long",
    year:  "numeric",
  });
}

function CopyField({ label, value, mono = false }) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef(null);
  useEffect(() => () => clearTimeout(timerRef.current), []);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      timerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed   please copy manually.");
    }
  }

  return (
    <div>
      <p className="text-xs text-txt-muted mb-1">{label}</p>
      <div className="flex items-center gap-2">
        <p className={`flex-1 text-sm break-all ${mono ? "font-mono text-brand tracking-wider" : "text-txt-primary"}`}>
          {value}
        </p>
        <button
          type="button"
          onClick={handleCopy}
          className={`flex-shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs rounded-lg transition font-semibold ${
            copied
              ? "bg-success-light text-green-800 border border-success"
              : "bg-surface border border-border text-txt-secondary hover:text-txt-primary"
          }`}
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────
export default function CreateUserModal({ onClose, onCreated }) {
  const [email,             setEmail]             = useState("");
  const [duration,          setDuration]          = useState("1-week");
  const [notes,             setNotes]             = useState("");
  const [loading,           setLoading]           = useState(false);
  const [emailError,        setEmailError]        = useState("");
  const [generatedPassword, setGeneratedPassword] = useState(() => generatePasswordLocally());
  const [pwCopied,          setPwCopied]          = useState(false);
  const [credentials,       setCredentials]       = useState(null);
  // Cosmetic-only: which categories to briefly highlight in the navbar for
  // this user after login. Does not grant/restrict access   every premium
  // user already has access to every category regardless of this selection.
  const [favoriteCategories, setFavoriteCategories] = useState([]);
  const { categories: allCategories, loading: catsLoading } = useCategories();

  function toggleFavoriteCategory(slug) {
    setFavoriteCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }

  const backdropRef = useRef(null);
  const pwCopyTimer = useRef(null);

  useEffect(() => {
    function onKey(e) { if (e.key === "Escape") onClose(); }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => () => clearTimeout(pwCopyTimer.current), []);

  function isValidEmail(val) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim());
  }

  function handleRegenerate() {
    setPwCopied(false);
    setGeneratedPassword(generatePasswordLocally());
  }

  async function handleCopyPassword() {
    try {
      await navigator.clipboard.writeText(generatedPassword);
      setPwCopied(true);
      clearTimeout(pwCopyTimer.current);
      pwCopyTimer.current = setTimeout(() => setPwCopied(false), 2000);
    } catch {
      toast.error("Copy failed   please copy manually.");
    }
  }

  const canSubmit = isValidEmail(email) && !loading;

  async function handleCreate() {
    setEmailError("");

    if (!isValidEmail(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/admin/users", {
        email:         email.trim(),
        duration,
        plainPassword: generatedPassword,
        notes:         notes.trim(),
        favoriteCategories,
      });
      setCredentials(res.data.credentials);
      onCreated?.();
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || "Failed to create user.";
      if (status === 409) {
        setEmailError("This email already has an account.");
      } else {
        toast.error(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleCreateAnother() {
    setCredentials(null);
    setEmail("");
    setDuration("1-week");
    setNotes("");
    setEmailError("");
    setPwCopied(false);
    setGeneratedPassword(generatePasswordLocally());
    setFavoriteCategories([]);
  }

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col p-0">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-txt-primary text-xl font-bold">
            {credentials ? "Account Created!" : "Create User Login"}
          </h2>
          <button onClick={onClose} className="text-txt-muted hover:text-txt-primary transition text-xl leading-none">×</button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">

          {/* ══ Success Screen ════════════════════════════════ */}
          {credentials ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-success-light border border-success flex items-center justify-center flex-shrink-0">
                  <svg className="w-4 h-4 text-success" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <p className="text-sm text-txt-secondary">Share these credentials with the user.</p>
              </div>

              <div className="bg-bg border border-border rounded-xl p-4 space-y-4">
                <CopyField label="Email"    value={credentials.email} />
                <CopyField label="Password" value={credentials.password} mono />
              </div>

              {/* Access summary   shows full access + exact expiry date */}
              <div className="bg-bg border border-border rounded-xl px-4 py-3 space-y-1.5">
                <p className="text-xs text-txt-secondary">
                  This user has{" "}
                  <span className="text-success font-semibold">full premium access to all categories</span>{" "}
                  until{" "}
                  <span className="text-txt-primary font-semibold">{formatDate(credentials.expiresAt)}</span>.
                </p>
                <p className="text-xs text-txt-muted">
                  Plan: <span className="text-txt-secondary capitalize">{credentials.durationLabel}</span>
                </p>
              </div>

              <button onClick={handleCreateAnother} className="w-full bg-brand hover:bg-brand-dark text-white text-sm font-semibold py-2.5 rounded-xl transition">
                Create Another
              </button>
              <button onClick={onClose} className="w-full text-txt-secondary hover:text-txt-primary text-sm py-2 transition">
                Done
              </button>
            </div>

          ) : (
            /* ══ Create Form ══════════════════════════════════ */
            <div className="space-y-5">

              {/* Generated Password */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">Generated Password</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedPassword}
                    className="flex-1 min-w-0 bg-surface border border-border text-brand text-sm font-mono rounded-lg px-3 py-2.5 outline-none tracking-wider cursor-default select-all focus:ring-2 focus:ring-brand"
                  />
                  <button
                    type="button"
                    onClick={handleRegenerate}
                    title="Generate a new password"
                    className="px-3 py-2.5 bg-surface border border-border hover:text-txt-primary text-txt-secondary text-xs rounded-lg transition flex items-center gap-1.5 flex-shrink-0"
                  >
                    Regenerate
                  </button>
                  <button
                    type="button"
                    onClick={handleCopyPassword}
                    className={`px-3 py-2.5 text-xs rounded-lg transition flex items-center gap-1.5 flex-shrink-0 font-semibold ${
                      pwCopied
                        ? "bg-success-light text-green-800 border border-success"
                        : "bg-surface border border-border hover:text-txt-primary text-txt-secondary"
                    }`}
                  >
                    {pwCopied ? "Copied!" : "Copy"}
                  </button>
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  User Email <span className="text-danger">*</span>
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                  placeholder="user@example.com"
                  className={`w-full bg-surface border text-txt-primary placeholder:text-txt-muted text-sm rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand ${
                    emailError ? "border-danger" : "border-border"
                  }`}
                />
                {emailError && <p className="text-xs text-danger mt-1">{emailError}</p>}
              </div>

              {/* Duration */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-2">
                  Duration <span className="text-danger">*</span>
                </label>
                <div className="space-y-2">
                  {[
                    { value: "1-week",  label: "1 Week",  price: "Rs. 300" },
                    { value: "1-month", label: "1 Month", price: "Rs. 1,000", badge: "Save Rs. 200!" },
                  ].map((plan) => (
                    <label
                      key={plan.value}
                      className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition ${
                        duration === plan.value
                          ? "border-brand bg-brand-light"
                          : "border-border hover:border-txt-muted"
                      }`}
                    >
                      <input
                        type="radio"
                        name="duration"
                        value={plan.value}
                        checked={duration === plan.value}
                        onChange={() => setDuration(plan.value)}
                        className="accent-brand"
                      />
                      <span className="text-sm text-txt-primary font-medium">{plan.label}</span>
                      <span className="text-sm text-txt-secondary">{plan.price}</span>
                      {plan.badge && (
                        <span className="ml-auto text-xs bg-success-light text-green-800 px-2 py-0.5 rounded-full font-semibold">
                          {plan.badge}
                        </span>
                      )}
                    </label>
                  ))}
                </div>
                <p className="text-xs text-txt-muted mt-2">
                  ✓ User gets full access to <span className="text-success">all categories</span> for the selected duration.
                </p>
              </div>

              {/* Favorite categories   cosmetic navbar highlight only */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  Favorite Categories <span className="text-txt-muted">(optional)</span>
                </label>
                <p className="text-xs text-txt-muted mb-2">
                  Briefly highlights these in the user's navbar after login so they can
                  find them faster. Doesn't limit access   they can still take every test.
                </p>
                {catsLoading ? (
                  <p className="text-xs text-txt-muted">Loading categories…</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {allCategories.map((cat) => {
                      const checked = favoriteCategories.includes(cat.slug);
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

              {/* Notes */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  Notes <span className="text-txt-muted">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Admin memo, e.g. customer name or contact"
                  rows={2}
                  className="w-full bg-surface border border-border text-txt-primary placeholder:text-txt-muted text-sm rounded-lg px-3 py-2.5 outline-none transition resize-none focus:ring-2 focus:ring-brand"
                />
              </div>

              <button
                type="button"
                onClick={handleCreate}
                disabled={!canSubmit}
                className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                {loading && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {loading ? "Creating…" : "Create Account"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
