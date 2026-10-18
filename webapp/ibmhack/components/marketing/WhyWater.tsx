import styles from "./WhyWater.module.scss";

const POINTS = [
    {
        title: "Cooling",
        body: "Some data centres use evaporative cooling, which consumes water from local supplies.",
    },
    {
        title: "Electricity",
        body: "Electricity generation can also consume water. The amount depends on the energy source and cooling system.",
    },
    {
        title: "Location",
        body: "Many data centres sit in regions that are already short of water, so the same litre matters more there.",
    },
];

export default function WhyWater({ afterHero = false }: { afterHero?: boolean }) {
    return (
        <section id="why-water" className={`${styles.section}${afterHero ? ` ${styles.afterHero}` : ""}`}>
            <div className={styles.inner}>
                <p className={styles.eyebrow}>Why water</p>
                <h2 className={styles.title}>The cost of a prompt you never see</h2>
                <p className={styles.lead}>
                    We hear a lot about the energy AI uses, but much less about its water. Each prompt is small, but billions of
                    them a day add up, and none of it shows on your screen.
                </p>
                <div className={styles.points}>
                    {POINTS.map((p) => (
                        <div key={p.title} className={styles.point}>
                            <h3 className={styles.pointTitle}>{p.title}</h3>
                            <p className={styles.pointBody}>{p.body}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
