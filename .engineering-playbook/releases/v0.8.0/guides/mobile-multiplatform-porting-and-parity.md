# Mobile, Multiplatform, Porting, and Feature Parity

Use this guide when a product begins on one platform but may later support Android, iOS/iPadOS, macOS, Windows, Linux, or the web. Also use it when choosing native apps, React Native, Flutter, Kotlin Multiplatform, a progressive web app, or a web container such as Capacitor.

The objective is not maximum shared code. It is one coherent product with portable truth, deliberate platform experiences, and a controlled cost of adding each target.

## Start with a platform horizon

Before foundations harden, record:

- First platform and why it is first.
- Likely next platforms, earliest decision point, and what evidence would justify each.
- Required native capabilities: background work, notifications, files, biometrics, payments, camera/media, foldables, widgets, share extensions, Bluetooth/USB/NFC/UWB, GPU, accessibility, and offline operation.
- Which behavior must be identical, which should feel native, and which can be unavailable with an owner-visible explanation.
- Shared-code candidate layers, native escape hatches, build/signing hardware, store channels, supported OS versions, and ongoing maintenance budget.
- Data migration, account identity, deep-link, subscription/entitlement, import/export, and continuity requirements between platforms.

Use the [Platform Portability and Parity Plan](../templates/platform-portability-and-parity-plan.md) before selecting a cross-platform framework or beginning a port.

## Recommended Android-first shape

For an Android-first product that values foldables, Android system capabilities, strong offline behavior, and a later high-quality Apple client:

1. Build Android-owned UI and lifecycle behavior with Kotlin and Jetpack Compose when that best fits the first product.
2. Keep financial/domain rules, identifiers, validation, state machines, import normalization, sync contracts, and deterministic fixtures free of Android UI dependencies.
3. Put platform services—permissions, notifications, secure storage, background scheduling, files, sharing, billing, biometrics, sensors, and graphics—behind narrow capability interfaces.
4. If iOS becomes real, first prove a vertical slice with SwiftUI and native Apple lifecycle/accessibility. Evaluate Kotlin Multiplatform for already-proven domain/data logic rather than converting the whole codebase preemptively.
5. Give web/desktop clients the same behavioral contracts, schemas, fixtures, and API semantics. Do not require them to share the mobile presentation implementation.

This preserves the best first-platform experience while keeping later ports from re-inventing product truth.

## Delivery strategy comparison

| Strategy | Strong fit | Main risks and proof required |
|---|---|---|
| Native Kotlin/Compose plus Swift/SwiftUI | Deep OS integration, foldables, background work, highest platform fidelity | Two UIs and lifecycle implementations; share specifications, fixtures, APIs, and optionally domain/data code |
| Kotlin Multiplatform | Android-first products that want shared Kotlin business/data logic with native UIs | Swift interop, concurrency, framework packaging, library target support, and debugging must be proven |
| React Native | Teams with strong React/TypeScript skills that want substantial Android/iOS UI and logic sharing | Native module/plugin health, bridge/JSI boundaries, startup, threading, upgrades, platform divergence, and web parity |
| Flutter | Products that benefit from a highly shared custom UI and consistent rendering | Native plugin boundaries, platform conventions/accessibility, engine size, lifecycle, text/input, and platform-specific integration |
| Capacitor or similar web-native shell | Existing responsive web app, forms/content/CRUD, rapid store packaging, modest native needs | WebView performance, offline assets, navigation, keyboard, background limits, plugin quality, permissions, files, deep links, and store behavior |
| PWA | Broad web/desktop reach, instant updates, installable offline-capable experience where browser APIs suffice | Capability and installation differences by browser/OS, background and store limitations, storage eviction, and offline/update correctness |
| Electron | Rich web-based desktop app needing Node/desktop APIs and mature ecosystem | Chromium/Node footprint and update burden; strict renderer isolation, IPC validation, sandboxing, and content security |
| Tauri or another system-webview shell | Smaller desktop wrapper with a Rust/native command boundary | WebView variation, plugin maturity, updater/signing, command allowlists, and native debugging |
| .NET MAUI, Qt, game engines, or other stacks | Existing expertise or a product whose hardest requirement matches the ecosystem | Prove target support, native escape hatch, accessibility, packaging, profiler quality, and long-term maintenance |

React and React Native share concepts and may share TypeScript domain code, schemas, network clients, and selected utilities. React renders web DOM; React Native renders native-platform components. Do not assume React components, CSS, browser libraries, or storage APIs are portable without an explicit adapter.

Capacitor packages a web application inside native projects and exposes native capabilities through plugins. Treat every plugin as a native dependency and permission boundary. Keep a browser implementation or graceful unavailable state for each capability, and test the packaged app rather than accepting browser success as mobile evidence.

## Apple platform planning

- Use Swift and supported Apple frameworks for Apple-owned behavior. SwiftUI can share substantial code across iOS, iPadOS, and macOS while allowing platform-specific scenes, commands, navigation, input, and windows.
- Choose among an iPad app on Apple silicon Mac, Mac Catalyst, a SwiftUI multiplatform target, or a dedicated AppKit/macOS target from actual desktop requirements—not from the desire to check a box.
- Keep UIKit/AppKit interop available where SwiftUI does not express a required capability or where an incremental port is safer.
- Plan Xcode/macOS availability, signing identities, provisioning, entitlements, privacy manifests/reason APIs, Keychain, app groups, CloudKit/iCloud, background modes, App Store review, TestFlight, notarization, symbols/dSYMs, and export-compliance review where applicable.
- Test iPhone and iPad size classes, multitasking/windows, keyboard/pointer, external display, accessibility, background/termination, data protection, device migration, and restore. An iPhone UI merely stretched on iPad is not an iPad-quality port.

## Port by contracts, not screenshots

Before a port:

1. Capture current behavior with characterization tests, domain fixtures, screenshots/recordings where useful, API/schema contracts, and a parity ledger.
2. Separate portable product rules from framework, lifecycle, storage, and OS integration. Refactor in small behavior-preserving steps; do not combine a full architecture rewrite with the port.
3. Select one representative vertical slice that crosses UI, local data, sync, files, accessibility, and a difficult native capability.
4. Build it in the target platform and compare both clients against the same fixtures and acceptance scenarios.
5. Add shared code only where the evidence shows lower total implementation, testing, and maintenance cost.
6. Migrate users/data with versioned formats, stable identifiers, compatible server contracts, and a rollback or coexistence period.
7. Expand feature by feature, retaining explicit ahead/behind/blocked status rather than claiming parity from screen count.

Useful refactoring sequence:

> Characterize → isolate seam → add/strengthen contract → move one responsibility → compare behavior/performance → remove old path only after proof

Use branch-by-abstraction or a strangler-style adapter for large replacements. Keep old and new implementations runnable against the same contract long enough for differential tests. Temporary adapters and flags need owners and removal conditions.

## Feature parity ledger

Parity is behavioral, not pixel-identical. Track each capability as:

- **Contract parity:** same domain meaning, data, authorization, failure, and recovery semantics.
- **Experience parity:** same user outcome with platform-appropriate navigation, controls, typography, gestures, input, sharing, and accessibility.
- **Platform enhancement:** intentionally better on a platform because hardware or OS capability permits it.
- **Unavailable:** unsupported with reason, user-visible fallback, consequence, owner decision, and revisit trigger.
- **In progress or divergent:** named gap, owner, evidence, and target rather than an ambiguous parity percentage.

For each feature, test account/data identity, offline/reconnect, import/export, deep link, notification, background, accessibility, adaptive layout, permission denial/revocation, upgrade, and recovery on each supported platform.

## Platform capability boundary

Define a narrow contract for every capability that differs by OS:

- Interface and domain-level result/error types.
- Android, Apple, web, desktop, and test implementations.
- Threading, lifecycle, cancellation, permission, and background behavior.
- Security and data exposed to the plugin/bridge.
- Supported/unsupported state and user-facing fallback.
- Contract tests plus target-specific integration and device tests.

Do not reduce the contract to the weakest platform automatically. Preserve a common core and allow explicit platform extensions when they create real value.

## Build, test, and release topology

- Run portable unit/contract tests on inexpensive runners for every relevant change.
- Run Android compile/instrumented checks only when Android inputs or shared runtime contracts change; run Apple builds on macOS only for Apple/shared-boundary changes.
- Keep a small cross-platform smoke suite against the same synthetic account and fixtures.
- Use release-candidate matrices and physical devices for lifecycle, OEM, media, GPU, permission, notification, store, and background behavior.
- Build iOS with a supported macOS/Xcode environment. GitHub-hosted macOS runners or Xcode Cloud can automate builds, but neither replaces TestFlight and target-device acceptance.
- Keep signing and store credentials scoped to protected release environments, never ordinary pull requests or agent workspaces.

## Completion evidence

- Approved platform horizon and framework decision with hardest-capability spike.
- Layer-sharing map and capability interfaces.
- Parity ledger and common acceptance fixtures.
- Versioned data/API/file migration plan.
- Per-platform build, device, accessibility, performance, release, and rollback evidence.
- Known platform gaps and owner-visible consequences.

## Official starting points

- [Android app architecture](https://developer.android.com/topic/architecture)
- [Android modularization](https://developer.android.com/topic/modularization)
- [Kotlin Multiplatform for Android and iOS](https://developer.android.com/kotlin/multiplatform)
- [Apple SwiftUI apps](https://developer.apple.com/documentation/technologyoverviews/swiftui)
- [Apple multiplatform app targets](https://developer.apple.com/documentation/xcode/configuring-a-multiplatform-app-target)
- [React Native platform-specific code](https://reactnative.dev/docs/platform-specific-code.html)
- [Capacitor documentation](https://capacitorjs.com/docs)
- [Progressive Web Apps](https://web.dev/learn/pwa/)
- [Electron process model and security](https://www.electronjs.org/docs/latest/tutorial/process-model)
- [Flutter add-to-app](https://docs.flutter.dev/add-to-app)
