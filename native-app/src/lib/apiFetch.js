import { getInstallId } from "./installId";
import { getStableDeviceId } from "./deviceId";
import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "../config"; // CS-206
import { IAP } from "../services/iapBridge";

/**
 * Wrapper around fetch to ensure deviceId is always included
 * and native builds always hit the production backend.
 * 
 * HARDENED: Now forces absolute paths for ALL relative URLs in native.
 */
export const apiFetch = async (url, options = {}) => {
  // CS-301: Remove Identity Gating (Best Effort)
  // We attempt to get ids, but never block flow if they fail.

  // 1. Device ID (Required-ish, but generated locally so reliable)
  const deviceId = await getStableDeviceId();

  // 2. Install ID (Server Session, optional)
  // We do NOT block on this. If it returns null, we proceed.
  const installId = await getInstallId().catch(() => null);

  const defaultHeaders = {
    "Content-Type": "application/json",
    // CS-206: Versioning
    "x-app-version": process.env.APP_VERSION || "1.0.0",
    "x-platform": window.Capacitor?.getPlatform() || "web",
    // CS-303: Persistent Device Identity
    "x-device-id": deviceId,
  };

  // Only attach install ID if we have it
  if (installId) {
    defaultHeaders["x-install-id"] = installId;
  }

  // NOTE: We REMOVED the "requiresInstallId" check. 
  // We NEVER throw "Identity not ready" anymore.
  // Backend endpoints for saved-scans will just fail gracefully (401/400) 
  // or use x-device-id if supported.
  // --------------------------------------------------------
  // ✅ Native-safe API base resolution (Hardened)
  // --------------------------------------------------------
  const isNative = Capacitor.isNativePlatform();

  // CS-206: Force Absolute URL
  const finalUrl = url.startsWith('http')
    ? url
    : new URL(url, API_BASE_URL).toString();

  // --------------------------------------------------------
  // ✅ Logging for Diagnostics
  // --------------------------------------------------------
  if (isNative) {
    console.log(`[API REQUEST] ${finalUrl}`);
    console.log(`[API ORIGIN] ${isNative ? "Native" : "Web"}`);
  }

  const config = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
      ...(process.env.NODE_ENV !== "production"
        ? { "x-dev-bypass": "1" }
        : {}),
    },
  };

  // --------------------------------------------------------
  // ✅ Auto-inject deviceId for POST JSON bodies
  // --------------------------------------------------------
  // --------------------------------------------------------
  // ✅ Auto-inject deviceId for POST JSON bodies (REMOVED CS-302)
  // --------------------------------------------------------
  // We now rely exclusively on x-install-id header.
  // Legacy injection removed to prevent "dev_init_pending" pollution.

  let response;
  try {
    response = await fetch(finalUrl, config);
  } catch (err) {
    if (isNative) {
      console.error("[API NETWORK ERROR]", err);
    }
    throw new Error("Network error. Please check your connection.");
  }

  // --------------------------------------------------------
  // ✅ Safe response handling (no HTML crashes)
  // --------------------------------------------------------
  const contentType = response.headers.get("content-type") || "";

  if (!response.ok || !contentType.includes("application/json")) {
    let snippet = "";
    try {
      snippet = (await response.text()).slice(0, 200);
    } catch {
      snippet = "[unreadable]";
    }

    if (isNative) {
      console.error(
        `[API ERROR] ${response.status} ${contentType}\n${snippet}`
      );
    }

    throw new Error("Service temporarily unavailable. Please try again.");
  }

  // --------------------------------------------------------
  // ✅ Safe JSON Wrapper (CS-Patch: Prevent "<!doctype" errors)
  // --------------------------------------------------------
  const originalJson = response.json.bind(response);
  response.json = async () => {
    try {
      return await originalJson();
    } catch (e) {
      if (isNative) {
        // Log the text for debugging
        const text = await response.clone().text().catch(() => "unreadable");
        console.error(`[API JSON PARSE ERROR] URL: ${response.url} \nBody: ${text.slice(0, 500)}`);
      }
      throw new Error("Server returned invalid data. Please try again.");
    }
  };

  return response;
};
