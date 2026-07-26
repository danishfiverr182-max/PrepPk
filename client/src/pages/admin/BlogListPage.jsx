/**
 * src/pages/admin/BlogListPage.jsx  (Prompt 4 — Blog Admin UI)
 *
 * Paginated list of every blog post (any status), with a status filter
 * and a client-side title search over the fetched page. Styled to match
 * ApiKeyPoolPage.jsx (gradient header banner + card table) since it sits
 * right next to it in the admin nav, and reuses the exact confirm-delete
 * pattern from ApiKeyPoolPage.jsx / ConfirmDialog.jsx and the pagination
 * footer pattern from CustomTestTable.jsx.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { listPosts, deletePost } from "../../api/blog";
import Badge from "../../components/ui/Badge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { formatRelativeTime } from "../../utils/formatRelativeTime";
import api from "../../api/axios";

document.title = "Blog | PrepPk Admin";

const PAGE_LIMIT = 15;

// ── Icons ─────────────────────────────────────────────────────
function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-txt-muted pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function SparklesIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

const STATUS_META = {
  draft: { variant: "muted", label: "Draft" },
  published: { variant: "success", label: "Published" },
};

function StatusBadge({ status }) {
  const meta = STATUS_META[status] || STATUS_META.draft;
  return <Badge variant={meta.variant}>{meta.label}</Badge>;
}

function SkeletonRow() {
  return (
    <tr className="bg-surface">
      {[220, 90, 100, 70, 140].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-border rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

const STATUS_TABS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
];

// ── Medium-style theme toggle ──────────────────────────────────
// Reads the current site-wide reading theme (AdminSettings.blogTheme) via
// the same public GET /settings/contact endpoint every other settings
// toggle in this codebase uses, and writes it with the existing
// PATCH /admin/settings endpoint   same pattern as ChatAnalyticsPage.jsx's
// ChatbotToggleCard. Applies instantly, site-wide, to every existing post
// (BlogPostPage.jsx picks this up on next load), with no per-post edits
// and no change to content/SEO/tags/categories/URLs. Reversible any time.
function BlogThemeToggle() {
  const [theme, setTheme] = useState("classic");
  const [loadingData, setLoadingData] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings/contact")
      .then(({ data }) => {
        if (!cancelled && (data.blogTheme === "classic" || data.blogTheme === "medium")) {
          setTheme(data.blogTheme);
        }
      })
      .catch(() => toast.error("Failed to load the blog theme setting."))
      .finally(() => {
        if (!cancelled) setLoadingData(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleToggle() {
    const next = theme === "medium" ? "classic" : "medium";
    setSaving(true);
    try {
      await api.patch("/admin/settings", { blogTheme: next });
      setTheme(next);
      toast.success(
        next === "medium"
          ? "Medium-style reading theme applied site-wide."
          : "Switched back to the classic blog theme."
      );
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update the blog theme.");
    } finally {
      setSaving(false);
    }
  }

  const isMedium = theme === "medium";

  return (
    <button
      onClick={handleToggle}
      disabled={loadingData || saving}
      title={isMedium ? "Currently active   click to switch back to the classic layout" : "Switch every blog post to the Medium-inspired reading layout"}
      className={`flex-shrink-0 inline-flex items-center gap-2 text-sm font-semibold px-4 py-2.5 rounded-xl border-2 transition disabled:opacity-60 disabled:cursor-not-allowed ${
        isMedium
          ? "bg-accent border-accent text-white hover:bg-accent-dark"
          : "border-brand text-brand hover:bg-brand hover:text-white"
      }`}
    >
      <SparklesIcon />
      {saving ? "Saving…" : isMedium ? "Medium Style Active Switch Back" : "Apply Medium Style Theme"}
    </button>
  );
}

export default function BlogListPage() {
  const navigate = useNavigate();

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");

  const [deleteTarget, setDeleteTarget] = useState(null); // { id, title }
  const [deleting, setDeleting] = useState(false);

  const fetchPosts = useCallback(async () => {
    setLoading(true);
    try {
      const params = { page, limit: PAGE_LIMIT };
      if (statusFilter !== "all") params.status = statusFilter;
      const { data } = await listPosts(params);
      setPosts(Array.isArray(data.posts) ? data.posts : []);
      setTotalPages(data.totalPages || 1);
      setTotal(data.total || 0);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load posts.", { id: "blog-list-error" });
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter]);

  useEffect(() => {
    fetchPosts();
  }, [fetchPosts]);

  // Reset to page 1 whenever the status filter changes
  useEffect(() => {
    setPage(1);
  }, [statusFilter]);

  // Client-side title search over the currently-fetched page only
  const filteredPosts = search.trim()
    ? posts.filter((p) => p.title?.toLowerCase().includes(search.trim().toLowerCase()))
    : posts;

  async function handleDeleteConfirm() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deletePost(deleteTarget.id);
      toast.success(`"${deleteTarget.title}" deleted.`);
      setDeleteTarget(null);
      // If this was the last row on the page, step back a page
      if (filteredPosts.length === 1 && page > 1) {
        setPage((p) => p - 1);
      } else {
        fetchPosts();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to delete post.", { id: "blog-delete-error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">
      {/* ── Header banner ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-surface to-surface border border-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand" />
              Content
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary leading-tight mb-3">
              Blog
            </h1>
            <p className="text-txt-secondary text-sm sm:text-base max-w-xl leading-relaxed">
              {loading ? "Loading posts…" : `${total} post${total === 1 ? "" : "s"} total.`} Write
              and publish standalone articles, complete with a built-in SEO checklist.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <BlogThemeToggle />
            <button
              onClick={() => navigate("/admin/blog/new")}
              className="flex-shrink-0 inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
            >
              <PlusIcon />
              New Post
            </button>
          </div>
        </div>
      </div>

      {/* ── Filters ─────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        {/* Status tabs */}
        <div className="inline-flex items-center bg-bg border border-border rounded-xl p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={`px-3.5 py-1.5 text-sm font-medium rounded-lg transition-colors duration-150 ${
                statusFilter === tab.value
                  ? "bg-brand text-white shadow-sm"
                  : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Title search (client-side, current page only) */}
        <div className="relative max-w-xs w-full">
          <SearchIcon />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search this page by title…"
            className="w-full bg-surface border border-border text-txt-primary text-sm rounded-xl pl-9 pr-8 py-2.5 placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand"
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-txt-muted hover:text-txt-primary transition"
              aria-label="Clear search"
            >
              ✕
            </button>
          )}
        </div>
      </div>

      {/* ── Table ───────────────────────────────────────────── */}
      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg text-txt-secondary text-sm font-semibold uppercase tracking-wider">
              <th className="text-left px-4 py-3">Title</th>
              <th className="text-left px-4 py-3">Status</th>
              <th className="text-left px-4 py-3">Updated</th>
              <th className="text-left px-4 py-3">Views</th>
              <th className="text-right px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && [1, 2, 3, 4, 5].map((i) => <SkeletonRow key={i} />)}

            {!loading && filteredPosts.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-16 text-center">
                  <p className="text-4xl mb-3">📝</p>
                  <p className="text-txt-muted text-sm mb-3">
                    {search
                      ? "No posts on this page match your search."
                      : "No blog posts yet."}
                  </p>
                  {!search && (
                    <button
                      onClick={() => navigate("/admin/blog/new")}
                      className="text-brand hover:text-brand-dark text-sm underline underline-offset-2 transition"
                    >
                      Write the first post
                    </button>
                  )}
                </td>
              </tr>
            )}

            {!loading &&
              filteredPosts.map((post, idx) => (
                <tr
                  key={post._id}
                  onClick={() => navigate(`/admin/blog/${post._id}`)}
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"} hover:bg-bg transition`}
                >
                  <td className="px-4 py-3 text-txt-primary font-semibold max-w-[360px]">
                    <span className="line-clamp-1">{post.title}</span>
                    {post.excerpt && (
                      <span className="block text-xs font-normal text-txt-muted truncate mt-0.5">
                        {post.excerpt}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={post.status} />
                  </td>
                  <td className="px-4 py-3 text-txt-secondary whitespace-nowrap">
                    {formatRelativeTime(post.updatedAt)}
                  </td>
                  <td className="px-4 py-3 text-txt-primary tabular-nums">
                    {post.viewCount ?? 0}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        title="Edit"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/blog/${post._id}`);
                        }}
                        className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition"
                      >
                        <EyeIcon />
                      </button>
                      <button
                        title="Delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: post._id, title: post.title });
                        }}
                        className="p-1.5 rounded-lg text-danger hover:text-red-700 hover:bg-bg transition"
                      >
                        <TrashIcon />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination ──────────────────────────────────────── */}
      {!loading && totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <button
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
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
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            disabled={page >= totalPages}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-txt-secondary hover:text-txt-primary disabled:opacity-30 disabled:cursor-not-allowed bg-bg/50 hover:bg-bg border border-border/50 px-3 py-2 rounded-lg transition-colors duration-150"
          >
            Next
            <ChevronRightIcon />
          </button>
        </div>
      )}

      {/* ── Delete confirmation ─────────────────────────────── */}
      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        title={`Delete "${deleteTarget?.title ?? ""}"?`}
        message="This permanently deletes the post and its cover image. This can't be undone."
        confirmLabel="Delete"
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeleteTarget(null)}
        loading={deleting}
      />
    </div>
  );
}
