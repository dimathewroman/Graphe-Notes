# Product Analytics, Experimentation, and Monetization

Use this guide when deciding what to measure, running product experiments, charging users, managing subscriptions/usage, or deciding whether a product is ready to grow.

Measurement should help make a named decision. It does not override the telemetry privacy gate, consent, accessibility, fairness, financial correctness or owner approval.

## Outcome framework

Connect five levels:

1. **User problem and promised outcome.** What meaningful improvement should occur?
2. **Behavioral indicator.** What observable action or state suggests the outcome occurred?
3. **Product metric.** Exact numerator, denominator, population, time window, identity and exclusions.
4. **Guardrails.** Reliability, safety, privacy, accessibility, support, cost and unintended-behavior measures.
5. **Decision rule.** What result causes continue, change, stop, investigate or scale?

Do not use downloads, registrations, page views or model tokens as success merely because they are easy to count. Maintain a metric dictionary with owner, query/logic version, source, freshness, caveats and change history.

## Analytics engineering

- Design the event and metric plan before instrumentation. Collect the minimum fields required for the decision.
- Define event name/version, producer, trigger, user/account/session identity, deduplication, timestamp, consent state and allowed properties.
- Separate product analytics, operational telemetry, security audit evidence and financial records; they have different access and retention needs.
- Test schemas, duplicate/missing/late events, identity merges/splits, timezones, bots/testers, consent changes and deletion propagation.
- Reconcile important dashboards to authoritative operational or financial totals.
- Annotate releases, incidents, campaigns, migrations and metric-definition changes.
- Restrict raw access, use short retention and aggregation where possible, and provide export/deletion behavior consistent with the product promise.

For local/private products, an on-device scorecard or user-initiated redacted export may answer the question without continuous off-device collection.

## Product experiments

Before an A/B or staged experiment, record:

- Hypothesis, unit of randomization, eligible population, exposure event and assignment persistence.
- Primary outcome, guardrails, minimum meaningful effect, sample/duration rationale and stop criteria.
- Novelty/seasonality, interference, network effects, repeated exposure, carryover and segment risks.
- Data-quality checks and analysis plan, including multiple comparisons and missing data.
- Consent, fairness, accessibility and whether withholding the feature creates harm.
- Rollback and follow-up plan.

In plain language, the randomization unit is what gets assigned to a variant; the minimum meaningful effect is the smallest improvement worth acting on; interference means one participant can affect another; and multiple comparisons increase the chance of finding an accidental “winner.” Use qualified statistical review when these choices could materially change the conclusion.

Do not repeatedly peek and stop when a preferred answer appears. Distinguish statistical uncertainty from practical value and causal evidence from correlation. Small private products may learn more from structured usability sessions, longitudinal diaries, staged rollouts and qualitative evidence than underpowered A/B tests.

## Feedback and research operations

- Combine analytics with interviews, support themes, usability observation, reviews, cancellations, corrections and direct owner dogfooding.
- Tag evidence by source and confidence. One loud request is not automatically representative; a dashboard does not explain motivation.
- Close the loop: record what decision changed, inform affected users where appropriate, and verify whether the change solved the original problem.
- Maintain a research repository containing consent-safe summaries, methods, decisions and unresolved questions—not private raw conversations by default.

## Monetization design

Start from the value created and who receives it. Evaluate:

- One-time purchase, subscription, usage-based, seat/account, transaction, marketplace, service/support, sponsorship or open-core models.
- Free/trial limits, upgrade moment, cancellation, grace period, refunds, disputes, taxes, currency and regional/store differences.
- Cost to serve each tier: infrastructure, models/APIs, storage, network, payment fees, fraud/chargebacks, support and operator time.
- Seller and merchant of record by channel and region, including who owns tax/VAT, invoices, subscription notices, refunds, disputes, chargebacks, fraud, data handling, and customer support.
- Gross margin and cash timing under typical and worst-case usage, including free-tier abuse and provider price changes.
- Whether pricing aligns with user success or creates incentives that harm quality, privacy or trust.
- Portability if a store, payment processor, model provider, cloud or marketplace changes terms.

Explain pricing and limits before commitment. Do not use dark patterns, hidden renewal, manufactured urgency, obstructive cancellation or misleading savings. Make entitlement and billing state explicit and recoverable.

## Billing and entitlement engineering

- Keep catalog/product/price identity versioned; never infer durable entitlements from UI state alone.
- Use provider-hosted/tokenized payment surfaces where they reduce sensitive-data scope.
- Authenticate notifications using the provider's current mechanism and validate signatures where provided. When a notification is only a change signal, fetch authoritative transaction state from the provider API, then reconcile idempotently while tolerating duplication, reordering and delay.
- Model trial, active, grace, past-due, paused, canceled, refunded, disputed and revoked states as applicable.
- Reconcile provider transactions and entitlements; provide restore-purchase/account-recovery paths.
- Separate access entitlement from payment attempt state so transient failures do not corrupt durable truth.
- Test upgrades/downgrades, proration, plan retirement, family/team changes, refunds, chargebacks, offline use, provider outage and account deletion.
- Put price, tax, renewal, cancellation and refund claims through current platform/payment/legal review when warranted.

## Growth and scaling gates

Before materially increasing acquisition or exposure, require:

- Demonstrated target-user outcome and acceptable retention/correction/support evidence.
- Reliable onboarding, activation, accessibility and account recovery.
- Capacity and unit-cost evidence with quotas, abuse controls and financial alerts.
- Support coverage, known-issue communication and incident/recovery readiness.
- Privacy/compliance/security review for new populations, regions, integrations and claims.
- Ability to turn off a campaign/feature, honor existing users and export/retire data.

Growth is not success if it amplifies unresolved harm, support debt, negative unit economics or an unproven product promise.

## AI-specific economics

- Track cost per attempted and successful user outcome, not only price per model token.
- Include retries, retrieval, tool calls, moderation, storage, egress, human review, failed generations and support.
- Set quotas, maximum work/time/tool steps and per-user/account/provider circuit breakers.
- Route tasks by measured quality/cost/latency; preserve an understandable fallback when a provider or model fails.
- Persist identity, model/prompt/tool versions, cost and user-visible artifacts when billing, reproducibility, correction or dispute requires it—without retaining unnecessary sensitive content.
- Re-evaluate claims and pricing when the model/provider changes; a cheaper model is not equivalent until the product evaluation passes.

## Decision scorecard

| Dimension | Question |
|---|---|
| Value | Do intended users achieve an important outcome? |
| Trust | Are claims, pricing, privacy and generated/financial behavior understandable and correctable? |
| Quality | Are critical workflows reliable, accessible and supportable? |
| Economics | Is cost per successful outcome bounded and sustainable? |
| Defensibility | Is the advantage a durable workflow, data right, distribution, community, integration or capability rather than a replaceable dependency alone? |
| Scale | Can systems, vendors, support and governance grow without unacceptable tail risk? |
| Exit | Can users cancel, export, recover and leave without being trapped? |

## References

- [NIST Engineering Statistics Handbook](https://www.itl.nist.gov/div898/handbook/)
- [Google HEART framework paper](https://research.google/pubs/measuring-the-user-experience-on-a-large-scale-user-centered-metrics-for-web-applications/)
- [W3C privacy principles](https://www.w3.org/TR/privacy-principles/)
- [Stripe billing documentation](https://docs.stripe.com/billing)
- [Apple in-app purchase](https://developer.apple.com/in-app-purchase/)
- [Google Play billing](https://developer.android.com/google/play/billing)
