import type { Metadata } from "next";
import Link from "next/link";
import styles from "./privacy.module.scss";

export const metadata: Metadata = {
  title: "Privacy policy · HydroPrompt",
  description: "What HydroPrompt collects, why, and who processes it.",
};

// Set before going live: where people send privacy questions and deletion requests
const CONTACT_EMAIL = "ghilesbouaraba@outlook.com";
const LAST_UPDATED = "1 November 2026";

export default function PrivacyPage() {
  return (
    <main className={styles.page}>
      <article className={styles.article}>
        <Link href="/" className={styles.back}>← Back to HydroPrompt</Link>
        <h1 className={styles.title}>Privacy policy</h1>
        <p className={styles.updated}>Last updated {LAST_UPDATED}</p>

        <p>
          HydroPrompt estimates the water and energy behind AI prompts. This page explains what we collect when you use
          the website and the EcoPrompt browser extension, why, and who processes it on our behalf. In short: we never
          store the text of your prompts.
        </p>

        <h2>What we collect</h2>
        <h3>If you create an account</h3>
        <ul>
          <li>Your email address and a securely hashed password, or, if you sign in with Google, your Google account
            email, name and profile picture URL.</li>
          <li>The username and optional display name you choose.</li>
          <li>Whether you appear on the leaderboard (on by default; you can turn it off).</li>
        </ul>

        <h3>When you check prompts while signed in</h3>
        <p>We save a record of each check so it appears in your history and dashboard. Each record contains only:</p>
        <ul>
          <li>the prompt&apos;s length in characters and its token count;</li>
          <li>its predicted complexity (easy, medium or hard);</li>
          <li>the water and energy estimates and the method used to calculate them;</li>
          <li>the site and model, where known, and when it happened.</li>
        </ul>
        <p>
          It never contains the prompt text or the AI&apos;s reply. The extension syncs the same kind of record for
          prompts you send on supported AI sites, once you sign in to it.
        </p>

        <h3>Prompt text</h3>
        <p>
          To check or compress a prompt, its text is sent over an encrypted connection to our analysis server, which
          counts its tokens, rates its complexity and returns the result. The server keeps the text only in memory while
          handling that request; it doesn&apos;t store or log it. If you aren&apos;t signed in, nothing about the check is
          saved. The extension can keep drafts and recent analyses in your browser&apos;s local storage on your own device;
          they aren&apos;t uploaded.
        </p>

        <h3>Cookies</h3>
        <p>
          We use only the cookies needed to keep you signed in. We don&apos;t use advertising or analytics cookies, and
          we don&apos;t track you across other sites.
        </p>

        <h2>Why we use it</h2>
        <ul>
          <li>To run your account and sign you in.</li>
          <li>To show your history, dashboard totals and, if you opt in, your position on the leaderboard.</li>
          <li>To estimate and compress the prompts you ask us to check.</li>
        </ul>
        <p>We don&apos;t sell your data, use it for advertising, or use your prompts to train models.</p>

        <h2>Who can see it</h2>
        <ul>
          <li>Your history and estimates are visible only to you.</li>
          <li>Other signed-in users can see your username and display name, and your weekly totals on the leaderboard if
            you appear on it.</li>
        </ul>

        <h2>Who processes it for us</h2>
        <ul>
          <li><strong>Supabase</strong>: accounts, sign-in and saved records.</li>
          <li><strong>Vercel</strong>: hosts the website.</li>
          <li><strong>Oracle Cloud (UK)</strong>: hosts the analysis server that processes prompt text.</li>
          <li><strong>Google</strong>: only if you choose to sign in with Google.</li>
        </ul>

        <h2>How long we keep it</h2>
        <p>
          We keep your account and saved records until you delete them or ask us to delete your account. Deleting your
          account permanently deletes your profile and all of your saved records.
        </p>

        <h2>Your rights</h2>
        <p>
          You can ask to see, correct, export or delete your data, or object to how we use it. Email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> and we&apos;ll respond within 30 days. If you&apos;re in
          the UK, you can also complain to the Information Commissioner&apos;s Office (ico.org.uk).
        </p>

        <h2>Changes</h2>
        <p>If we change this policy, we&apos;ll update this page and the date at the top.</p>
      </article>
    </main>
  );
}
