# API and MCP Integration Record

## Identity and outcome

- Integration and owner:
- User/system outcome:
- Producer, consumer, contract owner, and authoritative system:
- Direct library / IPC / file / database / HTTP / event / stream / peer-to-peer / MCP / other:
- Why this boundary and mechanism:
- Version/revision and review date:

## Contract

- Operations/resources/events/tools and stable identifiers:
- Schemas, units, bounds, null/default/unknown-field behavior:
- Preconditions, invariants, transaction/consistency boundary:
- Idempotency/deduplication and unknown-outcome recovery:
- Ordering, pagination/streaming, backpressure, deadlines, cancellation, retries, and quotas:
- Cache/freshness, retention/deletion, reconciliation, export, and dependency exit:
- Compatibility, negotiation, deprecation, mixed-version, migration, and rollback:

## Trust, identity, and data

- Data classes and minimum data exchanged:
- Authentication, authorization, tenant/account, scopes, consent, and revocation:
- Credential location, rotation, and non-client exposure evidence:
- Network/process/device trust boundaries and allowed destinations:
- Provider retention, training, subprocessors, residency, logging, and deletion:
- Input/output validation, redaction, audit identity, and abuse controls:

## MCP-specific fields, if applicable

- Host, client, server, transport, endpoint/executable, and package provenance:
- Capabilities negotiated; tools/resources/prompts actually enabled:
- Read/write/external effects and approval/commit boundaries:
- Prompt-injection, confused-deputy, server-substitution, redirect, and supply-chain controls:
- Sandbox/allowlist, cancellation, rate/cost budget, kill switch, and fallback:

## Reliability and evidence

| Scenario | Expected result | Automated/contract evidence | Real integration/device evidence | Recovery/owner |
|---|---|---|---|---|
| Valid request/operation | | | | |
| Invalid or unauthorized input | | | | |
| Timeout/cancel/retry/duplicate | | | | |
| Partial or out-of-order result | | | | |
| Version mismatch | | | | |
| Dependency unavailable/changed | | | | |
| Quota/cost ceiling | | | | |

- Monitoring/support evidence without sensitive payloads:
- Known limitations and accepted risks:
- Disable, rollback, or alternate path:
- Next current-documentation and interoperability review trigger:
