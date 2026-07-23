/**
 * components/admin/ApiKeyFormModal.jsx  (Part 12   Prompt 9: Key Pool Admin UI)
 *
 * "Add API Key" modal for the ApiKey vault. Styled to match
 * CreateUserModal.jsx: same backdrop/card/header treatment, same
 * Escape-to-close behavior, same two-phase layout (form → result screen)
 * rather than a plain toast-and-close.
 *
 * Flow:
 *   1. Admin fills Provider / Label / Model / API Key and submits.
 *   2. addApiKey() saves it to the vault (encrypted server-side).
 *   3. Immediately, testApiKey() fires a real trivial completion call
 *      through that key's provider adapter, so the admin finds out right
 *      away whether the key actually works   not just that it was saved.
 *   4. The result screen shows that outcome plainly (green success /
 *      amber "saved but the test call failed") with an option to add
 *      another key or close.
 *
 * `onSaved` is called once right after the key is created (so the parent
 * list shows the new row immediately) and is safe to call again after the
 * test result comes back  the parent's refetch is cheap and idempotent.
 */

import { useState, useEffect, useRef } from "react";
import { addApiKey, testApiKey } from "../../api/apiKeys";
import { PROVIDER_META, PROVIDER_ORDER } from "./ProviderBadge";

const EMPTY_FORM = { provider: "groq", label: "", model: "", apiKey: "", baseUrl: "" };

export default function ApiKeyFormModal({ onClose, onSaved }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // { success, message } | null
  const [savedKey, setSavedKey] = useState(null); // safeApiKey once created

  useEffect(() => {
    function onKey(e) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const backdropRef = useRef(null);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }

  function validate() {
    const next = {};

    if (!form.label.trim()) {
      next.label = "Label is required.";
    }

    // Trim before validating/submitting   a trailing newline or space from
    // a paste is the most common reason a perfectly valid key looks "too
    // short" or fails auth once it hits the provider.
    const cleanModel = form.model.trim();
    if (!cleanModel) {
      next.model = "Model name is required.";
    }

    const cleanKey = form.apiKey.trim();
    if (!cleanKey) {
      next.apiKey = "API key is required.";
    } else if (cleanKey.length < 8) {
      next.apiKey = "That key looks too short to be valid.";
    }

    if (form.provider === "custom") {
      const cleanBaseUrl = form.baseUrl.trim();
      if (!cleanBaseUrl) {
        next.baseUrl = "Base URL is required for a custom provider.";
      } else if (!cleanBaseUrl.startsWith("https://")) {
        next.baseUrl = 'Base URL must start with "https://".';
      }
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setSaving(true);
    try {
      const { data } = await addApiKey({
        provider: form.provider,
        label: form.label.trim(),
        model: form.model.trim(),
        apiKey: form.apiKey.trim(),
        ...(form.provider === "custom" ? { baseUrl: form.baseUrl.trim() } : {}),
      });

      setSavedKey(data.key);
      onSaved?.(); // refresh the parent list right away (status: "unknown" for now)

      // ── Immediate test call, so the admin gets instant feedback ──
      setTesting(true);
      try {
        const { data: testData } = await testApiKey(data.key.id);
        setTestResult(testData);
      } catch (testErr) {
        setTestResult({
          success: false,
          message:
            testErr.response?.data?.message || "Could not reach the test endpoint. Try Test Now from the table.",
        });
      } finally {
        setTesting(false);
        onSaved?.(); // refresh again so the table reflects the post-test status
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || "Could not save this API key.";
      if (status === 400) {
        // Field-level 400s from createKey are plain-text messages, not
        // per-field   surface as a generic apiKey-area error since that's
        // the most common cause (too-short key).
        setErrors((prev) => ({ ...prev, apiKey: msg }));
      } else {
        setErrors((prev) => ({ ...prev, form: msg }));
      }
    } finally {
      setSaving(false);
    }
  }

  function handleAddAnother() {
    setForm(EMPTY_FORM);
    setErrors({});
    setSavedKey(null);
    setTestResult(null);
  }

  const modelPlaceholder = PROVIDER_META[form.provider]?.modelHint || "model name";
  const canSubmit = !saving && !savedKey;

  return (
    <div
      ref={backdropRef}
      onClick={(e) => e.target === backdropRef.current && onClose()}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
    >
      <div className="bg-surface rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col p-0">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0">
          <h2 className="text-txt-primary text-xl font-bold">
            {savedKey ? "Key Added" : "Add API Key"}
          </h2>
          <button
            onClick={onClose}
            className="text-txt-muted hover:text-txt-primary transition text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1">
          {savedKey ? (
            /* ══ Result screen ══════════════════════════════════ */
            <div className="space-y-5">
              <div className="bg-bg border border-border rounded-xl p-4 space-y-2">
                <p className="text-sm text-txt-primary font-semibold">
                  {savedKey.label}{" "}
                  <span className="text-txt-muted font-normal">
                    ({PROVIDER_META[savedKey.provider]?.label || savedKey.provider})
                  </span>
                </p>
                <p className="text-xs text-txt-secondary">
                  Model: <span className="font-mono">{savedKey.model}</span>
                </p>
                {savedKey.provider === "custom" && savedKey.baseUrl && (
                  <p className="text-xs text-txt-secondary">
                    Endpoint:{" "}
                    <span className="font-mono break-all">
                      {(() => {
                        try {
                          return new URL(savedKey.baseUrl).hostname;
                        } catch {
                          return savedKey.baseUrl;
                        }
                      })()}
                    </span>
                  </p>
                )}
                <p className="text-xs text-txt-secondary">
                  Key: <span className="font-mono">••••••{savedKey.keyPreview}</span>
                </p>
              </div>

              {testing && (
                <div className="flex items-center gap-2 text-sm text-txt-secondary">
                  <span className="w-4 h-4 border-2 border-brand border-t-transparent rounded-full animate-spin" />
                  Testing the key against {PROVIDER_META[savedKey.provider]?.label || savedKey.provider}…
                </div>
              )}

              {!testing && testResult && (
                <div
                  className={`rounded-xl px-4 py-3 text-sm ${
                    testResult.success
                      ? "bg-success-light text-success-darker border border-success/30"
                      : "bg-accent-light text-accent-darker border border-accent/30"
                  }`}
                >
                  <p className="font-semibold mb-0.5">
                    {testResult.success ? "Key is working" : "Saved, but the test call failed"}
                  </p>
                  <p className="text-xs opacity-90 break-words">{testResult.message}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={handleAddAnother}
                  className="flex-1 py-2.5 text-sm font-semibold rounded-lg border border-border text-txt-secondary hover:bg-bg transition"
                >
                  Add Another
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 bg-brand hover:bg-brand-dark text-white text-sm font-semibold py-2.5 rounded-lg transition"
                >
                  Done
                </button>
              </div>
            </div>
          ) : (
            /* ══ Form ══════════════════════════════════════════ */
            <div className="space-y-5">
              {errors.form && (
                <p className="text-xs text-danger bg-danger-light/40 border border-danger/30 rounded-lg px-3 py-2">
                  {errors.form}
                </p>
              )}

              {/* Provider */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  Provider <span className="text-danger">*</span>
                </label>
                <select
                  value={form.provider}
                  onChange={(e) => updateField("provider", e.target.value)}
                  className="w-full bg-surface border border-border text-txt-primary text-sm rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand"
                >
                  {PROVIDER_ORDER.map((p) => (
                    <option key={p} value={p}>
                      {PROVIDER_META[p].label}
                    </option>
                  ))}
                </select>
                {form.provider === "custom" && (
                  <p className="text-xs text-txt-muted mt-1.5 leading-relaxed">
                    Works with any OpenAI-compatible chat completions API   e.g. Mistral,
                    Cerebras, DeepSeek, Together AI, Fireworks AI, GitHub Models. Paste the
                    full endpoint URL below.
                  </p>
                )}
              </div>

              {/* Label */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  Label <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.label}
                  onChange={(e) => updateField("label", e.target.value)}
                  placeholder='e.g. "Groq   personal account"'
                  className={`w-full bg-surface border text-txt-primary placeholder:text-txt-muted text-sm rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand ${
                    errors.label ? "border-danger" : "border-border"
                  }`}
                />
                {errors.label && <p className="text-xs text-danger mt-1">{errors.label}</p>}
              </div>

              {/* Model */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  Model Name <span className="text-danger">*</span>
                </label>
                <input
                  type="text"
                  value={form.model}
                  onChange={(e) => updateField("model", e.target.value)}
                  placeholder={modelPlaceholder}
                  className={`w-full bg-surface border text-txt-primary placeholder:text-txt-muted text-sm font-mono rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand ${
                    errors.model ? "border-danger" : "border-border"
                  }`}
                />
                {errors.model && <p className="text-xs text-danger mt-1">{errors.model}</p>}
              </div>

              {/* Base URL — only for custom (OpenAI-compatible) providers */}
              {form.provider === "custom" && (
                <div>
                  <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                    API Base URL <span className="text-danger">*</span>
                  </label>
                  <input
                    type="text"
                    value={form.baseUrl}
                    onChange={(e) => updateField("baseUrl", e.target.value)}
                    placeholder="https://api.example.com/v1/chat/completions"
                    className={`w-full bg-surface border text-txt-primary placeholder:text-txt-muted text-sm font-mono rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand ${
                      errors.baseUrl ? "border-danger" : "border-border"
                    }`}
                  />
                  {errors.baseUrl && <p className="text-xs text-danger mt-1">{errors.baseUrl}</p>}
                  <p className="text-xs text-txt-muted mt-1">
                    Paste the full chat completions endpoint URL from your provider's docs   used
                    exactly as given, nothing is appended to it.
                  </p>
                </div>
              )}

              {/* API Key */}
              <div>
                <label className="text-txt-secondary font-medium text-xs block mb-1.5">
                  API Key <span className="text-danger">*</span>
                </label>
                <input
                  type="password"
                  autoComplete="off"
                  value={form.apiKey}
                  onChange={(e) => updateField("apiKey", e.target.value)}
                  placeholder="Paste the raw key   it's encrypted before it's stored"
                  className={`w-full bg-surface border text-txt-primary placeholder:text-txt-muted text-sm font-mono rounded-lg px-3 py-2.5 outline-none transition focus:ring-2 focus:ring-brand ${
                    errors.apiKey ? "border-danger" : "border-border"
                  }`}
                />
                {errors.apiKey && <p className="text-xs text-danger mt-1">{errors.apiKey}</p>}
                <p className="text-xs text-txt-muted mt-1">
                  Never shown again after saving   only the last 4 characters are kept for display.
                </p>
              </div>

              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="w-full bg-brand hover:bg-brand-dark disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2"
              >
                {saving && (
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                )}
                {saving ? "Saving…" : "Add Key & Test"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
