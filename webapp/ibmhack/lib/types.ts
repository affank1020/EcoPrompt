export type ModelSize = "small" | "medium" | "large";

export type Model = {
    id: string; // must match the model id the estimation API expects
    name: string;
    provider: string;
    size: ModelSize;
};

export type Complexity = "easy" | "medium" | "hard";
export type HistorySaveStatus = "saved" | "signed-out" | "failed";

// What the estimation API returns for one prompt
export type EstimateResult = {
    complexity?: Complexity;
    energyWh?: number | null;
    methodology?: string;
    model: string;
    tokens: number;
    waterMl: number;
    lowMl: number;
    highMl: number;
};

export type CompressionPreset = "light" | "balanced" | "aggressive";
export type CompressionDetails = {
    mode: "backend" | "local-mock";
    preset: CompressionPreset;
    reason: "ok" | "too_short" | "no_savings" | "verification_failed" | "local_mock";
    fallback: boolean;
    tokensBefore: number | null;
    tokensAfter: number | null;
    tokensSaved: number | null;
    negationsLost: string[];
    numbersLost: string[];
    latencyMs: number | null;
};

export type CompressionResult = {
    details: CompressionDetails;
    compressed: string;
    original: EstimateResult;
    optimised: EstimateResult;
};

// A stored estimate, as it will come back from Supabase
export type Estimate = EstimateResult & {
    id: string;
    userId: string;
    createdAt: string; // ISO date
    site: string;
    promptChars: number;
    methodology?: string;
};

export type User = {
    id: string;
    name: string;
    isAnonymous: boolean;
};

export type Granularity = "day" | "week" | "month";

export type UsagePoint = {
    energyWh: number | null;
    start: string; // ISO date of the start of the bucket
    waterMl: number;
    lowMl: number;
    highMl: number;
    prompts: number;
};

export type UsageStats = {
    totalWh: number | null;
    prompts: number;
    totalMl: number;
    lowMl: number;
    highMl: number;
    avgMl: number;
    thisWeekMl: number;
    lastWeekMl: number;
};

export type LeaderboardEntry = {
    totalWh: number | null;
    user: User;
    prompts: number;
    avgMl: number;
    totalMl: number;
    rank: number | null; // null when below the minimum prompt count
    isCurrentUser: boolean;
};

export type Challenge = {
    id: string;
    title: string;
    description: string;
    // "reach": progress counts up to the target; "stay-under": progress must stay below it
    kind: "reach" | "stay-under";
    progress: number;
    target: number;
    unit: string;
    endsAt: string; // ISO date
};
