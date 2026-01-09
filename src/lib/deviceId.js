export function getDeviceId() {
  if (typeof window === "undefined") return null;

  const KEY = "comicscan_device_id";
  let id = localStorage.getItem(KEY);
  if (id) return id;

  id =
    (window.crypto?.randomUUID && window.crypto.randomUUID()) ||
    `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(KEY, id);
  return id;
}
