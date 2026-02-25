from __future__ import annotations

import subprocess
from typing import Tuple

from langchain_core.tools import tool

try:  # pragma: no cover - supports running as script
    from .workspace import (
        WorkspaceBinaryFileError,
        WorkspaceValidationError,
        list_relative_files,
        read_text_file,
        resolve_workspace_path,
        workspace_root,
        write_text_file,
    )
except ImportError:  # pragma: no cover
    from workspace import (
        WorkspaceBinaryFileError,
        WorkspaceValidationError,
        list_relative_files,
        read_text_file,
        resolve_workspace_path,
        workspace_root,
        write_text_file,
    )


@tool
def get_current_directory() -> str:
    """Returns the directory where the generated project lives."""
    return str(workspace_root())


@tool
def write_file(path: str, content: str) -> str:
    """Writes content to a file inside the 'generated_project' folder."""
    relative_path = write_text_file(path, content)
    return f"WROTE: {relative_path}"


@tool
def read_file(path: str) -> str:
    """Reads content from a file within the 'generated_project' folder."""
    try:
        return read_text_file(path)
    except FileNotFoundError:
        return f"ERROR: File {path} does not exist."
    except WorkspaceBinaryFileError:
        return f"ERROR: File {path} is binary and cannot be read as text."


@tool
def list_files(directory: str = ".") -> str:
    """Lists all files inside the 'generated_project' folder."""
    try:
        files = list_relative_files(directory)
    except FileNotFoundError:
        return f"ERROR: {directory} does not exist"
    except WorkspaceValidationError:
        return f"ERROR: {directory} is not a directory"
    return "\n".join(files) if files else "No files found."


@tool
def run_cmd(cmd: str, cwd: str = None, timeout: int = 30) -> Tuple[int, str, str]:
    """Runs a shell command inside the 'generated_project' folder."""
    cwd_dir = resolve_workspace_path(cwd, allow_root=True) if cwd else workspace_root()

    res = subprocess.run(
        cmd,
        shell=True,
        cwd=str(cwd_dir),
        capture_output=True,
        text=True,
        timeout=timeout,
    )
    return res.returncode, res.stdout, res.stderr
