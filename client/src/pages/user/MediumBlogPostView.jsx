/**
 * src/pages/user/MediumBlogPostView.jsx
 *
 * Medium-inspired, distraction-free reading layout for a single blog post.
 * Pure presentation component — BlogPostPage.jsx owns all data fetching
 * (post, related posts, prev/next, SEO) and simply chooses this view
 * instead of the classic one when the site-wide `blogTheme` setting
 * (AdminSettings.blogTheme, toggled from the admin Blog page) is "medium".
 *
 * Nothing here touches routing, the API, or SEO tags — it only renders
 * whatever `post` (and friends) it's handed, so switching themes never
 * changes URLs, content, SEO metadata, tags, or categories; it only
 * changes how the same data is displayed.
 *
 * Props:
 *   post           full BlogPost document (title, content, coverImageUrl,
 *                  tags, category, authorName, authorAvatarUrl, authorBio,
 *                  publishedAt, readTimeMinutes, slug, updatedAt)
 *   relatedPosts   array of { slug, title, coverImageUrl, publishedAt, readTimeMinutes }
 *   relatedCategory  optional { name, slug } soft-linked exam category (CTA block)
 *   prevPost       optional { slug, title } — newer post
 *   nextPost       optional { slug, title } — older post
 *   shareUrl       canonical URL for this post, used by the share buttons
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";

function formatDate(dateStr) {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleDateString("en-PK", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function initialsFrom(name) {
  if (!name) return "PK";
  const parts = name.trim().split(/\s+/);
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// ── Icons (inline, no external icon library needed) ────────────
function XIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}
function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M22 12a10 10 0 10-11.56 9.88v-6.99H7.9V12h2.54V9.8c0-2.5 1.49-3.89 3.77-3.89 1.1 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.77-1.63 1.56V12h2.78l-.44 2.89h-2.34v6.99A10 10 0 0022 12z" />
    </svg>
  );
}
function LinkedInIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.02-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.36V9h3.41v1.56h.05c.47-.9 1.63-1.85 3.36-1.85 3.6 0 4.27 2.37 4.27 5.45zM5.34 7.43a2.06 2.06 0 110-4.12 2.06 2.06 0 010 4.12zM7.12 20.45H3.56V9h3.56z" />
    </svg>
  );
}
function WhatsAppIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
      <path d="M12.04 2c-5.5 0-9.96 4.46-9.96 9.96 0 1.76.46 3.42 1.26 4.86L2 22l5.34-1.3a9.9 9.9 0 004.7 1.2h.01c5.5 0 9.96-4.46 9.96-9.96C22 6.46 17.55 2 12.04 2zm5.8 14.2c-.24.68-1.4 1.3-1.93 1.36-.5.06-1.13.08-1.83-.12-.42-.12-.96-.3-1.66-.6-2.92-1.26-4.83-4.2-4.98-4.4-.14-.2-1.2-1.6-1.2-3.06s.76-2.17 1.03-2.47c.27-.3.6-.36.8-.36.2 0 .4 0 .57.01.18.01.43-.07.67.51.24.6.83 2.06.9 2.2.07.15.12.32.02.52-.1.2-.15.32-.3.5-.15.18-.3.4-.44.53-.15.15-.3.31-.13.6.17.3.76 1.26 1.64 2.04 1.13 1 2.08 1.32 2.38 1.47.3.15.47.13.65-.08.18-.2.75-.87.95-1.17.2-.3.4-.25.67-.15.27.1 1.72.81 2.02.96.3.15.5.22.57.35.08.13.08.75-.16 1.43z" />
    </svg>
  );
}
function LinkIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757M10.81 15.312a4.5 4.5 0 01-1.242-7.244l4.5-4.5a4.5 4.5 0 016.364 6.364l-1.757 1.757" />
    </svg>
  );
}
function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth={2} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2" />
      <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Sticky reading-progress bar ─────────────────────────────────
function ReadingProgressBar({ articleRef }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let ticking = false;

    function computeProgress() {
      ticking = false;
      const el = articleRef.current;
      if (!el) return;

      const rect = el.getBoundingClientRect();
      const articleTop = rect.top + window.scrollY;
      const articleHeight = rect.height;
      const viewportHeight = window.innerHeight;

      const scrolled = window.scrollY - articleTop + viewportHeight * 0.15;
      const total = Math.max(articleHeight - viewportHeight * 0.15, 1);
      const pct = Math.min(Math.max((scrolled / total) * 100, 0), 100);
      setProgress(pct);
    }

    function onScroll() {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(computeProgress);
      }
    }

    computeProgress();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [articleRef]);

  return (
    <div
      className="fixed top-0 left-0 w-full h-[3px] bg-border/40 dark:bg-dark-border/40 z-50"
      role="progressbar"
      aria-label="Reading progress"
      aria-valuenow={Math.round(progress)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full bg-gradient-to-r from-brand to-accent"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

// ── Share buttons ────────────────────────────────────────────────
function ShareBar({ title, url }) {
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copied to clipboard.");
    } catch {
      toast.error("Couldn't copy the link.");
    }
  }

  const encodedUrl = encodeURIComponent(url || "");
  const encodedTitle = encodeURIComponent(title || "");

  const links = [
    {
      label: "Share on X",
      href: `https://twitter.com/intent/tweet?url=${encodedUrl}&text=${encodedTitle}`,
      icon: <XIcon />,
    },
    {
      label: "Share on Facebook",
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
      icon: <FacebookIcon />,
    },
    {
      label: "Share on LinkedIn",
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`,
      icon: <LinkedInIcon />,
    },
    {
      label: "Share on WhatsApp",
      href: `https://wa.me/?text=${encodedTitle}%20${encodedUrl}`,
      icon: <WhatsAppIcon />,
    },
  ];

  return (
    <div className="flex items-center gap-2" role="group" aria-label="Share this article">
      {links.map((l) => (
        <a
          key={l.label}
          href={l.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={l.label}
          title={l.label}
          className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-border dark:border-dark-border text-txt-secondary dark:text-slate-400 hover:text-brand hover:border-brand hover:-translate-y-0.5 transition-all duration-200"
        >
          {l.icon}
        </a>
      ))}
      <button
        onClick={copyLink}
        aria-label="Copy link"
        title="Copy link"
        className="w-9 h-9 inline-flex items-center justify-center rounded-full border border-border dark:border-dark-border text-txt-secondary dark:text-slate-400 hover:text-brand hover:border-brand hover:-translate-y-0.5 transition-all duration-200"
      >
        <LinkIcon />
      </button>
    </div>
  );
}

// ── Compact related-post card ────────────────────────────────────
function RelatedCard({ post }) {
  return (
    <Link
      to={`/blog/${post.slug}`}
      className="group flex flex-col rounded-2xl overflow-hidden border border-border dark:border-dark-border bg-surface dark:bg-dark-surface hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
    >
      <div className="aspect-[16/10] bg-bg dark:bg-dark-surface2 overflow-hidden">
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
        <h3 className="text-sm font-bold font-heading text-txt-primary dark:text-slate-100 leading-snug group-hover:text-brand dark:group-hover:text-blue-300 transition-colors">
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

export default function MediumBlogPostView({
  post,
  relatedPosts = [],
  relatedCategory = null,
  prevPost = null,
  nextPost = null,
  shareUrl = "",
}) {
  const articleRef = useRef(null);
  const authorInitials = useMemo(() => initialsFrom(post.authorName), [post.authorName]);
  const authorName = post.authorName || "PrepPk Editorial Team";
  const authorBio =
    post.authorBio ||
    "Writes exam-prep guides and study strategies for Pakistan Army, Navy, and Air Force aspirants.";

  return (
    <div className="bg-white dark:bg-dark-bg">
      <ReadingProgressBar articleRef={articleRef} />

      <article
        ref={articleRef}
        className="max-w-[1600px] mx-auto px-5 sm:px-6 py-10 sm:py-14"
      >
        {/* ── Back link ──────────────────────────────────────── */}
        <Link
          to="/blog"
          className="text-xs font-semibold text-brand dark:text-blue-400 hover:underline mb-6 inline-block"
        >
          ← Back to Blog
        </Link>

        {/* ── Header: category, title, byline ─────────────────── */}
        <header className="mb-8">
          {post.category && (
            <span className="inline-block text-xs font-bold uppercase tracking-widest text-brand dark:text-blue-400 mb-4">
              {post.category}
            </span>
          )}

          <h1 className="font-heading text-3xl sm:text-4xl md:text-[2.75rem] font-extrabold leading-[1.15] text-txt-primary dark:text-slate-100 mb-6">
            {post.title}
          </h1>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-full bg-brand/10 dark:bg-blue-900/30 text-brand dark:text-blue-300 flex items-center justify-center font-bold text-sm overflow-hidden flex-shrink-0">
                {post.authorAvatarUrl ? (
                  <img src={post.authorAvatarUrl} alt={authorName} className="w-full h-full object-cover" />
                ) : (
                  authorInitials
                )}
              </div>
              <div className="leading-tight">
                <p className="text-sm font-semibold text-txt-primary dark:text-slate-100">{authorName}</p>
                <p className="text-xs text-txt-muted dark:text-slate-500 flex items-center gap-1.5 mt-0.5">
                  <time dateTime={post.publishedAt || undefined}>{formatDate(post.publishedAt)}</time>
                  {post.readTimeMinutes ? (
                    <>
                      <span aria-hidden="true">·</span>
                      <ClockIcon />
                      {post.readTimeMinutes} min read
                    </>
                  ) : null}
                </p>
              </div>
            </div>

            <ShareBar title={post.title} url={shareUrl} />
          </div>
        </header>

        {/* ── Featured image ───────────────────────────────────── */}
        {post.coverImageUrl && (
          <div className="max-w-[800px] mx-auto aspect-[16/9] rounded-2xl overflow-hidden mb-10 bg-bg dark:bg-dark-surface2">
            <img
              src={post.coverImageUrl}
              alt={post.title}
              loading="eager"
              fetchPriority="high"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* ── Article content ──────────────────────────────────── */}
        <div
          className="
            prose prose-lg dark:prose-invert max-w-none
            prose-headings:font-heading prose-headings:font-bold prose-headings:text-txt-primary dark:prose-headings:text-slate-100
            prose-p:font-serif prose-p:text-[1.15rem] prose-p:leading-[1.9] prose-p:text-txt-secondary dark:prose-p:text-slate-300
            prose-a:text-brand dark:prose-a:text-blue-400 prose-a:font-semibold prose-a:no-underline hover:prose-a:underline
            prose-strong:text-txt-primary dark:prose-strong:text-slate-100
            prose-blockquote:font-serif prose-blockquote:not-italic prose-blockquote:border-l-4 prose-blockquote:border-brand prose-blockquote:bg-brand/5 dark:prose-blockquote:bg-blue-900/10 prose-blockquote:rounded-r-xl prose-blockquote:py-1 prose-blockquote:px-6 prose-blockquote:text-txt-primary dark:prose-blockquote:text-slate-200
            prose-code:text-brand dark:prose-code:text-blue-300 prose-code:bg-brand/10 dark:prose-code:bg-blue-900/20 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none
            prose-pre:bg-[#0d1117] prose-pre:rounded-xl prose-pre:shadow-md
            prose-img:rounded-2xl prose-img:shadow-md
            prose-table:text-sm prose-th:bg-bg dark:prose-th:bg-dark-surface2 prose-td:border prose-td:border-border dark:prose-td:border-dark-border prose-th:border prose-th:border-border dark:prose-th:border-dark-border
            prose-li:font-serif prose-li:text-[1.05rem] prose-li:leading-8 prose-li:text-txt-secondary dark:prose-li:text-slate-300
          "
          dangerouslySetInnerHTML={{ __html: post.content }}
        />

        {/* ── Tags ─────────────────────────────────────────────── */}
        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-10 pt-6 border-t border-border dark:border-dark-border">
            {post.tags.map((tag) => (
              <span
                key={tag}
                className="text-xs font-medium bg-bg dark:bg-dark-surface2 text-txt-secondary dark:text-slate-400 border border-border dark:border-dark-border px-3 py-1 rounded-full"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* ── Related category CTA ────────────────────────────── */}
        {relatedCategory && (
          <div className="mt-10 bg-brand-dark text-white rounded-2xl p-6 text-center">
            <p className="font-bold text-base mb-1">Ready to practice?</p>
            <p className="text-blue-200 text-sm mb-4">
              Try {relatedCategory.name} mock tests and put what you just read into practice.
            </p>
            <Link
              to={`/category/${relatedCategory.slug}`}
              className="inline-flex items-center gap-1.5 bg-accent hover:bg-accent-dark text-white font-bold text-sm px-6 py-2.5 rounded-full transition-all duration-200 hover:-translate-y-0.5"
            >
              Try {relatedCategory.name} mock tests →
            </Link>
          </div>
        )}

        {/* ── Author bio ───────────────────────────────────────── */}
        <div className="mt-12 pt-8 border-t border-border dark:border-dark-border flex items-start gap-4">
          <div className="w-14 h-14 rounded-full bg-brand/10 dark:bg-blue-900/30 text-brand dark:text-blue-300 flex items-center justify-center font-bold overflow-hidden flex-shrink-0">
            {post.authorAvatarUrl ? (
              <img src={post.authorAvatarUrl} alt={authorName} className="w-full h-full object-cover" />
            ) : (
              authorInitials
            )}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-txt-muted dark:text-slate-500 mb-1">
              Written by
            </p>
            <p className="text-base font-bold text-txt-primary dark:text-slate-100">{authorName}</p>
            <p className="text-sm text-txt-secondary dark:text-slate-400 mt-1 leading-relaxed max-w-lg">
              {authorBio}
            </p>
          </div>
        </div>

        {/* ── Prev / Next navigation ──────────────────────────── */}
        {(prevPost || nextPost) && (
          <nav
            aria-label="Post navigation"
            className="mt-10 grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            {prevPost ? (
              <Link
                to={`/blog/${prevPost.slug}`}
                className="group rounded-2xl border border-border dark:border-dark-border p-5 hover:border-brand dark:hover:border-blue-500 hover:-translate-y-0.5 transition-all duration-200"
              >
                <p className="text-xs font-semibold text-txt-muted dark:text-slate-500 mb-1">← Newer</p>
                <p className="text-sm font-bold text-txt-primary dark:text-slate-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-blue-300 transition-colors">
                  {prevPost.title}
                </p>
              </Link>
            ) : <div />}

            {nextPost && (
              <Link
                to={`/blog/${nextPost.slug}`}
                className="group rounded-2xl border border-border dark:border-dark-border p-5 text-right hover:border-brand dark:hover:border-blue-500 hover:-translate-y-0.5 transition-all duration-200"
              >
                <p className="text-xs font-semibold text-txt-muted dark:text-slate-500 mb-1">Older →</p>
                <p className="text-sm font-bold text-txt-primary dark:text-slate-100 line-clamp-2 group-hover:text-brand dark:group-hover:text-blue-300 transition-colors">
                  {nextPost.title}
                </p>
              </Link>
            )}
          </nav>
        )}

        {/* ── Related posts ────────────────────────────────────── */}
        {relatedPosts.length > 0 && (
          <div className="mt-14 pt-8 border-t border-border dark:border-dark-border">
            <h2 className="text-lg font-bold font-heading text-txt-primary dark:text-slate-100 mb-5">
              More to read
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {relatedPosts.map((rp) => (
                <RelatedCard key={rp.slug} post={rp} />
              ))}
            </div>
          </div>
        )}
      </article>
    </div>
  );
}