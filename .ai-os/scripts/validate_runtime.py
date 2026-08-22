#!/usr/bin/env python3
"""Validate an installed repository-safe Personal AI OS runtime."""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import sys


AGENTS_START = "<!-- PERSONAL-AI-OS:START -->"
AGENTS_END = "<!-- PERSONAL-AI-OS:END -->"
GITIGNORE_START = "# PERSONAL-AI-OS:START"
GITIGNORE_END = "# PERSONAL-AI-OS:END"
PRIVATE_PATTERNS = (
    re.compile(r"(?i)USER_" + r"OPERATING_CONTEXT\.md"),
    re.compile(r"(?i)personal-ai-os/" + r"private"),
    re.compile(r"/" + r"Users/[^/\s]+/"),
    re.compile(r"(?i)[A-Z]:\\" + r"Users\\[^\\\s]+\\"),
    re.compile(r"(?i)Application Support/" + r"PersonalAIOS"),
    re.compile(r"(?i)diary\." + r"sqlite(?:3)?"),
    re.compile(r"-----BEGIN [A-Z0-9 ]*" + r"PRIVATE KEY-----"),
    re.compile(r"\bghp_" + r"[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bsk-" + r"[A-Za-z0-9_-]{20,}\b"),
)


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def section(text: str, start: str, end: str) -> str | None:
    if text.count(start) != 1 or text.count(end) != 1:
        return None
    rest = text.split(start, 1)[1]
    if end not in rest:
        return None
    return start + rest.split(end, 1)[0] + end


def managed_path(repository: Path, relative_value: object) -> Path:
    if not isinstance(relative_value, str):
        raise ValueError("managed path must be a string")
    relative = Path(relative_value)
    if relative.is_absolute() or not relative.parts or any(
        part in {"", ".", ".."} for part in relative.parts
    ):
        raise ValueError(f"unsafe managed path: {relative_value}")
    text = relative.as_posix()
    if not (text.startswith(".ai-os/") or text.startswith(".agents/skills/")):
        raise ValueError(f"managed path is outside approved roots: {relative_value}")
    if text in {".ai-os/UPSTREAM.json", ".ai-os/project/PROJECT_PROFILE.md"}:
        raise ValueError(f"project-owned or control file cannot be managed: {relative_value}")
    current = repository
    for part in relative.parts[:-1]:
        current = current / part
        if current.is_symlink():
            raise ValueError(f"managed path parent is a symlink: {relative_value}")
    return repository / relative


def validate(runtime_root: Path) -> list[str]:
    errors: list[str] = []
    if runtime_root.is_symlink():
        return ["Runtime root must not be a symlink."]
    runtime_root = runtime_root.resolve()
    repository = runtime_root.parent
    upstream_path = runtime_root / "UPSTREAM.json"
    if not upstream_path.is_file() or upstream_path.is_symlink():
        return ["UPSTREAM.json is missing or linked."]
    try:
        upstream = json.loads(upstream_path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        return [f"UPSTREAM.json is invalid: {error}"]
    managed = upstream.get("managed_files")
    if not isinstance(managed, dict):
        return ["UPSTREAM.json managed_files must be an object."]
    for relative, expected in managed.items():
        if not isinstance(expected, str) or not re.fullmatch(r"[0-9a-f]{64}", expected):
            errors.append(f"Invalid managed hash: {relative}")
            continue
        if relative == "AGENTS.md#PERSONAL-AI-OS":
            path = repository / "AGENTS.md"
            value = section(path.read_text(encoding="utf-8"), AGENTS_START, AGENTS_END) if path.is_file() else None
            actual = sha256(value.encode()) if value else "absent"
        elif relative == ".gitignore#PERSONAL-AI-OS":
            path = repository / ".gitignore"
            value = section(path.read_text(encoding="utf-8"), GITIGNORE_START, GITIGNORE_END) if path.is_file() else None
            actual = sha256(value.encode()) if value else "absent"
        else:
            try:
                path = managed_path(repository, relative)
            except ValueError as error:
                errors.append(str(error))
                continue
            if path.is_symlink() or not path.is_file():
                actual = "absent"
            else:
                actual = sha256(path.read_bytes())
        if actual != expected:
            errors.append(f"Managed-file drift: {relative}: expected {expected}, observed {actual}")
    manifest_path = runtime_root / "manifest.yaml"
    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        errors.append(f"manifest.yaml is not valid JSON-compatible YAML: {error}")
        manifest = {}
    schemas = manifest.get("schemas", [])
    if not isinstance(schemas, list) or not all(isinstance(item, str) for item in schemas):
        errors.append("manifest schemas must be a list of relative paths")
        schemas = []
    for relative in schemas:
        schema_path = Path(relative)
        if (
            schema_path.is_absolute()
            or ".." in schema_path.parts
            or not schema_path.as_posix().startswith("schemas/")
        ):
            errors.append(f"Unsafe schema path: {relative}")
            continue
        try:
            candidate = runtime_root / schema_path
            current = runtime_root
            for part in schema_path.parts:
                current = current / part
                if current.is_symlink():
                    raise OSError("schema path uses a symlink")
            json.loads(candidate.read_text(encoding="utf-8"))
        except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
            errors.append(f"Invalid schema {relative}: {error}")
    for path in runtime_root.rglob("*"):
        relative = path.relative_to(runtime_root)
        if "__pycache__" in relative.parts or path.suffix.lower() in {".pyc", ".pyo"}:
            continue
        if path.is_symlink():
            errors.append(f"Managed runtime contains a symlink: {relative}")
            continue
        if not path.is_file() or path == upstream_path:
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            errors.append(f"Managed runtime is not UTF-8: {relative}")
            continue
        for pattern in PRIVATE_PATTERNS:
            if pattern.search(text):
                errors.append(f"Private or secret marker in {relative}: {pattern.pattern}")
    return errors


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    runtime_root = Path(arguments[0]) if arguments else Path(".ai-os")
    errors = validate(runtime_root)
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Personal AI OS repository runtime validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
