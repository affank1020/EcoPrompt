import { connection } from "next/server";
import { getCurrentUser } from "../auth";
import { getModel } from "../estimation/models";
import { createClient } from "../supabase/server";
import type { Challenge, LeaderboardEntry } from "../types";
import { DAY_MS, startOfDay, startOfWeek } from "./dates";
import { getUserEstimates } from "./estimates";

export const MIN_PROMPTS_TO_RANK = 10;

export type Leaderboard = {
    entries: LeaderboardEntry[];
    minPrompts: number;
    since: string; // ISO date the window starts
};

// One row per user from the weekly_leaderboard() database function
type LeaderboardRow = {
    user_id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
    prompts: number;
    total_ml: number;
    avg_ml: number;
    total_wh: number;
};

// Lowest average water per prompt over the past 7 days wins
export async function getWeeklyLeaderboard(minPrompts = MIN_PROMPTS_TO_RANK): Promise<Leaderboard> {
    await connection();
    const since = new Date(Date.now() - 7 * DAY_MS).toISOString();
    const supabase = await createClient();
    const [currentUser, { data, error }] = await Promise.all([
        getCurrentUser(),
        supabase.rpc("weekly_leaderboard", { p_since: since }),
    ]);
    if (error) throw new Error(`Couldn't load the leaderboard: ${error.message}`);

    const entries: LeaderboardEntry[] = (data as LeaderboardRow[]).map((row) => ({
        user: { id: row.user_id, name: row.display_name ?? row.username, isAnonymous: false },
        prompts: Number(row.prompts),
        totalMl: row.total_ml,
        totalWh: row.total_wh,
        avgMl: row.avg_ml,
        rank: null,
        isCurrentUser: row.user_id === currentUser.id,
    }));
    // Always show the current user, even before their first prompt this week
    if (!currentUser.isAnonymous && !entries.some((e) => e.isCurrentUser)) {
        entries.push({
            user: currentUser, prompts: 0, totalMl: 0, totalWh: 0, avgMl: 0, rank: null,
            isCurrentUser: true,
        });
    }

    const ranked = entries.filter((e) => e.prompts >= minPrompts).sort((a, b) => a.avgMl - b.avgMl);
    ranked.forEach((e, i) => (e.rank = i + 1));
    const unranked = entries.filter((e) => e.prompts < minPrompts).sort((a, b) => b.prompts -
        a.prompts);

    return { entries: [...ranked, ...unranked], minPrompts, since };
}


// Challenges run Monday to Sunday and track the current user's progress
export async function getChallenges(): Promise<Challenge[]> {
    await connection();
    const now = new Date();
    const weekStart = startOfWeek(now.getTime());
    const endsAt = new Date(weekStart + 7 * DAY_MS).toISOString();
    // This week, plus enough days back for a 7-day streak that started last week
    const mine = await getUserEstimates(Math.min(weekStart, startOfDay(now.getTime()) - 8 * DAY_MS));
    const thisWeek = mine.filter((e) => Date.parse(e.createdAt) >= weekStart);

    const activeDays = new Set(mine.map((e) => startOfDay(Date.parse(e.createdAt))));
    // Today only breaks the streak once it's over, so start from yesterday if nothing is logged yet
    let day = startOfDay(now.getTime());
    if (!activeDays.has(day)) day -= DAY_MS;
    const STREAK_TARGET = 7;
    let streak = 0;
    for (; activeDays.has(day) && streak < STREAK_TARGET; day -= DAY_MS) streak++;

    return [
        {
            id: "small-models",
            title: "Think small",
            description: "Send 15 prompts to a small model this week.",
            kind: "reach",
            progress: thisWeek.filter((e) => getModel(e.model)?.size === "small").length,
            target: 15,
            unit: "prompts",
            endsAt,
        },
        {
            id: "water-budget",
            title: "Weekly water budget",
            description: "Keep your total water use under 35 mL this week.",
            kind: "stay-under",
            progress: thisWeek.reduce((sum, e) => sum + e.waterMl, 0),
            target: 35,
            unit: "mL",
            endsAt,
        },
        {
            id: "short-prompts",
            title: "Say it shorter",
            description: "Send 10 prompts under 300 characters this week.",
            kind: "reach",
            progress: thisWeek.filter((e) => e.promptChars < 300).length,
            target: 10,
            unit: "prompts",
            endsAt,
        },
        {
            id: "streak",
            title: "Daily tracker",
            description: "Check your prompts every day for 7 days in a row.",
            kind: "reach",
            progress: streak,
            target: STREAK_TARGET,
            unit: "days",
            endsAt,
        },
    ];
}
