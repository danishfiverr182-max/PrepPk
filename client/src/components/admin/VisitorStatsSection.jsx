/**
 * components/admin/VisitorStatsSection.jsx
 *
 * "Visitor Stats" panel for the admin dashboard: total site visits,
 * unique visitors, homepage visits, and a per-category breakdown table.
 * Data comes from GET /api/admin/visit-stats (server/routes/adminDashboard.js),
 * which reads the Visit collection written by the public
 * POST /api/visits/track endpoint (fired from HomePage.jsx and
 * CategoryPage.jsx via hooks/useTrackVisit.js).
 *
 * Note: counts only reflect visits logged since that tracking went live —
 * there's no historical backfill for traffic before this feature existed.
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import StatCard from "./StatCard";

const RANGE_OPTIONS = [
  { label: "Last 7 days", days: 7 },
  { label: "Last 30 days", days: 30 },
  { label: "All time", days: null },
];

function TotalVisitsIcon() {
  return (
    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}

function UniqueVisitorsIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function HomeVisitsIcon() {
  return (
    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1h4a1 1 0 001-1V10" />
    </svg>
  );
}

export default function VisitorStatsSection() {
  const [rangeDays, setRangeDays] = useState(30);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const query = rangeDays ? `?days=${rangeDays}` : "";

    api
      .get(`/admin/visit-stats${query}`)
      .then(({ data }) => {
        if (!cancelled) setStats(data);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Could not load visitor stats.",
            { id: "visit-stats-error" }
          );
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [rangeDays]);

  const byCategory = stats?.byCategory || [];

  return (
    <div>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h2 className="text-xs font-semibold text-txt-muted uppercase tracking-widest">
            Visitor Stats
          </h2>
          <p className="text-xs text-txt-muted mt-1">
            Counts reflect visits logged since this feature went live — no
            historical backfill for earlier traffic.
          </p>
        </div>

        {/* Range selector */}
        <div className="flex items-center gap-1 bg-surface border border-border rounded-xl p-1">
          {RANGE_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              onClick={() => setRangeDays(opt.days)}
              className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${
                rangeDays === opt.days
                  ? "bg-accent text-white"
                  : "text-txt-secondary hover:text-txt-primary"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Totals */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
        <StatCard
          icon={<TotalVisitsIcon />}
          label="Total Visits"
          value={stats?.totalVisits ?? 0}
          loading={loading}
          accentClass="bg-blue-900"
        />
        <StatCard
          icon={<UniqueVisitorsIcon />}
          label="Unique Visitors"
          value={stats?.uniqueVisitors ?? 0}
          loading={loading}
          accentClass="bg-emerald-900"
        />
        <StatCard
          icon={<HomeVisitsIcon />}
          label="Homepage Visits"
          value={stats?.homeVisits ?? 0}
          loading={loading}
          accentClass="bg-amber-900"
        />
      </div>

      {/* Per-category breakdown */}
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-border">
          <p className="text-xs font-semibold text-txt-secondary uppercase tracking-widest">
            Visits by Category
          </p>
        </div>

        {loading ? (
          <div className="p-5 space-y-2.5">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-5 bg-bg rounded animate-pulse" />
            ))}
          </div>
        ) : byCategory.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-txt-secondary">
              No category visits recorded {rangeDays ? "in this range" : "yet"}.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-txt-muted uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-2.5 font-semibold">Category</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Visits</th>
                  <th className="px-5 py-2.5 font-semibold text-right">Unique Visitors</th>
                </tr>
              </thead>
              <tbody>
                {byCategory.map((row) => (
                  <tr
                    key={row.categorySlug}
                    className="border-b border-border/60 last:border-0 hover:bg-bg/40 transition"
                  >
                    <td className="px-5 py-2.5 text-txt-primary font-medium">
                      {row.categoryName || row.categorySlug}
                    </td>
                    <td className="px-5 py-2.5 text-right text-txt-secondary tabular-nums">
                      {row.visits.toLocaleString()}
                    </td>
                    <td className="px-5 py-2.5 text-right text-txt-secondary tabular-nums">
                      {row.uniqueVisitors.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
