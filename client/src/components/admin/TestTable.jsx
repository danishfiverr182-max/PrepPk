/**
 * TestTable (Prompt 07 Category Page)
 *
 * Renders real Test documents returned by GET /admin/categories/:slug/tests.
 *   - Desktop: table with Test Number | Created | Sections | Status | Actions
 *   - Mobile:  stacked cards (same data, touch-friendly)
 *   - Loading: 3 skeleton rows/cards while the API call is in flight
 *   - Pagination: Previous / Next controls, only shown when totalPages > 1
 *
 * Props:
 *   tests       array of { _id, testNumber, isPublished, createdAt, sections }
 *   loading     boolean, show skeleton rows when true
 *   slug        category slug (used to build the View link)
 *   page        current page number (1-based)
 *   totalPages  total number of pages
 *   onPrevPage  () => void
 *   onNextPage  () => void
 *
 * Edit opens a small dropdown to pick a section (Verbal / Non-Verbal /
 * Academic) and navigates to that section's existing add/edit page, which
 * already loads and saves data for an existing testId. Delete is a stub for
 * now — fully wired in Prompt 09.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import adminApi from "../../api/adminApi";
import api from "../../api/axios";
import SectionStatusBadge from "./SectionStatusBadge";
import ConfirmDialog from "./ConfirmDialog";

function formatDate(dateStr) {
  if (!dateStr) return " ";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return " ";
  }
}

function StatusPill({ isPublished }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${
        isPublished
          ? "text-success bg-success-light/10 border-success/20"
          : "text-txt-secondary bg-txt-muted/10 border-txt-muted/20"
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${isPublished ? "bg-success-light" : "bg-txt-muted"}`} />
      {isPublished ? "Published" : "Draft"}
    </span>
  );
}

function ViewIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
    </svg>
  );
}

function ChevronDownIcon({ open }) {
  return (
    <svg
      className={`w-3 h-3 transition-transform duration-150 ${open ? "rotate-180" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function DeleteIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightSmallIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

// ── Edit dropdown: section label/route maps ───────────────────
// The add-verbal / add-nonverbal / add-academic pages already load existing
// section data by testId (GET /sections/:type/:testId) and save back to the
// same test (POST /sections/:type/save/:testId), so they double as "edit"
// pages — no new backend endpoints or pages needed.
const EDIT_SECTION_LABELS = {
  verbal: "Edit Verbal Section",
  nonVerbal: "Edit Non-Verbal Section",
  academic: "Edit Academic Section",
};

const EDIT_SECTION_ROUTES = {
  verbal: "add-verbal",
  nonVerbal: "add-nonverbal",
  academic: "add-academic",
};

function EditDropdown({ test, slug }) {
  const navigate = useNavigate();
  const wrapperRef = useRef(null);
  const [open, setOpen] = useState(false);

  // ── Close on outside click or Escape ──────────────────────
  useEffect(() => {
    if (!open) return;

    function handleClickOutside(e) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    function handleKeyDown(e) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  const handleSectionClick = useCallback(
    (sectionKey) => {
      navigate(
        `/admin/dashboard/category/${slug}/test/${test._id}/${EDIT_SECTION_ROUTES[sectionKey]}`,
        { state: { fromEdit: true } },
      );
      setOpen(false);
    },
    [navigate, slug, test._id],
  );

  return (
    <div className="relative" ref={wrapperRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 text-xs font-medium text-brand hover:text-brand-dark bg-blue-400/5 hover:bg-blue-400/10 border border-blue-400/10 px-3 py-1.5 rounded-lg transition-colors duration-150"
      >
        <EditIcon />
        Edit
        <ChevronDownIcon open={open} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-52 bg-surface border border-border rounded-xl shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border/60">
            <p className="text-xs text-txt-secondary font-medium uppercase tracking-wider">
              Choose section
            </p>
          </div>
          {["verbal", "nonVerbal", "academic"].map((sectionKey) => (
            <button
              key={sectionKey}
              onClick={() => handleSectionClick(sectionKey)}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-txt-primary hover:bg-bg/60 transition-colors duration-100 text-left"
            >
              <span className="w-2 h-2 rounded-full bg-brand flex-shrink-0" />
              {EDIT_SECTION_LABELS[sectionKey]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ActionButtons({ test, slug, onDeleteSuccess }) {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleting, setDeleting]     = useState(false);

  const handleView = () =>
    navigate(`/admin/dashboard/category/${slug}/test/${test._id}/view`);

  const handleDeleteConfirm = async () => {
    setDeleting(true);
    try {
      await api.delete(`/admin/tests/${test._id}`);
      setDialogOpen(false);
      toast.success(`Test ${test.testNumber} deleted successfully`);
      onDeleteSuccess(test);
    } catch (err) {
      const msg =
        err.response?.data?.message || "Failed to delete test. Please try again.";
      toast.error(msg);
      setDeleting(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={handleView}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-txt-secondary hover:text-txt-primary bg-bg/50 hover:bg-bg border border-border/50 px-3 py-1.5 rounded-lg transition-colors duration-150"
        >
          <ViewIcon />
          View
        </button>
        <EditDropdown test={test} slug={slug} />
        <button
          onClick={() => setDialogOpen(true)}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-danger hover:text-red-300 bg-danger-light/10 hover:bg-danger-light/20 border border-danger/20 px-3 py-1.5 rounded-lg transition-colors duration-150"
        >
          <DeleteIcon />
          Delete
        </button>
      </div>

      <ConfirmDialog
        isOpen={dialogOpen}
        title={`Delete Test ${test.testNumber}?`}
        message="This will permanently delete all MCQs and images in this test. This cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        dangerous={true}
        loading={deleting}
        onConfirm={handleDeleteConfirm}
        onCancel={() => !deleting && setDialogOpen(false)}
      />
    </>
  );
}

function SectionBadges({ sections }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <SectionStatusBadge label="Verbal"     status={sections.verbal.status} />
      <SectionStatusBadge label="Non-Verbal" status={sections.nonVerbal.status} />
      <SectionStatusBadge label="Academic"   status={sections.academic.status} />
    </div>
  );
}

// ── Loading skeleton ─────────────────────────────────────────

function SkeletonRows() {
  return (
    <>
      {/* Desktop skeleton */}
      <div className="hidden md:block overflow-x-auto bg-surface/60 border border-border rounded-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/60 text-xs font-semibold text-txt-secondary uppercase tracking-widest">
              <th className="px-6 text-txt-secondary py-3">Test</th>
              <th className="px-6 text-txt-secondary py-3">Created</th>
              <th className="px-6 text-txt-secondary py-3">Sections</th>
              <th className="px-6 text-txt-secondary py-3">Status</th>
              <th className="px-6 text-txt-secondary py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {[1, 2, 3].map((n) => (
              <tr key={n} className="animate-pulse">
                <td className="px-6 py-4"><div className="h-4 w-16 bg-bg rounded" /></td>
                <td className="px-6 py-4"><div className="h-4 w-24 bg-bg rounded" /></td>
                <td className="px-6 py-4"><div className="h-4 w-48 bg-bg rounded" /></td>
                <td className="px-6 py-4"><div className="h-5 w-20 bg-bg rounded-full" /></td>
                <td className="px-6 py-4"><div className="h-7 w-40 bg-bg rounded-lg ml-auto" /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile skeleton */}
      <div className="md:hidden space-y-3">
        {[1, 2, 3].map((n) => (
          <div key={n} className="bg-surface/60 border border-border rounded-2xl p-4 space-y-3 animate-pulse">
            <div className="h-4 w-20 bg-bg rounded" />
            <div className="h-3 w-28 bg-bg rounded" />
            <div className="h-4 w-40 bg-bg rounded" />
            <div className="h-7 w-full bg-bg rounded-lg" />
          </div>
        ))}
      </div>
    </>
  );
}

// ── Pagination controls ──────────────────────────────────────

function PaginationControls({ page, totalPages, onPrevPage, onNextPage }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <button
        onClick={onPrevPage}
        disabled={page <= 1}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-txt-secondary hover:text-txt-primary disabled:opacity-30 disabled:cursor-not-allowed bg-bg/50 hover:bg-bg border border-border/50 px-3 py-2 rounded-lg transition-colors duration-150"
      >
        <ChevronLeftIcon />
        Previous
      </button>

      <span className="text-xs text-txt-muted">
        Page <span className="text-txt-secondary font-medium">{page}</span> of{" "}
        <span className="text-txt-secondary font-medium">{totalPages}</span>
      </span>

      <button
        onClick={onNextPage}
        disabled={page >= totalPages}
        className="inline-flex items-center gap-1.5 text-sm font-medium text-txt-secondary hover:text-txt-primary disabled:opacity-30 disabled:cursor-not-allowed bg-bg/50 hover:bg-bg border border-border/50 px-3 py-2 rounded-lg transition-colors duration-150"
      >
        Next
        <ChevronRightSmallIcon />
      </button>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────

export default function TestTable({
  tests: initialTests = [],
  loading = false,
  slug,
  page = 1,
  totalPages = 1,
  onPrevPage = () => {},
  onNextPage = () => {},
  onTestDeleted,
}) {
  // Local copy for optimistic removal without re-fetching the full list
  const [tests, setTests] = useState(initialTests);

  // Sync when parent passes a fresh list (pagination / refresh / category
  // switch). This must be a real effect, not a conditionally-called hook,
  // or React throws "Rendered more hooks than during the previous render"
  // whenever the condition's truthiness differs between renders.
  useEffect(() => {
    setTests(initialTests);
  }, [initialTests]);

  // Removes the deleted test locally and shifts the testNumber of every
  // other test that came after it down by 1, mirroring the renumbering
  // the server now does on delete. Keeps numbers correct without a
  // full re-fetch (this table is always scoped to a single category).
  const handleDeleteSuccess = (deletedTest) => {
    setTests((prev) =>
      prev
        .filter((t) => t._id !== deletedTest._id)
        .map((t) =>
          t.testNumber > deletedTest.testNumber
            ? { ...t, testNumber: t.testNumber - 1 }
            : t
        )
    );
    onTestDeleted?.(deletedTest._id);
  };
  if (loading) return <SkeletonRows />;

  if (tests.length === 0) return null;

  return (
    <div className="space-y-4">
      {/* ── Desktop table ─────────────────────────────────────── */}
      <div className="hidden md:block overflow-x-auto bg-surface/60 border border-border rounded-2xl">
        <table className="w-full text-left">
          <thead>
            <tr className="border-b border-border/60 text-xs font-semibold text-txt-secondary uppercase tracking-widest">
              <th className="px-6 text-txt-secondary py-3">Test</th>
              <th className="px-6 text-txt-secondary py-3">Created</th>
              <th className="px-6 text-txt-secondary py-3">Sections</th>
              <th className="px-6 text-txt-secondary py-3">Status</th>
              <th className="px-6 text-txt-secondary py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {tests.map((test) => (
              <tr key={test._id} className="hover:bg-surface/40 transition-colors">
                <td className="px-6 py-4 text-sm font-medium text-txt-primary whitespace-nowrap">
                  Test {test.testNumber}
                </td>
                <td className="px-6 py-4 text-sm text-txt-secondary whitespace-nowrap">
                  {formatDate(test.createdAt)}
                </td>
                <td className="px-6 py-4">
                  <SectionBadges sections={test.sections} />
                </td>
                <td className="px-6 py-4">
                  <StatusPill isPublished={test.isPublished} />
                </td>
                <td className="px-6 py-4">
                  <div className="flex justify-end">
                    <ActionButtons test={test} slug={slug} onDeleteSuccess={handleDeleteSuccess} />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Mobile cards ──────────────────────────────────────── */}
      <div className="md:hidden space-y-3">
        {tests.map((test) => (
          <div
            key={test._id}
            className="bg-surface/60 border border-border rounded-2xl p-4 space-y-3"
          >
            <div className="flex items-start justify-between gap-3">
              <p className="text-txt-primary text-sm font-semibold leading-tight">Test {test.testNumber}</p>
              <StatusPill isPublished={test.isPublished} />
            </div>
            <p className="text-txt-secondary text-xs">{formatDate(test.createdAt)}</p>
            <SectionBadges sections={test.sections} />
            <ActionButtons test={test} slug={slug} onDeleteSuccess={handleDeleteSuccess} />
          </div>
        ))}
      </div>

      {/* ── Pagination ────────────────────────────────────────── */}
      <PaginationControls
        page={page}
        totalPages={totalPages}
        onPrevPage={onPrevPage}
        onNextPage={onNextPage}
      />
    </div>
  );
}