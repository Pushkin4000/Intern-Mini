"""Workspace filesystem service for generated project management."""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path
import shutil
import zipfile

MAX_EDITABLE_FILE_CHARS = 400_000

BASE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = (BASE_ROOT / "generated_project").resolve()


class WorkspaceValidationError(ValueError):
    """Raised when workspace input is invalid."""


class WorkspaceConflictError(RuntimeError):
    """Raised when an operation conflicts with existing filesystem state."""


class WorkspaceBinaryFileError(ValueError):
    """Raised when a file is not UTF-8 text and cannot be edited as text."""


@dataclass(frozen=True)
class WorkspaceTreeNode:
    name: str
    path: str
    type: str
    size: int | None = None
    children: list["WorkspaceTreeNode"] | None = None

    def to_dict(self) -> dict[str, object]:
        payload: dict[str, object] = {
            "name": self.name,
            "path": self.path,
            "type": self.type,
        }
        if self.size is not None:
            payload["size"] = self.size
        if self.children is not None:
            payload["children"] = [child.to_dict() for child in self.children]
        return payload


def workspace_root() -> Path:
    root = WORKSPACE_ROOT
    root.mkdir(parents=True, exist_ok=True)
    return root


def _coerce_relative_path(path: str, *, allow_root: bool = False) -> str:
    value = (path or "").strip()
    if not value or value == ".":
        if allow_root:
            return "."
        raise WorkspaceValidationError("path must not be empty.")

    raw_path = Path(value)
    if raw_path.is_absolute():
        raise WorkspaceValidationError("Absolute paths are not allowed.")
    if raw_path.drive:
        raise WorkspaceValidationError("Drive-qualified paths are not allowed.")
    return value


def resolve_workspace_path(path: str, *, allow_root: bool = False) -> Path:
    """Resolve a relative path into the workspace root with traversal protection."""
    root = workspace_root()
    relative = _coerce_relative_path(path, allow_root=allow_root)
    candidate = root if relative == "." else (root / relative)
    resolved = candidate.resolve()

    try:
        resolved.relative_to(root)
    except ValueError as exc:
        raise WorkspaceValidationError("Path escapes workspace root.") from exc
    return resolved


def _relative_path(path: Path) -> str:
    root = workspace_root()
    return path.relative_to(root).as_posix()


def _sorted_entries(directory: Path) -> list[Path]:
    return sorted(
        directory.iterdir(),
        key=lambda entry: (entry.is_file(), entry.name.lower()),
    )


def _tree_for_path(path: Path) -> WorkspaceTreeNode:
    rel_path = _relative_path(path)
    if path.is_dir():
        children = [_tree_for_path(child) for child in _sorted_entries(path)]
        return WorkspaceTreeNode(
            name=path.name,
            path=rel_path,
            type="directory",
            children=children,
        )
    return WorkspaceTreeNode(
        name=path.name,
        path=rel_path,
        type="file",
        size=path.stat().st_size,
    )


def list_tree() -> list[dict[str, object]]:
    root = workspace_root()
    nodes = [_tree_for_path(path).to_dict() for path in _sorted_entries(root)]
    return nodes


def list_relative_files(directory: str = ".") -> list[str]:
    target = resolve_workspace_path(directory, allow_root=True)
    if not target.exists():
        raise FileNotFoundError(f"{directory} does not exist.")
    if not target.is_dir():
        raise WorkspaceValidationError(f"{directory} is not a directory.")

    root = workspace_root()
    files = [path.relative_to(root).as_posix() for path in target.rglob("*") if path.is_file()]
    return sorted(files)


def list_flat_text_files() -> tuple[dict[str, str], list[str]]:
    root = workspace_root()
    files: dict[str, str] = {}
    skipped_binary: list[str] = []

    for path in sorted((item for item in root.rglob("*") if item.is_file()), key=lambda p: p.as_posix()):
        rel = path.relative_to(root).as_posix()
        try:
            files[rel] = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            skipped_binary.append(rel)

    return files, skipped_binary


def read_text_file(path: str) -> str:
    target = resolve_workspace_path(path)
    if not target.exists() or not target.is_file():
        raise FileNotFoundError(f"{path} does not exist.")
    try:
        return target.read_text(encoding="utf-8")
    except UnicodeDecodeError as exc:
        raise WorkspaceBinaryFileError(f"{path} is binary and cannot be edited as text.") from exc


def write_text_file(path: str, content: str) -> str:
    if len(content) > MAX_EDITABLE_FILE_CHARS:
        raise WorkspaceValidationError(
            f"content exceeds {MAX_EDITABLE_FILE_CHARS} characters. Current length: {len(content)}"
        )

    target = resolve_workspace_path(path)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")
    return _relative_path(target)


def create_folder(path: str) -> str:
    target = resolve_workspace_path(path)
    target.mkdir(parents=True, exist_ok=True)
    return _relative_path(target)


def delete_path(path: str, *, recursive: bool = False) -> str:
    target = resolve_workspace_path(path)
    if not target.exists():
        raise FileNotFoundError(f"{path} does not exist.")

    if target.is_dir():
        has_children = any(target.iterdir())
        if has_children and not recursive:
            raise WorkspaceConflictError(
                f"{path} is a non-empty directory. Use recursive=true to delete."
            )
        if has_children:
            shutil.rmtree(target)
        else:
            target.rmdir()
    else:
        target.unlink()
    return path.strip().replace("\\", "/")


def rename_path(from_path: str, to_path: str, *, overwrite: bool = False) -> str:
    source = resolve_workspace_path(from_path)
    target = resolve_workspace_path(to_path)

    if not source.exists():
        raise FileNotFoundError(f"{from_path} does not exist.")

    if target.exists():
        if not overwrite:
            raise WorkspaceConflictError(f"{to_path} already exists.")
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    target.parent.mkdir(parents=True, exist_ok=True)
    source.rename(target)
    return _relative_path(target)


def build_workspace_zip() -> bytes:
    root = workspace_root()
    buffer = BytesIO()
    with zipfile.ZipFile(buffer, mode="w", compression=zipfile.ZIP_DEFLATED) as archive:
        for path in sorted((item for item in root.rglob("*") if item.is_file()), key=lambda p: p.as_posix()):
            archive.write(path, arcname=path.relative_to(root).as_posix())
    return buffer.getvalue()
