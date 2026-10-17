import type { Granularity } from "../types";

export const DAY_MS = 24 * 60 * 60 * 1000;

// All bucketing is done in UTC so the server and the browser agree
export function startOfDay(t: number) {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function startOfWeek(t: number) {
    const day = startOfDay(t);
    const weekday = (new Date(day).getUTCDay() + 6) % 7; // Monday = 0
    return day - weekday * DAY_MS;
}

export function startOfMonth(t: number) {
    const d = new Date(t);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
}

export function bucketStart(t: number, granularity: Granularity) {
    if (granularity === "day") return startOfDay(t);
    if (granularity === "week") return startOfWeek(t);
    return startOfMonth(t);
}

export function previousBucket(start: number, granularity: Granularity) {
    if (granularity === "day") return start - DAY_MS;
    if (granularity === "week") return start - 7 * DAY_MS;
    const d = new Date(start);
    return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1);
}
