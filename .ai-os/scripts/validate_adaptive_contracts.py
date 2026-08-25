#!/usr/bin/env python3
"""Validate one linked PAIOS adaptive-contract bundle."""

from __future__ import annotations

import hashlib
import importlib.util
import json
from pathlib import Path
import sys

_VALIDATOR_SPEC = importlib.util.spec_from_file_location(
    "paios_validate_contract",
    Path(__file__).with_name("validate_contract.py"),
)
if _VALIDATOR_SPEC is None or _VALIDATOR_SPEC.loader is None:
    raise RuntimeError("could not load validate_contract.py")
_VALIDATOR = importlib.util.module_from_spec(_VALIDATOR_SPEC)
_VALIDATOR_SPEC.loader.exec_module(_VALIDATOR)
validate_instance = _VALIDATOR.validate_instance


DOCUMENTS = (
    ("task_packet", "task-packet.schema.json"),
    ("authorization", "repository-authorization-envelope-v1.schema.json"),
    ("task_contract", "task-contract-v2.schema.json"),
    ("caller_context", "caller-context-v1.schema.json"),
    ("effective_policy", "effective-policy-receipt-v1.schema.json"),
)
BUNDLE_DOCUMENT_NAMES = tuple(name for name, _ in DOCUMENTS) + (
    "execution_review",
    "review_dispositions",
)


def canonical_digest(document: object) -> str:
    payload = json.dumps(
        document,
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def receipt_digest(receipt: dict[str, object]) -> str:
    content = dict(receipt)
    content.pop("receipt_digest", None)
    return canonical_digest(content)


def validate_review_links(
    execution_review: dict[str, object],
    dispositions: list[dict[str, object]],
) -> list[str]:
    errors: list[str] = []
    review_id = execution_review.get("review_id")
    review_digest = canonical_digest(execution_review)
    findings = execution_review.get("findings")
    if not isinstance(findings, list):
        return ["ExecutionReviewV1 findings must be an array"]

    seen: set[int] = set()
    aggregate_verdicts: set[object] = set()
    must_block = False
    for disposition in dispositions:
        if (
            disposition.get("execution_review_v1_id") != review_id
            or disposition.get("execution_review_v1_digest") != review_digest
        ):
            errors.append("review disposition does not link the exact ExecutionReviewV1")
        index = disposition.get("finding_index")
        if not isinstance(index, int) or isinstance(index, bool) or not 0 <= index < len(findings):
            errors.append(f"review disposition has invalid finding index {index!r}")
            continue
        if index in seen:
            errors.append(f"review dispositions duplicate v1 finding index {index}")
            continue
        seen.add(index)
        expected_finding_digest = canonical_digest(findings[index])
        if disposition.get("finding_digest") != expected_finding_digest:
            errors.append(f"review disposition does not link exact v1 finding index {index}")
        if disposition.get("finding_id") != f"sha256:{expected_finding_digest}":
            errors.append(
                f"review disposition finding_id does not identify v1 finding index {index}"
            )
        aggregate_verdicts.add(disposition.get("aggregate_verdict"))
        if disposition.get("release_impact") in {
            "blocking",
            "unknown",
        } or disposition.get("severity") in {"P1", "unclassified"}:
            must_block = True

    missing = sorted(set(range(len(findings))) - seen)
    if missing:
        errors.append(f"review dispositions omit v1 finding indices {missing}")
    if len(aggregate_verdicts) > 1:
        errors.append("review dispositions contain inconsistent aggregate verdicts")
    elif aggregate_verdicts and aggregate_verdicts != {execution_review.get("verdict")}:
        errors.append("review disposition aggregate does not match ExecutionReviewV1 verdict")
    elif not findings and execution_review.get("verdict") != "PASS":
        errors.append("ExecutionReviewV1 without findings must have PASS verdict")
    if must_block and aggregate_verdicts != {"BLOCK"}:
        errors.append("blocking or unclassified review dispositions require aggregate BLOCK")
    return errors


def validate_scoped_permissions(
    authorization: dict[str, object],
    effective_policy: dict[str, object],
) -> list[str]:
    """Reject any resolved repository, read, or Git scope not in the envelope."""
    errors: list[str] = []
    repository = authorization.get("repository")
    repository_scope = effective_policy.get("repository_scope")
    if not isinstance(repository, dict) or not isinstance(repository_scope, dict):
        return ["effective policy is missing exact repository scope"]

    if repository_scope.get("repository_id") != repository.get("repository_id"):
        errors.append("effective policy repository_id does not match the authorization envelope")
    authorized_roots = repository.get("allowed_worktree_roots")
    resolved_roots = repository_scope.get("worktree_roots")
    if (
        not isinstance(authorized_roots, list)
        or not isinstance(resolved_roots, list)
        or not set(resolved_roots).issubset(set(authorized_roots))
    ):
        errors.append("effective policy expands authorized worktree roots")

    authorized_grants = authorization.get("read_grants")
    resolved_grants = effective_policy.get("resolved_read_grants")
    if not isinstance(authorized_grants, list) or not isinstance(resolved_grants, list):
        errors.append("effective policy is missing exact resolved read grants")
    else:
        allowed_grants = {
            (grant.get("grant_id"), grant.get("resource"))
            for grant in authorized_grants
            if isinstance(grant, dict)
        }
        requested_grants = {
            (grant.get("grant_id"), grant.get("resource"))
            for grant in resolved_grants
            if isinstance(grant, dict)
        }
        if len(requested_grants) != len(resolved_grants) or not requested_grants.issubset(
            allowed_grants
        ):
            errors.append("effective policy expands named read grants")

    authorized_git = authorization.get("git_permissions")
    resolved_git = effective_policy.get("git_permissions")
    if not isinstance(authorized_git, dict) or not isinstance(resolved_git, dict):
        errors.append("effective policy is missing exact Git permissions")
        return errors
    authorized_endpoints = authorized_git.get("endpoints")
    resolved_endpoints = resolved_git.get("endpoints")
    authorized_operations = authorized_git.get("operations")
    resolved_operations = resolved_git.get("operations")
    if (
        not isinstance(authorized_endpoints, list)
        or not isinstance(resolved_endpoints, list)
        or not set(resolved_endpoints).issubset(set(authorized_endpoints))
    ):
        errors.append("effective policy expands authorized Git endpoints")
    if (
        not isinstance(authorized_operations, list)
        or not isinstance(resolved_operations, list)
        or not set(resolved_operations).issubset(set(authorized_operations))
    ):
        errors.append("effective policy expands authorized Git operations")

    external_operations = {
        "push_branch", "create_draft_pr", "update_issue", "merge", "tag_release"
    }
    allowed_effects = effective_policy.get("allowed_effects")
    if (
        isinstance(allowed_effects, list)
        and "external_write" in allowed_effects
        and (
            not isinstance(resolved_endpoints, list)
            or not resolved_endpoints
            or not isinstance(resolved_operations, list)
            or not set(resolved_operations) & external_operations
        )
    ):
        errors.append("external_write requires an authorized Git endpoint and operation")
    return errors


def validate_links(
    task_packet: dict[str, object],
    authorization: dict[str, object],
    task_contract: dict[str, object],
    caller_context: dict[str, object],
    effective_policy: dict[str, object],
) -> list[str]:
    errors: list[str] = []
    task_id = task_packet.get("task_id")
    task_digest = canonical_digest(task_packet)
    if authorization.get("task_packet_v1_id") != task_id:
        errors.append("authorization task_packet_v1_id does not match the linked TaskPacketV1")
    if authorization.get("task_packet_v1_digest") != task_digest:
        errors.append("authorization task_packet_v1_digest does not match the linked TaskPacketV1")

    task_link = task_contract.get("task_packet_v1")
    if (
        not isinstance(task_link, dict)
        or task_link.get("task_id") != task_id
        or task_link.get("digest") != task_digest
    ):
        errors.append("TaskContractV2 does not link the exact TaskPacketV1")

    authorization_link = task_contract.get("authorization_envelope_v1")
    if (
        not isinstance(authorization_link, dict)
        or authorization_link.get("envelope_id") != authorization.get("envelope_id")
        or authorization_link.get("digest") != canonical_digest(authorization)
    ):
        errors.append("TaskContractV2 does not link the exact authorization envelope")

    issuer = authorization.get("issuer")
    if not isinstance(issuer, dict):
        issuer = {}
    if (
        caller_context.get("authorization_grant_id") != issuer.get("authorization_grant_id")
        or caller_context.get("authorization_grant_digest") != issuer.get("authorization_grant_digest")
    ):
        errors.append("CallerContext does not use the authorization envelope's exact grant")
    if caller_context.get("principal_id") != issuer.get("principal_id"):
        errors.append("CallerContext principal does not match the authorization issuer")
    if (
        caller_context.get("task_contract_id") != task_contract.get("contract_id")
        or caller_context.get("task_contract_digest") != canonical_digest(task_contract)
    ):
        errors.append("CallerContext does not link the exact TaskContractV2")

    policy_task = effective_policy.get("task_contract")
    if (
        not isinstance(policy_task, dict)
        or policy_task.get("identity") != task_contract.get("contract_id")
        or policy_task.get("digest") != canonical_digest(task_contract)
    ):
        errors.append("effective policy does not link the exact TaskContractV2")
    policy_caller = effective_policy.get("caller_context")
    if (
        not isinstance(policy_caller, dict)
        or policy_caller.get("identity") != caller_context.get("operation_id")
        or policy_caller.get("digest") != canonical_digest(caller_context)
    ):
        errors.append("effective policy does not link the exact CallerContext")
    expected_receipt_digest = effective_policy.get("receipt_digest")
    if (
        isinstance(expected_receipt_digest, str)
        and expected_receipt_digest != receipt_digest(effective_policy)
    ):
        errors.append("effective policy receipt_digest does not match its canonical content")

    allowed = effective_policy.get("allowed_effects")
    prohibited = effective_policy.get("prohibited_effects")
    if (
        isinstance(allowed, list)
        and isinstance(prohibited, list)
        and set(allowed) & set(prohibited)
    ):
        errors.append("effective policy allows and prohibits the same effect")
    authorized_effects = authorization.get("allowed_effects")
    authorization_prohibitions = authorization.get("prohibited_effects")
    if (
        isinstance(authorized_effects, list)
        and isinstance(authorization_prohibitions, list)
        and set(authorized_effects) & set(authorization_prohibitions)
    ):
        errors.append("authorization envelope both allows and prohibits the same effect")
    if (
        isinstance(allowed, list)
        and isinstance(authorized_effects, list)
        and not set(allowed).issubset(set(authorized_effects))
    ):
        errors.append("effective policy expands the authorization envelope's allowed effects")
    if (
        isinstance(allowed, list)
        and isinstance(authorization_prohibitions, list)
        and set(allowed) & set(authorization_prohibitions)
    ):
        errors.append("effective policy allows an effect prohibited by the authorization envelope")
    if "repository" in authorization or "repository_scope" in effective_policy:
        errors.extend(validate_scoped_permissions(authorization, effective_policy))
    return errors


def validate_bundle(runtime_root: Path, documents: dict[str, dict[str, object]]) -> list[str]:
    errors: list[str] = []
    for name, schema_name in DOCUMENTS:
        document = documents[name]
        schema = json.loads((runtime_root / "schemas" / schema_name).read_text(encoding="utf-8"))
        errors.extend(validate_instance(document, schema, f"$.{name}"))
    execution_review = documents["execution_review"]
    review_dispositions = documents["review_dispositions"]
    review_schema = json.loads(
        (runtime_root / "schemas" / "execution-review.schema.json").read_text(encoding="utf-8")
    )
    disposition_schema = json.loads(
        (runtime_root / "schemas" / "review-disposition-v2.schema.json").read_text(encoding="utf-8")
    )
    errors.extend(validate_instance(execution_review, review_schema, "$.execution_review"))
    if not isinstance(review_dispositions, list):
        errors.append("$.review_dispositions: expected type ['array'], observed non-array")
    else:
        for index, disposition in enumerate(review_dispositions):
            errors.extend(
                validate_instance(
                    disposition,
                    disposition_schema,
                    f"$.review_dispositions[{index}]",
                )
            )
    if errors:
        return errors
    link_errors = validate_links(
        documents["task_packet"],
        documents["authorization"],
        documents["task_contract"],
        documents["caller_context"],
        documents["effective_policy"],
    )
    link_errors.extend(validate_review_links(execution_review, review_dispositions))
    return link_errors


def main(argv: list[str] | None = None) -> int:
    arguments = argv if argv is not None else sys.argv[1:]
    if len(arguments) != 8:
        print(
            "Usage: validate_adaptive_contracts.py RUNTIME_ROOT TASK.json "
            "AUTH.json CONTRACT.json CALLER.json POLICY.json REVIEW.json "
            "REVIEW_DISPOSITIONS.json",
            file=sys.stderr,
        )
        return 2
    runtime_root = Path(arguments[0])
    try:
        documents: dict[str, object] = {
            name: json.loads(Path(path).read_text(encoding="utf-8"))
            for (name, _), path in zip(DOCUMENTS, arguments[1:6], strict=True)
        }
        documents["execution_review"] = json.loads(Path(arguments[6]).read_text(encoding="utf-8"))
        documents["review_dispositions"] = json.loads(Path(arguments[7]).read_text(encoding="utf-8"))
        errors = validate_bundle(runtime_root, documents)
    except (OSError, UnicodeDecodeError, json.JSONDecodeError, KeyError, TypeError) as error:
        print(f"ERROR: {error}", file=sys.stderr)
        return 2
    if errors:
        for error in errors:
            print(f"ERROR: {error}", file=sys.stderr)
        return 1
    print("Personal AI OS adaptive contract bundle validation passed.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
