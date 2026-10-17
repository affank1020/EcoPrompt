// Mirrors styles/_variables.scss for Recharts, which needs colours as JS strings
import type { ModelSize } from "../../lib/types";

export const CHART_COLORS = {
    water: "#1f78c1",
    waterLight: "#7fbbe6",
    waterFaint: "#d6eaf8",
    ink: "#0d1b2a",
    muted: "#6b7c8f",
    grid: "#dfe7ee",
};

export const SIZE_COLORS: Record<ModelSize, string> = {
    small: "#3fa34d",
    medium: "#1f78c1",
    large: "#0a2f55",
};
