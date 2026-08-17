/**
 * models/Visit.js
 *
 * One document per page view, logged by the public
 * POST /api/visits/track endpoint. Powers the "Visitor Stats" panel on
 * the admin dashboard (GET /api/admin/visit-stats): total visits, unique
 * visitors, and a per-category breakdown.
 *
 * Deliberately minimal / anonymous — no IP address, no user agent, no
 * account linkage. `visitorId` is a random UUID stored in a long-lived,
 * httpOnly cookie (see routes/publicVisitTracking.js), just enough to
 * tell "total visits" apart from "unique visitors" without tracking
 * anyone personally.
 *
 * categorySlug/categoryName are snapshotted onto the visit at write time
 * (rather than only storing a Category ref) so historical stats stay
 * intact even if a category is later renamed or deleted.
 */

import mongoose from "mongoose";

const visitSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["home", "category", "other"],
      required: true,
      default: "other",
    },
    categorySlug: { type: String, default: null },
    categoryName: { type: String, default: null },
    // Path actually visited — kept for debugging/future breakdowns, not
    // relied on for the current stats endpoint.
    path: { type: String, default: "" },
    visitorId: { type: String, index: true },
  },
  { timestamps: true }
);

// Powers "visits over the last N days" filtering on the admin panel.
visitSchema.index({ createdAt: -1 });
// Powers the per-category aggregation without a full collection scan.
visitSchema.index({ type: 1, categorySlug: 1, createdAt: -1 });

const Visit = mongoose.model("Visit", visitSchema);
export default Visit;
