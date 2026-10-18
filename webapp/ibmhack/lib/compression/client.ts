import { mockCompress } from "./mock";

// The one place that talks to the compression service. Server-side only, so the
// service URL (and any key added later) never reaches the browser.
export async function compress(prompt: string): Promise<string> {
    const baseUrl = process.env.BACKEND_API_URL;
    if (!baseUrl) return mockCompress(prompt);

    const res = await fetch(`${baseUrl.replace(/\/$/, "")}/compress`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, preset: "balanced" }),
        cache: "no-store",
        signal: AbortSignal.timeout(60000),
    });
    if (!res.ok) {
        throw new Error(`Compression service returned ${res.status}`);
    }
    const { compressed } = (await res.json()) as { compressed: string };
    if (typeof compressed !== "string") throw new Error("Compression service returned an invalid response");
    return compressed;
}
