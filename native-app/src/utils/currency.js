/**
 * CS-045: Consistent Currency Formatting
 */
export function formatCurrency(value) {
    if (value === null || value === undefined || Number.isNaN(Number(value))) {
        return "—";
    }

    const num = Number(value);

    // Check if it's an integer
    if (Number.isInteger(num)) {
        return `$${num.toFixed(2)}`; // Spec says "$8.00", not "$8"
    }

    return `$${num.toFixed(2)}`;
}

export function formatRange(low, high) {
    if (!low && !high) return "—";
    if (!low) return formatCurrency(high);
    if (!high) return formatCurrency(low);

    return `${formatCurrency(low)} – ${formatCurrency(high)}`;
}
