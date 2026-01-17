import { Preferences } from '@capacitor/preferences';
import { apiFetch } from './apiFetch';

const KEY = "comicscanner_device_id";
let cachedId = null;

// Helper: Generate UUID v4
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Synchronous getter.
 * Returns null if not yet initialized.
 * Replaces "dev_init_pending" which was unsafe.
 */
export function getDeviceId() {
  if (cachedId) return cachedId;
  if (typeof window !== "undefined") {
    return localStorage.getItem(KEY);
  }
  return null;
}

/**
 * Ensures we have a valid installId before allowing API calls.
 * 1. Checks memory/prefs.
 * 2. If missing, attempts /api/install (Blocking).
 * 3. If fails (Offline/RateLimit), generates local UUID (Fallback).
 */
let initPromise = null;

export async function ensureInstallId() {
  if (cachedId) return cachedId;

  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      // 1. Load from Persistence
      const { value } = await Preferences.get({ key: KEY });

      // Migration: Check legacy localStorage if Prefs empty
      let currentId = value;
      if (!currentId && typeof window !== 'undefined') {
        currentId = localStorage.getItem(KEY);
      }

      // Check if valid UUID (simple check)
      const isUUID = currentId && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(currentId);

      if (isUUID) {
        cachedId = currentId;
        console.log("[Identity] Restored:", cachedId);
        // Fire-and-forget server sync (don't block)
        registerWithServer(cachedId).catch(console.warn);
        return cachedId;
      }

      // 2. No valid ID? Must Register.
      console.log("[Identity] Initializing new check...");

      // Generate a candidate ID locally to offer the server
      const candidateId = generateUUID();

      // Try Server Registration
      try {
        const serverId = await registerWithServer(candidateId); // Pass candidate? No, apiFetch might loop.
        // Wait, if we use apiFetch inside registerWithServer, and apiFetch calls ensureInstallId... LOOP.
        // We must use raw fetch in registerWithServer to avoid loop.
        cachedId = serverId;
      } catch (e) {
        console.warn("[Identity] Server registration failed, using fallback UUID.", e);
        // Fallback: Use the candidate ID locally
        cachedId = candidateId;
      }

      // 3. Persist
      await Preferences.set({ key: KEY, value: cachedId });
      if (typeof window !== 'undefined') {
        localStorage.setItem(KEY, cachedId);
      }

      return cachedId;

    } catch (e) {
      console.error("[Identity] Fatal Init Error", e);
      return null;
    } finally {
      initPromise = null;
    }
  })();

  return initPromise;
}

// Internal raw fetch to avoid circular dependency with apiFetch
async function registerWithServer(candidateId) {
  // Avoid circular import issues by using window.fetch directly or a simplified fetch
  // We need API_BASE_URL.
  // We can't import apiFetch if apiFetch imports us. 
  // But apiFetch imports getDeviceId, not ensureInstallId directly? 
  // Actually apiFetch WILL import ensureInstallId.

  // We need the config.
  const { API_BASE_URL } = await import('../config');

  const url = new URL('/api/install', API_BASE_URL).toString();

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Don't send x-install-id header yet
    },
    body: JSON.stringify({
      // If we have a candidate, suggest it? 
      // Currently backend upserts by device_id matching... 
      // But if we are new, we just want a new one.
      // Let's NOT send a candidate if we are truly new, let backend generate?
      // OR send candidate as 'client_generated_id'?
      // Schema: device_id is unique. 
      // Better: Backend generates if body is empty?
      // Let's send the candidate as a hint if we want to claim it.
      installId: candidateId,
      platform: window.Capacitor?.getPlatform() || 'web',
      appVersion: process.env.APP_VERSION || '1.0.0'
    })
  });

  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (!data.ok || !data.installId) throw new Error("Invalid response");

  return data.installId;
}

// Exposed for App.jsx to kick off early
export const initializeDeviceId = ensureInstallId;
