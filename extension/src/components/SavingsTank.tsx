import { useEffect, useRef, useState } from "react";
import { AnimatedNumber } from "./WaterTank";

export function SavingsTank({
  waterMl,
  optimisationsMade,
}: {
  waterMl: number;
  optimisationsMade: number;
}) {
  const [waterAdded, setWaterAdded] = useState(false);
  const previousWater = useRef(0);

  useEffect(() => {
    const increased = waterMl > previousWater.current;
    previousWater.current = waterMl;
    if (!increased) return;
    setWaterAdded(true);
    const timeout = window.setTimeout(() => setWaterAdded(false), 900);
    return () => window.clearTimeout(timeout);
  }, [waterMl]);

  return (
    <div className={`savings-visual ${waterAdded ? "water-added" : ""}`} role="group" aria-label="Estimated optimisation impact">
      <span className="savings-droplet" aria-hidden="true" />
      <div className="savings-vessel" aria-hidden="true">
        <div
          className="savings-water"
          style={{ height: waterMl > 0 ? "55%" : "0%" }}
        >
          <svg className="savings-wave" viewBox="0 0 400 24" preserveAspectRatio="none">
            <path d="M0 12 Q25 0 50 12 T100 12 T150 12 T200 12 T250 12 T300 12 T350 12 T400 12 V24 H0Z" />
          </svg>
        </div>
        <div className="vessel-shine" />
      </div>
      <div className="savings-value">
        <span className="savings-eyebrow">EST. WATER SAVED</span>
        <strong>
          <AnimatedNumber value={waterMl} />
          <small> mL</small>
        </strong>
      </div>
      <div className="savings-optimisations">
        <span>OPTIMISATIONS MADE</span>
        <strong>{optimisationsMade.toLocaleString("en-GB")}</strong>
      </div>
    </div>
  );
}
