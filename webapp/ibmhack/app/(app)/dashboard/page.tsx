import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import UsageChart from "../../../components/charts/UsageChart";
import { formatMl, formatNumber, formatRange } from "../../../components/ui/format";
import PageHeader from "../../../components/ui/PageHeader";
import Skeleton from "../../../components/ui/Skeleton";
import StatCard from "../../../components/ui/StatCard";
import { getUsageSeries, getUsageStats } from "../../../lib/data/estimates";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Dashboard · HydroPrompt" };

const GLASS_ML = 250;

async function Stats() {
  const stats = await getUsageStats();
  const change = stats.lastWeekMl ? (stats.thisWeekMl - stats.lastWeekMl) / stats.lastWeekMl : 0;
  const glasses = stats.totalMl / GLASS_ML;

  return (
    <div className={styles.stats}>
      <StatCard
        label="Total water"
        value={formatMl(stats.totalMl)}
        sub={`Range ${formatRange(stats.lowMl, stats.highMl)} · about ${glasses < 1 ? "<1" : Math.round(glasses)} glass${glasses >= 1.5 ? "es" : ""}`}
      />
      <StatCard label="Average per prompt" value={formatMl(stats.avgMl)} sub={`Across ${formatNumber(stats.prompts)} prompts`} />
      <StatCard label="Prompts checked" value={formatNumber(stats.prompts)} sub="Since you started tracking" />
      <StatCard
        label="Past 7 days"
        value={formatMl(stats.thisWeekMl)}
        sub={`${change <= 0 ? "▼" : "▲"} ${Math.abs(change * 100).toFixed(0)}% vs the week before`}
        tone={change <= 0 ? "good" : "warning"}
      />
    </div>
  );
}

async function Chart() {
  const [day, week, month] = await Promise.all([
    getUsageSeries("day"),
    getUsageSeries("week"),
    getUsageSeries("month"),
  ]);
  return <UsageChart series={{ day, week, month }} />;
}

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Your water footprint"
        description="Estimated water used by the prompts you've sent, based on the estimates the extension records."
        actions={<Link href="/dashboard/history" className={styles.link}>View history →</Link>}
      />
      <Suspense fallback={<div className={styles.stats}>{[0, 1, 2, 3].map((i) => <Skeleton key={i} height={128} />)}</div>}>
        <Stats />
      </Suspense>
      <Suspense fallback={<Skeleton height={400} label="Loading chart" />}>
        <Chart />
      </Suspense>
    </>
  );
}
