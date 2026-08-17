/**
 * routes/adminDashboard.js
 */

import { Router } from "express";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import Category from "../models/Category.js";
import Test from "../models/Test.js";
import FreeMockTest from "../models/FreeMockTest.js";
import PremiumUser from "../models/PremiumUser.js";
import Visit from "../models/Visit.js";

const router = Router();

/**
 * GET /api/admin/dashboard-stats
 *
 * Returns platform-wide counts for the admin dashboard stat cards.
 * Protected requires a valid admin JWT cookie via verifyAdmin.
 *
 * Response shape:
 *   { totalCategories, totalTests, totalFreeMockTests, totalUsers, activeUsers, expiredUsers }
 */
router.get("/dashboard-stats", verifyAdmin, async (req, res) => {
  try {
    const now = new Date();

    const [totalCategories, totalTests, totalFreeMockTests, totalUsers, totalActiveUsers, totalExpiredUsers] = await Promise.all([
      Category.countDocuments(),
      Test.countDocuments({ isPublished: true }),
      FreeMockTest.countDocuments({ isPublished: true }),
      PremiumUser.countDocuments(),
      PremiumUser.countDocuments({ expiresAt: { $gt: now } }),
      PremiumUser.countDocuments({ expiresAt: { $lte: now } }),
    ]);

    return res.json({
      totalCategories,
      totalTests,
      totalFreeMockTests,
      totalUsers,
      totalActiveUsers,
      totalExpiredUsers,
      // legacy aliases kept for any existing consumers
      activeUsers:  totalActiveUsers,
      expiredUsers: totalExpiredUsers,
    });
  } catch (err) {
    console.error("GET /api/admin/dashboard-stats error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

/**
 * GET /api/admin/visit-stats?days=<number>
 *
 * Visitor analytics for the admin dashboard: total site visits, unique
 * visitors, homepage visits, and a per-category breakdown (visits +
 * unique visitors for each category that's had at least one visit).
 *
 * Optional ?days=N restricts to the last N days; omitted/invalid -> all
 * time. Data source is the Visit collection, written by the public
 * POST /api/visits/track endpoint (routes/publicVisitTracking.js) —
 * counts only reflect visits made since that tracking went live, not
 * historical traffic from before.
 *
 * Response shape:
 *   {
 *     totalVisits, uniqueVisitors, homeVisits,
 *     byCategory: [{ categorySlug, categoryName, visits, uniqueVisitors }]
 *   }
 */
router.get("/visit-stats", verifyAdmin, async (req, res) => {
  try {
    const days = Number(req.query.days);
    const match = {};
    if (Number.isFinite(days) && days > 0) {
      match.createdAt = { $gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
    }

    const [totalVisits, uniqueVisitorsAgg, homeVisits, byCategory] = await Promise.all([
      Visit.countDocuments(match),

      Visit.aggregate([
        { $match: match },
        { $group: { _id: "$visitorId" } },
        { $count: "count" },
      ]),

      Visit.countDocuments({ ...match, type: "home" }),

      Visit.aggregate([
        { $match: { ...match, type: "category", categorySlug: { $ne: null } } },
        {
          $group: {
            _id: "$categorySlug",
            categoryName: { $last: "$categoryName" },
            visits: { $sum: 1 },
            uniqueVisitors: { $addToSet: "$visitorId" },
          },
        },
        {
          $project: {
            _id: 0,
            categorySlug: "$_id",
            categoryName: 1,
            visits: 1,
            uniqueVisitors: { $size: "$uniqueVisitors" },
          },
        },
        { $sort: { visits: -1 } },
      ]),
    ]);

    return res.json({
      totalVisits,
      uniqueVisitors: uniqueVisitorsAgg[0]?.count ?? 0,
      homeVisits,
      byCategory,
    });
  } catch (err) {
    console.error("GET /api/admin/visit-stats error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
