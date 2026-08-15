# CI Change Classification Plan: REPOSITORY

## Objectives

- Required feedback budget by change class:
- Integration/release evidence that must never disappear:
- Current expensive or duplicated work:
- Baseline duration, queue, flake, cache, and cost evidence:

## Classification table

| Class | Included paths/semantics | Exclusions/overrides | Jobs | Timeout | Required evidence | Fail-closed behavior |
|---|---|---|---|---|---|---|
| Governance/docs | | | | | | |
| Tests/tooling | | | | | | |
| Product source | | | | | | |
| Dependency/build/protocol | | | | | | |
| Release/deployment | | | | | | |

## Classifier contract

- Always-running check name:
- Base/head resolution:
- Outputs and human-readable reason:
- Rename/delete/empty/unknown handling:
- Workflow/classifier self-change handling:
- Manual/full-CI escalation:
- Table-driven fixtures and negative controls:

## Job topology

| Job | Runner | Needs | Condition/output | Cache/artifact | Token permissions/secrets | Concurrency/timeout |
|---|---|---|---|---|---|---|
| | | | | | | |

## Security and release

- Untrusted PR boundary:
- Third-party action pins/review:
- Cache/artifact trust boundary:
- Protected environments and OIDC/secrets:
- Signing, provenance, checksum, promotion, and rollback:

## Acceptance

- Governance-only fixture proves no application compile/package/device job:
- Mixed/source/dependency fixtures prove required heavy jobs run:
- Unknown and classifier/workflow changes fail closed:
- Integration branch runs combined gate:
- Release candidate runs artifact/device/recovery gate:
- Required-check behavior verified in repository settings:
- Measured duration and cost after rollout:
