"use client";

import { useRef, useState } from "react";
import SegmentedToggle from "../ui/SegmentedToggle";
import { promptsFromCsv, splitPrompts, type SplitMode } from "./parsePrompts";
import styles from "./BulkInput.module.scss";

export type BulkInputState = {
    source: "paste" | "upload";
    text: string;
    split: SplitMode;
    delimiter: string;
    file: { name: string; text: string } | null;
};

export const INITIAL_BULK_INPUT: BulkInputState = {
    source: "paste",
    text: "",
    split: "blank-line",
    delimiter: "---",
    file: null,
};

const MAX_FILE_BYTES = 1024 * 1024;

export function promptsFromInput(state: BulkInputState): string[] {
    if (state.source === "paste") return splitPrompts(state.text, state.split, state.delimiter);
    if (!state.file) return [];
    if (state.file.name.toLowerCase().endsWith(".csv")) return promptsFromCsv(state.file.text);
    return splitPrompts(state.file.text, state.split, state.delimiter);
}

const SPLIT_OPTIONS: { value: SplitMode; label: string }[] = [
    { value: "blank-line", label: "Blank line" },
    { value: "delimiter", label: "Delimiter" },
    { value: "line", label: "Each line" },
];

const PLACEHOLDER = `Summarise this report in five bullet points.

Write a short thank-you note to my team.

Translate "where is the train station" into Spanish.`;

type Props = {
    state: BulkInputState;
    onChange: (state: BulkInputState) => void;
};

export default function BulkInput({ state, onChange }: Props) {
    const fileInput = useRef<HTMLInputElement>(null);
    const [fileError, setFileError] = useState<string | null>(null);
    const set = (patch: Partial<BulkInputState>) => onChange({ ...state, ...patch });
    const isCsv = state.file?.name.toLowerCase().endsWith(".csv");

    const readFile = async (file: File | undefined) => {
        setFileError(null);
        if (!file) return;
        if (!/\.(txt|csv)$/i.test(file.name)) return setFileError("Upload a .txt or .csv file.");
        if (file.size > MAX_FILE_BYTES) return setFileError("Files are limited to 1 MB.");
        set({ file: { name: file.name, text: await file.text() } });
    };

    return (
        <div className={styles.input}>
            <div className={styles.row}>
                <SegmentedToggle
                    options={[{ value: "paste", label: "Paste text" }, { value: "upload", label: "Upload file" }]}
                    value={state.source}
                    onChange={(source) => set({ source })}
                    ariaLabel="Input method"
                />
                {state.source === "paste" || (state.file && !isCsv) ? (
                    <div className={styles.split}>
                        <span className={styles.splitLabel}>Split prompts on</span>
                        <SegmentedToggle options={SPLIT_OPTIONS} value={state.split} onChange={(split) => set({ split })} ariaLabel="Split prompts on" />
                        {state.split === "delimiter" ? (
                            <input
                                className={styles.delimiter}
                                value={state.delimiter}
                                onChange={(e) => set({ delimiter: e.target.value })}
                                aria-label="Delimiter"
                            />
                        ) : null}
                    </div>
                ) : null}
            </div>

            {state.source === "paste" ? (
                <textarea
                    className={styles.textarea}
                    value={state.text}
                    onChange={(e) => set({ text: e.target.value })}
                    placeholder={PLACEHOLDER}
                    rows={10}
                    aria-label="Prompts"
                />
            ) : (
                <div
                    className={styles.drop}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                        e.preventDefault();
                        readFile(e.dataTransfer.files[0]);
                    }}
                >
                    <input
                        ref={fileInput}
                        type="file"
                        accept=".txt,.csv,text/plain,text/csv"
                        className={styles.fileInput}
                        onChange={(e) => readFile(e.target.files?.[0])}
                    />
                    {state.file ? (
                        <p>
                            <strong>{state.file.name}</strong>
                            {isCsv ? " · using the \"prompt\" column, or the first column if there isn't one" : null}
                        </p>
                    ) : (
                        <p>Drop a .txt or .csv file here</p>
                    )}
                    <button type="button" className={styles.browse} onClick={() => fileInput.current?.click()}>
                        {state.file ? "Choose another file" : "Browse files"}
                    </button>
                    {fileError ? <p className={styles.error} role="alert">{fileError}</p> : null}
                </div>
            )}
        </div>
    );
}
