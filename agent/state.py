"""State and schema models for the planning/architect/coder graph."""

from __future__ import annotations

from typing import Annotated, Optional, TypedDict

from langchain_core.messages import AnyMessage
from langgraph.graph import add_messages
from pydantic import BaseModel, ConfigDict, Field


class FileSpec(BaseModel):
    path: str = Field(description="Path to the file to be created or modified.")
    purpose: str = Field(description="Short purpose of this file in the project.")


class Plan(BaseModel):
    name: str = Field(description="Short, clear name of the generated application.")
    description: str = Field(description="Two-sentence summary of what will be built.")
    techstack: str = Field(description="Primary technology stack needed for the build.")
    features: list[str] = Field(description="Core features to implement.")
    files: list[FileSpec] = Field(description="Files to generate with their purpose.")


class ImplementationStep(BaseModel):
    file_path: str = Field(description="Path for the file this step targets.")
    task_description: str = Field(description="Single-string task details for this file.")


class TaskPlan(BaseModel):
    implementation_steps: list[ImplementationStep] = Field(
        description="Ordered implementation steps, one per file."
    )
    model_config = ConfigDict(extra="allow")


class CoderState(BaseModel):
    task_plan: TaskPlan = Field(description="Plan containing all coder implementation steps.")
    current_step_idx: int = Field(
        0,
        description="Current index in implementation_steps.",
    )
    current_file_content: Optional[str] = Field(
        None,
        description="Optional in-memory copy of current file content.",
    )


class AgentState(TypedDict, total=False):
    messages: Annotated[list[AnyMessage], add_messages]
    user_prompt: str
    mutable_prompt: str | None
    prompt_overrides: dict[str, str]
    plan: Plan
    detailed_ins: TaskPlan
    coder_state: CoderState
    status: str


# Compatibility aliases for legacy references.
File = FileSpec
impletation = ImplementationStep
Taskplan = TaskPlan
