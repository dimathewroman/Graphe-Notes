# Production Readiness Review: RELEASE OR SERVICE

Use proportionally for a private daily driver, external beta, production service, or consequential release.

## Identity and ownership

- Release/service, version, commit, and artifact checksum:
- Target environment/channel and rollout cohort:
- Product owner:
- Release operator:
- Support/incident owner:
- Monitoring window:
- Operating mode and risk tier:

## Approved scope

- User-visible outcome:
- Included and excluded changes:
- Authoritative issue/specification/ADR:
- Required owner decisions and evidence of approval:
- Known limitations and affected users:

## Readiness summary

| Area | Required evidence | Status: Green/Yellow/Red/NA | Evidence/limitation owner |
|---|---|---|---|
| Correctness and journeys | | | |
| Security, privacy, and secrets | | | |
| Accessibility and UX | | | |
| Performance and capacity | | | |
| Compatibility and migration | | | |
| Backup, restore, and reconciliation | | | |
| Supply chain, signing, provenance | | | |
| Observability and support | | | |
| Cost, quota, and dependencies | | | |

## Environment and data change

- Intended versus effective configuration:
- Credentials/certificates/entitlements and expiry:
- External dependencies and current limits/status:
- Schema/data change sequence:
- Mixed-version behavior:
- Backup and clean-target restore evidence:
- Recovery time objective (RTO) and recovery point objective (RPO):
- Last bounded recovery exercise, actual versus target result, and unresolved gaps:
- Restoration order, failback evidence, and recovery credentials/keys available if the primary environment or account is lost:

## Rollout control

- Strategy and stages:
- Same-artifact promotion or rebuild relationship:
- Preflight and post-deploy smoke checks:
- Promote criteria:
- Hold/stop criteria:
- Rollback or roll-forward steps and authority:
- Feature flags, default state, owner, and removal trigger:

## Operations

- User-centered indicators and targets:
- Alerts and linked runbooks:
- Privacy/telemetry approval and scrubber evidence:
- Support intake, known issues, and communication path:
- Capacity headroom and degraded mode:
- Incident and escalation route:

## Decision

- Recommendation: release / canary only / hold / owner acceptance needed
- Residual risk in plain language:
- Owner decision and conditions:
- Post-release review date and evidence owner:
