/**
 * AdminHomePage  (Prompt 10 Polish, error handling, toast notifications)
 *
 * Changes from Prompt 05:
 *   - catError displayed via toast instead of inline red banner
 *   - Delete success → toast.success; delete error → toast.error
 *   - Stats fetch error → toast.error (inline banner removed)
 *   - Empty state when categories.length === 0 (already existed, kept)
 *   - Wrapped by AdminErrorBoundary in App.jsx (no change needed here)
 */

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../api/axios";
import StatCard from "../../components/admin/StatCard";
import CategorySection from "../../components/admin/CategorySection";
import AddCategoryDropdown from "../../components/admin/AddCategoryDropdown";
import DeleteCategoryDialog from "../../components/admin/DeleteCategoryDialog";
import { useAdminCategories } from "../../context/CategoriesContext";
import ExpiryWarningBanner from "../../components/admin/ExpiryWarningBanner";
import VisitorStatsSection from "../../components/admin/VisitorStatsSection";

// ── Icons ─────────────────────────────────────────────────────
function CategoriesIcon() {
  return (
    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M4 6h16M4 10h16M4 14h16M4 18h16" />
    </svg>
  );
}

function TestsIcon() {
  return (
    <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  );
}

function FreeMockTestsIcon() {
  return (
    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function UsersIcon2() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  );
}

// ── Category skeleton ─────────────────────────────────────────
function CategorySkeleton() {
  return (
    <div className="bg-surface/60 border border-border rounded-2xl overflow-hidden animate-pulse">
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/60">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 bg-bg rounded" />
          <div>
            <div className="h-4 w-32 bg-bg rounded mb-1" />
            <div className="h-3 w-16 bg-bg rounded" />
          </div>
        </div>
        <div className="h-9 w-40 bg-bg rounded-lg" />
      </div>
      <div className="px-6 py-8 flex flex-col items-center gap-2">
        <div className="w-12 h-12 bg-bg rounded-full" />
        <div className="h-3 w-28 bg-bg rounded" />
        <div className="h-3 w-40 bg-bg rounded" />
      </div>
    </div>
  );
}

function ActiveUsersIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ExpiredUsersIcon() {
  return (
    <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function AdminHomePage() {
  const navigate = useNavigate();
  const [stats, setStats]         = useState(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [showAddPanel, setShowAddPanel] = useState(false);

  // Delete state
  const [deleteTarget, setDeleteTarget]   = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError]     = useState("");

  const {
    categories,
    loading: catLoading,
    error: catError,
    refreshCategories,
  } = useAdminCategories();

  // Show category fetch errors as a toast (once, when error changes)
  useEffect(() => {
    if (catError) {
      toast.error(catError, { id: "cat-fetch-error" });
    }
  }, [catError]);

  // ── Delete handlers ───────────────────────────────────────
  function handleDeleteClick(category) {
    setDeleteError("");
    setDeleteTarget(category);
  }

  function handleDeleteCancel() {
    setDeleteTarget(null);
    setDeleteError("");
  }

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.delete(`/admin/categories/${deleteTarget.slug}`);
      const deletedName = deleteTarget.name;
      await refreshCategories();
      setDeleteTarget(null);
      toast.success(`"${deletedName}" deleted successfully.`);
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 403
          ? "Default categories (Army, Navy, Air Force) cannot be deleted."
          : err.response?.data?.message || "Failed to delete category. Please try again.";
      // Show in dialog (for context) and as a toast
      setDeleteError(msg);
      toast.error(msg, { id: "delete-error" });
    } finally {
      setDeleteLoading(false);
    }
  }

  // ── Stats fetch ───────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function fetchStats() {
      try {
        const { data } = await api.get("/admin/dashboard-stats");
        if (!cancelled) setStats(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Could not load dashboard stats.",
            { id: "stats-error" }
          );
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    }

    fetchStats();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">

      {/* ── Expiry Warning Banner Prompt 10 ──────────────── */}
      <ExpiryWarningBanner />
      <div className="bg-gradient-to-br from-surface to-surface border border-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-accent/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-brand/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-accent bg-accent/10 border border-accent/20 px-3 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            Admin Panel
          </span>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary leading-tight mb-3">
            Pakistan Mock Test Platform
          </h1>

          <p className="text-txt-secondary text-sm sm:text-base max-w-xl leading-relaxed">
            Welcome to the admin control centre. From here you can manage test
            categories, create and publish mock tests, and oversee registered
            users. All changes take effect immediately across the live platform.
          </p>
        </div>
      </div>

      {/* ── Stats row ──────────────────────────────────────── */}
      <div>
        <h2 className="text-xs font-semibold text-txt-muted uppercase tracking-widest mb-4">
          Platform Overview
        </h2>

        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard
            icon={<CategoriesIcon />}
            label="Total Categories"
            value={stats?.totalCategories ?? 0}
            loading={statsLoading}
            accentClass="bg-blue-900"
          />
          <StatCard
            icon={<TestsIcon />}
            label="Total Tests"
            value={stats?.totalTests ?? 0}
            loading={statsLoading}
            accentClass="bg-accent/20"
          />
          <StatCard
            icon={<FreeMockTestsIcon />}
            label="Free Mock Tests"
            value={stats?.totalFreeMockTests ?? 0}
            loading={statsLoading}
            accentClass="bg-amber-900"
          />
          <div
            onClick={() => navigate("/admin/users")}
            className="cursor-pointer flex-1 min-w-[140px]"
            title="View all users"
          >
            <StatCard
              icon={<UsersIcon />}
              label="Total Users"
              value={stats?.totalUsers ?? 0}
              loading={statsLoading}
              accentClass="bg-green-900"
              subtitle={stats ? `${stats.totalActiveUsers ?? 0} active` : null}
            />
          </div>
          <StatCard
            icon={<ActiveUsersIcon />}
            label="Active Users"
            value={stats?.totalActiveUsers ?? 0}
            loading={statsLoading}
            accentClass="bg-emerald-900"
          />
          <StatCard
            icon={<ExpiredUsersIcon />}
            label="Expired Accounts"
            value={stats?.totalExpiredUsers ?? 0}
            loading={statsLoading}
            accentClass="bg-red-900"
          />
        </div>

        {!statsLoading && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-xs text-txt-muted">
              * Counts update automatically as tests are published and users are created.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => navigate("/admin/users")}
                className="text-xs bg-green-700 hover:bg-green-600 text-txt-primary px-3 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5"
              >
                <UsersIcon2 />
                View Users
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Visitor Stats ─────────────────────────────────────── */}
      <VisitorStatsSection />

      {/* ── Category Management Area ────────────────────────── */}
      <div>        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs font-semibold text-txt-muted uppercase tracking-widest">
            Category Management
          </h2>
          {!catLoading && (
            <span className="text-xs text-txt-muted">
              {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
            </span>
          )}
        </div>

        <div className="space-y-4">
          {catLoading ? (
            <>
              <CategorySkeleton />
              <CategorySkeleton />
              <CategorySkeleton />
            </>
          ) : categories.length === 0 ? (
            /* ── Empty state ──────────────────────────────── */
            <div className="bg-surface/60 border border-border border-dashed rounded-2xl px-6 py-12 text-center">
              <div className="w-14 h-14 rounded-full bg-bg/60 flex items-center justify-center mx-auto mb-4">
                <svg className="w-7 h-7 text-txt-secondary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                </svg>
              </div>
              <p className="text-txt-secondary text-sm font-medium mb-1">No categories yet</p>
              <p className="text-txt-muted text-xs">
                Use the button below to add your first category.
              </p>
            </div>
          ) : (
            categories.map((category) => (
              <CategorySection
                key={category._id}
                category={category}
                tests={[]}
                onDelete={handleDeleteClick}
              />
            ))
          )}
        </div>

        {/* ── Add New Category button + inline dropdown ──────── */}
        {!catLoading && (
          <div className="mt-4">
            <button
              onClick={() => setShowAddPanel((prev) => !prev)}
              className={`w-full flex items-center justify-center gap-2 border-2 border-dashed
                text-sm font-medium py-4 rounded-2xl transition-colors duration-150
                focus:outline-none focus:ring-2 focus:ring-accent/30
                ${showAddPanel
                  ? "border-accent/50 text-accent"
                  : "border-border hover:border-accent/50 text-txt-muted hover:text-accent"
                }`}
            >
              <PlusIcon />
              {showAddPanel ? "Cancel Adding Category" : "Add New Category"}
            </button>

            {showAddPanel && (
              <AddCategoryDropdown onClose={() => setShowAddPanel(false)} />
            )}
          </div>
        )}
      </div>

      {/* ── Delete confirmation dialog (type-to-confirm) ─────── */}
      <DeleteCategoryDialog
        isOpen={!!deleteTarget}
        category={deleteTarget}
        onConfirm={handleDeleteConfirm}
        onCancel={handleDeleteCancel}
        loading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
