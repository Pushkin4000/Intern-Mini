"""FastAPI application exposing prompt schema and workflow execution endpoints."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from fastapi import FastAPI
from fastapi.concurrency import run_in_threadpool
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import BaseModel, Field

try:  # pragma: no cover - supports script execution
    from .graph import astream_workflow, get_graph_schema, run_workflow
    from .llm_factory import DEFAULT_GROQ_MODEL, PROVIDER_NAME, build_chat_model
    from .prompts import (
        MAX_MUTABLE_PROMPT_CHARS,
        NODE_PROMPT_CONFIGS,
        guarded_prompt_policy,
        prompt_schema,
    )
    from .state import Plan, TaskPlan
except ImportError:  # pragma: no cover
    from graph import astream_workflow, get_graph_schema, run_workflow
    from llm_factory import DEFAULT_GROQ_MODEL, PROVIDER_NAME, build_chat_model
    from prompts import (
        MAX_MUTABLE_PROMPT_CHARS,
        NODE_PROMPT_CONFIGS,
        guarded_prompt_policy,
        prompt_schema,
    )
    from state import Plan, TaskPlan

logger = logging.getLogger(__name__)


class ApiErrorBody(BaseModel):
    code: str
    message: str
    details: object | None = None


class ApiErrorEnvelope(BaseModel):
    error: ApiErrorBody


class RunWorkflowRequest(BaseModel):
    user_prompt: str = Field(..., min_length=1)
    api_key: str = Field(..., min_length=1)
    mutable_prompt: str | None = None
    prompt_overrides: dict[str, str] | None = None
    model: str | None = None
    recursion_limit: int = Field(default=100, ge=1, le=1000)


class RunWorkflowResponse(BaseModel):
    status: str = "DONE"
    provider: str = PROVIDER_NAME
    plan: Plan | None = None
    task_plan: TaskPlan | None = None


NODE_IDS = ("planner", "architect", "coder")
NODE_PHASES: dict[str, str] = {
    "planner": "planning",
    "architect": "architecture",
    "coder": "coding",
}


def _error_response(
    status_code: int,
    code: str,
    message: str,
    details: object | None = None,
) -> JSONResponse:
    payload = ApiErrorEnvelope(error=ApiErrorBody(code=code, message=message, details=details))
    return JSONResponse(status_code=status_code, content=payload.model_dump())


def _format_sse(event_name: str, payload: dict[str, object]) -> str:
    return f"event: {event_name}\ndata: {json.dumps(payload, default=str)}\n\n"


def _iso_utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _extract_token_text(chunk: object) -> str:
    if chunk is None:
        return ""
    if isinstance(chunk, str):
        return chunk

    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts: list[str] = []
        for item in content:
            if isinstance(item, str):
                parts.append(item)
            elif isinstance(item, dict):
                text = item.get("text")
                if text is not None:
                    parts.append(str(text))
                elif item.get("content") is not None:
                    parts.append(str(item.get("content")))
            else:
                parts.append(str(item))
        return "".join(parts)
    if content is not None:
        return str(content)

    text_attr = getattr(chunk, "text", None)
    if text_attr is not None:
        return str(text_attr)
    return str(chunk)


def _parse_langgraph_stream_item(
    item: object,
) -> tuple[tuple[str, ...] | None, str | None, object]:
    if isinstance(item, tuple):
        if len(item) == 3 and isinstance(item[1], str):
            raw_namespace = item[0]
            if raw_namespace is None:
                namespace = None
            elif isinstance(raw_namespace, tuple):
                namespace = tuple(str(part) for part in raw_namespace)
            elif isinstance(raw_namespace, list):
                namespace = tuple(str(part) for part in raw_namespace)
            else:
                namespace = (str(raw_namespace),)
            return namespace, item[1], item[2]

        if len(item) == 2 and isinstance(item[0], str):
            return None, item[0], item[1]

    return None, None, item


def _extract_node_name(payload: object, depth: int = 0) -> str | None:
    if depth > 4:
        return None

    if isinstance(payload, dict):
        for key in ("node", "name", "task_name"):
            value = payload.get(key)
            if isinstance(value, str) and value.strip():
                return value

        for key in ("data", "payload", "metadata", "state", "input", "output"):
            if key in payload:
                found = _extract_node_name(payload[key], depth + 1)
                if found:
                    return found

        for value in payload.values():
            found = _extract_node_name(value, depth + 1)
            if found:
                return found

    if isinstance(payload, (list, tuple)):
        for value in payload:
            found = _extract_node_name(value, depth + 1)
            if found:
                return found

    return None


def _normalize_langgraph_stream_item(
    item: object,
    started_nodes: set[str],
) -> list[tuple[str, dict[str, Any]]]:
    namespace, mode, data = _parse_langgraph_stream_item(item)
    raw = {"namespace": namespace, "mode": mode, "data": data}

    if mode is None:
        return [
            (
                "on_debug_event",
                {
                    "node": None,
                    "state": None,
                    "activity_score": 0.0,
                    "phase": "runtime",
                    "severity": "warn",
                    "kind": "parse_error",
                    "message": "Unknown stream item shape.",
                    "namespace": None,
                    "raw": item,
                },
            )
        ]

    if mode == "messages":
        chunk = data
        metadata = None
        if isinstance(data, tuple) and len(data) == 2:
            chunk, metadata = data
        return [
            (
                "on_chat_model_stream",
                {
                    "node": None,
                    "state": None,
                    "activity_score": 0.0,
                    "phase": "llm",
                    "severity": "debug",
                    "message": "Streaming model output token.",
                    "token": _extract_token_text(chunk),
                    "metadata": metadata,
                    "namespace": namespace,
                    "raw": raw,
                },
            )
        ]

    if mode == "updates":
        if not isinstance(data, dict):
            return [
                (
                    "on_debug_event",
                    {
                        "node": None,
                        "state": None,
                        "activity_score": 0.0,
                        "phase": "runtime",
                        "severity": "warn",
                        "kind": "parse_error",
                        "message": "`updates` mode payload was not a dict.",
                        "namespace": namespace,
                        "raw": raw,
                    },
                )
            ]
        return [
            (
                "on_node_end",
                {
                    "node": str(node_name),
                    "state": "completed",
                    "activity_score": 0.2,
                    "phase": NODE_PHASES.get(str(node_name), "runtime"),
                    "severity": "info",
                    "message": f"Node '{node_name}' completed with update payload.",
                    "update": update,
                    "namespace": namespace,
                    "raw": raw,
                },
            )
            for node_name, update in data.items()
        ]

    if mode == "debug":
        node = _extract_node_name(data)
        events: list[tuple[str, dict[str, Any]]] = []
        if node and node not in started_nodes:
            started_nodes.add(node)
            events.append(
                (
                    "on_node_start",
                    {
                        "node": node,
                        "state": "active",
                        "activity_score": 1.0,
                        "phase": NODE_PHASES.get(node, "runtime"),
                        "severity": "info",
                        "message": f"Node '{node}' is now active and thinking.",
                        "namespace": namespace,
                        "raw": raw,
                    },
                )
            )
        events.append(
            (
                "on_debug_event",
                {
                    "node": node,
                    "state": None,
                    "activity_score": 0.6 if node else 0.0,
                    "phase": NODE_PHASES.get(node, "runtime") if node else "runtime",
                    "severity": "debug",
                    "message": "Debug event observed from LangGraph runtime.",
                    "namespace": namespace,
                    "raw": raw,
                },
            )
        )
        return events

    return [
        (
            "on_debug_event",
            {
                "node": None,
                "state": None,
                "activity_score": 0.0,
                "phase": "runtime",
                "severity": "warn",
                "kind": "unhandled_mode",
                "mode": mode,
                "message": f"Unhandled stream mode '{mode}'.",
                "namespace": namespace,
                "raw": raw,
            },
        )
    ]


def _validate_prompt_payload(payload: RunWorkflowRequest) -> None:
    if not payload.user_prompt.strip():
        raise ValueError("user_prompt must not be empty.")

    overrides = payload.prompt_overrides or {}
    unknown_nodes = sorted(set(overrides.keys()) - set(NODE_PROMPT_CONFIGS.keys()))
    if unknown_nodes:
        raise ValueError(
            "Invalid prompt_overrides keys. "
            f"Allowed keys: {sorted(NODE_PROMPT_CONFIGS.keys())}. "
            f"Received unknown keys: {unknown_nodes}."
        )

    if payload.mutable_prompt is not None and len(payload.mutable_prompt) > MAX_MUTABLE_PROMPT_CHARS:
        raise ValueError(
            f"mutable_prompt exceeds {MAX_MUTABLE_PROMPT_CHARS} characters. "
            f"Current length: {len(payload.mutable_prompt)}"
        )

    for node_id, value in overrides.items():
        if len(value) > MAX_MUTABLE_PROMPT_CHARS:
            raise ValueError(
                f"prompt_overrides.{node_id} exceeds {MAX_MUTABLE_PROMPT_CHARS} characters. "
                f"Current length: {len(value)}"
            )


app = FastAPI(
    title="Intern Mini Agent API",
    description=(
        "Backend API for workflow execution and guarded prompt schema retrieval. "
        "Frontend is served separately."
    ),
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(RequestValidationError)
async def handle_validation_error(_, exc: RequestValidationError):  # pragma: no cover
    return _error_response(
        status_code=422,
        code="validation_error",
        message="Request validation failed.",
        details=exc.errors(),
    )


@app.exception_handler(Exception)
async def handle_unexpected_error(_, exc: Exception):  # pragma: no cover
    logger.exception("Unhandled API error: %s", exc)
    return _error_response(
        status_code=500,
        code="internal_error",
        message="Unexpected server error.",
    )


@app.get("/health")
def health() -> dict[str, str | int]:
    return {
        "status": "ok",
        "provider": PROVIDER_NAME,
        "default_model": DEFAULT_GROQ_MODEL,
        "max_mutable_prompt_chars": MAX_MUTABLE_PROMPT_CHARS,
    }


@app.get("/v1/prompt-policy")
def prompt_policy() -> dict[str, object]:
    return guarded_prompt_policy()


@app.get("/api/prompts")
@app.get("/prompts/schema")
@app.get("/v1/prompts/schema")
def prompts_schema() -> dict[str, object]:
    return prompt_schema()


@app.get("/graph/schema")
def graph_schema() -> dict[str, object]:
    return get_graph_schema()


@app.post("/generate", response_model=RunWorkflowResponse)
@app.post("/v1/workflows/run", response_model=RunWorkflowResponse)
async def run_agent_workflow(payload: RunWorkflowRequest):
    run_id = str(uuid4())

    try:
        _validate_prompt_payload(payload)
        llm = build_chat_model(api_key=payload.api_key, model=payload.model)
        result = await run_in_threadpool(
            run_workflow,
            payload.user_prompt,
            llm,
            payload.recursion_limit,
            payload.mutable_prompt,
            payload.prompt_overrides,
            None,
        )
    except ValueError as exc:
        return _error_response(422, "invalid_request", str(exc))
    except Exception as exc:  # pragma: no cover
        logger.exception("Workflow failed run_id=%s", run_id)
        return _error_response(500, "workflow_error", str(exc))

    return RunWorkflowResponse(
        status=result.get("status", "DONE"),
        provider=PROVIDER_NAME,
        plan=result.get("plan"),
        task_plan=result.get("detailed_ins"),
    )


@app.post("/stream")
@app.post("/v1/workflows/stream")
async def stream_agent_workflow(payload: RunWorkflowRequest):
    run_id = str(uuid4())

    try:
        _validate_prompt_payload(payload)
        llm = build_chat_model(api_key=payload.api_key, model=payload.model)
    except ValueError as exc:
        return _error_response(422, "invalid_request", str(exc))

    event_id = 0
    node_states: dict[str, str] = {node_id: "idle" for node_id in NODE_IDS}
    activity_scores: dict[str, float] = {node_id: 0.0 for node_id in NODE_IDS}
    active_node_id: str | None = None

    def emit(
        event_name: str,
        payload_in: dict[str, Any],
    ) -> str:
        nonlocal event_id, active_node_id
        event_id += 1

        node = payload_in.get("node")
        state = payload_in.get("state")
        activity_score = payload_in.get("activity_score")

        if node in node_states and isinstance(state, str):
            node_states[node] = state
        if node in activity_scores and isinstance(activity_score, (float, int)):
            activity_scores[node] = float(activity_score)

        if event_name == "on_node_start" and isinstance(node, str):
            active_node_id = node
        elif event_name == "on_node_end" and isinstance(node, str) and active_node_id == node:
            active_node_id = None

        payload_out = {
            "run_id": run_id,
            "event_id": event_id,
            "timestamp": _iso_utc_now(),
            "node": node,
            "state": state,
            "activity_score": activity_score,
            "phase": payload_in.get("phase"),
            "severity": payload_in.get("severity"),
            "message": payload_in.get("message"),
            "namespace": payload_in.get("namespace"),
            "raw": payload_in.get("raw"),
            "active_node_id": active_node_id,
            "node_states": dict(node_states),
            "activity_by_node_id": dict(activity_scores),
            **{
                key: value
                for key, value in payload_in.items()
                if key
                not in {
                    "node",
                    "state",
                    "activity_score",
                    "phase",
                    "severity",
                    "message",
                    "namespace",
                    "raw",
                }
            },
        }
        return _format_sse(event_name, payload_out)

    async def stream():
        started_nodes: set[str] = set()
        yield emit(
            "run_started",
            {
                "node": None,
                "state": None,
                "activity_score": 0.0,
                "phase": "system",
                "severity": "info",
                "message": "Workflow run started with verbose stream modes: debug/messages/updates.",
                "namespace": None,
                "raw": None,
                "provider": PROVIDER_NAME,
            },
        )
        try:
            async for stream_item in astream_workflow(
                payload.user_prompt,
                llm,
                payload.recursion_limit,
                payload.mutable_prompt,
                payload.prompt_overrides,
            ):
                normalized_events = _normalize_langgraph_stream_item(stream_item, started_nodes)
                for event_name, event_payload in normalized_events:
                    yield emit(event_name, event_payload)

            for node_id, state in list(node_states.items()):
                if state == "active":
                    yield emit(
                        "on_node_end",
                        {
                            "node": node_id,
                            "state": "completed",
                            "activity_score": 0.2,
                            "phase": NODE_PHASES.get(node_id, "runtime"),
                            "severity": "info",
                            "message": f"Node '{node_id}' completed with update payload.",
                            "namespace": None,
                            "raw": {"source": "stream_finalize"},
                            "update": {"status": "completed_on_finalize"},
                        },
                    )

            yield emit(
                "run_complete",
                {
                    "node": None,
                    "state": None,
                    "activity_score": 0.0,
                    "phase": "system",
                    "severity": "info",
                    "message": "Workflow finished successfully.",
                    "namespace": None,
                    "raw": None,
                    "status": "DONE",
                },
            )
        except Exception as exc:  # pragma: no cover
            logger.exception("Workflow stream failed run_id=%s", run_id)
            if active_node_id and active_node_id in node_states:
                node_states[active_node_id] = "error"
                activity_scores[active_node_id] = 0.0
            yield emit(
                "error",
                {
                    "node": active_node_id,
                    "state": "error",
                    "activity_score": 0.0,
                    "phase": "system",
                    "severity": "error",
                    "message": "Workflow failed during streaming.",
                    "namespace": None,
                    "raw": {"exception": str(exc), "type": exc.__class__.__name__},
                },
            )

    return StreamingResponse(stream(), media_type="text/event-stream")
