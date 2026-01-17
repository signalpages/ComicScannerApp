import sharp from "sharp";

/**
 * Normalizes an image for Vision API consumption.
 * - Decodes Base64
 * - Resizes to max 1024px width (cost/latency optimization)
 * - Converts to JPEG (compatibility)
 * - Returns clean Base64 string (no data URI prefix)
 * 
 * @param {string} base64Input 
 * @returns {Promise<string>} Base64 JPEG
 */
export async function normalizeImageForVision(base64Input) {
    if (!base64Input) throw new Error("No image input provided");

    // Strip data URI prefix if present
    const cleanBase64 = base64Input.replace(/^data:image\/\w+;base64,/, "");
    const inputBuffer = Buffer.from(cleanBase64, "base64");

    try {
        const outputBuffer = await sharp(inputBuffer)
            .resize({
                width: 1024,
                withoutEnlargement: true
            })
            .jpeg({
                quality: 80,
                mozjpeg: true
            })
            .toBuffer();

        return outputBuffer.toString("base64");
    } catch (error) {
        console.error("Image Normalization Failed:", error);
        // Fallback: If sharp fails (e.g. correlator issues), return input... 
        // But likely if sharp fails, the image is garbage anyway.
        throw error;
    }
}
