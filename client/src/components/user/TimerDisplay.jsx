/**
 * src/components/user/TimerDisplay.jsx
 *
 * Fixed-position countdown display.
 *
 * IMPORTANT: this component owns the actual per-second ticking (via
 * useTimer). That keeps the countdown's setInterval-driven state changes
 * scoped to this small leaf component instead of the parent test page —
 * previously useTimer was called in TakeTestPage itself, which meant every
 * 1-second tick re-rendered the entire page (question, image, options,
 * everything) just to update a clock string.
 *
 * Props:
 *   totalSeconds – section time limit in seconds (0 until known)
 *   timerKey     – localStorage key, e.g. `timer_${testId}_${sectionKey}`
 *   onExpire     – called once when the countdown hits zero
 *   enabled      – pass false until totalSeconds is actually known
 *   inline       – layout variant (header badge vs fixed corner)
 */

import { memo } from "react";
import { useTimer } from "../../hooks/useTimer";

function TimerDisplay({ totalSeconds, timerKey, onExpire, enabled = true, inline = false }) {
  const { secondsLeft, formattedTime } = useTimer({
    totalSeconds,
    timerKey,
    onExpire,
    enabled,
  });

  const warning  = secondsLeft <= 60;
  const critical = secondsLeft <= 10;

  return (
    <div
      className={`
        flex items-center gap-2
        px-3.5 py-1.5 rounded-xl shadow-sm
        font-mono font-bold text-sm md:text-base tabular-nums select-none
        transition-all duration-300
        ${inline ? "" : "fixed top-4 right-4 z-50"}
        ${critical
          ? "bg-danger text-white animate-pulse"
          : warning
          ? "bg-red-50 border border-red-200 text-red-600 dark:bg-red-950/30 dark:border-red-900/50 dark:text-red-400"
          : "bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"}
      `}
      aria-live="polite"
      aria-atomic="true"
      aria-label={`Time remaining: ${formattedTime}`}
    >
      {/* Clock icon */}
      <svg
        className={`w-4 h-4 shrink-0 ${critical ? "animate-spin" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="10" strokeWidth="2" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6l4 2" />
      </svg>
      {formattedTime}
    </div>
  );
}

export default memo(TimerDisplay);