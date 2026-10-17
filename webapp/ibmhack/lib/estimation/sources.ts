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
        id: "li-2023",
        title: "Making AI Less \"Thirsty\": Uncovering and Addressing the Secret Water Footprint of AI Models",
        publisher: "Li, Yang, Islam & Ren (arXiv)",
        year: 2023,
        url: "https://arxiv.org/abs/2304.03271",
        usedFor: "The on-site plus off-site water accounting, and electricity water intensity",
    },
    {
        id: "lbnl-2024",
        title: "2024 United States Data Center Energy Usage Report",
        publisher: "Lawrence Berkeley National Laboratory",
        year: 2024,
        url: "https://eta.lbl.gov/publications/2024-lbnl-data-center-energy-usage-report",
        usedFor: "Data centre water usage effectiveness (WUE) and power usage effectiveness (PUE)",
    },
    {
        id: "google-2025",
        title: "Measuring the environmental impact of delivering AI at Google Scale",
        publisher: "Google (arXiv)",
        year: 2025,
        url: "https://arxiv.org/abs/2508.15734",
        usedFor: "Energy and water per median text prompt, used to sanity-check small models",
    },
    {
        id: "epoch-2025",
        title: "How much energy does ChatGPT use?",
        publisher: "Epoch AI",
        year: 2025,
        url: "https://epoch.ai/gradient-updates/how-much-energy-does-chatgpt-use",
        usedFor: "Energy per query for large frontier models",
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
