/**
 * pages/admin/AdminFreeCustomTestPage.jsx
 *
 * Route:
 *   /admin/free-mock-test/custom/:testId
 *
 * Identical UI/flow to AdminCustomTestPage.jsx (the premium custom-test
 * MCQ editor), but operates on the FreeCustomTest model via the
 * /api/free-mock-tests/custom/... endpoints, and shows a
 * "FREE MOCK TEST" badge at the top.
 *
 * Phases driven entirely by test.status from the server:
 *
 *   "settings_pending"  → Phase 1  Time Limit + Total MCQs  → Save Settings
 *                         PATCH /api/free-mock-tests/custom/:testId/settings
 *                         On success: status becomes "mcqs_pending" → auto-advance
 *
 *   "mcqs_pending" |    → Phase 2  Progress bar + MCQ editor
 *   "in_progress"          MCQs live in the shared Mcq collection (linked via
 *                          testModel: "FreeCustomTest"). This page (Stage 3):
 *                            POST   /api/free-mock-tests/custom/:testId/mcqs/batch   (autosave NEW mcqs only)
 *                            PATCH  /api/free-mock-tests/custom/:testId/mcqs/:mcqId  (edit one already-saved mcq)
 *                            DELETE /api/free-mock-tests/custom/:testId/mcqs/:mcqId  (delete one already-saved mcq)
 *                            GET    /api/free-mock-tests/custom/:testId/mcqs/list    (resume: page in existing mcqs)
 *                            POST   /api/free-mock-tests/custom/:testId/publish      → "published"
 *
 *   "published"         → Phase 2 (read-only, Publish button replaced by Published ✓)
 *
 * Heading: "[Group Name] — Free Test [Number]"
 * Back:    ← Dashboard  → /admin/dashboard
 */

import {
  useState,
  useEffect,
  useCallback,
  useRef,
  forwardRef,
  useImperativeHandle,
} from "react";
import { useParams, useNavigate } from "react-router-dom";
import api from "../../api/axios";
import toast from "react-hot-toast";
import TimePicker from "../../components/admin/TimePicker";
import JsonMcqImportButton from "../../components/admin/JsonMcqImportButton";
import SubjectBreakdownEditor from "../../components/admin/SubjectBreakdownEditor";

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

function secondsToHMS(totalSecs) {
  const s = totalSecs || 0;
  return {
    hours: Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

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
  const [subjectBreakdown, setSubjectBreakdown] = useState([]);
  const [saving, setSaving] = useState(false);

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
        subjectBreakdown,
      });
      toast.success("Settings saved.");
      onSaved({
        timeLimitSeconds: data.timeLimitSeconds,
        totalMcqs: data.totalMcqs,
        subjectBreakdown: data.subjectBreakdown,
        status: data.status, // "mcqs_pending" → triggers phase transition
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
          {mcqsError && <p className="text-xs text-danger mt-1">{mcqsError}</p>}
        </div>

        <div>
          <label className="text-xs font-medium text-txt-secondary block mb-2">
            Subject Breakdown <span className="text-txt-muted normal-case">(optional)</span>
          </label>
          <p className="text-xs text-txt-muted mb-2">
            A test usually covers more than one subject — add each one and roughly
            what share of the test it makes up. Shown to users on the Start Test popup.
          </p>
          <SubjectBreakdownEditor value={subjectBreakdown} onChange={setSubjectBreakdown} />
        </div>

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

// Stable client-side identity for MCQs that don't have a server _id yet.
// Used only for React's `key` prop so a card's identity survives array
// shifts (e.g. deleting an earlier MCQ), instead of being tied to its
// position in the array.
let mcqClientKeySeq = 0;
function makeClientKey() {
  mcqClientKeySeq += 1;
  return `local-${Date.now()}-${mcqClientKeySeq}`;
}

function blankMcq() {
  return { clientKey: makeClientKey(), question: "", options: ["", "", "", ""], correctOption: 0 };
}

const OPTION_LETTERS = ["A", "B", "C", "D"];

function isMcqComplete(mcq) {
  if (!mcq || !mcq.question || !mcq.question.trim()) return false;
  if (!Array.isArray(mcq.options) || mcq.options.length !== 4) return false;
  return mcq.options.every((o) => o && o.trim());
}

function McqCard({ index, mcq, onChange, onDelete, disabled, statusBadge }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-4 mb-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs font-semibold text-txt-secondary">MCQ {index + 1}</p>
        <div className="flex items-center gap-3">
          {statusBadge}
          {!disabled && (
            <button
              type="button"
              onClick={() => onDelete(index)}
              className="text-xs font-semibold text-danger hover:text-danger/80 transition"
              title="Delete this MCQ"
            >
              Remove
            </button>
          )}
        </div>
      </div>

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

// AUTOSAVE_CHUNK: MCQs are autosaved in multiples of this many at a time.
// The last partial chunk (< this many) only gets saved via the pre-publish
// flush, or the best-effort flush described below.
const AUTOSAVE_CHUNK = 10;
// How often the autosave interval checks whether a new chunk is ready.
const AUTOSAVE_INTERVAL_MS = 4000;
// Debounce delay before pushing an edit to an already-saved MCQ.
const EDIT_DEBOUNCE_MS = 700;

const McqPhase = forwardRef(function McqPhase(
  { testId, targetCount, initialMcqs, isPublished, timeLimitSeconds, onTargetCountChange },
  ref
) {
  const navigate = useNavigate();
  // initialMcqs come from the server with a real `_id` already — reuse it
  // as the stable clientKey so keys never change once assigned.
  const [mcqs, setMcqs] = useState(() =>
    initialMcqs.map((m) => ({ ...m, clientKey: m.clientKey ?? m._id ?? makeClientKey() }))
  );

  // Number of MCQs already confirmed saved on the server (as individual Mcq
  // documents in the shared collection). Everything at index < lastSavedIndex
  // is guaranteed to carry an `_id` — see the invariant note on
  // fetchAndMergeIds below.
  const [lastSavedIndex, setLastSavedIndex] = useState(initialMcqs.length);
  const [autosaving, setAutosaving] = useState(false);
  const [batchError, setBatchError] = useState("");
  const [publishing, setPublishing] = useState(false);

  // savingRef guards against overlapping autosave calls — if a save is
  // still in flight when the interval fires again, that tick is skipped.
  const savingRef = useRef(false);

  // Mirrors the latest mcqs/lastSavedIndex/isPublished into a ref so the
  // setInterval callback and debounced edit timers always read fresh
  // values instead of a stale closure.
  const stateRef = useRef({ mcqs, lastSavedIndex, isPublished });
  stateRef.current = { mcqs, lastSavedIndex, isPublished };

  // index → pending debounce timer id, for single-MCQ PATCH edits.
  const editTimersRef = useRef({});

  const mcqCount = mcqs.length;
  const progressPct = targetCount ? Math.min(100, Math.round((lastSavedIndex / targetCount) * 100)) : 0;
  const canAddMore = mcqCount < targetCount;
  const canPublish = mcqCount >= targetCount && targetCount > 0;

  function handleAddBatch() {
    if (!canAddMore) return;
    const toAdd = Math.min(AUTOSAVE_CHUNK, targetCount - mcqCount);
    setMcqs((prev) => [...prev, ...Array(toAdd).fill(null).map(blankMcq)]);
  }

  // ── Editing ────────────────────────────────────────────────
  const handleChange = useCallback((index, field, value) => {
    setMcqs((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });

    // If this MCQ was already autosaved, don't wait for the next bulk
    // autosave tick — debounce a single-MCQ PATCH instead.
    if (index < stateRef.current.lastSavedIndex) {
      if (editTimersRef.current[index]) clearTimeout(editTimersRef.current[index]);
      editTimersRef.current[index] = setTimeout(() => {
        delete editTimersRef.current[index];
        savePatchedMcq(index);
      }, EDIT_DEBOUNCE_MS);
    }
  }, []);

  async function savePatchedMcq(index) {
    const { mcqs: currentMcqs } = stateRef.current;
    const mcq = currentMcqs[index];
    if (!mcq || !mcq._id) return; // not actually persisted yet — skip silently
    if (!isMcqComplete(mcq)) return; // don't push a half-edited MCQ
    try {
      await api.patch(`/free-mock-tests/custom/${testId}/mcqs/${mcq._id}`, {
        question: mcq.question,
        options: mcq.options,
        correctOption: mcq.correctOption,
      });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save your edit.");
    }
  }

  // ── Deleting ───────────────────────────────────────────────
  async function handleDelete(index) {
    const { mcqs: currentMcqs, lastSavedIndex: savedIdx } = stateRef.current;
    const mcq = currentMcqs[index];
    if (!mcq) return;

    if (editTimersRef.current[index]) {
      clearTimeout(editTimersRef.current[index]);
      delete editTimersRef.current[index];
    }

    if (index < savedIdx) {
      if (!mcq._id) {
        toast.error("This MCQ is still being saved — try again in a moment.");
        return;
      }
      try {
        await api.delete(`/free-mock-tests/custom/${testId}/mcqs/${mcq._id}`);
      } catch (err) {
        toast.error(err.response?.data?.message || "Failed to delete this MCQ.");
        return;
      }
      setMcqs((prev) => prev.filter((_, i) => i !== index));
      setLastSavedIndex((prev) => prev - 1);
      toast.success("MCQ deleted.");
    } else {
      // Never persisted — just drop it locally, no API call needed.
      setMcqs((prev) => prev.filter((_, i) => i !== index));
    }
  }

  // ── Autosave core ────────────────────────────────────────────
  function isBatchReady(upTo) {
    const { mcqs: currentMcqs } = stateRef.current;
    for (let i = 0; i < upTo; i++) {
      if (!isMcqComplete(currentMcqs[i])) return false;
    }
    return true;
  }

  // GET .../mcqs/list returns Mcq documents (with _id) sorted by `order`.
  // We always re-fetch from the start up to `upTo` rather than trying to
  // compute an exact skip/limit for just the new slice — the paginated
  // endpoint's skip is derived from page*limit, so this is the simplest
  // way to reliably land on the new items regardless of chunk alignment
  // (e.g. after a partial pre-publish flush). Cost scales with `upTo`,
  // which is fine for the typical size of these tests.
  async function fetchAndMergeIds(upTo) {
    const { data } = await api.get(`/free-mock-tests/custom/${testId}/mcqs/list`, {
      params: { page: 1, limit: upTo },
    });
    const docs = data.mcqs || [];
    setMcqs((prev) =>
      prev.map((m, i) => (i < upTo && docs[i] ? { ...m, _id: docs[i]._id } : m))
    );
  }

  // Sends mcqs[startIdx, batchEnd) to the bulk-add endpoint, then merges
  // back the resulting _ids before advancing lastSavedIndex — so the
  // invariant "index < lastSavedIndex ⇒ mcqs[index]._id is set" always
  // holds for any code that runs after this resolves.
  async function doAutosave(batchEnd) {
    const { mcqs: currentMcqs, lastSavedIndex: startIdx } = stateRef.current;
    const newSlice = currentMcqs.slice(startIdx, batchEnd).map((m) => ({
      question: m.question,
      options: m.options,
      correctOption: m.correctOption,
    }));
    if (newSlice.length === 0) return true;

    savingRef.current = true;
    setAutosaving(true);
    try {
      await api.post(`/free-mock-tests/custom/${testId}/mcqs/batch`, { mcqs: newSlice });
      await fetchAndMergeIds(batchEnd);
      setLastSavedIndex(batchEnd);
      setBatchError("");
      return true;
    } catch (err) {
      setBatchError(err.response?.data?.message || "Autosave failed — will retry shortly.");
      return false;
    } finally {
      savingRef.current = false;
      setAutosaving(false);
    }
  }

  function tryAutosave() {
    if (stateRef.current.isPublished) return;
    if (savingRef.current) return; // a save is already in flight — skip this tick
    const { mcqs: currentMcqs, lastSavedIndex: startIdx } = stateRef.current;
    const availableNew = currentMcqs.length - startIdx;
    if (availableNew < AUTOSAVE_CHUNK) return;
    const batchEnd = startIdx + Math.floor(availableNew / AUTOSAVE_CHUNK) * AUTOSAVE_CHUNK;
    if (!isBatchReady(batchEnd)) return; // not fully filled in yet — wait for next tick
    doAutosave(batchEnd);
  }

  useEffect(() => {
    const id = setInterval(tryAutosave, AUTOSAVE_INTERVAL_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function waitForInFlightSave(maxMs = 10000) {
    const start = Date.now();
    while (savingRef.current && Date.now() - start < maxMs) {
      await new Promise((r) => setTimeout(r, 150));
    }
  }

  // Flushes any remaining unsaved-but-complete MCQs (even fewer than 10),
  // used before publish and as the best-effort "navigating away" flush.
  async function flushRemaining() {
    await waitForInFlightSave();
    const { mcqs: currentMcqs, lastSavedIndex: startIdx } = stateRef.current;
    const target = currentMcqs.length;
    if (target - startIdx <= 0) return true;
    if (!isBatchReady(target)) {
      const msg = "Fill in every question and all 4 options before publishing.";
      setBatchError(msg);
      toast.error(msg);
      return false;
    }
    return doAutosave(target);
  }

  useImperativeHandle(ref, () => ({ flushRemaining }));

  // ── Flush on navigating away ─────────────────────────────────
  // Case 1: in-app route change (e.g. another nav link) unmounts this
  // component without a full page unload. Best-effort, not awaited by the
  // unmounting caller — it can still be interrupted if the tab closes
  // immediately after, which is what the beforeunload handler below and
  // the explicit flush in the "← Dashboard" button are for.
  useEffect(() => {
    return () => {
      Object.values(editTimersRef.current).forEach(clearTimeout);
      flushRemaining().catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Case 2: real page unload (tab close, refresh, typed URL). We cannot
  // await anything here, so this is fired without waiting for a response
  // using fetch(..., { keepalive: true }), which lets the request survive
  // past unload in most modern browsers. IMPORTANT CAVEATS — this is a
  // genuine best-effort, not a guaranteed flush: there is no way to know
  // whether it actually completed, it cannot be retried on failure, and
  // keepalive requests share a combined ~64KB body budget so a very large
  // final chunk could be dropped. Auth relies on `withCredentials`
  // cookies, which `credentials: "include"` below preserves.
  useEffect(() => {
    function handleBeforeUnload() {
      const { mcqs: currentMcqs, lastSavedIndex: startIdx, isPublished: pub } = stateRef.current;
      if (pub) return;
      if (savingRef.current) return; // an autosave is already mid-flight, let it run
      const target = currentMcqs.length;
      if (target - startIdx <= 0) return;
      if (!isBatchReady(target)) return; // don't ship incomplete MCQs

      const newSlice = currentMcqs.slice(startIdx, target).map((m) => ({
        question: m.question,
        options: m.options,
        correctOption: m.correctOption,
      }));
      try {
        fetch(`${api.defaults.baseURL}/free-mock-tests/custom/${testId}/mcqs/batch`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          keepalive: true,
          body: JSON.stringify({ mcqs: newSlice }),
        });
      } catch {
        /* best-effort only — nothing more we can do during unload */
      }
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [testId]);

  async function handlePublish() {
    const flushed = await flushRemaining();
    if (!flushed) return;

    setPublishing(true);
    try {
      await api.post(`/free-mock-tests/custom/${testId}/publish`);
      toast.success("Test published!");
      navigate("/admin/dashboard");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to publish.");
    } finally {
      setPublishing(false);
    }
  }

  // ── JSON bulk import ─────────────────────────────────────────
  // The imported file's own length always wins   if it doesn't match
  // targetCount, the test's settings are updated on the server first so
  // publishing later isn't blocked by a stale expected count.
  //
  // NOTE: the new bulk-add endpoint only ever APPENDS Mcq documents — it
  // no longer replaces a full array the way the old endpoint did. That
  // makes JSON import only safe to use before anything has been
  // autosaved for this test (otherwise it would create duplicates
  // alongside the already-saved MCQs). We guard against that case below
  // rather than silently corrupting the test's MCQ list.
  async function handleJsonImport(importedMcqs) {
    if (stateRef.current.lastSavedIndex > 0) {
      throw new Error(
        "JSON import can only be used before any MCQs have been autosaved for this test (bulk-add only appends, it can't replace what's already saved)."
      );
    }

    const newCount = importedMcqs.length;

    if (newCount !== targetCount) {
      try {
        await api.patch(`/free-mock-tests/custom/${testId}/settings`, {
          timeLimitSeconds: timeLimitSeconds,
          totalMcqs: newCount,
        });
        onTargetCountChange(newCount);
      } catch (err) {
        throw new Error(
          err.response?.data?.message || "Could not update the MCQ count on the server."
        );
      }
    }

    try {
      await api.post(`/free-mock-tests/custom/${testId}/mcqs/batch`, { mcqs: importedMcqs });
    } catch (err) {
      throw new Error(err.response?.data?.message || "Could not save the imported MCQs.");
    }

    setMcqs(importedMcqs.map((m) => ({ ...m })));
    await fetchAndMergeIds(importedMcqs.length);
    setLastSavedIndex(importedMcqs.length);
    setBatchError("");
    toast.success(`Imported ${importedMcqs.length} MCQs from JSON.`);
  }

  const batchCount = Math.ceil(mcqs.length / AUTOSAVE_CHUNK);

  return (
    <section>
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

        <p className="text-xs text-txt-muted mb-2 flex items-center gap-2">
          {lastSavedIndex} of {targetCount} MCQs Saved
          {autosaving && (
            <span className="inline-flex items-center gap-1 text-xs text-txt-muted">
              <Spinner /> Autosaving…
            </span>
          )}
        </p>
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-bg rounded-full h-2 overflow-hidden">
            <div
              className="h-full bg-success-light rounded-full transition-all duration-300"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-txt-secondary shrink-0 tabular-nums">
            {lastSavedIndex} / {targetCount}
          </span>
        </div>
      </div>

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
              ({Math.min(AUTOSAVE_CHUNK, targetCount - mcqCount)} more)
            </span>
          )}
        </button>
      </div>

      {batchError && (
        <p className="text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2 mb-4">
          {batchError}
        </p>
      )}

      {!isPublished && (
        <div className="mb-5 bg-bg/60 border border-border rounded-xl p-4">
          <p className="text-xs text-txt-muted mb-2">
            Upload a JSON file to fill in every MCQ automatically   the number of
            questions created will match the file, no matter what count is set above.
            Only available before any MCQs have been autosaved for this test.
          </p>
          <JsonMcqImportButton mode="customTest" onImport={handleJsonImport} />
        </div>
      )}

      {mcqs.length === 0 ? (
        <div className="text-center py-10 text-txt-muted text-sm border border-dashed border-border rounded-xl">
          Click "Add MCQs" to start adding questions.
        </div>
      ) : (
        Array.from({ length: batchCount }).map((_, batchIndex) => {
          const batchStart = batchIndex * AUTOSAVE_CHUNK;
          const batchEnd = Math.min(batchStart + AUTOSAVE_CHUNK, mcqs.length);
          const batchSaved = batchEnd <= lastSavedIndex;
          const batchSlice = mcqs.slice(batchStart, batchEnd);

          return (
            <div key={batchIndex} className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-txt-muted">
                  Batch {batchIndex + 1} ({batchStart + 1}–{batchEnd})
                </p>
                {!isPublished &&
                  (batchSaved ? (
                    <span className="text-xs font-semibold text-success flex items-center gap-1">
                      ✓ Saved
                    </span>
                  ) : autosaving ? (
                    <span className="text-xs font-semibold text-txt-muted flex items-center gap-1">
                      <Spinner /> Saving…
                    </span>
                  ) : (
                    <span className="text-xs text-txt-muted">
                      Autosaves automatically once complete
                    </span>
                  ))}
              </div>

              {batchSlice.map((mcq, i) => {
                const index = batchStart + i;
                const saved = index < lastSavedIndex;
                return (
                  <McqCard
                    key={mcq.clientKey ?? index}
                    index={index}
                    mcq={mcq}
                    onChange={handleChange}
                    onDelete={handleDelete}
                    disabled={isPublished}
                    statusBadge={
                      saved ? (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-success">
                          Saved
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase tracking-wide text-txt-muted">
                          Draft
                        </span>
                      )
                    }
                  />
                );
              })}
            </div>
          );
        })
      )}
    </section>
  );
});

// ─────────────────────────────────────────────────────────────
//  Main page
// ─────────────────────────────────────────────────────────────

export default function AdminFreeCustomTestPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [savedMcqs, setSavedMcqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const mcqPhaseRef = useRef(null);

  useEffect(() => {
    async function fetchTest() {
      try {
        const { data } = await api.get(`/free-custom-tests/test/${testId}`);
        setTest(data);

        // Stage 3: MCQs now live in the shared Mcq collection, not
        // test.mcqs (that embedded array was removed from the schema in
        // Stage 1). Resume by paging them in via the new list endpoint,
        // requesting a large page size so an in-progress test's MCQs load
        // in one call.
        if (data.status && data.status !== "settings_pending") {
          const { data: mcqData } = await api.get(
            `/free-mock-tests/custom/${testId}/mcqs/list`,
            { params: { page: 1, limit: 100000 } }
          );
          setSavedMcqs(
            (mcqData.mcqs || []).map((m) => ({
              _id: m._id,
              question: m.question,
              options: m.options,
              correctOption: m.correctOption,
            }))
          );
        }
      } catch (err) {
        setLoadError(err.response?.data?.message || "Failed to load test.");
      } finally {
        setLoading(false);
      }
    }
    fetchTest();
  }, [testId]);

  function handleSettingsSaved({ timeLimitSeconds, totalMcqs, subjectBreakdown, status }) {
    setTest((prev) => ({ ...prev, timeLimitSeconds, totalMcqs, subjectBreakdown, status }));
  }

  function handleTargetCountChange(newCount) {
    setTest((prev) => ({ ...prev, totalMcqs: newCount }));
  }

  // Flushes any pending autosaves before leaving the page via the in-app
  // "Dashboard" link — the one navigation path we can reliably await.
  async function handleBackToDashboard() {
    if (mcqPhaseRef.current?.flushRemaining) {
      await mcqPhaseRef.current.flushRemaining();
    }
    navigate("/admin/dashboard");
  }

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
          onClick={() => navigate("/admin/dashboard")}
          className="text-sm text-accent hover:text-amber-600 transition"
        >
          ← Back to Dashboard
        </button>
      </div>
    );
  }

  const heading = `${test.groupName || "Custom"} Free Test ${test.testNumber}`;

  const status = test.status; // "settings_pending" | "mcqs_pending" | "in_progress" | "published"
  const isPhase1 = status === "settings_pending";
  const isPublished = status === "published";

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <button
          onClick={handleBackToDashboard}
          className="text-xs text-txt-muted hover:text-txt-secondary transition mb-3 inline-flex items-center gap-1"
        >
          ← Dashboard
        </button>

        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl font-bold text-txt-primary">{heading}</h1>
          <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-400/10 border border-emerald-400/25 px-2 py-0.5 rounded-full">
            Free Mock Test
          </span>
        </div>

        <p className="text-txt-muted text-sm mt-1">
          {isPublished
            ? "This test is published and live to users."
            : isPhase1
            ? "Set the time limit and MCQ count to get started."
            : "Add MCQs, then publish when ready."}
        </p>
      </div>

      {isPhase1 && (
        <SettingsPhase
          testId={testId}
          initialSeconds={test.timeLimitSeconds}
          onSaved={handleSettingsSaved}
        />
      )}

      {!isPhase1 && (
        <McqPhase
          ref={mcqPhaseRef}
          testId={testId}
          targetCount={test.totalMcqs || 0}
          initialMcqs={savedMcqs}
          isPublished={isPublished}
          timeLimitSeconds={test.timeLimitSeconds}
          onTargetCountChange={handleTargetCountChange}
        />
      )}
    </div>
  );
}