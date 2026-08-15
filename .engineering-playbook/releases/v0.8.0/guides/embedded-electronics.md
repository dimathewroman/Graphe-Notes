# Embedded Firmware, Electronics, PCB, and FPGA

Use this guide for microcontrollers, RTOS or embedded Linux systems, custom electronics, programmable logic, power design, or board production.

## Choose the execution environment

| Environment | Fits when | Verify explicitly |
|---|---|---|
| Bare metal | Small, fixed behavior; tight control; minimal dependencies | Interrupt latency, state machines, recovery, testability |
| RTOS | Several timed activities need isolation and scheduling | Priorities, stack bounds, blocking, inversion, deadline behavior |
| Embedded Linux | Rich networking, storage, process isolation, drivers, packages | Boot time, update/recovery, writable state, power and memory |
| FPGA fabric | Hard timing or parallel/custom datapaths | Clock domains, timing closure, verification cost |

Use the simplest environment that meets measured requirements and preserves diagnostics, secure updates, and recovery.

## Firmware practices

- Document reset causes, boot stages, clock tree, memory map, interrupt priorities, peripheral ownership, and pin multiplexing.
- Keep board description and product policy separate; use generated/vendor code behind a reviewed boundary.
- Bound memory, queues, retries, timeouts, execution time, and stack use on critical paths.
- Design watchdogs, brownout handling, safe output state, crash record, and recovery before field use.
- Use signed/versioned images, authenticated updates, rollback or recovery images, and an anti-rollback policy where the threat model requires it.
- Treat bootloader, debug access, manufacturing credentials, keys, and device identity as lifecycle systems, not build-time details.
- Test power loss during every persistent transition and update phase.
- Keep host-side unit tests and protocol simulators; do not require a physical board for every logic regression.

## Electrical design

Build explicit budgets for:

- Input power, steady and transient current, inrush, efficiency, battery life, charging, and fault energy.
- Rail tolerance, sequencing, brownout, reverse polarity, overcurrent, ESD, surge, and thermal protection.
- Digital thresholds, pull-ups, fanout, rise/fall time, level shifting, timing margin, and return-current paths.
- ADC/DAC range, reference quality, source impedance, filtering, noise, resolution, calibration, and uncertainty.
- Clock quality, reset integrity, signal integrity, controlled impedance, termination, connector/cable effects, and EMI/EMC.
- Component derating, lifecycle, approved alternates, counterfeit exposure, and lead times.

Reference designs are evidence of a known approach, not proof that a changed layout, stack-up, enclosure, cable, antenna, or load will behave the same.

## Schematic and PCB workflow

1. Block diagram, interface inventory, power tree, fault containment, and test strategy.
2. Component and module evaluation using current data sheets, errata, lifecycle, availability, and compliance evidence.
3. Schematic with readable net names, decoupling rationale, configuration states, protection, programming/debug, and test points.
4. Simulation or calculation for power, analog, timing, signal integrity, RF, and thermal questions proportional to risk.
5. Independent schematic review and electrical-rules check.
6. Stack-up and impedance agreement with the intended fabricator before critical routing.
7. Placement by current loops, return paths, clocks, analog/RF isolation, mechanics, thermal flow, assembly, and service access.
8. Design-rules check, 3D/mechanical interference check, and manufacturing/package review.
9. Reproducible fabrication and assembly outputs: plots, drill, stack-up, impedance notes, centroid, BOM, assembly drawings, firmware identity, and checksums as applicable.
10. Staged bring-up, findings, corrective actions, and controlled revision release.

Do not prototype mains voltage, high-energy batteries, dangerous motion, high-power RF, lasers, or similar energy without an appropriate design review, lab setup, protection, and qualified support.

## FPGA workflow

- Treat RTL as concurrent hardware description, not sequential software.
- Define clocks, resets, timing exceptions, pin constraints, and I/O standards before implementation is considered complete.
- Synchronize asynchronous inputs and design/test every clock-domain crossing.
- Simulate interfaces and failure cases; add assertions and coverage.
- Use lint, synthesis, static timing, CDC analysis, and formal/property checking where proportional.
- Verify on hardware with known stimuli and an on-chip logic analyzer; correlate the capture with the simulation.
- Pin tool/device versions and preserve build reports, bitstream identity, constraints, and programming/recovery instructions.

## Bring-up evidence

For each hardware revision retain:

- Visual inspection and unpowered resistance/continuity results.
- Current limit, expected/observed current, rail voltages, sequence, ripple, reset, and clocks.
- Debug connection, boot log, memory test, peripheral loopbacks, communications, sensors, actuators, and fault tests.
- Scope/analyzer configuration, probe location, test fixture, firmware/bitstream build, temperature, and power source.
- Deviations, rework, affected serials, root cause, and the disposition of the revision.

## Example tools and primary references

Last verified: **2026-08-07**. Confirm current target support, license, safety notices, and vendor status before adoption.

| Area | Examples | Primary reference |
|---|---|---|
| Portable RTOS | Zephyr | [Zephyr introduction](https://docs.zephyrproject.org/latest/introduction/index.html), [devicetree](https://docs.zephyrproject.org/latest/build/dts/index.html) |
| Small RTOS | FreeRTOS | [FreeRTOS documentation](https://www.freertos.org/Documentation/00-Overview) |
| Espressif MCUs | ESP-IDF | [ESP-IDF programming guide](https://docs.espressif.com/projects/esp-idf/en/latest/esp32/index.html) |
| RP-series MCUs | Pico SDK | [Raspberry Pi Pico SDK](https://www.raspberrypi.com/documentation/pico-sdk/) |
| Debug/programming | OpenOCD, pyOCD, vendor probes | [OpenOCD documentation](https://openocd.org/documentation/), [pyOCD documentation](https://pyocd.io/docs/) |
| PCB design | KiCad; Altium/Cadence when required | [KiCad getting started](https://docs.kicad.org/9.0/en/getting_started_in_kicad/getting_started_in_kicad.html) |
| Circuit simulation | ngspice, LTspice | [ngspice documentation](https://ngspice.sourceforge.io/docs.html) |
| RTL simulation/lint | Verilator, Icarus Verilog, GTKWave | [Verilator guide](https://verilator.org/guide/latest/overview.html) |
| Open FPGA flow | Yosys, nextpnr, SymbiYosys | [Yosys documentation](https://yosyshq.readthedocs.io/projects/yosys/en/latest/) |

Arduino-compatible environments can be excellent prototype tools. A production decision should still evaluate dependency ownership, reproducibility, timing, debugging, update, security, licensing, and long-term hardware support.
