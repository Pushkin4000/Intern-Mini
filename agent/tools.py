import pathlib
import subprocess
import os
from typing import Tuple
from langchain_core.tools import tool

# 1. Define the base project root and the AI sandbox folder
BASE_ROOT = pathlib.Path(__file__).parent.parent.resolve() 
PROJECT_ROOT = (BASE_ROOT / "generated_project").resolve()

# Ensure the generated folder exists immediately
PROJECT_ROOT.mkdir(parents=True, exist_ok=True)

def safe_path_for_project(path: str) -> pathlib.Path:
    # 1. Clean the input: Strip leading slashes to prevent absolute path hijacking
    # This turns "/index.html" or "C:\index.html" into "index.html"
    clean_path = str(path).lstrip("/\\")
    
    # 2. Join with our sandbox folder
    p = (PROJECT_ROOT / clean_path).resolve()

    # 3. Security check: Ensure the AI hasn't tried to "escape" using ../../
    try:
        p.relative_to(PROJECT_ROOT)
    except ValueError:
        raise ValueError(f"Security Alert: Attempt to access {p} outside of sandbox {PROJECT_ROOT}")

    return p

@tool
def get_current_directory() -> str:
    """Returns the directory where the generated project lives."""
    return str(PROJECT_ROOT)

@tool
def write_file(path: str, content: str) -> str:
    """Writes content to a file inside the 'generated_project' folder."""
    p = safe_path_for_project(path)
    # Automatically create sub-folders (like /src or /css) if the agent asks for them
    p.parent.mkdir(parents=True, exist_ok=True)
    with open(p, "w", encoding="utf-8") as f:
        f.write(content)
    return f"WROTE: {p.relative_to(PROJECT_ROOT)}"

@tool
def read_file(path: str) -> str:
    """Reads content from a file within the 'generated_project' folder."""
    p = safe_path_for_project(path)
    if not p.exists():
        return f"ERROR: File {path} does not exist."
    with open(p, "r", encoding="utf-8") as f:
        return f.read()

@tool
def list_files(directory: str = ".") -> str:
    """Lists all files inside the 'generated_project' folder."""
    p = safe_path_for_project(directory)
    if not p.is_dir():
        return f"ERROR: {directory} is not a directory"
    
    # List files relative to the sandbox root for the agent's clarity
    files = [str(f.relative_to(PROJECT_ROOT)) for f in p.glob("**/*") if f.is_file()]
    return "\n".join(files) if files else "No files found."

@tool
def run_cmd(cmd: str, cwd: str = None, timeout: int = 30) -> Tuple[int, str, str]:
    """Runs a shell command inside the 'generated_project' folder."""
    # If agent provides a cwd, make sure it's inside the sandbox
    cwd_dir = safe_path_for_project(cwd) if cwd else PROJECT_ROOT
    
    res = subprocess.run(
        cmd, 
        shell=True, 
        cwd=str(cwd_dir), 
        capture_output=True, 
        text=True,
        timeout=timeout
    )
    return res.returncode, res.stdout, res.stderr