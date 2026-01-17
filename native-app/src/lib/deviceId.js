import { Preferences } from '@capacitor/preferences';
import { apiFetch } from './apiFetch'; // Ensure we can import apiFetch

const KEY = "comicscan_device_id";
let cachedId = null;

// Synchronous getter for UI/API calls (returns cached or temp)
export function getDeviceId() {
  if (cachedId) return cachedId;

  if (typeof window !== "undefined") {
    const local = localStorage.getItem(KEY);
    if (local) {
      cachedId = local;
      return local;
    }
  }

  return "dev_init_pending";
}

// SS-003: Register/Verify with Server (Canonical Install ID)
async function registerWithServer(currentId = null) {
  try {
    const body = {
      deviceHint: window.Capacitor?.getPlatform() || 'web',
      clientInstallId: currentId
    };

    const res = await apiFetch('/api/install', {
      method: 'POST',
      body: JSON.stringify(body)
    });

    if (res.status === 429) throw new Error("RATE_LIMIT");

    const data = await res.json();
    if (data.ok && data.installId) return data.installId;

    throw new Error(data.error || "Installation failed");
  } catch (e) {
    console.error("[Identity] Installation Logic Error", e);
    throw e;
  }
}

// Async initializer for App.jsx
export async function initializeDeviceId() {
  try {
    // 1. Try Native Preferences (Persistent)
    const { value } = await Preferences.get({ key: KEY });
    if (value) {
      cachedId = value;
      localStorage.setItem(KEY, value);
      console.log("[Identity] Loaded ID:", value);
      return value;
    }

    // 2. Check for existing LocalStorage ID (Migration)
    // We still migrate legacy IDs to prevent wiping current users.
    const legacy = localStorage.getItem(KEY);
    if (legacy && legacy.startsWith("dev_")) {
      console.log("[Identity] Migrating Legacy ID:", legacy);
      await Preferences.set({ key: KEY, value: legacy });
      cachedId = legacy;
      return legacy;
    }

    // 3. SS-003: Verify with Server (or Register New)
    // We pass the stored ID (if any) to attempts recovery/update of last_seen
    console.log("[Identity] Verifying identity with server...");
    const confirmedId = await registerWithServer(legacy || null);

    const source = window.Capacitor?.isNativePlatform() ? "native" : "web";
    console.log(`[Identity] installId=${confirmedId} source=${source}`);

    await Preferences.set({ key: KEY, value: confirmedId });
    localStorage.setItem(KEY, confirmedId);
    cachedId = confirmedId;
    return confirmedId;

  } catch (e) {
    console.error("[Identity] Init Failed", e);
    // On failure, if we have a cached one, return it even if verification failed?
    // Failing open might be safer for UX, but risky for quota.
    // For now, return null logic was here, but let's try to survive if we have *something*.
    if (cachedId) return cachedId;

    // If we truly fail (network down + clean install), we might default to a temp ID?
    // Or just return null and let the UI block.
    return null;
  }
}
