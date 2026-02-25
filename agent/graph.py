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


graph=StateGraph(dict)
graph.add_node("planner",planner_agent)
graph.add_node("architect",architect_agent)
graph.add_node("coder",coder_agent)
graph.add_edge(start_key="planner",end_key="architect")
graph.add_edge(start_key="architect",end_key="coder")
graph.add_conditional_edges(
    "coder",
    lambda s: "END" if s.get("status") == "DONE" else "coder",
    {"END": END, "coder": "coder"}
)
graph.set_entry_point("planner")
agent = graph.compile()
if __name__ == "__main__":
    result = agent.invoke({"user_prompt": " "},#Add your request here.
                          {"recursion_limit": 100})
    print("Final State:", result)