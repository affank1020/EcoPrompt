"""Combine the notebook classifier and the fine-tuned language model."""

from functools import lru_cache
from pathlib import Path

import joblib


LABELS = ("easy", "medium", "hard")
MODEL_PATH = Path(__file__).resolve().parent / "artifacts" / "complexity_model.joblib"


@lru_cache(maxsize=1)
def _load_notebook_model():
    if not MODEL_PATH.is_file():
        raise FileNotFoundError(
            f"Saved complexity model not found at {MODEL_PATH}. Run main.ipynb first."
        )
    return joblib.load(MODEL_PATH)


def classify(prompt, epsilon=0.5):
    """Return (label, probabilities) mixing both classifiers.

    epsilon is the weight on the notebook classifier; the language model gets
    1 - epsilon. epsilon=1 uses only the notebook model, epsilon=0 only the LM.
    """
    if not isinstance(prompt, str) or not prompt.strip():
        raise ValueError("Enter a nonempty text prompt.")
    if not 0.0 <= epsilon <= 1.0:
        raise ValueError("epsilon must be between 0 and 1.")

    prompt = prompt.strip()
    notebook_model = _load_notebook_model()
    notebook_scores = notebook_model.predict_proba([prompt])[0]
    notebook_probs = dict(
        zip(notebook_model.named_steps["classifier"].classes_, notebook_scores)
    )

    from train_complexity_model import classify as classify_lm

    _, lm_probs = classify_lm(prompt)
    probabilities = {
        label: epsilon * float(notebook_probs[label])
        + (1 - epsilon) * float(lm_probs[label])
        for label in LABELS
    }
    label = max(LABELS, key=lambda name: probabilities[name])
    return label, probabilities

if __name__ == "__main__":
    import sys

    if len(sys.argv) not in (2, 3):
        print("Usage: python joint_classifier.py <prompt> [epsilon]")
        sys.exit(1)

    prompt = sys.argv[1]
    epsilon = float(sys.argv[2]) if len(sys.argv) == 3 else 0.5
    label, probabilities = classify(prompt, epsilon)
    print(f"Prompt: {prompt}")
    print(f"Predicted label: {label}")
    print("Probabilities:")
    for label in LABELS:
        print(f"  {label}: {probabilities[label]:.4f}")