# Controlled Beta and Frontier Experimentation Guide

Use this guide for unusual architectures, new protocols, scientific or product research, internal dogfood, TestFlight or Play testing, and staged production experiments. Use the [frontier experiment decision record](../templates/frontier-experiment-decision-record.md) for any experiment whose result could change architecture, privacy, security, financial behavior, user trust, or release scope.

The purpose is to make ambitious work faster to learn from and safer to expand. It does not prohibit unconventional ideas. The owner decides whether to accept understood residual risk; current runtime-enforced limitations remain separate. A beta, sandbox, prototype, or “research” label does not itself waive law, contracts, consent, security, or factual accuracy.

## The frontier loop

1. **Frame the leap.** State the desired capability in plain language, what current methods cannot do, why success matters, and what is genuinely new.
2. **Name the hardest unknown.** Identify the assumption most likely to make the idea impossible, harmful, too slow, too costly, or unwanted.
3. **Design the cheapest decisive test.** Change one important variable where practical; use synthetic inputs, simulations, reference measurements, or a narrow prototype.
4. **Pre-register judgment.** Define measurements, comparison baseline, success threshold, stop threshold, evidence quality, and analysis method before seeing results.
5. **Instrument and run.** Preserve environment, versions, inputs, raw observations, failures, and deviations. Do not rewrite the hypothesis after the outcome.
6. **Attempt falsification.** Test adversarial cases and alternative explanations. Reproduce important results independently when consequence warrants it.
7. **Decide explicitly.** Kill, revise, repeat, park, or promote. Negative results are retained as useful evidence.
8. **Productionize deliberately.** Treat promotion as a fresh architecture, security, privacy, reliability, accessibility, compliance, cost, and operations review—not as cleanup of a prototype.

DARPA's [Heilmeier Catechism](https://www.darpa.mil/about/heilmeier-catechism) is a compact test of objective, novelty, benefit, risk, cost, schedule, and measurable success. X describes attacking the hardest risks early with small, inexpensive experiments before larger prototypes and techno-economic analysis in its [Moonshot Factory operating manual](https://x.company/blog/posts/a-peek-inside-the-moonshot-factory-operating-manual/).

## Exposure ladder

Advance only when evidence supports the next exposure. A stage may be skipped when the risk model justifies it, but record why.

Skipping an exposure stage never skips an applicable owner-approval, consent, privacy, security, spending, distribution, professional-review, or runtime/platform gate.

| Stage | Default inputs and users | Evidence before promotion |
|---|---|---|
| Offline analysis | Existing public or approved datasets; no live effect | Reproducible baseline, evaluation method, data provenance, limitations |
| Synthetic lab | Fixtures, simulation, local replicas, isolated branches | Falsifiable result, failure modes, cleanup, initial threat and cost model |
| Internal dogfood | Staff/owner accounts and non-production or recoverable data | Usability, reliability, privacy-safe diagnostics, support and kill path |
| Trusted closed beta | Named consenting cohort with bounded capability | Consent, cohort rationale, incident path, rollback, abuse and recovery evidence |
| Limited production | Small percentage, geography, account type, transaction cap, or feature flag | Service objectives, error budget, compliance review, on-call owner, live reconciliation |
| Broader scale | Intended users and production data | Sustained benefit, acceptable tail behavior, operational capacity, reviewed residual risk |

Exposure dimensions include users, data sensitivity, permissions, autonomy, money, irreversible effects, traffic, geography, duration, model capability, external systems, and public claims. Increase the fewest dimensions necessary to answer the question.

## Experiment boundary record

Every consequential experiment states:

- Hypothesis, baseline, novelty, and user or scientific value.
- Stage, cohort, duration, inputs, permissions, and affected systems.
- Data classification, consent, retention, deletion, and third-party boundaries.
- Worst credible harm and how it is contained.
- Success, guardrail, stop, rollback, cleanup, and expiration conditions.
- Owner, operator, incident contact, independent reviewer, and decision maker.
- Pre-run owner authorization for the exact exposure, conditions, date, and expiry when an owner gate applies.
- Legal/compliance/platform questions, current sources, advice received, uncertainty, and owner decision.
- Cost ceiling and resource kill switch.
- Reproduction package and evidence-retention location.

Do not classify advice or a risk rating as an externally enforced restriction. Conversely, do not describe a real platform, account, legal order, or runtime control merely as advice; identify the exact observable boundary.

## Scientific and engineering evidence

- Compare against a named baseline, including a simple conventional approach where useful.
- Choose metrics that measure the promised outcome, plus guardrails for reliability, privacy, security, accessibility, cost, and user harm.
- Report distributions and tail behavior, not only averages. State sample size and uncertainty.
- Use holdouts, blinded review, counterfactuals, ablations, property tests, fuzzing, fault injection, or adversarial testing where they can disprove the claim.
- Prevent test leakage and confirmation bias: version datasets and prompts, separate tuning from evaluation, and keep failed cases.
- Distinguish statistical significance, practical significance, causal evidence, and anecdote.
- Record hardware, software, model, dependency, configuration, seed, and data versions needed to reproduce results.
- For AI systems, evaluate the complete tool-and-data workflow, not only model output; test prompt injection, permission boundaries, hallucinated actions, privacy leakage, fallback, correction, and shutdown.
- Revisit the result when the environment, user population, model, protocol, economics, or regulation changes.

## Beta operating standard

Before inviting testers:

- Explain what is experimental, what could fail, what data is collected, who can access it, how to leave, and how to report a problem.
- Use sandbox or synthetic financial data by default; introduce real sensitive data only when the test requires it and protections match the exposure.
- Select cohorts that cover relevant devices, operating systems, accessibility needs, networks, locales, account states, and failure scenarios.
- Separate binary distribution from capability exposure so a server control or feature flag can disable risky behavior.
- Provide a support route, known-issues list, privacy notice, incident owner, minimum supported version, and forced-expiry or update strategy where appropriate.
- Monitor crashes, performance, queue/reconciliation health, safety signals, and feedback with an approved, minimized telemetry allowlist.
- Define the review date. Beta is a temporary evidence phase, not a permanent excuse for incomplete recovery or security.

Apple's current TestFlight documentation describes internal and external cohorts, beta review, tester feedback, and 90-day build expiry; verify current limits and rules before each release. See [TestFlight overview](https://developer.apple.com/help/app-store-connect/test-a-beta-version/testflight-overview/) and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/). Google Play provides internal, closed, and open testing tracks; see [Play testing tracks](https://support.google.com/googleplay/android-developer/answer/9845334).

## Push-boundary decision gates

An unconventional mechanism is a reason for stronger measurement, not automatic rejection. Ask:

- Does the idea unlock a step change, or merely novelty and complexity?
- Is the decisive risk technical feasibility, user value, economics, operations, security, privacy, compliance, or distribution?
- Can that risk be tested earlier, more cheaply, or with less exposure?
- Is failure contained and reversible? What remains after rollback?
- What result would cause the team to stop even after substantial investment?
- Can a conventional component contain the experimental core behind a stable interface?
- What must be independently reproduced or reviewed before real users, sensitive data, money, autonomy, or scale?
- What would have to be true for this to become maintainable production infrastructure?

Use service objectives and an error budget to prevent launch pressure from consuming reliability indefinitely; Google SRE describes this balance in [Service Best Practices](https://sre.google/sre-book/service-best-practices/). A regulatory sandbox is also a controlled test, not an exemption: the UK's FCA describes restricted live testing with safeguards while retaining applicable obligations in its [Regulatory Sandbox](https://www.fca.org.uk/firms/innovation/regulatory-sandbox) and [eligibility criteria](https://www.fca.org.uk/firms/innovation/regulatory-sandbox/eligibility-criteria).

## Promotion evidence

- Completed experiment decision record and owner decision.
- Reproducible results, raw or durable summarized evidence, and documented negative cases.
- Architecture decision separating experimental components from stable contracts.
- Threat, privacy, misuse, compliance-trigger, dependency, and cost review.
- Recovery, rollback, kill-switch, expiry, and cleanup proof.
- Beta cohort, consent, support, monitoring, and incident evidence.
- Production implementation reviewed independently of the prototype when consequence warrants it.
- Post-promotion review date and conditions that reopen or retire the decision.

Primary references were reviewed in August 2026. Platform limits, program requirements, and regulatory positions are time-sensitive; pin dated evidence in each experiment record.
