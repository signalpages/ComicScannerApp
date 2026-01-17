import { OpenAIVisionProvider } from "./providers/openai";

export function getVisionProvider() {
    // In the future, we can switch providers based on env vars or feature flags here.
    // e.g. if (process.env.VISION_PROVIDER === 'ximilar') return new XimilarVisionProvider();

    return new OpenAIVisionProvider();
}
