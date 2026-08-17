/**
 * routes/publicVisitTracking.js
 *
 * POST /api/visits/track
 *
 * Fire-and-forget page-view logging, called by the frontend (see
 * client/src/hooks/useTrackVisit.js) from the homepage and category pages.
 * Feeds the admin dashboard's "Visitor Stats" panel
 * (GET /api/admin/visit-stats in routes/adminDashboard.js).
 *
 * Anonymous by design: no login required, nothing personally identifying
 * stored. A random UUID is set in a long-lived, httpOnly cookie on first
 * visit and reused after that purely so the admin panel can report
 * "unique visitors" separately from raw visit counts.
 *
 * Always responds 204 — including on internal errors — since a broken
 * analytics call should never surface as a visible error to a real
 * visitor or block the page they're on.
 */

import { Router } from "express";
import crypto from "crypto";
import Visit from "../models/Visit.js";

const router = Router();

const VISITOR_COOKIE = "mt_vid";
const VISITOR_COOKIE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 365; // ~1 year

router.post("/track", async (req, res) => {
  try {
    const { type, categorySlug, categoryName, path } = req.body || {};

    let visitorId = req.cookies?.[VISITOR_COOKIE];
    if (!visitorId || typeof visitorId !== "string") {
      visitorId = crypto.randomUUID();
      res.cookie(VISITOR_COOKIE, visitorId, {
        maxAge: VISITOR_COOKIE_MAX_AGE_MS,
        httpOnly: true,
        sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    const safeType = ["home", "category"].includes(type) ? type : "other";

    await Visit.create({
      type: safeType,
      categorySlug: safeType === "category" && categorySlug ? String(categorySlug).slice(0, 120) : null,
      categoryName: safeType === "category" && categoryName ? String(categoryName).slice(0, 200) : null,
      path: typeof path === "string" ? path.slice(0, 300) : "",
      visitorId,
    });

    return res.status(204).end();
  } catch (err) {
    console.error("POST /api/visits/track error:", err.message);
    // Analytics failing should never be visible to a real visitor.
    return res.status(204).end();
  }
});

export default router;
