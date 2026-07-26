/**
 * src/pages/admin/CategoryPage.jsx  (updated Prompt 97   SEO & Content tab)
 *
 * Changes:
 *  - Added "SEO & Content" tab below the test table.
 *  - Admin can set seoTitle, seoDescription, and blogContent (HTML).
 *  - Save button PATCHes /api/admin/categories/:slug with the SEO fields.
 */

import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import api from "../../api/axios";
import TestTable from "../../components/admin/TestTable";
import CustomTestTable from "../../components/admin/CustomTestTable";
import DeleteCategoryDialog from "../../components/admin/DeleteCategoryDialog";
import AddTestDropdown from "../../components/admin/AddTestDropdown";
import TestGroupPanel from "../../components/admin/TestGroupPanel";
import { useAdminCategories } from "../../context/CategoriesContext";
import SeoCharCounter, {
  SEO_TITLE_SOFT_LIMIT,
  SEO_TITLE_HARD_LIMIT,
  SEO_DESC_SOFT_LIMIT,
  SEO_DESC_HARD_LIMIT,
} from "../../components/admin/SeoCharCounter";

// ── Icons ─────────────────────────────────────────────────────
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

function TrashIcon() {
  return (
    <svg
      className="w-4 h-4"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
      />
    </svg>
  );
}

// ── Page skeleton ─────────────────────────────────────────────
function PageSkeleton() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-8 animate-pulse">
      <div>
        <div className="h-3 w-40 bg-bg rounded mb-4" />
        <div className="flex items-center justify-between">
          <div className="h-8 w-64 bg-bg rounded" />
          <div className="h-10 w-40 bg-bg rounded-lg" />
        </div>
      </div>
      <div className="bg-surface/60 border border-border rounded-2xl h-40" />
    </div>
  );
}

// ── Category not found ────────────────────────────────────────
function CategoryNotFound() {
  return (
    <div className="max-w-2xl mx-auto px-4 py-16 text-center">
      <div className="bg-surface border border-border rounded-2xl p-10">
        <span className="inline-block text-xs font-semibold uppercase tracking-widest text-danger bg-danger-light/10 border border-danger/20 px-3 py-1 rounded-full mb-4">
          404
        </span>
        <h2 className="text-2xl font-bold text-txt-primary mb-2">
          Category not found
        </h2>
        <p className="text-txt-secondary text-sm mb-6">
          The category you're looking for doesn't exist or may have been
          removed.
        </p>
        <Link
          to="/admin/dashboard"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-150"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

// ── Group Blog tab (custom categories only) ───────────────────
function GroupBlogTab({ categorySlug }) {
  const [groups, setGroups] = useState([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [selectedId, setSelectedId] = useState("");
  const [seoTitle, setSeoTitle] = useState("");
  const [seoDescription, setSeoDescription] = useState("");
  const [blogContent, setBlogContent] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const blogTextareaRef = useRef(null);
  const imageInputRef = useRef(null);

  // Load groups whenever category changes
  useEffect(() => {
    setLoadingGroups(true);
    api
      .get(`/test-groups/${categorySlug}`)
      .then(({ data }) => {
        const g = Array.isArray(data) ? data : [];
        setGroups(g);
        if (g.length > 0) {
          setSelectedId(g[0]._id);
          setSeoTitle(g[0].seoTitle || "");
          setSeoDescription(g[0].seoDescription || "");
          setBlogContent(g[0].blogContent || "");
        }
      })
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, [categorySlug]);

  // Swap content when admin picks a different group
  function handleSelectGroup(id) {
    setSelectedId(id);
    const g = groups.find((x) => x._id === id);
    setSeoTitle(g?.seoTitle || "");
    setSeoDescription(g?.seoDescription || "");
    setBlogContent(g?.blogContent || "");
  }

  async function handleImageSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post(
        "/admin/categories/upload-cover",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );
      const imgTag = `<img src="${data.url}" alt="" />`;
      const textarea = blogTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? blogContent.length;
        const end = textarea.selectionEnd ?? blogContent.length;
        const next =
          blogContent.slice(0, start) + imgTag + blogContent.slice(end);
        setBlogContent(next);
        requestAnimationFrame(() => {
          textarea.focus();
          const cursor = start + imgTag.length;
          textarea.setSelectionRange(cursor, cursor);
        });
      } else {
        setBlogContent((prev) => prev + imgTag);
      }
      toast.success("Image uploaded and inserted.");
    } catch (err) {
      toast.error(err.response?.data?.message || "Image upload failed.");
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    try {
      // Two separate endpoints (Prompt 1 kept /seo separate from the
      // existing /blog endpoint so this save button just fires both).
      await Promise.all([
        api.patch(`/test-groups/${selectedId}/blog`, { blogContent }),
        api.patch(`/test-groups/${selectedId}/seo`, { seoTitle, seoDescription }),
      ]);
      // Update local cache so switching away & back shows saved values
      setGroups((prev) =>
        prev.map((g) =>
          g._id === selectedId ? { ...g, blogContent, seoTitle, seoDescription } : g,
        ),
      );
      toast.success("Group content & SEO saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  if (loadingGroups) {
    return (
      <div className="bg-surface/60 border border-border rounded-2xl p-6 animate-pulse">
        <div className="h-4 w-40 bg-bg rounded mb-3" />
        <div className="h-32 bg-bg rounded-lg" />
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className="bg-surface/60 border border-border rounded-2xl p-6">
        <h2 className="text-base font-bold text-txt-primary mb-1">
          Group Blog Content
        </h2>
        <p className="text-xs text-txt-secondary">
          No groups yet. Create a group first, then you can add blog content for
          it here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-surface/60 border border-border rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-txt-primary mb-1">
          Group SEO &amp; Content
        </h2>
        <p className="text-xs text-txt-secondary">
          Select a group, then set its SEO title/description and write blog
          content for it. On the public page, this content appears on that
          group's own page.
        </p>
      </div>

      {/* Group selector */}
      <div>
        <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
          Select Group
        </label>
        <select
          value={selectedId}
          onChange={(e) => handleSelectGroup(e.target.value)}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
        >
          {groups.map((g) => (
            <option key={g._id} value={g._id}>
              {g.name}
              {g.blogContent ? "  ✓ has content" : ""}
            </option>
          ))}
        </select>
      </div>

      {/* SEO Title */}
      <div>
        <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
          SEO Title
          <span className="text-txt-muted font-normal ml-1">
            (shown as the blue headline in Google e.g. "SSC Teaching — Army
            Practice Tests | PrepPK")
          </span>
        </label>
        <input
          type="text"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          placeholder="Leave blank to auto-generate from group name"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/60 transition"
        />
        <SeoCharCounter length={seoTitle.length} soft={SEO_TITLE_SOFT_LIMIT} hard={SEO_TITLE_HARD_LIMIT} />
      </div>

      {/* SEO Description */}
      <div>
        <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
          SEO Description
          <span className="text-txt-muted font-normal ml-1">
            (grey text below the title in Google — aim for 140–160 characters)
          </span>
        </label>
        <textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          rows={3}
          placeholder="Leave blank to auto-generate"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-brand/60 transition resize-y"
        />
        <SeoCharCounter length={seoDescription.length} soft={SEO_DESC_SOFT_LIMIT} hard={SEO_DESC_HARD_LIMIT} />
      </div>

      {/* Blog content textarea */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-txt-secondary">
            Blog / Page Content
            <span className="text-txt-muted font-normal ml-1">
              (HTML — shown below tests when this group is active on the public
              page)
            </span>
          </label>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark disabled:opacity-60 border border-border rounded-lg px-2.5 py-1.5 transition-colors duration-150 shrink-0"
          >
            {uploadingImage ? "Uploading…" : "+ Insert Image"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleImageSelected}
            className="hidden"
          />
        </div>
        <textarea
          ref={blogTextareaRef}
          value={blogContent}
          onChange={(e) => setBlogContent(e.target.value)}
          rows={12}
          placeholder={`<h2>About Teaching Jobs Test</h2>\n<p>The Teaching Jobs initial test covers...</p>`}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted font-mono focus:outline-none focus:ring-2 focus:ring-brand/60 transition resize-y"
        />
        <p className="text-xs text-txt-secondary mt-1">
          Write plain HTML. Use{" "}
          <code className="bg-bg px-1 rounded">&lt;h2&gt;</code>,{" "}
          <code className="bg-bg px-1 rounded">&lt;p&gt;</code>,{" "}
          <code className="bg-bg px-1 rounded">&lt;ul&gt;&lt;li&gt;</code> tags
          for structure. CSS properties work too — e.g.{" "}
          <code className="bg-bg px-1 rounded">
            &lt;h2 style="color:#1D4ED8"&gt;
          </code>
          . Click <strong>+ Insert Image</strong> to upload a photo.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving || !selectedId}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-150"
        >
          {saving ? "Saving…" : "Save SEO & Content"}
        </button>
      </div>
    </div>
  );
}

// ── SEO & Content tab ─────────────────────────────────────────
function SeoContentTab({
  slug,
  initialSeoTitle,
  initialSeoDescription,
  initialBlogContent,
}) {
  const [seoTitle, setSeoTitle] = useState(initialSeoTitle || "");
  const [seoDescription, setSeoDescription] = useState(
    initialSeoDescription || "",
  );
  const [blogContent, setBlogContent] = useState(initialBlogContent || "");
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const blogTextareaRef = useRef(null);
  const imageInputRef = useRef(null);

  async function handleImageSelected(e) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("image", file);
      const { data } = await api.post(
        "/admin/categories/upload-cover",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        },
      );

      const imgTag = `<img src="${data.url}" alt="" />`;
      const textarea = blogTextareaRef.current;
      if (textarea) {
        const start = textarea.selectionStart ?? blogContent.length;
        const end = textarea.selectionEnd ?? blogContent.length;
        const next =
          blogContent.slice(0, start) + imgTag + blogContent.slice(end);
        setBlogContent(next);
        // restore focus + cursor after the inserted tag on next tick
        requestAnimationFrame(() => {
          textarea.focus();
          const cursor = start + imgTag.length;
          textarea.setSelectionRange(cursor, cursor);
        });
      } else {
        setBlogContent((prev) => prev + imgTag);
      }
      toast.success("Image uploaded and inserted.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Image upload failed. Please try again.",
      );
    } finally {
      setUploadingImage(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.patch(`/admin/categories/${slug}`, {
        seoTitle,
        seoDescription,
        blogContent,
      });
      toast.success("SEO & content saved.");
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Failed to save. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bg-surface/60 border border-border rounded-2xl p-6 space-y-5">
      <div>
        <h2 className="text-base font-bold text-txt-primary mb-1">
          SEO & Content
        </h2>
        <p className="text-xs text-txt-secondary">
          These fields control how this category appears in Google search
          results and add rich content to the public category page.
        </p>
      </div>

      {/* SEO Title */}
      <div>
        <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
          SEO Title
          <span className="text-txt-muted font-normal ml-1">
            (shown as the blue headline in Google e.g. "Pakistan Army Mock Test
            2025 | PrepPK")
          </span>
        </label>
        <input
          type="text"
          value={seoTitle}
          onChange={(e) => setSeoTitle(e.target.value)}
          maxLength={120}
          placeholder="Leave blank to auto-generate from category name"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-2 focus:ring-brand/60 transition"
        />
        <p className="text-xs text-txt-secondary mt-1">
          {seoTitle.length}/120 characters
        </p>
      </div>

      {/* SEO Description */}
      <div>
        <label className="block text-xs font-semibold text-txt-secondary mb-1.5">
          SEO Description
          <span className="text-txt-muted font-normal ml-1">
            (grey text below the title in Google aim for 140–160 characters)
          </span>
        </label>
        <textarea
          value={seoDescription}
          onChange={(e) => setSeoDescription(e.target.value)}
          maxLength={300}
          rows={3}
          placeholder="Leave blank to auto-generate"
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-2 focus:ring-brand/60 transition resize-y"
        />
        <p className="text-xs text-txt-secondary mt-1">
          {seoDescription.length}/300 characters
        </p>
      </div>

      {/* Blog Content */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="block text-xs font-semibold text-txt-secondary">
            Blog / Page Content
            <span className="text-txt-muted font-normal ml-1">
              (HTML shown below the test list on the public category page; helps
              Google rank the page)
            </span>
          </label>
          <button
            type="button"
            onClick={() => imageInputRef.current?.click()}
            disabled={uploadingImage}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-accent hover:text-accent-dark disabled:opacity-60 border border-border rounded-lg px-2.5 py-1.5 transition-colors duration-150 shrink-0"
          >
            {uploadingImage ? "Uploading…" : "+ Insert Image"}
          </button>
          <input
            ref={imageInputRef}
            type="file"
            accept="image/png,image/jpeg,image/gif,image/webp"
            onChange={handleImageSelected}
            className="hidden"
          />
        </div>
        <textarea
          ref={blogTextareaRef}
          value={blogContent}
          onChange={(e) => setBlogContent(e.target.value)}
          rows={12}
          placeholder={`<h2>About the Pakistan Army Initial Test</h2>\n<p>The Pakistan Army initial test consists of three sections...</p>`}
          className="w-full bg-surface border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted font-mono focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-2 focus:ring-brand/60 transition resize-y"
        />
        <p className="text-xs text-txt-secondary mt-1">
          Write plain HTML. Use{" "}
          <code className="bg-bg px-1 rounded">&lt;h2&gt;</code>,{" "}
          <code className="bg-bg px-1 rounded">&lt;p&gt;</code>,{" "}
          <code className="bg-bg px-1 rounded">&lt;ul&gt;&lt;li&gt;</code> tags
          for structure. CSS properties work too — e.g.{" "}
          <code className="bg-bg px-1 rounded">
            &lt;h2 style="color:#1D4ED8"&gt;
          </code>
          . Click <strong>+ Insert Image</strong> to upload a photo — it'll be
          inserted as an <code className="bg-bg px-1 rounded">&lt;img&gt;</code>{" "}
          tag at your cursor position.
        </p>
      </div>

      <div className="flex justify-end pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-accent hover:bg-accent-dark disabled:opacity-60 text-white text-sm font-semibold px-5 py-2.5 rounded-lg transition-colors duration-150"
        >
          {saving ? "Saving…" : "Save SEO & Content"}
        </button>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────
export default function CategoryPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { refreshCategories } = useAdminCategories();

  const [category, setCategory] = useState(null);
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Pagination state (10 tests per page)
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Delete state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Custom category "Add Test" panel (group → test → MCQs flow)
  const [panelOpen, setPanelOpen] = useState(false);

  // Reset to page 1 whenever the category changes (route re-entry / nav)
  useEffect(() => {
    setPage(1);
    setPanelOpen(false);
  }, [slug]);

  useEffect(() => {
    let cancelled = false;

    async function fetchCategoryTests() {
      setLoading(true);
      setNotFound(false);

      try {
        const { data } = await api.get(`/admin/categories/${slug}/tests`, {
          params: { page, limit: 10 },
        });
        if (cancelled) return;
        setCategory(data.category);
        setTests(data.tests || []);
        setTotalPages(data.totalPages || 1);
      } catch (err) {
        if (cancelled) return;
        if (err.response?.status === 404) {
          setNotFound(true);
        } else {
          toast.error(
            err.response?.data?.message || "Failed to load category.",
            { id: `cat-load-${slug}` },
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchCategoryTests();
    return () => {
      cancelled = true;
    };
  }, [slug, page]);

  if (loading && !category) return <PageSkeleton />;
  if (notFound) return <CategoryNotFound />;

  const categoryName = category?.name || "Category";

  // ── Delete handlers ───────────────────────────────────────
  async function handleDeleteConfirm() {
    setDeleteLoading(true);
    setDeleteError("");
    try {
      await api.delete(`/admin/categories/${slug}`);
      await refreshCategories();
      toast.success(`"${categoryName}" deleted successfully.`);
      navigate("/admin/dashboard");
    } catch (err) {
      const status = err.response?.status;
      const msg =
        status === 403
          ? "Default categories (Army, Navy, Air Force) cannot be deleted."
          : err.response?.data?.message ||
            "Failed to delete category. Please try again.";
      setDeleteError(msg);
      toast.error(msg, { id: "cat-delete-error" });
    } finally {
      setDeleteLoading(false);
    }
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
      {/* ── Breadcrumb ─────────────────────────────────────── */}
      <nav
        className="flex items-center gap-1.5 text-xs text-txt-muted"
        aria-label="Breadcrumb"
      >
        <Link
          to="/admin/dashboard"
          className="hover:text-txt-secondary transition-colors"
        >
          Home
        </Link>
        <ChevronRightIcon />
        <span className="text-txt-secondary font-medium">{categoryName}</span>
      </nav>

      {/* ── Page header ────────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-txt-primary dark:text-white">
          {categoryName}
        </h1>

        <div className="flex items-center gap-2">
          {/* Delete only for custom (deletable) categories */}
          {category?.isDeletable && (
            <button
              onClick={() => {
                setDeleteError("");
                setShowDeleteDialog(true);
              }}
              className="inline-flex items-center gap-1.5 border border-danger/30 text-danger hover:bg-danger-light/10 text-sm font-medium px-3 py-2.5 rounded-lg transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-red-400/30"
            >
              <TrashIcon />
              Delete Category
            </button>
          )}

          {/* Dynamic add-test control: default categories get the section
              dropdown (Verbal/Non-Verbal/Academic); custom categories get
              the group → test → MCQs panel toggle. */}
          {category && (category.isDefault ? (
            <AddTestDropdown category={category} />
          ) : (
            <button
              onClick={() => setPanelOpen((o) => !o)}
              className={`inline-flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition ${
                panelOpen
                  ? "bg-accent text-white"
                  : "bg-accent/10 hover:bg-accent/20 text-accent border border-accent/30"
              }`}
            >
              <span className="text-base leading-none">{panelOpen ? "−" : "+"}</span>
              Add {categoryName} Test
            </button>
          ))}
        </div>
      </div>

      {/* ── Custom category: group → test panel (slide-down) ────── */}
      {category && !category.isDefault && panelOpen && (
        <TestGroupPanel category={category} onClose={() => setPanelOpen(false)} />
      )}

      {/* ── Test list / empty state ────────────────────────── */}
      {!loading && tests.length === 0 ? (
        <div className="bg-surface/60 border border-border rounded-2xl px-6 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-bg/60 flex items-center justify-center mx-auto mb-3">
            <svg
              className="w-6 h-6 text-txt-secondary"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <p className="text-txt-secondary text-sm font-medium mb-1">
            No tests in {categoryName} yet
          </p>
          <p className="text-txt-muted text-xs">
            Use the "Add {categoryName} Test" button above to create the first
            test.
          </p>
        </div>
      ) : category?.isDefault ? (
        <TestTable
          tests={tests}
          loading={loading}
          slug={slug}
          page={page}
          totalPages={totalPages}
          onPrevPage={() => setPage((p) => Math.max(p - 1, 1))}
          onNextPage={() => setPage((p) => Math.min(p + 1, totalPages))}
        />
      ) : (
        <CustomTestTable
          tests={tests}
          loading={loading}
          page={page}
          totalPages={totalPages}
          onPrevPage={() => setPage((p) => Math.max(p - 1, 1))}
          onNextPage={() => setPage((p) => Math.min(p + 1, totalPages))}
        />
      )}

      {/* ── SEO & Content section ──────────────────────────── */}
      {!loading &&
        category &&
        (category.isDeletable ? (
          <GroupBlogTab categorySlug={slug} />
        ) : (
          <SeoContentTab
            slug={slug}
            initialSeoTitle={category.seoTitle || ""}
            initialSeoDescription={category.seoDescription || ""}
            initialBlogContent={category.blogContent || ""}
          />
        ))}

      {/* ── Delete confirmation dialog (type-to-confirm) ─────── */}
      <DeleteCategoryDialog
        isOpen={showDeleteDialog}
        category={category ? { name: categoryName, slug } : null}
        onConfirm={handleDeleteConfirm}
        onCancel={() => {
          setShowDeleteDialog(false);
          setDeleteError("");
        }}
        loading={deleteLoading}
        error={deleteError}
      />
    </div>
  );
}
