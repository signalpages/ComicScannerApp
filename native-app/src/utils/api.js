import { Capacitor } from "@capacitor/core";

// CS-060: Explicit API Origin Switching
export const API_ORIGIN = Capacitor.isNativePlatform()
    ? "https://comicscanner-api.vercel.app"
    : "";

export const apiUrl = (path) => {
    // Ensure path starts with /
    const normalized = path.startsWith('/') ? path : `/${path}`;

    // Construct path with /api prefix
    const apiPath = normalized.startsWith('/api/') ? normalized : `/api${normalized}`;

    // Return absolute URL for Native, relative for Web
    return `${API_ORIGIN}${apiPath}`;
};
