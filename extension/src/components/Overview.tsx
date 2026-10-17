import { useDispatch, useSelector } from "react-redux";
import {
  selectTotals,
  setView,
  type AppDispatch,
  type RootState,
} from "../store";
import { SavingsTank } from "./SavingsTank";

export function Overview() {
  const dispatch = useDispatch<AppDispatch>();
  const { prompt, source } = useSelector((s: RootState) => s.eco);
  const totals = useSelector(selectTotals);
  const hasActiveDraft = Boolean(source?.draft.trim() && prompt.trim());

  return (
    <div className="overview-compact">
      <h1>Your impact</h1>
      <SavingsTank waterMl={totals.potentialWaterMl} optimisationsMade={totals.optimisationsMade} />
      {hasActiveDraft && (
        <button
          className="assistant-shortcut"
          onClick={() => dispatch(setView("assistant"))}
        >
          <span className="shortcut-icon">✦</span>
          <span>Review current prompt</span>
          <span className="shortcut-arrow">→</span>
        </button>
      )}
    </div>
  );
}
