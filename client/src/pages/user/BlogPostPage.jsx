/**
 * src/pages/user/BlogPostPage.jsx
 *
 * Public /blog/:slug post page. Fetches GET /api/blog/posts/:slug
 * (server/controllers/blogController.js getPostPublic — published only,
 * 404s otherwise, increments viewCount server-side).
 *
 * Renders `content` via dangerouslySetInnerHTML with the exact same
 * `prose` treatment as AboutSection.jsx (Category/TestGroup blogContent) —
 * this content is admin-authored only, same trust model, no sanitizer
 * library in use elsewhere in this codebase, so none is introduced here.
 *
 * SEO: SeoHead + useSeoMeta("blog-post", { post }) builds the BlogPosting
 * + BreadcrumbList JSON-LD (see hooks/useSeoMeta.js).
 */

import { useEffect, useState, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import SeoHead from "../../components/SeoHead";
import { useSeoMeta } from "../../hooks/useSeoMeta";
import { getPostPublic, listPostsPublic } from "../../api/blog";
import { useCategories } from "../../hooks/useCategories";
import Badge from "../../components/ui/Badge";
import api from "../../api/axios";
import MediumBlogPostView from "./MediumBlogPostView";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ── Related post card (compact) ─────────────────────────────────
function RelatedPostCard({ post }) {
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
        ) : null}
      </div>
      <div className="p-4">
        <h3 className="text-sm font-bold text-txt-primary dark:text-slate-100 leading-snug group-hover:text-brand dark:group-hover:text-blue-300 transition-colors">
          {post.title}
        </h3>
        <p className="text-[11px] text-txt-muted dark:text-slate-500 font-medium mt-2">
          {formatDate(post.publishedAt)}
          {post.readTimeMinutes ? ` · ${post.readTimeMinutes} min read` : ""}
        </p>
      </div>
    </Link>
  );
}

function SkeletonPost() {
  return (
    <div className="max-w-[2000px] mx-auto px-4 md:px-8 py-10 animate-pulse space-y-4">
      <div className="h-4 bg-border dark:bg-dark-border rounded w-24" />
      <div className="h-8 bg-border dark:bg-dark-border rounded w-3/4" />
      <div className="aspect-[16/9] bg-bg dark:bg-dark-surface2 rounded-xl" />
      <div className="space-y-2">
        <div className="h-3 bg-border dark:bg-dark-border rounded w-full" />
        <div className="h-3 bg-border dark:bg-dark-border rounded w-full" />
        <div className="h-3 bg-border dark:bg-dark-border rounded w-2/3" />
      </div>
    </div>
  );
}

export default function BlogPostPage() {
  const { slug } = useParams();
  const { categories } = useCategories();

  const [post, setPost] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [relatedPosts, setRelatedPosts] = useState([]);
  const [prevPost, setPrevPost] = useState(null);
  const [nextPost, setNextPost] = useState(null);

  // Site-wide reading-theme switch (AdminSettings.blogTheme), toggled from
  // the "Apply Medium Style Theme" button on the admin Blog page. Defaults
  // to "classic" so a slow/failed fetch never blocks rendering the post.
  const [blogTheme, setBlogTheme] = useState("classic");

  const fetchPost = useCallback(() => {
    setLoading(true);
    setError(null);
    setNotFound(false);

    getPostPublic(slug)
      .then(({ data }) => setPost(data))
      .catch((err) => {
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          const msg =
            err.code === "ERR_NETWORK" || err.message === "Network Error"
              ? "Network error — check your connection."
              : "Failed to load this post. Please try again.";
          setError(msg);
        }
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => { fetchPost(); }, [fetchPost]);

  useEffect(() => {
    let cancelled = false;
    api
      .get("/settings/contact")
      .then(({ data }) => {
        if (!cancelled && (data.blogTheme === "classic" || data.blogTheme === "medium")) {
          setBlogTheme(data.blogTheme);
        }
      })
      .catch(() => {
        // Silently keep "classic" — a failed settings fetch should never
        // block a reader from seeing the article.
      });
    return () => { cancelled = true; };
  }, []);

  // ── Related posts: 2-3 published posts sharing at least one tag,
  // falling back to most recent posts if there's no tag overlap.
  // Done client-side against a small recent batch rather than a dedicated
  // backend query — cheap enough at blog-sized volumes.
  useEffect(() => {
    if (!post) return;

    // limit bumped from 20 -> 50 so this same fetch (sorted by publishedAt
    // desc, same as the public listing) can also supply prev/next
    // navigation, not just related posts   still cheap at blog-sized
    // volumes per the original design note above.
    listPostsPublic({ limit: 50 })
      .then(({ data }) => {
        const allPosts = Array.isArray(data.posts) ? data.posts : [];
        const candidates = allPosts.filter((p) => p.slug !== post.slug);

        const tagSet = new Set(post.tags || []);
        const withOverlap = candidates.filter((p) =>
          (p.tags || []).some((t) => tagSet.has(t))
        );

        const chosen = (withOverlap.length > 0 ? withOverlap : candidates).slice(0, 3);
        setRelatedPosts(chosen);

        // Prev/next by publish recency (list is sorted publishedAt desc):
        // "prev" (newer) is the post right before this one, "next" (older)
        // is right after. Falls back to nothing (nav hidden) if this post
        // isn't in the fetched window   acceptable for very old posts.
        const idx = allPosts.findIndex((p) => p.slug === post.slug);
        setPrevPost(idx > 0 ? allPosts[idx - 1] : null);
        setNextPost(idx >= 0 && idx < allPosts.length - 1 ? allPosts[idx + 1] : null);
      })
      .catch(() => {
        setRelatedPosts([]);
        setPrevPost(null);
        setNextPost(null);
      });
  }, [post]);

  const { title, description, jsonLd, url } = useSeoMeta("blog-post", { post: post || {} });

  const relatedCategory = post?.relatedCategorySlug
    ? categories.find((c) => c.slug === post.relatedCategorySlug)
    : null;

  if (loading) {
    return <SkeletonPost />;
  }

  if (notFound) {
    return (
      <div className="max-w-[2000px] mx-auto px-4 md:px-8 py-16 text-center">
        <h1 className="text-2xl font-bold text-txt-primary dark:text-slate-100 mb-2">
          Post not found
        </h1>
        <p className="text-txt-secondary dark:text-slate-300 text-sm mb-6">
          This post doesn't exist or is no longer published.
        </p>
        <Link
          to="/blog"
          className="inline-flex items-center text-xs font-bold bg-brand dark:bg-blue-500 hover:bg-brand-dark dark:hover:bg-blue-600 text-white px-4 py-2 rounded-lg transition"
        >
          Back to Blog
        </Link>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-[2000px] mx-auto px-4 md:px-8 py-16 text-center">
        <p className="text-sm font-semibold text-danger dark:text-red-300 mb-4">{error}</p>
        <button
          onClick={fetchPost}
          className="text-xs font-bold bg-danger hover:bg-red-700 text-white px-4 py-2 rounded-lg transition"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!post) return null;

  // Medium-style reading theme   site-wide switch (AdminSettings.blogTheme).
  // SeoHead is rendered here, once, regardless of theme, so switching
  // themes never changes SEO metadata, JSON-LD, canonical URL, or anything
  // else about the page beyond its visual layout.
  if (blogTheme === "medium") {
    return (
      <>
        <SeoHead title={title} description={description} url={url} ogType="article" jsonLd={jsonLd} />
        <MediumBlogPostView
          post={post}
          relatedPosts={relatedPosts}
          relatedCategory={relatedCategory}
          prevPost={prevPost}
          nextPost={nextPost}
          shareUrl={url}
        />
      </>
    );
  }

  return (
    <div className="max-w-[2000px] mx-auto px-4 md:px-8 py-10">
      <SeoHead
        title={title}
        description={description}
        url={url}
        ogType="article"
        jsonLd={jsonLd}
      />

      {/* Breadcrumb-ish back link */}
      <Link
        to="/blog"
        className="text-xs font-semibold text-brand dark:text-blue-400 hover:underline mb-4 inline-block"
      >
        ← Back to Blog
      </Link>

      {/* Tags */}
      {post.tags?.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {post.tags.map((tag) => (
            <Badge key={tag} variant="info">{tag}</Badge>
          ))}
        </div>
      )}

      {/* Title + meta */}
      <h1 className="text-2xl md:text-3xl font-bold text-txt-primary dark:text-slate-100 leading-tight mb-3">
        {post.title}
      </h1>
      <div className="flex items-center gap-2 text-xs text-txt-muted dark:text-slate-500 font-medium mb-6">
        <span>{formatDate(post.publishedAt)}</span>
        {post.readTimeMinutes ? (
          <>
            <span aria-hidden="true">·</span>
            <span>{post.readTimeMinutes} min read</span>
          </>
        ) : null}
      </div>

      {/* Cover image */}
      {post.coverImageUrl && (
        <div className="aspect-[16/9] rounded-xl overflow-hidden mb-8 bg-bg dark:bg-dark-surface2">
          <img src={post.coverImageUrl} alt={post.title} className="w-full h-full object-cover" />
        </div>
      )}

      {/* Content — admin-authored HTML, same trust model as AboutSection.jsx */}
      <div
        className="prose prose-sm md:prose-base dark:prose-invert max-w-none"
        dangerouslySetInnerHTML={{ __html: post.content }}
      />

      {/* Related category CTA — the internal-link + conversion mechanism */}
      {relatedCategory && (
        <div className="mt-10 bg-brand-dark text-white rounded-2xl p-6 text-center">
          <p className="font-bold text-base mb-1">Ready to practice?</p>
          <p className="text-blue-200 text-sm mb-4">
            Try {relatedCategory.name} mock tests and put what you just read into practice.
          </p>
          <Link
            to={`/category/${relatedCategory.slug}`}
            className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white font-bold text-sm px-6 py-2.5 rounded-full transition"
          >
            Try {relatedCategory.name} mock tests →
          </Link>
        </div>
      )}

      {/* Related posts */}
      {relatedPosts.length > 0 && (
        <div className="mt-12 pt-8 border-t border-border dark:border-dark-border">
          <h2 className="text-lg font-bold text-txt-primary dark:text-slate-100 mb-4">
            Related Posts
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {relatedPosts.map((rp) => (
              <RelatedPostCard key={rp.slug} post={rp} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}