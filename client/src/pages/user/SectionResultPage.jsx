/**
 * src/pages/user/SectionResultPage.jsx  (Part 10 — Prompt 2, redesigned)
 *
 * Replaces the previous parameterised result page.
 * Route: /result/section  (flat, no params — result data comes via location.state)
 *
 * State shape passed from TakeTestPage on navigate:
 *   {
 *     result: { score, totalMcqs, percentage, passed, passMarkUsed, resultId },
 *     mcqs:       MCQ array (needed by MCQ Review page),
 *     sectionName: string  (e.g. "Verbal"),
 *     testId:      string,
 *     sectionKey:  string  (e.g. "verbal" | "nonVerbal" | "academic"),
 *   }
 *
 * Edge case — page reload / direct URL access:
 *   If location.state is missing (user refreshed or arrived via direct URL),
 *   the page calls GET /api/results/:testId/:sectionType to fetch the most
 *   recent persisted result.  testId and sectionKey are read from the browser
 *   history state if available, else from session storage as a fallback.
 *   If no result is found in the database either, the user is redirected to
 *   /test/:testId (or "/" if testId is unknown).
 *
 * Logic is unchanged from the previous version — only layout/visual design
 * has been reworked.
 */

import { useEffect, useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";

// ── Constants ─────────────────────────────────────────────────────────────────
const SECTION_KEYS = ["verbal", "nonVerbal", "academic"];
const SECTION_DISPLAY_NAMES = {
  verbal: "Verbal",
  nonVerbal: "Non-Verbal",
  academic: "Academic",
};

// ── Loading skeleton ──────────────────────────────────────────────────────────
function ResultSkeleton() {
  return (
    <div className="max-w-md mx-auto px-4 py-8 animate-pulse dark:bg-dark-bg">
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden dark:bg-dark-surface dark:border-dark-border">
        <div className="h-36 bg-bg dark:bg-dark-surface2" />
        <div className="px-6 py-5 space-y-3">
          <div className="h-3 bg-bg dark:bg-dark-surface2 rounded w-1/2 mx-auto" />
          <div className="h-10 bg-bg rounded-lg dark:bg-dark-surface2" />
          <div className="h-10 bg-bg rounded-lg dark:bg-dark-surface2" />
        </div>
      </div>
    </div>
  );
}

// ── Circular percentage ring ───────────────────────────────────────────────────
function ScoreRing({ percentage, passed }) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  const offset =
    circumference - (Math.min(percentage, 100) / 100) * circumference;

  return (
    <div className="relative w-24 h-24 mx-auto">
      <svg viewBox="0 0 88 88" className="w-24 h-24 -rotate-90">
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="7"
          className="stroke-white/25"
        />
        <circle
          cx="44"
          cy="44"
          r={radius}
          fill="none"
          strokeWidth="7"
          strokeLinecap="round"
          className="stroke-white"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xl font-extrabold text-white tabular-nums">
          {percentage}%
        </span>
      </div>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function SectionResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  // Unpack state passed by TakeTestPage
  const stateData = location.state ?? null;

  // result, mcqs, testId, sectionKey, sectionName may come from state
  // or be recovered via the API fallback below.
  const [result, setResult] = useState(stateData?.result ?? null);
  const [mcqs, setMcqs] = useState(stateData?.mcqs ?? []);
  const [answers, setAnswers] = useState(stateData?.answers ?? {});
  const [testId, setTestId] = useState(stateData?.testId ?? null);
  const [sectionKey, setSectionKey] = useState(stateData?.sectionKey ?? null);
  const [sectionName, setSectionName] = useState(stateData?.sectionName ?? "");

  const [fetching, setFetching] = useState(!stateData?.result);
  const [showConfirm, setShowConfirm] = useState(false);

  // ── Edge case: page reload or direct URL access ───────────────────────────
  // Try to recover testId/sectionKey from sessionStorage (TakeTestPage writes
  // these on load so we have them even after a reload).
  useEffect(() => {
    if (result) return; // we already have a result — nothing to do

    // Attempt recovery from sessionStorage written by TakeTestPage
    const savedTestId = sessionStorage.getItem("lastTestId");
    const savedSectionKey = sessionStorage.getItem("lastSectionKey");

    const tid = testId || savedTestId;
    const sk = sectionKey || savedSectionKey;

    if (!tid || !sk) {
      // No way to recover — go home
      navigate("/", { replace: true });
      return;
    }

    // Update state so buttons can link correctly
    setTestId(tid);
    setSectionKey(sk);

    // Fetch the most recent persisted result for this test + section
    api
      .get(`/results/${tid}/${sk}`)
      .then((res) => {
        setResult(res.data);
        setSectionName(
          res.data.sectionName || SECTION_DISPLAY_NAMES[sk] || "Section",
        );
      })
      .catch(() => {
        // No result found — redirect to the test hub
        navigate(`/test/${tid}`, { replace: true });
      })
      .finally(() => setFetching(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Write testId + sectionKey to sessionStorage whenever we have them,
  // so a reload on THIS page can also recover (belt-and-suspenders).
  useEffect(() => {
    if (testId) sessionStorage.setItem("lastTestId", testId);
    if (sectionKey) sessionStorage.setItem("lastSectionKey", sectionKey);
  }, [testId, sectionKey]);

  if (fetching) return <ResultSkeleton />;
  if (!result) return null;

  const { score, totalMcqs, percentage, passed, passMarkUsed, resultId } =
    result;
  const displaySectionName =
    sectionName || SECTION_DISPLAY_NAMES[sectionKey] || "Section";

  // ── Next section helper ───────────────────────────────────────────────────
  const currentIdx = SECTION_KEYS.indexOf(sectionKey);
  const nextSectionKey =
    currentIdx >= 0 && currentIdx < SECTION_KEYS.length - 1
      ? SECTION_KEYS[currentIdx + 1]
      : null;
  const nextSectionName = nextSectionKey
    ? SECTION_DISPLAY_NAMES[nextSectionKey]
    : null;

  // ── Action handlers ───────────────────────────────────────────────────────
  function handleRetry() {
    navigate(`/test/${testId}/section/${sectionKey}`, { replace: true });
  }

  function handleNextSection() {
    navigate(`/test/${testId}/section/${nextSectionKey}`);
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="max-w-md mx-auto px-4 py-8 dark:bg-dark-bg">
      <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden dark:bg-dark-surface dark:border-dark-border">
        {/* ── Header band ─────────────────────────────────────────────────── */}
        <div
          className={`px-6 pt-6 pb-5 text-center ${passed ? "bg-success" : "bg-danger"}`}
        >
          <p className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-3">
            {displaySectionName} Section
          </p>

          <ScoreRing percentage={percentage} passed={passed} />

          <p className="text-white font-bold text-lg mt-3 tabular-nums">
            {score}{" "}
            <span className="font-medium text-white/70">
              / {totalMcqs} correct
            </span>
          </p>

          <span
            className={`inline-flex items-center gap-1 text-xs font-bold tracking-wide px-3 py-1 rounded-full mt-3 ${
              passed ? "bg-white text-success" : "bg-white text-danger"
            }`}
          >
            {passed ? "PASSED ✓" : "FAILED ✗"}
          </span>

          <p className="text-[11px] font-bold text-slate-900 mt-2">
            Pass mark: {passMarkUsed}%
          </p>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div className="px-6 pt-5 pb-6">
          {/* Contextual message */}
          <p
            className={`text-sm font-semibold text-center mb-5 ${passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
          >
            {passed
              ? `Congratulations! You passed the ${displaySectionName} Section.`
              : "Better luck next time! Keep practising."}
          </p>

          {/* ── Next section CTA ──────────────────────────────────────────── */}
          {nextSectionKey && (
            <div className="mb-4 bg-brand-light border border-brand/30 rounded-xl px-4 py-3 dark:bg-blue-900/30 dark:border-blue-500/30">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] text-brand font-semibold uppercase tracking-wider dark:text-blue-300">
                    Up next
                  </p>
                  <p className="text-sm font-bold text-txt-primary dark:text-slate-100">
                    {nextSectionName} Section
                  </p>
                </div>
                <button
                  onClick={handleNextSection}
                  className="shrink-0 inline-flex items-center gap-1.5 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-lg transition dark:bg-blue-600 dark:hover:bg-blue-700"
                >
                  Start →
                </button>
              </div>
            </div>
          )}

          {/* ── Primary action buttons ────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-2.5 mb-3">
            {/* Review MCQs — passes resultId and mcqs to the review page */}
            <Link
              to={`/test/${testId}/section/${sectionKey}/review`}
              state={{
                resultId,
                mcqs,
                answers,
                sectionName: displaySectionName,
                testId,
                sectionKey,
              }}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-4 py-2.5 rounded-lg transition dark:bg-blue-600 dark:hover:bg-blue-700"
            >
              Review MCQs
            </Link>

            {/* Back to Test Hub */}
            <Link
              to={`/test/${testId}`}
              className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-surface border border-border text-txt-primary hover:border-brand hover:text-brand px-4 py-2.5 rounded-lg transition dark:bg-dark-surface dark:border-dark-border dark:text-slate-200 dark:hover:border-blue-400"
            >
              Test Hub
            </Link>
          </div>

          {/* ── Retry ─────────────────────────────────────────────────────── */}
          {!showConfirm ? (
            <button
              onClick={() => setShowConfirm(true)}
              className="w-full text-xs font-semibold text-txt-muted hover:text-txt-secondary dark:text-slate-400 dark:hover:text-slate-300 underline underline-offset-2 transition"
            >
              ↺ Retry this section
            </button>
          ) : (
            <div className="bg-accent-light border border-accent/30 rounded-xl px-4 py-3 text-center dark:bg-amber-900/20 dark:border-amber-500/30">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400 mb-2.5">
                This will start a fresh attempt. Continue?
              </p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleRetry}
                  className="text-xs font-bold bg-accent hover:bg-accent-dark text-white px-4 py-1.5 rounded-lg transition"
                >
                  Yes, retry
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="text-xs font-bold bg-bg hover:bg-border text-txt-secondary px-4 py-1.5 rounded-lg transition dark:bg-dark-surface2 dark:hover:bg-dark-border dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
