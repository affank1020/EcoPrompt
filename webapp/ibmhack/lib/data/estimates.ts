import { connection } from "next/server";
import { getCurrentUser } from "../auth";
import type { Estimate, Granularity, UsagePoint, UsageStats } from "../types";
import { bucketStart, DAY_MS, previousBucket } from "./dates";
import { createClient } from "../supabase/server";

export type SortKey = "date" | "site" | "model" | "length" | "water";
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

const BUCKET_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 6 };

// Every query below is scoped to the current user's estimates
async function getUserEstimates(illustrativeOnly = false): Promise<{ estimates: Estimate[]; now: Date }> {
    await connection();
    const now = new Date();
    const user = await getCurrentUser();
    const estimates: Estimate[] = [];
    if (user.isAnonymous) return { estimates, now };
    const supabase = await createClient();
    for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("estimates")
            .select("id,user_id,created_at,site,model,prompt_chars,tokens,water_ml,low_ml,high_ml,methodology")
            .eq("user_id", user.id).order("created_at", { ascending: false }).order("id")
            .range(offset, offset + 999);
        if (illustrativeOnly) query = query.eq("methodology", "ecoprompt-illustrative-v1");
        const { data, error } = await query;
        if (error) throw new Error(`Couldn't load estimates: ${error.message}`);
        for (const row of data ?? []) estimates.push({
            id: row.id, userId: row.user_id, createdAt: row.created_at, site: row.site,
            model: row.model ?? "Unknown", promptChars: row.prompt_chars, tokens: row.tokens,
            waterMl: row.water_ml, lowMl: row.low_ml, highMl: row.high_ml, methodology: row.methodology,
        });
        if (!data || data.length < 1000) break;
    }
    return { estimates, now };
}

const SORTERS: Record<SortKey, (a: Estimate, b: Estimate) => number> = {
    date: (a, b) => a.createdAt.localeCompare(b.createdAt),
    site: (a, b) => a.site.localeCompare(b.site),
    model: (a, b) => a.model.localeCompare(b.model),
    length: (a, b) => a.promptChars - b.promptChars,
    water: (a, b) => a.waterMl - b.waterMl,
};

export async function getEstimates(query: EstimateQuery = {}): Promise<EstimatePage> {
    const { sort = "date", dir = "desc", site, model, pageSize = 20 } = query;
    // TODO(supabase): move filtering, ordering and range() into the query
    const { estimates } = await getUserEstimates();

    const filtered = estimates.filter((e) => (!site || e.site === site) && (!model || e.model === model));
    const sorter = SORTERS[sort] ?? SORTERS.date;
    filtered.sort((a, b) => (dir === "asc" ? sorter(a, b) : sorter(b, a)));

    const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
    const page = Math.min(Math.max(1, query.page ?? 1), pageCount);
    const rows = filtered.slice((page - 1) * pageSize, page * pageSize);
    return { rows, total: filtered.length, page, pageCount, pageSize };
}

// The sites and models that appear in the user's history, for the filter dropdowns
export async function getEstimateFacets(): Promise<{ sites: string[]; models: string[] }> {
    const { estimates } = await getUserEstimates();
    return {
        sites: [...new Set(estimates.map((e) => e.site))].sort(),
        models: [...new Set(estimates.map((e) => e.model))].sort(),
    };
}

export async function getUsageSeries(granularity: Granularity): Promise<UsagePoint[]> {
    const { estimates, now } = await getUserEstimates(true);

    const starts: number[] = [];
    let start = bucketStart(now.getTime(), granularity);
    for (let i = 0; i < BUCKET_COUNT[granularity]; i++) {
        starts.unshift(start);
        start = previousBucket(start, granularity);
    }

    const buckets = new Map<number, UsagePoint>(
        starts.map((s) => [s, { start: new Date(s).toISOString(), waterMl: 0, lowMl: 0, highMl: 0, prompts: 0 }]),
    );
    for (const e of estimates) {
        const bucket = buckets.get(bucketStart(Date.parse(e.createdAt), granularity));
        if (!bucket) continue;
        bucket.waterMl += e.waterMl;
        bucket.lowMl += e.lowMl;
        bucket.highMl += e.highMl;
        bucket.prompts += 1;
    }
    return [...buckets.values()];
}

export async function getUsageStats(): Promise<UsageStats> {
    const { estimates, now } = await getUserEstimates(true);
    const weekAgo = now.getTime() - 7 * DAY_MS;
    const twoWeeksAgo = now.getTime() - 14 * DAY_MS;

    const stats: UsageStats = { prompts: 0, totalMl: 0, lowMl: 0, highMl: 0, avgMl: 0, thisWeekMl: 0, lastWeekMl: 0 };
    for (const e of estimates) {
        const t = Date.parse(e.createdAt);
        stats.prompts += 1;
        stats.totalMl += e.waterMl;
        stats.lowMl += e.lowMl;
        stats.highMl += e.highMl;
        if (t > weekAgo) stats.thisWeekMl += e.waterMl;
        else if (t > twoWeeksAgo) stats.lastWeekMl += e.waterMl;
    }
    stats.avgMl = stats.prompts ? stats.totalMl / stats.prompts : 0;
    return stats;
}
