# Performance, Capacity, and Compatibility

Status: Supplementary practice module. Adopt targets through the project engineering profile; do not treat example metrics or tools as universal requirements.

Performance is user-visible behavior under defined conditions. Capacity is how behavior changes as demand and data grow. Compatibility is the promise that supported clients, formats, protocols, and stored state continue to work through change.

## Start with budgets, not optimization

For each critical journey or service promise, define:

- User-visible outcome.
- Metric and exact start/stop boundary.
- Target and unacceptable regression threshold.
- Representative hardware, data size, workload, network, build mode, and environment.
- Typical and tail percentiles where applicable.
- Resource or cost ceiling.
- Baseline release and evidence owner.

Useful metric families include startup/readiness, input latency, frame pacing, page loading/interactivity/stability, request/job latency, throughput, error rate, queue age, database/query time, memory, CPU/GPU, storage, network, energy, artifact size, and build/test time. Select only metrics that can drive a decision.

Use the [Cross-Layer Performance and Capacity Plan](../templates/cross-layer-performance-and-capacity-plan.md) when a journey crosses UI, process, data, device, network, or provider boundaries. At minimum, budget:

- Frame/input and startup deadlines rather than average FPS alone.
- Managed, native, graphics/media, database/index, model, mapped-file, and cache working sets.
- Persistent originals, derivatives, indexes, WAL/temp, backups, sync, and migration headroom.
- Network bytes/round trips, radio wakeups, provider quotas and monetary cost.
- Sustained energy/temperature behavior, not only a short plugged-in benchmark.
- Low/middle/high device tiers and correctness-preserving adaptations.

## Measurement discipline

- Validate the harness with controlled changes or known cases.
- Compare the same journey, data, device state, build mode, and environment.
- Warm up or reset deliberately; report which state was measured.
- Preserve tool/version/configuration, raw output or durable summary, sample count, and variance.
- Report distribution and tails rather than only averages.
- Separate laboratory repeatability from field representativeness.
- Attribute regressions before optimizing; device, dependency, network, compiler, and harness changes can mimic product regressions.
- Prefer a simple implementation that meets the budget. Stop when further optimization adds more complexity or risk than user value.

## Performance workflow

1. Reproduce the user-visible symptom or budget miss.
2. Establish a trustworthy baseline.
3. Capture a profile or trace at the correct layer.
4. Form a falsifiable bottleneck hypothesis.
5. Change one material variable.
6. Re-measure correctness, typical behavior, tails, and resources.
7. Run the broader regression and representative-device gate.
8. Record the accepted trade-off and remaining headroom.

Do not use caching, preloading, concurrency, native code, or architectural complexity merely because they are common optimization techniques. Each changes failure modes and must earn its cost with evidence.

Trace the complete critical path before tuning. A low CPU percentage can coexist with lock, I/O, GPU, compositor, network, memory-pressure, or dependency queueing. A high utilization number can be harmless work outside the user's deadline. Use [Device Runtime, Rendering, and Resource Efficiency](device-runtime-rendering-and-resource-efficiency.md) for cross-layer diagnosis.

## Capacity and scaling

Model demand in units the system actually consumes: active users, requests, events, bytes, records, attachments, concurrent operations, device jobs, model tokens, or another causal unit.

Record:

- Current demand, expected growth, burst shape, seasonality, and uncertainty.
- Per-unit CPU, memory, storage, network, dependency quota, and monetary cost.
- Safe operating limit, required headroom, and saturation signals.
- Scaling action, lead time, owner, and rollback.
- Degradation order: what may slow, queue, shed, become read-only, or disable before critical correctness fails.

Use load tests for expected concurrency, stress tests to find limits, spike tests for sudden demand, and soak tests for leaks or accumulating queues when applicable. Test overload behavior, not only the largest successful number.

Prefer horizontal/vertical scaling, batching, caching, partitioning, queues, rate limits, backpressure (slowing producers when consumers cannot keep up), or precomputation only after measuring the real constraint. Plan for disproportionately busy keys/tenants, retries multiplying across layers, many clients retrying simultaneously, downstream quotas, and recovery traffic.

## Compatibility contract

Maintain a matrix covering the dimensions the project supports:

- Operating systems, devices/architectures, browsers, databases, runtimes, and toolchains.
- Current, minimum, and previous app/client/server versions.
- API, protocol, event, file, export, and persistent-storage versions.
- External service and dependency versions.
- Upgrade, mixed-version, rollback, restore, and—when supported—downgrade paths.

Distinguish:

- Backward compatibility: a newer reader/service accepts older data or clients.
- Forward compatibility: an older reader/client safely handles newer data or responses.
- Wire compatibility: peers exchange messages without ambiguity.
- Storage compatibility: durable data remains readable and semantically correct.
- Behavioral compatibility: user-visible or API semantics remain within the promised contract.

## Evolving contracts safely

- Make additive changes before removing old behavior.
- Use tolerant readers only where unknown data can be safely ignored; validate required invariants.
- Version semantics, not merely endpoints or filenames.
- Preserve stable identifiers and idempotency across mixed versions.
- Use expand -> migrate/backfill -> verify -> switch -> contract for incompatible schema changes.
- Define deprecation notice, observation, removal trigger, and recovery path.
- Test the current and previous supported versions (often called N/N-1) or another explicitly supported matrix at real boundaries.
- State when downgrade is unsupported; do not imply recoverability that can corrupt newer state.

Compatibility ends deliberately. Retaining every historical path indefinitely increases cost and attack surface.

## Regression gates

Automate stable, decision-relevant thresholds while accounting for measurement noise. A failed threshold should produce enough context to distinguish a real regression from infrastructure variance.

Before release, verify:

- Critical budgets on representative release artifacts.
- Capacity headroom or bounded owner-accepted limitation.
- Supported compatibility matrix and migration path.
- Resource/cost impact and downstream quotas.
- Rollback or roll-forward behavior after any state change.
- Monitoring that detects budget, saturation, or compatibility failures without collecting unapproved sensitive data.

## Useful references

- [Google SRE: Service Level Objectives](https://sre.google/sre-book/service-level-objectives/) explains user-centered indicators, targets, and error budgets.
- [Google SRE: Production Services Best Practices](https://sre.google/sre-book/service-best-practices/) includes capacity planning, overload testing, rollback, and disaster exercises.
- [Google Web Vitals](https://web.dev/articles/vitals) provides evolving web experience metrics; pin the definitions used by a project rather than copying thresholds permanently into governance.
- [Semantic Versioning](https://semver.org/) is one contract-versioning convention, not a substitute for defining actual compatibility promises.

Profilers, load generators, browser tools, platform benchmarks, and compatibility services are examples. Select them based on stack, data sensitivity, representativeness, and maintenance cost.
