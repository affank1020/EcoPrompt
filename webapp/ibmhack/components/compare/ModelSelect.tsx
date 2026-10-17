"use client";

import type { Model } from "../../lib/types";
import styles from "./ModelSelect.module.scss";

type Props = {
    models: Model[];
    selected: string[];
    onChange: (selected: string[]) => void;
    // Single mode behaves like radio buttons (used by bulk checking)
    multiple?: boolean;
    max?: number;
    label?: string;
};

export default function ModelSelect({ models, selected, onChange, multiple = true, max, label = "Models" }: Props) {
    const toggle = (id: string) => {
        if (!multiple) return onChange([id]);
        if (selected.includes(id)) return onChange(selected.filter((s) => s !== id));
        if (max && selected.length >= max) return;
        onChange([...selected, id]);
    };

    return (
        <fieldset className={styles.select}>
            <legend className={styles.legend}>
                {label}
                {multiple ? <span className={styles.count}>{selected.length} selected</span> : null}
            </legend>
            <div className={styles.chips}>
                {models.map((model) => {
                    const checked = selected.includes(model.id);
                    return (
                        <label key={model.id} className={`${styles.chip} ${checked ? styles.checked : ""}`}>
                            <input
                                type={multiple ? "checkbox" : "radio"}
                                name="model"
                                className={styles.input}
                                checked={checked}
                                onChange={() => toggle(model.id)}
                            />
                            <span className={`${styles.dot} ${styles[model.size]}`} aria-hidden="true" />
                            <span className={styles.name}>{model.name}</span>
                            <span className={styles.provider}>{model.provider}</span>
                        </label>
                    );
                })}
            </div>
            <div className={styles.key} aria-hidden="true">
                <span><span className={`${styles.dot} ${styles.small}`} /> Small</span>
                <span><span className={`${styles.dot} ${styles.medium}`} /> Medium</span>
                <span><span className={`${styles.dot} ${styles.large}`} /> Large</span>
            </div>
        </fieldset>
    );
}
