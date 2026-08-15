# Release, Operations, Reliability, Support, Recovery, and Retirement

Status: Supplementary practice module for private daily-driver, beta, and production systems. Apply it proportionally; a single-owner local app does not need a public service's operational ceremony.

This guide does not authorize a release, production access, telemetry, communication, or spending. Owner gates and project authority remain unchanged. It defines the evidence and operating practices that make an approved release supportable and recoverable.

## Production readiness

Before relying on a release, complete a [Production Readiness Review](../templates/production-readiness-review.md) appropriate to the risk:

- Scope, artifact, configuration, environment, dependencies, and data changes are identified.
- Acceptance, security/privacy, accessibility, performance, compatibility, migration, and recovery evidence is current.
- Service indicators, support route, runbooks, owners, and monitoring window exist.
- Rollout stages, promote/hold/stop signals, rollback/roll-forward path, and authority are explicit.
- Capacity, quotas, spend, certificates, credentials, signing, and external-service readiness are checked.
- Known limitations say who is affected, the workaround, owner, and review trigger.

Promote the same verified artifact where possible. When signing or environment configuration requires a rebuild, record the relationship and repeat affected checks.

## Release and deployment strategy

Select [GitHub Delivery, Automation, and Agent Workflows](github-delivery-automation-and-agent-workflows.md) when GitHub owns CI, release artifacts, environments, or deployment approval. Pull-request change classification accelerates feedback; it does not replace a representative integration/release gate.

### Release identity and compatibility

Use the repository's [Release Versioning Policy](../templates/release-versioning-policy.md) to state what is being versioned before choosing a number. Product/repository releases, platform build numbers, database schemas, APIs/protocols, files, instruction manifests, models/prompts, and dated evidence are related identities, not one counter.

- Apply the playbook's patch/minor/major and pre-1.0 rules from the compatibility effect of the completed batch, not its line count, duration, or number of commits.
- Keep versions independent across repositories. Link compatible combinations in a release manifest or compatibility table instead of forcing synchronized numbers.
- Use prerelease suffixes only for candidates actually distributed to an owner, tester, device, environment, or evaluation lane.
- Record mixed-version behavior, migration direction, minimum/maximum supported versions, downgrade/rollback, and the point at which old readers/writers or clients/servers stop interoperating.
- Keep one human-readable changelog entry per release and link exact build, schema, protocol, file, model/prompt, and artifact identities when they changed.
- Define explicit `1.0.0` criteria from the stability promise appropriate to the repository. A private daily-driver tool can reach 1.0 without public distribution; a prototype with many features may still be pre-1.0.

Choose the smallest strategy that limits credible harm:

- Direct replacement for reversible, low-risk private changes.
- Feature flag for behavior that can be safely isolated and removed.
- Canary or staged rollout for uncertain real-environment behavior.
- Rolling or blue/green deployment for services needing continuity.
- Parallel compatibility period for protocols, schemas, clients, or migrations.

These are patterns, not mandatory tools. For every staged release, define cohort, duration, health signals, human/automatic stop condition, and final promotion decision.

For durable data changes, separate code/schema expansion, migration or backfill, verification, traffic switch, and later contraction. Back up and prove restore before an irreversible step.

## Configuration and environment discipline

- Version public-safe configuration and validate its schema.
- Keep secrets in approved secret storage, not artifacts, source, logs, prompts, or screenshots.
- Compare intended and effective configuration before promotion.
- Separate development, test, staging, canary, and production identities and data.
- Detect configuration drift and record emergency changes.
- Make safe defaults fail visibly when required configuration is absent.
- Test certificate, token, key, and dependency expiry or rotation.

## Reliability promises

Define a small number of promises from the user's perspective. For each:

- Service-level indicator: exact successful events, total population, exclusions, measurement point, and window.
- Service-level objective: target and rationale.
- Error budget or equivalent tolerance.
- Alert or review trigger and owner response.
- Degraded mode and recovery behavior.

Useful promises include correctness, availability, durability, freshness, completion, latency, reconciliation, and restore success. Do not select metrics merely because a monitoring product exposes them.

When reliability is below the accepted target, use the evidence to rebalance feature work, repair, scope, or the target. The owner decides product trade-offs; an SLO is an input, not an independent authority.

## Observability and runbooks

Connect privacy-safe signals to action:

- Correlate build/release/configuration with failures.
- Measure critical queues, retries, dependencies, jobs, storage, capacity, and recovery.
- Alert on user harm or impending exhaustion, not every internal anomaly.
- Include a runbook link, diagnostic question, and owner in each actionable alert.
- Test telemetry scrubbers, retention, sampling, access, and kill switch.
- Prefer local/user-controlled diagnostics for sensitive personal products.

A runbook should contain purpose, prerequisites, safe read-only diagnosis, containment, recovery, verification, rollback/fail-forward, escalation, communications, and cleanup. Never paste reusable credentials or private production contents into it.

## Incident response

1. Confirm scope and current user/data impact.
2. Contain ongoing harm with the least destructive reversible action.
3. Preserve sanitized evidence and a decision timeline.
4. Communicate verified facts, uncertainty, next update, and owner action if needed.
5. Recover and reconcile authoritative state.
6. Verify from the user's perspective, not only an internal health check.
7. Review root and contributing causes without blame.
8. Assign corrective actions with owners, triggers, and proof.

Urgency does not justify speculative destructive edits. If rollback is safer than diagnosis during active impact, roll back first when authorized and investigate from preserved evidence.

## Support operations

Support is a product feedback and recovery system, not only an inbox.

- Define supported channels, versions, response expectations, and escalation route.
- Collect environment, release, time, observable behavior, reproduction, impact, and consent for diagnostics.
- Separate user statements, observed evidence, agent interpretation, and hypothesis.
- Redact private content and use user-controlled diagnostic export where possible.
- Maintain known issues and workarounds with affected versions and expiry.
- Route security reports, account recovery, billing/entitlement, data-integrity, and ordinary usability issues through appropriate procedures.
- Feed recurring friction into documentation, tests, design, reliability work, and roadmap decisions.

Admin/support tools require least privilege, auditability, confirmation for consequential actions, and recovery from operator error.

## Capacity and operational scaling

Review demand, headroom, dependency limits, cost, and toil before growth makes them urgent. Define what may queue, degrade, become read-only, shed, or disable during overload. Test recovery traffic and retry storms, not only steady-state load.

Scaling also includes people and process: eliminate repetitive manual work when automation is safer, documented, observable, reversible, and worth maintaining. Do not automate an unclear or unstable procedure.

## Disaster recovery

For each consequential system, define:

- Recovery time objective (RTO): how long loss of the capability can be tolerated.
- Recovery point objective (RPO): how much recent data loss can be tolerated.
- Critical data/services and restoration order.
- Backup location, encryption, retention, immutability where needed, and restore credentials.
- Alternate environment/provider/device and dependency assumptions.
- Credential, signing-key, identity, domain/DNS, and account recovery.
- Integrity and reconciliation checks after restoration.
- Failback, communications, and evidence owner.

Use a [Recovery Exercise](../templates/recovery-exercise.md) to test a bounded scenario. Backup creation is not recovery evidence; restore into a clean or appropriately isolated target and verify contents and behavior.

## Production learning

At the end of the monitoring window, review:

- User outcome and feedback.
- Correctness, reliability, accessibility, performance, support, and cost signals.
- New incidents, near misses, workarounds, and operational toil.
- Differences between predicted and observed behavior.
- Whether to promote, hold, revise, roll back, scale, or retire.

New product analytics or off-device telemetry still requires the playbook's explicit approval and privacy design. A lack of telemetry may be addressed with local measurements, user-controlled export, direct research, or deterministic reconciliation.

## Retirement and decommissioning

Treat retirement as a release with reversed dependencies.

1. Inventory users, supported clients, integrations, data, jobs, infrastructure, billing, credentials, domains, certificates, monitoring, backups, and contractual/support commitments.
2. Obtain the required owner decision and define notice, migration/export, support, and rollback windows.
3. Stop new enrollment or writes in a controlled sequence where needed.
4. Migrate/export and verify user data; apply approved retention, deletion, or archival rules.
5. Revoke tokens, webhooks, service accounts, keys, certificates, and external integrations.
6. End billing and recurring resources; remove storage, queues, jobs, alerts, routes, and infrastructure only after dependency and dangling-reference checks.
7. Retain or safely park domains, package/application identities, signing/update identities, dependency namespaces, and other public identifiers for a threat-modelled period. Remove dangling DNS/cloud references before the target resource and preserve safe redirects or a security contact where useful.
8. Preserve required source, artifacts, decisions, incident history, and public-safe operational knowledge.
9. Verify no unexpected traffic, spend, data, access path, takeover opportunity, or user dependency remains.

Do not delete the only recovery path before the rollback window and data obligations have ended.

## Useful references

- [Google SRE: Release Engineering](https://sre.google/sre-book/release-engineering/) covers reproducible, automated, self-service releases and canary/rollback practice.
- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) covers user-centered indicators, objectives, and error budgets.
- [Google SRE: Production Services Best Practices](https://sre.google/sre-book/service-best-practices/) includes rollback, capacity, overload, and disaster exercises.
- [NIST SP 800-34 Rev. 1](https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final) provides contingency-planning guidance. It is a reference, not an automatic certification or mandatory process for every project.
