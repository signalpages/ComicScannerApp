/* eslint no-undef: "error" */

import { apiFetch } from "../lib/apiFetch";

export async function identifyComic(base64Image) {
  const response = await apiFetch("/api/identify", {
    method: "POST",
    body: { image: base64Image }, // apiFetch handles JSON stringify & deviceId
  });

  console.log("AI SCAN: status", response.status);

  const result = await response.json();
  console.log("identifyComic:", response.status, result);

  if (!response.ok) throw new Error(result.error || "Scan failed");
  return result;
};

