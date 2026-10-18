import { HIGH_MULTIPLIER, LOW_MULTIPLIER } from "../estimation/methodology";
import { createClient } from "../supabase/server";
import type { EstimateResult } from "../types";

// Shown as the site in history for checks made on the website
const WEBSITE_SITE = "HydroPrompt";

// Saves checks made on the website to the signed-in user's history. Lengths and numbers
// only: the prompt text is never stored. Returns false for signed-out visitors (nothing is
// saved) or if the insert fails, which never fails the check itself.
export async function saveEstimates(prompts: string[], results: EstimateResult[], source: "web" | "bulk"): Promise<boolean> {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims) return false;

    // user_id defaults to auth.uid(), and RLS only allows inserting your own rows
    const rows = results.map((r, i) => ({
        site: WEBSITE_SITE,
        model: null, // the backend estimates without a model
        source,
        prompt_chars: prompts[i].length,
        tokens: Math.round(r.tokens),
        complexity: r.complexity ?? null,
        water_ml: r.waterMl,
        low_ml: r.lowMl,
        high_ml: r.highMl,
        energy_wh: r.energyWh,
        energy_low_wh: r.energyWh * LOW_MULTIPLIER,
        energy_high_wh: r.energyWh * HIGH_MULTIPLIER,
    }));
    const { error } = await supabase.from("estimates").insert(rows);
    if (error) {
        console.error(`Couldn't save ${rows.length} estimate(s): ${error.message}`);
        return false;
    }
    return true;
}
