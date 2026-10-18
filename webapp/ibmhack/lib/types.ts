export type ModelSize = "small" | "medium" | "large";

export type Model = {
    id: string; // must match the model id the estimation API expects
    name: string;
    provider: string;
    size: ModelSize;
};

export type Complexity = "easy" | "medium" | "hard";

// What the estimation API returns for one prompt
export type EstimateResult = {
    model: string;
    tokens: number;
    complexity?: Complexity;
    waterMl: number;
    lowMl: number;
    highMl: number;
    energyWh: number;
};

export type CompressionPreset = "light" | "balanced" | "aggressive";

// What /compress reports about one compression
export type CompressionDetails = {
    preset: CompressionPreset;
    // "ok" when the prompt was shortened; otherwise why the original was kept
    // ("too_short", "no_savings" or "verification_failed")
    reason: string;
    tokensBefore: number;
    tokensAfter: number;
    // Words and numbers compression would have dropped, which made it keep the original
    negationsLost: string[];
    numbersLost: string[];
    latencyMs: number;
};

export type CompressionResult = {
    compressed: string;
    original: EstimateResult;
    optimised: EstimateResult;
    details: CompressionDetails;
};

// A stored estimate, as it will come back from Supabase
export type Estimate = EstimateResult & {
    id: string;
    userId: string;
    createdAt: string; // ISO date
    site: string;
    promptChars: number;
};

export type User = {
    id: string;
    name: string;
    isAnonymous: boolean;
};

export type Granularity = "day" | "week" | "month";

export type UsagePoint = {
    start: string; // ISO date of the start of the bucket
    waterMl: number;
    lowMl: number;
    highMl: number;
    energyWh: number;
    prompts: number;
};

export type UsageStats = {
    prompts: number;
    totalMl: number;
    lowMl: number;
    highMl: number;
    avgMl: number;
    thisWeekMl: number;
    lastWeekMl: number;
    totalWh: number;
    avgWh: number;
};

export type LeaderboardEntry = {
    user: User;
    prompts: number;
    avgMl: number;
    totalMl: number;
    totalWh: number;
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
