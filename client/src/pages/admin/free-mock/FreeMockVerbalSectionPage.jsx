/**
 * pages/admin/free-mock/FreeMockVerbalSectionPage.jsx  (Part 5 Prompt 03 + 04)
 *
 * Verbal Section creation page for Free Mock Tests.
 *
 * Key differences from Part 4 VerbalSectionPage:
 *  - Blue info banner: MCQs belong exclusively to this category (NO sharing).
 *  - apiBasePath passed to useSectionPage so it hits Free Mock endpoints,
 *    not the premium-test endpoints.
 *  - Save button POSTs to /api/admin/free-mock-tests/sections/verbal/save/:testId
 *    (Prompt 04) NOT the generic section save endpoint.
 *  - On success: toast shows 'Verbal section saved for [Category Name].
 *    Non-Verbal section is now available.' then navigates to
 *    /admin/free-mock-tests.
 *  - On error: inline error message shown above the save button; no navigation.
 *  - Route: /admin/free-mock-tests/:slug/test/:testId/add-verbal
 */

import { useParams, Link, useNavigate, useBlocker } from "react-router-dom";
import { useEffect, useState, useCallback } from "react";
import toast          from "react-hot-toast";
import TimePicker     from "../../../components/admin/TimePicker";
import MCQList        from "../../../components/admin/MCQList";
import JsonMcqImportButton from "../../../components/admin/JsonMcqImportButton";
import useSectionPage from "../../../hooks/useSectionPage";
import SubjectBreakdownEditor from "../../../components/admin/SubjectBreakdownEditor";
import MarksSettingsEditor from "../../../components/admin/MarksSettingsEditor";
import { useAdminCategories } from "../../../context/CategoriesContext";
import AdminErrorBoundary     from "../../../components/admin/AdminErrorBoundary";
import api from "../../../api/axios";

// ── Helpers ───────────────────────────────────────────────────

function createEmptyMcq(saved) {
  if (!saved) {
    return {
      question:      "",
      options:       ["", "", "", ""],
      correctIndex:  -1,
      explanation:   "",
      imageUrl:      "",
      imagePublicId: "",
    };
  }
  return {
    question:      saved.question    || "",
    options:       saved.options?.length === 4 ? saved.options : ["", "", "", ""],
    correctIndex:  typeof saved.correctIndex === "number" ? saved.correctIndex : -1,
    explanation:   saved.explanation || "",
    imageUrl:      "",
    imagePublicId: "",
  };
}

function isMcqComplete(m) {
  return (
    m.question?.trim().length > 0 &&
    Array.isArray(m.options) &&
    m.options.every((o) => o?.trim().length > 0) &&
    typeof m.correctIndex === "number" &&
    m.correctIndex >= 0
  );
}

// ── Icons ─────────────────────────────────────────────────────

function ChevronRightIcon() {
  return (
    <svg className="w-3.5 h-3.5 text-txt-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function SaveIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

// ── Section step wrapper ──────────────────────────────────────

function StepCard({ number, title, description, children }) {
  return (
    <div className="bg-surface/60 border border-border rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-border/60 bg-surface/80 flex items-start gap-4">
        <span className="flex-shrink-0 w-7 h-7 rounded-full bg-accent text-white text-xs font-extrabold flex items-center justify-center mt-0.5">
          {number}
        </span>
        <div>
          <h2 className="text-txt-primary font-semibold text-base">{title}</h2>
          {description && <p className="text-txt-muted text-xs mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="px-6 py-5">{children}</div>
    </div>
  );
}

// ── Reduce-count warning dialog ───────────────────────────────

function ReduceCountDialog({ removeCount, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-amber-400/10 border border-amber-400/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
          </div>
          <h3 className="text-txt-primary font-semibold text-base">Reduce MCQ Count?</h3>
        </div>
        <p className="text-txt-secondary text-sm mb-5">
          Reducing the count will remove the last{" "}
          <span className="text-txt-primary font-semibold">{removeCount}</span> container
          {removeCount !== 1 ? "s" : ""}. Any data entered in those containers will be lost. Proceed?
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-border text-txt-secondary hover:text-txt-primary hover:border-txt-muted text-sm font-medium px-4 py-2.5 rounded-lg transition-colors focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-amber-500 hover:bg-amber-400 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors focus:outline-none"
          >
            Remove Containers
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Leave-page confirmation dialog ───────────────────────────

function LeavePageDialog({ onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-surface border border-border rounded-2xl p-6 max-w-sm w-full shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-full bg-danger-light/10 border border-danger/20 flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-danger" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </div>
          <h3 className="text-txt-primary font-semibold text-base">Leave without saving?</h3>
        </div>
        <p className="text-txt-secondary text-sm mb-5">
          You have unsaved changes. Auto-save should have captured most of your
          work, but leaving now may lose any very recent edits.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 border border-border text-txt-secondary hover:text-txt-primary hover:border-txt-muted text-sm font-medium px-4 py-2.5 rounded-lg transition-colors focus:outline-none"
          >
            Stay
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-danger hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors focus:outline-none"
          >
            Leave anyway
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Auto-save failure banner ──────────────────────────────────

function AutoSaveFailedBanner({ onRetry }) {
  return (
    <div className="flex items-center justify-between gap-4 bg-danger-light/10 border border-danger/20 rounded-xl px-4 py-3">
      <div className="flex items-center gap-2 text-sm text-danger">
        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        Auto-save failed. Your unsaved changes may be lost if you navigate away.
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 text-xs font-semibold text-red-300 hover:text-txt-primary border border-danger/30 hover:border-danger px-3 py-1.5 rounded-lg transition"
      >
        Retry
      </button>
    </div>
  );
}

// ── Page skeleton ─────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-4 w-48 bg-bg rounded" />
      <div className="h-8 w-64 bg-bg rounded" />
      <div className="h-14 bg-surface border border-border rounded-xl" />
      <div className="h-40 bg-surface border border-border rounded-2xl" />
      <div className="h-40 bg-surface border border-border rounded-2xl" />
    </div>
  );
}

// ── Inner page component ──────────────────────────────────────

function FreeMockVerbalSectionPageInner() {
  const { slug, testId } = useParams();
  const navigate         = useNavigate();
  const { categories }   = useAdminCategories();

  const category     = categories.find((c) => c.slug === slug);
  const categoryName = category?.name || slug;

  // ── Local state for the free-mock final save (Prompt 04) ──
  const [isFinalSavingLocal, setIsFinalSavingLocal] = useState(false);
  const [finalSaveErrorLocal, setFinalSaveErrorLocal] = useState("");

  const {
    loading, loadError,
    time, timeError, totalSeconds,
    totalMCQs, mcqCountNum,
    pendingCount, showReduceDialog,
    subjectBreakdown,
    totalMarks, negMarkEnabled, negMarkValue,
    mcqs,
    saveStatus,
    canSave,
    isDirty,
    autoSaveFailed,
    retryAutoSave,
    flushAutoSave,
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
    setSaveStatus,
  } = useSectionPage({
    type:    "verbal",
    testId,
    slug,
    navigate,
    createEmptyMcq,
    isMcqComplete,
    successToast: "", // not used we override final save below
    // ── Free Mock draft endpoint ──
    apiBasePath: "/admin/free-mock-tests/sections/verbal",
  });

  // ── Prompt 04: Free Mock specific final save ──────────────
  const handleFreeMockSave = useCallback(async () => {
    setIsFinalSavingLocal(true);
    setFinalSaveErrorLocal("");
    try {
      await flushAutoSave();
      await api.post(`/admin/free-mock-tests/sections/verbal/save/${testId}`);
      toast.success(
        `Verbal section saved for ${categoryName}. Non-Verbal section is now available.`
      );
      navigate("/admin/free-mock-tests");
    } catch (err) {
      const msg =
        err?.response?.data?.message ||
        "Failed to save verbal section. Please try again.";
      setFinalSaveErrorLocal(msg);
    } finally {
      setIsFinalSavingLocal(false);
    }
  }, [testId, categoryName, navigate, flushAutoSave]);

  // ── useBlocker: block in-app nav when isDirty ────────────
  const blocker = useBlocker(isDirty);

  // ── useBeforeUnload: warn on tab close / refresh ─────────
  useEffect(() => {
    function handleBeforeUnload(e) {
      if (!isDirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [isDirty]);

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

      {/* ── Breadcrumb ──────────────────────────────────────── */}
      <nav className="flex items-center gap-1.5 text-xs text-txt-muted" aria-label="Breadcrumb">
        <Link to="/admin/dashboard" className="hover:text-txt-secondary transition-colors">Home</Link>
        <ChevronRightIcon />
        <Link to="/admin/free-mock-tests" className="hover:text-txt-secondary transition-colors">
          Free Mock Tests
        </Link>
        <ChevronRightIcon />
        <span className="text-txt-secondary">{categoryName}</span>
        <ChevronRightIcon />
        <span className="text-txt-secondary font-medium">Add Verbal Section</span>
      </nav>

      {/* ── Page header ──────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-txt-primary">Verbal Section</h1>
          <p className="text-txt-muted text-sm mt-0.5">
            Free Mock Test Test ID:{" "}
            <code className="text-amber-600 text-xs bg-bg px-1.5 py-0.5 rounded">
              {testId}
            </code>
          </p>
        </div>

        {/* Save status + top save button */}
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-3">
            {saveStatus === "saving" && (
              <span className="flex items-center gap-1.5 text-xs text-txt-secondary">
                <Spinner /> Saving…
              </span>
            )}
            {saveStatus === "saved" && (
              <span className="flex items-center gap-1.5 text-xs text-success">
                <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
                Saved
              </span>
            )}
            {saveStatus === "error" && (
              <span className="text-xs text-danger">Auto-save failed</span>
            )}

            <button
              onClick={handleFreeMockSave}
              disabled={!canSave || isFinalSavingLocal}
              title={!canSave ? "Fill all MCQs with questions and correct answers first" : ""}
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
            >
              {isFinalSavingLocal ? <Spinner /> : <SaveIcon />}
              {isFinalSavingLocal ? "Saving…" : "Save Verbal Section"}
            </button>
          </div>

          {/* Inline error shown above button area (top position) */}
          {finalSaveErrorLocal && (
            <p className="text-xs text-danger text-right max-w-xs">{finalSaveErrorLocal}</p>
          )}
        </div>
      </div>

      {/* ── No-sharing info banner (blue) ────────────────────── */}
      <div className="flex items-start gap-3 bg-brand/10 border border-blue-500/20 rounded-xl px-4 py-3">
        <svg className="w-4 h-4 text-brand mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm text-blue-200">
          Verbal MCQs for{" "}
          <span className="font-semibold text-txt-primary">{categoryName}</span>{" "}
          are exclusive to this category and will{" "}
          <span className="font-semibold text-txt-primary">not</span> be shared with other categories.
        </p>
      </div>

      {/* ── Auto-save failure banner ─────────────────────────── */}
      {autoSaveFailed && <AutoSaveFailedBanner onRetry={retryAutoSave} />}

      {/* Draft load warning */}
      {loadError && (
        <div className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded-lg px-4 py-2.5">
          {loadError}
        </div>
      )}

      {/* ── Step 1: Time Setting ─────────────────────────────── */}
      <StepCard
        number="1"
        title="Time Setting"
        description="Set the total time allowed for the verbal section."
      >
        <TimePicker
          hours={time.hours}
          minutes={time.minutes}
          seconds={time.seconds}
          onChange={handleTimeChange}
          error={timeError}
        />
        {totalSeconds >= 60 && (
          <p className="mt-3 text-xs text-txt-muted">
            Total:{" "}
            <span className="text-txt-secondary font-medium">
              {time.hours > 0 && `${time.hours}h `}
              {time.minutes > 0 && `${time.minutes}m `}
              {time.seconds > 0 && `${time.seconds}s`}
            </span>
            {" "}({totalSeconds} seconds)
          </p>
        )}
      </StepCard>

      {/* ── Step 2: MCQ Count ────────────────────────────────── */}
      <StepCard
        number="2"
        title="MCQs (JSON Import)"
        description="Import a JSON file of questions for this verbal section. The number of questions in the file becomes the section's total — there's no separate count to set."
      >
        {mcqCountNum > 0 && (
          <p className="text-sm text-txt-secondary mb-3">
            <span className="font-semibold text-txt-primary">{mcqs.length}</span> MCQs imported for this section.
          </p>
        )}

        <div>
          <p className="text-xs text-txt-muted mb-2">
            Upload a JSON file and the MCQ count and containers will be created automatically.
          </p>
          <JsonMcqImportButton mode="container" onImport={handleJsonImport} />
        </div>
      </StepCard>

      {/* ── Step 3: Subject % Breakdown ─────────────────────── */}
      <StepCard
        number="3"
        title="Subject Breakdown (optional)"
        description="A test usually covers more than one subject — add each one and roughly what share of the test it makes up. Shown to users on the Start Test popup."
      >
        <SubjectBreakdownEditor value={subjectBreakdown} onChange={handleSubjectBreakdownChange} />
      </StepCard>

      {/* ── Step 3b: Marks & Negative Marking ───────────────── */}
      <StepCard
        number="3"
        title="Marks & Negative Marking"
        description="Set the total marks for this section and, if this exam uses negative marking, how many marks to deduct per wrong answer."
      >
        <MarksSettingsEditor
          totalMarks={totalMarks}
          negMarkEnabled={negMarkEnabled}
          negMarkValue={negMarkValue}
          onChange={handleMarksChange}
        />
      </StepCard>

      {/* ── Step 3: MCQ Containers ───────────────────────────── */}
      <StepCard
        number="4"
        title="MCQ Containers"
        description={
          mcqCountNum > 0
            ? `Add up to ${mcqCountNum} MCQ containers. Click 'Add MCQs' to load 10 at a time.`
            : "Import a JSON file above to create the containers."
        }
      >
        {mcqCountNum > 0 ? (
          <MCQList
            mcqs={mcqs}
            totalMCQs={mcqCountNum}
            onChange={handleMcqsChange}
            onMcqEdit={handleSingleMcqEdit}
            onAddBatch={handleAddMcqBatch}
          />
        ) : (
          <div className="text-center py-8 text-txt-muted text-sm">
            Import a JSON file in Step 2 to populate this section.
          </div>
        )}
      </StepCard>

      {/* ── Bottom save button (convenience) ────────────────── */}
      {mcqs.length > 0 && (
        <div className="flex flex-col items-end gap-2 pb-4">
          {/* Inline error shown above bottom save button */}
          {finalSaveErrorLocal && (
            <p className="text-xs text-danger text-right max-w-xs">{finalSaveErrorLocal}</p>
          )}
          <button
            onClick={handleFreeMockSave}
            disabled={!canSave || isFinalSavingLocal}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-accent/50"
          >
            {isFinalSavingLocal ? <Spinner /> : <SaveIcon />}
            {isFinalSavingLocal ? "Saving…" : "Save Verbal Section"}
          </button>
        </div>
      )}

      {/* ── Reduce count warning dialog ──────────────────────── */}
      {showReduceDialog && (
        <ReduceCountDialog
          removeCount={mcqs.length - (pendingCount ?? 0)}
          onConfirm={handleReduceConfirm}
          onCancel={handleReduceCancel}
        />
      )}

      {/* ── Leave-page confirmation (useBlocker) ─────────────── */}
      {blocker.state === "blocked" && (
        <LeavePageDialog
          onConfirm={() => blocker.proceed()}
          onCancel={() => blocker.reset()}
        />
      )}
    </div>
  );
}

// ── Export wrapped in per-page error boundary ─────────────────

export default function FreeMockVerbalSectionPage() {
  return (
    <AdminErrorBoundary>
      <FreeMockVerbalSectionPageInner />
    </AdminErrorBoundary>
  );
}
