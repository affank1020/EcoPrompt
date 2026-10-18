// Stand-in for the compression service, used only while BACKEND_API_URL is unset.
// It strips common filler so the UI has something realistic to show.

const FILLER: RegExp[] = [
    /\b(hi|hello|hey)\b( there)?[,!.]?\s*/gi,
    /\b(could|can|would) you (please )?/gi,
    /\bi was wondering if (you could )?/gi,
    /\bi would like you to /gi,
    /\bi want you to /gi,
    /\bplease\b,?\s*/gi,
    /\bkindly\b\s*/gi,
    /\b(thanks|thank you)( so much| very much)?( in advance)?[.!]?\s*/gi,
    /\b(really|very|just|basically|actually|quite)\s+/gi,
];

const REPLACEMENTS: [RegExp, string][] = [
    [/\bin order to\b/gi, "to"],
    [/\bdue to the fact that\b/gi, "because"],
    [/\bat this point in time\b/gi, "now"],
];

// A request phrased as a question ("Could you…?") becomes an instruction once trimmed
const QUESTION_OPENERS = /\b(could|can|would) you\b|\bi was wondering if\b/i;

export function mockCompress(prompt: string): string {
    const wasRequest = QUESTION_OPENERS.test(prompt);
    let out = prompt;
    for (const [pattern, replacement] of REPLACEMENTS) out = out.replace(pattern, replacement);
    for (const pattern of FILLER) out = out.replace(pattern, "");
    out = out
        .replace(/[ \t]+/g, " ")
        .replace(/\n{3,}/g, "\n\n")
        .replace(/ +([,.!?])/g, "$1")
        .replace(/[,;]+([.!?])/g, "$1")
        .replace(/[,;]\s*$/, "")
        .trim();
    if (wasRequest) out = out.replace(/\?/g, ".");
    // Restore capitals where the filler removed the start of a sentence
    return out.replace(/(^|[.!?]\s+)([a-z])/g, (_, before: string, letter: string) => before + letter.toUpperCase());
}
