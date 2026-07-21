/**
 * src/pages/admin/ChatAnalyticsPage.jsx  (Part 11   Prompt 5)
 *
 * Read-only analytics view for the AI chatbot, sourced from
 * GET /api/admin/chat-analytics (aggregated from the anonymized ChatLog
 * model   no message content is ever shown here, because none was ever
 * stored).
 *
 * Styled to match AdminHomePage.jsx: same gradient header banner, same
 * StatCard grid, same toast-on-error pattern instead of inline banners.
 */

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import api from "../../api/axios";
import StatCard from "../../components/admin/StatCard";
import { PROVIDER_META, PROVIDER_ORDER } from "../../components/admin/ProviderBadge";

document.title = "AI Chatbot Analytics | PrepPk Admin";

// ── Icons ─────────────────────────────────────────────────────
function MessagesIcon() {
  return (
    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function SuccessIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function ResponseTimeIcon() {
  return (
    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function GuestIcon() {
  return (
    <svg className="w-5 h-5 text-green-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function PremiumIcon() {
  return (
    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function WindowStatsRow({ title, stats, loading }) {
  return (
    <div>
      <h2 className="text-xs font-semibold text-txt-muted uppercase tracking-widest mb-4">
        {title}
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-4">
        <StatCard
          icon={<MessagesIcon />}
          label="Total Messages"
          value={stats?.totalMessages ?? 0}
          loading={loading}
          accentClass="bg-blue-900"
        />
        <StatCard
          icon={<SuccessIcon />}
          label="Success Rate"
          value={stats?.successRate ?? 0}
          loading={loading}
          accentClass="bg-emerald-900"
          subtitle={
            stats?.successRate != null
              ? `${stats.successCount} of ${stats.totalMessages} succeeded`
              : "No messages yet"
          }
        />
        <StatCard
          icon={<ResponseTimeIcon />}
          label="Avg Response (ms)"
          value={stats?.avgResponseTimeMs ?? 0}
          loading={loading}
          accentClass="bg-amber-900"
        />
        <StatCard
          icon={<GuestIcon />}
          label="Guest Messages"
          value={stats?.guestCount ?? 0}
          loading={loading}
          accentClass="bg-green-900"
        />
        <StatCard
          icon={<PremiumIcon />}
          label="Premium Messages"
          value={stats?.premiumCount ?? 0}
          loading={loading}
          accentClass="bg-amber-900"
        />
      </div>
    </div>
  );
}

// ── Provider Breakdown (Part 12   Prompt 10) ─────────────────────────
// Simple CSS bar chart, no charting library needed for five bars. Built
// from PROVIDER_ORDER (not just whatever came back in the data) so a
// provider that's in the pool but got ZERO traffic this week still shows
// up as an empty bar   that silence is exactly what answers "is the pool
// actually balancing traffic, or hammering one provider" at a glance.
function ProviderBreakdownSection({ data, loading }) {
  const countByProvider = Object.fromEntries((data || []).map((d) => [d.provider, d.count]));
  const rows = PROVIDER_ORDER
    .map((provider) => ({ provider, count: countByProvider[provider] || 0 }))
    .sort((a, b) => b.count - a.count);

  const totalMessages = rows.reduce((sum, r) => sum + r.count, 0);
  const maxCount = Math.max(...rows.map((r) => r.count), 1);

  return (
    <div>
      <h2 className="text-xs font-semibold text-txt-muted uppercase tracking-widest mb-4">
        Provider Breakdown <span className="normal-case text-txt-muted/70">(last 7 days)</span>
      </h2>

      <div className="bg-surface border border-border rounded-2xl p-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-6 bg-bg rounded-lg animate-pulse"
                style={{ width: `${85 - i * 15}%` }}
              />
            ))}
          </div>
        ) : totalMessages === 0 ? (
          <p className="text-txt-muted text-sm text-center py-6">
            No provider-served messages in the last 7 days yet   check back once the chatbot
            has answered a few questions.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map(({ provider, count }) => {
              const meta = PROVIDER_META[provider] || { label: provider, dot: "bg-txt-muted" };
              const widthPct = count > 0 ? Math.max((count / maxCount) * 100, 4) : 0;

              return (
                <div key={provider} className="flex items-center gap-3">
                  <span className="w-24 shrink-0 text-xs font-medium text-txt-secondary flex items-center gap-1.5">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${meta.dot}`} />
                    {meta.label}
                  </span>
                  <div className="flex-1 h-6 bg-bg rounded-lg overflow-hidden">
                    {count > 0 && (
                      <div
                        className={`h-full rounded-lg ${meta.dot} opacity-80 transition-all duration-500`}
                        style={{ width: `${widthPct}%` }}
                      />
                    )}
                  </div>
                  <span className="w-10 shrink-0 text-right text-xs font-semibold text-txt-primary tabular-nums">
                    {count}
                  </span>
                </div>
              );
            })}

            <p className="text-xs text-txt-muted pt-1">
              {totalMessages} message{totalMessages === 1 ? "" : "s"} served across{" "}
              {rows.filter((r) => r.count > 0).length} provider
              {rows.filter((r) => r.count > 0).length === 1 ? "" : "s"} this week.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ChatAnalyticsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function fetchAnalytics() {
      try {
        const { data } = await api.get("/admin/chat-analytics");
        if (!cancelled) setData(data);
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err.response?.data?.message || "Could not load chatbot analytics.",
            { id: "chat-analytics-error" }
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchAnalytics();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">
      {/* ── Header banner ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-surface to-surface border border-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10">
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4">
            <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
            AI Chatbot
          </span>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary leading-tight mb-3">
            Chatbot Analytics
          </h1>

          <p className="text-txt-secondary text-sm sm:text-base max-w-xl leading-relaxed">
            Anonymized usage numbers for the PrepPk AI Study Assistant   never message
            content, just counts and timing pulled from server-side logs. Use the
            Settings page to pause the chatbot entirely if the free API quota runs out.
          </p>
        </div>
      </div>

      {/* ── Today ──────────────────────────────────────────── */}
      <WindowStatsRow title="Today" stats={data?.today} loading={loading} />

      {/* ── Last 7 days ────────────────────────────────────── */}
      <WindowStatsRow title="Last 7 Days" stats={data?.thisWeek} loading={loading} />

      {/* ── Provider Breakdown ────────────────────────────── */}
      <ProviderBreakdownSection data={data?.providerBreakdown} loading={loading} />

      {!loading && (
        <p className="text-xs text-txt-muted">
          * "Success Rate" reflects replies actually returned to the user (including the
          canned prompt-injection-filter reply). Blocked/rejected messages before the Groq
          call (empty, over-length, profanity/spam) are not counted here.
        </p>
      )}
    </div>
  );
}
