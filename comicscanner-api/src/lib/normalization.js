export function normalizeCandidate(candidate) {
    if (!candidate) return null;

    let { seriesTitle, issueNumber, publisher, year, displayName } = candidate;

    // Normalization 1: Ensure Series Title is clean
    if (seriesTitle) {
        seriesTitle = seriesTitle.trim();
        // Remove common junk suffix if needed, maybe not?
    }

    // Normalization 2: Extract Year if missing but in Series Title
    // e.g. "Amazing Spider-Man (1963)"
    if (!year && seriesTitle) {
        const match = seriesTitle.match(/\((\d{4})\)/);
        if (match) {
            year = match[1];
            // Optional: remove year from title? "Amazing Spider-Man"
            // seriesTitle = seriesTitle.replace(/\(\d{4}\)/, '').trim();
        }
    }

    // Normalization 3: Fallback Publisher
    if (!publisher) {
        // Simple heuristics if needed, or leave null
        if (seriesTitle?.toLowerCase().includes("spider-man")) publisher = "Marvel";
        if (seriesTitle?.toLowerCase().includes("batman")) publisher = "DC";
    }

    // Normalization 4: Construct Display Name
    const cleanDisplay = `${seriesTitle} #${issueNumber}`; // Standard format

    return {
        ...candidate,
        seriesTitle,
        year: year || null,
        publisher: publisher || null,
        displayName: cleanDisplay
    };
}
