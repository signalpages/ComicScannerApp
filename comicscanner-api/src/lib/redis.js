import { Redis } from "@upstash/redis";

export const redis = (() => {
    try {
        if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
            console.warn("[Redis] Missing Env Vars - Caching Disabled");
            return null;
        }
        return Redis.fromEnv();
    } catch (e) {
        console.warn("[Redis] Initialization Failed", e);
        return null; // Graceful degradation
    }
})();
