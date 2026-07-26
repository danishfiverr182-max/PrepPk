/**
 * src/pages/user/BlogListPage.jsx
 *
 * Public /blog listing page — grid of published post cards, paginated,
 * with an optional single-tag filter. Pulls from GET /api/blog/posts
 * (server/controllers/blogController.js listPostsPublic), which only ever
 * returns status: "published" posts.
 *
 * Styled to match the rest of the public site (CategoryPage.jsx /
 * FreeMockTestsPage.jsx design tokens: bg-surface, border-border,
 * txt-primary/secondary/muted, dark: variants throughout).
 */

import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import SeoHead from "../../components/SeoHead";
import { useSeoMeta } from "../../hooks/useSeoMeta";
import { listPostsPublic } from "../../api/blog";
import Badge from "../../components/ui/Badge";

const PAGE_LIMIT = 12;

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Post card ─────────────────────────────────────────────────
function PostCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-sm hover:shadow-md hover:border-brand-light dark:hover:border-dark-border transition-all overflow-hidden flex flex-col"
    >
      <div className="aspect-[16/9] bg-bg dark:bg-dark-surface2 overflow-hidden">
        {post.coverImageUrl ? (
          <img
            src={post.coverImageUrl}
            alt={post.title}
            loading="lazy"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-txt-muted dark:text-slate-500 text-xs">
            No image
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2.5">
            {post.tags.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="info">{tag}</Badge>
            ))}
          </div>
        )}

        <h2 className="text-sm font-bold text-txt-primary dark:text-slate-100 leading-snug mb-2 group-hover:text-brand dark:group-hover:text-blue-300 transition-colors">
          {post.title}
        </h2>

        {post.excerpt && (
          <p className="text-xs text-txt-secondary dark:text-slate-400 leading-relaxed mb-3 line-clamp-3">
            {post.excerpt}
          </p>
        )}

        <div className="mt-auto pt-2 flex items-center gap-2 text-[11px] text-txt-muted dark:text-slate-500 font-medium">
          <span>{formatDate(post.publishedAt)}</span>
          {post.readTimeMinutes ? (
            <>
              <span aria-hidden="true">·</span>
              <span>{post.readTimeMinutes} min read</span>
            </>
          ) : null}
        </div>
      </div>
    </Link>
  );
}

function SkeletonCard() {
  return (
    <div className="bg-surface dark:bg-dark-surface rounded-xl border border-border dark:border-dark-border shadow-sm overflow-hidden animate-pulse">
      <div className="aspect-[16/9] bg-bg dark:bg-dark-surface2" />
      <div className="p-5 space-y-2.5">
        <div className="h-4 bg-border dark:bg-dark-border rounded w-3/4" />
        <div className="h-3 bg-border dark:bg-dark-border rounded w-full" />
        <div className="h-3 bg-border dark:bg-dark-border rounded w-2/3" />
      </div>
    </div>
  );
}

export default function BlogListPage() {
  const { title, description, jsonLd } = useSeoMeta("blog");

  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [activeTag, setActiveTag] = useState(null);

  const fetchPosts = useCallback(() => {
    setLoading(true);
    setError(null);

    const params = { page, limit: PAGE_LIMIT };
    if (activeTag) params.tag = activeTag;

    listPostsPublic(params)
      .then(({ data }) => {
        setPosts(Array.isArray(data.posts) ? data.posts : []);
        setTotalPages(data.totalPages || 1);
      })
      .catch((err) => {
        const msg =
          err.code === "ERR_NETWORK" || err.message === "Network Error"
            ? "Network error — check your connection."
            : "Failed to load posts. Please try again.";
        setError(msg);
      })
      .finally(() => setLoading(false));
  }, [page, activeTag]);

  useEffect(() => { fetchPosts(); }, [fetchPosts]);

  // Reset to page 1 whenever the tag filter changes
  useEffect(() => { setPage(1); }, [activeTag]);

  // Tags shown as filter chips — collected from whatever posts are
  // currently loaded (simple, no dedicated tags endpoint needed).
  const availableTags = Array.from(
    new Set(posts.flatMap((p) => p.tags || []))
  ).slice(0, 10);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-8 py-10">
      <SeoHead title={title} description={description} jsonLd={jsonLd} />

      <div className="mb-8">
        <p className="text-xs text-brand dark:text-blue-400 font-semibold uppercase tracking-widest mb-1">
          PrepPK Blog
        </p>
        <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100">
          Tips &amp; Guides
        </h1>
        <p className="text-txt-secondary dark:text-slate-300 text-sm mt-1">
          Articles to help you prepare for Pakistan Army, Navy, and Air Force initial tests.
        </p>
      </div>

      {/* Optional tag filter */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
              !activeTag
                ? "bg-brand text-white border-brand"
                : "bg-surface dark:bg-dark-surface text-txt-secondary dark:text-slate-300 border-border dark:border-dark-border hover:border-brand-light"
            }`}
          >
            All
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setActiveTag(tag)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition ${
                activeTag === tag
                  ? "bg-brand text-white border-brand"
                  : "bg-surface dark:bg-dark-surface text-txt-secondary dark:text-slate-300 border-border dark:border-dark-border hover:border-brand-light"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="bg-danger-light dark:bg-red-900/30 border border-danger/30 dark:border-red-700/30 rounded-xl p-6 text-center">
          <p className="text-sm font-semibold text-danger dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={fetchPosts}
            className="text-xs font-bold bg-danger hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
          >
            Try Again
          </button>
        </div>
      ) : posts.length === 0 ? (
        <div className="bg-bg dark:bg-dark-surface border border-border dark:border-dark-border rounded-xl p-10 text-center text-txt-secondary dark:text-slate-300 text-sm">
          No posts yet — check back soon.
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {posts.map((post) => <PostCard key={post.slug} post={post} />)}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-10">
              <button
                onClick={() => setPage((p) => Math.max(p - 1, 1))}
                disabled={page <= 1}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border dark:border-dark-border text-txt-secondary dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-light transition"
              >
                Previous
              </button>
              <span className="text-xs text-txt-muted dark:text-slate-500 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
                disabled={page >= totalPages}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-border dark:border-dark-border text-txt-secondary dark:text-slate-300 disabled:opacity-40 disabled:cursor-not-allowed hover:border-brand-light transition"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
