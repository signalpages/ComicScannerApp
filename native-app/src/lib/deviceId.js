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

// CS-032: Register with Server
async function registerWithServer() {
  try {
    const res = await apiFetch('/api/register', { method: 'POST' });
    const data = await res.json();
    if (data.ok && data.installToken) {
      return data.installToken;
    }
    throw new Error(data.error || "Registration failed");
  } catch (e) {
    console.error("[Identity] Registration Error", e);
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

    // 3. CS-032: Register New ID (Server-Side)
    // If we fail here, we throw and let App handle retry or show error.
    console.log("[Identity] Registering new device...");
    const newId = await registerWithServer();

    console.log("[Identity] Registered:", newId);
    await Preferences.set({ key: KEY, value: newId });
    localStorage.setItem(KEY, newId);
    cachedId = newId;
    return newId;

  } catch (e) {
    console.error("[Identity] Init Failed", e);
    // On failure, return null so App knows we are in a bad state?
    // Or return a temp one but don't save it?
    // For P0 robustness, we probably want to block or retry.
    // Let's return null to signal failure.
    return null;
  }
}
