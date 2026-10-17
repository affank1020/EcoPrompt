export type SplitMode = "blank-line" | "delimiter" | "line";

// Split pasted text (or an uploaded .txt) into prompts
export function splitPrompts(text: string, mode: SplitMode, delimiter = "---"): string[] {
    const normalised = text.replace(/\r\n?/g, "\n");
    let parts: string[];
    if (mode === "blank-line") parts = normalised.split(/\n\s*\n/);
    else if (mode === "line") parts = normalised.split("\n");
    else parts = delimiter ? normalised.split(delimiter) : [normalised];
    return parts.map((p) => p.trim()).filter(Boolean);
}

// Minimal RFC 4180 parser: handles quoted fields, escaped quotes and newlines inside quotes
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = "";
    let quoted = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (quoted) {
            if (c === '"' && text[i + 1] === '"') {
                field += '"';
                i++;
            } else if (c === '"') {
                quoted = false;
            } else {
                field += c;
            }
        } else if (c === '"') {
            quoted = true;
        } else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\n" || c === "\r") {
            if (c === "\r" && text[i + 1] === "\n") i++;
            row.push(field);
            rows.push(row);
            row = [];
            field = "";
        } else {
            field += c;
        }
    }
    if (field || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows;
}

// Uses the column headed "prompt" if there is one, otherwise the first column
export function promptsFromCsv(text: string): string[] {
    const rows = parseCsv(text);
    if (rows.length === 0) return [];
    const headerIndex = rows[0].findIndex((cell) => cell.trim().toLowerCase() === "prompt");
    const column = headerIndex >= 0 ? headerIndex : 0;
    const body = headerIndex >= 0 ? rows.slice(1) : rows;
    return body.map((r) => (r[column] ?? "").trim()).filter(Boolean);
}

export function toCsv(rows: (string | number)[][]): string {
    return rows
        .map((r) => r.map((cell) => {
            const s = String(cell);
            return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
        }).join(","))
        .join("\n");
}
