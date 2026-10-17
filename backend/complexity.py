"""Download, train, evaluate, and use the WildChat complexity baseline."""
from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from importlib.metadata import version
from numbers import Integral
from pathlib import Path
import hashlib
import json
import os
import unicodedata
import tempfile

os.environ.setdefault("HF_HOME", str(Path(__file__).resolve().parent / "data" / "hf_home"))

import joblib
import numpy as np
import pandas as pd
from datasets import load_dataset
from huggingface_hub import HfApi, snapshot_download
from sklearn.feature_extraction.text import HashingVectorizer
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from scipy import sparse

DATASET = "sh0416/wildchat-1m-tagged"
CLASSES = np.array(["easy", "medium", "hard"])
RANGES = {"easy": "1-3", "medium": "4-7", "hard": "8-10"}
SEED = 42
BATCH_SIZE = 512


def score_to_label(score):
    if isinstance(score, bool) or not isinstance(score, Integral) or not 1 <= score <= 10:
        return None
    return "easy" if score <= 3 else "medium" if score <= 7 else "hard"


def normalize_prompt(text):
    return " ".join(unicodedata.normalize("NFKC", text).casefold().split())


def first_user_prompt(conversation):
    if not isinstance(conversation, (list, tuple)):
        return None
    for message in conversation:
        if isinstance(message, dict) and message.get("role") == "user":
            text = message.get("content")
            if isinstance(text, str) and text.strip():
                return text.strip()
    return None


def clean_rows(rows):
    """Deduplicate across the entire dataset, excluding every conflicting group."""
    counts = Counter()
    unique, conflicts = {}, set()
    for row in rows:
        counts["source_rows"] += 1
        label = score_to_label(row.get("complexity"))
        if label is None:
            counts["invalid_score_rows"] += 1
            continue
        prompt = first_user_prompt(row.get("conversation"))
        if prompt is None:
            counts["missing_prompt_rows"] += 1
            continue
        key = hashlib.sha256(normalize_prompt(prompt).encode("utf-8")).hexdigest()
        if key in conflicts:
            counts["conflicting_rows"] += 1
        elif key in unique:
            previous = unique[key]
            if previous["label"] != label:
                counts["conflicting_rows"] += previous["copies"] + 1
                counts["duplicate_rows_removed"] -= previous["copies"] - 1
                del unique[key]
                conflicts.add(key)
            else:
                previous["copies"] += 1
                counts["duplicate_rows_removed"] += 1
        else:
            unique[key] = {"prompt": prompt, "label": label,
                           "language": row.get("language") or "Unknown", "copies": 1}
        if counts["source_rows"] % 100000 == 0:
            print(f"Cleaned {counts['source_rows']:,} source rows", flush=True)
    frame = pd.DataFrame((dict(prompt_hash=key, **value) for key, value in unique.items()))
    if frame.empty:
        raise ValueError("No valid prompts with complexity scores 1-10 were found.")
    frame = frame.drop(columns="copies")
    counts["conflicting_prompt_groups"] = len(conflicts)
    counts["retained_rows"] = len(frame)
    return frame, dict(counts)


def prepare_data(root=Path(".")):
    root = Path(root)
    data_dir = root / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    manifest_path = data_dir / "dataset_manifest.json"
    if manifest_path.exists():
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
        if manifest["dataset"] != DATASET:
            raise ValueError("Cached dataset identity does not match.")
        if manifest.get("preprocessing_version") == 1 and (data_dir / "prompts.parquet").exists():
            print("Loading previously cleaned prompts from the pinned dataset.", flush=True)
            return pd.read_parquet(data_dir / "prompts.parquet"), manifest
    else:
        manifest = {"dataset": DATASET, "revision": HfApi().dataset_info(DATASET).sha,
                    "license": "odc-by", "source": f"https://huggingface.co/datasets/{DATASET}"}
        manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(f"Downloading/loading full dataset at revision {manifest['revision']}", flush=True)
    snapshot_download(DATASET, repo_type="dataset", revision=manifest["revision"],
                      allow_patterns=["README.md", "data/*.parquet"], max_workers=4)
    dataset = load_dataset(DATASET, revision=manifest["revision"],
                           cache_dir=str(data_dir / "hf_cache"), split="train")
    print(f"Downloaded {len(dataset):,} source rows. Cleaning prompts...", flush=True)
    # Read only fields used by the model. The full source remains in the local cache.
    frame, counts = clean_rows(dataset.select_columns(["conversation", "complexity", "language"]))
    frame.to_parquet(data_dir / "prompts.parquet", index=False)
    manifest["cleaning"] = counts
    manifest["preprocessing_version"] = 1
    manifest["class_counts"] = {k: int(v) for k, v in frame.label.value_counts().items()}
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")
    print(json.dumps(counts, indent=2), flush=True)
    return frame, manifest


def split_data(frame):
    if set(frame.label.unique()) != set(CLASSES) or frame.label.value_counts().min() < 20:
        raise ValueError("Need all three classes with at least 20 unique prompts per class.")
    if frame.prompt_hash.duplicated().any():
        raise ValueError("Deduplicate prompts before splitting.")
    train, remainder = train_test_split(frame, test_size=0.2, stratify=frame.label, random_state=SEED)
    validation, test = train_test_split(remainder, test_size=0.5, stratify=remainder.label,
                                      random_state=SEED)
    splits = [part.reset_index(drop=True) for part in (train, validation, test)]
    hashes = [set(part.prompt_hash) for part in splits]
    assert not (hashes[0] & hashes[1] or hashes[0] & hashes[2] or hashes[1] & hashes[2])
    return tuple(splits)


def predict_batches(model, texts, batch_size=BATCH_SIZE):
    texts = list(texts)
    if not texts:
        return np.array([], dtype=str)
    return np.concatenate([model.predict(texts[start:start + batch_size])
                           for start in range(0, len(texts), batch_size)])


def train_model(train, validation, epochs=5, cache_dir=None):
    if cache_dir is None:
        with tempfile.TemporaryDirectory() as temporary:
            return train_model(train, validation, epochs, Path(temporary))
    vectorizer = HashingVectorizer(analyzer="char", ngram_range=(3, 5),
                                  n_features=2**18, alternate_sign=False,
                                  lowercase=True, norm="l2", dtype=np.float32)
    counts = train.label.value_counts()
    weights = {label: len(train) / (len(CLASSES) * int(counts[label])) for label in CLASSES}
    candidates = {alpha: SGDClassifier(loss="log_loss", alpha=alpha,
                                       class_weight=weights, random_state=SEED,
                                       average=True) for alpha in (1e-5, 1e-4, 1e-3)}
    rng = np.random.default_rng(SEED)
    initial_order = rng.permutation(len(train))
    identity = hashlib.sha256(pd.util.hash_pandas_object(
        train[["prompt", "label"]], index=False).to_numpy().tobytes())
    identity.update(f"char-3-5-262144-float32-{SEED}-{BATCH_SIZE}-{version('scikit-learn')}".encode())
    feature_dir = Path(cache_dir) / identity.hexdigest()
    feature_dir.mkdir(parents=True, exist_ok=True)
    batch_count = (len(train) + BATCH_SIZE - 1) // BATCH_SIZE
    for epoch in range(epochs):
        seen = 0
        for batch_number in rng.permutation(batch_count):
            start = int(batch_number) * BATCH_SIZE
            batch = train.iloc[initial_order[start:start + BATCH_SIZE]]
            feature_path = feature_dir / f"batch-{batch_number:05d}.npz"
            if feature_path.exists():
                features = sparse.load_npz(feature_path)
            else:
                features = vectorizer.transform(batch.prompt)
                temporary_path = feature_path.with_suffix(".tmp.npz")
                sparse.save_npz(temporary_path, features, compressed=False)
                temporary_path.replace(feature_path)
            row_order = rng.permutation(len(batch))
            features = features[row_order]
            labels = batch.label.to_numpy()[row_order]
            for classifier in candidates.values():
                classifier.partial_fit(features, labels, classes=CLASSES)
            seen += len(batch)
            if seen // BATCH_SIZE % 100 == 0:
                print(f"Epoch {epoch + 1}/{epochs}: {seen:,}/{len(train):,} prompts", flush=True)
        print(f"Finished training epoch {epoch + 1}/{epochs}", flush=True)
    results, best_model, best_score = [], None, -1.0
    for alpha, classifier in candidates.items():
        model = Pipeline([("features", vectorizer), ("classifier", classifier)])
        predictions = predict_batches(model, validation.prompt)
        score = f1_score(validation.label, predictions, labels=CLASSES, average="macro", zero_division=0)
        results.append({"alpha": alpha, "validation_macro_f1": float(score)})
        if score > best_score:
            best_model, best_score = model, score
    return best_model, results


def evaluate(model, train, test):
    predicted = predict_batches(model, test.prompt)
    majority = train.label.value_counts().idxmax()
    baseline = np.repeat(majority, len(test))
    metrics = {
        "accuracy": float(accuracy_score(test.label, predicted)),
        "macro_f1": float(f1_score(test.label, predicted, labels=CLASSES, average="macro", zero_division=0)),
        "classification_report": classification_report(test.label, predicted, labels=CLASSES,
                                                       output_dict=True, zero_division=0),
        "confusion_matrix": confusion_matrix(test.label, predicted, labels=CLASSES).tolist(),
        "confusion_matrix_labels": CLASSES.tolist(),
        "majority_baseline": {"label": str(majority),
                              "accuracy": float(accuracy_score(test.label, baseline)),
                              "macro_f1": float(f1_score(test.label, baseline, labels=CLASSES,
                                                         average="macro", zero_division=0))},
        "by_language": {},
    }
    for language, indices in test.groupby("language").indices.items():
        if len(indices) >= 100:
            actual, guess = test.iloc[indices].label, predicted[indices]
            metrics["by_language"][str(language)] = {
                "count": len(indices), "accuracy": float(accuracy_score(actual, guess)),
                "macro_f1": float(f1_score(actual, guess, labels=CLASSES, average="macro", zero_division=0))}
    return metrics


def save_model(model, metadata, root=Path(".")):
    artifacts = Path(root) / "artifacts"
    artifacts.mkdir(parents=True, exist_ok=True)
    path = artifacts / "complexity_model.joblib"
    joblib.dump(model, path, compress=3)
    metadata = {**metadata, "created_at": datetime.now(timezone.utc).isoformat(),
                "seed": SEED, "score_ranges": RANGES,
                "versions": {p: version(p) for p in ("scikit-learn", "numpy", "datasets", "joblib")}}
    (artifacts / "metrics.json").write_text(json.dumps(metadata, indent=2), encoding="utf-8")
    return path


def classify_prompt(text, model=None, model_path=Path("artifacts/complexity_model.joblib")):
    if not isinstance(text, str) or not text.strip():
        raise ValueError("Enter a nonempty text prompt.")
    if model is None:
        # Load only artifacts you trust: joblib uses Python's pickle format.
        model = joblib.load(model_path)
    probabilities = model.predict_proba([text.strip()])[0]
    winner = int(np.argmax(probabilities))
    label = str(model.named_steps["classifier"].classes_[winner])
    return {"label": label, "score_range": RANGES[label],
            "confidence": float(probabilities[winner])}
