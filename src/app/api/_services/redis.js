
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;

if (!redisUrl || !redisToken) {
    throw new Error('Missing Upstash Redis Environment Variables');
}

export const redis = new Redis({
    url: redisUrl,
    token: redisToken,
});
