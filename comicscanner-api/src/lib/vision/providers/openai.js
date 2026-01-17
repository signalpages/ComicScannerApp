import OpenAI from "openai";

export class OpenAIVisionProvider {
    constructor() {
        this.openai = new OpenAI();
    }

    async identify(base64Image) {
        try {
            const completion = await this.openai.chat.completions.create({
                model: "gpt-4o-mini",
                messages: [
                    {
                        role: "system",
                        content: "You are a comic book expert. Identify the comic from the image. Return JSON ONLY: { \"seriesTitle\": string, \"issueNumber\": string, \"publisher\": string, \"year\": numberOrNull }. If uncertain, return null fields."
                    },
                    {
                        role: "user",
                        content: [
                            { type: "text", text: "Identify this comic." },
                            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64Image}` } }
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
                confidence: 1.0
            };

            // Filter out complete garbage (no title)
            if (!candidate.seriesTitle) {
                return [];
            }

            return [candidate];

        } catch (error) {
            console.error("OpenAI Vision Error:", error);
            // Return empty array on error (Soft Failure)
            return [];
        }
    }
}
