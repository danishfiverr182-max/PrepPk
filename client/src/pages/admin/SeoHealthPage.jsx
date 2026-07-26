/**
 * src/pages/admin/SeoHealthPage.jsx
 *
 * Read-only admin diagnostic page for the four "silently rots as
 * content grows" SEO checks reported by GET /api/admin/seo-health
 * (server/routes/adminSeoHealth.js):
 *
 *   1. Categories missing seoTitle or seoDescription
 *   2. TestGroups missing seoTitle or seoDescription
 *   3. Published blog posts with thin content (< 300 words)
 *   4. Published blog posts with zero internal links
 *
 * Styled to match BlogListPage.jsx (gradient header banner) and
 * ApiKeyPoolPage.jsx, since it sits next to Blog in the admin nav.
 * Each section is its own compact table; every row links straight to
 * the admin editor where that specific item can be fixed, rather than
 * just showing a number — Categories/TestGroups both link to the
 * category dashboard page (where both a category's own SEO fields and
 * its TestGroups' SEO fields are edited, see pages/admin/CategoryPage.jsx),
 * blog posts link straight to their editor.
 */

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import { getSeoHealth } from "../../api/seoHealth";
import Badge from "../../components/ui/Badge";

document.title = "SEO Health | PrepPk Admin";

// ── Icons ─────────────────────────────────────────────────────
function CheckIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M17 8l4 4m0 0l-4 4m4-4H3" />
    </svg>
  );
}

function RefreshIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182m0-4.991v4.99" />
    </svg>
  );
}

function SkeletonRow({ cols = 2 }) {
  return (
    <tr className="bg-surface">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-border rounded animate-pulse" style={{ width: i === 0 ? 220 : 90 }} />
        </td>
      ))}
    </tr>
  );
}

// ── One diagnostic section: header + table ───────────────────
function HealthSection({ title, description, count, columns, rows, emptyLabel, loading, onRowClick }) {
  const isClean = !loading && count === 0;

  return (
    <div className="rounded-2xl border border-border overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 bg-bg border-b border-border">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-txt-primary">{title}</h2>
            {!loading && (
              <Badge variant={isClean ? "success" : "warning"}>
                {isClean ? (
                  <span className="inline-flex items-center gap-1"><CheckIcon /> All clear</span>
                ) : (
                  `${count} to fix`
                )}
              </Badge>
            )}
          </div>
          <p className="text-xs text-txt-muted mt-1 max-w-xl">{description}</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-bg/60 text-txt-secondary text-xs font-semibold uppercase tracking-wider">
              {columns.map((col) => (
                <th key={col.key} className={`px-4 py-2.5 ${col.align === "right" ? "text-right" : "text-left"}`}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading &&
              [1, 2, 3].map((i) => <SkeletonRow key={i} cols={columns.length} />)}

            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-8 text-center text-txt-muted text-sm">
                  {emptyLabel}
                </td>
              </tr>
            )}

            {!loading &&
              rows.map((row, idx) => (
                <tr
                  key={row.key}
                  onClick={() => onRowClick(row)}
                  className={`cursor-pointer ${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"} hover:bg-bg transition`}
                >
                  {columns.map((col) => (
                    <td key={col.key} className={`px-4 py-3 ${col.align === "right" ? "text-right" : ""}`}>
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function SeoHealthPage() {
  const navigate = useNavigate();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await getSeoHealth();
      setData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load SEO health report.", {
        id: "seo-health-error",
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
  }, [fetchHealth]);

  const categoriesMissingSeo = data?.categoriesMissingSeo?.items || [];
  const testGroupsMissingSeo = data?.testGroupsMissingSeo?.items || [];
  const thinContentPosts = data?.thinContentPosts?.items || [];
  const noInternalLinkPosts = data?.noInternalLinkPosts?.items || [];

  const totalIssues =
    (data?.categoriesMissingSeo?.count || 0) +
    (data?.testGroupsMissingSeo?.count || 0) +
    (data?.thinContentPosts?.count || 0) +
    (data?.noInternalLinkPosts?.count || 0);

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
              SEO
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary leading-tight mb-3">
              SEO Health
            </h1>
            <p className="text-txt-secondary text-sm sm:text-base max-w-xl leading-relaxed">
              {loading
                ? "Scanning categories, chapters, and blog posts…"
                : totalIssues === 0
                ? "Everything's in good shape no issues found."
                : `${totalIssues} item${totalIssues === 1 ? "" : "s"} need attention across the site.`}{" "}
              Internal linking is one of the highest-leverage, lowest-effort SEO levers here this
              catches the spots where it's quietly gone missing.
            </p>
          </div>

          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-brand hover:bg-brand-dark disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <RefreshIcon />
            Refresh
          </button>
        </div>
      </div>

      {/* ── 1. Categories missing SEO fields ─────────────────── */}
      <HealthSection
        title="Categories missing SEO fields"
        description="Category pages without an admin-set SEO title or description these fall back to auto-generated defaults."
        count={data?.categoriesMissingSeo?.count}
        loading={loading}
        emptyLabel="Every category has an SEO title and description set."
        onRowClick={(row) => navigate(`/admin/dashboard/category/${row.slug}`)}
        columns={[
          { key: "name", label: "Category" },
          { key: "slug", label: "Slug", render: (r) => <span className="text-txt-muted">/{r.slug}</span> },
          {
            key: "action",
            label: "",
            align: "right",
            render: () => (
              <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">
                Fix in editor <ArrowRightIcon />
              </span>
            ),
          },
        ]}
        rows={categoriesMissingSeo.map((c) => ({ key: c.slug, ...c }))}
      />

      {/* ── 2. TestGroups missing SEO fields ─────────────────── */}
      <HealthSection
        title="Chapters (TestGroups) missing SEO fields"
        description="Chapter pages without an admin-set SEO title or description, within their parent category."
        count={data?.testGroupsMissingSeo?.count}
        loading={loading}
        emptyLabel="Every chapter has an SEO title and description set."
        onRowClick={(row) => navigate(`/admin/dashboard/category/${row.categorySlug}`)}
        columns={[
          { key: "name", label: "Chapter" },
          {
            key: "categorySlug",
            label: "Category",
            render: (r) => <span className="text-txt-muted">/{r.categorySlug}</span>,
          },
          {
            key: "action",
            label: "",
            align: "right",
            render: () => (
              <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">
                Fix in editor <ArrowRightIcon />
              </span>
            ),
          },
        ]}
        rows={testGroupsMissingSeo.map((g) => ({ key: `${g.categorySlug}-${g.slug}`, ...g }))}
      />

      {/* ── 3. Thin blog posts ───────────────────────────────── */}
      <HealthSection
        title="Thin blog posts (under 300 words)"
        description="Published posts whose plain-text content is under 300 words usually too short to rank well or satisfy search intent."
        count={data?.thinContentPosts?.count}
        loading={loading}
        emptyLabel="Every published post has at least 300 words of content."
        onRowClick={(row) => navigate(`/admin/blog/${row.id}`)}
        columns={[
          { key: "title", label: "Post" },
          {
            key: "wordCount",
            label: "Words",
            render: (r) => <span className="tabular-nums text-txt-primary">{r.wordCount}</span>,
          },
          {
            key: "action",
            label: "",
            align: "right",
            render: () => (
              <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">
                Edit post <ArrowRightIcon />
              </span>
            ),
          },
        ]}
        rows={thinContentPosts.map((p) => ({ key: p.id, ...p }))}
      />

      {/* ── 4. Zero-internal-link blog posts ─────────────────── */}
      <HealthSection
        title="Blog posts with zero internal links"
        description="Published posts with no related category set and no in-body links wasted SEO opportunities to pass authority to category/chapter pages."
        count={data?.noInternalLinkPosts?.count}
        loading={loading}
        emptyLabel="Every published post links somewhere internally."
        onRowClick={(row) => navigate(`/admin/blog/${row.id}`)}
        columns={[
          { key: "title", label: "Post" },
          { key: "slug", label: "Slug", render: (r) => <span className="text-txt-muted">/{r.slug}</span> },
          {
            key: "action",
            label: "",
            align: "right",
            render: () => (
              <span className="inline-flex items-center gap-1 text-brand text-xs font-semibold">
                Edit post <ArrowRightIcon />
              </span>
            ),
          },
        ]}
        rows={noInternalLinkPosts.map((p) => ({ key: p.id, ...p }))}
      />
    </div>
  );
}
