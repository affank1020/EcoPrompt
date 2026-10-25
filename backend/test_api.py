"""HTTP contract tests without model artifacts, CUDA, or tokenizer downloads."""
import importlib.util
import os
from pathlib import Path
import sys
import types
import unittest
from unittest.mock import Mock, patch

from fastapi.testclient import TestClient


def load_api(env=None):
    classifier = types.ModuleType("joint_classifier")
    classifier.classify = Mock(return_value=("easy", {"easy": 1.0}))
    compressor = types.ModuleType("compressor")
    compressor.Compressor = Mock()
    compressor.Compressor.return_value.compress.return_value = {
        "compressed": "short", "preset": "balanced", "reason": "ok", "latency_ms": 1,
        "tokens_before": 3, "tokens_after": 1,
    }
    spec = importlib.util.spec_from_file_location("tested_api", Path(__file__).with_name("api.py"))
    module = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"joint_classifier": classifier, "compressor": compressor}), patch.dict(os.environ, env or {}, clear=True):
        spec.loader.exec_module(module)
    module.convert_to_tokens = lambda text: list(range(len(text)))
    classifier.classify.reset_mock()
    return module


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.api = load_api()
        self.client = TestClient(self.api.app, raise_server_exceptions=False)

    def test_single_and_bulk_share_contract_and_order(self):
        prompts = ["second", "first", "second"]
        result = self.client.post("/analyse/bulk", json={"prompts": prompts, "epsilon": 0}).json()
        self.assertEqual(result["count"], 3)
        for prompt, row in zip(prompts, result["results"]):
            self.assertEqual(row, self.client.post("/analyse", json={"prompt": prompt, "epsilon": 0}).json())
            self.assertEqual(row["prompt"], prompt)
            self.assertAlmostEqual(row["water_cost"], len(prompt) * 2 * .000429)
            self.assertAlmostEqual(row["energy_cost"], len(prompt) * 2 * .000453)
            self.assertEqual(row["tokens"], len(prompt))

    def test_bulk_boundaries(self):
        self.assertEqual(self.client.post("/analyse/bulk", json={"prompts": ["a"] * 200, "epsilon": 1}).status_code, 200)
        self.assertEqual(self.client.post("/analyse", json={"prompt": "a" * 50000}).status_code, 200)

    def test_invalid_requests_validate_before_inference(self):
        for prompts in [[], ["a"] * 201, ["ok", ""], ["  "], ["a" * 50001], [None], [12], "text"]:
            with self.subTest(prompts=str(prompts)[:40]):
                self.assertEqual(self.client.post("/analyse/bulk", json={"prompts": prompts}).status_code, 422)
        for epsilon in [-.1, 1.1, "NaN", "Infinity", None]:
            for path, payload in [("/analyse", {"prompt": "ok"}), ("/analyse/bulk", {"prompts": ["ok"]})]:
                self.assertEqual(self.client.post(path, json={**payload, "epsilon": epsilon}).status_code, 422)
        for prompt in ["", " \n", "a" * 50001, None, 2]:
            self.assertEqual(self.client.post("/analyse", json={"prompt": prompt}).status_code, 422)
        self.api.classify.assert_not_called()

    def test_inference_failure_returns_no_partial_results(self):
        self.api.classify.side_effect = [ ("easy", {}), RuntimeError("failed") ]
        response = self.client.post("/analyse/bulk", json={"prompts": ["a", "b"]})
        self.assertEqual(response.status_code, 500)
        self.assertNotIn("results", response.text)

    def test_compression_contract(self):
        response = self.client.post("/compress", json={"prompt": "some long text"})
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["compressed"], "short")
        self.api.compressor.compress.assert_called_once_with("some long text", "balanced")
        for payload in [{"prompt": ""}, {"prompt": "x" * 20001}, {"prompt": "ok", "preset": "invalid"}]:
            self.assertEqual(self.client.post("/compress", json=payload).status_code, 422)

    def test_cors_exact_origins_and_production_default(self):
        for env, origin, expected in [({}, "http://localhost:3000", True), ({}, "https://evil.test", False),
            ({"APP_ENV": "production", "API_KEY": "k"}, "http://localhost:3000", False),
            ({"APP_ENV": "production", "API_KEY": "k", "ALLOWED_ORIGINS": "chrome-extension://abc,https://example.test"}, "chrome-extension://abc", True),
            ({"ALLOWED_ORIGINS": "chrome-extension://abc"}, "chrome-extension://other", False)]:
            client = TestClient(load_api(env).app)
            response = client.options("/analyse", headers={"Origin": origin, "Access-Control-Request-Method": "POST"})
            self.assertEqual(response.headers.get("access-control-allow-origin"), origin if expected else None)
        with self.assertRaises(ValueError):
            load_api({"ALLOWED_ORIGINS": "*"})


class ApiKeyTests(unittest.TestCase):
    def setUp(self):
        self.api = load_api({"API_KEY": "secret"})
        self.client = TestClient(self.api.app)
        self.requests = [("/analyse", {"prompt": "ok"}), ("/analyse/bulk", {"prompts": ["ok"]}),
                         ("/compress", {"prompt": "some long text"})]

    def test_missing_or_wrong_key_is_rejected_before_inference(self):
        for headers in [{}, {"X-API-Key": "wrong"}, {"X-API-Key": ""}, {"X-API-Key": "sécret".encode()}]:
            for path, payload in self.requests:
                with self.subTest(path=path, headers=headers):
                    self.assertEqual(self.client.post(path, json=payload, headers=headers).status_code, 401)
        # Unauthenticated callers can't probe validation either
        self.assertEqual(self.client.post("/analyse", json={"prompt": ""}).status_code, 401)
        self.api.classify.assert_not_called()
        self.api.compressor.compress.assert_not_called()

    def test_correct_key_is_accepted(self):
        for path, payload in self.requests:
            with self.subTest(path=path):
                response = self.client.post(path, json=payload, headers={"X-API-Key": "secret"})
                self.assertEqual(response.status_code, 200)

    def test_health_check_stays_open(self):
        self.assertEqual(self.client.get("/").status_code, 200)

    def test_production_requires_a_key(self):
        with self.assertRaises(ValueError):
            load_api({"APP_ENV": "production"})


if __name__ == "__main__":
    unittest.main()
