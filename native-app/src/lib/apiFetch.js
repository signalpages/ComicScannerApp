import { getInstallId } from "./installId";
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
  // CS-303: Strict Identity Gating via installId.js
  const installId = await getInstallId();

  if (!installId && !url.includes("/api/install") && !url.includes("/api/search")) {
    // Determine if this is a critical block or if we auto-init?
    // User Guide says: "Update apiFetch to always send x-install-id".
    // If it's missing, we probably should block or fail, but /api/install itself must pass.
    // CS-310: Manual Search is allowed without ID status
    console.error("[API] Blocked: No Install ID (and not /api/install or /api/search)");
    throw new Error("Initializing app identity...");
  }

  const isEntitled = await IAP.isEntitled().catch(() => false);

  const defaultHeaders = {
    "Content-Type": "application/json",
    "x-install-id": installId, // Always strictly valid
    ...(isEntitled ? { "x-entitlement-status": "active" } : {})
  };

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

  return response;
};
