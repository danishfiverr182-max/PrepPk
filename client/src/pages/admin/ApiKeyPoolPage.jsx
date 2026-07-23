/**
 * src/pages/admin/ApiKeyPoolPage.jsx  (Part 12   Prompt 9: Key Pool Admin UI)
 *
 * Admin-facing management UI for the multi-provider ApiKey vault (Prompt 6)
 * that the key-pool orchestrator (Prompt 8, server/services/aiKeyPool.js)
 * draws from at chat time. Lets an admin add/remove keys, flip them
 * active/inactive, and fire a manual health test, without ever seeing the
 * raw key again after it's saved.
 *
 * Styled to match ChatAnalyticsPage.jsx (gradient header banner, StatCard
 * summary strip) and AdminUsersPage.jsx (table layout, ConfirmDialog
 * delete pattern, Badge status pills)   this page sits right next to
 * Chatbot Analytics in the admin nav, so it intentionally looks like a
 * sibling of both rather than introducing a third visual style.
 *
 * Auto-refresh: keys can enter/leave cooldown from real chat traffic at
 * any time (rate limits, transient provider errors), so this page polls
 * GET /admin/api-keys every 30s while mounted   a plain setInterval with
 * cleanup on unmount, no extra library needed for something this simple.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import toast from "react-hot-toast";
import { getApiKeys, toggleApiKey, deleteApiKey, testApiKey } from "../../api/apiKeys";
import StatCard from "../../components/admin/StatCard";
import Badge from "../../components/ui/Badge";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import ApiKeyFormModal from "../../components/admin/ApiKeyFormModal";
import ProviderBadge, { PROVIDER_ORDER } from "../../components/admin/ProviderBadge";
import { formatRelativeTime } from "../../utils/formatRelativeTime";

document.title = "API Key Pool | PrepPk Admin";

const AUTO_REFRESH_MS = 30_000;

// ── Icons (matching the inline-SVG style used in ChatAnalyticsPage) ────
function KeyIcon() {
  return (
    <svg className="w-5 h-5 text-blue-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
    </svg>
  );
}

function HealthyIcon() {
  return (
    <svg className="w-5 h-5 text-emerald-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CooldownIcon() {
  return (
    <svg className="w-5 h-5 text-amber-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function InvalidIcon() {
  return (
    <svg className="w-5 h-5 text-red-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
    </svg>
  );
}

// ── Status badge ─────────────────────────────────────────────────────
const STATUS_META = {
  healthy: { variant: "success", label: "Healthy" },
  rate_limited: { variant: "warning", label: "Rate Limited" },
  invalid: { variant: "danger", label: "Invalid" },
  unknown: { variant: "muted", label: "Unknown" },
};

function StatusBadge({ status, cooldownUntil }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const cooldownActive = cooldownUntil && new Date(cooldownUntil) > new Date();

  return (
    <Badge
      variant={meta.variant}
      title={cooldownActive ? `In cooldown until ${new Date(cooldownUntil).toLocaleTimeString()}` : undefined}
    >
      {meta.label}
    </Badge>
  );
}

// ── Skeleton row ─────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="bg-surface">
      {[160, 90, 160, 90, 70, 90, 140].map((w, i) => (
        <td key={i} className="px-4 py-3">
          <div className="h-4 bg-border rounded animate-pulse" style={{ width: w }} />
        </td>
      ))}
    </tr>
  );
}

function WarningIcon() {
  return (
    <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    </svg>
  );
}

// ── Pool health banner (Part 12   Prompt 10) ───────────────────────────
// Derived entirely from the same listKeys data the table already renders
//   no extra endpoint. Fires whenever fewer than 2 keys currently have
// status: "healthy", since the orchestrator (aiKeyPool.js) needs at least
// one live fallback beyond "whichever key happens to be up right now" to
// actually deliver on its failover promise. Silent (renders nothing) once
// there are 2+ healthy keys, and silent while the initial fetch is still
// loading so it doesn't flash a false "down" state on page load.
function PoolHealthBanner({ healthyCount, loading }) {
  if (loading || healthyCount >= 2) return null;

  const isDown = healthyCount === 0;

  return (
    <div
      className={`flex items-start gap-3 rounded-2xl border p-4 ${
        isDown
          ? "bg-danger-light border-danger/30 text-danger-darker dark:bg-red-900/20 dark:border-red-700/40 dark:text-red-300"
          : "bg-accent-light border-accent/30 text-accent-darker dark:bg-amber-900/20 dark:border-amber-700/40 dark:text-amber-300"
      }`}
      role="alert"
    >
      <WarningIcon />
      <div className="text-sm leading-relaxed">
        <p className="font-semibold">
          {isDown
            ? "No healthy keys — chatbot is currently down."
            : "Only 1 healthy key remaining — add more keys to avoid chatbot downtime."}
        </p>
        <p className="opacity-90 mt-0.5">
          {isDown
            ? "Every key in the pool is inactive, invalid, or on cooldown, so the chatbot can't serve any replies right now. Add or fix a key below."
            : "If this last healthy key hits a rate limit or goes invalid, the chatbot has nothing left to fail over to."}
        </p>
      </div>
    </div>
  );
}

export default function ApiKeyPoolPage() {
  const [keys, setKeys] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null); // { _id, label }
  const [deleting, setDeleting] = useState(false);
  const [busyIds, setBusyIds] = useState({}); // { [id]: "toggle" | "test" }

  const cancelledRef = useRef(false);

  const fetchKeys = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await getApiKeys();
      if (!cancelledRef.current) setKeys(data.keys || []);
    } catch (err) {
      if (!cancelledRef.current) {
        toast.error(err.response?.data?.message || "Could not load the API key pool.", {
          id: "api-keys-error",
        });
      }
    } finally {
      if (!cancelledRef.current && !silent) setLoading(false);
    }
  }, []);

  // Initial load + 30s auto-refresh while the page is mounted.
  useEffect(() => {
    cancelledRef.current = false;
    fetchKeys();

    const interval = setInterval(() => fetchKeys({ silent: true }), AUTO_REFRESH_MS);

    return () => {
      cancelledRef.current = true;
      clearInterval(interval);
    };
  }, [fetchKeys]);

  function setBusy(id, action) {
    setBusyIds((prev) => ({ ...prev, [id]: action }));
  }
  function clearBusy(id) {
    setBusyIds((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
  }

  async function handleToggle(key) {
    setBusy(key.id, "toggle");
    // Optimistic flip
    setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, isActive: !k.isActive } : k)));
    try {
      await toggleApiKey(key.id);
      toast.success(`${key.label} ${key.isActive ? "deactivated" : "activated"}.`);
    } catch (err) {
      // Revert on failure
      setKeys((prev) => prev.map((k) => (k.id === key.id ? { ...k, isActive: key.isActive } : k)));
      toast.error(err.response?.data?.message || "Could not update this key.");
    } finally {
      clearBusy(key.id);
    }
  }

  async function handleTestNow(key) {
    setBusy(key.id, "test");
    try {
      const { data } = await testApiKey(key.id);
      if (data.success) {
        toast.success(data.message || `${key.label} is healthy.`);
      } else {
        toast.error(data.message || `${key.label} failed its test call.`);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not test this key.");
    } finally {
      clearBusy(key.id);
      fetchKeys({ silent: true }); // pick up the health status the test call just persisted
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteApiKey(deleteTarget.id);
      setKeys((prev) => prev.filter((k) => k.id !== deleteTarget.id));
      toast.success(`${deleteTarget.label} deleted.`);
      setDeleteTarget(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Could not delete this key.");
    } finally {
      setDeleting(false);
    }
  }

  // ── Summary counts ───────────────────────────────────────────────
  const total = keys.length;
  const healthyCount = keys.filter((k) => k.status === "healthy").length;
  const rateLimitedCount = keys.filter((k) => k.status === "rate_limited").length;
  const invalidCount = keys.filter((k) => k.status === "invalid").length;

  // ── Group by provider, in a stable order, skipping empty groups ──
  const grouped = PROVIDER_ORDER.map((provider) => ({
    provider,
    items: keys.filter((k) => k.provider === provider),
  })).filter((g) => g.items.length > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-8 md:space-y-10">
      {/* ── Header banner ──────────────────────────────────── */}
      <div className="bg-gradient-to-br from-surface to-surface border border-border rounded-2xl p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand/5 rounded-full -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 rounded-full translate-y-1/2 -translate-x-1/2 pointer-events-none" />

        <div className="relative z-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-widest text-brand bg-brand/10 border border-brand/20 px-3 py-1 rounded-full mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-brand animate-pulse" />
              AI Chatbot
            </span>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-txt-primary leading-tight mb-3">
              API Key Pool
            </h1>

            <p className="text-txt-secondary text-sm sm:text-base max-w-xl leading-relaxed">
              Manage the provider keys the chatbot rotates through. Status and usage refresh
              automatically every 30 seconds, since keys can go into cooldown from real traffic
              at any time.
            </p>
          </div>

          <button
            onClick={() => setShowAddModal(true)}
            className="flex-shrink-0 inline-flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition"
          >
            <PlusIcon />
            Add API Key
          </button>
        </div>
      </div>

      {/* ── Pool health warning ────────────────────────────── */}
      <PoolHealthBanner healthyCount={healthyCount} loading={loading} />

      {/* ── Summary strip ──────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard icon={<KeyIcon />} label="Total Keys" value={total} loading={loading} accentClass="bg-blue-900" />
        <StatCard icon={<HealthyIcon />} label="Healthy" value={healthyCount} loading={loading} accentClass="bg-emerald-900" />
        <StatCard icon={<CooldownIcon />} label="Rate Limited" value={rateLimitedCount} loading={loading} accentClass="bg-amber-900" />
        <StatCard icon={<InvalidIcon />} label="Invalid" value={invalidCount} loading={loading} accentClass="bg-red-900" />
      </div>

      {/* ── Grouped key table ──────────────────────────────── */}
      <div className="space-y-6">
        {loading && (
          <div className="overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-bg text-txt-secondary text-sm font-semibold uppercase tracking-wider">
                  <th className="text-left px-4 py-3">Label</th>
                  <th className="text-left px-4 py-3">Key</th>
                  <th className="text-left px-4 py-3">Model</th>
                  <th className="text-left px-4 py-3">Status</th>
                  <th className="text-left px-4 py-3">Uses</th>
                  <th className="text-left px-4 py-3">Last Used</th>
                  <th className="text-right px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {[1, 2, 3].map((i) => <SkeletonRow key={i} />)}
              </tbody>
            </table>
          </div>
        )}

        {!loading && grouped.length === 0 && (
          <div className="text-center py-16 bg-surface border border-border rounded-2xl">
            <p className="text-4xl mb-3">🔑</p>
            <p className="text-txt-muted text-sm mb-3">No API keys in the pool yet.</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="text-brand hover:text-brand-dark text-sm underline underline-offset-2 transition"
            >
              Add the first key
            </button>
          </div>
        )}

        {!loading &&
          grouped.map(({ provider, items }) => (
            <div key={provider} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <ProviderBadge provider={provider} className="text-sm font-semibold text-txt-primary" />
                <span className="text-xs text-txt-muted">
                  {items.length} key{items.length === 1 ? "" : "s"}
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-bg text-txt-secondary text-sm font-semibold uppercase tracking-wider">
                      <th className="text-left px-4 py-3">Label</th>
                      <th className="text-left px-4 py-3">Key</th>
                      <th className="text-left px-4 py-3">Model</th>
                      <th className="text-left px-4 py-3">Status</th>
                      <th className="text-left px-4 py-3">Uses</th>
                      <th className="text-left px-4 py-3">Last Used</th>
                      <th className="text-right px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {items.map((key, idx) => {
                      const busyAction = busyIds[key.id];
                      return (
                        <tr
                          key={key.id}
                          className={`${idx % 2 === 0 ? "bg-surface" : "bg-bg/50"} hover:bg-bg transition ${
                            !key.isActive ? "opacity-60" : ""
                          }`}
                        >
                          <td className="px-4 py-3 text-txt-primary font-semibold truncate max-w-[180px]">
                            {key.label}
                            {key.provider === "custom" && key.baseUrl && (
                              <span className="block text-xs font-normal text-txt-muted truncate">
                                {(() => {
                                  try {
                                    return new URL(key.baseUrl).hostname;
                                  } catch {
                                    return key.baseUrl;
                                  }
                                })()}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-txt-secondary">
                            ••••••{key.keyPreview}
                          </td>
                          <td className="px-4 py-3 font-mono text-txt-secondary truncate max-w-[160px]">
                            {key.model}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={key.status} cooldownUntil={key.cooldownUntil} />
                          </td>
                          <td className="px-4 py-3 text-txt-primary tabular-nums">{key.usageCount}</td>
                          <td className="px-4 py-3 text-txt-secondary whitespace-nowrap">
                            {formatRelativeTime(key.lastUsedAt)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              {/* Toggle Active/Inactive */}
                              <button
                                title={key.isActive ? "Deactivate" : "Activate"}
                                onClick={() => handleToggle(key)}
                                disabled={Boolean(busyAction)}
                                className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition disabled:opacity-40"
                              >
                                {busyAction === "toggle" ? (
                                  <span className="block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                ) : key.isActive ? (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M18.36 6.64a9 9 0 11-12.73 0M12 3v9" />
                                  </svg>
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                  </svg>
                                )}
                              </button>

                              {/* Test Now */}
                              <button
                                title="Test Now"
                                onClick={() => handleTestNow(key)}
                                disabled={Boolean(busyAction)}
                                className="p-1.5 rounded-lg text-brand hover:text-brand-dark hover:bg-bg transition disabled:opacity-40"
                              >
                                {busyAction === "test" ? (
                                  <span className="block w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                  </svg>
                                )}
                              </button>

                              {/* Delete */}
                              <button
                                title="Delete"
                                onClick={() => setDeleteTarget({ id: key.id, label: key.label })}
                                disabled={Boolean(busyAction)}
                                className="p-1.5 rounded-lg text-danger hover:text-red-700 hover:bg-bg transition disabled:opacity-40"
                              >
                                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
      </div>

      {/* ── Add Key Modal ──────────────────────────────────── */}
      {showAddModal && (
        <ApiKeyFormModal
          onClose={() => setShowAddModal(false)}
          onSaved={() => fetchKeys({ silent: true })}
        />
      )}

      {/* ── Delete confirmation ────────────────────────────── */}
      <ConfirmDialog
        isOpen={!!deleteTarget}
        title={`Delete "${deleteTarget?.label ?? ""}"?`}
        message="This permanently removes the key from the pool. Any in-flight chat requests currently using it will fail over to the next available key."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        dangerous
        loading={deleting}
      />
    </div>
  );
}
