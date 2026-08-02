/**
 * src/components/user/Footer.jsx — Premium Redesign
 *
 * Dark gradient footer with:
 *  - Brand identity + tagline
 *  - Premium CTA with gold gradient
 *  - Quick links + Contact
 *  - Copyright bar
 */

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { usePublicCategories } from "../../public/context/PublicCategoriesContext";
import api from "../../api/axios";
import { PiCrownFill } from "react-icons/pi";
import { PiLightningFill } from "react-icons/pi";

function WhatsAppIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 flex-shrink-0"
      fill="currentColor"
      viewBox="0 0 24 24"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

export default function Footer({ onBuyPremiumClick }) {
  const { categories } = usePublicCategories();
  const year = new Date().getFullYear();

  const [contact, setContact] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    api
      .get("/settings/contact")
      .then(({ data }) => setContact(data))
      .catch(() => setFailed(true));
  }, []);

  const hasContact =
    contact && (contact.whatsappNumber || contact.email || contact.phone);

  return (
    <footer
      className="border-t border-slate-200 dark:border-brand/20"
      style={{ background: "var(--bg-footer)" }}
    >
      {/* ── Main footer content ───────────────────────────── */}
      <div className="max-w-6xl mx-auto px-4 md:px-8 py-10 grid grid-cols-1 sm:grid-cols-3 gap-8">
        {/* Brand */}
        <div>
          {/* Logo */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-600 to-indigo-600 flex items-center justify-center shadow-glow">
              <span className="text-white font-black text-sm">P</span>
            </div>
            <span className="font-heading font-bold text-slate-900 dark:text-white text-lg">
              Prep
              <span className="text-yellow-600 dark:text-yellow-300">PK</span>
            </span>
          </div>

          <p className="text-slate-500 dark:text-purple-300/60 text-xs leading-relaxed mb-4">
            Pakistan's most trusted mock test platform for Armed Forces initial
            tests. Prepare smarter, pass faster.
          </p>

          {/* Star rating */}
          <div className="flex items-center gap-1.5 mb-4">
            <div className="flex">
              {[...Array(5)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-sm">
                  ★
                </span>
              ))}
            </div>
            <span className="text-xs text-slate-500 dark:text-purple-300/50">
              5.0 · 12K+ students
            </span>
          </div>

          {/* Premium CTA */}
          <button
            onClick={onBuyPremiumClick}
            className="relative group inline-flex items-center gap-2 px-4 py-2 rounded-xl font-heading font-bold text-xs text-navy transition-all duration-300 hover:scale-105 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #F5C542, #f09819)" }}
          >
            <span className="relative z-10 flex items-center gap-1.5">
              <PiCrownFill className="text-lg text-amber-900" />
              Get Premium Access
            </span>
          </button>
        </div>

        {/* Quick links */}
        <div>
          <p className="text-xs font-bold text-brand dark:text-purple-400/70 uppercase tracking-widest mb-4">
            Quick Links
          </p>
          <ul className="space-y-2 max-h-40 overflow-y-auto scrollbar-footer">
            <li>
              <Link
                to="/"
                className="text-sm text-slate-600 dark:text-purple-300/70 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-2"
              >
                <span className="text-purple-500 text-xs">›</span> Home
              </Link>
            </li>
            {categories.map((cat) => (
              <li key={cat._id}>
                <Link
                  to={`/category/${cat.slug}`}
                  className="text-sm text-slate-600 dark:text-purple-300/70 hover:text-slate-900 dark:hover:text-white transition flex items-center gap-2"
                >
                  <span className="text-purple-500 text-xs">›</span> {cat.name}
                </Link>
              </li>
            ))}
            <li>
              <Link
                to="/free-mock-tests"
                className="text-sm text-amber-600 dark:text-yellow-400/80 hover:text-amber-700 dark:hover:text-yellow-300 transition flex items-center gap-2 font-semibold"
              >
                <PiLightningFill className="text-sm" />
                Free Mock Tests
              </Link>
            </li>
          </ul>
        </div>

        {/* Contact */}
        <div>
          <p className="text-xs font-bold text-brand dark:text-purple-400/70 uppercase tracking-widest mb-4">
            Contact Us
          </p>

          {contact === null && !failed && (
            <div className="space-y-2 animate-pulse">
              <div className="h-4 bg-white/10 rounded w-36" />
              <div className="h-4 bg-white/10 rounded w-44" />
            </div>
          )}

          {hasContact && (
            <ul className="space-y-3">
              {contact.whatsappNumber && (
                <li>
                  <a
                    href={`https://wa.me/${contact.whatsappNumber}`}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-purple-300/70 hover:text-green-600 dark:hover:text-green-400 transition group"
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform"
                      style={{ background: "rgba(0, 230, 118, 0.15)" }}
                    >
                      <WhatsAppIcon />
                    </span>
                    {contact.phone || contact.whatsappNumber}
                  </a>
                </li>
              )}
              {contact.email && (
                <li>
                  <a
                    href={`mailto:${contact.email}`}
                    className="flex items-center gap-2 text-sm text-slate-600 dark:text-purple-300/70 hover:text-brand dark:hover:text-white transition"
                  >
                    <span
                      className="w-6 h-6 rounded-lg flex items-center justify-center flex-shrink-0"
                      style={{ background: "rgba(108, 99, 255, 0.15)" }}
                    >
                      <svg
                        className="w-3 h-3 text-purple-400"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                        />
                      </svg>
                    </span>
                    {contact.email}
                  </a>
                </li>
              )}
            </ul>
          )}

          {(failed || (contact !== null && !hasContact)) && (
            <p className="text-xs text-slate-500 dark:text-purple-400/40 italic">
              Contact info unavailable.
            </p>
          )}

          {/* Payment methods */}
          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-white/10">
            <p className="text-xs text-slate-500 dark:text-purple-400/50 mb-2">
              Payment via
            </p>
            <div className="flex gap-2">
              {["EasyPaisa", "JazzCash"].map((m) => (
                <span
                  key={m}
                  className="text-xs px-2.5 py-1 rounded-lg text-slate-600 dark:text-purple-300/60 font-medium bg-slate-200 border border-slate-300 dark:bg-white/5 dark:border-white/10"
                >
                  {m}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Legal / info links ───────────────────────────── */}
      <div className="px-4 py-4 border-t border-slate-200 dark:border-white/10">
        <ul className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
          {[
            { to: "/about-us", label: "About Us" },
            { to: "/contact-us", label: "Contact Us" },
            { to: "/privacy-policy", label: "Privacy Policy" },
            { to: "/terms-and-conditions", label: "Terms & Conditions" },
            { to: "/disclaimer", label: "Disclaimer" },
          ].map((link) => (
            <li key={link.to}>
              <Link
                to={link.to}
                className="text-xs text-slate-500 dark:text-purple-300/60 hover:text-slate-900 dark:hover:text-white transition"
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* ── Copyright bar ────────────────────────────────── */}
      <div className="px-4 py-3 border-t border-slate-200 dark:border-white/10">
        <p className="text-center text-xs text-slate-500 dark:text-purple-400/40">
          © {year} PrepPK · Pakistan's #1 Armed Forces Mock Test Platform · All
          rights reserved.
        </p>
      </div>
    </footer>
  );
}
