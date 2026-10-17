import sys
import types
import unittest
from unittest.mock import patch

import joint_classifier


class FakeNotebookModel:
    named_steps = {
        "classifier": types.SimpleNamespace(classes_=["hard", "easy", "medium"])
    }

    def predict_proba(self, prompts):
        self.prompts = prompts
        return [[0.7, 0.1, 0.2]]


class JointClassifierTests(unittest.TestCase):
    def setUp(self):
        joint_classifier._load_notebook_model.cache_clear()

    def test_both_models_contribute_equally(self):
        notebook_model = FakeNotebookModel()
        language_model = types.ModuleType("train_complexity_model")
        language_model.classify = lambda prompt: (
            "easy",
            {"easy": 0.8, "medium": 0.1, "hard": 0.1},
        )
        with patch.object(joint_classifier, "_load_notebook_model", return_value=notebook_model):
            with patch.dict(sys.modules, {"train_complexity_model": language_model}):
                label, probabilities = joint_classifier.classify("  test prompt  ")

        self.assertEqual(notebook_model.prompts, ["test prompt"])
        self.assertEqual(label, "easy")
        self.assertAlmostEqual(probabilities["easy"], 0.45)
        self.assertAlmostEqual(probabilities["medium"], 0.15)
        self.assertAlmostEqual(probabilities["hard"], 0.4)

    def test_empty_prompt_is_rejected(self):
        for prompt in ("", "  ", None):
            with self.subTest(prompt=prompt):
                with self.assertRaises(ValueError):
                    joint_classifier.classify(prompt)

    def test_missing_notebook_model_has_clear_error(self):
        with patch.object(joint_classifier, "MODEL_PATH", joint_classifier.MODEL_PATH.with_name("missing.joblib")):
            with self.assertRaisesRegex(FileNotFoundError, "Run main.ipynb first"):
                joint_classifier._load_notebook_model()


if __name__ == "__main__":
    unittest.main()
