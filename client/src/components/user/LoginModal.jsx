/**
 * src/components/user/LoginModal.jsx — Premium Redesign
 *
 * Dark modal with:
 *  - Gradient header with lock icon
 *  - Glowing input focus rings
 *  - Gradient submit button
 *  - Contact info section
 *
 * Changes in this revision:
 *  - "Contact admin to buy premium." is now a real button that opens
 *    the PremiumPopup via the `onUpgradeClick` prop, wired from UserLayout.
 *  - The idle-timer suppression during login is now handled directly in
 *    UserLayout.jsx (useIdleAutoPopup is told showLogin is a "popup open"
 *    state too), so this file no longer needs a window-event workaround.
 */

import { useState, useEffect, useRef } from "react";
import api from "../../api/axios";
import { useAuth } from "../../context/AuthContext";
import { usePublicSettings } from "../../public/context/PublicSettingsContext";
import toast from "react-hot-toast";
import { FaUnlockKeyhole } from "react-icons/fa6";

function Spinner() {
  return (
    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
  );
}

export default function LoginModal({ onClose, onLoginSuccess, onUpgradeClick }) {
  const { setPremiumUser } = useAuth();
  const { phone, whatsappNumber, email: adminEmail } = usePublicSettings();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPass, setShowPass] = useState(false);

  const backdropRef = useRef(null);
  const usernameRef = useRef(null);

  useEffect(() => {
    const t = setTimeout(() => usernameRef.current?.focus(), 50);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  async function handleLogin() {
    setError("");
    if (!username.trim() || !password) {
      setError("Username and password are required.");
      return;
    }

    setLoading(true);
    try {
      const res = await api.post("/user/auth/login", {
        email: username.trim(),
        password,
      });

      setPremiumUser(res.data.user);
      toast.success("Welcome back! 🎉");
      if (onLoginSuccess) {
        onLoginSuccess(res.data.user);
      } else {
        onClose();
      }
    } catch (err) {
      const status = err.response?.status;
      const message = err.response?.data?.message;

      if (status === 401) {
        setError("Invalid username or password.");
      } else if (status === 423) {
        setError(
          message ||
            "Too many failed attempts. Please try again in 15 minutes.",
        );
      } else if (status === 403) {
        setError(
          message ||
            "Your access has expired. Please contact the admin to renew.",
        );
      } else if (status === 409) {
        setError(
          message ||
            "This account is already logged in on another device. Please log out from the other device before logging in here.",
        );
      } else {
        setError(message || "Login failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" && !loading) handleLogin();
  }

  function handleUpgradeClick() {
    if (typeof onUpgradeClick === "function") {
      onUpgradeClick();
    } else {
      onClose();
    }
  }

  const displayPhone = phone || whatsappNumber;
  const whatsappLink = whatsappNumber
    ? `https://wa.me/${whatsappNumber}`
    : null;

  const inputClass = `
    w-full text-sm rounded-xl px-4 py-3 outline-none transition-all duration-200
    text-slate-900 placeholder:text-slate-400 bg-slate-100 border border-slate-300
    dark:text-white dark:placeholder:text-purple-400/40 dark:bg-white/5 dark:border-brand/30
    font-medium
  `;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6 overflow-y-auto animate-fadeIn"
      style={{ background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="max-w-sm w-full rounded-3xl shadow-2xl overflow-hidden my-auto border border-slate-300 dark:border-brand/30"
        style={{ background: "var(--bg-modal)" }}
      >
        {/* ── Header ────────────────────────────────────── */}
        <div className="px-6 py-6 relative bg-brand/10 border-b border-slate-200 dark:border-white/10 dark:bg-brand/20">
          <button
            onClick={onClose}
            aria-label="Close login modal"
            className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white dark:hover:bg-white/10 transition text-xl leading-none"
          >
            ×
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl flex items-center justify-center text-xl bg-white/50 dark:bg-white/10">
              <FaUnlockKeyhole />
            </div>
            <div>
              <h2 className="font-heading font-bold text-slate-900 dark:text-white text-lg leading-tight">
                Login to PrepPK
              </h2>
              <p className="text-slate-500 dark:text-purple-300/70 text-xs mt-0.5">
                Access your premium tests
              </p>
            </div>
          </div>
        </div>

        {/* ── Body ──────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-4">
          {/* Username */}
          <div>
            <label className="text-xs font-bold text-brand dark:text-purple-400/70 uppercase tracking-widest block mb-2">
              Username / Email
            </label>
            <input
              ref={usernameRef}
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              placeholder="your@email.com"
              autoComplete="username"
              className={inputClass}
              onFocus={(e) => {
                e.currentTarget.style.borderColor = "var(--color-brand)";
                e.currentTarget.style.boxShadow =
                  "0 0 0 3px rgba(108,99,255,0.15)";
              }}
              onBlur={(e) => {
                e.currentTarget.style.borderColor = "";
                e.currentTarget.style.boxShadow = "none";
              }}
            />
          </div>

          {/* Password */}
          <div>
            <label className="text-xs font-bold text-brand dark:text-purple-400/70 uppercase tracking-widest block mb-2">
              Password
            </label>
            <div className="relative">
              <input
                type={showPass ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={loading}
                placeholder="••••••••••••"
                autoComplete="current-password"
                className={inputClass}
                style={{ paddingRight: "2.8rem" }}
                onFocus={(e) => {
                  e.currentTarget.style.borderColor = "var(--color-brand)";
                  e.currentTarget.style.boxShadow =
                    "0 0 0 3px rgba(108,99,255,0.15)";
                }}
                onBlur={(e) => {
                  e.currentTarget.style.borderColor = "";
                  e.currentTarget.style.boxShadow = "none";
                }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-900 dark:text-purple-400/50 dark:hover:text-purple-300 transition text-xs"
              >
                {showPass ? "Hide" : "Show"}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              role="alert"
              className="text-sm font-medium rounded-xl p-3 leading-relaxed flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 dark:bg-red-500/10 dark:border-red-500/30 dark:text-red-400"
            >
              <span>⚠️</span>
              <span>{error}</span>
            </div>
          )}

          {/* Login button */}
          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full font-heading font-bold py-3.5 rounded-2xl text-white text-sm transition-all duration-300 hover:scale-105 disabled:opacity-60 disabled:scale-100 flex items-center justify-center gap-2"
            style={{
              background: "linear-gradient(135deg, #6C63FF 0%, #a855f7 100%)",
            }}
          >
            {loading && <Spinner />}
            {loading ? "Logging in…" : "Login"}
          </button>

          {/* Admin contact */}
          <div className="pt-4 space-y-2 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs text-center text-slate-500 dark:text-purple-400/60">
              Don't have access yet?{" "}
              <button
                type="button"
                onClick={handleUpgradeClick}
                className="text-brand dark:text-purple-300 underline underline-offset-2 hover:text-brand-dark dark:hover:text-white transition font-medium"
              >
                Contact admin to buy premium.
              </button>
            </p>
            <div className="flex flex-col items-center gap-1.5">
              {displayPhone && whatsappLink && (
                <a
                  href={whatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold hover:underline transition"
                  style={{ color: "#00e676" }}
                >
                  💬 WhatsApp: {displayPhone}
                </a>
              )}
              {displayPhone && !whatsappLink && (
                <span className="text-xs text-slate-500 dark:text-purple-300/70 font-semibold">
                  📞 {displayPhone}
                </span>
              )}
              {adminEmail && (
                <a
                  href={`mailto:${adminEmail}`}
                  className="text-xs text-brand dark:text-purple-400/70 hover:text-brand-dark dark:hover:text-purple-300 underline underline-offset-2 transition"
                >
                  {adminEmail}
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
