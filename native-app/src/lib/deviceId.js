import { Preferences } from '@capacitor/preferences';

const DEVICE_KEY = "comicscanner_stable_device_id";
let cachedDeviceId = null;

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
 * CS-303: Persistent Device Identity
 * Returns a stable UUID that persists across app sessions.
 * Never clears unless app data is wiped.
 */
export async function getStableDeviceId() {
  if (cachedDeviceId) return cachedDeviceId;

  try {
    const { value } = await Preferences.get({ key: DEVICE_KEY });
    if (value) {
      cachedDeviceId = value;
      return value;
    }

    // Generate new
    const newId = generateUUID();
    await Preferences.set({ key: DEVICE_KEY, value: newId });
    cachedDeviceId = newId;
    return newId;

  } catch (e) {
    console.error("Failed to access stable device ID", e);
    // Fallback to memory-only if storage fails (rare)
    if (!cachedDeviceId) cachedDeviceId = generateUUID();
    return cachedDeviceId;
  }
}

