import { connection } from "next/server";
import { getCurrentUser } from "../auth";
import type { Estimate, Granularity, UsagePoint, UsageStats } from "../types";
import { bucketStart, DAY_MS, previousBucket } from "./dates";
import { createClient } from "../supabase/server";

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

const BUCKET_COUNT: Record<Granularity, number> = { day: 30, week: 12, month: 6 };

// Every query below is scoped to the current user's estimates
export async function getUserEstimates(illustrativeOnly = false): Promise<{ estimates: Estimate[]; now: Date }> {
    await connection();
    const now = new Date();
    const user = await getCurrentUser();
    const estimates: Estimate[] = [];
    if (user.isAnonymous) return { estimates, now };
    const supabase = await createClient();
    for (let offset = 0; ; offset += 1000) {
        let query = supabase.from("estimates")
            .select("id,user_id,created_at,site,model,prompt_chars,tokens,water_ml,low_ml,high_ml,energy_wh,methodology")
            .eq("user_id", user.id).order("created_at", { ascending: false }).order("id")
            .range(offset, offset + 999);
        if (illustrativeOnly) query = query.eq("methodology", "ecoprompt-illustrative-v1");
        const { data, error } = await query;
        if (error) throw new Error(`Couldn't load estimates: ${error.message}`);
        for (const row of data ?? []) estimates.push({
            id: row.id, userId: row.user_id, createdAt: row.created_at, site: row.site,
            model: row.model ?? "Unknown", promptChars: row.prompt_chars, tokens: row.tokens,
            energyWh: row.energy_wh, waterMl: row.water_ml, lowMl: row.low_ml, highMl: row.high_ml, methodology: row.methodology,
        });
        if (!data || data.length < 1000) break;
    }
    return { estimates, now };
}

const COLUMNS = "id,user_id,created_at,site,model,prompt_chars,tokens,water_ml,low_ml,high_ml,energy_wh,methodology";
const SORT_COLUMNS: Record<SortKey, string> = {
    date: "created_at", site: "site", model: "model", length: "prompt_chars", water: "water_ml", energy: "energy_wh",
};

export async function getEstimates(query: EstimateQuery = {}): Promise<EstimatePage> {
    await connection();
    const user = await getCurrentUser();
    const pageSize = Math.min(100, Math.max(1, Math.trunc(query.pageSize || 20)));
    if (user.isAnonymous) return { rows: [], total: 0, page: 1, pageCount: 1, pageSize };
    const supabase = await createClient();
    const filtered = (head = false) => {
        let q = supabase.from("estimates").select(COLUMNS, { count: "exact", head }).eq("user_id", user.id);
        if (query.site) q = q.eq("site", query.site);
        if (query.model) q = query.model === "Unknown" ? q.is("model", null) : q.eq("model", query.model);
        return q;
    };
    const { count, error: countError } = await filtered(true);
    if (countError) throw new Error(`Couldn't count estimates: ${countError.message}`);
    const total = count ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(pageCount, Math.max(1, Math.trunc(query.page || 1)));
    const { data, error } = await filtered()
        .order(SORT_COLUMNS[query.sort ?? "date"] ?? "created_at", { ascending: query.dir === "asc", nullsFirst: false })
        .order("id").range((page - 1) * pageSize, page * pageSize - 1);
    if (error) throw new Error(`Couldn't load estimates: ${error.message}`);
    const rows: Estimate[] = (data ?? []).map(row => ({
        id: row.id, userId: row.user_id, createdAt: row.created_at, site: row.site,
        model: row.model ?? "Unknown", promptChars: row.prompt_chars, tokens: row.tokens,
        waterMl: row.water_ml, lowMl: row.low_ml, highMl: row.high_ml,
        energyWh: row.energy_wh, methodology: row.methodology,
    }));
    return { rows, total, page, pageCount, pageSize };
}

// The sites and models that appear in the user's history, for the filter dropdowns
export async function getEstimateFacets(): Promise<{ sites: string[]; models: string[] }> {
    const user = await getCurrentUser();
    if (user.isAnonymous) return { sites: [], models: [] };
    const supabase = await createClient();
    const sites = new Set<string>();
    const models = new Set<string>();
    for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("estimates").select("site,model")
            .eq("user_id", user.id).order("id").range(offset, offset + 999);
        if (error) throw new Error(`Couldn't load filters: ${error.message}`);
        for (const row of data ?? []) { sites.add(row.site); models.add(row.model ?? "Unknown"); }
        if (!data || data.length < 1000) break;
    }
    return { sites: [...sites].sort(), models: [...models].sort() };
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
        starts.map((s) => [s, { start: new Date(s).toISOString(), energyWh: 0, waterMl: 0, lowMl: 0, highMl: 0, prompts: 0 }]),
    );
    for (const e of estimates) {
        const bucket = buckets.get(bucketStart(Date.parse(e.createdAt), granularity));
        if (!bucket) continue;
        bucket.energyWh = bucket.energyWh === null || e.energyWh == null ? null : bucket.energyWh + e.energyWh;
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

    const stats: UsageStats = { totalWh: 0, prompts: 0, totalMl: 0, lowMl: 0, highMl: 0, avgMl: 0, thisWeekMl: 0, lastWeekMl: 0 };
    for (const e of estimates) {
        const t = Date.parse(e.createdAt);
        stats.totalWh = stats.totalWh === null || e.energyWh == null ? null : stats.totalWh + e.energyWh;
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
