# Platform and Language Engineering

Use this guide when choosing a language, runtime, native/cross-platform strategy, system integration, packaging or distribution target. “Any platform” should mean a repeatable selection method and strong platform-specific evidence—not lowest-common-denominator code everywhere.

When a product starts on one client and may later reach another, also use [Mobile, Multiplatform, Porting, and Feature Parity](mobile-multiplatform-porting-and-parity.md) and its [Platform Portability and Parity Plan](../templates/platform-portability-and-parity-plan.md). When storage, sync, import/export, media, or device transfer crosses platforms, also use [Data, Storage, Sync, and File Interoperability](data-storage-sync-and-file-interoperability.md).

## Select from constraints

Record:

- Target users, devices, operating-system versions, architectures and distribution channels.
- Required native APIs, background behavior, hardware access, UI fidelity, accessibility and offline behavior.
- Performance, startup, memory, binary size, battery, realtime, safety and security constraints.
- Existing code/data formats, libraries, staff/agent expertise, debugging needs and support horizon.
- Build/signing/release infrastructure, licenses, store rules and acceptable cloud/vendor dependency.
- Native escape hatch, interoperability boundary and exit/migration strategy.

Choose the primary language/runtime that owns the hardest platform requirement. Share deterministic domain logic or protocols where it reduces total risk, but do not force native UI, lifecycle, drivers or security boundaries through an abstraction that cannot express them.

## Language choice

| Pressure | Useful families to evaluate | Evidence required |
|---|---|---|
| Platform-first Apple/Android/Windows UI | Swift/Objective-C, Kotlin/Java, C#/.NET or platform C++ | Native API coverage, UX/accessibility, lifecycle, profiling and release evidence |
| Systems, drivers, engines and constrained runtimes | C, C++, Rust, Zig where ecosystem/platform support fits | ABI, memory/concurrency safety, toolchain, latency, binary, debugging and unsafe-boundary review |
| Services and infrastructure | Go, Rust, Java/Kotlin, C#/.NET, TypeScript/JavaScript, Python and others | Throughput/tails, ecosystem, operations, deployment, memory/cost and maintainability |
| Scientific/data/automation | Python, R, Julia, MATLAB, notebooks plus compiled accelerators | Reproducibility, numerical correctness, package/environment and productionization path |
| Web | HTML/CSS/JavaScript/TypeScript; WebAssembly for justified compute/portability | Browser matrix, accessibility, bundle/runtime, security and progressive enhancement |
| Games, creative tools and simulation | C++, C#, Rust, engine scripting, Lua/Python and GPU languages | Engine/platform support, asset pipeline, frame budget, determinism and distribution |
| Embedded and hardware description | C/C++, Rust, vendor languages; Verilog/SystemVerilog/VHDL for logic | Hardware support, timing, memory, certification/toolchain and long-term availability |

No language label guarantees speed, safety or maintainability. Measure the implementation, enforce safe subsets and boundaries, and account for ecosystem and operator skill.

## Native platform profiles

### Apple: iOS, iPadOS, macOS, watchOS, tvOS and visionOS

- Prefer Swift and supported Apple frameworks for new platform-owned behavior; introduce Objective-C/C/C++ interop behind reviewed boundaries where needed.
- Treat UIKit/AppKit and SwiftUI as complementary platform tools when capabilities differ; test lifecycle, state restoration, scenes/windows, background modes, permissions, files, Keychain and accessibility on supported OS/device versions.
- Use XCTest/XCUITest, Instruments, MetricKit, accessibility tools, sanitizers and release/device configurations.
- Record entitlements, privacy manifests/reasons, sandbox access, signing identities, provisioning, notarization, TestFlight/App Store channels and export-compliance review where applicable.
- Preserve symbols/dSYMs and build identity for diagnosis. Verify upgrades, data protection, backup/restore and device migration.

Official starting points: [Apple Developer Documentation](https://developer.apple.com/documentation/), [App distribution](https://developer.apple.com/distribute/), and [App Review Guidelines](https://developer.apple.com/app-store/review/guidelines/).

### Android and ChromeOS

- Prefer Kotlin and supported Jetpack APIs for Android-owned application behavior; isolate Java/native C/C++ and OEM/vendor APIs behind explicit contracts.
- Test activity/process lifecycle, background restrictions, permissions, storage, intents/deep links, notifications, keyboard, accessibility, backup and device/OEM behavior.
- Use Compose/View tests, Espresso/UI Automator, Macrobenchmark, Perfetto, Baseline Profiles, Android vitals and physical target devices as relevant.
- Govern manifest permissions, signing keys, package identity, app links, Play tracks, SDK/target/minimum versions, dynamic delivery and native libraries.

Official starting points: [Android developers](https://developer.android.com/), [Core app quality](https://developer.android.com/docs/quality-guidelines/core-app-quality), and [Google Play policy center](https://play.google.com/about/developer-content-policy/).

### Windows

- Evaluate .NET/C#, WinUI, WPF, Windows App SDK, Win32/C++ and web shells from required OS integration, UI, deployment and existing code.
- Test installer/update, file associations, registry/settings, services/background tasks, multiple displays/DPI, accessibility, sleep/resume and enterprise restrictions.
- Use Visual Studio diagnostics, ETW/WPR/WPA, WinDbg, Windows App Certification Kit and representative architectures.
- Plan code signing, MSIX/installer behavior, Store or enterprise distribution, crash dumps, symbols and rollback.

Official starting point: [Windows application development](https://learn.microsoft.com/windows/apps/).

### Linux and Unix-like systems

- Name supported distributions, kernels, libc, CPU architectures, desktop/display systems, init/service manager and packaging formats.
- Prefer platform/package-manager conventions where practical. Decide among native packages, Flatpak, containers, AppImage/Snap or self-contained binaries from security/update/integration evidence.
- Test permissions, filesystem locations, signals, process supervision, logs, sockets, desktop portals, Wayland/X11 and headless operation as applicable.
- Use GDB/LLDB, sanitizers, `strace`, `perf`, eBPF, system logs, reproducible packaging and signed repositories/artifacts.

Official starting points: [Linux kernel documentation](https://docs.kernel.org/) and the relevant distribution/package specifications.

### Web and servers

- Separate browser, edge, server, job and data responsibilities. Server-side authorization remains authoritative.
- Design HTML semantics, keyboard and assistive technology first; progressively enhance where possible.
- Test supported browsers, responsive states, caching, offline/service workers, hydration/runtime failure, security headers and network degradation.
- For servers, define process model, graceful shutdown, health, configuration, resource limits, deployment, observability and dependency failure.

## Cross-platform strategy

Evaluate Flutter, React Native, Kotlin Multiplatform, .NET MAUI, Qt, Electron, Tauri, game engines or web/PWA delivery using a proof of the hardest native requirement.

Distinguish the choices precisely: React builds web UI; React Native renders native mobile UI through platform components; Capacitor packages a web application in a native runtime and reaches OS capabilities through plugins; a PWA remains browser-delivered; Electron and Tauri are desktop shells with different runtime and security models. A familiar language does not make these delivery models equivalent.

Record:

- Which layers are shared and which remain native.
- Plugin/bridge/FFI ownership, serialization and threading.
- Platform divergence policy and whether native-first behavior may intentionally differ.
- Debugging, profiling, accessibility, release and upgrade behavior per target.
- Framework/vendor update cadence, abandoned-plugin plan and ability to replace the shell.

Shared code is valuable only when it reduces total implementation, testing and maintenance cost without hiding platform truth.

Before committing, spike the hardest required capability—background execution, files, notifications, biometrics, fold continuity, media codec, native extension, billing, Bluetooth/USB/NFC/UWB, graphics, or accessibility—on release-like builds for every near-term target. Share portable truth and deterministic fixtures; allow each platform to own lifecycle, permissions, accessibility, navigation conventions, and experiences that are better when native.

## FFI, ABI, native libraries, and plugins

- Define ownership of memory, threads, callbacks, errors, cancellation and lifecycle across the boundary.
- Pin calling convention, architecture, alignment, symbol visibility and supported binary versions.
- Validate all lengths, pointers, handles and data from less-trusted plugins/native code.
- Use sanitizers, fuzzers and boundary-focused tests. Preserve symbols and crash unwinding.
- Treat a plugin/add-on ecosystem as a supply-chain and permission boundary; sandbox or broker access where practical.

## Packaging and release

- Build release-like artifacts with locked toolchains and dependencies.
- Record version, commit, architecture, minimum OS/runtime, signature, checksum, symbols, licenses/SBOM and provenance.
- Test clean install, upgrade from supported versions, downgrade where supported, uninstall, repair, data preservation/export and rollback.
- Promote the same verified artifact where possible; when signing or configuration changes it, identify and reverify the result.
- Maintain a supported-version policy and end-of-life path for OS, runtime, compiler and application releases.

## When to write a language, runtime, OS, or filesystem

Creating a new foundational technology can be valid research or a product advantage. First state what existing systems cannot provide, then isolate the novel mechanism and test it against a simple baseline.

- A new language needs a semantics/specification, parser/type/runtime model, diagnostics, tooling, interoperability, packages, security and long-term compatibility strategy.
- A runtime or VM needs execution semantics, memory/concurrency model, foreign interface, sandboxing, profiling, debugging and deterministic tests.
- An OS/kernel/driver needs hardware/ABI boundaries, scheduling/memory/I/O, protection, boot/update, crash recovery, observability and hardware evidence.
- A filesystem/storage engine needs an on-disk format, atomicity/durability model, checksums/recovery, concurrency, crash/power-loss testing, tooling, versioning and data migration.

Keep prototypes away from irreplaceable data. Use reference models, differential tests, fuzzing, model checking/formal methods where valuable, emulation and fault injection. Promotion requires documentation and recovery quality comparable to the criticality of the layer being replaced.
