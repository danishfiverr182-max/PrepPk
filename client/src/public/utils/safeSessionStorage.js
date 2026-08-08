/**
 * src/public/utils/safeSessionStorage.js
 *
 * A safe wrapper around sessionStorage, mirroring safeStorage.js exactly
 * (same API, same in-memory fallback for private-browsing edge cases) but
 * backed by sessionStorage instead of localStorage.
 *
 * Why sessionStorage instead of localStorage for in-progress test state:
 *   sessionStorage is scoped to a single tab and is automatically cleared
 *   by the browser when that tab or window is actually closed, while it
 *   survives page refreshes and switching to another tab and back. That
 *   maps exactly onto the desired behaviour for resuming a test:
 *     - Refresh mid-test               → resume where you left off
 *     - Switch tabs and come back      → resume where you left off
 *     - Close the tab/window           → next visit starts at Q1
 *     - Click "Exit" mid-test          → next visit starts at Q1
 *       (the Exit handlers explicitly clear progress/timer on click,
 *       since a deliberate exit should never resume either)
 *
 * Previously this data lived in localStorage (via safeStorage.js), which
 * persists indefinitely across tab/browser closes — that's why closing or
 * exiting a test used to resume at the last-answered question instead of
 * restarting. Only useTestProgress.js and useTimer.js use this module;
 * everything else that needs longer-lived persistence keeps using
 * safeStorage.js (localStorage) unchanged.
 *
 * API mirrors localStorage/safeStorage:
 *   safeSessionStorage.getItem(key)      → string | null
 *   safeSessionStorage.setItem(key, val) → void
 *   safeSessionStorage.removeItem(key)   → void
 *   safeSessionStorage.getJson(key, def) → parsed value | def
 *   safeSessionStorage.setJson(key, val) → void
 */

// Module-level fallback map shared across all imports in this session
const memoryStore = new Map();

function isSessionStorageAvailable() {
  try {
    const testKey = "__safe_session_storage_test__";
    sessionStorage.setItem(testKey, "1");
    sessionStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
}

// Detect once at module load time
const useSessionStorage = isSessionStorageAvailable();

const safeSessionStorage = {
  getItem(key) {
    if (useSessionStorage) {
      try {
        return sessionStorage.getItem(key);
      } catch {
        return memoryStore.get(key) ?? null;
      }
    }
    return memoryStore.get(key) ?? null;
  },

  setItem(key, value) {
    if (useSessionStorage) {
      try {
        sessionStorage.setItem(key, value);
        return;
      } catch {
        // Fall through to memory store on quota exceeded or security error
      }
    }
    memoryStore.set(key, value);
  },

  removeItem(key) {
    if (useSessionStorage) {
      try {
        sessionStorage.removeItem(key);
        return;
      } catch {
        // Fall through
      }
    }
    memoryStore.delete(key);
  },

  /**
   * Convenience: read JSON with a default fallback.
   * Returns parsed value or `defaultVal` on any error.
   */
  getJson(key, defaultVal = null) {
    try {
      const raw = this.getItem(key);
      return raw ? JSON.parse(raw) : defaultVal;
    } catch {
      return defaultVal;
    }
  },

  /**
   * Convenience: write a value as JSON.
   */
  setJson(key, value) {
    try {
      this.setItem(key, JSON.stringify(value));
    } catch {
      // Non-fatal
    }
  },
};

export default safeSessionStorage;
