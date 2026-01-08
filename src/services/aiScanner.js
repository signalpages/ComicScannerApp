/* eslint no-undef: "error" */


export const identifyComic = async (image) => {
  console.log("AI SCAN: sending len", typeof image === "string" ? image.length : "non-string");

  const response = await fetch("/api/identify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ image }),
  });

  console.log("AI SCAN: status", response.status);

  const result = await response.json();
  console.log("identifyComic:", response.status, result);

  if (!response.ok) throw new Error(result.error || "Scan failed");
  return result;
};

