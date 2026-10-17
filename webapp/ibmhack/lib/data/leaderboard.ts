import { connection } from "next/server";
import { getCurrentUser } from "../auth";
import { getModel } from "../estimation/models";
import type { Challenge, LeaderboardEntry } from "../types";
import { DAY_MS, startOfDay, startOfWeek } from "./dates";
import { getMockEstimates, MOCK_USERS } from "./mock";

export const MIN_PROMPTS_TO_RANK = 10;

export type Leaderboard = {
    entries: LeaderboardEntry[];
    minPrompts: number;
    since: string; // ISO date the window starts
};

// Lowest average water per prompt over the past 7 days wins
export async function getWeeklyLeaderboard(minPrompts = MIN_PROMPTS_TO_RANK): Promise<Leaderboard> {
    await connection();
    const now = new Date();
    const since = now.getTime() - 7 * DAY_MS;
    // TODO(auth): the user comes from the Supabase session once login exists
    const currentUser = await getCurrentUser();

    // TODO(supabase): replace with an aggregate query (or view) grouped by user_id over the past 7 days,
    // joined to profiles for display names
    const totals = new Map<string, { prompts: number; totalMl: number }>();
    for (const e of getMockEstimates(now)) {
        if (Date.parse(e.createdAt) <= since) continue;
        const t = totals.get(e.userId) ?? { prompts: 0, totalMl: 0 };
        t.prompts += 1;
        t.totalMl += e.waterMl;
        totals.set(e.userId, t);
    }

    const entries: LeaderboardEntry[] = MOCK_USERS.map((user) => {
        const t = totals.get(user.id) ?? { prompts: 0, totalMl: 0 };
        return {
            user,
            prompts: t.prompts,
            totalMl: t.totalMl,
            avgMl: t.prompts ? t.totalMl / t.prompts : 0,
            rank: null,
            isCurrentUser: user.id === currentUser.id,
        };
    });

    const ranked = entries.filter((e) => e.prompts >= minPrompts).sort((a, b) => a.avgMl - b.avgMl);
    ranked.forEach((e, i) => (e.rank = i + 1));
    const unranked = entries.filter((e) => e.prompts < minPrompts).sort((a, b) => b.prompts - a.prompts);

    return { entries: [...ranked, ...unranked], minPrompts, since: new Date(since).toISOString() };
}

// Challenges run Monday to Sunday and track the current user's progress
export async function getChallenges(): Promise<Challenge[]> {
    await connection();
    const now = new Date();
    const weekStart = startOfWeek(now.getTime());
    const endsAt = new Date(weekStart + 7 * DAY_MS).toISOString();
    // TODO(auth): the user comes from the Supabase session once login exists
    const user = await getCurrentUser();
    // TODO(supabase): read challenge definitions from a challenges table and progress from estimates
    const mine = getMockEstimates(now).filter((e) => e.userId === user.id);
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
