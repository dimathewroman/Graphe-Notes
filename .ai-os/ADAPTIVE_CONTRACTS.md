# Adaptive Contract Bundle

This repository runtime contains the first executable contract slice from the
approved adaptive-runtime specification. The canonical PAIOS package contains
a source-only in-memory `TaskCoordinator` conformance slice, but this distributed
repository runtime remains the v1 recorder and does not ship the coordinator,
Mac Operations service, provider dispatch, telemetry capture, installation, or
activation.

## Compatibility

`schemas/task-packet.schema.json` remains the byte-identical `TaskPacketV1`.
`schemas/execution-review.schema.json` remains the byte-identical
`ExecutionReviewV1`. New ledger review records use additive
`execution-review-v2.schema.json`, which snapshots the dispatch's expected,
requested, runtime-accepted, and observed-or-unexposed route evidence instead
of treating caller-supplied route values as execution facts. New records link
their exact canonical JSON SHA-256 values:

1. `repository-authorization-envelope-v1.schema.json`
2. `task-contract-v2.schema.json`
3. `caller-context-v1.schema.json`
4. `effective-policy-receipt-v1.schema.json`
5. `review-disposition-v2.schema.json`

`dispatch-receipt-v1.schema.json` and `cleanup-receipt-v1.schema.json` are
additive recorder contracts. They do not revise immutable execution-plan or
review bytes. A dispatch receipt distinguishes a frozen expected route, a
runtime-accepted requested route, and an observed or explicitly unexposed
actual route. A cleanup receipt requires accepted review/integration and final
handoff evidence before archival, the exact archived builder/reviewer task IDs,
a removed worktree, a recoverable ref for the approved head, and separate
time-stamped/evidence-linked Git worktree and Codex open-task inventories. A
current coordinator task may remain open only when the Codex inventory names it
and explicitly marks that exception intentional.

Canonical JSON uses UTF-8, sorted keys, no insignificant whitespace, and no
ASCII escaping. A receipt's self-digest hashes that canonical object with its
`receipt_digest` field omitted. The bundle validator rejects task/grant/principal mismatches,
effect expansion, repository/worktree/read-grant/Git scope expansion,
unscoped external writes, contradictory allowed/prohibited effects, and broken
linked digests.

## Validation

```bash
python3 scripts/validate_contract.py schemas/task-contract-v2.schema.json CONTRACT.json

python3 scripts/validate_adaptive_contracts.py \
  . TASK_PACKET_V1.json AUTHORIZATION_V1.json TASK_CONTRACT_V2.json \
  CALLER_CONTEXT_V1.json EFFECTIVE_POLICY_V1.json EXECUTION_REVIEW_V1.json \
  REVIEW_DISPOSITIONS_V2.json
```

`REVIEW_DISPOSITIONS_V2.json` is an array containing exactly one linked
disposition for every indexed string in the immutable v1 review's `findings`.
Each `finding_id` is the exact `sha256:<finding_digest>` identity derived from
that string's canonical JSON. Unclassified legacy findings remain blocking.

Schema validity is necessary but not sufficient. Authentication methods,
proof verification, revocation lookup, expiry/replay enforcement, receipt
signing, and durable operation processing belong to later authorized slices.
