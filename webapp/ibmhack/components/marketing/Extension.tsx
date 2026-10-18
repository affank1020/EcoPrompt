import Link from "next/link";
import styles from "./Extension.module.scss";

export default function Extension() {
    return (
        <section id="extension" className={styles.section}>
            <div className={styles.inner}>
                <div className={styles.intro}>
                    <p className={styles.eyebrow}>Browser extension</p>
                    <h2 className={styles.title}>See the water while you type</h2>
                    <p className={styles.lead}>
                        The HydroPrompt extension adds a small widget to ChatGPT. It estimates each prompt as you write it and
                        suggests a leaner version. Your prompt text is never stored or sent anywhere; only its length and the
                        estimate are kept.
                    </p>
                    <div className={styles.modes}>
                        <div className={styles.mode}>
                            <h3 className={styles.modeTitle}>As a guest</h3>
                            <p className={styles.modeBody}>No account needed. Your estimates are saved on this device only.</p>
                        </div>
                        <div className={styles.mode}>
                            <h3 className={styles.modeTitle}>Signed in</h3>
                            <p className={styles.modeBody}>
                                Log in from the extension icon to keep your history and see it on your{" "}
                                <Link href="/dashboard">dashboard</Link>.
                            </p>
                        </div>
                    </div>
                </div>

                <div className={styles.install}>
                    <h3 className={styles.installTitle}>Install it</h3>
                    <p className={styles.note}>It isn&apos;t on the Chrome Web Store yet, so for now you load it yourself:</p>
                    <ol className={styles.steps}>
                        <li>
                            Build it: in the repo&apos;s <code>extension/</code> folder, run <code>npm install</code> and{" "}
                            <code>npm run build</code>.
                        </li>
                        <li>
                            Open <code>chrome://extensions</code> and turn on <strong>Developer mode</strong>.
                        </li>
                        <li>
                            Click <strong>Load unpacked</strong> and choose <code>extension/dist</code>.
                        </li>
                        <li>Open ChatGPT and start typing.</li>
                    </ol>
                </div>
            </div>
        </section>
    );
}
