// The one place that talks to the HydroPrompt backend. Only server actions import this,
// so the URL and API key never reach the browser.

// The first request after the backend starts can be slow while its models load
const DEFAULT_TIMEOUT_MS = 60_000;

export async function backendPost<T>(path: string, body: unknown, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
    if (!process.env.BACKEND_API_URL) {
        console.error("BACKEND_API_URL is not set");
        throw new Error("The estimator isn't set up on this server.");
    }
    const baseUrl = process.env.BACKEND_API_URL.replace(/\/$/, "");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const key = process.env.BACKEND_API_KEY;
    if (key) headers["X-API-Key"] = key;

    let res: Response;
    try {
        res = await fetch(`${baseUrl}${path}`, {
            method: "POST",
            headers,
            body: JSON.stringify(body),
            cache: "no-store",
            signal: AbortSignal.timeout(timeoutMs),
        });
    } catch (err) {
        console.error(`Backend ${path} failed:`, err);
        throw new Error("The estimator isn't responding right now. Try again in a moment.");
    }

    if (!res.ok) {
        // Never log the request body: it contains the prompt
        console.error(`Backend ${path} returned ${res.status}`);
        if (res.status === 401 || res.status === 403) throw new Error("The estimator rejected our API key.");
        if (res.status === 422) throw new Error("The estimator couldn't read this prompt.");
        throw new Error("The estimator is unavailable right now. Try again in a moment.");
    }
    return res.json() as Promise<T>;
}
