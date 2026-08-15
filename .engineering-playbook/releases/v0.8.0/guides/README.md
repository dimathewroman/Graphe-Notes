# Engineering Field-Manual Guide Index

`PLAYBOOK.md` is the constitutional core. These guides supply deeper workflows and examples without making every specialist practice mandatory for every project.

Select relevant guides in the project's engineering profile. A guide also becomes relevant when a change enters its stated trigger conditions. Record a short Not Applicable rationale when a normally relevant guide is deliberately skipped.

At the beginning of every material task, compare the project's adopted baseline with the latest stable tagged playbook release. Read the latest version of each trigger-matched guide and record compatible guidance used, guidance deferred, and conflicts requiring a project or owner decision. The project pin remains the reproducible baseline until a separate adoption change updates it; it must not prevent awareness of newer validated practice.

Guide recommendations, standards, tools, risk findings, and professional-review triggers remain subject to the playbook's authority hierarchy and restriction-neutrality rules.

## Default triggers

| Condition | Normally relevant guides |
|---|---|
| Any maintained product | Product lifecycle and quality engineering |
| Any user-facing workflow | Experience/accessibility; platform/language |
| Resizable, rotating, multi-window, foldable, multi-display, or multi-input UI | Adaptive/responsive/foldable; experience/accessibility; platform/language |
| Android-first product, later Apple/desktop/web target, shared-code decision, port, or feature-parity work | Mobile/multiplatform/porting/parity; platform/language; data/storage/file interoperability |
| Private daily driver, beta, public release, durable data, or service dependency | Release/operations/reliability; performance/capacity/compatibility |
| Instrumentation, experiments, pricing, billing, external users, or public claims | Product analytics/monetization; privacy/IP/supply-chain/abuse |
| Persistent data, APIs, networking, background jobs, sync, or multiple components | Software architecture/data/networking |
| API, IPC, event, streaming, device-to-device, provider, agent-tool, or MCP boundary | APIs/MCP/system integration; software architecture/data/networking |
| Local database, cloud sync, import/export, media, document/file interchange, or cross-device transfer | Data/storage/sync/file interoperability; software architecture/data/networking |
| Large on-device collection, full-text/semantic search, tagging, embeddings, media indexing, or RAG | On-device data/indexing/search/RAG; performance/capacity/compatibility |
| Process lifecycle, memory pressure, frame pacing, CPU/GPU/storage bottleneck, thermals, or device-tier adaptation | Device runtime/rendering/resource efficiency; performance/capacity/compatibility |
| GitHub Actions, required checks, releases, repository security, coding agents, or PR automation | GitHub delivery/automation/agent workflows; quality engineering; release/operations/reliability |
| Money, financial data, financial advice, payment or entitlement behavior | Finance engineering/compliance review |
| Encryption, signing, credentials, secure updates, attestation or client hardening | Cryptography/client trust |
| Security testing, reverse engineering, interoperability or public vulnerability intake | Authorized security research |
| New mechanism, unusual architecture, scientific claim, beta cohort or increased exposure | Controlled beta/frontier experimentation |
| Model training/inference, generative output, agents, retrieval or model tools | AI/ML/agent engineering |
| Peripheral, firmware, electronics, radio, sensing, motion or manufactured object | Hardware/software systems and its selected companion guides |

## Product, quality, and operations

| Guide | Use it for | Related templates |
|---|---|---|
| [Product lifecycle, discovery, and design](product-lifecycle-discovery-design.md) | Product framing, research, complete journeys, prototypes, learning and retirement | [Owner Decision Brief](../templates/owner-decision-brief.md), [engineering profile](../templates/engineering-profile.md), [ADR](../templates/adr.md) |
| [Quality engineering and autonomous QA](quality-engineering-autonomous-qa.md) | Test strategy, autonomous QA, controllable environments, flakes and continuous gates | [Quality and verification plan](../templates/quality-and-verification-plan.md) |
| [Experience and accessibility QA](experience-accessibility-qa.md) | UI states, navigation, content, assistive technology, visual and usability evidence | [UI state and journey matrix](../templates/ui-state-and-journey-matrix.md) |
| [Adaptive, responsive, and foldable engineering](adaptive-responsive-and-foldable-engineering.md) | Window-driven composition, shared workflow state, restoration, fold/posture behavior, stateful transitions, and physical-device evidence | [Adaptive continuity plan](../templates/adaptive-continuity-plan.md), [UI state and journey matrix](../templates/ui-state-and-journey-matrix.md), [quality plan](../templates/quality-and-verification-plan.md) |
| [Performance, capacity, and compatibility](performance-capacity-compatibility.md) | Budgets, profiling, load, scale curves, supported-version and contract compatibility | [Quality plan](../templates/quality-and-verification-plan.md), [production readiness review](../templates/production-readiness-review.md) |
| [Release, operations, reliability, support, recovery, and retirement](release-operations-reliability.md) | Release/version identity, deployment, service promises, incidents, support, disaster recovery and decommissioning | [Release versioning policy](../templates/release-versioning-policy.md), [production readiness review](../templates/production-readiness-review.md), [recovery exercise](../templates/recovery-exercise.md), release checklist, incident review |
| [Product analytics, experimentation, and monetization](product-analytics-experimentation-monetization.md) | Metrics, analytics data quality, experiments, pricing, billing, AI economics and growth gates | [Quality plan](../templates/quality-and-verification-plan.md), [frontier experiment record](../templates/frontier-experiment-decision-record.md), [production readiness review](../templates/production-readiness-review.md) |
| [Privacy, IP, supply chain, and abuse](privacy-ip-supply-chain-and-abuse.md) | Personal data, legal review triggers, licensing/provenance, vendors/dependencies, fraud, misuse, user content and moderation | Engineering profile, threat model, production readiness review |

## Software architecture and platforms

| Guide | Use it for | Related templates |
|---|---|---|
| [Software architecture, data, networking, and distributed systems](software-architecture-data-networking.md) | Boundaries, authoritative data, databases, APIs, queues, networks, caches, compatibility and distributed scaling | ADR, system/interface record, resource budget, production readiness review |
| [APIs, MCP, and system integration](apis-mcp-and-system-integration.md) | API/IPC/event contracts, retries and compatibility, interdevice flows, MCP architecture, permissions, security and integration testing | [API and MCP integration record](../templates/api-mcp-integration-record.md), system/interface record, ADR, quality plan |
| [Platform and language engineering](platform-language-engineering.md) | Language/runtime choice; Apple, Android, Windows, Linux, web, cross-platform, FFI, packaging and foundational technology research | Engineering profile, ADR, quality plan |
| [Mobile, multiplatform, porting, and feature parity](mobile-multiplatform-porting-and-parity.md) | Android-first portability, iOS/iPadOS/macOS/web planning, React Native, Flutter, Kotlin Multiplatform, Capacitor/PWA shells, refactoring and parity governance | [Platform portability and parity plan](../templates/platform-portability-and-parity-plan.md), engineering profile, ADR, quality plan |
| [Data, storage, sync, and file interoperability](data-storage-sync-and-file-interoperability.md) | Local/cloud data ownership, SQLite, offline sync, migrations, file formats, HEIC/media, GPU boundaries and cross-device sharing | Platform portability plan, system/interface record, ADR, quality plan |
| [On-device data, indexing, search, and RAG](on-device-data-indexing-search-and-rag.md) | Capacity modeling, blob/metadata/index layout, ingestion, full-text/vector retrieval, tags, media collections and RAG pipelines | [Cross-layer performance and capacity plan](../templates/cross-layer-performance-and-capacity-plan.md), resource budget, system/interface record, quality plan |
| [Device runtime, rendering, and resource efficiency](device-runtime-rendering-and-resource-efficiency.md) | Hardware-to-UX reasoning, lifecycle/IPC, CPU/GPU/memory/storage, frame pacing, thermals, device tiers and evidence-driven optimization | [Cross-layer performance and capacity plan](../templates/cross-layer-performance-and-capacity-plan.md), resource budget, quality plan |
| [GitHub delivery, automation, and agent workflows](github-delivery-automation-and-agent-workflows.md) | Change-aware CI, Actions, rulesets, releases, security features, subagent/PR coordination and repository capability reviews | [CI change-classification plan](../templates/ci-change-classification-plan.md), quality plan, production readiness review |
| [Adaptive orchestrated coding delivery](orchestrated-coding-delivery.md) | Model/risk routing, builder/reviewer topology, task readiness, monitored worktrees, independent review, remediation, integration, and cleanup | [Orchestrated coding task record](../templates/orchestrated-coding-task-record.md), quality plan, owner decision brief |

## Finance, security, AI, and frontier work

| Guide | Use it for | Related templates |
|---|---|---|
| [Finance engineering and compliance review](finance-engineering-and-compliance.md) | Monetary truth, ledgers, imports, reconciliation, payments and current-review triggers | [Finance invariants and reconciliation plan](../templates/finance-invariants-reconciliation-plan.md) |
| [Cryptography, key management, and client trust](cryptography-key-management-and-client-trust.md) | Encryption, signatures, key lifecycle, secure storage, attestation, obfuscation and crypto migration | Threat model, ADR, incident review |
| [Authorized security research](authorized-security-research.md) | Ethical testing, reverse engineering, clean-room interoperability, disclosure programs and bug bounties | Research authorization/scope record in the project; frontier experiment record where applicable |
| [Controlled beta and frontier experimentation](controlled-beta-and-frontier-experimentation.md) | Scientific method, moonshots, unusual architectures, TestFlight/Play cohorts and progressive exposure | [Frontier experiment decision record](../templates/frontier-experiment-decision-record.md) |
| [AI, machine learning, and agent engineering](ai-ml-and-agent-engineering.md) | Conventional ML, generative AI, local models, evaluation, prompting, skills, subagents, quantization and AI economics | Quality plan, frontier experiment record, ADR |

## Computer, embedded, and physical systems

| Guide | Use it for | Related templates |
|---|---|---|
| [Hardware-software systems](hardware-software-systems.md) | Choosing the software/hardware boundary, HS0–HS4 scope, safety, simulation/HIL, bring-up and EVT/DVT/PVT | [System/interface record](../templates/system-interface-record.md), [resource budget](../templates/resource-budget.md), [hazard/compliance record](../templates/hazard-compliance-record.md), [validation phases](../templates/validation-phase-record.md) |
| [Computer platforms](computer-platforms.md) | CPU/memory/ABI behavior, operating systems, filesystems, storage and drivers | System/interface record, resource budget |
| [Embedded electronics](embedded-electronics.md) | MCU/RTOS/firmware, boot/update, power, schematics, PCB and FPGA | [Hardware bring-up](../templates/hardware-bring-up.md), resource budget, validation phases |
| [Connectivity and radio](connectivity-radio.md) | USB and wired buses, networking, Bluetooth/Wi-Fi, RF/SDR, RFID/NFC and IR | System/interface record, hazard/compliance record |
| [Sensing and robotics](sensing-robotics.md) | Cameras, LiDAR, measurement, calibration, control, ROS, simulation and HIL | System/interface record, resource budget, hazard/compliance record |
| [Mechanical design and manufacturing](mechanical-manufacturing.md) | CAD, tolerances, prototyping, additive/CNC/molding, production test and traceability | Resource budget, validation phases, hazard/compliance record |

## Cross-cutting catalog

[Tools and Standards Selection Catalog](TOOLS-AND-STANDARDS.md) provides dated examples, selection questions, common testing tools, AI/local-model options, systems tools and useful GitHub capabilities. It is a discovery aid rather than an approved-vendor list.

## Minimum guide-selection record

- Adopted baseline and latest stable release checked.
- Current lifecycle stage and next gate.
- Operating mode and risk tier.
- Selected guides and why each applies.
- Normally relevant guides marked Not Applicable and rationale.
- Standards/tool facts that need current verification.
- Newer guidance used, deferred, or found incompatible.
- Required templates/evidence and their owners.
- Review date or condition that changes the selection.
