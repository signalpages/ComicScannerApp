import { OpenAIVisionProvider } from "./providers/openai";
import { XimilarVisionProvider } from "./providers/ximilar";
import { FallbackVisionProvider } from "./providers/fallback";

export function getVisionProvider() {
    if (process.env.VISION_PROVIDER === 'ximilar') {
        return new FallbackVisionProvider(
            new XimilarVisionProvider(),
            new OpenAIVisionProvider()
        );
    }

    return new OpenAIVisionProvider();
}
