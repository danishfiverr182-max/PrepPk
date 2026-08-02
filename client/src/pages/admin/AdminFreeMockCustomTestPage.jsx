/**
 * pages/admin/AdminFreeMockCustomTestPage.jsx  (Prompt 14)
 *
 * MCQ editor for FREE MOCK TESTS on custom categories. Identical UI/flow to
 * AdminCustomTestPage (the premium custom-test editor), but every mutating
 * call targets the /free-mock-tests/custom/... endpoints instead of
 * /custom-tests/..., and a "FREE MOCK TEST" badge is shown at the top so the
 * admin always knows which kind of test they're editing.
 *
 * Route: /admin/free-mock-test/custom/:testId
 *
 * Phases driven entirely by test.status from the server ("in_progress" or
 * "published" for free tests   there is no settings_pending lock-out the
 * way there is for premium tests, but we still show the settings phase
 * first if no totalMcqs has been set yet, for a consistent admin UX):
 *
 *   no totalMcqs yet     → Phase 1  Time Limit + Total MCQs  → Save Settings
 *                         PATCH /api/free-mock-tests/custom/:testId/settings
 *
 *   totalMcqs set        → Phase 2  Progress bar + MCQ editor (batch saves)
 *                          POST /api/free-mock-tests/custom/:testId/mcqs
 *                          POST /api/free-mock-tests/custom/:testId/publish
 *
 *   status === "published" → Phase 2 (read-only, Publish replaced by Published ✓)
 *
 * Heading: "[Group Name] — Free Test [Number]"
 * Back:    ← Free Mock Tests  → /admin/free-mock-tests
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";
import TimePicker from "../../components/admin/TimePicker";
import MarksSettingsEditor from "../../components/admin/MarksSettingsEditor";

// ─────────────────────────────────────────────────────────────
//  Shared helpers
// ─────────────────────────────────────────────────────────────

function Spinner({ size = "sm" }) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <span
      className={`${cls} border-2 border-current border-t-transparent rounded-full animate-spin inline-block`}
    />
  );
}

/** Total seconds → { hours, minutes, seconds } for the TimePicker component */
function secondsToHMS(totalSecs) {
  const s = totalSecs || 0;
  return {
    hours:   Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

/** { hours, minutes, seconds } → total seconds */
function hmsToSeconds({ hours, minutes, seconds }) {
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
}

// ─────────────────────────────────────────────────────────────
//  Phase 1 — Settings
// ─────────────────────────────────────────────────────────────

function SettingsPhase({ testId, initialSeconds, onSaved }) {
  const [timeHMS, setTimeHMS] = useState(secondsToHMS(initialSeconds || 1800));
  const [timeError, setTimeError] = useState("");
  const [totalMcqs, setTotalMcqs] = useState("");
  const [mcqsError, setMcqsError] = useState("");
  const [totalMarks, setTotalMarks] = useState("100");
  const [negMarkEnabled, setNegMarkEnabled] = useState(false);
  const [negMarkValue, setNegMarkValue] = useState("0");
  const [saving, setSaving] = useState(false);

  function handleMarksChange(patch) {
    if (patch.totalMarks !== undefined) setTotalMarks(patch.totalMarks);
    if (patch.negMarkEnabled !== undefined) setNegMarkEnabled(patch.negMarkEnabled);
    if (patch.negMarkValue !== undefined) setNegMarkValue(patch.negMarkValue);
  }

  async function handleSave() {
    let valid = true;

    const totalSecs = hmsToSeconds(timeHMS);
    if (totalSecs < 60) {
      setTimeError("Time limit must be at least 1 minute.");
      valid = false;
    } else {
      setTimeError("");
    }

    const mcqNum = parseInt(totalMcqs, 10);
    if (!totalMcqs || isNaN(mcqNum) || mcqNum < 1) {
      setMcqsError("Enter a valid MCQ count (minimum 1).");
      valid = false;
    } else {
      setMcqsError("");
    }

    if (!valid) return;

    setSaving(true);
    try {
      const { data } = await api.patch(`/free-mock-tests/custom/${testId}/settings`, {
        timeLimitSeconds: totalSecs,
        totalMcqs: mcqNum,
        totalMarks: parseFloat(totalMarks) || 100,
        negativeMarking: {
          enabled: negMarkEnabled,
          marksPerWrong: parseFloat(negMarkValue) || 0,
        },
      });
      // data: { saved, timeLimitSeconds, totalMcqs, totalMarks, negativeMarking }  (free tests have no status lock)
      toast.success("Settings saved.");
      onSaved({
        timeLimitSeconds: data.timeLimitSeconds,
        totalMcqs: data.totalMcqs,
        totalMarks: data.totalMarks,
        negativeMarking: data.negativeMarking,
        status: "mcqs_pending", // synthesize phase transition (free tests have no settings lock)
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="bg-surface border border-border rounded-xl p-6 mb-6">
      <h2 className="text-sm font-semibold text-txt-secondary uppercase tracking-widest mb-5">
        Phase 1 — Test Settings
      </h2>

      <div className="flex flex-col gap-6">
        {/* Time Limit */}
        <div>
          <label className="text-xs font-medium text-txt-secondary block mb-2">
            Time Limit <span className="text-danger">*</span>
          </label>
          <TimePicker
            hours={timeHMS.hours}
            minutes={timeHMS.minutes}
            seconds={timeHMS.seconds}
            onChange={setTimeHMS}
            error={timeError}
          />
          <p className="text-xs text-txt-muted mt-1.5">
            e.g. 00 : 30 : 00 for a 30-minute test
          </p>
        </div>

        {/* Total MCQs */}
        <div>
          <label className="text-xs font-medium text-txt-secondary block mb-1.5">
            Total MCQs <span className="text-danger">*</span>
          </label>
          <input
            type="number"
            min={1}
            value={totalMcqs}
            onChange={(e) => setTotalMcqs(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
            placeholder="e.g. 20"
            className={`w-32 bg-surface border text-txt-primary text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand transition ${
              mcqsError ? "border-danger/60" : "border-border"
            }`}
          />
          {mcqsError && (
            <p className="text-xs text-danger mt-1">{mcqsError}</p>
          )}
        </div>

        {/* Marks & Negative Marking */}
        <div>
          <label className="text-xs font-medium text-txt-secondary block mb-2">
            Marks & Negative Marking
          </label>
          <MarksSettingsEditor
            totalMarks={totalMarks}
            negMarkEnabled={negMarkEnabled}
            negMarkValue={negMarkValue}
            onChange={handleMarksChange}
          />
        </div>

        {/* Save button */}
        <div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-6 py-2.5 rounded-lg transition flex items-center gap-2"
          >
            {saving && <Spinner />}
            {saving ? "Saving…" : "Save Settings"}
          </button>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Phase 2 — MCQ Editor
// ─────────────────────────────────────────────────────────────

function blankMcq() {
  return { question: "", options: ["", "", "", ""], correctOption: 0 };
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

/** A single MCQ is "complete" once the question + all 4 options are non-empty. */
function isMcqComplete(mcq) {
  if (!mcq.question || !mcq.question.trim()) return false;
  if (!Array.isArray(mcq.options) || mcq.options.length !== 4) return false;
  return mcq.options.every((o) => o && o.trim());
}

function McqCard({ index, mcq, onChange, disabled }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-3">
      <p className="text-xs font-semibold text-txt-secondary mb-2">MCQ {index + 1}</p>

      <textarea
        value={mcq.question}
        onChange={(e) => onChange(index, "question", e.target.value)}
        disabled={disabled}
        placeholder="Type the question here…"
        rows={2}
        className="w-full bg-surface border border-border text-txt-primary text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand transition resize-none mb-3 disabled:opacity-60"
      />

      <div className="space-y-2">
        {OPTION_LETTERS.map((letter, i) => (
          <div key={i} className="flex items-center gap-2">
            {/* Correct-option radio */}
            <button
              type="button"
              onClick={() => !disabled && onChange(index, "correctOption", i)}
              disabled={disabled}
              className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                mcq.correctOption === i
                  ? "border-success bg-success-light/20"
                  : "border-border hover:border-txt-muted"
              } ${disabled ? "cursor-not-allowed opacity-60" : ""}`}
              title="Mark as correct"
            >
              {mcq.correctOption === i && (
                <span className="w-2.5 h-2.5 rounded-full bg-success-light" />
              )}
            </button>

            <span className="text-xs font-bold text-txt-muted w-4 shrink-0">{letter}</span>

            <input
              type="text"
              value={mcq.options[i]}
              onChange={(e) => {
                const opts = [...mcq.options];
                opts[i] = e.target.value;
                onChange(index, "options", opts);
              }}
              disabled={disabled}
              placeholder={`Option ${letter}`}
              className="flex-1 bg-surface border border-border text-txt-primary text-sm rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-brand transition disabled:opacity-60"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function McqPhase({ testId, targetCount, initialMcqs, isPublished }) {
  const navigate = useNavigate();
  const [mcqs, setMcqs]   = useState(initialMcqs);
  // Number of MCQs already confirmed saved on the server. Since MCQs are
  // only ever added/saved in batches of (up to) 10, this is always aligned
  // to a batch boundary.
  const [savedCount, setSavedCount] = useState(initialMcqs.length);
  const [savingBatch, setSavingBatch] = useState(null); // batch index currently saving
  const [batchError, setBatchError] = useState("");
  const [publishing, setPublishing] = useState(false);

  const mcqCount    = mcqs.length;
  const progressPct = targetCount ? Math.min(100, Math.round((savedCount / targetCount) * 100)) : 0;
  const canPublish   = savedCount >= targetCount && targetCount > 0;
  const canAddMore    = mcqCount < targetCount;

  function handleAddBatch() {
    if (!canAddMore) return;
    const toAdd = Math.min(10, targetCount - mcqCount);
    setMcqs((prev) => [...prev, ...Array(toAdd).fill(null).map(blankMcq)]);
  }

  const handleChange = useCallback((index, field, value) => {
    setMcqs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }, []);

  // A batch is "ready to save" once every MCQ up to and including its end
  // index is fully filled in (question + 4 options). Earlier batches are
  // already saved, so this really only checks the new ones.
  function isBatchReady(batchEnd) {
    for (let i = 0; i < batchEnd; i++) {
      if (!isMcqComplete(mcqs[i])) return false;
    }
    return true;
  }

  async function handleSaveBatch(batchIndex) {
    const batchEnd = Math.min((batchIndex + 1) * 10, mcqs.length);
    if (!isBatchReady(batchEnd)) {
      setBatchError("Fill in every question and all 4 options before saving this batch.");
      return;
    }
    setBatchError("");
    setSavingBatch(batchIndex);
    try {
      const slice = mcqs.slice(0, batchEnd);
      await api.post(`/free-mock-tests/custom/${testId}/mcqs`, { mcqs: slice });
      setSavedCount(batchEnd);
      toast.success(`Batch ${batchIndex + 1} saved.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Save failed.");
    } finally {
      setSavingBatch(null);
    }
  }

  async function handlePublish() {
    setPublishing(true);
    try {
      await api.post(`/free-mock-tests/custom/${testId}/publish`);
      toast.success("Free test published!");
      navigate("/admin/free-mock-tests");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to publish.");
    } finally {
      setPublishing(false);
    }
  }

  const batchCount = Math.ceil(mcqs.length / 10);

  return (
    <section>
      {/* Progress bar + Publish */}
      <div className="bg-surface border border-border rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-txt-secondary uppercase tracking-widest">
            Phase 2 — MCQs
          </h2>
          <div className="flex items-center gap-3">
            {isPublished ? (
              <span className="flex items-center gap-1.5 text-sm font-semibold text-success px-4 py-2 bg-success-light/10 rounded-lg border border-success/20">
                ✓ Published
              </span>
            ) : (
              <button
                onClick={handlePublish}
                disabled={!canPublish || publishing}
                className={`flex items-center gap-2 text-sm font-semibold px-5 py-2 rounded-lg transition ${
                  canPublish
                    ? "bg-success hover:bg-green-700 text-white"
                    : "bg-bg text-txt-muted cursor-not-allowed"
                }`}
              >
                {publishing && <Spinner />}
                {publishing ? "Publishing…" : "Publish Test"}
              </button>
            )}
          </div>
        </div>

        {/* Progress bar — "X of [Total] MCQs Added" */}
        <p className="text-xs text-txt-muted mb-2">
          {savedCount} of {targetCount} MCQs Added
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-bg rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-success-light rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-txt-secondary shrink-0 tabular-nums">
            {savedCount} / {targetCount}
          </span>
        </div>
      </div>

      {/* MCQ editor */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-txt-secondary uppercase tracking-widest">
          MCQ Editor
        </h2>
        <button
          onClick={handleAddBatch}
          disabled={!canAddMore || isPublished}
          className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition ${
            canAddMore && !isPublished
              ? "bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30"
              : "bg-surface text-txt-secondary cursor-not-allowed"
          }`}
        >
          <span className="text-base leading-none">+</span>
          Add MCQs
          {canAddMore && (
            <span className="text-xs opacity-60">
              ({Math.min(10, targetCount - mcqCount)} more)
            </span>
          )}
        </button>
      </div>

      {batchError && (
        <p className="text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2 mb-4">
          {batchError}
        </p>
      )}

      {mcqs.length === 0 ? (
        <div className="text-center py-10 text-txt-muted text-sm border border-dashed border-border rounded-xl">
          Click "Add MCQs" to start adding questions.
        </div>
      ) : (
        Array.from({ length: batchCount }).map((_, batchIndex) => {
          const batchStart = batchIndex * 10;
          const batchEnd   = Math.min(batchStart + 10, mcqs.length);
          const batchSaved = batchEnd <= savedCount;
          const batchSlice = mcqs.slice(batchStart, batchEnd);

          return (
            <div key={batchIndex} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-txt-muted">
                  Batch {batchIndex + 1} ({batchStart + 1}–{batchEnd})
                </p>
                {!isPublished && (
                  batchSaved ? (
                    <span className="text-xs font-semibold text-success flex items-center gap-1">
                      ✓ Saved
                    </span>
                  ) : (
                    <button
                      onClick={() => handleSaveBatch(batchIndex)}
                      disabled={savingBatch === batchIndex}
                      className="flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg bg-brand hover:bg-brand-dark disabled:opacity-60 text-white transition"
                    >
                      {savingBatch === batchIndex && <Spinner />}
                      {savingBatch === batchIndex ? "Saving…" : "Save Batch"}
                    </button>
                  )
                )}
              </div>

              {batchSlice.map((mcq, i) => (
                <McqCard
                  key={batchStart + i}
                  index={batchStart + i}
                  mcq={mcq}
                  onChange={handleChange}
                  disabled={isPublished || batchSaved}
                />
              ))}
            </div>
          );
        })
      )}
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────

export default function AdminFreeMockCustomTestPage() {
  const { testId } = useParams();
  const navigate   = useNavigate();

  const [test, setTest]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [loadError, setLoadError] = useState("");

  // Fetch test on mount
  useEffect(() => {
    async function fetchTest() {
      try {
        const { data } = await api.get(`/free-custom-tests/test/${testId}`);
        setTest(data);
      } catch (err) {
        setLoadError(err.response?.data?.message || "Failed to load test.");
      } finally {
        setLoading(false);
      }
    }
    fetchTest();
  }, [testId]);

  // Called by SettingsPhase after a successful PATCH
  // Merges the server response fields into local test state → triggers phase change
  function handleSettingsSaved({ timeLimitSeconds, totalMcqs, totalMarks, negativeMarking, status }) {
    setTest((prev) => ({ ...prev, timeLimitSeconds, totalMcqs, totalMarks, negativeMarking, status }));
  }

  // ── Loading / error states ────────────────────────────────

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto py-16 flex justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="max-w-3xl mx-auto py-12">
        <p className="text-danger text-sm mb-3">{loadError}</p>
        <button
          onClick={() => navigate("/admin/free-mock-tests")}
          className="text-sm text-accent hover:text-amber-600 transition"
        >
          ← Back to Free Mock Tests
        </button>
      </div>
    );
  }

  // ── Derived display values ────────────────────────────────

  // Heading: "[Group Name] — Free Test [Number]"
  const heading = `${test.groupName || "Custom"} Free Test ${test.testNumber}`;

  const status     = test.status; // "in_progress" | "published"  (free tests have no settings lock)
  // Free tests have no settings_pending lock on the server   instead, treat
  // "no totalMcqs set yet" as Phase 1, exactly like the premium flow looks
  // to the admin even though the underlying status string differs.
  const isPhase1    = !test.totalMcqs;
  const isPublished = status === "published";

  const savedMcqs = Array.isArray(test.mcqs)
    ? test.mcqs.map((m) => ({ question: m.question, options: m.options, correctOption: m.correctOption }))
    : [];

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="max-w-3xl mx-auto">
      {/* Page header */}
      <div className="mb-8">
        <button
          onClick={() => navigate("/admin/free-mock-tests")}
          className="text-xs text-txt-muted hover:text-txt-secondary transition mb-3 inline-flex items-center gap-1"
        >
          ← Free Mock Tests
        </button>

        <span className="inline-block mb-3 text-xs font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-3 py-1 rounded-full">
          ⬡ Free Mock Test
        </span>

        <h1 className="text-2xl font-bold text-txt-primary">{heading}</h1>

        <p className="text-txt-muted text-sm mt-1">
          {isPublished
            ? "This test is published and live to users."
            : isPhase1
            ? "Set the time limit and MCQ count to get started."
            : "Add MCQs, then publish when ready."}
        </p>
      </div>

      {/* Phase 1 — Settings (only when status === "settings_pending") */}
      {isPhase1 && (
        <SettingsPhase
          testId={testId}
          initialSeconds={test.timeLimitSeconds}
          onSaved={handleSettingsSaved}
        />
      )}

      {/* Phase 2 — MCQ editor (all statuses except settings_pending) */}
      {!isPhase1 && (
        <McqPhase
          testId={testId}
          targetCount={test.totalMcqs || 0}
          initialMcqs={savedMcqs}
          isPublished={isPublished}
        />
      )}
    </div>
  );
}