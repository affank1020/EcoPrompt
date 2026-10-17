// Mock data standing in for Supabase until the database is connected.
// TODO(supabase): delete this file once lib/data/ queries the real tables.

import { ANONYMOUS_USER } from "../auth";
import { mockEstimate } from "../estimation/mock";
import type { Estimate, User } from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_DAYS = 180;

const SITE_MODELS: Record<string, [large: string, small: string]> = {
    "chatgpt.com": ["gpt-4o", "gpt-4o-mini"],
    "claude.ai": ["claude-opus", "claude-haiku"],
    "gemini.google.com": ["gemini-pro", "gemini-flash"],
    "chat.mistral.ai": ["mistral-large", "mistral-large"],
    "perplexity.ai": ["llama-70b", "llama-8b"],
};
const SITES = Object.keys(SITE_MODELS);

type Profile = {
    user: User;
    promptsPerDay: number;
    avgChars: number;
    // Share of prompts sent to a small model, given how many days ago the prompt was sent
    smallShare: (daysAgo: number) => number;
    days: number;
};

function mockUser(id: string, name: string, promptsPerDay: number, smallShare: number, avgChars: number): Profile {
    return {
        user: { id, name, isAnonymous: false },
        promptsPerDay,
        avgChars,
        smallShare: () => smallShare,
        days: 14, // other users only need enough history for the weekly leaderboard
    };
}

const PROFILES: Profile[] = [
    {
        user: ANONYMOUS_USER,
        promptsPerDay: 6,
        avgChars: 420,
        // You've been getting more efficient over the last six months
        smallShare: (daysAgo) => 0.15 + 0.4 * (1 - daysAgo / HISTORY_DAYS),
        days: HISTORY_DAYS,
    },
    mockUser("u-maya", "Maya Chen", 9, 0.75, 260),
    mockUser("u-tom", "Tom Okafor", 4, 0.2, 900),
    mockUser("u-priya", "Priya Nair", 7, 0.6, 350),
    mockUser("u-lucas", "Lucas Martin", 12, 0.35, 520),
    mockUser("u-sofia", "Sofia Rossi", 3, 0.85, 180),
    mockUser("u-kenji", "Kenji Watanabe", 8, 0.5, 610),
    mockUser("u-amara", "Amara Diallo", 5, 0.65, 300),
    mockUser("u-ethan", "Ethan Brooks", 15, 0.1, 1200),
    mockUser("u-lena", "Lena Fischer", 6, 0.45, 400),
    mockUser("u-omar", "Omar Haddad", 0.6, 0.9, 150), // too few prompts to rank
    mockUser("u-grace", "Grace Liu", 10, 0.55, 480),
    mockUser("u-noah", "Noah Patel", 0.8, 0.3, 700), // too few prompts to rank
];

export const MOCK_USERS: User[] = PROFILES.map((p) => p.user);

// Seeded PRNG so the mock data is the same on every run
function mulberry32(seed: number) {
    return () => {
        seed = (seed + 0x6d2b79f5) | 0;
        let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function hashString(s: string) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
    return h >>> 0;
}

function generate(profile: Profile, now: Date): Estimate[] {
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const estimates: Estimate[] = [];

    for (let daysAgo = profile.days - 1; daysAgo >= 0; daysAgo--) {
        const dayStart = today - daysAgo * DAY_MS;
        // Seed per user per calendar day, so a day's prompts don't change as time passes
        const rand = mulberry32(hashString(`${profile.user.id}:${dayStart}`));
        const weekday = new Date(dayStart).getUTCDay();
        const weekendFactor = weekday === 0 || weekday === 6 ? 0.45 : 1;
        const count = Math.round(profile.promptsPerDay * weekendFactor * (0.4 + rand() * 1.2));

        for (let i = 0; i < count; i++) {
            const time = dayStart + Math.floor((7 + rand() * 16) * 60 * 60 * 1000);
            if (time > now.getTime()) continue;

            const site = SITES[Math.floor(rand() * SITES.length)];
            const [large, small] = SITE_MODELS[site];
            const model = rand() < profile.smallShare(daysAgo) ? small : large;
            // Log-normal prompt lengths: mostly short, with the odd very long paste
            const normal = Math.sqrt(-2 * Math.log(rand() || 1e-9)) * Math.cos(2 * Math.PI * rand());
            const promptChars = Math.round(Math.min(8000, Math.max(20, profile.avgChars * Math.exp(0.8 * normal))));

            estimates.push({
                ...mockEstimate(promptChars, model),
                id: `${profile.user.id}-${dayStart}-${i}`,
                userId: profile.user.id,
                createdAt: new Date(time).toISOString(),
                site,
                promptChars,
            });
        }
    }
    return estimates;
}

let cache: { key: string; estimates: Estimate[] } | null = null;

export function getMockEstimates(now: Date): Estimate[] {
    // Regenerate once per hour so "today" keeps filling in
    const key = now.toISOString().slice(0, 13);
    if (cache?.key !== key) {
        cache = { key, estimates: PROFILES.flatMap((p) => generate(p, now)) };
    }
    return cache.estimates;
}
