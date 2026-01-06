
/**
 * eBay Result Ranker
 * specific to Comic Books
 */
export const scoreResult = (item, targetTitle, targetIssue) => {
    let score = 0;
    const titleLower = item.title.toLowerCase();
    const targetTitleLower = targetTitle.toLowerCase();

    // 1. Category Boost (Collectibles > Comics > Direct)
    // Category ID 63 is broad "Comics", specific eras have diff IDs but usually fall under it.
    // We check if categoryId implies comic.
    if (item.categoryId === '63' || item.categoryName?.includes('Comic')) {
        score += 5;
    }

    // 2. Penalties (Filter out noise)
    if (titleLower.includes('lot of') || titleLower.includes(' set ')) score -= 50;
    if (titleLower.includes('tpb') || titleLower.includes('hardcover') || titleLower.includes('trade paperback')) score -= 20;
    if (titleLower.includes('facsimile') || titleLower.includes('reprint') || titleLower.includes('golden record')) score -= 30;
    if (titleLower.includes('signed') || titleLower.includes('signature')) score -= 10;
    if (titleLower.includes('cgc') || titleLower.includes('cbcs')) {
        // We generally want Raw prices for the base estimator, unless searching for slabbed.
        // If we want raw, penalize slabs slightly or handle separately. 
        // For now, let's assuming we want RAW.
        score -= 5;
    }

    // 3. Title Match (Fuzzy)
    // Simple inclusion check
    if (titleLower.includes(targetTitleLower)) {
        score += 10;
    } else {
        // If title doesn't match, it's likely garbage
        score -= 20;
    }

    // 4. Issue Number Match
    // Regex to find issue number in title " #1 " or " 1 " or "No. 1"
    const issueRegex = new RegExp(`(\\b|#|no\\.?\\s?)${targetIssue}\\b`, 'i');
    if (issueRegex.test(titleLower)) {
        score += 15;
    } else {
        score -= 15;
    }

    return score;
};

export const filterAndSort = (items, targetTitle, targetIssue, threshold = 10) => {
    return items
        .map(item => ({ ...item, score: scoreResult(item, targetTitle, targetIssue) }))
        .filter(item => item.score >= threshold)
        .sort((a, b) => b.score - a.score);
};
