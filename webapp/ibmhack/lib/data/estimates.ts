import { connection } from "next/server";
import { createClient } from "../supabase/server";
import type { Estimate, Granularity, UsagePoint, UsageStats } from "../types";
import { bucketStart, DAY_MS, previousBucket } from "./dates";

export type SortKey = "date" | "site" | "model" | "length" | "water" | "energy";
export type SortDir = "asc" | "desc";

export type EstimateQuery = {
    sort?: SortKey;
    dir?: SortDir;
    site?: string;
    model?: string;
    page?: number;
    pageSize?: number;
};

export type EstimatePage = {
    rows: Estimate[];
    total: number;
    page: number;
    pageCount: number;
    pageSize: number;
};

// Shown for estimates where the extension couldn't tell which model was used
export const UNKNOWN_MODEL = "Unknown";

const BUCKET_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 6 };

// Supabase returns at most 1000 rows per request
const BATCH_SIZE = 1000;

const COLUMNS = "id, user_id, created_at, site, model, prompt_chars, tokens, water_ml, low_ml, high_ml, energy_wh";

type EstimateRow = {
    id: string;
    user_id: string;
    created_at: string;
    site: string;
    model: string | null;
    prompt_chars: number;
    tokens: number;
    water_ml: number;
    low_ml: number;
    high_ml: number;
    energy_wh: number;
};

const SORT_COLUMNS: Record<SortKey, string> = {
    date: "created_at",
    site: "site",
    model: "model",
    length: "prompt_chars",
    water: "water_ml",
    energy: "energy_wh",
};

function toEstimate(row: EstimateRow): Estimate {
    return {
        id: row.id,
        userId: row.user_id,
        createdAt: row.created_at,
        site: row.site,
        model: row.model ?? UNKNOWN_MODEL,
        promptChars: row.prompt_chars,
        tokens: row.tokens,
        waterMl: row.water_ml,
        lowMl: row.low_ml,
        highMl: row.high_ml,
        energyWh: row.energy_wh,
    };
}

// The current user's estimates, newest first, optionally only those since a time.
// RLS limits every query to the signed-in user, so there's no user_id filter.
export async function getUserEstimates(since?: number): Promise<Estimate[]> {
    const supabase = await createClient();
    const rows: EstimateRow[] = [];
    for (let from = 0; ; from += BATCH_SIZE) {
        let query = supabase
            .from("estimates")
            .select(COLUMNS)
            .order("created_at", { ascending: false })
            .order("id")
            .range(from, from + BATCH_SIZE - 1);
        if (since !== undefined) query = query.gte("created_at", new Date(since).toISOString());

        const { data, error } = await query;
        if (error) throw new Error(`Couldn't load estimates: ${error.message}`);
        rows.push(...(data as unknown as EstimateRow[]));
        if (data.length < BATCH_SIZE) break;
    }
    return rows.map(toEstimate);
}

export async function getEstimates(query: EstimateQuery = {}): Promise<EstimatePage> {
    const { sort = "date", dir = "desc", site, model, pageSize = 20 } = query;
    const supabase = await createClient();

    // Same filters for the count and the page
    const filtered = (columns: string, options?: { count: "exact"; head: true }) => {
        let q = supabase.from("estimates").select(columns, options);
        if (site) q = q.eq("site", site);
        if (model) q = model === UNKNOWN_MODEL ? q.is("model", null) : q.eq("model", model);
        return q;
    };

    // Count first so a page past the end can fall back to the last page
    const { count, error: countError } = await filtered("id", { count: "exact", head: true });
    if (countError) throw new Error(`Couldn't count estimates: ${countError.message}`);
    const total = count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(Math.max(1, query.page ?? 1), pageCount);

    const { data, error } = await filtered(COLUMNS)
        .order(SORT_COLUMNS[sort] ?? "created_at", { ascending: dir === "asc" })
        .order("id") // tie-break so rows don't repeat across pages
        .range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`Couldn't load estimates: ${error.message}`);
    return {
        rows: (data as unknown as EstimateRow[]).map(toEstimate), total, page, pageCount,
        pageSize
    };
}

// The sites and models that appear in the user's history, for the filter dropdowns
export async function getEstimateFacets(): Promise<{ sites: string[]; models: string[] }> {
    const estimates = await getUserEstimates();
    return {
        sites: [...new Set(estimates.map((e) => e.site))].sort(),
        models: [...new Set(estimates.map((e) => e.model))].sort(),
    };
}

export async function getUsageSeries(granularity: Granularity): Promise<UsagePoint[]> {
    await connection();
    const now = new Date();

    const starts: number[] = [];
    let start = bucketStart(now.getTime(), granularity);
    for (let i = 0; i < BUCKET_COUNT[granularity]; i++) {
        starts.unshift(start);
        start = previousBucket(start, granularity);
        start = previousBucket(start, granularity);
    }
    // Only fetch what the chart shows
    const estimates = await getUserEstimates(starts[0]);

    const buckets = new Map<number, UsagePoint>(
        starts.map((s) => [s, {
            start: new Date(s).toISOString(), waterMl: 0, lowMl: 0, highMl: 0,
            energyWh: 0, prompts: 0
        }]),

    );
    for (const e of estimates) {
        const bucket = buckets.get(bucketStart(Date.parse(e.createdAt), granularity));
        if (!bucket) continue;
        bucket.waterMl += e.waterMl;
        bucket.energyWh += e.energyWh;
        bucket.lowMl += e.lowMl;
        bucket.highMl += e.highMl;
        bucket.prompts += 1;
    }
    return [...buckets.values()];
}

export async function getUsageStats(): Promise<UsageStats> {
    await connection();
    const now = new Date();
    const estimates = await getUserEstimates();
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const twoWeeksAgo = now.getTime() - 14 * DAY_MS;

    const stats: UsageStats = {
        prompts: 0, totalMl: 0, lowMl: 0, highMl: 0, avgMl: 0, thisWeekMl: 0, lastWeekMl: 0,
        totalWh: 0, avgWh: 0,
    };
    for (const e of estimates) {
        const t = Date.parse(e.createdAt);
        stats.prompts += 1;
        stats.totalMl += e.waterMl;
        stats.lowMl += e.lowMl;
        stats.highMl += e.highMl;
        stats.totalWh += e.energyWh;
        if (t > weekAgo) stats.thisWeekMl += e.waterMl;
        else if (t > twoWeeksAgo) stats.lastWeekMl += e.waterMl;
    }
    stats.avgMl = stats.prompts ? stats.totalMl / stats.prompts : 0;
    stats.avgWh = stats.prompts ? stats.totalWh / stats.prompts : 0;

    return stats;
}
