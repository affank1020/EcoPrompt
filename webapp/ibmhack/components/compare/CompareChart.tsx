"use client";

import { Bar, BarChart, CartesianGrid, Cell, ErrorBar, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { EstimateResult, Model } from "../../lib/types";
import { CHART_COLORS, SIZE_COLORS } from "../charts/palette";
import { formatMl, formatRange } from "../ui/format";
import styles from "./CompareChart.module.scss";

type Props = {
    rows: { model: Model; result: EstimateResult }[];
};

type Datum = {
    name: string;
    size: Model["size"];
    waterMl: number;
    lowMl: number;
    highMl: number;
    // ErrorBar takes [distance below, distance above] the bar's value
    error: [number, number];
};

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Datum }[] }) {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className={styles.tooltip}>
            <strong>{d.name}</strong>
            <span>{formatMl(d.waterMl)}</span>
            <span className={styles.tooltipRange}>Range {formatRange(d.lowMl, d.highMl)}</span>
        </div>
    );
}

export default function CompareChart({ rows }: Props) {
    const data: Datum[] = [...rows]
        .sort((a, b) => a.result.waterMl - b.result.waterMl)
        .map(({ model, result }) => ({
            name: model.name,
            size: model.size,
            waterMl: result.waterMl,
            lowMl: result.lowMl,
            highMl: result.highMl,
            error: [result.waterMl - result.lowMl, result.highMl - result.waterMl],
        }));

    return (
        <figure className={styles.figure}>
            <figcaption className={styles.caption}>
                Estimated water for this prompt. Whiskers show the uncertainty range.
            </figcaption>
            <div className={styles.chart} style={{ height: 56 + data.length * 44 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, bottom: 4, left: 8 }}>
                        <CartesianGrid horizontal={false} stroke={CHART_COLORS.grid} />
                        <XAxis
                            type="number"
                            tickFormatter={(v: number) => formatMl(v)}
                            tick={{ fontSize: 12, fill: CHART_COLORS.muted }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <YAxis
                            type="category"
                            dataKey="name"
                            width={110}
                            tick={{ fontSize: 13, fill: CHART_COLORS.ink }}
                            axisLine={false}
                            tickLine={false}
                        />
                        <Tooltip content={<ChartTooltip />} cursor={{ fill: CHART_COLORS.waterFaint, opacity: 0.4 }} />
                        <Bar dataKey="waterMl" radius={[0, 6, 6, 0]} barSize={22} isAnimationActive={false}>
                            {data.map((d) => (
                                <Cell key={d.name} fill={SIZE_COLORS[d.size]} />
                            ))}
                            <ErrorBar dataKey="error" direction="x" width={8} strokeWidth={1.5} stroke={CHART_COLORS.muted} />
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
        </figure>
    );
}
