# APIs, MCP, and System Integration

Use this guide when software crosses a component, process, device, network, provider, or agent-tool boundary. An API is a contract, not merely an endpoint. Model Context Protocol (MCP) is one protocol for connecting AI hosts to tools and context; it does not replace product APIs, authorization, or system design.

## Start from the interaction, not the protocol

For each integration, state:

- User or system outcome and why a boundary is needed.
- Producer, consumer, contract owner, authority, trust boundary, and data classes.
- Local function, library, IPC, file, database, event, queue, HTTP, streaming, peer-to-peer, or MCP interaction.
- Online, offline, intermittent, background, and multi-device expectations.
- Latency, throughput, payload, ordering, consistency, durability, cost, and availability budgets.
- Version negotiation, compatibility window, dependency exit, and recovery path.

Prefer the simplest boundary that preserves required ownership and isolation. A remote service adds network, identity, deployment, cost, privacy, and failure modes; an in-process library adds coupling and shared-failure risk.

## Contract anatomy

Every consequential interface should define:

- Stable operation/resource names and identifiers.
- Request, response, event, and error schemas including units, limits, nullability, defaults, and unknown fields.
- Authentication (who are you?), authorization (may you do this?), tenancy, consent, and credential lifecycle.
- Preconditions, validation, idempotency, deduplication, ordering, concurrency, and transaction boundaries.
- Deadlines, cancellation, retry/backoff, rate limits, quotas, pagination, streaming, and backpressure.
- Consistency, cache, freshness, replay, retention, deletion, audit, and reconciliation semantics.
- Observable request/operation identity, safe diagnostics, and data redaction.
- Deprecation, migration, mixed-version, rollback, and dependency-outage behavior.

Document semantics before choosing JSON, Protocol Buffers, REST, gRPC, GraphQL, WebSocket, message broker, or another encoding/transport. Generated schemas and clients reduce mechanical drift but do not define missing behavior.

## HTTP and service APIs

- Use standard HTTP method and status semantics accurately; distinguish safe, idempotent, and non-idempotent operations.
- Give retryable mutations an idempotency key or stable operation identity. Do not blindly retry an unknown write outcome.
- Use conditional requests or explicit revisions when overwriting concurrent state matters.
- Bound list responses and prefer cursor/keyset pagination for large or changing collections.
- Treat timeouts as an end-to-end budget. Propagate deadlines and cancellation instead of letting abandoned work continue indefinitely.
- Apply exponential backoff with jitter and a retry budget; stop retry multiplication across layers.
- Separate synchronous acknowledgement from asynchronous completion and expose status/cancellation for long operations.
- Validate content type, size, structure, compression, redirects, destinations, and response provenance.
- Version behavior compatibly; a `/v2` path does not by itself solve semantic incompatibility.

Use OpenAPI/JSON Schema for HTTP contracts or Protocol Buffers/gRPC where typed binary RPC and streaming fit, but maintain canonical examples, contract tests, and failure cases in either approach.

## Events, queues, sync, and device-to-device flows

Events describe facts that occurred; commands request actions. Name them accordingly.

- Give each logical event a stable identity, source, schema version, timestamp semantics, and correlation/causation identifiers.
- Assume duplicate delivery unless the infrastructure proves otherwise; design consumers to be idempotent.
- Do not claim exactly-once business behavior from transport marketing. Prove deduplication and transaction/reconciliation at the domain boundary.
- Define ordering scope, late/out-of-order behavior, poison-message handling, dead-letter/replay policy, retention, and consumer lag limits.
- Preserve an authoritative state source and a repair/rebuild path when projections, caches, indexes, or peer copies diverge.
- For interdevice transfer, define discovery, pairing, mutual authentication, capability negotiation, resume, conflict, revocation, device loss, and ownership transfer.

Use local-network discovery only as discovery; authenticate the peer and operation separately. Test NAT, IPv4/IPv6, roaming, captive portals, sleep, intermittent radios, clock skew, duplicate peers, and partial transfer.

## MCP mental model

MCP uses a host-client-server architecture and JSON-RPC messages. A server can expose:

- **Tools:** actions the model or host can invoke.
- **Resources:** context the host can read.
- **Prompts:** reusable interaction templates.

The host retains responsibility for user experience, consent, model access, orchestration, and security policy. Capability negotiation establishes what each peer supports; it is not authorization to use every capability.

Choose MCP when an AI host needs a reusable, discoverable connection to changing external tools or context across multiple workflows. Prefer a direct typed function/API when only one application path needs the operation, lower overhead or tighter semantics matter, or no model/host discovery is needed.

### MCP server contract

For each server record:

- Owner, package/source, exact version, transport, endpoint or executable, and update policy.
- Tools/resources/prompts exposed and the minimum subset enabled for this workflow.
- Input/output schemas, read/write effects, idempotency, latency, cost, rate limits, and failure behavior.
- Credential source, scopes, resource/audience restrictions, tenant/account, rotation, and revocation.
- Data sent to the server, retention/training/subprocessor terms, residency, logging, and deletion.
- Prompt-injection, malicious content, confused-deputy, server substitution, URL/redirect, and supply-chain threats.
- User confirmation points, sandboxing, allowlists, output validation, audit trail, cancellation, and kill switch.
- Compatibility/evaluation fixtures and a fallback when the server or host capability is unavailable.

Do not place secrets in prompts, repository files, tool descriptions, or client-side applications. Do not dynamically construct tool authorization from untrusted retrieved text. Treat MCP output as untrusted external data and validate it at the action boundary.

### MCP implementation choices

- Local STDIO servers are convenient and can inherit local-user access; constrain executable provenance, environment, working directory, filesystem, and subprocess permissions.
- Remote streamable HTTP servers require transport security, explicit authentication/authorization, redirect and origin handling, network allowlists where appropriate, and current protocol compatibility.
- OAuth proves delegated access only within granted scopes. Use minimum scopes and bind tokens to the intended resource when supported.
- Expose narrow intent-level tools such as `create_draft_invoice` rather than a generic shell, SQL console, or unrestricted HTTP fetcher.
- Separate read, draft, approve, and commit operations when consequences warrant review.

## Integration testing ladder

1. Schema and deterministic validation tests.
2. Consumer/producer contract tests with canonical examples and error cases.
3. Fake or local implementation for controllable failure injection.
4. Sandbox/test-account integration with realistic auth, quotas, pagination, and webhooks.
5. Mixed-version, timeout, retry, duplicate, reordering, partial-response, and dependency-outage tests.
6. End-to-end representative-device/network journey.
7. Limited release with correlation, reconciliation, support evidence, and rollback/disable path.

Mocks prove caller behavior against the mock. They do not prove the provider, network, credentials, platform lifecycle, or real account configuration.

## Integration decision table

| Need | Start with | Reconsider when |
|---|---|---|
| Same-process reusable logic | Typed library/function | Isolation, independent deployment, or privilege boundary is required |
| Same-device isolated service | Platform IPC | Portability or remote peers become primary |
| Broad client/service interoperability | HTTP API with explicit schema | Streaming, binary size, or RPC tooling has measured value |
| Ordered background work | Durable queue/workflow | Simple synchronous request meets the promise more safely |
| Live bidirectional updates | Stream/WebSocket or platform channel | Polling is adequate and operationally simpler |
| AI host discovers tools/context | MCP | One direct integration is smaller and clearer |
| Nearby peer exchange | Platform proximity/local-network APIs | Relay/cloud is needed for reachability, recovery, or identity |

## Primary references

- [HTTP Semantics, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html)
- [HTTP/3, RFC 9114](https://www.rfc-editor.org/rfc/rfc9114.html)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [Protocol Buffers language guide](https://protobuf.dev/programming-guides/proto3/)
- [MCP architecture](https://modelcontextprotocol.io/specification/2025-06-18/architecture)
- [MCP lifecycle and capability negotiation](https://modelcontextprotocol.io/specification/2025-06-18/basic/lifecycle)
- [MCP authorization](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)
- [Android Binder overview](https://source.android.com/docs/core/architecture/ipc/binder-overview)
- [Apple XPC](https://developer.apple.com/documentation/xpc)

Protocol, provider, and platform details change. Verify the current authoritative specification and exact deployed versions before implementation or release.
