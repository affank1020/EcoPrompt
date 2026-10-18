"use client";

import { useState } from "react";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { Granularity, UsagePoint } from "../../lib/types";
import { formatDate, formatMl, formatWh, formatRange } from "../ui/format";
import SegmentedToggle from "../ui/SegmentedToggle";
import { CHART_COLORS } from "./palette";
import styles from "./UsageChart.module.scss";

type Props = {
    series: Record<Granularity, UsagePoint[]>;
};

const GRANULARITIES: { value: Granularity; label: string }[] = [
    { value: "day", label: "Days" },
    { value: "week", label: "Weeks" },
    { value: "month", label: "Months" },
];

const TICK_FORMAT: Record<Granularity, Intl.DateTimeFormatOptions> = {
    day: { day: "numeric", month: "short" },
    week: { day: "numeric", month: "short" },
    month: { month: "short", year: "2-digit" },
};

type Datum = UsagePoint & { range: [number, number] };

function ChartTooltip({ active, payload, granularity }: { active?: boolean; payload?: { payload: Datum }[]; granularity: Granularity }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    const prefix = granularity === "week" ? "Week of " : "";
    const format = granularity === "month" ? { month: "long", year: "numeric" } as const : undefined;
    return (
        <div className={styles.tooltip}>
            <span className={styles.tooltipDate}>{prefix}{formatDate(d.start, format)}</span>
            <strong>{formatMl(d.waterMl)}</strong>
            <span className={styles.tooltipMuted}>{formatWh(d.energyWh)} energy</span>
            <span className={styles.tooltipMuted}>Range {formatRange(d.lowMl, d.highMl)}</span>
            <span className={styles.tooltipMuted}>{d.prompts} prompts</span>
        </div>
    );
}

export default function UsageChart({ series }: Props) {
    const [granularity, setGranularity] = useState<Granularity>("day");
    const data: Datum[] = series[granularity].map((p) => ({ ...p, range: [p.lowMl, p.highMl] }));

    return (
        <section className={styles.card}>
            <header className={styles.header}>
                <div>
                    <h2 className={styles.title}>Water use over time</h2>
                    <p className={styles.legend}>
                        <span className={styles.legendLine} /> Estimate
                        <span className={styles.legendBand} /> Uncertainty range
                    </p>
                </div>
                <SegmentedToggle options={GRANULARITIES} value={granularity} onChange={setGranularity} ariaLabel="Group by" />
            </header>
            <div className={styles.chart}>
                <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                        <defs>
                            <linearGradient id="usage-fill" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor={CHART_COLORS.water} stopOpacity={0.35} />
                                <stop offset="100%" stopColor={CHART_COLORS.water} stopOpacity={0.02} />
                            </linearGradient>
                        </defs>
                        <CartesianGrid vertical={false} stroke={CHART_COLORS.grid} />
                        <XAxis
                            dataKey="start"
                            tickFormatter={(v: string) => formatDate(v, TICK_FORMAT[granularity])}
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            axisLine={false}
                            tickLine={false}
                            minTickGap={24}
                        />
                        <YAxis
                            tickFormatter={(v: number) => formatMl(v)}
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            axisLine={false}
                            tickLine={false}
                            width={64}
                        />
                        <Tooltip content={<ChartTooltip granularity={granularity} />} />
                        <Area dataKey="range" stroke="none" fill={CHART_COLORS.waterFaint} fillOpacity={0.7} isAnimationActive={false} />
                        <Area
                            dataKey="waterMl"
                            stroke={CHART_COLORS.water}
                            strokeWidth={2}
                            fill="url(#usage-fill)"
                            isAnimationActive={false}
                            activeDot={{ r: 4 }}
                        />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </section>
    );
}
