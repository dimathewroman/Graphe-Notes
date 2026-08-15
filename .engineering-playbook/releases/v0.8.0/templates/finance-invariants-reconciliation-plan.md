# Finance Invariants and Reconciliation Plan

Use for a feature or system that represents, imports, calculates, advises on, or moves money. Do not include real account data, credentials, tokens, transactions, or customer information.

## Scope and authority

- Project / feature:
- Owner:
- Operating mode and risk tier:
- Authoritative product and architecture documents:
- Systems, providers, account types or product categories, currencies, and jurisdictions in scope—never identifiers, names, balances, or transactions:
- Explicit exclusions:
- Related issues, ADRs, threat model, and data-flow diagram:

## Facts, interpretation, and review

### Verified facts

- Observed product behavior:
- Current provider or contract facts:
- Primary sources and dates:
- Test evidence:

### Interpretation and uncertainty

- Engineering interpretations:
- Compliance or legal review triggers:
- Professional advice received, reviewer, scope, and date:
- Unanswered questions and consequence if wrong:
- Runtime/platform-enforced boundaries, if any:
- Owner decisions, conditions, expiration, and revisit trigger:

## Financial truth

- Unit of account and supported currencies:
- Numeric representation and precision:
- Rounding and allocation rules:
- Timezone, effective-date, posting-date, and statement-boundary rules:
- Authoritative balance and transaction sources:
- Distinction among source event, normalized record, ledger entry, classification, forecast, and display:
- AI role and deterministic/user-confirmed boundary:

## Invariants

Write each invariant as a falsifiable statement.

| ID | Invariant | Why it matters | Enforcement point | Test / evidence | Failure response |
|---|---|---|---|---|---|
| FIN-01 | | | | | |

Consider conservation/balancing, uniqueness, ordering, state transitions, reversal, currency, rounding, authorization, provenance, immutability, freshness, and user-visible explanation.

## State and correction model

- Valid states and transitions:
- Finality and authoritative acknowledgement:
- Pending-to-posted matching:
- Reversal, refund, dispute, chargeback, and correction behavior:
- User edit and undo behavior:
- Migration and historical-rule behavior:
- Invalid or ambiguous state presentation:

## Idempotency and provenance

- Stable operation/event identifiers:
- Idempotency scope and retention:
- Duplicate, retry, replay, and out-of-order handling:
- Actor, source, timestamp, reason, and rule/model-version evidence retained:
- Audit record integrity and access:

## Reconciliation contract

| Source pair / assertion | Cadence or trigger | Comparison rule and tolerance | Conflict authority | User-visible state | Owner and response target |
|---|---|---|---|---|---|
| | | | | | |

- Cursor/checkpoint and gap-detection strategy:
- Late, missing, partial, corrected, and provider-deleted data behavior:
- Rebuild-from-source procedure:
- Discrepancy queue, escalation, and closure evidence:
- Freshness and degraded-mode promise:

## Verification matrix

| Scenario | Expected invariant/state | Automated evidence | Sandbox/integration evidence | Failure/recovery evidence |
|---|---|---|---|---|
| Golden happy path | | | | |
| Duplicate/replay | | | | |
| Missing or delayed event | | | | |
| Reordered events | | | | |
| Partial application/interruption | | | | |
| Reversal/correction/dispute | | | | |
| Rounding/currency/time boundary | | | | |
| Migration/rollback/restore | | | | |
| Provider revocation/outage | | | | |

## Data, security, and operations

- Data classification, minimization, retention, export, and deletion:
- Secret and key locations without secret values:
- Authorization and separation of duties:
- Telemetry allowlist and kill switch:
- Backup, restore, and reconciliation-after-restore evidence:
- Provider revocation, incident containment, and credential rotation:
- Rollout cohort, transaction/exposure cap, stop condition, and rollback:
- Production indicators, thresholds, and response owner:

## Release decision

- Invariants verified:
- Known discrepancies or limitations:
- Compliance review status and date:
- Residual risk and recommendation:
- Owner decision and conditions:
- Next review date / trigger:
