import OpenAI from "openai";
import { normalizeImageForVision } from "../../image";

export class OpenAIVisionProvider {
    constructor() {
        this.openai = new OpenAI();
    }

    async identify(base64Image) {
        const startTime = Date.now();
        try {
            // CS-015: Normalize image to ensure JPEG format and reasonable size
            // This prevents "400 Bad Request" from OpenAI for unsupported formats (e.g. raw HEIC or weird encoding)
            const cleanImage = await normalizeImageForVision(base64Image);

            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a comic book expert. Identify the comic from the image. Return JSON ONLY: { \"seriesTitle\": string, \"issueNumber\": string, \"publisher\": string, \"year\": numberOrNull, \"confidence\": number }. Confidence should be 0.0 to 1.0 based on clarity. If uncertain, return null fields and low confidence."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Identify this comic." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${cleanImage}` } }
                        ]
                    }
                ],
                response_format: { type: "json_object" },
                max_tokens: 300,
            });

            const content = completion.choices[0]?.message?.content;
            if (!content) throw new Error("No content from OpenAI");

            const result = JSON.parse(content);

            const candidate = {
                seriesTitle: result.seriesTitle || null,
                issueNumber: result.issueNumber ? String(result.issueNumber) : null,
                publisher: result.publisher || null,
                year: result.year || null,
                confidence: typeof result.confidence === 'number' ? result.confidence : 0.5
            };

            // CS-026: Ensure displayName is always populated for UI consistency
            if (candidate.seriesTitle) {
                candidate.displayName = candidate.issueNumber
                    ? `${candidate.seriesTitle} #${candidate.issueNumber}`
                    : candidate.seriesTitle;
            }

            const duration = Date.now() - startTime;

            // Filter out complete garbage (no title)
            if (!candidate.seriesTitle) {
                console.log(`[METRICS] type=provider name=openai status=empty duration=${duration}ms confidence=${candidate.confidence}`);
                return [];
            }

            // CS-005: Confidence Gating
            const THRESHOLD = 0.7;
            if (candidate.confidence < THRESHOLD) {
                console.log(`[METRICS] type=provider name=openai status=filtered reason=low_confidence duration=${duration}ms confidence=${candidate.confidence}`);
                return [];
            }

            console.log(`[METRICS] type=provider name=openai status=success duration=${duration}ms confidence=${candidate.confidence}`);
            return [candidate];

        } catch (error) {
            const duration = Date.now() - startTime;
            console.error("OpenAI Vision Error:", error);
            console.log(`[METRICS] type=provider name=openai status=error duration=${duration}ms`);
            // Return empty array on error (Soft Failure)
            return [];
        }
    }
}
