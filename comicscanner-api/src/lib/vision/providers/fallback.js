export class FallbackVisionProvider {
    constructor(primary, secondary) {
        this.primary = primary;
        this.secondary = secondary;
    }

    async identify(base64Image) {
        // Try Primary
        try {
            const primaryResults = await this.primary.identify(base64Image);
            if (primaryResults && primaryResults.length > 0) {
                return primaryResults;
            }
            console.log("[METRICS] type=fallback source=primary reason=empty_results");
        } catch (e) {
            console.warn("[VISION] Primary Provider Failed:", e);
            console.log("[METRICS] type=fallback source=primary reason=error");
        }

        // Fallback to Secondary
        console.log("[VISION] Falling back to Secondary Provider...");
        return await this.secondary.identify(base64Image);
    }
}
