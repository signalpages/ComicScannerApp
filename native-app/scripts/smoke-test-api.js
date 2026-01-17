// scripts/smoke-test-api.js
// using native fetch (Node 18+)

const PROD_API_BASE = "https://comicscanner-api.vercel.app";
const TEST_DEVICE_ID = "00000000-0000-0000-0000-000000000000"; // Valid UUID for Postgres

const colors = {
    green: '\x1b[32m',
    red: '\x1b[31m',
    reset: '\x1b[0m',
    cyan: '\x1b[36m'
};

function log(msg, color = colors.reset) {
    console.log(`${color}${msg}${colors.reset}`);
}

async function testEndpoint(name, fn) {
    process.stdout.write(`Testing ${name}... `);
    try {
        await fn();
        log("PASS", colors.green);
    } catch (e) {
        log("FAIL", colors.red);
        console.error(e.message);
        process.exit(1);
    }
}

async function run() {
    log("\n🔒 Backend Freeze Contract: Smoke Test\n", colors.cyan);

    await testEndpoint("GET /api/search (Health Check)", async () => {
        const url = `${PROD_API_BASE}/api/search?title=Spider-Man&issue=1`;
        const res = await fetch(url, {
            headers: {
                "x-anon-id": TEST_DEVICE_ID,
                "Content-Type": "application/json"
            }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error("API returned ok: false");
    });

    await testEndpoint("POST /api/identify (Schema Check)", async () => {
        const res = await fetch(`${PROD_API_BASE}/api/identify`, {
            method: 'POST',
            headers: {
                "x-anon-id": TEST_DEVICE_ID,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ image: "invalid-base-64" })
        });
        const contentType = res.headers.get("content-type");
        if (!contentType.includes("application/json")) {
            throw new Error(`Invalid Content-Type: ${contentType}`);
        }
    });

    await testEndpoint("POST /api/install (CS-052)", async () => {
        const res = await fetch(`${PROD_API_BASE}/api/install`, { method: "POST" });
        if (!res.ok) throw new Error(`HTTP ${res.status} - Config Check Failed?`);
        const data = await res.json();
        if (!data.ok || !data.installId) throw new Error("Install failed");
    });

    await testEndpoint("GET /api/saved-scans (CS-052)", async () => {
        const url = `${PROD_API_BASE}/api/saved-scans?installId=${TEST_DEVICE_ID}&limit=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.ok) throw new Error("Saved Scans returned error");
    });

    await testEndpoint("POST /api/price (CS-053)", async () => {
        const res = await fetch(`${PROD_API_BASE}/api/price`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-anon-id": TEST_DEVICE_ID
            },
            body: JSON.stringify({ seriesTitle: "The Amazing Spider-Man", issueNumber: "300" })
        });
        if (!res.ok && res.status === 500) throw new Error("500 Error in Pricing (Upstash crash?)");
    });

    await testEndpoint("GET /api/saved-scans (Invalid UUID) (CS-054)", async () => {
        const url = `${PROD_API_BASE}/api/saved-scans?installId=BAD_ID&limit=1`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status} - Should be 200 (Soft Fail)`);
        const data = await res.json();
        if (data.items.length !== 0) throw new Error("Should return empty list for bad ID");
    });

    await testEndpoint("POST /api/saved-scans (Invalid UUID Body) (CS-054)", async () => {
        const res = await fetch(`${PROD_API_BASE}/api/saved-scans`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ installId: "BAD_ID", selectedCandidate: {} })
        });
        if (res.status !== 400) throw new Error(`Expected 400, got ${res.status}`);
    });

    await testEndpoint("POST /api/price (Soft Fail Test) (CS-056)", async () => {
        const res = await fetch(`${PROD_API_BASE}/api/price`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "x-anon-id": TEST_DEVICE_ID
            },
            body: JSON.stringify({ seriesTitle: "" }) // Invalid
        });
        if (!res.ok) throw new Error(`HTTP ${res.status} - Should be 200 (Soft Fail)`);
        const data = await res.json();
        if (data.available !== false) throw new Error("Should return available: false");
    });

    log("\n✅ API Contract Verified. Backend is consistent.\n", colors.green);
}

run();
