// Every source the methodology cites. Edit this file to add or update a citation;
// methodology.ts refers to these by id.

export type Source = {
    id: string;
    title: string;
    publisher: string;
    year: number;
    url: string;
    usedFor: string;
};

export const SOURCES: Source[] = [
    {
        id: "wildchat-tagged",
        title: "WildChat-1M (tagged)",
        publisher: "sh0416 (Hugging Face)",
        year: 2024,
        url: "https://huggingface.co/datasets/sh0416/wildchat-1m-tagged",
        usedFor: "Real chatbot prompts with difficulty scores, used to train our complexity classifier",
    },
    {
        id: "brick-complexity",
        title: "brick-complexity-extractor",
        publisher: "regolo (Hugging Face)",
        year: 2026,
        url: "https://huggingface.co/regolo/brick-complexity-extractor",
        usedFor: "Fine-tuned Qwen model that rates prompt complexity, blended with our classifier",
    },
    {
        id: "li-2023",
        title: "Making AI Less \"Thirsty\": Uncovering and Addressing the Secret Water Footprint of AI Models",
        publisher: "Li, Yang, Islam & Ren (arXiv)",
        year: 2023,
        url: "https://arxiv.org/abs/2304.03271",
        usedFor: "How AI's on-site cooling and off-site electricity water footprint is accounted for",
    },
    {
        id: "lbnl-2024",
        title: "2024 United States Data Center Energy Usage Report",
        publisher: "Lawrence Berkeley National Laboratory",
        year: 2024,
        url: "https://eta.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report",
        usedFor: "Data centre energy use, water usage effectiveness (WUE) and power usage effectiveness (PUE)",
    },
    {
        id: "google-2025",
        title: "Measuring the environmental impact of delivering AI at Google Scale",
        publisher: "Google (arXiv)",
        year: 2025,
        url: "https://arxiv.org/abs/2508.15734",
        usedFor: "Measured energy and water per median text prompt",
    },
    {
        id: "epoch-2025",
        title: "How much energy does ChatGPT use?",
        publisher: "Epoch AI",
        year: 2025,
        url: "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use",
        usedFor: "Energy per query estimates for frontier models",
    },
    {
        id: "uptime-2024",
        title: "Global Data Center Survey 2024",
        publisher: "Uptime Institute",
        year: 2024,
        url: "https://uptimeinstitute.com/resources/research-and-reports/uptime-institute-global-data-center-survey-results-2024",
        usedFor: "Industry PUE figures",
    },
];

export function getSource(id: string): Source | undefined {
    return SOURCES.find((s) => s.id === id);
}
