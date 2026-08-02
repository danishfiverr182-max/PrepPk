/**
 * src/public/components/SectionInstructionsModal.jsx  (Part 8 Prompt 03)
 *
 * Modal overlay displayed when the user clicks a "Not Started" section button
 * on the Test Hub. Shows section details and requires an explicit confirmation
 * before the timer starts.
 *
 * Props:
 *   sectionName       string   "Verbal" | "Non-Verbal" | "Academic"
 *   mcqCount          number   total questions in this section
 *   timeLimitSeconds  number   time limit in seconds (formatted as HH:MM:SS)
 *   subjectBreakdown  array    optional [{ subject, percentage }] admin-entered mix
 *   onStart()         fn       called when "Start Test" is confirmed
 *   onClose()         fn       called when X or backdrop is clicked
 *
 * Rendered via ReactDOM.createPortal into document.body so it sits above all
 * other content regardless of CSS stacking context.
 *
 * localStorage is NOT touched here the parent (TestHubPage) writes
 * 'inProgress' and then calls onStart(), which triggers navigation.
 */

import { useEffect } from "react";
import ReactDOM from "react-dom";
import { formatDuration } from "../utils/formatDuration";
import { LuClock3 } from "react-icons/lu";


// ── Info row ──────────────────────────────────────────────────
function InfoRow({ label, value, highlight }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-border last:border-0">
      <span className="text-sm text-txt-secondary">{label}</span>
      <span
        className={`text-sm font-semibold ${highlight ? "text-accent font-bold" : "text-txt-primary"}`}
      >
        {value}
      </span>
    </div>
  );
}

export default function SectionInstructionsModal({
  sectionName,
  mcqCount,
  timeLimitSeconds,
  onStart,
  onClose,
  passMark = "50%",
  subjectBreakdown = [],
}) {
  // ── Lock body scroll while modal is open ──────────────────────
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // ── Close on Escape key ───────────────────────────────────────
  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // ── Modal content ─────────────────────────────────────────────
  // Structure, two independent layers of defense against content getting
  // cut off:
  //
  // 1. OUTER SCROLL FIX: previously this modal combined centering
  //    (flex items-center justify-center) and scrolling (overflow-y-auto)
  //    on the SAME element. That combination has a well-documented browser
  //    quirk — when the centered child is taller than the viewport, the
  //    browser can clip BOTH its top and bottom and make those regions
  //    permanently unreachable by scrolling, no matter what max-height is
  //    set on the child. This is exactly the symptom reported: header and
  //    Cancel/Start buttons both cut off with no way to scroll to them.
  //    The fix is to never combine the two on one element: the outer div
  //    ONLY scrolls (overflow-y-auto), and a separate inner wrapper
  //    (min-h-full + flex centering) handles centering. That inner
  //    wrapper is itself part of the scrollable content, so if the panel
  //    is taller than the viewport, the whole page-level scroll can still
  //    reach every part of it top to bottom.
  //
  // 2. INNER PANEL FIX (kept as a second, independent safety layer): the
  //    panel itself is still height-capped (max-h) and split into three
  //    flex sections — header, scrollable middle, action footer — so in
  //    the common case the header and Cancel/Start buttons stay visibly
  //    pinned in place without the user needing to scroll the whole page
  //    at all; only the middle content (info rows + subject breakdown)
  //    scrolls internally.
  const modal = (
    <div
      className="fixed inset-0 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="section-modal-title"
    >
      {/* Backdrop — fixed (not absolute) so it always covers the full
          viewport regardless of the outer container's scroll position */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Centering wrapper — min-h-full so short content still centers
          vertically like before; this wrapper scrolls WITH the outer
          container rather than fighting it for control of overflow. */}
      <div className="relative z-10 min-h-full flex items-center justify-center px-4 py-6">
          {/* Panel — capped height, flex column so header/footer stay pinned */}
          <div className="w-full max-w-md bg-surface rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[calc(100vh-3rem)]">
          {/* Header — shrink-0 so it never gets squeezed or scrolled away */}
          <div className="bg-brand-dark px-6 py-5 flex items-start justify-between shrink-0">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-accent mb-1">
                Section Instructions
              </p>
              <h2
                id="section-modal-title"
                className="text-txt-onPrimary font-bold text-lg"
              >
                {sectionName}
              </h2>
            </div>
            {/* X close button */}
            <button
              onClick={onClose}
              className="mt-0.5 ml-4 shrink-0 text-blue-200 hover:text-white transition"
              aria-label="Close instructions"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Scrollable middle — info rows, subject breakdown, tip.
              flex-1 + min-h-0 is required here: without min-h-0, a flex
              child won't shrink below its content's natural height, which
              would silently defeat overflow-y-auto and bring back the
              exact bug this fixes. */}
          <div className="px-6 py-5 overflow-y-auto flex-1 min-h-0">
            {/* Info rows */}
            <div className="mb-6">
              <InfoRow label="Total Questions" value={mcqCount} />
              <InfoRow
                label="Time Limit"
                value={formatDuration(timeLimitSeconds)}
                highlight
              />
              <InfoRow label="Passing Mark" value={passMark} />
              <InfoRow label="Attempts" value="Unlimited" />
            </div>

            {/* Subject breakdown */}
            {subjectBreakdown.length > 0 && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-txt-muted mb-2.5">
                  Subject Breakdown
                </p>
                <div className="space-y-2">
                  {subjectBreakdown.map((row, i) => (
                    <div key={i}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-txt-secondary">{row.subject}</span>
                        <span className="text-txt-primary font-semibold">{row.percentage}%</span>
                      </div>
                      <div className="h-1.5 bg-bg rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent rounded-full"
                          style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Tip */}
            <div className="bg-accent-light border border-accent rounded-xl px-4 py-3">
              <p className="flex items-start gap-2 text-xs text-amber-800 font-medium leading-relaxed">
                <LuClock3 className="mt-0.5 text-base shrink-0" />
                <span>
                  The timer starts the moment you click{" "}
                  <strong>Start Test</strong>. Make sure you are ready before
                  proceeding.
                </span>
              </p>
            </div>
          </div>

          {/* Action footer — shrink-0, pinned outside the scroll area, so
              Cancel/Start Test are ALWAYS reachable no matter how long the
              subject breakdown list is. A top border visually separates it
              from the scrollable content above, which matters when that
              content is actually scrolled (otherwise the footer can look
              like it's floating disconnected from the content). */}
          <div className="px-6 py-4 border-t border-border shrink-0 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 text-sm font-semibold text-txt-secondary bg-surface border border-border hover:text-txt-primary px-4 py-2.5 rounded-xl transition"
            >
              Cancel
            </button>
            <button
              onClick={onStart}
              className="flex-1 bg-brand text-white hover:bg-brand-dark font-bold text-lg py-3 rounded-xl transition"
            >
              Start Test →
            </button>
          </div>
          </div>
      </div>
    </div>
  );

  return ReactDOM.createPortal(modal, document.body);
}
