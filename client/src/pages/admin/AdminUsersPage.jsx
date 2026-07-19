/**
 * pages/admin/AdminUsersPage.jsx  (Prompt 4   Simplify Create User Form)
 *
 * Changes:
 *  - Removed the stale editCatsTarget state variable and its dangling JSX fragment
 *    (the "Edit Categories Modal removed" comment block had an orphaned `)}` causing
 *    a syntax error in some bundlers).
 *  - Table columns confirmed as: Email | Plan | Expires On | Status | Actions.
 *    No "Categories" column   this was never added after Prompt 1 cleanup.
 *  - Status badge: green "Active" when expiresAt is in the future,
 *    red "Expired" when in the past. Already correct.
 *  - No other logic changes.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import api from "../../api/axios";
import toast from "react-hot-toast";
import CreateUserModal from "../../components/admin/CreateUserModal";
import UserDetailModal from "../../components/admin/UserDetailModal";
import ExtendAccessModal from "../../components/admin/ExtendAccessModal";
import ResetPasswordModal from "../../components/admin/ResetPasswordModal";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import Badge from "../../components/ui/Badge";

// ── Helpers ───────────────────────────────────────────────────
function formatDate(dateStr) {
  if (!dateStr) return " ";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Skeleton Row ──────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="bg-surface">
      {[180, 90, 120, 80, 100].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div
            className="h-4 bg-border rounded animate-pulse"
            style={{ width: w }}
          />
        </td>
      ))}
    </tr>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [showCreate, setShowCreate] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, email }
  const [viewUserId, setViewUserId] = useState(null);
  const [extendTarget, setExtendTarget] = useState(null);
  const [resetTarget, setResetTarget] = useState(null); // { _id, email }
  const [forceLogoutId, setForceLogoutId] = useState(null);

  const debounceRef = useRef(null);

  // Debounce search input (400 ms)
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedQ(search);
      setPage(1);
    }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ page, limit: 15 });
    if (debouncedQ) params.set("search", debouncedQ);

    api
      .get(`/admin/users?${params}`)
      .then((res) => {
        setUsers(res.data.users);
        setTotal(res.data.total);
        setTotalPages(res.data.totalPages);
      })
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load users."),
      )
      .finally(() => setLoading(false));
  }, [page, debouncedQ]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  async function handleDelete() {
    if (!deleteTarget) return;
    const { _id, email } = deleteTarget;

    // Optimistic removal
    setDeletingId(_id);
    const previousUsers = users;
    const previousTotal = total;
    setUsers((prev) => prev.filter((u) => u._id !== _id));
    setTotal((prev) => prev - 1);

    try {
      await api.delete(`/admin/users/${_id}`);
      setDeleteTarget(null);
      toast.success(`${email} account deleted.`);

      // If we emptied the current page and it wasn't page 1, go back one
      if (previousUsers.length === 1 && page > 1) {
        setPage((p) => p - 1);
      }
    } catch (err) {
      // Restore on failure
      setUsers(previousUsers);
      setTotal(previousTotal);
      toast.error(err.response?.data?.message || "Failed to delete user.");
    } finally {
      setDeletingId(null);
    }
  }

  async function handleForceLogout(user) {
    setForceLogoutId(user._id);
    try {
      await api.post(`/admin/users/${user._id}/force-logout`);
      toast.success(`${user.email}'s session was cleared — they can log in again now.`);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to clear session.");
    } finally {
      setForceLogoutId(null);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-txt-primary dark:text-white">
            User Management
          </h1>
          <p className="text-txt-secondary text-sm mt-1">
            {total > 0
              ? `${total} premium account${total !== 1 ? "s" : ""}`
              : "No users yet"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2 rounded-xl transition"
        >
          + New User
        </button>
      </div>

      {/* Search Bar */}
      <div className="relative max-w-sm">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted pointer-events-none"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z"
          />
        </svg>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by email…"
          className="w-full bg-surface border border-border text-txt-primary text-sm rounded-xl pl-9 pr-8 py-2.5 placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand"
        />
        {search && (
          <button
            onClick={() => {
              setSearch("");
              setDebouncedQ("");
              setPage(1);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition"
            aria-label="Clear search"
          >
            ✕
          </button>
        )}
      </div>

      {/* Error */}
      {!loading && error && <p className="text-danger text-sm">{error}</p>}

      {/* Table   columns: Email | Plan | Expires On | Status | Actions */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg text-txt-secondary text-sm font-semibold uppercase tracking-wider">
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Plan</th>
              <th className="text-left px-4 py-3">Expires On</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {/* Loading skeleton   5 rows */}
            {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}

            {/* Data rows */}
            {!loading &&
              users.map((user, idx) => {
                const expired = user.isExpired;
                return (
                  <tr
                    key={user._id}
                    className={`${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"} hover:bg-bg transition`}
                  >
                    {/* Email */}
                    <td className="px-4 py-3 text-txt-primary font-bold truncate max-w-[200px]">
                      {user.email}
                    </td>

                    {/* Plan / Duration */}
                    <td className="px-4 py-3 text-txt-primary capitalize">
                      {user.duration?.replace("-", " ") || " "}
                    </td>

                    {/* Expiry Date */}
                    <td
                      className={`px-4 py-3 ${expired ? "text-danger" : "text-txt-primary"}`}
                    >
                      {formatDate(user.expiresAt)}
                    </td>

                    {/* Status Pill   green Active / red Expired */}
                    <td className="px-4 py-3">
                      {expired ? (
                        <Badge variant="danger">Expired</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1.5">
                        {/* View */}
                        <button
                          title="View"
                          onClick={() => setViewUserId(user._id)}
                          className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                        </button>

                        {/* Extend Access */}
                        <button
                          title="Extend Access"
                          onClick={() =>
                            setExtendTarget({
                              _id: user._id,
                              email: user.email,
                              expiresAt: user.expiresAt,
                            })
                          }
                          className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M12 8v4l3 3m6-3a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"
                            />
                          </svg>
                        </button>

                        {/* Reset Password */}
                        <button
                          title="Reset Password"
                          onClick={() =>
                            setResetTarget({ _id: user._id, email: user.email })
                          }
                          className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M15 7a2 2 0 0 1 2 2m4 0a6 6 0 0 1-7.743 5.743L11 17H9v2H7v2H4a1 1 0 0 1-1-1v-2.586a1 1 0 0 1 .293-.707l5.964-5.964A6 6 0 1 1 21 9z"
                            />
                          </svg>
                        </button>

                        {/* Force Logout — clears a stuck/active session so
                            the user (or you, while testing) can log back
                            in on this or any device */}
                        <button
                          title="Force Logout (clear active session)"
                          onClick={() => handleForceLogout(user)}
                          disabled={forceLogoutId === user._id}
                          className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg disabled:opacity-40 transition"
                        >
                          {forceLogoutId === user._id ? (
                            <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h4a3 3 0 0 1 3 3v1"
                              />
                            </svg>
                          )}
                        </button>

                        {/* Delete */}
                        <button
                          title="Delete"
                          onClick={() =>
                            setDeleteTarget({
                              _id: user._id,
                              email: user.email,
                            })
                          }
                          disabled={deletingId === user._id}
                          className="p-1.5 rounded-lg text-danger hover:text-danger-darker hover:bg-bg disabled:opacity-40 transition"
                        >
                          {deletingId === user._id ? (
                            <span className="w-4 h-4 border-2 border-danger border-t-transparent rounded-full animate-spin inline-block" />
                          ) : (
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={2}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M19 7l-.867 12.142A2 2 0 0 1 16.138 21H7.862a2 2 0 0 1-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v3M4 7h16"
                              />
                            </svg>
                          )}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

            {/* Empty state */}
            {!loading && !error && users.length === 0 && (
              <tr>
                <td colSpan={5} className="py-16 text-center">
                  <p className="text-4xl mb-3">👤</p>
                  <p className="text-txt-muted text-sm mb-3">
                    {debouncedQ
                      ? `No users found for "${debouncedQ}"`
                      : "No premium users yet."}
                  </p>
                  {!debouncedQ && (
                    <button
                      onClick={() => setShowCreate(true)}
                      className="text-brand hover:text-brand-dark text-sm underline underline-offset-2 transition"
                    >
                      Create the first user
                    </button>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-txt-muted">
            Page {page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-txt-secondary hover:text-txt-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              ← Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 rounded-lg bg-surface border border-border text-txt-secondary hover:text-txt-primary disabled:opacity-40 disabled:cursor-not-allowed transition"
            >
              Next →
            </button>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreate && (
        <CreateUserModal
          onClose={() => setShowCreate(false)}
          onCreated={() => {
            fetchUsers();
            setShowCreate(false);
          }}
        />
      )}

      {/* View User Modal */}
      {viewUserId && (
        <UserDetailModal
          userId={viewUserId}
          onClose={() => setViewUserId(null)}
        />
      )}

      {/* Extend Access Modal */}
      {extendTarget && (
        <ExtendAccessModal
          userId={extendTarget._id}
          email={extendTarget.email}
          currentExpiresAt={extendTarget.expiresAt}
          onClose={() => setExtendTarget(null)}
          onExtended={({ expiresAt, isExpired }) => {
            // Optimistic row update   no re-fetch needed
            setUsers((prev) =>
              prev.map((u) =>
                u._id === extendTarget._id ? { ...u, expiresAt, isExpired } : u,
              ),
            );
          }}
        />
      )}

      {/* Reset Password Modal */}
      {resetTarget && (
        <ResetPasswordModal
          userId={resetTarget._id}
          email={resetTarget.email}
          onClose={() => setResetTarget(null)}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete account for ${deleteTarget?.email ?? ""}?`}
        message="This will permanently delete the account. The user will immediately lose all access and cannot log in. This cannot be undone."
        confirmLabel="Delete Account"
        cancelLabel="Cancel"
        dangerous={true}
        loading={!!deletingId}
        onConfirm={handleDelete}
        onCancel={() => {
          if (!deletingId) setDeleteTarget(null);
        }}
      />
    </div>
  );
}
