# Finance Engineering and Compliance Review Guide

Use this guide when a product represents money, imports financial data, initiates transactions, makes credit or investment decisions, or describes financial protection. Pair it with the project's threat model, data-flow diagram, engineering profile, and the [finance invariants and reconciliation plan](../templates/finance-invariants-reconciliation-plan.md).

This is an engineering and issue-spotting guide, not a legal conclusion or certification. Laws, regulator positions, partner contracts, product behavior, and jurisdictions change. A review trigger means: identify the current facts, obtain qualified review when warranted, present options and consequences to the owner, and record the owner's decision. It is not an agent-created execution restriction. A control enforced by the current runtime, provider, regulator, or platform must be reported separately and precisely.

## Keep four kinds of statements separate

- **Verified fact:** directly observed product behavior, contract language, test evidence, or a dated primary source.
- **Engineering recommendation:** a control adopted to improve correctness, security, recovery, or auditability.
- **Review trigger:** product behavior that may create a regulatory, contractual, tax, accounting, or licensing question.
- **Uncertainty:** a fact or interpretation still requiring investigation, counsel, a regulator, a partner, or the owner.

## Financial correctness baseline

### Money and time

- Represent an amount as value plus currency. Use integer minor units or an exact decimal type; never binary floating point for financial truth.
- Version rounding, allocation, exchange-rate, timezone, statement-date, and locale rules. Record the rule used with the result when later reproduction matters.
- Distinguish transaction occurrence, authorization, posting, settlement, import, and observation times.
- Make precision loss, unsupported currency, missing rate, and ambiguous timezone explicit error states rather than silent coercions.

### Ledger and state

- Define the authoritative source for every balance and state transition.
- Prefer an append-only balanced ledger for consequential money movement. Correct with a reversal or compensating entry instead of rewriting history.
- Model pending, authorized, posted, settled, reversed, disputed, failed, and expired states explicitly when applicable.
- Separate immutable source events, normalized records, accounting entries, user classifications, projections, and presentation.
- Keep forecasts, categorization, and AI suggestions outside authoritative financial truth until a deterministic rule or explicit user action accepts them.
- Record stable identifiers, provenance, actor, timestamps, rule/model version, and reason for consequential changes.

### Idempotency and reconciliation

- Require stable idempotency keys or equivalent deduplication for writes, imports, retries, webhooks, and background jobs.
- Treat API success as evidence of one transition, not proof that the complete financial outcome occurred.
- Reconcile independent sources on a defined cadence. State which source wins for each field and how conflicts become visible.
- Surface freshness, partial sync, ambiguity, discrepancies, and stale balances. Do not silently guess.
- Define correction, dispute, replay, rebuild, export, restore, and provider-revocation behavior before real money or durable personal data is used.
- Test duplicate, missing, reordered, delayed, partially applied, reversed, and corrected events; interrupted migration; clock and timezone changes; rounding boundaries; and restore from backup.

### Access and operations

- Enforce authorization at the authoritative service or data boundary, not only in the client UI.
- Use least privilege, environment separation, tamper-evident audit records, and independent approval for high-impact operations when the risk warrants it.
- Keep provider secrets, reusable tokens, signing material, and bank credentials out of client binaries, logs, fixtures, prompts, and telemetry.
- Prefer hosted or tokenized payment collection when it reduces the application's exposure to account data.
- Make statements, balances, and corrections reproducible from retained, versioned inputs and rules.
- Verify backup restoration, key recovery, reconciliation after restore, and safe rollback—not merely backup creation.

These controls are evidence of engineering discipline. They do not by themselves establish compliance.

## Current-review trigger map

Before relying on this table, verify the linked primary sources and the product's actual jurisdictions. Record the date and exact behavior reviewed.

| Product behavior | Questions for current review | Primary starting points |
|---|---|---|
| Offering consumer financial products or services, financial advice, lending, insurance, or similar functionality | Does the Gramm-Leach-Bliley Act (GLBA) apply? Which privacy notices, safeguarding duties, incident reporting, and service-provider oversight follow? | [FTC GLBA](https://www.ftc.gov/business-guidance/privacy-security/gramm-leach-bliley-act), [FTC Safeguards Rule guide](https://www.ftc.gov/business-guidance/resources/ftc-safeguards-rule-what-your-business-needs-know) |
| Initiating electronic transfers or handling authorization, recurring debits, receipts, errors, or unauthorized-transfer claims | Does the behavior fall within the Electronic Fund Transfer Act (EFTA) or Regulation E, and who owns each disclosure and error-resolution obligation? | [CFPB Regulation E](https://www.consumerfinance.gov/rules-policy/regulations/1005/), [CFPB EFT resources](https://www.consumerfinance.gov/compliance/compliance-resources/deposit-accounts-resources/electronic-fund-transfers/) |
| Receiving or transmitting value for another person | Is the business a money services business (MSB) or money transmitter? Do federal registration, Bank Secrecy Act/anti-money-laundering (BSA/AML), state licensing, bonding, reporting, or partner obligations apply? | [FinCEN MSB registration](https://www.fincen.gov/resources/money-services-business-msb-registration), [FinCEN payment-processor ruling](https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business), [CSBS MTMA](https://www.csbs.org/csbs-money-transmission-modernization-act-mtma) |
| Storing, processing, or transmitting payment-account data | What is the actual Payment Card Industry Data Security Standard (PCI DSS) scope, which responsibilities remain with the product, and can architecture reduce exposure? | [PCI SSC document library](https://www.pcisecuritystandards.org/document_library/?class=pcidss&doc=pci_dss) |
| Describing FDIC insurance or a bank/nonbank relationship | Could wording imply that the nonbank itself is insured? Are pass-through conditions and failure scenarios explained accurately? | [FDIC final rule summary](https://www.fdic.gov/news/financial-institution-letters/2023/fil23065.html) |
| Personalized portfolio recommendations, automated investing, or rebalancing | Does the product provide investment advice? What registration, fiduciary, suitability-input, disclosure, conflict, and compliance-program duties may apply? | [SEC robo-adviser guidance](https://www.sec.gov/investment/im-guidance-2017-02.pdf) |
| Credit eligibility, underwriting, pricing, servicing, limits, or adverse action | Do the Equal Credit Opportunity Act (ECOA)/Regulation B, Fair Credit Reporting Act (FCRA), adverse-action, fair-lending, explainability, or consumer-report duties apply? Can the system give accurate, specific reasons for consequential decisions? | [CFPB Regulation B](https://www.consumerfinance.gov/rules-policy/regulations/1002/), [CFPB complex-algorithm circular](https://www.consumerfinance.gov/compliance/circulars/circular-2022-03-adverse-action-notification-requirements-in-connection-with-credit-decisions-based-on-complex-algorithms/) |
| Sanctionable parties, restricted jurisdictions, cross-border transfers, or digital assets | What risk-based Office of Foreign Assets Control (OFAC) sanctions screening, blocking, reporting, location, and counterparty controls are appropriate? | [OFAC sanctions-compliance framework](https://ofac.treasury.gov/media/16331/download), [OFAC virtual-currency guidance](https://ofac.treasury.gov/media/913571/download) |
| Consumer-authorized access to financial-account data | What is the current status and scope of CFPB Personal Financial Data Rights requirements, and how do partner contracts and user revocation interact? | [CFPB Personal Financial Data Rights](https://www.consumerfinance.gov/compliance/compliance-resources/other-applicable-requirements/personal-financial-data-rights/) |

As of the CFPB page reviewed in August 2026, the Section 1033 compliance dates had been stayed by a court and amendments were under consideration. That is a dated fact, not a durable rule; recheck it before planning or release. Regulatory text and official editions control over summaries when legal accuracy matters.

Other triggers may include privacy, children's data, tax reporting, lending licenses, debt collection, unclaimed property, money laundering, sanctions, securities, commodities, insurance, accessibility, marketing claims, biometric data, and non-U.S. requirements. The product's behavior and users—not its label as a “personal,” “AI,” “beta,” or “software-only” app—determine which questions need review.

## Review workflow

1. **Map capability, custody, and claims.** Record what the product observes, calculates, recommends, represents, stores, moves, blocks, or promises; who owns funds and accounts; and every partner involved.
2. **Map people and jurisdictions.** Identify users, business entities, operating locations, transaction paths, and distribution channels.
3. **Separate facts from interpretations.** Quote current primary sources and contracts; list open questions without converting them into conclusions.
4. **Reduce exposure architecturally.** Consider read-only access, sandbox data, tokenization, licensed partners, server-held secrets, limited cohorts, transaction caps, delayed activation, and explicit user confirmation.
5. **Obtain qualified review when consequence warrants it.** Give counsel or a compliance specialist the concrete capability map, data flow, contracts, claims, and unresolved questions.
6. **Present the owner decision.** Explain feasible options, user-visible effect, cost, residual risk, reversibility, and the reviewer's conclusion or uncertainty in plain language.
7. **Turn the selected interpretation into testable controls.** Assign owners, evidence, monitoring, incident response, review dates, and triggers for reassessment.

## Release evidence

- Completed finance invariants and reconciliation plan.
- Golden scenarios and property tests linked to each invariant.
- Provider sandbox and failure/replay evidence before production credentials.
- Data-flow, trust-boundary, retention, export, deletion, and backup/restore evidence.
- Current compliance trigger review with source dates, jurisdictions, reviewer, conclusions, uncertainty, and owner decisions.
- Reconciliation results for the rollout cohort and named discrepancy/incident owner.
- User-facing wording reviewed against actual behavior; no unsupported claims about accuracy, insurance, security, advice, or regulatory status.
- Rollback, provider revocation, credential rotation, and transaction-containment paths verified.

## Source note

Primary sources above were reviewed in August 2026. They are starting points, not an exhaustive or permanently current legal inventory. Preserve dated source evidence and recheck before regulated use, jurisdiction expansion, material capability changes, or public claims.
