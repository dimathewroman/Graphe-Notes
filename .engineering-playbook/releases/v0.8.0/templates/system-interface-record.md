# System Block and Interface Record

## Identity

- Project/product:
- Hardware revision:
- Software/firmware revisions:
- Owner:
- Date/status:
- Related architecture, requirements, ADRs, hazards, and evidence:

## User-visible promise

- Intended behavior:
- Supported users, environments, and lifetime:
- Explicit non-goals:
- Unacceptable failures and required safe state:

## System block diagram

Attach or link a diagram showing:

- Compute, storage, power, sensors, actuators, radios, user interfaces, external systems, and physical energy flows.
- Trust, safety, real-time, update, calibration, and service boundaries.
- The component that owns each decision and the independent protection for consequential failures.

## Component inventory

| Component | Purpose | Inputs/outputs | Power/clock | Software/firmware | Failure or degraded behavior | Owner |
|---|---|---|---|---|---|---|
| | | | | | | |

## Interface contract

Complete one row per electrical, mechanical, wired, wireless, storage, software, or human interface.

| Interface | Endpoints/owner | Physical and protocol spec/revision | Units/frames/timebase | Rate/latency/bounds | Startup/reset/error behavior | Security/privacy | Compatibility evidence |
|---|---|---|---|---|---|---|---|
| | | | | | | | |

For software, API, agent-tool, event, or MCP boundaries, also link an [API and MCP Integration Record](api-mcp-integration-record.md) and define idempotency, deadlines/cancellation, retry budget, backpressure, capability negotiation, credential scope, compatibility, reconciliation, and disable/fallback behavior.

## Lifecycle behavior

- Power-on and initialization order:
- Normal shutdown and power loss:
- Disconnect/reconnect and hot-plug:
- Sleep/resume and low-power states:
- Update, version negotiation, rollback, and recovery:
- Calibration and recalibration:
- Manufacturing, service, repair, and end-of-life access:

## Open assumptions and decisions

| Claim or decision | Verified fact, interpretation, or assumption | Evidence/source/date | Consequence if false | Owner and validation trigger |
|---|---|---|---|---|
| | | | | |

## Acceptance evidence

- Automated/simulated:
- Instrumented bench:
- Representative physical environment:
- Interoperability:
- Known limitations and owner decisions:
