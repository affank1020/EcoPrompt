"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { getModel } from "../../lib/estimation/models";
import { historyHref, type HistoryParams } from "./params";
import styles from "./HistoryFilters.module.scss";

type Props = {
    params: HistoryParams;
    sites: string[];
    models: string[];
};

export default function HistoryFilters({ params, sites, models }: Props) {
    const router = useRouter();
    const [pending, startTransition] = useTransition();

    // Changing a filter goes back to page 1
    const update = (patch: Partial<HistoryParams>) =>
        startTransition(() => router.push(historyHref(params, { ...patch, page: 1 }), { scroll: false }));

    return (
        <div className={styles.filters} data-pending={pending || undefined}>
            <label className={styles.field}>
                <span>Site</span>
                <select value={params.site ?? ""} onChange={(e) => update({ site: e.target.value || undefined })}>
                    <option value="">All sites</option>
                    {sites.map((site) => (
                        <option key={site} value={site}>{site}</option>
                    ))}
                </select>
            </label>
            <label className={styles.field}>
                <span>Model</span>
                <select value={params.model ?? ""} onChange={(e) => update({ model: e.target.value || undefined })}>
                    <option value="">All models</option>
                    {models.map((model) => (
                        <option key={model} value={model}>{getModel(model)?.name ?? model}</option>
                    ))}
                </select>
            </label>
            {params.site || params.model ? (
                <Link href={historyHref(params, { site: undefined, model: undefined, page: 1 })} className={styles.clear} scroll={false}>
                    Clear filters
                </Link>
            ) : null}
        </div>
    );
}
