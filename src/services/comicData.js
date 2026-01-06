const API_KEY = import.meta.env.VITE_COMIC_VINE_KEY;
const USE_MOCK = !API_KEY;

export const getComicDetails = async (title, issue) => {
    // Determine Cover Date Year (mock for now if needed, or parse later)
    const basePrice = Math.floor(Math.random() * (50 - 5 + 1)) + 5;

    if (USE_MOCK) {
        console.warn("Using MOCK data (No API Key found)");
        return getMockDetails(title, issue, basePrice);
    }

    try {
        // 1. Search for the Volume/Issue via Proxy to avoid CORS
        // Note: ComicVine API proxy is configured in vite.config.js as /api/comicvine
        const searchUrl = `/api/comicvine/search/?api_key=${API_KEY}&format=json&resources=issue&query=${encodeURIComponent(`${title} ${issue}`)}&limit=10`;

        console.log(`Searching ComicVine: ${searchUrl}`);
        const response = await fetch(searchUrl);
        const data = await response.json();

        if (!data.results || data.results.length === 0) {
            console.warn("No results found on ComicVine, falling back to mock");
            return getMockDetails(title, issue, basePrice);
        }

        // Simple refinement: Try to find exact issue number match
        const bestMatch = data.results.find(r => r.issue_number === issue) || data.results[0];
        console.log(`Found match: ${bestMatch.volume.name} #${bestMatch.issue_number}`);

        // 2. Fetch Details for Variants (associated_images)
        // We need the detail endpoint to get associated_images
        const detailUrl = `/api/comicvine/issue/4000-${bestMatch.id}/?api_key=${API_KEY}&format=json`;
        const detailResp = await fetch(detailUrl);
        const detailData = await detailResp.json();
        const issueDetail = detailData.results;

        // Construct Variants List from associated_images
        let variants = [];
        if (issueDetail.associated_images && issueDetail.associated_images.length > 0) {
            variants = issueDetail.associated_images.map((img, idx) => ({
                name: img.caption || (idx === 0 ? "Main Cover" : `Variant ${String.fromCharCode(65 + idx)}`),
                cover_letter: img.caption ? img.caption.charAt(0).toUpperCase() : String.fromCharCode(65 + idx),
                price_raw: idx === 0 ? basePrice : basePrice * 1.5, // Mock differentiation based on variant rarity assumption
                price_graded: idx === 0 ? basePrice * 3 : basePrice * 4.5,
                image: img.medium_url || img.original_url
            }));
        } else {
            // Fallback if no specific associated images
            variants = [{
                name: "Main Cover",
                cover_letter: "A",
                price_raw: basePrice,
                price_graded: basePrice * 3,
                image: issueDetail.image ? issueDetail.image.medium_url : null
            }];
        }

        return {
            price_raw: basePrice, // Real pricing would need another API (CovrPrice/GoCollect)
            price_graded: basePrice * 3,
            description: issueDetail.description ? issueDetail.description.replace(/<[^>]*>?/gm, '') : "No description available.",
            cover_date: issueDetail.cover_date,
            publisher: issueDetail.volume ? issueDetail.volume.name : "Unknown",
            values: {
                raw: `$${basePrice}.00`,
                cgc_9_8: `$${basePrice * 3}.00`
            },
            cover_image: issueDetail.image ? issueDetail.image.medium_url : null,
            variants: variants
        };

    } catch (e) {
        console.error("API Error", e);
        return getMockDetails(title, issue, basePrice);
    }
};

const getMockDetails = (title, issue, basePrice) => {
    // Mock response for visual testing when API is unavailable
    const coverImage = `https://placehold.co/400x600/14142b/bc13fe?text=${encodeURIComponent(title + " #" + issue)}`;

    const variants = [
        {
            name: "Cover A (Standard)",
            cover_letter: "A",
            price_raw: basePrice,
            price_graded: basePrice * 3,
            image: coverImage
        },
        {
            name: "Cover B (Virgin Variant)",
            cover_letter: "B",
            price_raw: basePrice * 1.5,
            price_graded: basePrice * 4.5,
            image: `https://placehold.co/400x600/232342/00f3ff?text=Virgin+Variant`
        },
        {
            name: "1:25 Incentive",
            cover_letter: "1:25",
            price_raw: basePrice * 5,
            price_graded: basePrice * 10,
            image: `https://placehold.co/400x600/14142b/ff00ff?text=1:25+Ratio`
        }
    ];

    return {
        price_raw: basePrice,
        price_graded: basePrice * 3,
        description: "A classic issue featuring the first appearance of a villain. (MOCK DATA)",
        cover_date: "1988-05-10",
        publisher: "Marvel (Mock)",
        values: {
            raw: `$${basePrice}.00`,
            cgc_9_8: `$${basePrice * 3}.00`
        },
        cover_image: coverImage,
        variants: variants
    };
};
