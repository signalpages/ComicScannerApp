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
                console.log("[VISION] Primary Provider Success");
                return primaryResults;
            }
        } catch (e) {
            console.warn("[VISION] Primary Provider Failed:", e);
        }

        // Fallback to Secondary
        console.log("[VISION] Falling back to Secondary Provider...");
        return await this.secondary.identify(base64Image);
    }
}
