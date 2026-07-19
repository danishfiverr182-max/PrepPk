/**
 * src/components/user/PremiumPopup.jsx — Premium Redesign
 *
 * Irresistible upgrade modal with:
 *  - Dark gradient header with crown + animated stars
 *  - Glowing gold "1 Month BEST VALUE" pricing card
 *  - Benefits list with check icons
 *  - WhatsApp CTA with pulse animation
 *  - Social proof ("500+ students this month")
 *  - Urgency element
 */

import { useRef, useEffect, useState } from "react";
import { PiSignInBold } from "react-icons/pi";
import { PiStarFill } from "react-icons/pi";
import api from "../../api/axios";
import { PiCreditCardFill } from "react-icons/pi";

function WhatsAppIcon() {
  return (
    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

const DEFAULTS = {
  phone: "",
  whatsappNumber: "",
  email: "",
  weekPrice: 300,
  monthPrice: 1000,
  monthOriginalPrice: 1200,
};

const PERKS = [
  "All categories unlocked instantly",
  "Unlimited mock tests, no daily cap",
  "Army, Navy, Air Force, KPPSC, FPSC and more",
  "Full detailed results & review",
  "Real exam-pattern MCQs",
];

export default function PremiumPopup({ onClose, onLoginClick, intent = null }) {
  const backdropRef = useRef(null);
  const [settings, setSettings] = useState(DEFAULTS);

  useEffect(() => {
    api
      .get("/settings/contact")
      .then(({ data }) => setSettings({ ...DEFAULTS, ...data }))
      .catch(() => {});
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

  const {
    phone,
    whatsappNumber,
    email,
    weekPrice,
    monthPrice,
    monthOriginalPrice,
  } = settings;
  const displayNumber = phone || whatsappNumber;
  const savingsPercent =
    monthOriginalPrice > monthPrice
      ? Math.round((1 - monthPrice / monthOriginalPrice) * 100)
      : null;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-start sm:items-center justify-center px-4 overflow-y-auto py-6 animate-fadeIn"
      style={{ background: "rgba(0, 0, 0, 0.75)", backdropFilter: "blur(8px)" }}
    >
      <div
        className="max-w-md w-full overflow-hidden my-auto rounded-3xl shadow-2xl border border-slate-300 dark:border-brand/30"
        style={{ background: "var(--bg-modal)" }}
      >
        {/* ── Header ──────────────────────────────────────── */}
        <div className="px-6 py-7 relative text-center bg-brand/10 border-b border-slate-200 dark:border-white/10 dark:bg-brand/20">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-20 text-slate-500 hover:text-slate-900 hover:bg-slate-200 dark:text-white/50 dark:hover:text-white transition text-2xl leading-none w-8 h-8 flex items-center justify-center rounded-full dark:hover:bg-white/10"
          >
            ×
          </button>

          {/* Stars background */}
          <div className="absolute inset-0 pointer-events-none">
            {[...Array(6)].map((_, i) => (
              <span
                key={i}
                className="absolute text-yellow-400/30 animate-pulse"
                style={{
                  top: `${10 + i * 14}%`,
                  left: `${5 + i * 16}%`,
                  fontSize: `${8 + (i % 3) * 4}px`,
                  animationDelay: `${i * 0.3}s`,
                }}
              >
                ★
              </span>
            ))}
          </div>

          <div className="relative z-10">
            <div className="text-4xl mb-3 animate-float inline-block">👑</div>
            <h2 className="font-heading font-black text-slate-900 dark:text-white text-2xl mb-1.5">
              Unlock Premium Access
            </h2>
            <p className="text-slate-600 dark:text-purple-200/80 text-sm leading-relaxed">
              Join{" "}
              <strong className="text-yellow-600 dark:text-yellow-300">
                12,000+ students
              </strong>{" "}
              who prepared the smart way
            </p>

            {/* Social proof pill */}
            <div
              className="inline-flex items-center gap-2 mt-3 px-3 py-1.5 rounded-full text-xs font-semibold"
              style={{
                background: "rgba(0,230,118,0.15)",
                border: "1px solid rgba(0,230,118,0.3)",
                color: "#0F3D3A",
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              500+ students enrolled this month
            </div>
          </div>
        </div>

        {/* ── Body ────────────────────────────────────────── */}
        <div className="px-6 py-6 space-y-5">
          {/* Perks list */}
          <div className="space-y-2.5">
            {PERKS.map((perk) => (
              <div key={perk} className="flex items-center gap-3">
                <span className="w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 text-xs bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400">
                  ✓
                </span>
                <span className="text-slate-600 dark:text-purple-200/90 text-sm">
                  {perk}
                </span>
              </div>
            ))}
          </div>

          {/* Pricing */}
          <div className="space-y-2.5">
            <p className="text-xs font-bold text-brand dark:text-purple-400/70 uppercase tracking-widest">
              Pricing Plans
            </p>

            {/* 1 Week */}
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-100 border border-slate-300 dark:bg-white/5 dark:border-white/10">
              <div>
                <span className="text-slate-900 dark:text-white font-semibold text-sm">
                  1 Week
                </span>
                <p className="text-slate-500 dark:text-purple-300/60 text-xs mt-0.5">
                  Short-term prep
                </p>
              </div>
              <span className="font-heading font-black text-slate-900 dark:text-white text-xl">
                Rs. {weekPrice.toLocaleString()}
              </span>
            </div>

            {/* 1 Month — BEST VALUE */}
            <div
              className="flex items-center justify-between p-3.5 rounded-xl relative overflow-hidden bg-amber-50 border-2 border-amber-300 dark:bg-amber-500/10 dark:border-amber-500/50"
              style={{ boxShadow: "0 0 20px rgba(245, 197, 66, 0.15)" }}
            >
              {/* Gold shimmer */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "linear-gradient(90deg, transparent, rgba(245,197,66,0.06), transparent)",
                  animation: "shimmerText 3s linear infinite",
                }}
              />
              <div className="relative z-10">
                <div className="flex items-center gap-2">
                  <span className="text-slate-900 dark:text-white font-bold text-sm">
                    1 Month
                  </span>
                  <span
                    className="text-xs  font-black px-2 py-0.5 rounded-full inline-flex items-center gap-1"
                    style={{
                      background: "rgba(245, 197, 66, 0.25)",
                      color: "#f5c542",
                    }}
                  >
                    <PiStarFill className="text-sm text-amber-600" />
                    BEST VALUE
                  </span>
                </div>
                <p className="text-amber-600 dark:text-yellow-400/70 text-xs mt-0.5">
                  Most popular choice
                </p>
              </div>
              <div className="relative z-10 text-right">
                <span className="font-heading font-black text-slate-900 dark:text-white text-xl block">
                  Rs. {monthPrice.toLocaleString()}
                </span>
                {savingsPercent && (
                  <span className="text-xs text-green-600 dark:text-green-400 font-semibold">
                    Save {savingsPercent}%
                  </span>
                )}
                {monthOriginalPrice > monthPrice && (
                  <span className="text-slate-400 dark:text-purple-400/50 line-through text-xs ml-1">
                    Rs. {monthOriginalPrice.toLocaleString()}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* How to pay */}
          <div className="px-4 py-3 rounded-xl bg-brand/5 border border-brand/20 dark:bg-brand/10">
            <p className="text-xs text-brand-dark dark:text-purple-300 font-semibold mb-1 flex items-center gap-1.5">
              <PiCreditCardFill className="text-sm" />
              How to pay:
            </p>
            <p className="text-xs text-slate-600 dark:text-purple-200/70 leading-relaxed">
              Pay via{" "}
              <strong className="text-slate-900 dark:text-white">
                EasyPaisa
              </strong>{" "}
              or{" "}
              <strong className="text-slate-900 dark:text-white">
                JazzCash
              </strong>{" "}
              to{" "}
              <strong className="text-yellow-600 dark:text-yellow-300">
                {displayNumber ? `${displayNumber}` : "our number"}
              </strong>
              , then send your screenshot on WhatsApp.
            </p>
          </div>

          {/* WhatsApp CTA */}
          {whatsappNumber ? (
            <a
              href={`https://wa.me/${whatsappNumber}`}
              target="_blank"
              rel="noreferrer"
              className="relative group flex items-center justify-center gap-3 w-full font-heading font-bold py-4 rounded-2xl text-white transition-all duration-300 hover:scale-105 overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #25D366 0%, #128C7E 100%)",
              }}
            >
              <span className="relative z-10 flex items-center gap-2">
                <WhatsAppIcon />
                Chat on WhatsApp:
                {displayNumber && (
                  <span className="text-white/90 font-bold text-sm">
                     {displayNumber}
                  </span>
                )}
              </span>
              {/* Pulse ring */}
              <span className="absolute inset-0 rounded-2xl animate-ring border-2 border-green-400 opacity-0 group-hover:opacity-100" />
            </a>
          ) : (
            <div className="h-12 bg-white/5 rounded-2xl animate-pulse" />
          )}

          {/* Email */}
          {email && (
            <p className="text-center text-xs text-slate-500 dark:text-purple-400/60">
              Or email us at{" "}
              <a
                href={`mailto:${email}`}
                className="text-brand dark:text-purple-300 hover:text-brand-dark dark:hover:text-white underline underline-offset-2 transition"
              >
                {email}
              </a>
            </p>
          )}

          {/* Already bought — Login */}
          <div className="border-t border-slate-200 dark:border-white/10 pt-4">
            <p className="text-center text-xs text-slate-600 dark:text-purple-400/70 mb-3">
              Already purchased? Log in to access your tests.
            </p>
            <button
              onClick={() => onLoginClick(intent)}
              className="w-full font-semibold py-3 rounded-xl text-slate-800 bg-slate-200 border border-slate-300 hover:bg-slate-300 dark:text-white dark:bg-brand/20 dark:border-brand/40 text-sm transition-all duration-200 hover:scale-105 flex items-center justify-center gap-2"
            >
              <PiSignInBold className="text-lg" />
              Login to Your Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
