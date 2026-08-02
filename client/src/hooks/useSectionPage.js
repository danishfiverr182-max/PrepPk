/**
 * hooks/useSectionPage.js  (Part 4 Prompt 10)
 *
 * Shared hook that encapsulates all state and logic common to
 * VerbalSectionPage, NonVerbalSectionPage, and AcademicSectionPage.
 *
 * Prompt 10 additions:
 *   - isDirty tracking: true after any field change, false after successful auto-save
 *   - autoSaveFailed flag: triggers the persistent failure banner on the page
 *   - retryAutoSave: lets the admin retry after a failed auto-save
 *   - These values are returned so pages can show the banner and register
 *     useBlocker / useBeforeUnload guards
 */

import { useState, useEffect, useRef, useCallback } from "react";
import toast from "react-hot-toast";
import api from "../api/axios";

// ── Time helpers ──────────────────────────────────────────────

export function toSeconds({ hours, minutes, seconds }) {
  return (Number(hours) * 3600) + (Number(minutes) * 60) + Number(seconds);
}

export function fromSeconds(totalSecs) {
  const s = Number(totalSecs) || 0;
  return {
    hours:   Math.floor(s / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
  };
}

// ── Hook ──────────────────────────────────────────────────────

export default function useSectionPage({
  type,
  testId,
  slug,
  navigate,
  createEmptyMcq,
  isMcqComplete,
  successToast,
  // Optional: override the API base path for Free Mock Test endpoints.
  // Defaults to the premium-test path `/admin/sections/${type}`.
  // Pass e.g. '/admin/free-mock-tests/sections/verbal' for Free Mock pages.
  apiBasePath,
}) {
  // Resolved base path used in all fetch/save/finalSave calls
  const basePath = apiBasePath ?? `/admin/sections/${type}`;
  // ── Time state ──────────────────────────────────────────
  const [time, setTime]           = useState({ hours: 0, minutes: 0, seconds: 0 });
  const [timeError, setTimeError] = useState("");

  // ── MCQ count state ─────────────────────────────────────
  const [totalMCQs, setTotalMCQs]               = useState("");
  const [pendingCount, setPendingCount]         = useState(null);
  const [showReduceDialog, setShowReduceDialog] = useState(false);

  // ── Subject % breakdown state (admin-entered, informational) ──
  const [subjectBreakdown, setSubjectBreakdown] = useState([]);

  // ── Marks state (Feature: editable marks + negative marking) ──
  const [totalMarks, setTotalMarks]   = useState("100");
  const [negMarkEnabled, setNegMarkEnabled] = useState(false);
  const [negMarkValue, setNegMarkValue]     = useState("0");

  // ── MCQ list state ──────────────────────────────────────
  const [mcqs, setMcqs] = useState([]);

  // ── Page load state ─────────────────────────────────────
  const [loading, setLoading]     = useState(true);
  const [loadError, setLoadError] = useState("");

  // ── Auto-save state ─────────────────────────────────────
  const [saveStatus, setSaveStatus]           = useState("idle"); // idle|saving|saved|error
  const [isFinalSaving, setIsFinalSaving]     = useState(false);
  const [finalSaveError, setFinalSaveError]   = useState("");

  // ── Prompt 10: isDirty + auto-save failure banner ───────
  const [isDirty, setIsDirty]               = useState(false);
  const [autoSaveFailed, setAutoSaveFailed] = useState(false);

  const debounceRef = useRef(null);
  const isMounted   = useRef(true);
  const saveStatusRef = useRef("idle");
  // Hold latest values for the retry callback without re-creating it
  const latestPayload = useRef({ time, totalMCQs, mcqs, subjectBreakdown, totalMarks, negMarkEnabled, negMarkValue });

  // ── Per-MCQ debounce timers ───────────────────────────────
  // One independent debounce timer per MCQ index, so editing MCQ #5 and
  // then MCQ #40 saves both, each with its own 800ms settle window,
  // instead of one shared timer that only ever saves whichever one you
  // stopped touching last. Keyed by index → timeout id.
  const mcqDebounceTimers = useRef(new Map());
  // Tracks whether the section document exists yet on the server (i.e.
  // at least one batch has been persisted), so single-MCQ PATCHes don't
  // fire before there's anything to PATCH.
  const sectionExistsRef = useRef(false);

  useEffect(() => {
    latestPayload.current = { time, totalMCQs, mcqs, subjectBreakdown, totalMarks, negMarkEnabled, negMarkValue };
  }, [time, totalMCQs, mcqs, subjectBreakdown, totalMarks, negMarkEnabled, negMarkValue]);

  // ── Derived ─────────────────────────────────────────────
  const totalSeconds = toSeconds(time);
  const mcqCountNum  = parseInt(totalMCQs, 10) || 0;
  const canSave =
    mcqs.length === mcqCountNum &&
    mcqCountNum > 0 &&
    totalSeconds >= 60 &&
    mcqs.every(isMcqComplete);

  const completedCount = mcqs.filter(isMcqComplete).length;

  // Backend validation errors mention "MCQ #N"   parse that out so the
  // page can scroll to / highlight the exact container that failed.
  const erroredMcqIndex = (() => {
    const match = finalSaveError && finalSaveError.match(/MCQ #(\d+)/);
    return match ? Number(match[1]) - 1 : null;
  })();

  // ── Unmount cleanup ─────────────────────────────────────
  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
      mcqDebounceTimers.current.forEach((id) => clearTimeout(id));
      mcqDebounceTimers.current.clear();
    };
  }, []);

  // ── Fetch draft on mount ─────────────────────────────────
  useEffect(() => {
    async function fetchDraft() {
      setLoading(true);
      try {
        const { data } = await api.get(`${basePath}/${testId}`);
        if (!isMounted.current) return;

        if (data.section) {
          const {
            timeLimit, totalMCQs: savedCount, mcqs: savedMcqs, subjectBreakdown: savedBreakdown,
            totalMarks: savedTotalMarks, negativeMarking: savedNegMarking,
          } = data.section;
          setTime(fromSeconds(timeLimit));
          setTotalMCQs(String(savedCount));
          setMcqs((savedMcqs || []).map(createEmptyMcq));
          setSubjectBreakdown(savedBreakdown || []);
          setTotalMarks(String(typeof savedTotalMarks === "number" ? savedTotalMarks : 100));
          setNegMarkEnabled(savedNegMarking?.enabled === true);
          setNegMarkValue(String(savedNegMarking?.marksPerWrong ?? 0));
          sectionExistsRef.current = true;
        }
        // Loaded from server not dirty
        setIsDirty(false);
      } catch (err) {
        if (!isMounted.current) return;
        console.warn(`Could not load ${type} draft:`, err.message);
        setLoadError("Could not restore previous draft. Starting fresh.");
      } finally {
        if (isMounted.current) setLoading(false);
      }
    }

    if (testId) fetchDraft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [testId, type]);

  // ── Core auto-save function ───────────────────────────────
  const performAutoSave = useCallback(
    async (overrideMcqs, overrideTime, overrideCount, force = false) => {
      const secs  = toSeconds(overrideTime  ?? latestPayload.current.time);
      const count = parseInt(overrideCount  ?? latestPayload.current.totalMCQs, 10);
      const list  = overrideMcqs            ?? latestPayload.current.mcqs;

      if (!testId) return;
      if (!isMounted.current) return;

      setSaveStatus("saving");
      saveStatusRef.current = "saving";
      try {
        await api.post(`${basePath}/draft`, {
          testId,
          timeLimit: secs,
          totalMCQs: count,
          subjectBreakdown: latestPayload.current.subjectBreakdown,
          mcqs:      list,
          totalMarks: parseFloat(latestPayload.current.totalMarks) || 100,
          negativeMarking: {
            enabled: latestPayload.current.negMarkEnabled,
            marksPerWrong: parseFloat(latestPayload.current.negMarkValue) || 0,
          },
        });
        if (isMounted.current) {
          setSaveStatus("saved");
          setIsDirty(false);
          setAutoSaveFailed(false);
        }
        saveStatusRef.current = "saved";
      } catch (err) {
        console.error("Auto-save failed:", err.message);
        if (isMounted.current) {
          setSaveStatus("error");
          setAutoSaveFailed(true);
        }
        saveStatusRef.current = "error";
      }
    },
    [testId, type]
  );

  // ── Auto-save trigger (debounced) ─────────────────────────
  const triggerAutoSave = useCallback(
    (overrideMcqs, overrideTime, overrideCount) => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(
        () => performAutoSave(overrideMcqs, overrideTime, overrideCount),
        800
      );
    },
    [performAutoSave]
  );

  // ── Retry auto-save (called from the failure banner) ─────
  const retryAutoSave = useCallback(() => {
    performAutoSave(undefined, undefined, undefined);
  }, [performAutoSave]);

  // ── Flush auto-save (called right before a final/section save) ──
  // Cancels any pending debounced auto-save and runs it immediately,
  // so the server-side draft (sectionRef) is guaranteed to exist
  // before the "save section" endpoint is called. Without this, a
  // user who edits an MCQ and immediately clicks Save can hit the
  // final-save endpoint before the 800ms debounced draft request has
  // even been sent, causing a "No draft found for this test" error.
  const flushAutoSave = useCallback(async () => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Flush any pending per-MCQ debounced PATCHes immediately (instead of
    // waiting 800ms), so a quick "type → click Save" doesn't lose the last
    // edit. Each one is a small, single-MCQ PATCH, so doing them all up
    // front here is still far cheaper than the old whole-array resend.
    const timers = mcqDebounceTimers.current;
    if (timers.size > 0) {
      const pendingIndices = Array.from(timers.keys());
      pendingIndices.forEach((idx) => clearTimeout(timers.get(idx)));
      timers.clear();
      const currentMcqs = latestPayload.current.mcqs;
      await Promise.all(
        pendingIndices.map((idx) =>
          api.patch(`${basePath}/mcq/${testId}`, { index: idx, mcq: currentMcqs[idx] })
        )
      ).catch((err) => {
        console.error("Failed to flush pending MCQ edits:", err.message);
        throw new Error("Could not save your latest MCQ edits. Please try again.");
      });
    }

    await performAutoSave(undefined, undefined, undefined, true);
    if (saveStatusRef.current === "error") {
      throw new Error("Could not save the section draft. Please check your inputs and try again.");
    }
  }, [performAutoSave, basePath, testId]);

  // ── Field change handlers ────────────────────────────────

  function handleTimeChange(newTime) {
    setTime(newTime);
    const secs = toSeconds(newTime);
    setTimeError(secs < 60 ? "Total time must be at least 1 minute." : "");
    setSaveStatus("idle");
    setIsDirty(true);
    triggerAutoSave(undefined, newTime, undefined);
  }

  function handleCountChange(e) {
    const raw   = e.target.value;
    const value = parseInt(raw, 10);

    if (!raw) { setTotalMCQs(""); return; }

    if (value < mcqs.length) {
      setPendingCount(value);
      setShowReduceDialog(true);
      return;
    }

    setTotalMCQs(String(value));
    setSaveStatus("idle");
    setIsDirty(true);
    triggerAutoSave(undefined, undefined, String(value));
  }

  async function handleReduceConfirm() {
    const newCount = pendingCount;
    const sliced   = mcqs.slice(0, newCount);
    setTotalMCQs(String(newCount));
    setMcqs(sliced);
    setShowReduceDialog(false);
    setPendingCount(null);
    setSaveStatus("idle");
    setIsDirty(true);

    // Cancel any pending per-MCQ saves for now-removed indices.
    const timers = mcqDebounceTimers.current;
    Array.from(timers.keys()).forEach((idx) => {
      if (idx >= newCount) {
        clearTimeout(timers.get(idx));
        timers.delete(idx);
      }
    });

    if (sectionExistsRef.current && testId) {
      try {
        await api.patch(`${basePath}/mcq-truncate/${testId}`, { count: newCount });
        setSaveStatus("saved");
        setIsDirty(false);
      } catch (err) {
        console.error("Failed to truncate MCQs:", err.message);
        setSaveStatus("error");
        setAutoSaveFailed(true);
      }
    } else {
      // No section on the server yet — fall back to the old whole-array
      // path, which is fine here since there's nothing to truncate anyway.
      triggerAutoSave(sliced, undefined, String(newCount));
    }
  }

  function handleReduceCancel() {
    setShowReduceDialog(false);
    setPendingCount(null);
  }

  // Updates LOCAL state only (so the editor UI — progress bar, completeness
  // counts — reflects the change instantly). This used to also debounce a
  // POST of the entire mcqs array on every keystroke; that's now handled
  // per-index by handleSingleMcqEdit below, which sends only the ONE MCQ
  // that changed instead of everything already saved.
  // Updates subject % breakdown and triggers a debounced save (reuses the
  // same /draft endpoint as time/count — no separate route needed since
  // it's informational-only and doesn't affect MCQ completeness checks).
  function handleSubjectBreakdownChange(next) {
    setSubjectBreakdown(next);
    setSaveStatus("idle");
    setIsDirty(true);
    triggerAutoSave();
  }

  // Handles edits to total marks / negative marking toggle / value.
  // Reuses the same debounced /draft save as time/count/subjectBreakdown.
  function handleMarksChange(patch) {
    if (patch.totalMarks !== undefined) setTotalMarks(patch.totalMarks);
    if (patch.negMarkEnabled !== undefined) setNegMarkEnabled(patch.negMarkEnabled);
    if (patch.negMarkValue !== undefined) setNegMarkValue(patch.negMarkValue);
    setSaveStatus("idle");
    setIsDirty(true);
    triggerAutoSave();
  }

  function handleMcqsChange(updated) {
    setMcqs(updated);
    setSaveStatus("idle");
    setIsDirty(true);
  }

  // Called by MCQList's onMcqEdit(index, updatedMcq) on every keystroke in
  // a single MCQ. Debounces per-index and PATCHes just that one MCQ —
  // payload size and write cost no longer depend on how many MCQs the
  // section already has.
  const handleSingleMcqEdit = useCallback(
    (index, updatedMcq) => {
      setSaveStatus("idle");
      setIsDirty(true);

      if (!sectionExistsRef.current) {
        // No section document yet (shouldn't normally happen — a batch
        // must be added first) — fall back to the full flush so we don't
        // silently drop the edit.
        triggerAutoSave(undefined, undefined, undefined);
        return;
      }

      const timers = mcqDebounceTimers.current;
      if (timers.has(index)) clearTimeout(timers.get(index));

      const timeoutId = setTimeout(async () => {
        timers.delete(index);
        if (!isMounted.current || !testId) return;
        setSaveStatus("saving");
        saveStatusRef.current = "saving";
        try {
          await api.patch(`${basePath}/mcq/${testId}`, { index, mcq: updatedMcq });
          if (isMounted.current) {
            setSaveStatus("saved");
            setAutoSaveFailed(false);
            // Only clear the dirty flag once every in-flight per-MCQ save
            // has settled, so navigation guards don't fire too early.
            if (timers.size === 0) setIsDirty(false);
          }
          saveStatusRef.current = "saved";
        } catch (err) {
          console.error(`Auto-save failed for MCQ #${index + 1}:`, err.message);
          if (isMounted.current) {
            setSaveStatus("error");
            setAutoSaveFailed(true);
          }
          saveStatusRef.current = "error";
        }
      }, 800);

      timers.set(index, timeoutId);
    },
    [basePath, testId]
  );

  // Called by MCQList's onAddBatch(count) when the admin clicks "Add MCQs".
  // Appends blank MCQ placeholders via $push instead of resending the
  // whole (now-larger) array.
  const handleAddMcqBatch = useCallback(
    async (count) => {
      if (!testId) return;
      try {
        await api.post(`${basePath}/mcq-batch/${testId}`, {
          count,
          timeLimit: toSeconds(latestPayload.current.time),
          totalMCQs: parseInt(latestPayload.current.totalMCQs, 10) || undefined,
        });
        sectionExistsRef.current = true;
      } catch (err) {
        console.error("Failed to add MCQ batch:", err.message);
        toast.error("Could not add the new MCQs. Please try again.");
      }
    },
    [basePath, testId]
  );

  // ── JSON bulk import ─────────────────────────────────────
  // Replaces the entire MCQ list with what was parsed from the uploaded
  // JSON file, and sets totalMCQs to match its length   regardless of
  // whatever count was set in Step 2. Saves immediately (not debounced)
  // so a page refresh right after import can't lose the imported MCQs.
  async function handleJsonImport(importedMcqs) {
    // The server rejects any save where the section timer is under 1
    // minute. Since import saves immediately (not debounced), check this
    // up front so the admin gets a clear message instead of a raw 400.
    if (totalSeconds < 60) {
      throw new Error(
        "Set the section timer in Step 1 to at least 1 minute first, then import the JSON file again."
      );
    }

    const count = importedMcqs.length;
    setTotalMCQs(String(count));
    setMcqs(importedMcqs);
    setSaveStatus("idle");
    setIsDirty(true);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    await performAutoSave(importedMcqs, undefined, String(count), true);
    if (saveStatusRef.current === "error") {
      throw new Error("Imported the file, but saving it to the server failed. Check your connection and try again.");
    }
    sectionExistsRef.current = true;
  }

  // ── Final save ───────────────────────────────────────────
  async function handleSaveSection() {
    setIsFinalSaving(true);
    setFinalSaveError("");
    try {
      await flushAutoSave();
      await api.post(`${basePath}/save/${testId}`);
      setIsDirty(false);
      toast.success(successToast);
      navigate(`/admin/dashboard/category/${slug}`);
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        `Failed to save ${type} section. Please try again.`;
      setFinalSaveError(msg);

      // Scroll the offending MCQ container into view so the admin can
      // find it quickly, per Prompt 99 (highlight + locate on error).
      const match = msg.match(/MCQ #(\d+)/);
      if (match) {
        const idx = Number(match[1]) - 1;
        requestAnimationFrame(() => {
          document
            .getElementById(`mcq-container-${idx}`)
            ?.scrollIntoView({ behavior: "smooth", block: "center" });
        });
      }
    } finally {
      setIsFinalSaving(false);
    }
  }

  return {
    // state
    loading, loadError,
    time, timeError, totalSeconds,
    totalMCQs, mcqCountNum,
    pendingCount, showReduceDialog,
    subjectBreakdown,
    totalMarks, negMarkEnabled, negMarkValue,
    mcqs,
    saveStatus, isFinalSaving, finalSaveError,
    canSave,
    completedCount,
    erroredMcqIndex,
    // Prompt 10
    isDirty,
    autoSaveFailed,
    retryAutoSave,
    flushAutoSave,
    // handlers
    handleTimeChange,
    handleCountChange,
    handleReduceConfirm,
    handleReduceCancel,
    handleSubjectBreakdownChange,
    handleMarksChange,
    handleMcqsChange,
    handleSingleMcqEdit,
    handleAddMcqBatch,
    handleJsonImport,
    handleSaveSection,
    setSaveStatus,
  };
}
