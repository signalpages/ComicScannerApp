const base = process.env.API_BASE_URL;
const anon = process.env.ANON || "dev-device-123";

if (!base) {
    console.error("Error: API_BASE_URL environment variable is required.");
    console.error("Usage: API_BASE_URL=https://your-app.vercel.app node scripts/smoke-price.js");
    process.exit(1);
}

(async () => {
    console.log(`Testing API at: ${base}`);
    try {
        const res = await fetch(`${base}/api/price`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-anon-id": anon,
            },
            body: JSON.stringify({
                seriesTitle: "Spawn",
                issueNumber: "1",
                editionId: "manual",
            }),
        });

        console.log("Status:", res.status);
        const text = await res.text();
        console.log("Response:", text.slice(0, 1000)); // Truncate if too long

        if (!res.ok) process.exit(1);
    } catch (e) {
        console.error("Fetch failed:", e.message);
        process.exit(1);
    }
})();
