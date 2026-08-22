#!/usr/bin/env python3
"""Maintain private repository task, execution, review, and model-run records."""

from __future__ import annotations

import argparse
from collections import Counter, defaultdict
from contextlib import contextmanager
from datetime import datetime, timezone
import json
import os
from pathlib import Path
import re
import shutil
import stat
import subprocess
import sys
import tempfile

try:
    import fcntl
except ImportError:  # pragma: no cover - personal repository runtime targets macOS/Linux.
    fcntl = None

from validate_contract import validate_instance


RUN_ID_PATTERN = re.compile(r"[A-Za-z0-9][A-Za-z0-9._-]{0,127}")
SECRET_PATTERNS = (
    re.compile(r"-----BEGIN [A-Z0-9 ]*" + r"PRIVATE KEY-----"),
    re.compile(r"\bghp_" + r"[A-Za-z0-9]{20,}\b"),
    re.compile(r"\bgithub_pat_" + r"[A-Za-z0-9_]{20,}\b"),
    re.compile(r"\bsk-" + r"[A-Za-z0-9_-]{20,}\b"),
    re.compile(r"\bAKIA" + r"[0-9A-Z]{16}\b"),
    re.compile(r"(?i)\bauthorization\s*:\s*bearer\s+" + r"[A-Za-z0-9._~+/-]{12,}"),
)
RUN_STATUSES = frozenset(
    {"draft", "ready", "building", "review", "integration", "blocked", "done", "cancelled"}
)
TRANSITIONS = {
    "draft": frozenset({"ready", "cancelled"}),
    "ready": frozenset({"building", "blocked", "cancelled"}),
    "building": frozenset({"review", "blocked", "cancelled"}),
    "review": frozenset({"building", "integration", "blocked", "cancelled"}),
    "integration": frozenset({"building", "review", "done", "blocked", "cancelled"}),
    "blocked": frozenset({"ready", "building", "review", "integration", "cancelled"}),
    "done": frozenset(),
    "cancelled": frozenset(),
}
MAX_TASK_BYTES = 256_000
MAX_STATUS_BYTES = 1_000_000
MAX_MODEL_RECORD_BYTES = 64_000
MAX_MODEL_LOG_BYTES = 64_000_000
MAX_EXECUTION_PLAN_BYTES = 512_000
MAX_EXECUTION_STATE_BYTES = 2_000_000
MAX_EXECUTION_REVIEW_BYTES = 256_000
COMMIT_PATTERN = re.compile(r"[0-9a-f]{40,64}")
UNIT_TRANSITIONS = {
    "planned": frozenset(),
    "assigned": frozenset({"running", "cancelled"}),
    "running": frozenset({"blocked", "ready_for_review", "cancelled"}),
    "blocked": frozenset({"running", "cancelled"}),
    "ready_for_review": frozenset(),
    "review_blocked": frozenset({"running", "cancelled"}),
    "approved": frozenset(),
    "escalation_required": frozenset(),
    "cancelled": frozenset(),
}


class RunLedgerError(ValueError):
    pass


def _utc_text(value: datetime) -> str:
    if value.tzinfo is None:
        raise RunLedgerError("Run timestamps must be timezone-aware.")
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_time(value: object, label: str) -> datetime:
    if not isinstance(value, str):
        raise RunLedgerError(f"{label} must be an ISO 8601 timestamp.")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as error:
        raise RunLedgerError(f"{label} must be an ISO 8601 timestamp.") from error
    if parsed.tzinfo is None:
        raise RunLedgerError(f"{label} must include a timezone.")
    return parsed.astimezone(timezone.utc)


def _safe_identifier(value: str, label: str = "run ID") -> str:
    identifier = value.strip()
    if identifier in {".", ".."} or RUN_ID_PATTERN.fullmatch(identifier) is None:
        raise RunLedgerError(
            f"Unsafe {label}: use 1-128 letters, numbers, dots, underscores, or hyphens."
        )
    return identifier


def _runtime_root(path: Path) -> Path:
    if path.is_symlink():
        raise RunLedgerError("Runtime root must not be a symlink.")
    if not path.is_dir():
        raise RunLedgerError(f"Runtime root does not exist or is not a directory: {path}")
    return path.resolve()


def _runs_root(runtime_root: Path, *, create: bool) -> Path:
    root = _runtime_root(runtime_root)
    runs = root / "runs"
    if runs.is_symlink():
        raise RunLedgerError("The runs root must not be a symlink.")
    if create:
        runs.mkdir(mode=0o700, exist_ok=True)
        runs.chmod(0o700)
    if not runs.is_dir():
        raise RunLedgerError(f"Run storage does not exist: {runs}")
    return runs


def _run_root(runtime_root: Path, run_id: str, *, must_exist: bool = True) -> Path:
    identifier = _safe_identifier(run_id)
    runs = _runs_root(runtime_root, create=not must_exist)
    candidate = runs / identifier
    if candidate.is_symlink():
        raise RunLedgerError(f"Run directory must not be a symlink: {identifier}")
    if must_exist and not candidate.is_dir():
        raise RunLedgerError(f"Unknown orchestration run: {identifier}")
    return candidate


def _schema_path(runtime_root: Path, name: str) -> Path:
    installed = runtime_root / "schemas" / name
    if installed.is_file() and not installed.is_symlink():
        return installed
    source = Path(__file__).resolve().parents[1] / "schemas" / name
    if source.is_file() and not source.is_symlink():
        return source
    raise RunLedgerError(f"Runtime schema is unavailable: {name}")


def _validate_document(runtime_root: Path, name: str, document: object) -> None:
    try:
        schema = json.loads(_schema_path(runtime_root, name).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunLedgerError(f"Cannot read runtime schema {name}: {error}") from error
    errors = validate_instance(document, schema)
    if errors:
        raise RunLedgerError(f"{name} validation failed: {'; '.join(errors)}")


def _validate_record_content(
    document: object, *, label: str, maximum_bytes: int
) -> None:
    serialized = json.dumps(document, sort_keys=True, ensure_ascii=False)
    if len(serialized.encode("utf-8")) > maximum_bytes:
        raise RunLedgerError(f"{label} exceeds its private record size limit.")
    if any(pattern.search(serialized) for pattern in SECRET_PATTERNS):
        raise RunLedgerError("Run record contains secret-like material; redact it first.")


def _write_new_json(path: Path, document: object) -> None:
    if path.exists() or path.is_symlink():
        raise RunLedgerError(f"Refusing to replace existing record: {path.name}")
    with path.open("x", encoding="utf-8") as handle:
        json.dump(document, handle, indent=2, sort_keys=True, ensure_ascii=False)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    path.chmod(0o600)


def _replace_json(path: Path, document: object) -> None:
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise RunLedgerError(f"Expected one regular, unlinked managed record: {path.name}")
    descriptor, temporary_name = tempfile.mkstemp(prefix=f".{path.name}.", dir=path.parent)
    temporary = Path(temporary_name)
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as handle:
            json.dump(document, handle, indent=2, sort_keys=True, ensure_ascii=False)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        temporary.chmod(0o600)
        os.replace(temporary, path)
        directory = os.open(path.parent, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists():
            temporary.unlink()


def _read_json(path: Path) -> dict[str, object]:
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise RunLedgerError(f"Expected one regular, unlinked managed record: {path.name}")
    if path.stat().st_size > MAX_STATUS_BYTES:
        raise RunLedgerError(f"Managed record exceeds its size limit: {path.name}")
    try:
        value = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunLedgerError(f"Invalid JSON record {path.name}: {error}") from error
    if not isinstance(value, dict):
        raise RunLedgerError(f"Expected an object in {path.name}.")
    return value


@contextmanager
def _run_lock(run: Path, *, exclusive: bool):
    if fcntl is None:
        raise RunLedgerError("This runtime requires advisory file locking support.")
    path = run / ".ledger.lock"
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise RunLedgerError("Run ledger lock must be one regular, unlinked file.")
    flags = os.O_RDWR
    if hasattr(os, "O_NOFOLLOW"):
        flags |= os.O_NOFOLLOW
    descriptor = os.open(path, flags)
    try:
        opened = os.fstat(descriptor)
        if not stat.S_ISREG(opened.st_mode) or opened.st_nlink != 1:
            raise RunLedgerError("Run ledger lock must remain one regular, unlinked file.")
        fcntl.flock(descriptor, fcntl.LOCK_EX if exclusive else fcntl.LOCK_SH)
        yield
    finally:
        fcntl.flock(descriptor, fcntl.LOCK_UN)
        os.close(descriptor)


def _concise(value: str, label: str) -> str:
    text = value.strip()
    if not text or len(text) > 2_000:
        raise RunLedgerError(f"A concise {label} is required.")
    return text


def _deep_copy(document: dict[str, object]) -> dict[str, object]:
    return json.loads(json.dumps(document, ensure_ascii=False))


def _git(path: Path, *arguments: str) -> str:
    try:
        result = subprocess.run(
            ["git", "-C", str(path), *arguments],
            check=False,
            capture_output=True,
            text=True,
            timeout=30,
        )
    except (OSError, subprocess.TimeoutExpired) as error:
        raise RunLedgerError("Cannot inspect the assigned Git worktree.") from error
    if result.returncode != 0:
        raise RunLedgerError("Cannot inspect the assigned Git worktree.")
    return result.stdout.strip()


def _git_common_directory(path: Path) -> Path:
    common = Path(_git(path, "rev-parse", "--git-common-dir"))
    if not common.is_absolute():
        common = path / common
    return common.resolve()


def _verify_worktree(
    runtime_root: Path,
    worktree_path: Path,
    *,
    branch: str,
    expected_head: str,
) -> Path:
    if not worktree_path.is_absolute():
        raise RunLedgerError("Assigned worktree path must be absolute.")
    if worktree_path.is_symlink() or not worktree_path.is_dir():
        raise RunLedgerError("Assigned worktree must be an existing non-symlink directory.")
    worktree = worktree_path.resolve()
    repository = _runtime_root(runtime_root).parent.resolve()
    if worktree == repository or worktree.is_relative_to(repository):
        raise RunLedgerError("Assigned worktree must be isolated from the main repository.")
    if _git_common_directory(worktree) != _git_common_directory(repository):
        raise RunLedgerError("Assigned worktree does not belong to the run repository.")
    expected_branch = branch.strip()
    if not expected_branch or _git(worktree, "branch", "--show-current") != expected_branch:
        raise RunLedgerError("Assigned worktree branch does not match the frozen assignment.")
    commit = expected_head.strip().lower()
    if COMMIT_PATTERN.fullmatch(commit) is None:
        raise RunLedgerError("Expected worktree head must be a full Git commit ID.")
    if _git(worktree, "rev-parse", "HEAD").lower() != commit:
        raise RunLedgerError("Assigned worktree HEAD does not match the frozen commit.")
    if _git(worktree, "status", "--porcelain"):
        raise RunLedgerError("Assigned worktree must be clean at the frozen commit.")
    return worktree


def _normalized_owner(value: object) -> str:
    owner = str(value).strip().replace("\\", "/")
    while owner.endswith("/**") or owner.endswith("/*"):
        owner = owner.rsplit("/", 1)[0]
    return owner.rstrip("/")


def _ownership_overlaps(left: str, right: str) -> bool:
    return left == right or left.startswith(f"{right}/") or right.startswith(f"{left}/")


def _execution_waves(units: list[dict[str, object]]) -> list[list[str]]:
    order = [str(unit["unit_id"]) for unit in units]
    dependencies = {
        str(unit["unit_id"]): set(str(value) for value in unit["depends_on"])
        for unit in units
    }
    waves: list[list[str]] = []
    resolved: set[str] = set()
    while len(resolved) < len(order):
        wave = [
            unit_id
            for unit_id in order
            if unit_id not in resolved and dependencies[unit_id].issubset(resolved)
        ]
        if not wave:
            raise RunLedgerError("Execution plan contains a dependency cycle.")
        waves.append(wave)
        resolved.update(wave)
    return waves


def _validate_execution_semantics(plan: dict[str, object]) -> list[list[str]]:
    units = plan.get("units")
    if not isinstance(units, list) or not units:
        raise RunLedgerError("Execution plan requires at least one unit.")
    identifiers: set[str] = set()
    ownership: list[tuple[str, str]] = []
    for raw in units:
        if not isinstance(raw, dict):
            raise RunLedgerError("Execution units must be objects.")
        unit_id = _safe_identifier(str(raw.get("unit_id", "")), "execution unit ID")
        if unit_id in identifiers:
            raise RunLedgerError(f"Duplicate execution unit ID: {unit_id}")
        identifiers.add(unit_id)
        risk = raw.get("risk_tier")
        role = raw.get("capability_role")
        if role == "quick_hit_worker" and risk != "R1":
            raise RunLedgerError(f"{risk} unit {unit_id} cannot use quick_hit_worker.")
        if risk == "R3" and role != "judgment_builder":
            raise RunLedgerError(f"R3 unit {unit_id} requires judgment_builder.")
        for item in raw.get("owns", []):
            normalized = _normalized_owner(item)
            if not normalized:
                raise RunLedgerError(f"Execution unit {unit_id} has empty ownership.")
            for prior_unit, prior_owner in ownership:
                if _ownership_overlaps(normalized, prior_owner):
                    raise RunLedgerError(
                        f"Execution ownership overlaps between {prior_unit} and {unit_id}."
                    )
            ownership.append((unit_id, normalized))
    for raw in units:
        unit_id = str(raw["unit_id"])
        dependencies = raw.get("depends_on")
        if not isinstance(dependencies, list) or len(set(dependencies)) != len(dependencies):
            raise RunLedgerError(f"Execution unit {unit_id} has duplicate dependencies.")
        for dependency in dependencies:
            if dependency == unit_id:
                raise RunLedgerError(f"Execution unit {unit_id} cannot depend on itself.")
            if dependency not in identifiers:
                raise RunLedgerError(
                    f"Execution unit {unit_id} depends on unknown unit {dependency}."
                )
    return _execution_waves(units)


def _load_execution(
    runtime_root: Path, run: Path
) -> tuple[dict[str, object], dict[str, object]]:
    plan = _read_json(run / "execution-plan.json")
    state = _read_json(run / "unit-state.json")
    _validate_document(runtime_root, "execution-plan.schema.json", plan)
    _validate_document(runtime_root, "execution-state.schema.json", state)
    _validate_record_content(
        plan, label="Execution plan", maximum_bytes=MAX_EXECUTION_PLAN_BYTES
    )
    _validate_record_content(
        state, label="Execution state", maximum_bytes=MAX_EXECUTION_STATE_BYTES
    )
    return plan, state


def _unit_by_id(document: dict[str, object], unit_id: str) -> dict[str, object]:
    identifier = _safe_identifier(unit_id, "execution unit ID")
    units = document.get("units")
    if not isinstance(units, list):
        raise RunLedgerError("Execution record has no unit array.")
    for unit in units:
        if isinstance(unit, dict) and unit.get("unit_id") == identifier:
            return unit
    raise RunLedgerError(f"Unknown execution unit: {identifier}")


def _append_unit_history(
    unit: dict[str, object], status: str, at: str, summary: str
) -> None:
    history = unit.get("history")
    if not isinstance(history, list) or not history:
        raise RunLedgerError("Execution unit history must not be empty.")
    if _parse_time(at, "unit transition timestamp") < _parse_time(
        history[-1].get("at"), "last unit transition timestamp"
    ):
        raise RunLedgerError("A unit transition timestamp cannot be earlier than history.")
    history.append({"status": status, "at": at, "summary": summary})
    unit["status"] = status


def create_run(
    runtime_root: Path,
    run_id: str,
    task_packet: dict[str, object],
    *,
    now: datetime | None = None,
) -> dict[str, object]:
    """Create one all-or-nothing run directory from a validated task packet."""
    root = _runtime_root(runtime_root)
    identifier = _safe_identifier(run_id)
    _validate_document(root, "task-packet.schema.json", task_packet)
    _validate_record_content(
        task_packet, label="Task packet", maximum_bytes=MAX_TASK_BYTES
    )
    status = task_packet.get("status")
    if status not in RUN_STATUSES:
        raise RunLedgerError(f"Unsupported initial run status: {status}")
    created = _utc_text(now or datetime.now(timezone.utc))
    status_record: dict[str, object] = {
        "schema_version": 1,
        "run_id": identifier,
        "task_id": task_packet["task_id"],
        "status": status,
        "created_at": created,
        "updated_at": created,
        "history": [{"status": status, "at": created, "summary": "Run record created."}],
    }
    _validate_document(root, "run-status.schema.json", status_record)
    _validate_record_content(
        status_record, label="Run status", maximum_bytes=MAX_STATUS_BYTES
    )

    runs = _runs_root(root, create=True)
    destination = runs / identifier
    if destination.exists() or destination.is_symlink():
        raise RunLedgerError(f"Orchestration run already exists: {identifier}")
    temporary = Path(tempfile.mkdtemp(prefix=f".{identifier}.", dir=runs))
    temporary.chmod(0o700)
    try:
        _write_new_json(temporary / "task.json", task_packet)
        _write_new_json(temporary / "status.json", status_record)
        model_log = temporary / "model-runs.jsonl"
        model_log.touch(mode=0o600, exist_ok=False)
        (temporary / ".ledger.lock").touch(mode=0o600, exist_ok=False)
        for name in ("reviews", "evidence", "integration"):
            (temporary / name).mkdir(mode=0o700)
        os.replace(temporary, destination)
        directory = os.open(runs, os.O_RDONLY)
        try:
            os.fsync(directory)
        finally:
            os.close(directory)
    finally:
        if temporary.exists():
            shutil.rmtree(temporary)
    return {
        "run_id": identifier,
        "task_id": task_packet["task_id"],
        "status": status,
        "run_root": str(destination),
    }


def transition_run(
    runtime_root: Path,
    run_id: str,
    status: str,
    *,
    summary: str,
    now: datetime | None = None,
) -> dict[str, object]:
    """Apply one allowed state transition while preserving the task packet."""
    run = _run_root(runtime_root, run_id)
    next_status = status.strip()
    if next_status not in RUN_STATUSES:
        raise RunLedgerError(f"Unknown run status: {next_status}")
    note = summary.strip()
    if not note or len(note) > 2_000:
        raise RunLedgerError("A concise transition summary is required.")
    with _run_lock(run, exclusive=True):
        record = _read_json(run / "status.json")
        _validate_document(
            _runtime_root(runtime_root), "run-status.schema.json", record
        )
        _validate_record_content(
            record, label="Run status", maximum_bytes=MAX_STATUS_BYTES
        )
        current = str(record.get("status"))
        if next_status not in TRANSITIONS.get(current, frozenset()):
            raise RunLedgerError(f"Invalid run transition: {current} -> {next_status}")
        changed = _utc_text(now or datetime.now(timezone.utc))
        history = record.get("history")
        if not isinstance(history, list):
            raise RunLedgerError("Run status history must be an array.")
        if history and _parse_time(changed, "transition timestamp") < _parse_time(
            history[-1].get("at"), "last transition timestamp"
        ):
            raise RunLedgerError("A transition timestamp cannot be earlier than run history.")
        history.append({"status": next_status, "at": changed, "summary": note})
        record["status"] = next_status
        record["updated_at"] = changed
        _validate_document(_runtime_root(runtime_root), "run-status.schema.json", record)
        _validate_record_content(
            record, label="Run status", maximum_bytes=MAX_STATUS_BYTES
        )
        _replace_json(run / "status.json", record)
    return record


def prepare_execution(
    runtime_root: Path,
    run_id: str,
    execution_plan: dict[str, object],
    *,
    now: datetime | None = None,
) -> dict[str, object]:
    """Freeze a role-first execution plan without creating worktrees or tasks."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    plan = _deep_copy(execution_plan)
    if "created_at" in plan or "execution_waves" in plan:
        raise RunLedgerError("Execution plan timestamps and waves are runtime-owned fields.")
    identifier = _safe_identifier(str(plan.get("plan_id", "")), "execution plan ID")
    if plan.get("orchestration_run_id") != run_id:
        raise RunLedgerError("Execution plan orchestration_run_id does not match its run.")
    task = _read_json(run / "task.json")
    if plan.get("task_id") != task.get("task_id"):
        raise RunLedgerError("Execution plan task_id does not match the task packet.")
    if task.get("status") != "ready":
        raise RunLedgerError("Execution planning requires a ready task packet.")
    created = _utc_text(now or datetime.now(timezone.utc))
    plan["plan_id"] = identifier
    plan["created_at"] = created
    plan["execution_waves"] = [["contract-validation"]]
    _validate_document(root, "execution-plan.schema.json", plan)
    plan["execution_waves"] = _validate_execution_semantics(plan)
    _validate_document(root, "execution-plan.schema.json", plan)
    _validate_record_content(
        plan, label="Execution plan", maximum_bytes=MAX_EXECUTION_PLAN_BYTES
    )
    state: dict[str, object] = {
        "schema_version": 1,
        "plan_id": identifier,
        "orchestration_run_id": run_id,
        "task_id": task["task_id"],
        "created_at": created,
        "updated_at": created,
        "units": [
            {
                "unit_id": unit["unit_id"],
                "status": "planned",
                "assignment": None,
                "head_commit": None,
                "review_count": 0,
                "last_review_verdict": None,
                "history": [
                    {
                        "status": "planned",
                        "at": created,
                        "summary": "Execution unit frozen in the plan.",
                    }
                ],
            }
            for unit in plan["units"]
        ],
    }
    _validate_document(root, "execution-state.schema.json", state)
    _validate_record_content(
        state, label="Execution state", maximum_bytes=MAX_EXECUTION_STATE_BYTES
    )
    with _run_lock(run, exclusive=True):
        _write_new_json(run / "execution-plan.json", plan)
        try:
            _write_new_json(run / "unit-state.json", state)
        except Exception:
            (run / "execution-plan.json").unlink(missing_ok=True)
            raise
    return plan


def assign_execution_unit(
    runtime_root: Path,
    run_id: str,
    unit_id: str,
    *,
    executor_task_id: str,
    executor_identity: str,
    worktree_path: Path,
    branch: str,
    base_commit: str,
    now: datetime | None = None,
) -> dict[str, object]:
    """Bind one planned unit to an externally created, verified Git worktree."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    executor_task = _safe_identifier(executor_task_id, "executor task ID")
    executor = _safe_identifier(executor_identity, "executor identity")
    expected_branch = _concise(branch, "branch name")
    changed = _utc_text(now or datetime.now(timezone.utc))
    with _run_lock(run, exclusive=True):
        plan, state = _load_execution(root, run)
        planned = _unit_by_id(plan, unit_id)
        current = _unit_by_id(state, unit_id)
        if current.get("status") != "planned":
            raise RunLedgerError("Only a planned execution unit can be assigned.")
        state_by_id = {str(item["unit_id"]): item for item in state["units"]}
        pending_dependencies = [
            dependency
            for dependency in planned["depends_on"]
            if state_by_id[str(dependency)].get("status") != "approved"
        ]
        if pending_dependencies:
            raise RunLedgerError(
                "Execution dependencies must be approved before assignment: "
                + ", ".join(str(item) for item in pending_dependencies)
            )
        worktree = _verify_worktree(
            root, worktree_path, branch=expected_branch, expected_head=base_commit
        )
        for other in state["units"]:
            assignment = other.get("assignment")
            if not isinstance(assignment, dict):
                continue
            if assignment.get("executor_task_id") == executor_task:
                raise RunLedgerError("Executor task is already assigned to another unit.")
            if assignment.get("worktree_path") == str(worktree):
                raise RunLedgerError("Worktree is already assigned to another unit.")
            if assignment.get("branch") == expected_branch:
                raise RunLedgerError("Branch is already assigned to another unit.")
        route = planned.get("route")
        if not isinstance(route, dict):
            raise RunLedgerError("Execution unit has no frozen model route.")
        current["assignment"] = {
            "executor_task_id": executor_task,
            "executor_identity": executor,
            "worktree_path": str(worktree),
            "branch": expected_branch,
            "base_commit": base_commit.lower(),
            "provider": route["provider"],
            "model": route["model"],
            "effort": route["effort"],
            "assigned_at": changed,
        }
        _append_unit_history(current, "assigned", changed, "Verified worktree assignment recorded.")
        state["updated_at"] = changed
        _validate_document(root, "execution-state.schema.json", state)
        _validate_record_content(
            state, label="Execution state", maximum_bytes=MAX_EXECUTION_STATE_BYTES
        )
        _replace_json(run / "unit-state.json", state)
    return current


def transition_execution_unit(
    runtime_root: Path,
    run_id: str,
    unit_id: str,
    status: str,
    *,
    summary: str,
    head_commit: str | None = None,
    now: datetime | None = None,
) -> dict[str, object]:
    """Apply one allowed builder-owned unit transition."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    next_status = status.strip()
    note = _concise(summary, "unit transition summary")
    changed = _utc_text(now or datetime.now(timezone.utc))
    with _run_lock(run, exclusive=True):
        _, state = _load_execution(root, run)
        current = _unit_by_id(state, unit_id)
        current_status = str(current.get("status"))
        if next_status not in UNIT_TRANSITIONS.get(current_status, frozenset()):
            raise RunLedgerError(
                f"Invalid execution unit transition: {current_status} -> {next_status}"
            )
        if next_status == "ready_for_review":
            if head_commit is None:
                raise RunLedgerError("Ready-for-review requires an exact frozen head commit.")
            assignment = current.get("assignment")
            if not isinstance(assignment, dict):
                raise RunLedgerError("Ready-for-review requires a verified assignment.")
            worktree = _verify_worktree(
                root,
                Path(str(assignment["worktree_path"])),
                branch=str(assignment["branch"]),
                expected_head=head_commit,
            )
            current["head_commit"] = _git(worktree, "rev-parse", "HEAD").lower()
        elif next_status == "running" and current_status == "review_blocked":
            current["head_commit"] = None
        elif head_commit is not None:
            raise RunLedgerError("head_commit is only valid for ready_for_review.")
        _append_unit_history(current, next_status, changed, note)
        state["updated_at"] = changed
        _validate_document(root, "execution-state.schema.json", state)
        _validate_record_content(
            state, label="Execution state", maximum_bytes=MAX_EXECUTION_STATE_BYTES
        )
        _replace_json(run / "unit-state.json", state)
    return current


def record_execution_review(
    runtime_root: Path,
    run_id: str,
    unit_id: str,
    *,
    reviewer_task_id: str,
    reviewer_identity: str,
    provider: str,
    model: str,
    effort: str | None,
    frozen_head: str,
    verdict: str,
    findings: list[str],
    summary: str,
    now: datetime | None = None,
) -> dict[str, object]:
    """Record an independent review of the exact builder head."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    reviewer_task = _safe_identifier(reviewer_task_id, "reviewer task ID")
    reviewer = _safe_identifier(reviewer_identity, "reviewer identity")
    decision = verdict.strip().upper()
    if decision not in {"PASS", "BLOCK"}:
        raise RunLedgerError("Review verdict must be PASS or BLOCK.")
    if not isinstance(findings, list) or any(
        not isinstance(item, str) or not item.strip() for item in findings
    ):
        raise RunLedgerError("Review findings must be non-empty strings.")
    if decision == "BLOCK" and not findings:
        raise RunLedgerError("A blocking review requires at least one finding.")
    note = _concise(summary, "review summary")
    reviewed_at = _utc_text(now or datetime.now(timezone.utc))
    with _run_lock(run, exclusive=True):
        plan, state = _load_execution(root, run)
        planned = _unit_by_id(plan, unit_id)
        current = _unit_by_id(state, unit_id)
        if current.get("status") != "ready_for_review":
            raise RunLedgerError("Only a ready-for-review unit can be reviewed.")
        assignment = current.get("assignment")
        if not isinstance(assignment, dict):
            raise RunLedgerError("Execution review requires a verified assignment.")
        if reviewer_task == assignment.get("executor_task_id"):
            raise RunLedgerError("Review must use an independent task, not the builder task.")
        if reviewer == assignment.get("executor_identity"):
            raise RunLedgerError("Review must use an independent reviewer identity.")
        review = planned.get("review")
        route = review.get("route") if isinstance(review, dict) else None
        if not isinstance(route, dict):
            raise RunLedgerError("Execution unit has no frozen review route.")
        observed_route = (provider.strip(), model.strip(), effort)
        expected_route = (route.get("provider"), route.get("model"), route.get("effort"))
        if observed_route != expected_route:
            raise RunLedgerError("Reviewer model route does not match the frozen plan.")
        head = frozen_head.strip().lower()
        if head != current.get("head_commit"):
            raise RunLedgerError("Review head does not match the frozen builder head.")
        _verify_worktree(
            root,
            Path(str(assignment["worktree_path"])),
            branch=str(assignment["branch"]),
            expected_head=head,
        )
        review_number = int(current.get("review_count", 0)) + 1
        if review_number > 2:
            raise RunLedgerError("Execution unit already exhausted its review attempts.")
        if decision == "PASS":
            unit_status = "approved"
        elif review_number == 1:
            unit_status = "review_blocked"
        else:
            unit_status = "escalation_required"
        review_id = _safe_identifier(
            f"REV-{unit_id}-{review_number:02d}", "execution review ID"
        )
        record: dict[str, object] = {
            "schema_version": 1,
            "review_id": review_id,
            "review_number": review_number,
            "plan_id": plan["plan_id"],
            "orchestration_run_id": run_id,
            "task_id": plan["task_id"],
            "unit_id": unit_id,
            "reviewer_task_id": reviewer_task,
            "reviewer_identity": reviewer,
            "provider": observed_route[0],
            "model": observed_route[1],
            "effort": effort,
            "frozen_head": head,
            "verdict": decision,
            "findings": [item.strip() for item in findings],
            "summary": note,
            "reviewed_at": reviewed_at,
            "unit_status": unit_status,
            "independent": True,
        }
        _validate_document(root, "execution-review.schema.json", record)
        _validate_record_content(
            record, label="Execution review", maximum_bytes=MAX_EXECUTION_REVIEW_BYTES
        )
        _write_new_json(run / "reviews" / f"{review_id}.json", record)
        current["review_count"] = review_number
        current["last_review_verdict"] = decision
        _append_unit_history(current, unit_status, reviewed_at, note)
        state["updated_at"] = reviewed_at
        _validate_document(root, "execution-state.schema.json", state)
        _validate_record_content(
            state, label="Execution state", maximum_bytes=MAX_EXECUTION_STATE_BYTES
        )
        try:
            _replace_json(run / "unit-state.json", state)
        except Exception:
            (run / "reviews" / f"{review_id}.json").unlink(missing_ok=True)
            raise
    return record


def execution_integration_plan(
    runtime_root: Path, run_id: str
) -> dict[str, object]:
    """Return exact approved heads in dependency order without integrating them."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    with _run_lock(run, exclusive=False):
        plan, state = _load_execution(root, run)
        blocked = [
            str(unit["unit_id"])
            for unit in state["units"]
            if unit.get("status") != "approved"
        ]
        if blocked:
            raise RunLedgerError(
                "Integration plan requires every unit approved; pending: "
                + ", ".join(blocked)
            )
        state_by_id = {str(unit["unit_id"]): unit for unit in state["units"]}
        order = [unit_id for wave in plan["execution_waves"] for unit_id in wave]
        commits = []
        for unit_id in order:
            head = state_by_id[unit_id].get("head_commit")
            if not isinstance(head, str) or COMMIT_PATTERN.fullmatch(head) is None:
                raise RunLedgerError(f"Approved unit {unit_id} has no exact head commit.")
            commits.append({"unit_id": unit_id, "head_commit": head})
        return {
            "schema_version": 1,
            "plan_id": plan["plan_id"],
            "orchestration_run_id": run_id,
            "task_id": plan["task_id"],
            "commits": commits,
            "integration": plan["integration"],
            "integration_performed": False,
        }


def _model_records(
    runtime_root: Path, run: Path, *, already_locked: bool = False
) -> list[dict[str, object]]:
    if not already_locked:
        with _run_lock(run, exclusive=False):
            return _model_records(runtime_root, run, already_locked=True)
    path = run / "model-runs.jsonl"
    if path.is_symlink() or not path.is_file() or path.stat().st_nlink != 1:
        raise RunLedgerError("model-runs.jsonl must be one regular, unlinked file.")
    if path.stat().st_size > MAX_MODEL_LOG_BYTES:
        raise RunLedgerError("model-runs.jsonl exceeds its private record size limit.")
    records: list[dict[str, object]] = []
    try:
        for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            if not line.strip():
                continue
            value = json.loads(line)
            if not isinstance(value, dict):
                raise RunLedgerError(f"Model record line {line_number} must be an object.")
            _validate_document(runtime_root, "model-run.schema.json", value)
            _validate_record_content(
                value, label="Model record", maximum_bytes=MAX_MODEL_RECORD_BYTES
            )
            records.append(value)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunLedgerError(f"Invalid model-run log: {error}") from error
    return records


def record_model_run(
    runtime_root: Path,
    run_id: str,
    record: dict[str, object],
) -> dict[str, object]:
    """Append one validated model invocation to its orchestration run."""
    root = _runtime_root(runtime_root)
    run = _run_root(root, run_id)
    _validate_document(root, "model-run.schema.json", record)
    _validate_record_content(
        record, label="Model record", maximum_bytes=MAX_MODEL_RECORD_BYTES
    )
    if record.get("orchestration_run_id") != run_id:
        raise RunLedgerError("Model record orchestration_run_id does not match its run directory.")
    task = _read_json(run / "task.json")
    if record.get("task_id") != task.get("task_id"):
        raise RunLedgerError("Model record task_id does not match the task packet.")
    _validate_model_semantics(record)
    model_run_id = _safe_identifier(str(record.get("run_id")), "model run ID")
    with _run_lock(run, exclusive=True):
        existing = _model_records(root, run, already_locked=True)
        if any(str(item.get("run_id")) == model_run_id for item in existing):
            raise RunLedgerError(f"Model run already exists: {model_run_id}")

        path = run / "model-runs.jsonl"
        flags = os.O_WRONLY | os.O_APPEND
        if hasattr(os, "O_NOFOLLOW"):
            flags |= os.O_NOFOLLOW
        descriptor = os.open(path, flags)
        try:
            payload = (
                json.dumps(record, sort_keys=True, ensure_ascii=False) + "\n"
            ).encode("utf-8")
            view = memoryview(payload)
            while view:
                written = os.write(descriptor, view)
                if written == 0:
                    raise RunLedgerError("Model-run append made no progress.")
                view = view[written:]
            os.fsync(descriptor)
        finally:
            os.close(descriptor)
    return {"run_id": run_id, "model_run_id": model_run_id, "status": "recorded"}


def _validate_model_semantics(record: dict[str, object]) -> None:
    started = _parse_time(record.get("started_at"), "started_at")
    finished = _parse_time(record.get("finished_at"), "finished_at")
    if finished < started:
        raise RunLedgerError("finished_at cannot be earlier than started_at.")
    if record.get("result") == "pass" and record.get("failure_category") is not None:
        raise RunLedgerError("Passing model records cannot include a failure category.")
    if record.get("result") != "pass" and record.get("failure_category") is None:
        raise RunLedgerError("Non-passing model records require a failure category.")


def _counter_summary(records: list[dict[str, object]]) -> dict[str, object]:
    results = Counter(str(item["result"]) for item in records)
    actual_costs = [
        item["actual_cost_usd"]
        for item in records
        if item.get("actual_cost_usd") is not None
    ]
    first_pass_successes = sum(
        1 for item in records if item.get("first_pass") is True and item.get("result") == "pass"
    )
    value: dict[str, object] = {
        "model_runs": len(records),
        "actual_cost_usd": round(sum(float(cost) for cost in actual_costs), 8),
        "unknown_actual_cost_runs": len(records) - len(actual_costs),
        "wall_clock_seconds": round(
            sum(float(item["wall_clock_seconds"]) for item in records), 4
        ),
        "first_pass_success_rate": (
            round(first_pass_successes / len(records), 4) if records else None
        ),
    }
    value.update(dict(sorted(results.items())))
    return value


def summarize_model_runs(runtime_root: Path) -> dict[str, object]:
    """Aggregate privacy-safe cost, reliability, role, and model statistics."""
    root = _runtime_root(runtime_root)
    candidate = root / "runs"
    if not candidate.exists() and not candidate.is_symlink():
        return {
            "orchestration_runs": 0,
            "model_runs": 0,
            "result_counts": {},
            "first_pass_success_rate": None,
            "totals": {},
            "by_model": {},
            "by_role": {},
            "by_task_class": {},
        }
    runs = _runs_root(root, create=False)
    records: list[dict[str, object]] = []
    run_count = 0
    for run in sorted(runs.iterdir()):
        if run.name.startswith("."):
            continue
        _safe_identifier(run.name)
        if run.is_symlink() or not run.is_dir():
            raise RunLedgerError(f"Unsafe entry in runs root: {run.name}")
        run_count += 1
        records.extend(_model_records(root, run))

    result_counts = Counter(str(item["result"]) for item in records)
    first_pass_successes = sum(
        1 for item in records if item.get("first_pass") is True and item.get("result") == "pass"
    )
    by_model_records: dict[str, list[dict[str, object]]] = defaultdict(list)
    by_role_records: dict[str, list[dict[str, object]]] = defaultdict(list)
    by_task_class_records: dict[str, list[dict[str, object]]] = defaultdict(list)
    for item in records:
        by_model_records[f"{item['provider']}/{item['model']}"].append(item)
        by_role_records[str(item["role"])].append(item)
        by_task_class_records[str(item["task_class"])].append(item)

    numeric_fields = (
        "input_tokens",
        "output_tokens",
        "cached_tokens",
        "estimated_cost_usd",
        "actual_cost_usd",
        "wall_clock_seconds",
    )
    totals: dict[str, object] = {}
    for field in numeric_fields:
        observed = [item[field] for item in records if item.get(field) is not None]
        totals[field] = round(sum(float(value) for value in observed), 8)
        if field.endswith("cost_usd"):
            unknown_label = field.removesuffix("_usd")
            totals[f"unknown_{unknown_label}_runs"] = len(records) - len(observed)
    for field in ("input_tokens", "output_tokens", "cached_tokens"):
        totals[field] = int(totals[field])

    return {
        "orchestration_runs": run_count,
        "model_runs": len(records),
        "result_counts": dict(sorted(result_counts.items())),
        "first_pass_success_rate": (
            round(first_pass_successes / len(records), 4) if records else None
        ),
        "totals": totals,
        "by_model": {
            key: _counter_summary(value) for key, value in sorted(by_model_records.items())
        },
        "by_role": {
            key: _counter_summary(value) for key, value in sorted(by_role_records.items())
        },
        "by_task_class": {
            key: _counter_summary(value)
            for key, value in sorted(by_task_class_records.items())
        },
    }


def _validate_execution_records(
    root: Path, run: Path, run_id: str, task_id: object
) -> None:
    plan_path = run / "execution-plan.json"
    state_path = run / "unit-state.json"
    if not plan_path.exists() and not plan_path.is_symlink() and not state_path.exists() and not state_path.is_symlink():
        return
    if not plan_path.exists() or not state_path.exists():
        raise RunLedgerError("Execution plan and unit state must either both exist or both be absent.")
    plan, state = _load_execution(root, run)
    if plan.get("orchestration_run_id") != run_id or state.get("orchestration_run_id") != run_id:
        raise RunLedgerError("Execution records reference another orchestration run.")
    if plan.get("task_id") != task_id or state.get("task_id") != task_id:
        raise RunLedgerError("Execution records reference another task.")
    if state.get("plan_id") != plan.get("plan_id"):
        raise RunLedgerError("Execution state references another plan.")
    waves = _validate_execution_semantics(plan)
    if plan.get("execution_waves") != waves:
        raise RunLedgerError("Stored execution waves do not match dependencies.")
    planned_ids = [str(item["unit_id"]) for item in plan["units"]]
    state_ids = [str(item["unit_id"]) for item in state["units"]]
    if state_ids != planned_ids:
        raise RunLedgerError("Execution state unit order does not match the plan.")
    previous_state_time: datetime | None = None
    review_counts: Counter[str] = Counter()
    review_verdicts: dict[str, str] = {}
    for path in sorted((run / "reviews").glob("REV-*.json")):
        record = _read_json(path)
        _validate_document(root, "execution-review.schema.json", record)
        _validate_record_content(
            record, label="Execution review", maximum_bytes=MAX_EXECUTION_REVIEW_BYTES
        )
        unit_id = str(record.get("unit_id"))
        if unit_id not in planned_ids:
            raise RunLedgerError("Execution review references an unknown unit.")
        if record.get("orchestration_run_id") != run_id or record.get("task_id") != task_id:
            raise RunLedgerError("Execution review references another run or task.")
        if record.get("plan_id") != plan.get("plan_id"):
            raise RunLedgerError("Execution review references another plan.")
        review_counts[unit_id] += 1
        if record.get("review_number") != review_counts[unit_id]:
            raise RunLedgerError("Execution review numbering is not contiguous.")
        review_verdicts[unit_id] = str(record.get("verdict"))
    for item in state["units"]:
        unit_id = str(item["unit_id"])
        history = item.get("history")
        if not isinstance(history, list) or not history or history[0].get("status") != "planned":
            raise RunLedgerError("Execution unit history must begin at planned.")
        prior_status: str | None = None
        prior_time: datetime | None = None
        for entry in history:
            entry_status = str(entry.get("status"))
            entry_time = _parse_time(entry.get("at"), "execution history timestamp")
            if prior_status is not None:
                allowed = UNIT_TRANSITIONS.get(prior_status, frozenset())
                assignment_transition = prior_status == "planned" and entry_status == "assigned"
                review_transition = prior_status == "ready_for_review" and entry_status in {
                    "approved", "review_blocked", "escalation_required"
                }
                if entry_status not in allowed and not assignment_transition and not review_transition:
                    raise RunLedgerError(
                        f"Invalid execution unit transition in history: {prior_status} -> {entry_status}"
                    )
            if prior_time is not None and entry_time < prior_time:
                raise RunLedgerError("Execution unit history timestamps are not monotonic.")
            prior_status = entry_status
            prior_time = entry_time
        if prior_status != item.get("status"):
            raise RunLedgerError("Execution unit status does not match its history.")
        if previous_state_time is None or (prior_time is not None and prior_time > previous_state_time):
            previous_state_time = prior_time
        if item.get("review_count") != review_counts[unit_id]:
            raise RunLedgerError("Execution state review count does not match review records.")
        expected_verdict = review_verdicts.get(unit_id)
        if item.get("last_review_verdict") != expected_verdict:
            raise RunLedgerError("Execution state last verdict does not match review records.")
    if previous_state_time is not None and _parse_time(state.get("updated_at"), "execution updated_at") != previous_state_time:
        raise RunLedgerError("Execution updated_at does not match the latest unit history.")


def validate_run(runtime_root: Path, run_id: str) -> list[str]:
    """Return deterministic structural and contract errors for one run."""
    try:
        root = _runtime_root(runtime_root)
        run = _run_root(root, run_id)
        with _run_lock(run, exclusive=False):
            task = _read_json(run / "task.json")
            status = _read_json(run / "status.json")
            _validate_document(root, "task-packet.schema.json", task)
            _validate_document(root, "run-status.schema.json", status)
            _validate_record_content(
                task, label="Task packet", maximum_bytes=MAX_TASK_BYTES
            )
            _validate_record_content(
                status, label="Run status", maximum_bytes=MAX_STATUS_BYTES
            )
            if status.get("run_id") != run_id:
                raise RunLedgerError("status.json run_id does not match its directory.")
            if status.get("task_id") != task.get("task_id"):
                raise RunLedgerError("status.json task_id does not match task.json.")
            history = status.get("history")
            if not isinstance(history, list) or not history:
                raise RunLedgerError("Run status history must not be empty.")
            if history[0].get("status") != task.get("status"):
                raise RunLedgerError("Initial run status does not match the task packet.")
            previous_status: str | None = None
            previous_time: datetime | None = None
            for entry in history:
                entry_status = str(entry.get("status"))
                entry_time = _parse_time(entry.get("at"), "status history timestamp")
                if (
                    previous_status is not None
                    and entry_status not in TRANSITIONS[previous_status]
                ):
                    raise RunLedgerError(
                        f"Invalid run transition in history: {previous_status} -> {entry_status}"
                    )
                if previous_time is not None and entry_time < previous_time:
                    raise RunLedgerError("Run status history timestamps are not monotonic.")
                previous_status = entry_status
                previous_time = entry_time
            if previous_status != status.get("status"):
                raise RunLedgerError("Current status does not match the last history entry.")
            if _parse_time(status.get("updated_at"), "updated_at") != previous_time:
                raise RunLedgerError("updated_at does not match the last history entry.")
            for directory in ("reviews", "evidence", "integration"):
                path = run / directory
                if path.is_symlink() or not path.is_dir():
                    raise RunLedgerError(f"Missing safe run directory: {directory}")
            _validate_execution_records(root, run, run_id, task.get("task_id"))
            records = _model_records(root, run, already_locked=True)
            seen: set[str] = set()
            for record in records:
                _validate_model_semantics(record)
                identifier = str(record.get("run_id"))
                if identifier in seen:
                    raise RunLedgerError(f"Duplicate model run ID: {identifier}")
                seen.add(identifier)
                if record.get("orchestration_run_id") != run_id:
                    raise RunLedgerError("A model record references another orchestration run.")
                if record.get("task_id") != task.get("task_id"):
                    raise RunLedgerError("A model record references another task.")
        return []
    except (RunLedgerError, OSError) as error:
        return [str(error)]


def _load_document(path: str) -> dict[str, object]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunLedgerError(f"Cannot load JSON document: {error}") from error
    if not isinstance(value, dict):
        raise RunLedgerError("JSON document must be an object.")
    return value


def _load_string_list(path: str) -> list[str]:
    try:
        value = json.loads(Path(path).read_text(encoding="utf-8"))
    except (OSError, UnicodeDecodeError, json.JSONDecodeError) as error:
        raise RunLedgerError(f"Cannot load JSON list: {error}") from error
    if not isinstance(value, list) or any(not isinstance(item, str) for item in value):
        raise RunLedgerError("JSON document must be an array of strings.")
    return value


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--runtime-root", default=".ai-os")
    commands = parser.add_subparsers(dest="command", required=True)
    create = commands.add_parser("create", help="Create one durable run record.")
    create.add_argument("--run-id", required=True)
    create.add_argument("--task", required=True)
    transition = commands.add_parser("transition", help="Record one allowed status transition.")
    transition.add_argument("--run-id", required=True)
    transition.add_argument("--status", choices=sorted(RUN_STATUSES), required=True)
    transition.add_argument("--summary", required=True)
    model = commands.add_parser("record-model", help="Append one validated model-run record.")
    model.add_argument("--run-id", required=True)
    model.add_argument("--document", required=True)
    prepare = commands.add_parser(
        "prepare-execution", help="Freeze a role-first execution plan."
    )
    prepare.add_argument("--run-id", required=True)
    prepare.add_argument("--document", required=True)
    assign = commands.add_parser(
        "assign-unit", help="Bind a unit to an externally created Git worktree."
    )
    assign.add_argument("--run-id", required=True)
    assign.add_argument("--unit-id", required=True)
    assign.add_argument("--executor-task-id", required=True)
    assign.add_argument("--executor-identity", required=True)
    assign.add_argument("--worktree", required=True)
    assign.add_argument("--branch", required=True)
    assign.add_argument("--base-commit", required=True)
    unit_status = commands.add_parser(
        "unit-status", help="Record one allowed execution-unit transition."
    )
    unit_status.add_argument("--run-id", required=True)
    unit_status.add_argument("--unit-id", required=True)
    unit_status.add_argument(
        "--status", choices=sorted(UNIT_TRANSITIONS), required=True
    )
    unit_status.add_argument("--summary", required=True)
    unit_status.add_argument("--head-commit")
    review = commands.add_parser(
        "record-review", help="Record an independent exact-head review."
    )
    review.add_argument("--run-id", required=True)
    review.add_argument("--unit-id", required=True)
    review.add_argument("--reviewer-task-id", required=True)
    review.add_argument("--reviewer-identity", required=True)
    review.add_argument("--provider", required=True)
    review.add_argument("--model", required=True)
    review.add_argument("--effort")
    review.add_argument("--frozen-head", required=True)
    review.add_argument("--verdict", choices=("PASS", "BLOCK"), required=True)
    review.add_argument("--findings", required=True)
    review.add_argument("--summary", required=True)
    integration = commands.add_parser(
        "integration-plan", help="Emit exact approved heads without integrating."
    )
    integration.add_argument("--run-id", required=True)
    validate = commands.add_parser("validate", help="Validate one durable run record.")
    validate.add_argument("--run-id", required=True)
    commands.add_parser("summary", help="Summarize model reliability and cost telemetry.")
    return parser


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)
    root = Path(args.runtime_root)
    try:
        if args.command == "create":
            result = create_run(root, args.run_id, _load_document(args.task))
        elif args.command == "transition":
            result = transition_run(root, args.run_id, args.status, summary=args.summary)
        elif args.command == "record-model":
            result = record_model_run(root, args.run_id, _load_document(args.document))
        elif args.command == "prepare-execution":
            result = prepare_execution(root, args.run_id, _load_document(args.document))
        elif args.command == "assign-unit":
            result = assign_execution_unit(
                root,
                args.run_id,
                args.unit_id,
                executor_task_id=args.executor_task_id,
                executor_identity=args.executor_identity,
                worktree_path=Path(args.worktree),
                branch=args.branch,
                base_commit=args.base_commit,
            )
        elif args.command == "unit-status":
            result = transition_execution_unit(
                root,
                args.run_id,
                args.unit_id,
                args.status,
                summary=args.summary,
                head_commit=args.head_commit,
            )
        elif args.command == "record-review":
            result = record_execution_review(
                root,
                args.run_id,
                args.unit_id,
                reviewer_task_id=args.reviewer_task_id,
                reviewer_identity=args.reviewer_identity,
                provider=args.provider,
                model=args.model,
                effort=args.effort,
                frozen_head=args.frozen_head,
                verdict=args.verdict,
                findings=_load_string_list(args.findings),
                summary=args.summary,
            )
        elif args.command == "integration-plan":
            result = execution_integration_plan(root, args.run_id)
        elif args.command == "validate":
            errors = validate_run(root, args.run_id)
            result = {"run_id": args.run_id, "valid": not errors, "errors": errors}
            print(json.dumps(result, indent=2, sort_keys=True))
            return 0 if not errors else 1
        else:
            result = summarize_model_runs(root)
        print(json.dumps(result, indent=2, sort_keys=True))
        return 0
    except (RunLedgerError, OSError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
