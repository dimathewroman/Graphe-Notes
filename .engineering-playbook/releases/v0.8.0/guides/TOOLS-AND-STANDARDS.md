# Tools and Standards Selection Catalog

| Field | Value |
|---|---|
| Purpose | Help a project discover capable tools without turning popularity into architecture |
| Last broad review | 2026-08-07 |
| Update rule | Recheck the official source, maintenance, license, privacy model, and platform support before consequential adoption |

This is a discovery catalog, not an approved-vendor list. A named tool is an example. Projects select the smallest dependable set that fits their language, platform, operating mode, team, data, risk, and exit needs.

## Selection record

For a material tool, library, model, service, SDK, or standard, record:

- Problem and measurable requirement.
- Alternatives considered, including the platform's built-in capability and doing nothing.
- Supported platforms, versions, architecture, and interoperability requirements.
- Maintenance activity, ownership, maturity, known limitations, and deprecation path.
- License, asset/model/dataset provenance, export or redistribution terms, and commercial-use fit.
- Data received, permissions, network/cloud dependency, retention, training use, and deletion/export behavior.
- Security posture, update channel, vulnerability history, signing/provenance, and privilege required.
- Runtime, binary size, memory, latency, battery, build-time, CI, storage, and financial cost.
- Lock-in, portability, migration/rollback plan, and a smaller fallback.
- Prototype evidence from a representative journey and the decision/review date.

Do not add a dependency merely to avoid writing a small stable function. Do not write a security-, protocol-, parser-, codec-, database-, or cryptography-sensitive subsystem from scratch merely to avoid a well-reviewed dependency. The decision turns on complexity, consequence, evidence, and long-term ownership.

## Core development and collaboration

| Need | Common starting points | Selection notes |
|---|---|---|
| Source control and review | Git, GitHub/GitLab, `gh`/`glab` | Require intentional commits, reviewed diffs, protected credentials, and a recoverable branch/release path. |
| AI coding environments | Codex, GitHub Copilot, Claude Code, Gemini CLI, Cursor and comparable agent/IDE systems | Verify current instructions, skills/plugins/apps/connectors, subagents, worktrees, approvals, data use, plan limits and fallback; capabilities do not transfer between runtimes. |
| Editors and IDEs | VS Code/Codium, JetBrains IDEs, Android Studio, Xcode, Visual Studio | Prefer first-class language/platform debugging, profiling, accessibility, signing, and test support. |
| Reproducible environments | Dev Containers, Docker/Podman, Nix, mise/asdf, language lockfiles and wrappers | Record toolchain versions; containers do not reproduce hardware, OS integration, or every kernel behavior. |
| Task/build orchestration | Native build tools first; Make, Just, Task, Bazel, Buck2, Gradle, Cargo, Nx or Turborepo when justified | Avoid a second orchestration layer until it reduces demonstrated complexity or time. |
| API exploration | `curl`, HTTPie, Bruno, Insomnia or Postman | Store secret-free collections and executable contract examples where useful. |
| Documentation | Markdown, Mermaid, Diagrams as Code, MkDocs, Docusaurus, Sphinx, Fumadocs | Keep architecture and runbooks beside the version they describe. |

## Quality engineering

| Layer | Examples | What it can prove |
|---|---|---|
| Unit and property testing | JUnit/Kotest, pytest/Hypothesis, QuickCheck, fast-check, XCTest | Deterministic rules, invariants and generated edge cases. |
| Integration and contracts | Testcontainers, WireMock, Pact, LocalStack where faithful enough | Real serialization, database, migration and service-boundary behavior. |
| Browser journeys | Playwright, Cypress, WebdriverIO | User-visible browser behavior across engines and degraded networks. |
| Mobile journeys | XCTest/XCUITest, Espresso, Compose tests, UI Automator, Maestro, Appium, Detox | App and system interaction on simulators/emulators and representative physical devices. |
| Mobile build/distribution | Xcode Cloud, TestFlight, Play Console tracks, Firebase App Distribution, Fastlane where maintained value is proven | Test signing, entitlements, package identity, upgrade/data migration, tester access, symbol retention and rollback—not only compilation. |
| Adaptive/foldable transitions | Compose `StateRestorationTester` and `DeviceConfigurationOverride`, `ActivityScenario`, Espresso Device API, Android resizable/foldable emulators, Flutter restoration/widget/integration tests | Boundary rendering, lifecycle restoration, and live configuration transitions; retain physical target-device evidence for OEM and hinge behavior. |
| Visual regression | Playwright screenshots, Storybook/Chromatic, Percy, Paparazzi/Roborazzi | Unexpected rendered differences against governed baselines; not usability or correctness by itself. |
| Accessibility | axe-core, Accessibility Scanner, Accessibility Inspector plus VoiceOver, TalkBack and keyboard/switch/manual review | Automated violations and assistive-technology behavior; no tool alone establishes accessibility. |
| Performance | Benchmark.js/JMH, Android Macrobenchmark/Perfetto, XCTest metrics/Instruments, Lighthouse/WebPageTest | Comparable latency, rendering, resource and journey evidence under a controlled harness. |
| Load and resilience | k6, Locust, JMeter, Toxiproxy, Chaos Mesh, Litmus | Capacity curves, saturation, retry, degradation and recovery behavior. |
| Fuzzing and mutation | libFuzzer, AFL++, cargo-fuzz, Jazzer, Schemathesis, PIT, Stryker | Unexpected input failures and whether tests detect deliberately introduced defects. |
| Security testing | CodeQL, Semgrep, dependency scanners, OWASP ZAP, Burp Suite, MobSF | Candidate weaknesses requiring triage and authorized confirmation; scanners do not prove security. |
| Device/browser farms | Firebase Test Lab, BrowserStack, Sauce Labs, AWS Device Farm | Broader compatibility evidence; verify data handling, cost and fidelity first. |

## Application, data and operations

| Area | Common starting points | Selection notes |
|---|---|---|
| Web UI | Platform HTML/CSS/JS, React/Next.js, Vue/Nuxt, Svelte/SvelteKit | Prefer accessible platform semantics, measured bundles, clear server/client boundaries and an exit path from framework-specific features. |
| Apple applications | Swift, SwiftUI/UIKit/AppKit, Swift Package Manager, XCTest, Instruments, MetricKit | Use platform security, background, distribution and accessibility facilities before replacing them. |
| Android applications | Kotlin, Jetpack Compose/Views, AndroidX, Material 3 Adaptive, Jetpack WindowManager, Room/SQLDelight, WorkManager, Macrobenchmark, Perfetto | Drive presentation from current window constraints; test OEM, background, folding, combined transitions, process death and real-device behavior. |
| Cross-platform UI and logic | Flutter, React Native, Kotlin Multiplatform, .NET MAUI | Select from required native capability, staffing, performance, debugging and platform-divergence evidence—not code-sharing percentage alone. KMP can share logic while retaining native UIs. |
| Web-native/mobile shells | Capacitor and comparable maintained runtimes | Best suited to a proven responsive web product whose hardest native capabilities, WebView behavior, plugins, files, keyboard, navigation, offline mode, background limits and store release have been spiked. |
| Web/desktop delivery | PWA; Electron, Tauri or native desktop frameworks when browser delivery is insufficient | Choose from offline/install/update, filesystem, background, security, binary/resource, accessibility and OS-integration evidence. Do not treat a desktop shell as a free security boundary. |
| Local structured data | SQLite, Room, Core Data/SwiftData, SQLDelight, Realm when justified | Specify transactions, migrations, durability, encryption, backup, corruption and export behavior. |
| Data/file interchange | JSON/JSON Schema, CSV with a declared dialect, Protocol Buffers, ZIP/package manifests, platform type registries | Version syntax and meaning; validate media type, magic/signature, size, structure and paths; maintain canonical fixtures and round-trip tests. |
| Image/media interoperability | HEIF/HEIC, JPEG, PNG, WebP, AVIF and platform codec APIs | Preserve originals when fidelity/provenance matters, create explicit compatible derivatives, bound decode resources, govern metadata/privacy and test exact OS/device codec support. |
| Service databases | PostgreSQL as a common relational default; document-specific, time-series, graph or vector stores only for demonstrated access patterns | Model correctness and operations first; benchmark realistic data and keep a migration/export path. |
| Cache and queues | In-process caches, Redis/Valkey, NATS, RabbitMQ, Kafka/Redpanda, managed equivalents | Define source of truth, delivery semantics, idempotency, ordering, retention, replay and overload behavior. |
| API contracts | OpenAPI, JSON Schema, Protocol Buffers/gRPC, AsyncAPI | Version syntax and behavior; test backward/forward compatibility and unknown fields. |
| Agent-tool/context protocol | Model Context Protocol SDKs and Inspector | Expose only needed tools/resources/prompts; verify transport, auth scopes, data handling, schemas, effects, prompt-injection defenses and current protocol compatibility. |
| On-device structured/full-text data | SQLite, Room/Core Data/SwiftData as platform-appropriate, SQLite FTS5 | Inspect query plans; budget WAL/temp/migrations/indexes; test process death, low storage, rebuild and delete propagation. |
| Vector retrieval | Exact vector baseline; Faiss or platform-supported ANN implementations | Choose from measured recall, latency, RAM, storage, update/delete, licensing and target-platform support; an ANN index is not automatically a RAG system. |
| Android whole-system performance | Macrobenchmark, Baseline Profiles, Perfetto, Android Studio profilers, JankStats/FrameMetrics as applicable | Trace a real journey across app, scheduler, Binder, I/O, graphics and thermals on release-like physical devices. |
| Apple whole-system performance | XCTest metrics, Instruments, MetricKit, Xcode memory/energy/Metal tools | Distinguish launch, hangs, memory, CPU/GPU, I/O, energy and field behavior on supported hardware. |
| Native/system performance | perf, ftrace, eBPF, Instruments, ETW/WPA, platform GPU tools | Start with an end-to-end deadline and preserve traces/counters; never infer the bottleneck from one utilization number. |
| Infrastructure | Terraform/OpenTofu, Pulumi, cloud-native templates, Ansible | Review plans, state protection, least privilege, drift, rollback and provider exit. |
| Packaging and scheduling | Managed functions/services first when adequate; containers/Kubernetes only when their operating value exceeds their complexity | Measure availability, cold start, scaling, cost and operator burden. |
| Observability | OpenTelemetry, platform diagnostics, Prometheus/Grafana, Sentry or comparable managed services | Start from actionable service promises and an approved data allowlist, not maximal collection. |

## AI, machine learning and intelligent behavior

| Need | Examples | Notes |
|---|---|---|
| Statistical and classical ML | scikit-learn, XGBoost, LightGBM, statsmodels | Often smaller, faster, deterministic and easier to validate than an LLM for tabular prediction, ranking, anomaly detection or forecasting. |
| Training and research | PyTorch, JAX, TensorFlow/Keras | Require dataset provenance, reproducible splits, baselines, experiment tracking and independent evaluation. |
| Model ecosystems | Hugging Face Transformers/Datasets/Safetensors, ONNX | Verify model card, license, architecture, tokenizer, preprocessing, hashes and executable/custom code. |
| Local inference | llama.cpp, MLX, ONNX Runtime, Core ML, TensorFlow Lite/LiteRT, ExecuTorch, platform accelerators | Benchmark the exact quantization, context, task, hardware, thermal state, memory and quality—not parameter count alone. |
| Model serving and routing | vLLM, TensorRT-LLM, managed model APIs, gateway/router layers | Control model/version, quotas, fallbacks, privacy, residency, latency, cost and output compatibility. |
| Evaluation | Versioned task datasets, deterministic validators, pairwise/human review, lm-evaluation-harness or task-specific frameworks | Measure the real task, critical failures, variance and regressions; public benchmarks are orientation, not product acceptance. |
| Agent systems | Explicit state machines/workflows, isolated subagents, tool schemas, least-privilege sandboxes, durable checkpoints | Add autonomy only where decomposition, verification and rollback outperform a simpler deterministic workflow. |

Intelligent behavior need not use AI or a remote API. Rules, search, constraints, optimization, signal processing, control theory, statistics, recommendation heuristics, local indexes and conventional ML may produce a better product with lower cost and risk.

## Systems, electronics and physical creation

| Need | Examples | Notes |
|---|---|---|
| Native/system debugging | LLDB/GDB, `perf`, eBPF, Instruments, ETW, Compiler Explorer, `objdump`/`readelf` | Preserve symbols and exact build identity; profile before optimizing. |
| Emulation and simulation | QEMU, Renode, gem5, ngspice/LTspice, Verilator, Gazebo | Models accelerate learning but do not prove real timing, RF, thermal, mechanical or sensor behavior. |
| Embedded firmware | Zephyr, FreeRTOS, ESP-IDF, vendor SDKs, PlatformIO, OpenOCD/pyOCD/J-Link | Select by hardware support, timing, update, debugging, licensing, safety and long-term ownership. |
| PCB and electronics | KiCad, Altium/Cadence tools, ngspice, vendor reference designs | Run ERC/DRC, review power/signal/thermal behavior, component lifecycle and production test access. |
| FPGA | Verilator, Yosys/nextpnr/SymbiYosys, Vivado, Quartus | Require simulation, timing constraints, CDC review and hardware evidence. |
| Mechanical/CAD | FreeCAD, OpenSCAD/CadQuery, Onshape, Fusion, SolidWorks, Blender | Preserve parametric sources, units, tolerances, revisioned drawings and neutral exchange formats. |
| Robotics and sensors | ROS 2, micro-ROS, OpenCV, Open3D/PCL, GStreamer, vendor SDKs | Define coordinate frames, timing, calibration, uncertainty and independent safe states. |
| Protocol and RF inspection | Wireshark, USBPcap/usbmon, sigrok/PulseView, Saleae, GNU Radio, SDR++, rtl-sdr, HackRF/USRP, NanoVNA | Work on owned/authorized systems; transmit only within applicable authorization, bands and controlled test conditions. |
| Physical instruments | DMM, current-limited supply, oscilloscope, logic/protocol analyzer, electronic load, thermal camera, spectrum analyzer and VNA | Record probe point, configuration, hardware/firmware revision, expected and observed results. |

## Design, product and research

- Whiteboards, paper, Figma/Penpot/Sketch and coded prototypes answer different questions; choose the cheapest artifact that exposes the current uncertainty.
- Storybook or an equivalent component lab can expose states and accessibility independently from full navigation.
- Product analytics tools such as PostHog, Amplitude or Mixpanel are optional measurement systems, not permission to collect everything; the telemetry privacy gate still governs.
- Experiment notebooks may use Jupyter/Quarto/R Markdown, but production claims need versioned data, code, environment, seeds, statistics, artifacts and an independent reproduction path.
- CAD renders and simulations are design evidence, not proof of manufacturability, safety, tolerance, finish or physical performance.

## GitHub capabilities worth evaluating

Use [GitHub Delivery, Automation, and Agent Workflows](github-delivery-automation-and-agent-workflows.md) and the [CI Change-Classification Plan](../templates/ci-change-classification-plan.md) before adding bespoke automation.

- Repository rulesets, protected environments, required checks, merge queue and CODEOWNERS for important branches and deployments.
- GitHub CLI for reproducible issue, PR, release, workflow and API operations.
- Issue forms, PR templates, sub-issues/milestones and saved searches for consistent intake and traceability.
- Dependabot or another reviewed dependency-update service with grouped updates and bounded automation.
- Code scanning, dependency review, secret scanning/push protection, private vulnerability reporting and security advisories where the plan supports them.
- Actions concurrency controls, minimal token permissions, reusable workflows, environment approvals, dependency caching, artifact retention and attestations.
- An always-running semantic change classifier with job-level conditions, explicit reasons/overrides, conservative unknown handling and separate integration/release gates so governance-only changes do not compile unrelated apps.
- OpenID Connect for short-lived cloud credentials instead of long-lived deployment secrets where supported.
- Release notes, immutable releases where available, signed tags/commits and artifact checksums/provenance.
- Dev Containers/Codespaces for a documented onboarding environment when cloud development is acceptable.
- Copilot repository instructions, custom agents/plugins and coding-agent review workflows where the current plan/runtime supports them; keep the repository's canonical `AGENTS.md` authoritative and avoid divergent instruction copies.

Start with the repository and plan's actual capabilities. If a control is unavailable, record the limitation and use a proportionate local/CI/manual substitute rather than claiming it is enabled.

Official starting references:

- [GitHub Actions security](https://docs.github.com/en/actions/security-for-github-actions/security-guides/security-hardening-for-github-actions)
- [GitHub artifact attestations](https://docs.github.com/en/actions/security-for-github-actions/using-artifact-attestations)
- [OpenSSF Scorecard](https://scorecard.dev/)
- [NIST Secure Software Development Framework](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP project catalog](https://owasp.org/projects/)
