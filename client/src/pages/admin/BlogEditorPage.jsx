/**
 * src/pages/admin/BlogEditorPage.jsx  (Prompt 4 — Blog Admin UI)
 *
 * Create/edit form for a single blog post — handles both flows based on
 * whether :postId is present in the route. Reuses the image-upload-and-
 * insert-at-cursor textarea helper and the SEO character-counter styling
 * originally built in CategoryPage.jsx (Prompt 2), plus general admin
 * page layout/card styling from the same file.
 *
 * Built-in SEO Assistant: a lightweight, entirely client-side checklist
 * (no external API) that recomputes on every keystroke via useMemo. This
 * is guidance only — it never blocks Save Draft / Publish.
 *
 * Slug behavior mirrors the backend (controllers/blogController.js):
 * on create, the server always derives the slug from the title, so the
 * slug field here is a live preview only until the post exists. Once
 * editing an existing post, the field stops auto-syncing with the title
 * (same "title edits don't silently change slug" rule the backend
 * enforces), and can be changed explicitly via the Edit toggle.
 *
 * --- Dark/light mode fix (this revision) ---
 * Every text color in this file now falls into one of two buckets:
 *   1. Design-system tokens (text-txt-primary/secondary/muted, bg-surface,
 *      bg-bg, border-border) — these are assumed to be CSS variables that
 *      flip automatically with the `.dark` class, so they're left alone
 *      and used consistently everywhere.
 *   2. Anything using a raw Tailwind palette color (amber, red, cyan,
 *      slate, success/danger utility classes that are NOT confirmed to be
 *      variable-based) now gets an explicit `dark:` counterpart so it
 *      can never render invisible-on-background in either mode. No text
 *      node relies on an implicit/default color that only works in one
 *      theme.
 */

import { useState, useEffect, useRef, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import {
  getPost,
  createPost,
  updatePost,
  uploadCoverImage,
  uploadContentImage,
} from "../../api/blog";
import { useCategories } from "../../hooks/useCategories";
import { generateSlug } from "../../utils/slugify";
import SeoCharCounter, {
  SEO_TITLE_MIN,
  SEO_TITLE_SOFT_LIMIT,
  SEO_TITLE_HARD_LIMIT,
  SEO_DESC_MIN,
  SEO_DESC_SOFT_LIMIT,
  SEO_DESC_HARD_LIMIT,
} from "../../components/admin/SeoCharCounter";

// ── Icons ─────────────────────────────────────────────────────
// NOTE: every icon now carries an explicit dark: variant in its default
// className so callers that don't override className still render
// correctly in both themes.
function ChevronRightIcon() {
  return (
    <svg
      className="w-3.5 h-3.5 text-txt-muted"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}

function CheckCircleIcon({
  className = "w-4 h-4 text-emerald-600 dark:text-emerald-400",
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}

function WarningIcon({
  className = "w-4 h-4 text-amber-600 dark:text-amber-400",
}) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
      />
    </svg>
  );
}

function CircleIcon({ className = "w-4 h-4 text-txt-muted" }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      strokeWidth={2}
    >
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}

// ── Word/HTML helpers for the SEO Assistant ─────────────────────
function stripHtml(html) {
  return (html || "").replace(/<[^>]*>/g, " ");
}

function getWords(html) {
  return stripHtml(html).trim().split(/\s+/).filter(Boolean);
}

function truncateVisual(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max - 1).trimEnd() + "…";
}

// ── Page skeleton (loading an existing post) ────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6 animate-pulse">
      <div className="h-3 w-40 bg-bg rounded" />
      <div className="h-8 w-64 bg-bg rounded" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-surface/60 border border-border rounded-2xl h-96" />
        <div className="bg-surface/60 border border-border rounded-2xl h-96" />
      </div>
    </div>
  );
}

export default function BlogEditorPage() {
  const { postId } = useParams();
  const navigate = useNavigate();
  const isEditing = Boolean(postId);

  const { categories } = useCategories();

  // ── Core fields ────────────────────────────────────────────
  const [loading, setLoading] = useState(isEditing);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugAutoSync, setSlugAutoSync] = useState(true); // true until manually edited
  const [slugEditMode, setSlugEditMode] = useState(false);
  const [excerpt, setExcerpt] = useState("");
  const [content, setContent] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("");
  const [coverImagePublicId, setCoverImagePublicId] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [relatedCategorySlug, setRelatedCategorySlug] = useState("");
  const [category, setCategory] = useState("");
  const [authorName, setAuthorName] = useState("");
  const [authorAvatarUrl, setAuthorAvatarUrl] = useState("");
  const [authorBio, setAuthorBio] = useState("");
  const [status, setStatus] = useState("draft");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [wasEverPublished, setWasEverPublished] = useState(false);

  // ── SEO Assistant (client-only, not persisted) ──────────────
  const [focusKeyword, setFocusKeyword] = useState("");

  // ── Upload/save state ────────────────────────────────────────
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingContentImage, setUploadingContentImage] = useState(false);
  const [saving, setSaving] = useState(null); // null | "draft" | "published"

  const contentTextareaRef = useRef(null);
  const coverInputRef = useRef(null);
  const contentImageInputRef = useRef(null);

  // ── Load existing post ───────────────────────────────────────
  useEffect(() => {
    if (!isEditing) return;
    let cancelled = false;

    setLoading(true);
    getPost(postId)
      .then(({ data: post }) => {
        if (cancelled) return;
        setTitle(post.title || "");
        setSlug(post.slug || "");
        setSlugAutoSync(false); // existing slug — don't silently resync from title edits
        setExcerpt(post.excerpt || "");
        setContent(post.content || "");
        setCoverImageUrl(post.coverImageUrl || "");
        setCoverImagePublicId(post.coverImagePublicId || "");
        setTagsInput(Array.isArray(post.tags) ? post.tags.join(", ") : "");
        setRelatedCategorySlug(post.relatedCategorySlug || "");
        setCategory(post.category || "");
        setAuthorName(post.authorName || "");
        setAuthorAvatarUrl(post.authorAvatarUrl || "");
        setAuthorBio(post.authorBio || "");
        setStatus(post.status || "draft");
        setSeoTitle(post.seoTitle || "");
        setSeoDescription(post.seoDescription || "");
        setWasEverPublished(Boolean(post.publishedAt));
      })
      .catch((err) => {
        if (cancelled) return;
        toast.error(err.response?.data?.message || "Failed to load post.", {
          id: "blog-load-error",
        });
        navigate("/admin/blog");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [postId, isEditing, navigate]);

  // ── Live slug preview from title ────────────────────────────
  useEffect(() => {
    if (slugAutoSync) setSlug(generateSlug(title));
  }, [title, slugAutoSync]);

  // ── Cover image upload (single slot, not inline content) ────
  async function handleCoverSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingCover(true);
    try {
      const { data } = await uploadCoverImage(file);
      setCoverImageUrl(data.url);
      setCoverImagePublicId(data.publicId);
      toast.success("Cover image uploaded.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cover upload failed.");
    } finally {
      setUploadingCover(false);
    }
  }

  // ── Content image upload → insert <img> at cursor ───────────
  // Same pattern as CategoryPage.jsx's handleImageSelected, pointed at
  // the blog's upload-content-image endpoint.
  async function handleContentImageSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingContentImage(true);
    try {
      const { data } = await uploadContentImage(file);
      const imgTag = `<img src="${data.url}" alt="" />`;
      const textarea = contentTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? content.length;
        const end = textarea.selectionEnd ?? content.length;
        const next = content.slice(0, start) + imgTag + content.slice(end);
        setContent(next);
        requestAnimationFrame(() => {
          textarea.focus();
          const cursor = start + imgTag.length;
          textarea.setSelectionRange(cursor, cursor);
        });
      } else {
        setContent((prev) => prev + imgTag);
      }
      toast.success("Image uploaded and inserted.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Image upload failed.");
    } finally {
      setUploadingContentImage(false);
    }
  }

  // ── Save (Save Draft / Publish) ─────────────────────────────
  async function handleSave(targetStatus) {
    if (!title.trim()) {
      toast.error("Title is required.");
      return;
    }

    setSaving(targetStatus);
    try {
      const payload = {
        title: title.trim(),
        excerpt,
        content,
        coverImageUrl,
        coverImagePublicId,
        seoTitle,
        seoDescription,
        tags: tagsInput
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        relatedCategorySlug: relatedCategorySlug || null,
        category,
        authorName,
        authorAvatarUrl,
        authorBio,
        status: targetStatus,
      };

      if (isEditing) {
        // Only meaningful once the post exists — the server ignores any
        // `slug` sent on create and always derives it from the title.
        payload.slug = slug.trim();
        const { data: post } = await updatePost(postId, payload);
        setStatus(post.status);
        setWasEverPublished(Boolean(post.publishedAt));
        toast.success(
          targetStatus === "published" ? "Post published." : "Draft saved.",
        );
      } else {
        const { data: post } = await createPost(payload);
        toast.success(
          targetStatus === "published" ? "Post published." : "Draft created.",
        );
        navigate(`/admin/blog/${post._id}`, { replace: true });
      }
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save post. Please try again.",
      );
    } finally {
      setSaving(null);
    }
  }

  // ── SEO Assistant checklist (recomputed every keystroke) ────
  const seoChecks = useMemo(() => {
    const kw = focusKeyword.trim().toLowerCase();
    const hasKeyword = kw.length > 0;
    const includesKw = (text) =>
      hasKeyword && (text || "").toLowerCase().includes(kw);

    const words = getWords(content);
    const wordCount = words.length;
    const first100 = words.slice(0, 100).join(" ");

    const hasImage = /<img[\s>]/i.test(content);
    const hasInternalLink =
      /<a\s+href/i.test(content) || Boolean(relatedCategorySlug);

    return [
      {
        id: "kw-title",
        label: "Focus keyword appears in the Title",
        passed: includesKw(title),
        neutral: !hasKeyword,
      },
      {
        id: "kw-slug",
        label: "Focus keyword appears in the Slug",
        passed: includesKw(slug.replace(/-/g, " ")),
        neutral: !hasKeyword,
      },
      {
        id: "kw-seo-desc",
        label: "Focus keyword appears in the SEO Description",
        passed: includesKw(seoDescription),
        neutral: !hasKeyword,
      },
      {
        id: "kw-first100",
        label: "Focus keyword appears in the first ~100 words of Content",
        passed: includesKw(first100),
        neutral: !hasKeyword,
      },
      {
        id: "word-count",
        label: `Content word count ≥ 300 words (currently ${wordCount})`,
        passed: wordCount >= 300,
        note:
          wordCount < 300
            ? "Short content tends to rank poorly for competitive keywords"
            : null,
      },
      {
        id: "seo-title-len",
        label: "SEO Title length between 30–60 characters",
        passed:
          seoTitle.length >= SEO_TITLE_MIN &&
          seoTitle.length <= SEO_TITLE_SOFT_LIMIT,
      },
      {
        id: "seo-desc-len",
        label: "SEO Description length between 70–160 characters",
        passed:
          seoDescription.length >= SEO_DESC_MIN &&
          seoDescription.length <= SEO_DESC_SOFT_LIMIT,
      },
      {
        id: "has-image",
        label: "At least one image in Content",
        passed: hasImage,
      },
      {
        id: "internal-link",
        label: "At least one internal link OR a Related Category is set",
        passed: hasInternalLink,
        note: "Internal links to your test pages help readers convert AND pass authority to those pages in Google's eyes",
        alwaysShowNote: true,
      },
    ];
  }, [
    title,
    slug,
    seoDescription,
    seoTitle,
    content,
    relatedCategorySlug,
    focusKeyword,
  ]);

  const passedCount = seoChecks.filter((c) => c.passed).length;

  // ── Google-style preview values ──────────────────────────────
  const previewTitle = truncateVisual(seoTitle || title || "Untitled post", 60);
  const previewDesc = truncateVisual(
    seoDescription || excerpt || "No description yet.",
    160,
  );
  const previewSlug = slug || "your-post-slug";

  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <nav
        className="flex items-center gap-1.5 text-xs text-txt-muted"
        aria-label="Breadcrumb"
      >
        <Link
          to="/admin/blog"
          className="hover:text-txt-secondary transition-colors"
        >
          Blog
        </Link>
        <ChevronRightIcon />
        <span className="text-txt-secondary font-medium">
          {isEditing ? "Edit Post" : "New Post"}
        </span>
      </nav>

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* FIX: was `text-txt-primary dark:text-white` — the redundant
            dark override made this heading behave differently from every
            other heading in the page (which rely on text-txt-primary
            alone). Now consistent, and safe in both themes. */}
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-txt-primary">
          {isEditing ? "Edit Post" : "New Post"}
        </h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSave("draft")}
            disabled={Boolean(saving)}
            className="inline-flex items-center gap-2 border border-border hover:bg-bg disabled:opacity-60 text-txt-primary text-sm font-semibold px-4 py-2.5 rounded-lg transition-colors duration-150"
          >
            {saving === "draft" ? "Saving…" : "Save Draft"}
          </button>
          <button
            onClick={() => handleSave("published")}
            disabled={Boolean(saving)}
            className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-150"
          >
            {saving === "published" ? "Publishing…" : "Publish"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* ── Main column ─────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-surface/60 border border-border rounded-2xl p-6 space-y-5">
            {/* Status pill */}
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-txt-primary">
                Post Details
              </h2>
              <div className="inline-flex items-center bg-bg border border-border rounded-xl p-1">
                {["draft", "published"].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setStatus(s)}
                    className={`px-3 py-1 text-xs font-semibold rounded-lg capitalize transition-colors duration-150 ${
                      status === s
                        ? "bg-accent text-white"
                        : "text-txt-secondary hover:text-txt-primary"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Title
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 5 Tips to Ace the Pakistan Army Initial Test"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              />
            </div>

            {/* Slug */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-txt-secondary">
                  Slug{" "}
                  <span className="text-txt-muted font-normal">(/blog/…)</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setSlugEditMode((m) => !m);
                    if (!slugEditMode) setSlugAutoSync(false);
                  }}
                  className="text-xs font-semibold text-accent hover:text-accent-dark transition-colors"
                >
                  {slugEditMode ? "Done" : "Edit"}
                </button>
              </div>
              {slugEditMode ? (
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => {
                    setSlug(generateSlug(e.target.value));
                    setSlugAutoSync(false);
                  }}
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                />
              ) : (
                <div className="w-full bg-bg/60 border border-border rounded-lg px-3 py-2 text-sm text-txt-secondary font-mono truncate">
                  /blog/{slug || "…"}
                </div>
              )}
              {(wasEverPublished || status === "published") && (
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1.5 flex items-start gap-1">
                  <WarningIcon className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
                  Changing this after publishing breaks existing links to this
                  post.
                </p>
              )}
            </div>

            {/* Excerpt */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Excerpt
                {/* FIX: cyan-700 alone is unreadable on a dark surface;
                    paired it with a lighter cyan for dark mode. */}
                <span className="ml-1 text-cyan-700 dark:text-cyan-300">
                  (short summary shown on the /blog listing; also the SEO
                  Description fallback)
                </span>
              </label>
              <textarea
                value={excerpt}
                onChange={(e) => setExcerpt(e.target.value)}
                rows={2}
                placeholder="One or two sentences summarizing the post…"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition resize-y"
              />
            </div>

            {/* Cover image */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Cover Image
              </label>
              {coverImageUrl ? (
                <div className="flex items-center gap-3">
                  <img
                    src={coverImageUrl}
                    alt=""
                    className="w-24 h-16 object-cover rounded-lg border border-border"
                  />
                  <div className="flex flex-col gap-1.5">
                    <button
                      type="button"
                      onClick={() => coverInputRef.current?.click()}
                      disabled={uploadingCover}
                      className="text-xs font-semibold text-accent hover:text-accent-dark disabled:opacity-60 transition-colors text-left"
                    >
                      {uploadingCover ? "Uploading…" : "Replace"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCoverImageUrl("");
                        setCoverImagePublicId("");
                      }}
                      /* FIX: had no dark: variant at all — text-danger /
                         hover:text-red-700 could easily render as a
                         near-invisible dark red on a dark surface. Now
                         explicit in both modes. */
                      className="text-xs font-semibold text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 transition-colors text-left"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => coverInputRef.current?.click()}
                  disabled={uploadingCover}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark disabled:opacity-60 border border-border rounded-lg px-2.5 py-1.5 transition-colors duration-150"
                >
                  {uploadingCover ? "Uploading…" : "+ Upload Cover Image"}
                </button>
              )}
              <input
                ref={coverInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp"
                onChange={handleCoverSelected}
                className="hidden"
              />
            </div>

            {/* Content */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-txt-secondary">
                  Content
                  <span className="text-txt-muted font-normal ml-1">
                    (HTML)
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() => contentImageInputRef.current?.click()}
                  disabled={uploadingContentImage}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark disabled:opacity-60 border border-border rounded-lg px-2.5 py-1.5 transition-colors duration-150 shrink-0"
                >
                  {uploadingContentImage ? "Uploading…" : "+ Insert Image"}
                </button>
                <input
                  ref={contentImageInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/gif,image/webp"
                  onChange={handleContentImageSelected}
                  className="hidden"
                />
              </div>
              <textarea
                ref={contentTextareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={18}
                placeholder={`<h2>Introduction</h2>\n<p>Start writing here...</p>`}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 transition resize-y"
              />
              <p className="text-xs text-txt-secondary mt-1">
                Write plain HTML. Click <strong>+ Insert Image</strong> to
                upload a photo it'll be inserted as an{" "}
                <code className="bg-bg px-1 rounded text-txt-primary">
                  &lt;img&gt;
                </code>{" "}
                tag at your cursor position.
              </p>
            </div>

            {/* Tags */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Tags
                <span className="text-txt-muted font-normal ml-1">
                  (comma-separated)
                </span>
              </label>
              <input
                type="text"
                value={tagsInput}
                onChange={(e) => setTagsInput(e.target.value)}
                placeholder="army, exam-tips, verbal-reasoning"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              />
            </div>

            {/* Related Category */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Related Category
                <span className="text-txt-muted font-normal ml-1">
                  (optional)
                </span>
              </label>
              <select
                value={relatedCategorySlug}
                onChange={(e) => setRelatedCategorySlug(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              >
                <option value="">None</option>
                {categories.map((c) => (
                  <option key={c._id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Display Category — cosmetic label shown above the title */}
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Display Category
                <span className="text-txt-muted font-normal ml-1">
                  (shown above the title, e.g. "Career Tips")
                </span>
              </label>
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="Career Tips"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              />
            </div>

            {/* Author byline — optional, falls back to "PrepPk Editorial Team" */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                  Author Name{" "}
                  <span className="text-txt-muted font-normal ml-1">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="PrepPk Editorial Team"
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                  Author Avatar URL{" "}
                  <span className="text-txt-muted font-normal ml-1">
                    (optional)
                  </span>
                </label>
                <input
                  type="text"
                  value={authorAvatarUrl}
                  onChange={(e) => setAuthorAvatarUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                Author Bio{" "}
                <span className="text-txt-muted font-normal ml-1">
                  (optional, shown after the article)
                </span>
              </label>
              <textarea
                value={authorBio}
                onChange={(e) => setAuthorBio(e.target.value)}
                rows={2}
                placeholder="Writes exam-prep guides for Pakistan Army, Navy, and Air Force aspirants."
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition resize-y"
              />
            </div>
          </div>

          {/* SEO fields */}
          <div className="bg-surface/60 border border-border rounded-2xl p-6 space-y-5">
            <h2 className="text-base font-bold text-txt-primary">SEO Fields</h2>

            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                SEO Title
                <span className="text-txt-muted font-normal ml-1">
                  (falls back to Title if empty)
                </span>
              </label>
              <input
                type="text"
                value={seoTitle}
                onChange={(e) => setSeoTitle(e.target.value)}
                placeholder="Leave blank to use the post title"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
              />
              <SeoCharCounter
                length={seoTitle.length}
                min={SEO_TITLE_MIN}
                soft={SEO_TITLE_SOFT_LIMIT}
                hard={SEO_TITLE_HARD_LIMIT}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
                SEO Description
                <span className="text-txt-muted font-normal ml-1">
                  (falls back to Excerpt if empty)
                </span>
              </label>
              <textarea
                value={seoDescription}
                onChange={(e) => setSeoDescription(e.target.value)}
                rows={3}
                placeholder="Leave blank to use the excerpt"
                className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition resize-y"
              />
              <SeoCharCounter
                length={seoDescription.length}
                min={SEO_DESC_MIN}
                soft={SEO_DESC_SOFT_LIMIT}
                hard={SEO_DESC_HARD_LIMIT}
              />
            </div>

            {/* Google-style search preview — intentionally NOT theme-linked:
                this mimics an actual Google result card, which is always
                white/light regardless of app theme. Colors are pinned
                explicitly for both modes so nothing goes invisible. */}
            <div>
              <p className="text-xs font-semibold text-txt-secondary mb-1.5">
                Search Preview
              </p>
              <div className="bg-white dark:bg-slate-900 border border-border rounded-lg p-4">
                <p className="text-[13px] text-[#4d5156] dark:text-slate-400 truncate">
                  yourdomain.com › blog › {previewSlug}
                </p>
                <p className="text-[#1a0dab] dark:text-[#8ab4f8] text-lg leading-snug truncate">
                  {previewTitle}
                </p>
                <p className="text-sm text-[#4d5156] dark:text-slate-400 leading-snug">
                  {previewDesc}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* ── SEO Assistant sidebar ───────────────────────── */}
        <div className="lg:sticky lg:top-6 bg-surface/60 border border-border rounded-2xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-bold text-txt-primary mb-1">
              SEO Assistant
            </h2>
            <p className="text-xs text-txt-secondary">
              Guidance only, this never blocks saving or publishing.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
              Focus Keyword
            </label>
            <input
              type="text"
              value={focusKeyword}
              onChange={(e) => setFocusKeyword(e.target.value)}
              placeholder="e.g. pakistan army test"
              className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 transition"
            />
          </div>

          <div className="flex items-center justify-between px-1 py-2 border-y border-border/70">
            <span className="text-xs font-semibold text-txt-secondary">
              Checklist Summary
            </span>
            {/* FIX: text-success with no dark handling could wash out;
                using explicit emerald pair to match CheckCircleIcon. */}
            <span
              className={`text-xs font-bold ${
                passedCount === seoChecks.length
                  ? "text-emerald-600 dark:text-emerald-400"
                  : "text-txt-primary"
              }`}
            >
              {passedCount} of {seoChecks.length} checks passed
            </span>
          </div>

          <ul className="space-y-3">
            {seoChecks.map((check) => (
              <li key={check.id} className="flex items-start gap-2">
                {check.neutral ? (
                  <CircleIcon className="w-4 h-4 text-txt-muted shrink-0 mt-0.5" />
                ) : check.passed ? (
                  <CheckCircleIcon className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <WarningIcon className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                )}
                <div className="text-xs leading-relaxed">
                  <p
                    className={
                      check.neutral
                        ? "text-txt-muted"
                        : check.passed
                          ? "text-txt-secondary"
                          : "text-txt-primary font-medium"
                    }
                  >
                    {check.label}
                    {check.neutral && (
                      <span className="text-txt-muted">
                        {" "}
                        (set a focus keyword above)
                      </span>
                    )}
                  </p>
                  {check.note &&
                    (check.alwaysShowNote ||
                      (!check.passed && !check.neutral)) && (
                      <p className="text-txt-muted mt-0.5">{check.note}</p>
                    )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}