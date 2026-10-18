import type { Metadata } from "next";
import { Suspense } from "react";
import ChallengeCard from "../../../components/leaderboard/ChallengeCard";
import LeaderboardTable from "../../../components/leaderboard/LeaderboardTable";
import { formatDate } from "../../../components/ui/format";
import PageHeader from "../../../components/ui/PageHeader";
import Skeleton from "../../../components/ui/Skeleton";
import { getChallenges, getWeeklyLeaderboard } from "../../../lib/data/leaderboard";
import styles from "./page.module.scss";

export const metadata: Metadata = { title: "Leaderboard · HydroPrompt" };

async function Board() {
  const { entries, minPrompts, since } = await getWeeklyLeaderboard();
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Most efficient this week</h2>
        <p className={styles.sectionNote}>
          Lowest average water per prompt since {formatDate(since, { weekday: "short", day: "numeric", month: "short" })}.
          You need at least {minPrompts} prompts to be ranked, so a couple of tiny prompts can&apos;t top the table.
        </p>
      </div>
      <LeaderboardTable entries={entries} minPrompts={minPrompts} />
    </section>
  );
}

async function Challenges() {
  const challenges = await getChallenges();
  return (
    <section className={styles.section}>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>This week&apos;s challenges</h2>
      </div>
      <div className={styles.challenges}>
        {challenges.map((c) => (
          <ChallengeCard key={c.id} challenge={c} />
        ))}
      </div>
    </section>
  );
}

export default function LeaderboardPage() {
  return (
    <>
      <PageHeader
        title="Leaderboard"
        description="Past seven days of illustrative extension v1 estimates only, not measured consumption or savings. Other methodologies are excluded. Only opted-in profiles appear."
      />
      <div className={styles.layout}>
        <Suspense fallback={<Skeleton height={520} label="Loading leaderboard" />}>
          <Board />
        </Suspense>
        <Suspense fallback={<Skeleton height={520} label="Loading challenges" />}>
          <Challenges />
        </Suspense>
      </div>
    </>
  );
}
