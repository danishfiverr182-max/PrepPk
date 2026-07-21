/**
 * routes/adminChatAnalytics.js  (Part 11   Prompt 5)
 *
 * GET /api/admin/chat-analytics   protected by verifyAdmin
 *
 * Aggregated, anonymized usage stats for the AI chatbot, sourced from the
 * ChatLog model (Part 11   Prompt 2). Never touches message content since
 * ChatLog never stored it in the first place.
 *
 * Response shape:
 *   {
 *     today:    { totalMessages, successCount, failedCount, successRate, avgResponseTimeMs, guestCount, premiumCount },
 *     thisWeek: { totalMessages, successCount, failedCount, successRate, avgResponseTimeMs, guestCount, premiumCount },
 *     providerBreakdown: [ { provider: "groq", count: 42 }, ... ]
 *   }
 *
 * "today"    = since local midnight
 * "thisWeek" = rolling last 7 days (avoids start-of-week timezone ambiguity)
 * successRate is a percentage rounded to 1 decimal place, or null if there
 * were no messages in that window (avoids a misleading "0%").
 *
 * ── providerBreakdown (Part 12   Prompt 10) ────────────────────────────
 * Rolling-last-7-days count of messages served per provider, sourced from
 * the `provider` field ChatLog started recording in Part 12   Prompt 8.
 * Only rows with a non-null provider are counted (a null provider means
 * the request never reached the key pool   blocked by validation, the
 * content filter, the daily cap, or NO_KEYS_AVAILABLE   so it wouldn't
 * mean anything to attribute to a specific provider). Sorted by count
 * descending so the busiest provider is always first, which is exactly
 * what "is the pool actually balancing traffic" needs to answer at a
 * glance. Returns an empty array (not an error) when there's no data yet.
 */

import { Router } from "express";
import { verifyAdmin } from "../middleware/verifyAdmin.js";
import ChatLog from "../models/ChatLog.js";

const router = Router();

function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function sevenDaysAgo() {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function buildWindowStats(sinceDate) {
  const [totalMessages, successCount, guestCount, premiumCount, avgAgg] = await Promise.all([
    ChatLog.countDocuments({ createdAt: { $gte: sinceDate } }),
    ChatLog.countDocuments({ createdAt: { $gte: sinceDate }, success: true }),
    ChatLog.countDocuments({ createdAt: { $gte: sinceDate }, isPremiumUser: false }),
    ChatLog.countDocuments({ createdAt: { $gte: sinceDate }, isPremiumUser: true }),
    ChatLog.aggregate([
      { $match: { createdAt: { $gte: sinceDate } } },
      { $group: { _id: null, avgResponseTimeMs: { $avg: "$responseTimeMs" } } },
    ]),
  ]);

  const failedCount = totalMessages - successCount;
  const successRate =
    totalMessages > 0 ? Math.round((successCount / totalMessages) * 1000) / 10 : null;
  const avgResponseTimeMs =
    avgAgg[0]?.avgResponseTimeMs != null ? Math.round(avgAgg[0].avgResponseTimeMs) : null;

  return {
    totalMessages,
    successCount,
    failedCount,
    successRate,
    avgResponseTimeMs,
    guestCount,
    premiumCount,
  };
}

/**
 * Message count per provider over the last 7 days, sorted busiest-first.
 * Excludes rows where provider is null (request never reached the pool).
 */
async function buildProviderBreakdown(sinceDate) {
  const rows = await ChatLog.aggregate([
    { $match: { createdAt: { $gte: sinceDate }, provider: { $ne: null } } },
    { $group: { _id: "$provider", count: { $sum: 1 } } },
    { $sort: { count: -1 } },
  ]);

  return rows.map((r) => ({ provider: r._id, count: r.count }));
}

router.get("/chat-analytics", verifyAdmin, async (req, res) => {
  try {
    const since7d = sevenDaysAgo();
    const [today, thisWeek, providerBreakdown] = await Promise.all([
      buildWindowStats(startOfToday()),
      buildWindowStats(since7d),
      buildProviderBreakdown(since7d),
    ]);

    return res.json({ today, thisWeek, providerBreakdown });
  } catch (err) {
    console.error("GET /api/admin/chat-analytics error:", err.message);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
