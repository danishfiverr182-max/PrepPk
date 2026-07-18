/**
 * components/admin/TestGroupPanel.jsx
 *
 * Slide-down panel for custom category test group management.
 * Shown when admin clicks "Add [Category] Test" on a CUSTOM category.
 *
 * State A — No group selected:
 *   Heading: "Add a Test Group to [Category Name]"
 *   - Group Name input (placeholder: "e.g. Police, Teaching, Forest Department")
 *   - Create Group button → POST /api/test-groups
 *   - If groups already exist: "Or select existing group" label + clickable chips
 *   - Groups loaded on mount via GET /api/test-groups/:categorySlug
 *
 * State B — Group selected:
 *   Heading: "[GroupName] Tests"  e.g. "Police Tests"
 *   - All tests in the group with status icons and Continue/View action
 *   - "+ Add New Test" button → POST /api/test-groups/:groupId/tests
 *     → navigates to /admin/custom-test/:testId/add-mcqs
 *   - "← Back to Groups" link returns to State A
 *
 * Props:
 *   category   { _id, name, slug }   — the custom category
 *   onClose    () => void            — called when panel should close
 */

import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../api/axios";

// ── Icons ─────────────────────────────────────────────────────

function Spinner({ size = "sm" }) {
  const cls = size === "sm" ? "w-3.5 h-3.5" : "w-5 h-5";
  return (
    <span
      className={`${cls} border-2 border-current border-t-transparent rounded-full animate-spin inline-block`}
    />
  );
}

function CheckCircleIcon() {
  return (
    <svg className="w-4 h-4 text-success shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg className="w-4 h-4 text-accent shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function TrashIcon({ className = "w-4 h-4" }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6M9.5 4h5a1 1 0 011 1v2h-7V5a1 1 0 011-1z" />
    </svg>
  );
}

function GearIcon() {
  return (
    <svg className="w-4 h-4 text-orange-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

// ── Status helpers ────────────────────────────────────────────

/**
 * Returns { icon, label, badge } for a test's status string.
 * status: "settings_pending" | "mcqs_pending" | "in_progress" | "published"
 */
function getStatusMeta(status) {
  switch (status) {
    case "published":
      return {
        icon: <CheckCircleIcon />,
        label: "Published",
        badgeCls: "bg-success-light/10 text-success",
      };
    case "mcqs_pending":
      return {
        icon: <GearIcon />,
        label: "MCQs Pending",
        badgeCls: "bg-orange-400/10 text-orange-400",
      };
    case "settings_pending":
      return {
        icon: <ClockIcon />,
        label: "Settings Pending",
        badgeCls: "bg-accent/10 text-accent",
      };
    case "in_progress":
    default:
      return {
        icon: <ClockIcon />,
        label: "In Progress",
        badgeCls: "bg-accent/10 text-accent",
      };
  }
}

// ── Test row (State B) ────────────────────────────────────────

function TestRow({ groupName, test, onAction }) {
  const isPublished = test.status === "published";
  const { icon, label, badgeCls } = getStatusMeta(test.status);

  return (
    <div className="flex items-center justify-between py-2.5 border-b border-border/60 last:border-0">
      <div className="flex items-center gap-2 min-w-0">
        {icon}
        <span className="text-sm text-txt-secondary truncate">
          {groupName} Test {test.testNumber}
        </span>
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded shrink-0 ${badgeCls}`}>
          {label}
        </span>
      </div>

      <button
        onClick={() => onAction(test._id, isPublished)}
        className={`text-xs font-semibold shrink-0 ml-3 transition ${
          isPublished
            ? "text-success hover:text-green-300"
            : "text-accent hover:text-amber-600"
        }`}
      >
        {isPublished ? "View →" : "Continue →"}
      </button>
    </div>
  );
}

// ── Group chip (State A) ──────────────────────────────────────

function GroupChip({ group, onClick, onDelete, deleting }) {
  return (
    <span className="inline-flex items-center rounded-full border border-accent/30 bg-accent/10 hover:border-accent/50 transition-colors duration-150 overflow-hidden">
      <button
        onClick={() => onClick(group)}
        className="px-3 py-1.5 text-xs font-semibold text-accent hover:bg-accent/20 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-accent/30"
      >
        {group.name}
      </button>
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(group);
        }}
        disabled={deleting}
        title={`Delete ${group.name} group`}
        className="pl-1 pr-2 py-1.5 text-accent/60 hover:text-danger disabled:opacity-50 transition-colors duration-150 focus:outline-none"
      >
        {deleting ? <Spinner /> : <TrashIcon className="w-3.5 h-3.5" />}
      </button>
    </span>
  );
}

// ── Main component ────────────────────────────────────────────

export default function TestGroupPanel({ category, onClose }) {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  // ── State A: group creation ───────────────────────────────
  const [groupName, setGroupName] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");

  // Existing groups (chip list)
  const [existingGroups, setExistingGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);

  // ── State B: group selected ───────────────────────────────
  const [activeGroup, setActiveGroup] = useState(null); // { _id, name, ... }
  const [tests, setTests] = useState([]);
  const [loadingTests, setLoadingTests] = useState(false);
  const [addingTest, setAddingTest] = useState(false);
  const [addTestError, setAddTestError] = useState("");

  // ── Group deletion ─────────────────────────────────────────
  const [deletingGroupId, setDeletingGroupId] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  // Focus name input when State A is shown
  useEffect(() => {
    if (!activeGroup) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [activeGroup]);

  // Load groups on mount — GET /api/test-groups/:categorySlug
  useEffect(() => {
    async function fetchGroups() {
      try {
        const { data } = await api.get(`/test-groups/${category.slug}`);
        setExistingGroups(data);
      } catch {
        // non-fatal
      } finally {
        setLoadingGroups(false);
      }
    }
    fetchGroups();
  }, [category.slug]);

  // Reload tests whenever active group changes
  useEffect(() => {
    if (!activeGroup) return;
    setLoadingTests(true);
    setAddTestError("");
    api
      .get(`/test-groups/${activeGroup._id}/tests`)
      .then(({ data }) => setTests(data))
      .catch(() => setTests([]))
      .finally(() => setLoadingTests(false));
  }, [activeGroup]);

  // ── Create group — POST /api/test-groups ──────────────────
  async function handleCreateGroup() {
    setCreateError("");
    if (!groupName.trim()) {
      setCreateError("Group name is required.");
      return;
    }
    setCreating(true);
    try {
      const { data } = await api.post("/test-groups", {
        name: groupName.trim(),
        categoryId: category._id,
      });
      setExistingGroups((prev) => [...prev, data]);
      setGroupName("");
      // Immediately transition to State B with the new group
      setActiveGroup(data);
    } catch (err) {
      setCreateError(err.response?.data?.message || "Failed to create group.");
    } finally {
      setCreating(false);
    }
  }

  // ── Add new test — POST /api/test-groups/:groupId/tests ───
  async function handleAddTest() {
    if (!activeGroup) return;
    setAddingTest(true);
    setAddTestError("");
    try {
      const { data } = await api.post(`/test-groups/${activeGroup._id}/tests`);
      navigate(`/admin/custom-test/${data._id}/add-mcqs`);
    } catch (err) {
      setAddTestError(err.response?.data?.message || "Failed to create test.");
    } finally {
      setAddingTest(false);
    }
  }

  // ── Delete group — DELETE /api/test-groups/:groupId ────────
  // Deletes the group and ALL of its tests (both premium and free),
  // including their MCQs from MongoDB. This is irreversible, so we
  // confirm with the admin first.
  async function handleDeleteGroup(group) {
    const confirmed = window.confirm(
      `Delete "${group.name}"? This will permanently delete this group and ALL of its tests (including every question in them). This cannot be undone.`
    );
    if (!confirmed) return;

    setDeleteError("");
    setDeletingGroupId(group._id);
    try {
      await api.delete(`/test-groups/${group._id}`);
      setExistingGroups((prev) => prev.filter((g) => g._id !== group._id));
      // If the deleted group was open, return to the group list
      if (activeGroup && activeGroup._id === group._id) {
        setActiveGroup(null);
        setTests([]);
      }
    } catch (err) {
      setDeleteError(err.response?.data?.message || "Failed to delete group.");
    } finally {
      setDeletingGroupId(null);
    }
  }

  // ── Navigate for Continue / View ──────────────────────────
  function handleTestAction(testId, isPublished) {
    if (isPublished) {
      navigate(`/admin/custom-test/${testId}/add-mcqs`);
    } else {
      navigate(`/admin/custom-test/${testId}/add-mcqs`);
    }
  }

  // ── Select an existing group chip → State B ───────────────
  function handleChipClick(group) {
    setActiveGroup(group);
    setCreateError("");
  }

  // ═════════════════════════════════════════════════════════════
  // STATE A — No group selected
  // ═════════════════════════════════════════════════════════════
  if (!activeGroup) {
    return (
      <div className="mt-3 bg-surface border border-border rounded-xl p-5 max-w-md">
        {/* Heading */}
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-sm font-semibold text-txt-primary">
            Add a Test Group to{" "}
            <span className="text-accent">{category.name}</span>
          </h4>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-txt-secondary transition text-lg leading-none ml-3 shrink-0"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3">
          {/* Group Name input */}
          <div>
            <label className="text-xs font-medium text-txt-secondary block mb-1">
              Group Name <span className="text-danger">*</span>
            </label>
            <input
              ref={inputRef}
              type="text"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleCreateGroup()}
              placeholder="e.g. Police, Teaching, Forest Department"
              className="w-full bg-surface border border-border text-txt-primary text-sm rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-brand transition"
            />
          </div>

          {createError && (
            <p className="text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2">
              {createError}
            </p>
          )}

          {/* Create Group button */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCreateGroup}
              disabled={creating}
              className="bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition flex items-center gap-2"
            >
              {creating && <Spinner />}
              {creating ? "Creating…" : "Create Group"}
            </button>
          </div>

          {/* Existing groups as chips */}
          {loadingGroups ? (
            <div className="flex gap-2 pt-1">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-7 w-20 bg-bg rounded-full animate-pulse" />
              ))}
            </div>
          ) : existingGroups.length > 0 ? (
            <div className="border-t border-border pt-3 mt-1">
              <p className="text-xs text-txt-muted mb-2.5">Or select existing group</p>
              <div className="flex flex-wrap gap-2">
                {existingGroups.map((g) => (
                  <GroupChip
                    key={g._id}
                    group={g}
                    onClick={handleChipClick}
                    onDelete={handleDeleteGroup}
                    deleting={deletingGroupId === g._id}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {deleteError && (
            <p className="text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2">
              {deleteError}
            </p>
          )}
        </div>
      </div>
    );
  }

  // ═════════════════════════════════════════════════════════════
  // STATE B — Group selected
  // ═════════════════════════════════════════════════════════════
  return (
    <div className="mt-3 bg-surface border border-border rounded-xl p-5 max-w-md">
      {/* Heading: "[GroupName] Tests" */}
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-base font-bold text-txt-primary">
          {activeGroup.name} Tests
        </h4>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={() => handleDeleteGroup(activeGroup)}
            disabled={deletingGroupId === activeGroup._id}
            title={`Delete ${activeGroup.name} group`}
            className="flex items-center gap-1 text-xs font-semibold text-danger/80 hover:text-danger disabled:opacity-50 transition"
          >
            {deletingGroupId === activeGroup._id ? <Spinner /> : <TrashIcon className="w-3.5 h-3.5" />}
            Delete Group
          </button>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-txt-secondary transition text-lg leading-none"
          >
            ×
          </button>
        </div>
      </div>

      {deleteError && (
        <p className="mb-3 text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2">
          {deleteError}
        </p>
      )}

      {/* Test list */}
      {loadingTests ? (
        <div className="space-y-2 mb-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 bg-bg rounded animate-pulse" />
          ))}
        </div>
      ) : tests.length > 0 ? (
        <div className="mb-4">
          {tests.map((test) => (
            <TestRow
              key={test._id}
              groupName={activeGroup.name}
              test={test}
              onAction={handleTestAction}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-txt-muted mb-4">
          No tests yet. Click below to add the first one.
        </p>
      )}

      {/* + Add New Test */}
      <button
        onClick={handleAddTest}
        disabled={addingTest}
        className="flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
      >
        {addingTest ? <Spinner /> : <span className="text-base leading-none">+</span>}
        {addingTest ? "Creating…" : "Add New Test"}
      </button>

      {addTestError && (
        <p className="mt-2 text-xs text-danger bg-danger-light/10 border border-danger/20 rounded-lg px-3 py-2">
          {addTestError}
        </p>
      )}

      {/* Back to Groups */}
      <div className="mt-3 pt-3 border-t border-border">
        <button
          onClick={() => setActiveGroup(null)}
          className="text-xs text-txt-muted hover:text-txt-secondary transition"
        >
          ← Back to Groups
        </button>
      </div>
    </div>
  );
}