/**
 * routes/adminSeoHealth.js
 *
 * A single read-only diagnostic endpoint for the admin SEO health page
 * (client/src/pages/admin/SeoHealthPage.jsx). Reports four things that
 * are easy to let quietly rot as content grows:
 *
 *   1. Categories missing seoTitle or seoDescription
 *   2. TestGroups missing seoTitle or seoDescription
 *   3. Published BlogPosts with < 300 words of content (thin content)
 *   4. Published BlogPosts with zero internal links   no
 *      relatedCategorySlug AND no <a href in their content
 *
 * Each section returns both a count and the actual list of
 * titles/slugs so the admin can click straight through and fix them,
 * not just see a number. Mounted at /api/admin (see server/index.js),
 * so this becomes GET /api/admin/seo-health, behind verifyAdmin same
 * as every other admin-only route (see routes/adminDashboard.js for
 * the reference pattern this file follows).
 *
 * Word counting reuses the exact same strip-tags-and-split logic
 * BlogPost.js uses for readTimeMinutes (see server/utils/wordCount.js)
 * rather than re-deriving it from the stored readTimeMinutes field,
 * since readTimeMinutes is a rounded-up-per-200-words bucket and can't
 * reliably distinguish "290 words" from "310 words" the way a raw
 * word count can.
 */

import { Router } from "express";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import Category from "../models/Category.js";
import TestGroup from "../models/TestGroup.js";
import BlogPost from "../models/BlogPost.js";
import { countWords } from "../utils/wordCount.js";

const router = Router();

// Matches both a truly-missing field and an explicit empty string   a
// document created before these fields existed would have `undefined`
// (Mongo stores nothing), while one edited and cleared by an admin
// would have "". Both count as "missing" for this report.
const EMPTY_STRING_OR_MISSING = { $in: [null, ""] };

// Loose match for "this content contains at least one real internal
// link". Deliberately simple (admin-authored HTML only, same trust
// model as the rest of this content) rather than a full HTML parse.
const HREF_LINK_PATTERN = /<a\s+[^>]*href\s*=/i;

router.get("/seo-health", verifyAdmin, async (req, res) => {
  try {
    const [categoriesMissingSeo, testGroupsMissingSeo, publishedPosts] = await Promise.all([
      Category.find({
        $or: [
          { seoTitle: EMPTY_STRING_OR_MISSING },
          { seoDescription: EMPTY_STRING_OR_MISSING },
        ],
      })
        .select("name slug")
        .sort({ name: 1 })
        .lean(),

      TestGroup.find({
        $or: [
          { seoTitle: EMPTY_STRING_OR_MISSING },
          { seoDescription: EMPTY_STRING_OR_MISSING },
        ],
      })
        .select("name slug categorySlug")
        .sort({ name: 1 })
        .lean(),

      BlogPost.find({ status: "published" })
        .select("title slug content relatedCategorySlug")
        .lean(),
    ]);

    // ── Derive the two content-quality checks in JS ─────────────
    // Both need the actual post content (word count / href scan),
    // which isn't something Mongo can filter on directly without a
    // dedicated indexed field, so we scan the (typically small)
    // published-posts set once here.
    const thinContentPosts = [];
    const noInternalLinkPosts = [];

    for (const post of publishedPosts) {
      const wordCount = countWords(post.content);
      if (wordCount < 300) {
        thinContentPosts.push({
          title: post.title,
          slug: post.slug,
          id: post._id,
          wordCount,
        });
      }

      const hasCategoryLink = !!post.relatedCategorySlug;
      const hasInlineLink = HREF_LINK_PATTERN.test(post.content || "");
      if (!hasCategoryLink && !hasInlineLink) {
        noInternalLinkPosts.push({
          title: post.title,
          slug: post.slug,
          id: post._id,
        });
      }
    }

    return res.json({
      categoriesMissingSeo: {
        count: categoriesMissingSeo.length,
        items: categoriesMissingSeo.map((c) => ({ name: c.name, slug: c.slug })),
      },
      testGroupsMissingSeo: {
        count: testGroupsMissingSeo.length,
        items: testGroupsMissingSeo.map((g) => ({
          name: g.name,
          slug: g.slug,
          categorySlug: g.categorySlug,
        })),
      },
      thinContentPosts: {
        count: thinContentPosts.length,
        items: thinContentPosts,
      },
      noInternalLinkPosts: {
        count: noInternalLinkPosts.length,
        items: noInternalLinkPosts,
      },
    });
  } catch (err) {
    console.error("GET /api/admin/seo-health error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
