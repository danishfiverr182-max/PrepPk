/**
 * src/pages/user/FreeCustomTakeTestPage.jsx
 *
 * Test-taking page for FREE standalone custom category tests.
 * Route: /test/free-custom/:testId/take
 *
 * Visual/interaction design mirrors the premium CustomTakeTestPage
 * (immersive layout, numbered option cards, keyboard shortcuts 1-4,
 * desktop sidebar navigator + mobile drawer, submit confirmation modal,
 * tab-switch toast) — a free custom test is a SINGLE flat list of
 * questions, same as its premium counterpart. There are no sections here;
 * that concept belongs only to default-category tests.
 *
 * Differences from CustomTakeTestPage (premium) — data contract only:
 *   - Fetches MCQs from GET /api/free-custom-tests/:testId/mcqs (no auth required)
 *   - Submits to POST /api/free-custom-tests/:testId/submit, with answers keyed
 *     by mcqId (the free-test submit route grades { [mcqId]: selectedOption }
 *     directly, unlike the premium /results/submit endpoint)
 *   - After submission, navigates to /result/free-custom (FreeCustomTestResultPage)
 *     with { result, mcqs, sectionName, testId, userAnswers }
 */

import { useEffect, useRef, useState, useCallback, memo } from "react";
import {
  useParams,
  useNavigate,
  Link,
  useOutletContext,
} from "react-router-dom";
import api from "../../api/axios";
import McqImage from "../../public/components/McqImage";
import { clearTimerStorage } from "../../hooks/useTimer";
import TimerDisplay from "../../components/user/TimerDisplay";
import { PiCrownSimpleFill } from "react-icons/pi";
import { FaTriangleExclamation } from "react-icons/fa6";

// ── Skeleton Loader ──────────────────────────────────────────
function TestSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between animate-pulse">
      <div className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 flex items-center justify-between">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-800 rounded" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
        <div className="h-8 w-24 bg-slate-200 dark:bg-slate-800 rounded-lg" />
      </div>
      <div className="flex-1 max-w-5xl mx-auto w-full px-6 py-10 grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-6">
          <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded" />
          <div className="space-y-3 mt-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-14 bg-slate-100 dark:bg-slate-800 rounded-xl"
              />
            ))}
          </div>
        </div>
        <div className="lg:col-span-4 hidden lg:block bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 h-96" />
      </div>
    </div>
  );
}

// ── Fetch Error Card ──────────────────────────────────────────
function FetchErrorCard({ message, onRetry, testId }) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 shadow-xl text-center dark:bg-slate-900 dark:border-slate-850">
        <div className="text-5xl mb-4">⚠️</div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
          Could Not Load Questions
        </h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mb-6 leading-relaxed">
          {message}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-brand hover:bg-brand-dark text-white px-5 py-2.5 rounded-xl transition shadow-sm hover:scale-105"
          >
            ↻ Retry Connection
          </button>
          <Link
            to={`/test/free-custom/${testId}`}
            className="inline-flex items-center justify-center gap-1.5 text-sm font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700 px-5 py-2.5 rounded-xl transition"
          >
            ← Back to Test Hub
          </Link>
        </div>
      </div>
    </div>
  );
}

// ── Premium Option Card ─────────────────────────────────────────
const OPTION_LABELS = ["A", "B", "C", "D"];

function OptionCard({ label, text, selected, onClick, index }) {
  return (
    <button
      onClick={onClick}
      className={`group relative flex items-center p-4 rounded-2xl border-2 text-left transition-all duration-200 w-full min-h-[50px] focus:outline-none ${
        selected
          ? "border-brand bg-brand/5 dark:border-brand dark:bg-brand/10 text-brand dark:text-indigo-300 shadow-md scale-[1.01]"
          : "bg-white border-slate-200 text-slate-700 hover:border-brand-light hover:bg-slate-50 dark:bg-slate-900 dark:border-slate-850 dark:text-slate-350 dark:hover:border-slate-700 dark:hover:bg-slate-800/40"
      }`}
    >
      {/* Label Badge */}
      <span
        className={`shrink-0 w-9 h-9 lg:w-10 lg:h-10 rounded-xl flex items-center justify-center text-sm lg:text-base font-bold transition-colors ${
          selected
            ? "bg-brand text-white"
            : "bg-slate-100 text-slate-500 group-hover:bg-brand-light group-hover:text-brand dark:bg-slate-800 dark:text-slate-400 dark:group-hover:bg-slate-700 dark:group-hover:text-slate-200"
        }`}
      >
        {label}
      </span>

      {/* Option Text */}
      <span className="ml-4 text-base lg:text-lg font-semibold leading-relaxed flex-1 pr-12 text-slate-800 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white">
        {text}
      </span>

      {/* Keyboard Shortcut Hint (Desktop only) */}
      <span className="hidden md:inline-block absolute right-12 text-[10px] font-bold text-slate-450 dark:text-slate-500 border border-slate-200 dark:border-slate-750 px-1.5 py-0.5 rounded-lg bg-slate-50 dark:bg-slate-800 opacity-60 group-hover:opacity-100 transition-opacity">
        Press {index + 1}
      </span>

      {/* Custom Radio check status indicator */}
      <span
        className={`absolute right-4 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected
            ? "border-brand bg-brand text-white scale-110"
            : "border-slate-300 group-hover:border-brand dark:border-slate-700"
        }`}
      >
        {selected && (
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="3"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </span>
    </button>
  );
}

// ── Sidebar Grid Navigator ────────────────────────────────────
// Memoized: total/current/answers/onJump only change when the user actually
// navigates or answers, not every second — without this, the countdown
// timer's per-second tick in the parent re-renders every question button.
const GridNavigator = memo(function GridNavigator({ total, current, answers, onJump }) {
  return (
    <div className="grid grid-cols-5 gap-2 max-w-full">
      {Array.from({ length: total }, (_, i) => {
        const isAnswered = answers[i] !== undefined;
        const isCurrent = i === current;

        let buttonClass = "";
        if (isCurrent) {
          buttonClass =
            "bg-brand border-2 border-brand text-white shadow-lg shadow-brand/35 ring-2 ring-brand-light dark:ring-brand/20";
        } else if (isAnswered) {
          buttonClass =
            "bg-green-100 border border-green-200 text-green-700 hover:bg-green-200 dark:bg-green-950/40 dark:border-green-900 dark:text-green-400";
        } else {
          buttonClass =
            "bg-slate-50 border border-slate-200 text-slate-650 hover:border-brand hover:text-brand dark:bg-slate-800 dark:border-slate-750 dark:text-slate-300 dark:hover:border-brand";
        }

        return (
          <button
            key={i}
            onClick={() => onJump(i)}
            className={`w-10 h-10 rounded-xl text-xs font-bold transition-all duration-200 flex items-center justify-center ${buttonClass}`}
            title={`Question ${i + 1} (${isAnswered ? "Answered" : "Unanswered"})`}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
});

// ── Collapsible mobile navigation drawer ───────────────────────
function NavDrawer({
  isOpen,
  onClose,
  total,
  current,
  answers,
  onJump,
  onBuyPremium,
}) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60 backdrop-blur-sm animate-fadeIn lg:hidden">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative bg-white dark:bg-slate-900 rounded-t-3xl p-6 max-h-[75vh] overflow-y-auto flex flex-col z-10 animate-slideUp border-t border-slate-200 dark:border-slate-800">
        <div className="w-12 h-1.5 bg-slate-300 dark:bg-slate-700 rounded-full mx-auto mb-4" />
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-heading font-bold text-slate-900 dark:text-white text-lg">
            Question Navigator
          </h3>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg"
          >
            ✕
          </button>
        </div>
        <div className="overflow-y-auto py-2 flex justify-center">
          <GridNavigator
            total={total}
            current={current}
            answers={answers}
            onJump={(idx) => {
              onJump(idx);
              onClose();
            }}
          />
        </div>

        {/* Legend */}
        <div className="flex justify-center gap-4 mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 text-xs">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-brand" />
            <span className="text-slate-600 dark:text-slate-300">Current</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-green-500" />
            <span className="text-slate-600 dark:text-slate-300">Answered</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-200 dark:bg-slate-800" />
            <span className="text-slate-600 dark:text-slate-300">Skipped</span>
          </div>
        </div>

        {/* Buy Premium CTA — mobile drawer */}
        {onBuyPremium && (
          <button
            onClick={() => {
              onBuyPremium();
              onClose();
            }}
            className="mt-5 w-full inline-flex items-center justify-center gap-2 text-sm font-bold text-navy px-4 py-2.5 rounded-xl transition-transform hover:scale-105"
            style={{ background: "linear-gradient(135deg, #F5C542, #f09819)" }}
          >
            <PiCrownSimpleFill className="text-lg text-amber-900" />
            Buy Premium Access
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tab-switch warning toast ──────────────────────────────────
function TabSwitchToast({ visible }) {
  if (!visible) return null;
  return (
    <div className="fixed bottom-10 left-1/2 -translate-x-1/2 z-50 pointer-events-none w-full max-w-sm px-4">
      <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2.5 dark:bg-red-950/90 dark:border-red-900 dark:text-red-300 animate-slideUp">
        <svg
          className="w-5 h-5 shrink-0 text-red-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
          />
        </svg>
        <span>Warning: Tab switch detected. Timer remained active.</span>
      </div>
    </div>
  );
}

// ── Main Page Component ───────────────────────────────────────
export default function FreeCustomTakeTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { openPremiumPopup } = useOutletContext() ?? {};

  const [mcqs, setMcqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState("");
  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sectionName, setSectionName] = useState("Test");
  const [retryCount, setRetryCount] = useState(0);

  const [totalSeconds, setTotalSeconds] = useState(null);

  const startTimeRef = useRef(null);
  const submittedRef = useRef(false);
  const timerKeyRef = useRef(`timer_free_custom_${testId}`);

  const [answers, setAnswers] = useState({});
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [mobileGridOpen, setMobileGridOpen] = useState(false);

  const [tabToast, setTabToast] = useState(false);
  const toastTimerRef = useRef(null);

  // ── Tab switch visibility hook ──────────────────────────────
  useEffect(() => {
    function handleVisibility() {
      if (!document.hidden) {
        setTabToast(true);
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        toastTimerRef.current = setTimeout(() => setTabToast(false), 4500);
      }
    }
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // ── Submit logic ────────────────────────────────────────────
  // The free-custom-tests submit route grades answers keyed by mcqId:
  //   { [mcq._id]: selectedOptionIndex }
  const handleSubmit = useCallback(() => {
    if (submittedRef.current || submitting) return;
    submittedRef.current = true;
    setShowSubmitConfirm(false);
    setSubmitError("");
    setSubmitting(true);

    const answersPayload = {};
    mcqs.forEach((mcq, qIndex) => {
      if (answers[qIndex] !== undefined) {
        answersPayload[mcq._id] = answers[qIndex];
      }
    });

    api
      .post(`/free-custom-tests/${testId}/submit`, { answers: answersPayload })
      .then((res) => {
        clearTimerStorage(timerKeyRef.current);
        navigate("/result/free-custom", {
          state: {
            result: res.data,
            mcqs,
            sectionName,
            testId,
            userAnswers: answersPayload, // { mcqId: selectedOptionIndex }
          },
          replace: true,
        });
      })
      .catch(() => {
        submittedRef.current = false;
        setSubmitting(false);
        setSubmitError("Something went wrong. Please try again.");
      });
  }, [answers, mcqs, navigate, sectionName, testId, submitting]);

  const handleSubmitRef = useRef(handleSubmit);
  useEffect(() => {
    handleSubmitRef.current = handleSubmit;
  }, [handleSubmit]);

  const handleAutoSubmit = useCallback(() => {
    handleSubmitRef.current?.();
  }, []);

  // ── Fetch MCQ payload ─────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFetchError("");
    setSubmitError("");
    setMcqs([]);
    setAnswers({});
    setCurrentIndex(0);
    setShowSubmitConfirm(false);
    submittedRef.current = false;

    api
      .get(`/free-custom-tests/${testId}/mcqs`)
      .then((res) => {
        if (cancelled) return;
        const {
          mcqs: fetchedMcqs,
          sectionName: name,
          timeLimitSeconds,
        } = res.data;
        if (!fetchedMcqs || fetchedMcqs.length === 0) {
          setFetchError(
            "This test has no questions yet. Please check back later.",
          );
          setLoading(false);
          return;
        }
        setMcqs(fetchedMcqs);
        setSectionName(name || "Test");
        startTimeRef.current = Date.now();
        setTotalSeconds(timeLimitSeconds ?? 1800);
      })
      .catch((err) => {
        if (cancelled) return;
        const status = err.response?.status;
        if (status === 404) {
          setFetchError("Test not found or not yet published.");
        } else {
          setFetchError(
            "Failed to load questions. Please check your connection.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [testId, retryCount]);

  // ── Timer config (ticking itself lives inside <TimerDisplay>, so a
  //    per-second update no longer re-renders this whole page) ──────
  const timerReady = totalSeconds !== null;

  const total = mcqs.length;
  const currentMcq = mcqs[currentIndex] ?? null;
  const answeredCount = Object.keys(answers).length;
  const unanswered = total - answeredCount;

  const selectAnswer = useCallback(
    (optionIndex) => {
      setAnswers((prev) => ({ ...prev, [currentIndex]: optionIndex }));
    },
    [currentIndex],
  );

  const goTo = useCallback(
    (index) => {
      if (index >= 0 && index < total) setCurrentIndex(index);
    },
    [total],
  );

  // ── Keyboard Shortcuts Hook ──────────────────────────────────
  useEffect(() => {
    function handleKeyDown(e) {
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      const key = e.key.toLowerCase();

      // Select Answer (1-4 or A-D)
      if (key === "1" || key === "a") {
        selectAnswer(0);
      } else if (key === "2" || key === "b") {
        selectAnswer(1);
      } else if (key === "3" || key === "c") {
        selectAnswer(2);
      } else if (key === "4" || key === "d") {
        selectAnswer(3);
      }

      // Navigation (Arrows or Enter)
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goTo(currentIndex + 1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        goTo(currentIndex - 1);
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [currentIndex, total, selectAnswer, goTo]);

  if (loading) return <TestSkeleton />;
  if (fetchError) {
    return (
      <FetchErrorCard
        message={fetchError}
        onRetry={() => setRetryCount((c) => c + 1)}
        testId={testId}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* ── Progress bar top ──────────────────────────────────── */}
      <div className="h-1.5 w-full bg-slate-200 dark:bg-slate-800 shrink-0">
        <div
          className="h-full bg-brand transition-all duration-300"
          style={{
            width: total > 0 ? `${(answeredCount / total) * 100}%` : "0%",
          }}
        />
      </div>

      {/* ── App Top Header ────────────────────────────────────── */}
      <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-6 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            to={`/test/free-custom/${testId}`}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 text-sm font-semibold transition"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Exit
          </Link>
          <span className="h-4 w-px bg-slate-200 dark:bg-slate-850" />
          <h2 className="font-heading font-bold text-slate-800 dark:text-white text-sm md:text-base max-w-[200px] md:max-w-none truncate">
            {sectionName}
          </h2>
        </div>

        {/* Dynamic Timer BADGE */}
        {timerReady && (
          <TimerDisplay
            totalSeconds={totalSeconds}
            timerKey={timerKeyRef.current}
            onExpire={handleAutoSubmit}
            enabled={timerReady}
            inline={true}
          />
        )}

        {/* Counter and Submit button */}
        <div className="flex items-center gap-2 md:gap-3">
          {openPremiumPopup && (
            <button
              onClick={() => openPremiumPopup()}
              className="hidden md:inline-flex items-center gap-1.5 text-xs font-bold text-navy px-3 py-2 rounded-xl transition-transform hover:scale-105"
              style={{
                background: "linear-gradient(135deg, #F5C542, #f09819)",
              }}
            >
              <PiCrownSimpleFill
                size={14}
                className="flex-shrink-0 text-amber-900"
              />
              Buy Premium
            </button>
          )}

          <button
            onClick={() => setMobileGridOpen(true)}
            className="lg:hidden bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-750 dark:text-slate-300 px-3.5 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5"
          >
            Grid ({answeredCount}/{total})
          </button>

          <span className="hidden md:inline text-xs font-semibold text-slate-500 dark:text-slate-400">
            {answeredCount} / {total} Answered
          </span>

          <button
            onClick={() => {
              if (submitting) return;
              if (unanswered > 0) setShowSubmitConfirm(true);
              else handleSubmit();
            }}
            disabled={submitting}
            className="bg-brand hover:bg-brand-dark text-white px-4 py-2 rounded-xl text-xs font-bold shadow-sm transition hover:scale-105"
          >
            Submit
          </button>
        </div>
      </header>

      {/* ── Main content pane (Split layout) ──────────────────── */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto px-6 py-6 flex flex-col items-center">
          <div
            className={`w-full ${currentMcq?.imageUrl ? "max-w-6xl" : "max-w-3xl"} flex-1 flex flex-col justify-between`}
          >
            {/* Question Details */}
            {currentMcq ? (
              <div className="space-y-6">
                {/* Question Metadata */}
                <div className="flex items-center justify-between text-xs text-slate-400 dark:text-slate-500">
                  <span className="font-semibold tracking-wider">
                    QUESTION {currentIndex + 1} OF {total}
                  </span>
                  <span className="font-semibold uppercase bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
                    1 Mark
                  </span>
                </div>

                <div className="space-y-5">
                  <h3 className="text-xl md:text-2xl font-bold leading-relaxed text-slate-800 dark:text-slate-100">
                    {currentMcq.question}
                  </h3>

                  {/* Optional image (kept for forward-compatibility) */}
                  {currentMcq.imageUrl && (
                    <McqImage
                      src={currentMcq.imageUrl}
                      alt={`Question ${currentIndex + 1} visualization`}
                    />
                  )}

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    {(currentMcq.options ?? []).map((opt, i) => (
                      <OptionCard
                        key={i}
                        index={i}
                        label={OPTION_LABELS[i]}
                        text={opt}
                        selected={answers[currentIndex] === i}
                        onClick={() => selectAnswer(i)}
                      />
                    ))}
                  </div>
                </div>

                {/* ── Tightly Integrated Inline Navigation Buttons ── */}
                <div className="flex items-center justify-between gap-4 mt-6 pt-5 border-t border-slate-200 dark:border-slate-850">
                  <button
                    onClick={() => goTo(currentIndex - 1)}
                    disabled={currentIndex === 0}
                    className="flex items-center gap-1.5 text-sm font-bold text-slate-600 dark:text-slate-350 hover:text-brand disabled:opacity-40 border border-slate-200 dark:border-slate-800 px-5 py-3 rounded-2xl hover:bg-slate-50 dark:hover:bg-slate-900 transition-all select-none"
                  >
                    <span className="hidden md:inline bg-slate-100 dark:bg-slate-800 text-[10px] px-1.5 py-0.5 rounded mr-1">
                      ← Left Arrow
                    </span>
                    Prev
                  </button>

                  <span className="text-xs font-semibold text-slate-400 dark:text-slate-500">
                    Question {currentIndex + 1} of {total}
                  </span>

                  <div>
                    {currentIndex === total - 1 ? (
                      <button
                        onClick={() => {
                          if (submitting) return;
                          if (unanswered > 0) setShowSubmitConfirm(true);
                          else handleSubmit();
                        }}
                        disabled={submitting}
                        className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all select-none"
                      >
                        Submit Test
                      </button>
                    ) : (
                      <button
                        onClick={() => goTo(currentIndex + 1)}
                        className="flex items-center gap-1.5 bg-brand hover:bg-brand-dark text-white px-6 py-3 rounded-2xl font-bold text-sm shadow-md transition-all select-none"
                      >
                        Next
                        <span className="hidden md:inline bg-white/20 text-[10px] px-1.5 py-0.5 rounded ml-1">
                          Right Arrow / Enter →
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-20 text-slate-400">
                No questions found.
              </div>
            )}

            {/* Error notifications */}
            {submitError && (
              <div className="mt-6 bg-red-50 border border-red-200 rounded-2xl p-4 text-sm text-red-700 text-center dark:bg-red-950/20 dark:border-red-900/50 dark:text-red-400">
                ⚠️ {submitError}
              </div>
            )}
          </div>
        </main>

        {/* Sidebar Grid Navigator (Desktop only) */}
        <aside className="w-72 border-l border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 flex flex-col justify-between hidden lg:flex shrink-0">
          <div className="space-y-5">
            <h3 className="font-heading font-bold text-slate-950 dark:text-white text-base">
              Navigator Panel
            </h3>
            <div className="overflow-y-auto max-h-[60vh] py-2 scrollbar-footer">
              <GridNavigator
                total={total}
                current={currentIndex}
                answers={answers}
                onJump={goTo}
              />
            </div>
          </div>

          {/* Progress / stats box */}
          <div className="border-t border-slate-200 dark:border-slate-850 pt-4 text-xs space-y-2 text-slate-500 dark:text-slate-400">
            <div className="flex justify-between">
              <span>Answered:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {answeredCount}
              </span>
            </div>
            <div className="flex justify-between">
              <span>Remaining:</span>
              <span className="font-bold text-slate-800 dark:text-white">
                {unanswered}
              </span>
            </div>
            {/* Quick tips */}
            <div className="mt-4 p-3 bg-slate-50 dark:bg-slate-950 rounded-xl space-y-1">
              <span className="font-bold text-[10px] text-slate-400 dark:text-slate-500 block uppercase tracking-wider">
                Keyboard shortcuts:
              </span>
              <p className="text-[10px] leading-relaxed text-slate-450 dark:text-slate-400">
                • Press <strong className="text-brand">1, 2, 3, 4</strong> to
                select option.
                <br />• Press <strong className="text-brand">
                  → / Enter
                </strong>{" "}
                to go Next.
                <br />• Press <strong className="text-brand">←</strong> to go
                Prev.
              </p>
            </div>

            {/* Buy Premium CTA — replaces the footer's premium button, which
                is hidden during test-taking. */}
            {openPremiumPopup && (
              <button
                onClick={() => openPremiumPopup()}
                className="w-full mt-4 inline-flex items-center justify-center gap-1.5 text-sm font-bold text-navy px-4 py-2.5 rounded-xl transition-transform hover:scale-105"
                style={{
                  background: "linear-gradient(135deg, #F5C542, #f09819)",
                }}
              >
                👑 Buy Premium Access
              </button>
            )}
          </div>
        </aside>
      </div>

      {/* ── Inline confirmation overlay / modal ─────────────── */}
      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fadeIn">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-850 max-w-sm w-full rounded-3xl p-6 shadow-2xl space-y-4">
            <div className="text-center">
              <FaTriangleExclamation className="mx-auto text-5xl text-red-500 dark:text-red-400" />
            </div>
            <h4 className="text-lg font-bold text-center text-slate-900 dark:text-white">
              Submit test early?
            </h4>
            <p className="text-sm text-slate-500 dark:text-slate-400 text-center leading-relaxed">
              You have left{" "}
              <strong className="text-brand">{unanswered} questions</strong>{" "}
              unanswered. Are you sure you want to submit?
            </p>
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 bg-red-500 hover:bg-red-650 text-white font-bold py-2.5 rounded-xl text-sm transition"
              >
                {submitting ? "Submitting…" : "Yes, Submit"}
              </button>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300 font-semibold py-2.5 rounded-xl text-sm transition"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Drawer */}
      <NavDrawer
        isOpen={mobileGridOpen}
        onClose={() => setMobileGridOpen(false)}
        total={total}
        current={currentIndex}
        answers={answers}
        onJump={goTo}
        onBuyPremium={openPremiumPopup}
      />

      {/* Visibility warning */}
      <TabSwitchToast visible={tabToast} />
    </div>
  );
}
