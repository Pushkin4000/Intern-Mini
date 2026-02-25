"""LangGraph workflow for planner -> architect -> coder execution."""

from __future__ import annotations

from typing import Any, AsyncIterator, Callable

from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.tools import tool
from langgraph.constants import END
from langgraph.graph import StateGraph

try:
    from langchain.agents import create_agent
except ImportError:  # pragma: no cover
    create_agent = None

from langgraph.prebuilt import create_react_agent

try:  # pragma: no cover - allows running module directly
    from .prompts import (
        architecture_prompt,
        coder_system_prompt,
        resolve_mutable_for_node,
        planner_prompt,
    )
    from .state import AgentState, CoderState, Plan, TaskPlan
    from .tools import list_files, read_file, write_file
except ImportError:  # pragma: no cover
    from prompts import (
        architecture_prompt,
        coder_system_prompt,
        resolve_mutable_for_node,
        planner_prompt,
    )
    from state import AgentState, CoderState, Plan, TaskPlan
    from tools import list_files, read_file, write_file

GraphEvent = dict[str, Any]
EventCallback = Callable[[GraphEvent], None]


def _emit(event_callback: EventCallback | None, event_type: str, **payload: Any) -> None:
    if event_callback is None:
        return
    event_callback({"event": event_type, **payload})


def _resolve_node_mutable_prompt(state: AgentState, node_id: str) -> str:
    prompt_overrides = state.get("prompt_overrides") or {}
    legacy_mutable = state.get("mutable_prompt")
    return resolve_mutable_for_node(node_id, prompt_overrides, legacy_mutable)


@tool
def _list_workspace_files(_: str = ".") -> str:
    """Lists files in the active generated project workspace."""
    return list_files.run(".")


def _build_coder_tools() -> list[Any]:
    return [read_file, write_file, _list_workspace_files]


def _planner_agent(
    llm: BaseChatModel,
    event_callback: EventCallback | None,
) -> Callable[[AgentState], dict[str, Any]]:
    def planner(state: AgentState) -> dict[str, Any]:
        user_prompt = str(state.get("user_prompt", "")).strip()
        mutable_prompt = _resolve_node_mutable_prompt(state, "planner")

        if not user_prompt:
            raise ValueError("user_prompt must not be empty.")

        _emit(event_callback, "node_start", node="planner")
        response = llm.with_structured_output(Plan).invoke(
            planner_prompt(user_prompt, mutable_layer=mutable_prompt)
        )
        if response is None:
            raise ValueError("Planner returned no response.")

        _emit(
            event_callback,
            "node_complete",
            node="planner",
            file_count=len(response.files),
            feature_count=len(response.features),
        )
        return {"plan": response}

    return planner


def _architect_agent(
    llm: BaseChatModel,
    event_callback: EventCallback | None,
) -> Callable[[AgentState], dict[str, Any]]:
    def architect(state: AgentState) -> dict[str, Any]:
        plan = state["plan"]
        mutable_prompt = _resolve_node_mutable_prompt(state, "architect")

        _emit(event_callback, "node_start", node="architect")
        response = llm.with_structured_output(TaskPlan).invoke(
            architecture_prompt(plan, mutable_layer=mutable_prompt)
        )
        if response is None:
            raise ValueError("Architect returned no response.")

        response.plan = plan
        _emit(
            event_callback,
            "node_complete",
            node="architect",
            step_count=len(response.implementation_steps),
        )
        return {"detailed_ins": response}

    return architect


def _coder_agent(
    llm: BaseChatModel,
    event_callback: EventCallback | None,
) -> Callable[[AgentState], dict[str, Any]]:
    def coder(state: AgentState) -> dict[str, Any]:
        coder_state = state.get("coder_state")
        mutable_prompt = _resolve_node_mutable_prompt(state, "coder")

        if coder_state is None:
            coder_state = CoderState(task_plan=state["detailed_ins"], current_step_idx=0)

        steps = coder_state.task_plan.implementation_steps
        if coder_state.current_step_idx >= len(steps):
            _emit(event_callback, "node_complete", node="coder", status="DONE")
            return {"coder_state": coder_state, "status": "DONE"}

        current_task = steps[coder_state.current_step_idx]
        try:
            existing_content = read_file.run(current_task.file_path)
        except FileNotFoundError:
            existing_content = f"ERROR: File {current_task.file_path} does not exist."

        _emit(
            event_callback,
            "node_start",
            node="coder",
            step_index=coder_state.current_step_idx,
            file_path=current_task.file_path,
        )

        system_prompt = coder_system_prompt(mutable_layer=mutable_prompt)
        user_prompt = (
            f"Task: {current_task.task_description}\n"
            f"File: {current_task.file_path}\n"
            f"Existing content:\n{existing_content}\n"
            "Use write_file(path, content) to save your changes."
        )

        coder_tools = _build_coder_tools()
        if create_agent is not None:
            runnable_agent = create_agent(llm, coder_tools)
        else:  # pragma: no cover
            runnable_agent = create_react_agent(llm, coder_tools)

        runnable_agent.invoke(
            {
                "messages": [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ]
            }
        )

        coder_state.current_step_idx += 1
        _emit(
            event_callback,
            "node_progress",
            node="coder",
            next_step_index=coder_state.current_step_idx,
            total_steps=len(steps),
        )
        return {"coder_state": coder_state}

    return coder


def build_agent(
    llm: BaseChatModel,
    event_callback: EventCallback | None = None,
):
    graph = StateGraph(AgentState)
    graph.add_node("planner", _planner_agent(llm, event_callback))
    graph.add_node("architect", _architect_agent(llm, event_callback))
    graph.add_node("coder", _coder_agent(llm, event_callback))

    graph.add_edge(start_key="planner", end_key="architect")
    graph.add_edge(start_key="architect", end_key="coder")
    graph.add_conditional_edges(
        "coder",
        lambda state: "END" if state.get("status") == "DONE" else "coder",
        {"END": END, "coder": "coder"},
    )
    graph.set_entry_point("planner")
    return graph.compile()


def run_workflow(
    user_prompt: str,
    llm: BaseChatModel,
    recursion_limit: int = 100,
    mutable_prompt: str | None = None,
    prompt_overrides: dict[str, str] | None = None,
    event_callback: EventCallback | None = None,
) -> dict[str, Any]:
    agent = build_agent(llm, event_callback=event_callback)
    return agent.invoke(
        {
            "user_prompt": user_prompt,
            "mutable_prompt": mutable_prompt,
            "prompt_overrides": prompt_overrides or {},
        },
        {"recursion_limit": recursion_limit},
    )


async def astream_workflow(
    user_prompt: str,
    llm: BaseChatModel,
    recursion_limit: int = 100,
    mutable_prompt: str | None = None,
    prompt_overrides: dict[str, str] | None = None,
    event_callback: EventCallback | None = None,
) -> AsyncIterator[Any]:
    """Stream verbose LangGraph runtime data for a single workflow run."""
    agent = build_agent(llm, event_callback=event_callback)
    async for item in agent.astream(
        {
            "user_prompt": user_prompt,
            "mutable_prompt": mutable_prompt,
            "prompt_overrides": prompt_overrides or {},
        },
        {"recursion_limit": recursion_limit},
        stream_mode=["debug", "messages", "updates"],
        print_mode=(),
        debug=True,
        subgraphs=True,
    ):
        yield item


def get_graph_schema() -> dict[str, Any]:
    """Return a React Flow compatible schema for the agent graph."""
    return {
        "graph_id": "agent_mind_v1",
        "nodes": [
            {
                "id": "planner",
                "label": "Planner",
                "type": "default",
                "position": {"x": 120, "y": 160},
                "data": {"role": "planning"},
            },
            {
                "id": "architect",
                "label": "Architect",
                "type": "default",
                "position": {"x": 420, "y": 160},
                "data": {"role": "architecture"},
            },
            {
                "id": "coder",
                "label": "Coder",
                "type": "default",
                "position": {"x": 720, "y": 160},
                "data": {"role": "coding"},
            },
        ],
        "edges": [
            {
                "id": "edge-planner-architect",
                "source": "planner",
                "target": "architect",
                "type": "smoothstep",
                "animated": False,
            },
            {
                "id": "edge-architect-coder",
                "source": "architect",
                "target": "coder",
                "type": "smoothstep",
                "animated": False,
            },
            {
                "id": "edge-coder-loop",
                "source": "coder",
                "target": "coder",
                "type": "smoothstep",
                "animated": True,
            },
        ],
        "state_model": ["idle", "active", "completed", "error"],
        "activity_model": {"min": 0.0, "max": 1.0},
    }
