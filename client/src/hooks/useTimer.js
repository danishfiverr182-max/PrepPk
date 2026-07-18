/**
 * src/hooks/useTimer.js
 *
 * Robust countdown timer hook that persists across tab switches and browser
 * refreshes using localStorage + Date.now() timestamps for accuracy.
 *
 * Usage:
 *   const { secondsLeft, isRunning, formattedTime } =
 *     useTimer(totalSeconds, storageKey, onExpire);
 */

import { useState, useEffect, useRef, useCallback } from "react";

/** Convert raw seconds → "HH:MM:SS" */
function toHHMMSS(secs) {
  const s = Math.max(0, Math.floor(secs));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h, m, sec].map((v) => String(v).padStart(2, "0")).join(":");
}

const LS_SECONDS_SUFFIX = "_seconds";
const LS_TIMESTAMP_SUFFIX = "_timestamp";

export function useTimer(totalSecondsOrOptions, storageKey, onExpire) {
  const options =
    typeof totalSecondsOrOptions === "object" && totalSecondsOrOptions !== null
      ? totalSecondsOrOptions
      : null;

  const totalSeconds = options?.totalSeconds ?? totalSecondsOrOptions ?? 0;
  const timerKey = options?.timerKey ?? storageKey;
  const timerOnExpire = options?.onExpire ?? onExpire;
  const enabled = options?.enabled ?? true;

  const onExpireRef = useRef(timerOnExpire);
  useEffect(() => { onExpireRef.current = timerOnExpire; }, [timerOnExpire]);

  function getInitialSeconds(initialTotal, key) {
    try {
      const savedSecs = parseInt(localStorage.getItem(key + LS_SECONDS_SUFFIX), 10);
      const savedTs   = parseInt(localStorage.getItem(key + LS_TIMESTAMP_SUFFIX), 10);

      if (!isNaN(savedSecs) && !isNaN(savedTs) && savedSecs > 0) {
        const elapsed = Math.floor((Date.now() - savedTs) / 1000);
        const restored = savedSecs - elapsed;
        if (restored > 0) return restored;
        return 0;
      }
    } catch (_) {}
    return Math.max(0, Math.floor(initialTotal));
  }

  const [secondsLeft, setSecondsLeft] = useState(() => getInitialSeconds(totalSeconds, timerKey));
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef  = useRef(null);
  const startTsRef   = useRef(null);
  const startSecRef  = useRef(null);

  const persist = useCallback((secs) => {
    try {
      localStorage.setItem(timerKey + LS_SECONDS_SUFFIX, String(secs));
      localStorage.setItem(timerKey + LS_TIMESTAMP_SUFFIX, String(Date.now()));
    } catch (_) {}
  }, [timerKey]);

  const clearTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const tick = useCallback(() => {
    if (startTsRef.current === null || startSecRef.current === null) return;
    const elapsed = Math.floor((Date.now() - startTsRef.current) / 1000);
    const next    = Math.max(0, startSecRef.current - elapsed);
    setSecondsLeft(next);
    persist(next);
    if (next <= 0) {
      clearTimer();
      onExpireRef.current?.();
    }
  }, [clearTimer, persist]);

  const startInterval = useCallback((currentSecs) => {
    clearTimer();
    startTsRef.current  = Date.now();
    startSecRef.current = currentSecs;
    intervalRef.current = setInterval(tick, 1000);
    setIsRunning(true);
  }, [clearTimer, tick]);

  useEffect(() => {
    if (!enabled || !timerKey) {
      clearTimer();
      setSecondsLeft(0);
      return;
    }

    const baseSeconds = Math.max(0, Math.floor(totalSeconds));
    const restored = getInitialSeconds(baseSeconds, timerKey);

    if (restored <= 0) {
      // A stored timer that's already expired on arrival can only mean the
      // tab/browser was closed mid-test (a live, open tab always catches
      // zero itself via the running tick below, and auto-submits right
      // then). Treat this as an abandoned attempt, not a real timeout:
      // wipe the stale storage and start a completely fresh session
      // instead of silently auto-submitting empty answers.
      clearTimerStorage(timerKey);
      setSecondsLeft(baseSeconds);
      persist(baseSeconds);
      startInterval(baseSeconds);
      return () => {
        clearTimer();
      };
    }

    setSecondsLeft(restored);
    persist(restored);
    startInterval(restored);

    return () => {
      clearTimer();
    };
  }, [clearTimer, enabled, persist, startInterval, timerKey, totalSeconds]);

  return {
    secondsLeft,
    isRunning,
    formattedTime: toHHMMSS(secondsLeft),
  };
}

/** Call this after submission to wipe the timer from localStorage. */
export function clearTimerStorage(storageKey) {
  try {
    localStorage.removeItem(storageKey + LS_SECONDS_SUFFIX);
    localStorage.removeItem(storageKey + LS_TIMESTAMP_SUFFIX);
  } catch (_) {}
}