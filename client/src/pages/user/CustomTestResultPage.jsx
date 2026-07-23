/**
 * src/pages/user/CustomTestResultPage.jsx
 *
 * Result page for standalone custom category tests.
 * Route: /result/custom
 *
 * Receives state from CustomTakeTestPage:
 *   { result, mcqs, sectionName, testId, userAnswers }
 *
 * Shows: score, percentage, pass/fail verdict, Review & Retake buttons.
 *
 * Visual design mirrors SectionResultPage.jsx (default-category result page)
 * — same card shell, score ring, header band, and button styling — so the
 * custom-category result experience feels consistent across the app.
 * Logic/data-flow is unchanged from the previous version.
 */

import { useState } from "react";
import { useLocation, useNavigate, Link } from "react-router-dom";
import api from "../../api/axios";
import McqReviewCard from "../../public/components/McqReviewCard";

// ── Circular percentage ring (matches SectionResultPage) ──────────────────────
function ScoreRing({ percentage }) {
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

export default function CustomTestResultPage() {
  const location = useLocation();
  const navigate = useNavigate();

  const state = location.state;

  const [showReview, setShowReview] = useState(false);
  const [reviewMcqs, setReviewMcqs] = useState(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  if (!state?.result) {
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center dark:bg-dark-bg">
        <div className="bg-surface border border-border rounded-2xl shadow-sm px-6 py-10 dark:bg-dark-surface dark:border-dark-border">
          <p className="text-sm font-semibold text-txt-secondary dark:text-slate-300 mb-4">
            No result data found.
          </p>
          <Link
            to="/"
            className="inline-flex items-center justify-center text-sm font-bold bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-lg transition dark:bg-blue-600 dark:hover:bg-blue-700"
          >
            Go home
          </Link>
        </div>
      </div>
    );
  }

  const { result, sectionName, testId, userAnswers = {} } = state;
  const { score, totalMcqs, percentage, passed } = result;

  function handleRetake() {
    navigate(`/test/custom/${testId}`, { replace: true });
  }

  function handleToggleReview() {
    if (!showReview && !reviewMcqs) {
      // Fetch review MCQs (with correctIndex) from server
      setReviewLoading(true);
      api
        .get(`/custom-tests/${testId}/review`)
        .then(({ data }) => setReviewMcqs(data.mcqs || []))
        .catch(() => setReviewMcqs([]))
        .finally(() => setReviewLoading(false));
    }
    setShowReview((v) => !v);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 dark:bg-dark-bg">
      <div className="max-w-md mx-auto">
        <div className="bg-surface border border-border rounded-2xl shadow-sm overflow-hidden dark:bg-dark-surface dark:border-dark-border">
          {/* ── Header band ─────────────────────────────────────────────── */}
          <div
            className={`px-6 pt-6 pb-5 text-center ${passed ? "bg-success" : "bg-danger"}`}
          >
            <p className="text-[11px] font-bold uppercase tracking-widest text-white/75 mb-3">
              {sectionName}
            </p>

            <ScoreRing percentage={percentage} />

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
              Pass mark: 80%
            </p>
          </div>

          {/* ── Body ────────────────────────────────────────────────────── */}
          <div className="px-6 pt-5 pb-6">
            <p
              className={`text-sm font-semibold text-center mb-5 ${passed ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}
            >
              {passed
                ? "Congratulations! You scored 80% or above."
                : "Keep practising! You need 80% or above to pass."}
            </p>

            <div className="flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={handleToggleReview}
                disabled={reviewLoading}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-brand hover:bg-brand-dark disabled:opacity-60 text-white px-4 py-2.5 rounded-lg transition dark:bg-blue-600 dark:hover:bg-blue-700"
              >
                {reviewLoading ? "Loading…" : showReview ? "Hide Review" : "Review MCQs"}
              </button>
              <button
                onClick={handleRetake}
                className="flex-1 inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-surface border border-border text-txt-primary hover:border-brand hover:text-brand px-4 py-2.5 rounded-lg transition dark:bg-dark-surface dark:border-dark-border dark:text-slate-200 dark:hover:border-blue-400"
              >
                Retake Test
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* MCQ Review */}
      {showReview && reviewMcqs && reviewMcqs.length > 0 && (
        <div className="space-y-4 mt-8">
          <h2 className="text-xs font-semibold uppercase tracking-widest text-txt-muted dark:text-slate-400 mb-2">
            MCQ Review
          </h2>
          <p className="text-sm text-txt-muted dark:text-slate-400 mb-4">
            Green = correct, red = your wrong pick, green outline = correct answer you missed.
          </p>
          {reviewMcqs.map((mcq, i) => (
            <McqReviewCard
              key={mcq._id || i}
              mcq={mcq}
              userAnswer={userAnswers[mcq._id]}
              questionNumber={i + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}