from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from agent.api import app
from agent.prompts import MAX_MUTABLE_PROMPT_CHARS


class GenerateValidationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)

    def test_oversized_prompt_override_returns_422(self) -> None:
        oversized = "x" * (MAX_MUTABLE_PROMPT_CHARS + 1)
        payload = {
            "user_prompt": "Build a todo app",
            "api_key": "test-key",
            "prompt_overrides": {"planner": oversized},
        }

        with patch("agent.api.build_chat_model") as mock_build, patch(
            "agent.api.run_workflow"
        ) as mock_run:
            response = self.client.post("/generate", json=payload)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "invalid_request")
        mock_build.assert_not_called()
        mock_run.assert_not_called()

    def test_oversized_legacy_mutable_prompt_returns_422(self) -> None:
        oversized = "x" * (MAX_MUTABLE_PROMPT_CHARS + 1)
        payload = {
            "user_prompt": "Build a todo app",
            "api_key": "test-key",
            "mutable_prompt": oversized,
        }

        with patch("agent.api.build_chat_model") as mock_build, patch(
            "agent.api.run_workflow"
        ) as mock_run:
            response = self.client.post("/generate", json=payload)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "invalid_request")
        mock_build.assert_not_called()
        mock_run.assert_not_called()

    def test_unknown_override_node_returns_422(self) -> None:
        payload = {
            "user_prompt": "Build a todo app",
            "api_key": "test-key",
            "prompt_overrides": {"reviewer": "invalid"},
        }

        with patch("agent.api.build_chat_model") as mock_build, patch(
            "agent.api.run_workflow"
        ) as mock_run:
            response = self.client.post("/generate", json=payload)

        self.assertEqual(response.status_code, 422)
        self.assertEqual(response.json()["error"]["code"], "invalid_request")
        mock_build.assert_not_called()
        mock_run.assert_not_called()

    def test_valid_payload_passes_exact_overrides_to_workflow(self) -> None:
        payload = {
            "user_prompt": "Build a todo app",
            "api_key": "test-key",
            "prompt_overrides": {
                "planner": "planner mutable",
                "architect": "architect mutable",
                "coder": "coder mutable",
            },
            "mutable_prompt": "legacy mutable",
            "recursion_limit": 55,
        }

        with patch("agent.api.build_chat_model") as mock_build, patch(
            "agent.api.run_workflow"
        ) as mock_run:
            mock_build.return_value = object()
            mock_run.return_value = {"status": "DONE", "plan": None, "detailed_ins": None}

            response = self.client.post("/generate", json=payload)

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()["status"], "DONE")
        self.assertTrue(mock_build.called)
        self.assertTrue(mock_run.called)

        run_args = mock_run.call_args.args
        self.assertEqual(run_args[0], payload["user_prompt"])
        self.assertEqual(run_args[2], payload["recursion_limit"])
        self.assertEqual(run_args[3], payload["mutable_prompt"])
        self.assertEqual(run_args[4], payload["prompt_overrides"])


if __name__ == "__main__":
    unittest.main()
