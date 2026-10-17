import { useEffect, useState } from "react";
export const format = (n: number) =>
  n.toLocaleString("en-GB", { maximumFractionDigits: 2 });
export function AnimatedNumber({ value }: { value: number }) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const from = shown;
    function tick(now: number) {
      const t = Math.min(1, (now - start) / 650);
      setShown(from + (value - from) * (1 - (1 - t) ** 3));
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return <>{format(shown)}</>;
}
export function WaterTank({
  original,
  optimized,
}: {
  original: number;
  optimized: number;
}) {
  const max = Math.max(original, optimized, 0.01);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setFilled(true);
      return;
    }
    // Give the empty vessel a paint before its first spring-like fill.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setFilled(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, []);
  return (
    <div
      className="water-comparison"
      role="img"
      aria-label={`Illustrative water estimate: original ${format(original)} millilitres, optimised ${format(optimized)} millilitres.`}
    >
      {[
        { label: "Original", value: original },
        { label: "Optimised", value: optimized },
      ].map(({ label, value }, i) => (
        <div className="tank-column" key={label}>
          <div className={"tank " + (i ? "tank-green" : "")}>
            <div className="tank-ticks" />
            <div
              className="water"
              style={{ height: `${filled ? (value / max) * 76 : 0}%` }}
            >
              <svg
                className="wave"
                viewBox="0 0 400 24"
                preserveAspectRatio="none"
              >
                <path d="M0 12 Q25 0 50 12 T100 12 T150 12 T200 12 T250 12 T300 12 T350 12 T400 12 V24 H0Z" />
              </svg>
              <span className="bubble" />
              <span className="bubble second" />
            </div>
            <span className="tank-glint" />
          </div>
          <strong>
            <AnimatedNumber value={value} />
            <small> mL</small>
          </strong>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );
}
