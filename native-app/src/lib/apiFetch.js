import { getDeviceId } from "./deviceId";
import { Capacitor } from "@capacitor/core";
import { API_BASE_URL } from "../config"; // CS-206

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
    "x-install-id": getDeviceId(), // SS-004: Always send canonical ID
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
