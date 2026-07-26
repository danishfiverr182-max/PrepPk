/**
 * routes/sitemap.js  (Prompt 69 SEO Essentials; updated — blog URLs)
 *
 * GET /sitemap.xml
 *   Dynamically builds an XML sitemap at request time.
 *   Includes:
 *     - Static public pages (/, /free-mock-tests, /blog)
 *     - One <url> per live category (slug sourced from MongoDB)
 *     - One <url> per TestGroup (chapter) page
 *     - One <url> per published BlogPost (slug sourced from MongoDB)
 *
 * Cache: public, max-age=3600 (1 hour) categories/posts change rarely.
 *
 * No auth required.  Bots hit this directly.
 */

import { Router } from "express";
import Category from "../models/Category.js";
import TestGroup from "../models/TestGroup.js";
import BlogPost from "../models/BlogPost.js";

const router = Router();

// ── Helper: escape XML special characters ─────────────────────
function escapeXml(str = "") {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// ── Helper: build a single <url> block ────────────────────────
function urlEntry(loc, { lastmod, changefreq = "weekly", priority = "0.7" } = {}) {
  const today = new Date().toISOString().split("T")[0];
  return `
  <url>
    <loc>${escapeXml(loc)}</loc>
    <lastmod>${lastmod || today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`;
}

// ── GET /sitemap.xml ──────────────────────────────────────────
router.get("/sitemap.xml", async (req, res) => {
  try {
    // Determine the public base URL.
    // In production this should be set via CLIENT_URL env var
    // (e.g. https://www.prepkp.com).  Falls back to request host.
    const base =
      process.env.CLIENT_URL ||
      `${req.protocol}://${req.get("host")}`;

    // Fetch all categories only need slug + updatedAt
    const categories = await Category.find()
      .sort({ order: 1 })
      .select("slug updatedAt");

    // Fetch all test groups (chapters)   only need slug + categorySlug + updatedAt
    const testGroups = await TestGroup.find()
      .sort({ order: 1 })
      .select("slug categorySlug updatedAt");

    // Fetch every published blog post   only need slug + updatedAt.
    // Drafts are never included here (they aren't publicly reachable anyway
    // — see controllers/blogController.js getPostPublic, which 404s on
    // anything that isn't status: "published").
    const blogPosts = await BlogPost.find({ status: "published" })
      .sort({ publishedAt: -1 })
      .select("slug updatedAt");

    // ── Static pages ──────────────────────────────────────────
    const staticUrls = [
      urlEntry(`${base}/`, {
        changefreq: "daily",
        priority: "1.0",
      }),
      urlEntry(`${base}/free-mock-tests`, {
        changefreq: "daily",
        priority: "0.9",
      }),
      // New posts appear here regularly, so "daily" like the homepage —
      // higher-priority than an individual post since it's the hub linking
      // out to all of them.
      urlEntry(`${base}/blog`, {
        changefreq: "daily",
        priority: "0.7",
      }),
    ];

    // ── Category pages ────────────────────────────────────────
    const categoryUrls = categories.map((cat) => {
      const lastmod = cat.updatedAt
        ? cat.updatedAt.toISOString().split("T")[0]
        : undefined;
      return urlEntry(`${base}/category/${cat.slug}`, {
        lastmod,
        changefreq: "weekly",
        priority: "0.8",
      });
    });

    // ── Test group (chapter) pages ─────────────────────────────
    // One level deeper than a category page, so priority is slightly
    // lower (0.7 vs 0.8) even though they're crawled at the same
    // "weekly" frequency.
    const groupUrls = testGroups.map((group) => {
      const lastmod = group.updatedAt
        ? group.updatedAt.toISOString().split("T")[0]
        : undefined;
      return urlEntry(`${base}/category/${group.categorySlug}/${group.slug}`, {
        lastmod,
        changefreq: "weekly",
        priority: "0.7",
      });
    });

    // ── Blog post pages ────────────────────────────────────────
    // Once published, a post's body rarely changes again — "monthly" /
    // 0.6 is deliberately lower than category/group pages, which are the
    // actual product surface these posts exist to funnel traffic toward.
    const blogUrls = blogPosts.map((post) => {
      const lastmod = post.updatedAt
        ? post.updatedAt.toISOString().split("T")[0]
        : undefined;
      return urlEntry(`${base}/blog/${post.slug}`, {
        lastmod,
        changefreq: "monthly",
        priority: "0.6",
      });
    });

    // ── Assemble XML ──────────────────────────────────────────
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset
  xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.sitemaps.org/schemas/sitemap/0.9
    http://www.sitemaps.org/schemas/sitemap/0.9/sitemap.xsd">
${staticUrls.join("")}
${categoryUrls.join("")}
${groupUrls.join("")}
${blogUrls.join("")}
</urlset>`;

    // 1-hour public cache bots crawl infrequently
    res.set("Content-Type", "application/xml");
    res.set("Cache-Control", "public, max-age=3600");
    return res.send(xml);
  } catch (err) {
    console.error("GET /sitemap.xml error:", err.message);
    return res.status(500).send("<?xml version=\"1.0\"?><error>sitemap unavailable</error>");
  }
});

export default router;
