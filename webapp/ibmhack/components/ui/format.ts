export function formatMl(ml: number): string {
    if (ml >= 1000) return `${(ml / 1000).toLocaleString("en", { maximumFractionDigits: 2 })} L`;
    if (ml >= 10) return `${Math.round(ml).toLocaleString("en")} mL`;
    if (ml >= 1) return `${ml.toFixed(1)} mL`;
    if (ml >= 0.01) return `${ml.toFixed(2)} mL`;
    return ml === 0 ? "0 mL" : "<0.01 mL";
}

// Range without units on the low end, e.g. "0.9–4.5 mL"
export function formatRange(lowMl: number, highMl: number): string {
    const high = formatMl(highMl);
    const unit = high.endsWith(" L") ? " L" : " mL";
    const low = formatMl(lowMl);
    return low.endsWith(unit) ? `${low.slice(0, -unit.length)}–${high}` : `${low}–${high}`;
}

export function formatNumber(n: number): string {
    return n.toLocaleString("en");
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
    return new Date(iso).toLocaleDateString("en-GB", { timeZone: "UTC", ...options });
}

export function formatDateTime(iso: string): string {
    return new Date(iso).toLocaleString("en-GB", {
        timeZone: "UTC",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}
