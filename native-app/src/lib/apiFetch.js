import { getDeviceId } from "./deviceId";
import { Capacitor } from "@capacitor/core";

/**
 * Wrapper around fetch to ensure deviceId is always included
 * and native builds always hit the production backend.
 * 
 * HARDENED: Now forces absolute paths for ALL relative URLs in native.
 */
import { IAP } from "../services/iapBridge";

export const apiFetch = async (url, options = {}) => {
  const isEntitled = await IAP.isEntitled().catch(() => false);

  const defaultHeaders = {
    "Content-Type": "application/json",
    ...(isEntitled ? { "x-entitlement-status": "active" } : {})
  };

  // --------------------------------------------------------
  // ✅ Native-safe API base resolution (Hardened)
  // --------------------------------------------------------
  const isNative = Capacitor.isNativePlatform();
  const PROD_API_BASE = "https://comicscanner-api.vercel.app";

  let finalUrl = url;

  // Logic: 
  // 1. If absolute URL (http/https), use as-is.
  // 2. If native, force PROD_API_BASE + normalized path.
  // 3. If web, allow relative paths (browser handles proxy/origin).

  const isAbsolute = /^https?:\/\//i.test(url);

  if (isNative && !isAbsolute) {
    // Normalize path to ensure leading slash
    const path = url.startsWith("/") ? url : `/${url}`;
    finalUrl = `${PROD_API_BASE}${path}`;
  }

  // --------------------------------------------------------
  // ✅ Logging for Diagnostics
  // --------------------------------------------------------
  if (isNative) {
    console.log(`[API REQUEST] ${finalUrl} (Original: ${url})`);
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
  if (
    config.method === "POST" &&
    config.headers["Content-Type"] === "application/json"
  ) {
    let body = {};

    if (config.body) {
      try {
        body =
          typeof config.body === "string"
            ? JSON.parse(config.body)
            : config.body;
      } catch {
        body = config.body;
      }
    }

    if (typeof body === "object" && body !== null) {
      const deviceId = getDeviceId();
      body.deviceId = deviceId;
      body.device_id = deviceId;
      config.body = JSON.stringify(body);
    }
  }

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
