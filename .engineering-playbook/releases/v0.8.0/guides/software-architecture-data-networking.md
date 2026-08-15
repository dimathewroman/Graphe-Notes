# Software Architecture, Data, Networking, and Distributed Systems

For implementable API/IPC/event/MCP contracts and integration evidence, use [APIs, MCP, and System Integration](apis-mcp-and-system-integration.md). For large on-device collections and retrieval pipelines, use [On-Device Data, Indexing, Search, and RAG](on-device-data-indexing-search-and-rag.md).

Use this guide when choosing system boundaries, data ownership, APIs, synchronization, queues, services, caches, or scale architecture. Begin from product invariants and measured constraints; architecture is the set of decisions that are expensive to change, not a diagram style.

For client-local databases, cross-device synchronization, import/export, media or document formats, and cross-platform sharing, also use [Data, Storage, Sync, and File Interoperability](data-storage-sync-and-file-interoperability.md). A cloud database is not a client API: mobile and web clients normally cross an authenticated authorization/service boundary rather than receiving unrestricted database credentials.

## Architecture brief

Record:

- Critical user journeys, invariants, failure consequences and operating mode.
- Expected data volume, request/event rate, concurrency, latency, availability, durability, privacy, residency and cost ranges.
- Trust boundaries, authoritative components, external dependencies and offline/degraded expectations.
- Deployment and operator constraints, team/agent ownership, supported versions and migration horizon.
- What is deliberately simple now, what evidence would justify changing it, and how change remains possible.

Prefer the simplest deployable architecture that preserves needed boundaries. A well-structured modular monolith, local application, or managed platform is often a better starting point than many independently operated services. Split components when evidence shows different security, ownership, scaling, availability, release, hardware or fault-isolation requirements.

## Boundaries and contracts

- Organize around cohesive domain responsibilities and invariants, not arbitrary UI screens or technical layers alone.
- Give each authoritative fact one owning boundary. Other representations are caches, indexes, projections or replicas with explicit freshness and rebuild rules.
- Keep policy/domain logic separable from transport, framework, storage, UI and model-provider details where this improves testability and portability.
- Define inputs, outputs, errors, timeouts, cancellation, authorization, idempotency, ordering, versioning and observability at every boundary.
- Make invalid states difficult to represent through types, schemas, constraints and state machines.
- Avoid shared mutable databases or libraries that silently couple independent services. If sharing is intentional, document the transaction and ownership model honestly.
- Record important decisions and reversal signals in ADRs. Do not build speculative abstraction for hypothetical future platforms without a concrete variability requirement.

## Data engineering

### Model truth

- Start from entities, events, relationships, invariants, history and access patterns—not a fashionable database category.
- Preserve raw/source facts when later reinterpretation, audit or reconciliation matters; derive normalized and presentation views separately.
- Use database transactions, uniqueness, foreign keys, checks and domain constraints as another correctness layer where supported.
- Define identity, lifecycle, deletion, retention, provenance, effective time versus observation time, and schema ownership.
- Decide what must be strongly consistent, what may be eventually consistent, and what the user sees while state converges.

### Evolve safely

- Version schemas, serialized messages and storage formats. Readers should handle expected old/new forms during rolling upgrades.
- Use expand → migrate/backfill → verify → switch reads/writes → contract for incompatible changes.
- Make migrations resumable, observable, bounded and tested against representative scale. Preserve rollback or a proven roll-forward path.
- Verify backups by restoring and reconciling them. Test corruption, partial writes, storage exhaustion, permission loss and key unavailability.
- Treat analytics pipelines and search/vector indexes as derived systems unless the architecture explicitly makes them authoritative.
- For SQLite in WAL mode, treat the main database, write-ahead log, and shared-memory state as one live persistence system; use a supported backup/checkpoint mechanism rather than copying only the main file.
- Give every stored/exported format a version, media/content type, size and validation limits, migration policy, and round-trip fixtures. File extensions alone are not a trust boundary.

### Pipelines and analytics data

- Define event meaning, producer, schema/version, event time, processing time, identity, deduplication and late-data rules.
- Keep transformation code, lineage, data-quality assertions, reconciliation and reprocessing evidence versioned.
- Separate operational databases from heavy analytical workloads when measurements show contention or governance requires it.
- Apply the same access, minimization, retention and deletion rules to warehouses, notebooks, exports, caches and embeddings.

## Network and protocol engineering

Trace the full request path: name resolution → route/NAT/proxy → transport → encryption/authentication → application protocol → load balancer/gateway → service → dependency → response. Measure at each boundary before guessing.

- Specify DNS, address families, ports, TLS/mTLS, authentication, proxy behavior, payload limits and supported protocol versions.
- Set connect, read, write and overall deadlines from the user journey and downstream budgets. Propagate cancellation.
- Retry only operations proven safe or protected by idempotency. Use bounded exponential backoff with jitter and a retry budget; do not multiply retries across layers.
- Validate, frame and bound every untrusted payload. Define compression, streaming, flow control, backpressure and resource limits.
- Handle disconnect, partial delivery, duplication, reordering, stale sessions, credential rotation, clock skew and network changes.
- Capture sanitized packet/protocol evidence when needed; TLS failure, HTTP success and queue acknowledgement each prove only their own layer.
- Test IPv4/IPv6, Wi-Fi/cellular, captive portals, VPN/private overlays, proxies, slow/lossy links, offline, reconnect and roaming when relevant.

Common evidence tools include `dig`, `curl`, `openssl s_client`, `ss`/`netstat`, `tcpdump`, Wireshark, browser developer tools, platform network profilers and controlled fault proxies. Do not capture private payloads unnecessarily.

## APIs, events, queues, and jobs

- Use resource/action names that reflect domain behavior. Specify authorization and errors as carefully as success responses.
- Prefer additive compatible changes. Publish a deprecation window, usage evidence, migration guide and removal owner.
- Validate consumer-driven or provider contracts for independently deployed components.
- For queues/events, define delivery semantics, partition/order key, duplicate behavior, retention, replay, poison/dead-letter handling and schema evolution.
- Treat “exactly once” as an end-to-end claim requiring evidence; transports often provide narrower guarantees.
- Persist important jobs before acknowledging them. Make handlers idempotent and expose age, attempts, ownership and terminal state.
- Keep workflows explicit when multiple steps, compensation, waiting or human approval are involved. Durable workflow engines may help only after their state and operating model are understood.

## Caches, replicas, and search

- State the source of truth, cache key/namespace, invalidation trigger, TTL, consistency tolerance and behavior on miss/outage.
- Prevent cache stampedes and unbounded cardinality; measure hit rate, latency saved, memory/cost and stale-result harm.
- Define read/write routing, replication lag, conflict and failover behavior before using replicas.
- For search or embeddings, version preprocessing, model, index schema and source-document authorization. Rebuilds must be reproducible and deletion must propagate.

## Scaling and resilience

Scale in this order where possible:

1. Measure the actual bottleneck and user-visible target.
2. Remove accidental waste, blocking and unbounded work.
3. Improve algorithms, queries, batching, compression and caching.
4. Add safe concurrency and vertical resources.
5. Partition or distribute only with a clear ownership and failure model.

Define capacity as a curve across throughput, latency tails, errors, saturation and cost. Test load, stress, spike and soak behavior. Preserve headroom for failures and growth. Use admission control, queues, load shedding, circuit breaking, bulkheads and graceful degradation according to evidence—not as decorative patterns.

Distributed systems add partial failure, uncertain outcomes, clock error, duplicated work, split authority and operational burden. Design reconciliation and recovery before promising availability that depends on them.

## Architecture review questions

- What is the smallest architecture meeting current evidence?
- Where does each invariant live, and can two components disagree?
- Which failures create an uncertain outcome, and how is it reconciled?
- What happens if every dependency is slow, unavailable, duplicated, stale or malicious?
- How are schema, protocol, client and server versions upgraded and rolled back?
- What data or control crosses a trust, tenant, device, region or vendor boundary?
- What is the capacity limit and the first safe degradation?
- Can the owner export data and replace the provider/component?
- Which part is novel, and is it isolated behind a stable contract?
- What evidence would justify a more complex architecture—or deleting one?

## References

- [Google Site Reliability Engineering books](https://sre.google/books/)
- [IETF RFC index](https://www.rfc-editor.org/search/rfc_search.php)
- [PostgreSQL documentation](https://www.postgresql.org/docs/)
- [SQLite documentation](https://sqlite.org/docs.html)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Protocol Buffers programming guides](https://protobuf.dev/programming-guides/)
- [OpenTelemetry documentation](https://opentelemetry.io/docs/)
