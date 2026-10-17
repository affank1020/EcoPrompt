import type { SortDir, SortKey } from "../../lib/data/estimates";

export type HistoryParams = {
    sort: SortKey;
    dir: SortDir;
    site?: string;
    model?: string;
    page: number;
};

const SORT_KEYS: SortKey[] = ["date", "site", "model", "length", "water"];

type RawParams = { [key: string]: string | string[] | undefined };

function first(v: string | string[] | undefined) {
    return Array.isArray(v) ? v[0] : v;
}

export function parseHistoryParams(raw: RawParams): HistoryParams {
    const sort = first(raw.sort) as SortKey;
    return {
        sort: SORT_KEYS.includes(sort) ? sort : "date",
        dir: first(raw.dir) === "asc" ? "asc" : "desc",
        site: first(raw.site) || undefined,
        model: first(raw.model) || undefined,
        page: Math.max(1, Number.parseInt(first(raw.page) ?? "1", 10) || 1),
    };
}

// Builds a /dashboard/history URL from the current params plus any changes
export function historyHref(current: HistoryParams, patch: Partial<HistoryParams>): string {
    const next = { ...current, ...patch };
    const search = new URLSearchParams();
    if (next.sort !== "date") search.set("sort", next.sort);
    if (next.dir !== "desc") search.set("dir", next.dir);
    if (next.site) search.set("site", next.site);
    if (next.model) search.set("model", next.model);
    if (next.page > 1) search.set("page", String(next.page));
    const qs = search.toString();
    return `/dashboard/history${qs ? `?${qs}` : ""}`;
}
