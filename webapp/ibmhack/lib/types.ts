export type ModelSize = "small" | "medium" | "large";

export type Model = {
    id: string; // must match the model id the estimation API expects
    name: string;
    provider: string;
    size: ModelSize;
};

// What the estimation API returns for one prompt
export type EstimateResult = {
    model: string;
    tokens: number;
    waterMl: number;
    lowMl: number;
    highMl: number;
};

export type CompressionResult = {
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
};

export type LeaderboardEntry = {
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
