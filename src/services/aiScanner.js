import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

// Initialize Gemini
const genAI = new GoogleGenerativeAI(API_KEY);

export const identifyComic = async (imageBlob) => {
    if (!API_KEY) {
        console.warn("Missing Gemini API Key. Returning mock data.");
        return mockIdentify();
    }

    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

        // Convert blob to base64
        const base64Data = await blobToBase64(imageBlob);

        const prompt = "Identify this comic book. Return a JSON object with strictly these fields: 'title', 'issue_number', 'publisher', 'year' (estimate), 'is_variant' (boolean), 'variant_name' (if applicable), 'condition_estimate' (string like 'VF', 'NM'). Do not use markdown backticks in response.";

        const imagePart = {
            inlineData: {
                data: base64Data,
                mimeType: "image/jpeg",
            },
        };

        const result = await model.generateContent([prompt, imagePart]);
        const response = await result.response;
        const text = response.text();

        // Attempt to parse JSON
        try {
            const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanedText);
        } catch (e) {
            console.error("Failed to parse Gemini response:", text);
            return { error: "Failed to parse comic data" };
        }
    } catch (error) {
        console.error("Gemini Scan Error:", error);
        throw error;
    }
};

const blobToBase64 = (blob) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64String = reader.result.split(',')[1]; // Remove data url prefix
            resolve(base64String);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const mockIdentify = () => {
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
                title: "Amazing Spider-Man",
                issue_number: "300",
                publisher: "Marvel",
                year: "1988",
                is_variant: false,
                variant_name: null,
                condition_estimate: "NM"
            });
        }, 2000);
    });
};
