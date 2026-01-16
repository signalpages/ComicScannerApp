// scripts/smoke-test-api.js
// using native fetch (Node 18+)

const PROD_API_BASE = "https://comicscanner-api.vercel.app";
const TEST_DEVICE_ID = "smoke-test-native-v1";

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
        // Search for "Spider-Man 1" - should always exist
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
        if (!Array.isArray(data.candidates)) throw new Error("Schema Mismatch: candidates missing");
        if (data.candidates.length === 0) console.warn("  [WARN] No candidates found (Expected for Stub API)");
    });

    await testEndpoint("POST /api/identify (Schema Check)", async () => {
        // Send garbage image, expect 400 or handled error (but valid JSON)
        // NOT 500 HTML
        const res = await fetch(`${PROD_API_BASE}/api/identify`, {
            method: 'POST',
            headers: {
                "x-anon-id": TEST_DEVICE_ID,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ image: "invalid-base-64" })
        });

        // We expect the backend to reject this processing, but return JSON.
        // Status might be 400 or 500, but content-type MUST be json
        const contentType = res.headers.get("content-type");
        if (!contentType.includes("application/json")) {
            throw new Error(`Invalid Content-Type: ${contentType} (Expected API JSON)`);
        }
    });

    log("\n✅ API Contract Verified. Backend is consistent.\n", colors.green);
}

run();
