/**
 * Frontend Service to communicate with Vercel Backend
 */
export const identifyComic = async (imageBlob) => {
    try {
        const formData = new FormData();
        formData.append('image', imageBlob);

        // This calls your Vercel Backend function at /api/identify
        const response = await fetch('/api/identify', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Server Error (${response.status}): ${errorText}`);
        }

        const result = await response.json();

        // Map the backend data to the fields your App.jsx expects
        // This ensures the UI updates with real AI data
        return {
            title: result.data?.series || "Unknown Title",
            issue_number: result.data?.issue_number || "??",
            publisher: result.data?.publisher || "Unknown",
            year: result.data?.year || "N/A",
            is_variant: result.data?.is_variant || false,
            variant_name: result.data?.variant_name || null,
            condition_estimate: "AI Calculated"
        };
        
    } catch (error) {
        console.error("Scan Error:", error);
        // We throw the error instead of returning Spider-Man so you know if it fails
        throw error;
    }
};