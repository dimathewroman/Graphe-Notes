# Device Runtime, Rendering, and Resource Efficiency

Use this guide when app behavior depends on process lifecycle, CPU/GPU work, memory pressure, storage I/O, display timing, thermals, battery, virtualization, or large differences between devices. Pair it with the performance, platform, adaptive-layout, data, and hardware guides as applicable.

The objective is not maximum benchmark performance. It is predictable user-visible behavior within declared latency, memory, energy, temperature, storage, and compatibility budgets.

## The cross-layer mental model

Trace a critical interaction through the whole system:

> input or event -> OS dispatch -> app process/thread -> domain and data work -> CPU/GPU commands -> frame or response queue -> display, storage, radio, or peripheral -> user-visible result

Every arrow can queue, copy, block, retry, allocate, wake hardware, cross a trust boundary, or fail. Optimize the longest or most variable part of the real critical path, not the component with the most impressive standalone metric.

For each important journey, record:

- Trigger, completion boundary, deadline, and acceptable degraded result.
- Work performed on the UI/main thread, worker threads, other processes, GPU, accelerator, storage, network, and remote services.
- Bytes allocated, copied, decoded, uploaded, persisted, transferred, and retained.
- Queues, locks, retries, caches, synchronization points, and cancellation paths.
- Cold, warm, hot, background, restored, offline, low-memory, low-power, and thermally constrained behavior.
- Representative low, middle, and high device tiers plus fold, resize, refresh-rate, and input variants where relevant.

## Hardware fundamentals for application decisions

### Compute and heat

Transistors implement switching and storage. Switching activity and leakage consume energy and produce heat. Voltage, frequency, active units, workload shape, silicon design, cooling, and ambient conditions interact; a higher clock number does not establish faster sustained app behavior.

- CPU performance depends on instructions per cycle, clocks, cores, caches, memory stalls, branch behavior, operating-system scheduling, and thermals.
- GPUs execute highly parallel graphics or compute work efficiently when data layout and workload fit them. Command preparation, synchronization, transfers, occupancy, bandwidth, overdraw, shader cost, and driver behavior can dominate.
- NPUs, DSPs, and media engines can reduce latency or energy for supported operations, but transfer, conversion, availability, and fallback costs remain part of the product path.
- Cooling determines how long peak performance can be sustained. Benchmark long enough to reveal throttling, battery effects, and skin-temperature constraints.

### Working memory

Registers and caches are small and fast; DRAM is larger and slower; storage is persistent and much slower. Applications normally control algorithms, allocation, locality, object lifetime, concurrency, and data layout—not raw DRAM timings directly.

- Treat RAM as a shared, pressure-sensitive working set, not a promised fixed allocation.
- Budget native, managed, graphics, decoded media, database cache, model weights, mapped files, WebView/runtime, and operating-system-visible memory.
- Avoid retaining full-resolution media or duplicate representations when a thumbnail, stream, tile, or bounded working set is sufficient.
- Allocation churn and garbage collection can create pauses and extra CPU work. Measure before introducing object pools or manual memory complexity.
- Assume the OS can reclaim caches and terminate background processes. Persist durable workflow state and make restoration idempotent.

DRAM frequency and latency numbers can matter in low-level benchmarking, but app teams should first measure cache misses, memory bandwidth, page faults, allocation/GC, copying, and the end-to-end user path.

### Persistent storage

Mobile flash, SSDs, and NVMe/UFS devices expose storage through controllers, queues, caches, translation layers, and filesystems. NAND is written and erased in larger units than many app writes, so small random writes, forced flushes, low free space, and write amplification can hurt latency and endurance.

- Distinguish sequential throughput from random and tail latency.
- Batch and transact related writes without weakening durability requirements.
- Keep recovery headroom for write-ahead logs, temporary files, compaction, migrations, downloads, and rollback.
- Define what “saved” means: accepted into memory, committed to a database transaction, flushed through the filesystem, or recoverable after sudden power loss.
- Test full storage, corruption, interrupted migration, slow media, reinstall/restore, and cleanup.

### Virtualization and KVM

Clarify the term: KVM can mean Linux Kernel-based Virtual Machine or a keyboard/video/mouse switch. Virtual machines add guest scheduling, virtual memory, and virtual I/O layers; they are useful for isolation, compatibility, and test matrices but can change timing and hardware access. Benchmark the real deployment path, and never infer physical-device behavior only from a VM or emulator.

## Processes, threads, and on-device communication

Operating systems isolate apps and services into processes. Communication may use function calls, shared memory, files/databases, sockets, message queues, Android Binder/AIDL, Apple XPC, intents, platform services, or framework-specific channels.

For every process boundary:

- Name the contract owner, schema/version, identity and authorization model.
- Account for serialization, validation, copying, context switches, queueing, timeouts, cancellation, process death, and restart.
- Keep calls bounded; avoid synchronous cross-process work on a UI thread.
- Make retries idempotent or give operations stable identities and explicit reconciliation.
- Apply backpressure rather than building unbounded queues.
- Treat peer input as untrusted even when it originates on the same device.

Do not create a process or IPC boundary merely for architectural neatness. Use it for isolation, platform requirements, independent lifecycle, privilege separation, or a measured operational benefit.

## App lifecycle is part of correctness

Mobile and desktop systems may pause, stop, suspend, evict, or recreate app components because of navigation, resizing, folding, memory pressure, power policy, updates, or user action.

- Separate durable domain/workflow state from one screen instance and from ephemeral rendering state.
- Save drafts and checkpoints at meaningful boundaries, not only during graceful shutdown.
- Make background work explicit, resumable, constrained, observable, and compatible with platform limits.
- Reconnect resources after process or service restart; do not assume sockets, handles, callbacks, or in-memory locks survive.
- Test kill-and-restore, low-memory eviction, background/foreground, permission revocation, network transition, rotation, resize, fold/unfold, and multi-window together.

## Rendering, animation, and frame timing

A smooth animation is a sequence of consistently presented frames with responsive input, not merely a high average FPS. A display at 60 Hz has about 16.7 ms between refreshes; 90, 120, or variable refresh rates change that interval. The app, compositor, GPU, and display pipeline may overlap work, so the actionable question is which stage missed its deadline and why.

For interactive UI:

- Keep expensive I/O, parsing, database work, image decoding, and model inference off the UI/main thread.
- Stabilize layout and avoid unnecessary recomposition, invalidation, measurement, paint, blending, and overdraw.
- Decode and upload media at the size needed; paginate, virtualize, tile, prefetch narrowly, and cancel obsolete work.
- Prefer transform/opacity-style animation paths when the platform can composite them cheaply, but verify semantics, accessibility, memory, and visual quality.
- Respect reduced-motion settings and preserve meaningful focus, input, and state across adaptive changes.
- Measure input-to-photon latency, frame-duration distributions, missed deadlines, CPU and GPU time, queue depth, memory traffic, and thermal drift—not average FPS alone.

GPU scheduling is mediated by platform drivers and command queues. Applications submit work and synchronize dependencies; they do not generally own the physical scheduler. Excessive command buffers, state changes, barriers, transfers, queue stuffing, or CPU/GPU synchronization can add latency even when utilization looks low.

## Device tiers and graceful adaptation

Define capabilities from measured constraints rather than model-name folklore:

| Tier dimension | Possible adaptation |
|---|---|
| Memory/working set | Smaller caches, fewer retained screens, lower-resolution media, smaller model or no local model |
| CPU/GPU throughput | Lower visual complexity, bounded concurrency, cheaper effects, reduced simulation or inference rate |
| Thermal/energy | Sustainable frame/inference rate, batch background work, pause nonessential processing |
| Storage/free space | Stream or evict derivatives, compact indexes, decline large downloads with a clear recovery path |
| Network quality | Local-first behavior, resumable transfer, adaptive media, queued sync, visible degraded mode |
| Display/posture/input | Window-class composition, shared workflow state, appropriate controls, keyboard/mouse/stylus support |

Feature detection and runtime measurement are usually safer than hard-coded device lists. Never silently reduce correctness, privacy, accessibility, or financial integrity as a performance adaptation.

## Optimization ladder

Apply the least complex effective step:

1. Remove unnecessary work, data, copies, waits, wakeups, and retries.
2. Choose the right algorithm, query, index, data shape, media representation, or lifecycle boundary.
3. Bound the working set; stream, page, tile, cache, batch, debounce, coalesce, or precompute where evidence supports it.
4. Schedule work at the correct priority and thread/process; add cancellation and backpressure.
5. Use hardware acceleration or specialized libraries after measuring transfer and integration cost.
6. Add native/vectorized/parallel code only around a proven hot path with correctness and portability tests.
7. Change architecture or hardware only when earlier evidence shows the existing boundary cannot meet the user promise.

Re-measure end to end after every material optimization. Faster compute that increases startup, heat, memory, battery use, or complexity may be a net regression.

## Evidence workflow

1. Define the user journey and resource budgets in a Cross-Layer Performance and Capacity Plan.
2. Capture a release-like trace on representative hardware.
3. Mark time spent and queueing at UI, CPU, GPU, memory, storage, IPC, radio/network, and service layers.
4. Identify one falsifiable bottleneck hypothesis.
5. Make one material change and compare distributions, correctness, energy, temperature, and degraded behavior.
6. Soak long enough to expose leaks, compaction, throttling, cache growth, and retry accumulation.
7. Add a regression guard at the narrowest reliable layer plus periodic end-to-end physical-device evidence.

## Primary references

- [Android processes and app lifecycle](https://developer.android.com/guide/components/activities/process-lifecycle)
- [Android memory overview](https://developer.android.com/topic/performance/memory-overview)
- [Android performance measurement](https://developer.android.com/topic/performance/measuring-performance)
- [Android graphics architecture](https://source.android.com/docs/core/graphics/architecture)
- [Android Frame Pacing](https://developer.android.com/games/sdk/frame-pacing)
- [Android Binder overview](https://source.android.com/docs/core/architecture/ipc/binder-overview)
- [Apple app lifecycle](https://developer.apple.com/documentation/uikit/managing-your-app-s-life-cycle)
- [Apple XPC](https://developer.apple.com/documentation/xpc)
- [Apple Metal command queues](https://developer.apple.com/documentation/metal/mtlcommandqueue)
- [Linux KVM API](https://docs.kernel.org/virt/kvm/api.html)
- [NVM Express specifications](https://nvmexpress.org/specifications/)

Platform behavior changes. Verify the exact OS, framework, device, driver, and release build used by the product.
