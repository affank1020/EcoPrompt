import { createClient } from "../supabase/server";
import { HIGH_MULTIPLIER, LOW_MULTIPLIER } from "../estimation/methodology";
import type { EstimateResult, HistorySaveStatus } from "../types";

// Internal server helper, not a server action: clients cannot supply results or ownership.
// Only metadata is persisted. Website checks are never extension usage or realised savings.
export async function saveEstimates(prompts: string[], results: EstimateResult[], source: "web" | "bulk"): Promise<HistorySaveStatus> {
    try {
        const supabase = await createClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError && authError.name !== "AuthSessionMissingError") return "failed";
        if (!user || user.is_anonymous) return "signed-out";
        if (!results.length || prompts.length !== results.length) return "failed";
        const rows = results.map((r, i) => {
            const backend = r.methodology === "backend-token-v1";
            if ((!backend && r.methodology !== "website-mock-v1") ||
                !Number.isInteger(r.tokens) || r.tokens < 0 || r.energyWh == null ||
                ![r.waterMl, r.lowMl, r.highMl, r.energyWh].every(n => Number.isFinite(n) && n >= 0)) {
                throw new Error("Invalid estimate metadata");
            }
            return {
                user_id: user.id, site: "HydroPrompt", source,
                model: backend ? null : r.model, methodology: r.methodology,
                prompt_chars: prompts[i].length, tokens: r.tokens, complexity: r.complexity ?? null,
                water_ml: r.waterMl, low_ml: r.lowMl, high_ml: r.highMl,
                energy_wh: r.energyWh,
                // The existing schema requires bounds. Equal backend bounds mean no interval supplied.
                // History hides backend water intervals; these are not confidence intervals.
                energy_low_wh: backend ? r.energyWh : r.energyWh * LOW_MULTIPLIER,
                energy_high_wh: backend ? r.energyWh : r.energyWh * HIGH_MULTIPLIER,
                compressed: false, tokens_saved: null,
            };
        });
        const { error } = await supabase.from("estimates").insert(rows);
        return error ? "failed" : "saved";
    } catch {
        // An unavailable/unconfigured history store must not discard a successful check.
        // Do not log Supabase errors: they can include row contents.
        return "failed";
    }
}
