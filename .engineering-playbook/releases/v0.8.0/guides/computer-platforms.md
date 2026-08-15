# Computer Architecture, Operating Systems, Filesystems, and Drivers

For application-level local databases, synchronization, import/export, media formats, GPU/accelerator selection, and cross-device sharing, pair this systems guide with [Data, Storage, Sync, and File Interoperability](data-storage-sync-and-file-interoperability.md).

Use this guide when correctness or performance depends on processors, kernels, storage semantics, device I/O, or platform drivers.

For app lifecycle, IPC, CPU/GPU/memory/storage-to-UX reasoning, rendering, thermals, and device tiers, use [Device Runtime, Rendering, and Resource Efficiency](device-runtime-rendering-and-resource-efficiency.md).

## Plain-English component map

- **Transistors and logic:** physical switches compose gates, registers, caches, processors, controllers, and memory. Their switching and leakage consume energy and create heat.
- **CPU:** general-purpose execution. Clock rate is only one input; instruction work, cache/locality, memory stalls, scheduling, power, and cooling shape sustained results.
- **GPU/accelerators:** parallel or specialized work. They help only when the workload, supported operations, transfer cost, drivers, and fallback fit.
- **SRAM/cache and DRAM/RAM:** progressively larger working memory with different latency, bandwidth, energy, and sharing behavior. App-visible locality and allocation often matter before raw timing specifications.
- **Flash/SSD/UFS/NVMe:** persistent media plus controllers, caches, queues, translation, error correction, wear management, and filesystem layers. Throughput does not predict every small random or durable write.
- **Motherboard/system board:** power, clocks, interconnects, controllers, firmware, sensors, cooling, connectors, and signal integrity make components a system.
- **Cooling and power delivery:** determine stable operating limits. Short benchmark bursts can conceal throttling, voltage/current limits, noise, or battery cost.
- **KVM:** disambiguate Linux Kernel-based Virtual Machine from a keyboard/video/mouse switch before designing or diagnosing anything.

Use specifications to form a hypothesis and an instrumented application journey to decide. A faster named component cannot compensate for a blocked thread, wrong query, excess copies, poor frame pacing, unavailable codec, or thermal collapse.

## Architecture questions

- What instruction set, ABI, privilege levels, calling convention, alignment, and endianness apply?
- What are the boot chain, reset state, exception and interrupt paths, timer sources, and debug facilities?
- Which caches, coherence domains, MMU/MPU rules, memory types, barriers, and atomic guarantees matter?
- Which devices use DMA, memory-mapped I/O, IOMMU isolation, or shared memory?
- What are the CPU, GPU, DSP, accelerator, memory-bandwidth, latency, power, and thermal budgets?
- Which behavior is architectural and portable, and which is implementation- or board-specific?

Read the relevant processor, ABI, SoC, board, and compiler documentation. Preserve disassembly, linker maps, performance-counter data, and experiments for consequential low-level claims.

## Operating-system boundaries

Map each capability to the narrowest suitable layer:

| Layer | Appropriate work | Common failure to test |
|---|---|---|
| Application/service | Product behavior, orchestration, policy | Restart, cancellation, partial state, permission loss |
| User-space device service | Parsers, protocol policy, noncritical device control | Disconnect, malformed input, service crash |
| Framework/runtime | Stable application-facing abstraction | Version skew, lifecycle mismatch |
| Driver/kernel | Interrupt, DMA, memory, scheduling, hardware access | Races, teardown, hot-plug, sleep/resume, untrusted device input |
| Firmware/hardware | Boot, deterministic I/O, root of trust, physical protection | Power loss, watchdog, invalid image, unsafe output |

Prefer user space when its timing and platform contract are sufficient. Kernel code expands the crash and security boundary and requires explicit evidence that the lower placement is necessary.

## Filesystem and storage contract

Do not treat a successful write call as proven durable storage. Record:

- Filesystem and storage media, mount options, case and Unicode behavior, path and filename limits.
- Atomicity unit, rename semantics, flush/fsync expectations, ordering, journaling or copy-on-write behavior.
- Locking, concurrent-reader/writer, memory-mapping, sparse-file, quota, full-disk, and removable-media behavior.
- Power-loss, corruption detection, repair, backup, snapshot, restore, migration, and downgrade expectations.
- Flash erase/write behavior, wear management, bad blocks, retention, and secure-erasure limits.

Verify the exact target filesystem and OS version. POSIX-like behavior, desktop tests, and emulator storage are not proof for every device.

## Driver workflow

1. Define the device state machine, ownership, supported hardware/firmware matrix, and failure semantics.
2. Separate transport mechanics from protocol parsing and product policy.
3. Validate every length, offset, enum, state transition, and device-originated value.
4. Design enumeration, initialization, cancellation, timeout, surprise removal, reset, sleep/resume, and shutdown together.
5. Make buffers, DMA ownership, interrupt-to-thread handoff, locks, and memory ordering reviewable.
6. Add tracing and counters before optimization; avoid logging payloads or secrets.
7. Test with virtual devices, fault injection, malformed traffic, repeated bind/unbind, suspend/resume, and real hardware.
8. Verify installation, signing, permissions, upgrades, rollback, diagnostics, and uninstall on supported systems.

## Performance workflow

- State a user-visible target and a hardware/resource budget before tuning.
- Measure release-like builds with a reproducible workload and controlled power/thermal state.
- Use profiles, counters, traces, and disassembly to locate the bottleneck; do not infer it from CPU percentage alone.
- Check median and tail latency, utilization, cache misses, memory traffic, I/O queueing, wakeups, energy, and thermals as relevant.
- Re-run whole-system correctness and representative-device tests after low-level optimization.

## Example tools and primary references

Last verified: **2026-08-07**. Confirm current versions and target support before adoption.

| Area | Examples | Primary reference |
|---|---|---|
| Open ISA and ABI study | RISC-V specifications | [RISC-V technical specifications](https://docs.riscv.org/reference/) |
| Binary inspection | LLVM tools, GNU binutils, Compiler Explorer | [LLVM command guide](https://llvm.org/docs/CommandGuide/) |
| Debugging | GDB, LLDB | [GDB documentation](https://sourceware.org/gdb/documentation/), [LLDB documentation](https://lldb.llvm.org/) |
| Linux performance | perf, ftrace, eBPF/BPF | [Linux tracing](https://docs.kernel.org/trace/index.html), [Linux BPF](https://docs.kernel.org/bpf/) |
| Full-system emulation | QEMU | [QEMU system emulation](https://www.qemu.org/docs/master/system/index.html) |
| Architecture simulation | gem5 | [gem5 documentation](https://www.gem5.org/documentation/) |
| Linux filesystems | VFS and filesystem-specific docs | [Linux VFS](https://docs.kernel.org/filesystems/vfs.html) |
| Linux drivers | Driver APIs and subsystem docs | [Linux driver APIs](https://docs.kernel.org/driver-api/index.html) |
| Apple drivers | DriverKit and System Extensions | [Apple System Extensions](https://developer.apple.com/documentation/systemextensions) |
| Windows drivers | KMDF and UMDF | [Windows Driver Frameworks](https://learn.microsoft.com/en-us/windows-hardware/drivers/wdf/) |

Vendor data sheets, errata, platform signing rules, and supported-version policies take precedence for the actual target. Record any inaccessible or paywalled source as a verification limitation.
