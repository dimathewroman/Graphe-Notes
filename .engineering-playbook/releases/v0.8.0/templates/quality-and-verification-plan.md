# Quality and Verification Plan: TITLE

Use one plan for the change or release. Keep only applicable rows; link existing evidence instead of copying it.

## Scope and authority

- Product/change:
- Owner and implementation lead:
- Acceptance-oracle owner:
- Independent reviewer for R3/consequential work, or recorded independence limitation:
- Authoritative specification and acceptance criteria:
- Operating mode and risk tier:
- Supported environments:
- Explicit exclusions:
- Owner decisions or standing authorization:
- Semantic change class and classifier evidence:
- Pull-request gate selected, expected feedback budget, and full integration/release fallback:

## Baseline

- Verified current behavior:
- Known pre-existing failures:
- Test-harness limitations:
- Negative control, known-bad case, mutation, or differential evidence used to validate the harness:
- Important assumptions and uncertainty:

## Verification matrix

| Promise or acceptance criterion | Failure mode and harm | Prevention/detection | Automated check | Live/device/browser check | Evidence location | Result/owner |
|---|---|---|---|---|---|---|
| | | | | | | |

## Test conditions

- Data and fixture source:
- Build/configuration:
- Devices, OS versions, browsers, or services:
- Window sizes and breakpoint boundaries, orientation, fold/posture, display/multi-window mode, density/insets, and input methods:
- Stateful transition and restoration journeys, including combined transitions:
- Locale, timezone, theme, text scale, accessibility settings:
- Network, storage, clock, permission, and process conditions:
- API/IPC/event/MCP versions, auth scopes, quotas, deadlines, retries, duplicates, ordering, backpressure, provider outage, and disable/fallback behavior:
- Collection size, ingest/index lag, lexical/vector retrieval quality, freshness/delete propagation, rebuild, and low-memory/storage conditions:
- Random seed or reproducibility controls:
- Private-data authorization and cleanup, if any:

## Non-functional budgets

| Journey/service promise | Metric and boundary | Target | Baseline | Stop/regression threshold | Evidence |
|---|---|---:|---:|---:|---|
| | | | | | |

## Execution order

1. Cheap deterministic checks:
2. Integration/contract/migration checks:
3. UI/system/device/browser journeys:
4. Accessibility and visual evidence:
5. Performance, capacity, compatibility, and recovery checks:
6. Combined release gate:

For change-aware CI, also record the always-running classifier/summary check, jobs intentionally skipped with reasons, manual/full-test override, and conservative fallback when classification is unknown or the classifier changes.

## Results

- Verified passes:
- Product regressions:
- Pre-existing failures:
- Test/harness failures or flakes:
- Unverified conditions:
- Artifacts retained and privacy review:
- Rollback/kill/recovery evidence:

## Decision

- Recommendation: proceed / proceed with recorded limitation / stop / owner decision needed
- Owner-visible effect and residual risk:
- Exact follow-up, owner, and trigger/date:
