"use client";

import styles from "./SegmentedToggle.module.scss";

type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
    options: Option<T>[];
    value: T;
    onChange: (value: T) => void;
    ariaLabel: string;
};

export default function SegmentedToggle<T extends string>({ options, value, onChange, ariaLabel }: Props<T>) {
    return (
        <div className={styles.toggle} role="radiogroup" aria-label={ariaLabel}>
            {options.map((option) => (
                <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={option.value === value}
                    className={styles.option}
                    onClick={() => onChange(option.value)}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}
