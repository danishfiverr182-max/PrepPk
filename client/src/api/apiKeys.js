/**
 * src/api/apiKeys.js  (Part 12   Prompt 9: Key Pool Admin UI)
 *
 * Talks to the ApiKey vault endpoints mounted at /api/admin/api-keys
 * (server/routes/apiKeyRoutes.js, all behind verifyAdmin):
 *
 *   GET    /api/admin/api-keys              → getApiKeys()
 *   POST   /api/admin/api-keys              → addApiKey(payload)
 *   PATCH  /api/admin/api-keys/:id/toggle   → toggleApiKey(id)
 *   DELETE /api/admin/api-keys/:id          → deleteApiKey(id)
 *   POST   /api/admin/api-keys/:id/test     → testApiKey(id)
 *
 * Uses the shared `api` axios instance from src/api/axios.js   the same
 * instance ChatAnalyticsPage.jsx, AdminUsersPage.jsx, AdminNav.jsx, etc.
 * all use for `/api/admin/*` calls   rather than src/api/adminApi.js.
 * That second instance targets the separate secret ADMIN_PATH
 * (admin-x9k2/*) used only for the login/verify-code/session handshake;
 * everyday admin CRUD (including this vault) goes through `/api/admin/*`,
 * verified by the verifyAdmin middleware reading the same adminToken
 * cookie. Both instances already set `withCredentials: true`, which is
 * what lets that httpOnly adminToken cookie ride along automatically  
 * none of the functions below need to touch it directly.
 *
 * Every call here returns the raw axios response (matching how
 * ChatAnalyticsPage/AdminUsersPage consume `api.get(...)` elsewhere   
 * i.e. callers read `.data`) rather than unwrapping it, so error handling
 * (toasts, field-level messages) stays at the call site where the UI
 * context to react to a given failure actually lives.
 */

import api from "./axios";

/** GET all vault entries (encryptedKey never included by the server). */
export function getApiKeys() {
  return api.get("/admin/api-keys");
}

/**
 * POST a new vault entry.
 * @param {{ provider: string, label: string, apiKey: string, model: string }} payload
 */
export function addApiKey(payload) {
  return api.post("/admin/api-keys", payload);
}

/** PATCH   flips isActive for one key. */
export function toggleApiKey(id) {
  return api.patch(`/admin/api-keys/${id}/toggle`);
}

/** DELETE   removes one key from the vault permanently. */
export function deleteApiKey(id) {
  return api.delete(`/admin/api-keys/${id}`);
}

/**
 * POST   makes a real trivial completion call through the key's provider
 * adapter and persists the resulting health status. Always resolves with
 * `{ success: boolean, message: string }` in the response body   the
 * request itself only rejects on a genuine network/5xx failure, not on a
 * "the key didn't work" result (that's `success: false` in a 200).
 */
export function testApiKey(id) {
  return api.post(`/admin/api-keys/${id}/test`);
}
