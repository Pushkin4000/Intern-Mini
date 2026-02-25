from __future__ import annotations

import json
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from agent.api import app
from agent.graph import astream_workflow


def _parse_sse_events(body: str) -> list[dict[str, object]]:
    events: list[dict[str, object]] = []
    current: dict[str, object] = {}

    for line in body.splitlines():
        if line.startswith("event: "):
            if current:
                events.append(current)
                current = {}
            current["event"] = line[len("event: ") :]
            continue

        if line.startswith("data: "):
            current["data"] = json.loads(line[len("data: ") :])
            continue

        if not line.strip() and current:
            events.append(current)
            current = {}

    if current:
        events.append(current)

    return events


class GraphAstreamWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_stream_uses_astream_verbose_modes(self) -> None:
        class FakeCompiledGraph:
            def __init__(self) -> None:
                self.calls: list[tuple[tuple[object, ...], dict[str, object]]] = []

            async def astream(self, *args, **kwargs):
                self.calls.append((args, kwargs))
                if False:
                    yield None

        fake_app = FakeCompiledGraph()

        with patch("agent.graph.build_agent", return_value=fake_app):
            results = [
                item
                async for item in astream_workflow(
                    "Build app",
                    llm=object(),
                    recursion_limit=77,
                    mutable_prompt="legacy",
                    prompt_overrides={"planner": "override"},
                )
            ]

        self.assertEqual(results, [])
        self.assertEqual(len(fake_app.calls), 1)

        call_args, call_kwargs = fake_app.calls[0]
        self.assertEqual(call_kwargs.get("stream_mode"), ["debug", "messages", "updates"])
        self.assertIs(call_kwargs.get("debug"), True)
        self.assertIs(call_kwargs.get("subgraphs"), True)

        self.assertEqual(call_args[0]["user_prompt"], "Build app")
        self.assertEqual(call_args[0]["mutable_prompt"], "legacy")
        self.assertEqual(call_args[0]["prompt_overrides"], {"planner": "override"})
        self.assertEqual(call_args[1], {"recursion_limit": 77})


class StreamEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(app)
        self.payload = {"user_prompt": "Build a todo app", "api_key": "test-key"}

    def test_stream_emits_run_started_and_run_complete(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            if False:
                yield None

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        self.assertEqual(response.status_code, 200)
        events = _parse_sse_events(response.text)
        self.assertEqual(events[0]["event"], "run_started")
        self.assertEqual(events[-1]["event"], "run_complete")
        self.assertIn("event_id", events[0]["data"])
        self.assertIn("timestamp", events[0]["data"])
        self.assertIn("severity", events[0]["data"])
        self.assertIn("message", events[0]["data"])
        self.assertIn("node_states", events[0]["data"])
        self.assertIn("activity_by_node_id", events[0]["data"])
        self.assertEqual(events[0]["data"]["message"], "Workflow run started with verbose stream modes: debug/messages/updates.")
        self.assertEqual(events[-1]["data"]["message"], "Workflow finished successfully.")

    def test_stream_emits_on_chat_model_stream(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            yield ("messages", ("hello", {"provider": "groq"}))

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        self.assertEqual(response.status_code, 200)
        events = _parse_sse_events(response.text)
        message_event = next(event for event in events if event["event"] == "on_chat_model_stream")
        data = message_event["data"]
        self.assertEqual(data["token"], "hello")
        self.assertEqual(data["metadata"]["provider"], "groq")
        self.assertEqual(data["phase"], "llm")
        self.assertEqual(data["severity"], "debug")
        self.assertEqual(data["message"], "Streaming model output token.")
        self.assertIn("raw", data)

    def test_stream_emits_on_node_end_from_updates(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            yield (("parent:task",), "updates", {"planner": {"ok": True}, "architect": {"ok": True}})

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        self.assertEqual(response.status_code, 200)
        events = _parse_sse_events(response.text)
        node_end_events = [event for event in events if event["event"] == "on_node_end"]
        self.assertEqual(len(node_end_events), 2)
        self.assertEqual(
            {event["data"]["node"] for event in node_end_events},
            {"planner", "architect"},
        )
        self.assertTrue(all(event["data"]["state"] == "completed" for event in node_end_events))
        self.assertTrue(all(event["data"]["activity_score"] == 0.2 for event in node_end_events))
        self.assertTrue(all("raw" in event["data"] for event in node_end_events))

    def test_stream_emits_on_node_start_from_debug(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            yield ("debug", {"node": "planner", "message": "first"})
            yield ("debug", {"node": "planner", "message": "second"})

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        self.assertEqual(response.status_code, 200)
        events = _parse_sse_events(response.text)
        node_start_events = [event for event in events if event["event"] == "on_node_start"]
        debug_events = [event for event in events if event["event"] == "on_debug_event"]
        self.assertEqual(len(node_start_events), 1)
        self.assertEqual(node_start_events[0]["data"]["node"], "planner")
        self.assertEqual(node_start_events[0]["data"]["state"], "active")
        self.assertEqual(node_start_events[0]["data"]["activity_score"], 1.0)
        self.assertEqual(node_start_events[0]["data"]["message"], "Node 'planner' is now active and thinking.")
        self.assertEqual(len(debug_events), 2)

    def test_stream_emits_error_event_on_exception(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            raise RuntimeError("boom")
            if False:
                yield None

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        self.assertEqual(response.status_code, 200)
        events = _parse_sse_events(response.text)
        self.assertEqual(events[0]["event"], "run_started")
        self.assertEqual(events[-1]["event"], "error")
        self.assertEqual(events[-1]["data"]["state"], "error")
        self.assertEqual(events[-1]["data"]["severity"], "error")
        self.assertEqual(events[-1]["data"]["message"], "Workflow failed during streaming.")

    def test_event_id_is_monotonic(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            yield ("debug", {"node": "planner"})
            yield ("messages", ("x", {"provider": "groq"}))
            yield ("updates", {"planner": {"ok": True}})

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        events = _parse_sse_events(response.text)
        ids = [event["data"]["event_id"] for event in events if "event_id" in event["data"]]
        self.assertEqual(ids, sorted(ids))

    def test_event_has_activity_score_range(self) -> None:
        async def fake_astream(*_args, **_kwargs):
            yield ("debug", {"node": "planner"})
            yield ("updates", {"planner": {"ok": True}})

        with patch("agent.api.build_chat_model", return_value=object()), patch(
            "agent.api.astream_workflow",
            new=fake_astream,
        ):
            response = self.client.post("/stream", json=self.payload)

        events = _parse_sse_events(response.text)
        for event in events:
            value = event["data"].get("activity_score")
            if isinstance(value, (int, float)):
                self.assertGreaterEqual(float(value), 0.0)
                self.assertLessEqual(float(value), 1.0)


if __name__ == "__main__":
    unittest.main()
