# Hardware-Software Systems Guide

Use this guide when software touches physical devices, custom electronics, radios, sensors, mechanisms, or manufacturing. It extends the playbook; it does not replace a project's architecture, risk analysis, applicable law, or the owner's decisions.

Safety and compliance statements here are engineering guidance, not legal or certification conclusions. Agents must separate verified requirements from interpretation and uncertainty. Advice or a risk label does not become an execution restriction; only an actual current runtime control can impose one.

## Select the proportionate scope

Record a hardware involvement level in the project engineering profile. This describes scope, not risk.

| Level | Typical work | Minimum additional evidence |
|---|---|---|
| HS0 — Software only | Ordinary app, service, or desktop software | Platform and representative-device testing |
| HS1 — Hardware integration | USB, Bluetooth, network peripherals, vendor SDKs | Interface contract, compatibility matrix, real-device traces |
| HS2 — Embedded prototype | Development boards, modules, sensors, actuators | Resource budgets, firmware recovery, instrumented prototype |
| HS3 — Custom hardware | PCB, power, RF layout, enclosure, test fixture | Design reviews, staged bring-up, manufacturing package |
| HS4 — Marketed or safety-relevant product | External sale, batteries, hazardous motion/energy, regulated use | Hazard analysis, compliance plan, traceability, production and field controls |

Assign the independent R0–R3 risk tier as well. Hazardous-energy controls, safety functions, market authorization, and consequential production changes are normally R3 unless project evidence supports a lower tier. An owner can accept an explained engineering residual risk, but that decision is not a certificate, declaration, laboratory report, professional interpretation, or regulatory authorization.

Select only the relevant companion guides:

- [Computer Platforms](computer-platforms.md)
- [Device Runtime, Rendering, and Resource Efficiency](device-runtime-rendering-and-resource-efficiency.md)
- [APIs, MCP, and System Integration](apis-mcp-and-system-integration.md)
- [Embedded Electronics](embedded-electronics.md)
- [Connectivity and Radio](connectivity-radio.md)
- [Sensing and Robotics](sensing-robotics.md)
- [Mechanical Design and Manufacturing](mechanical-manufacturing.md)

## Decide where behavior belongs

Start with software for adaptability, observability, and low non-recurring cost. Move a function only when measured constraints justify it.

| Pressure | Usually favors software | Usually favors firmware or hardware |
|---|---|---|
| Requirements | Still changing | Stable interface and behavior |
| Timing | Jitter is tolerable | Bounded deadline or precise waveform |
| Throughput | General CPU/GPU meets the budget | Parallel datapath or custom interface is required |
| Energy | Power is secondary | Always-on or battery budget dominates |
| Safety | Failure can be detected and recovered | Independent protection or safe state is required |
| Security | Patchability matters most | Root of trust, key isolation, or physical enforcement is needed |
| Economics | Low volume; avoid design and tooling cost | Volume justifies BOM, power, or performance optimization |
| Field service | Frequent updates are expected | Updates are difficult or tightly controlled |

Use:

- A general-purpose OS for rich applications, dynamic workloads, networking, and rapid updates.
- A microcontroller (MCU) or real-time operating system (RTOS) for deterministic I/O, boot control, isolation, and low-power operation.
- A field-programmable gate array (FPGA) or complex programmable logic device (CPLD) for justified parallelism, unusual interfaces, or hard timing.
- An application-specific integrated circuit (ASIC) only when volume, power, performance, and lifecycle economics justify its high non-recurring cost.
- Physical protection—fuses, current limits, keying, interlocks, shielding, thermal cutoffs—when code cannot reliably contain the physical hazard.

Record the choice with measured timing, power, thermal, cost, safety, and service evidence. “Hardware is faster” and “software is easier” are hypotheses, not decisions.

## System workflow

### 1. Define the physical promise

- State what the user will observe and the environments, lifetimes, maintenance, and misuse cases the system must tolerate.
- Name unacceptable failures and safe states before choosing components.
- Draw the system block diagram, energy flows, trust boundaries, control authority, and external interfaces.
- Record power, timing, memory, storage, bandwidth, thermal, mechanical, and cost budgets.

Use [system-interface-record.md](../templates/system-interface-record.md), [resource-budget.md](../templates/resource-budget.md), and the [Cross-Layer Performance and Capacity Plan](../templates/cross-layer-performance-and-capacity-plan.md) when an app journey spans device resources.

### 2. Retire the largest uncertainties first

- Prove risky assumptions with commercial development boards, evaluated modules, mechanical mockups, and synthetic inputs.
- Capture raw measurements and golden traces rather than only a demonstration video.
- Keep experiments isolated and reversible; record success and stop criteria.
- Prefer evaluated/certified radio or power modules until custom design creates a measured benefit, while verifying the module approval's host, antenna, enclosure, labeling, RF-exposure, simultaneous-transmission, integration, and retest conditions for the finished product.

### 3. Co-design the boundaries

- Freeze interface ownership, units, coordinate frames, clock sources, error semantics, reset behavior, and version compatibility before parallel implementation.
- Design observability early: logs, debug headers, test points, loopback, self-test, calibration, and fault injection.
- Treat power, firmware, host software, enclosure, antenna, sensor placement, and manufacturing tests as one system.
- Record assumptions that simulation or a reference design does not prove on the actual product.

### 4. Test in progressively more physical environments

1. Pure algorithm and state-machine tests.
2. Circuit, mechanical, control, or RTL simulation.
3. CPU/board emulation or software-in-the-loop.
4. Development hardware with controlled peripherals.
5. Hardware-in-the-loop with real timing, I/O, and failure injection.
6. Prototype in representative environment and user journey.
7. Pre-compliance, reliability, and manufacturing tests.

Simulation accelerates learning but does not prove actual RF, signal integrity, timing, thermal, mechanical, sensor, or environmental behavior. Preserve model version, parameters, limitations, and correlation with physical results.

### 5. Bring up in controlled stages

- Inspect before applying power.
- Start from a current-limited source and compare observed rail current with the written expectation.
- Verify shorts, rails, sequencing, reset, clocks, debug connection, memory, buses, then the application.
- Change one relevant variable at a time and retain measurements, scope captures, firmware/hardware revisions, and probe locations.
- Stop and reassess when current, heat, noise, motion, or emitted energy departs from the safe test envelope.

Use [hardware-bring-up.md](../templates/hardware-bring-up.md).

Use an evidence ladder proportionate to the question:

1. Visual inspection and current schematics/data sheets for identity and assembly.
2. Identify and isolate every energy source, discharge stored energy according to an approved method, verify absence of hazardous voltage, then perform continuity/resistance checks for shorts, opens, and connections.
3. A correctly rated current-limited supply and DMM for rails, current, and sequencing.
4. Oscilloscope and suitable probes for analog shape, noise, integrity, and timing.
5. Logic or dedicated protocol analyzer for digital transactions and state.
6. Electronic load, LCR meter, thermal imaging, and environmental instruments for component and system margin.
7. Spectrum analyzer, vector network analyzer, power meter, calibrated antennas, and controlled fixtures for RF questions.
8. Qualified laboratory equipment for electrostatic discharge (ESD), electrical fast transients (EFT), surge, emissions, immunity, environmental, destructive, or certification work.

Confirm measurement category/rating, voltage, bandwidth, loading, isolation, signal ground, chassis, protective earth, calibration, and safe probing before trusting a measurement. Many bench oscilloscopes have earth-referenced ground clips; use an appropriately rated differential/isolated method and qualified support when the circuit cannot be safely earth-referenced. Record the instrument, settings, probe point, fixture, uncertainty, revision, and expected value with the result.

Mains and other hazardous-energy work requires a qualified procedure, equipment, environment, and personnel. [OSHA electrical safe-work guidance](https://www.osha.gov/laws-regs/regulations/standardnumber/1910/1910.333) is one U.S. starting point; identify the current requirements for the actual workplace and jurisdiction.

### 6. Validate product and production separately

| Phase | Question | Representative evidence |
|---|---|---|
| EVT — Engineering Validation Test | Can the architecture meet the requirement? | Instrumented prototypes, boundary measurements, major risks retired |
| DVT — Design Validation Test | Does the production-intent design meet the specification and applicable requirements? | Environmental, reliability, usability, security, pre-compliance, regression evidence |
| PVT — Production Validation Test | Can the intended process build and test it repeatedly? | Pilot build yield, work instructions, fixtures, calibration, traceability, approved deviations |

The names are conventional, not magical gates. Tailor them to the product while preserving the distinct questions. Use [validation-phase-record.md](../templates/validation-phase-record.md).

## Safety and compliance discovery

Begin discovery while architecture is still reversible. Record:

- Product category, intended and reasonably foreseeable use, users, environment, markets, distribution, and support lifetime.
- Sources of electrical, thermal, mechanical, chemical, optical, acoustic, pressure, battery, radiation, privacy, and cybersecurity harm.
- Applicable regulations, standards, radio bands, interoperability programs, marks, labels, documentation, and record-retention duties.
- Whether self-assessment is available or an accredited laboratory, notified body, professional engineer, or other qualified review is warranted.
- Design evidence, test plan, pre-compliance date, production-change controls, and owner decisions on residual risk.

Do not equate successful interoperability with regulatory or certification approval. A working USB, Bluetooth, Wi-Fi, or radio implementation has not thereby earned a certification mark.

Examples to investigate for the exact product and market include FCC radio-frequency rules, EU RED/EMC/LVD/RoHS and other product legislation, UN 38.3 for lithium-battery transport, IEC 62368-1, IEC 61010-1, IEC 60601, IEC 61508, ISO 13849, ISO 26262, and IEC 60825. Confirm applicability and current editions rather than copying this list into a product claim.

UN 38.3 is transport testing, not complete evidence that a battery is safe in the product. Also define the exact cell/pack and test summary, charger compatibility, battery-management/protection behavior, fault energy, venting/thermal propagation, damaged-pack isolation, shipping/storage state, replacement, recycling, and reassessment after a cell, pack, charger, enclosure, firmware, supplier, or process change. See [PHMSA lithium-battery transport guidance](https://www.phmsa.dot.gov/lithiumbatteries) as a U.S. starting point.

Use [hazard-compliance-record.md](../templates/hazard-compliance-record.md).

Example discovery starting points, last verified **2026-08-07**:

| Question | Primary starting point |
|---|---|
| US equipment authorization and applicable unlicensed intentional/unintentional radiators | [47 CFR Part 2](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-2/subpart-J), [47 CFR Part 15](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15), [FCC modular integration](https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=44637&switch=P), [FCC RF exposure](https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=20676&switch=P) |
| EU radio products | [European Commission RED guidance](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en) |
| EU conformity process | [European Commission manufacturer guidance](https://single-market-economy.ec.europa.eu/single-market/goods/ce-marking/manufacturers_en) |
| Connected-device cybersecurity capabilities | [NISTIR 8259A catalog](https://pages.nist.gov/IoT-Device-Cybersecurity-Requirement-Catalogs/technical/) |
| Consumer IoT security baseline | [ETSI EN 303 645 V3.1.3](https://www.etsi.org/deliver/etsi_en/303600_303699/303645/03.01.03_60/en_303645v030103p.pdf) |
| Lithium-battery transport testing | [UN Manual of Tests and Criteria](https://unece.org/transport/standards/transport/dangerous-goods/un-manual-tests-and-criteria-rev8-2023) |

These sources are starting points, not a complete applicability determination. Record the exact edition and access date used by the project.

### Post-market safety and connected-product duties

Before sale, assign intake and decision ownership for complaints, injuries, near misses, security vulnerabilities, affected serials/lots, stop-ship, field containment, customer/regulator notice, corrective action, and recall. Record reporting clocks and evidence from current market-specific sources. Useful starting points include [U.S. CPSC reporting guidance](https://www.cpsc.gov/Business--Manufacturing/Recall-Guidance/Duty-to-Report-to-CPSC-Rights-and-Responsibilities-of-Businesses), [EU product-safety guidance](https://commission.europa.eu/topics/business-and-industry/doing-business-eu/eu-product-safety-and-labelling/product-safety_en), and the [EU Cyber Resilience Act timeline](https://digital-strategy.ec.europa.eu/en/policies/cyber-resilience-act). Recheck current RED cybersecurity and CRA applicability/dates for the exact product and sale date rather than relying on this guide's review date.

## Evidence package

Retain, as applicable:

- System diagram and interface-control records.
- Requirements-to-test traceability and resource budgets.
- Native schematic, PCB, firmware, FPGA, CAD, simulation, and manufacturing sources.
- BOM, approved alternates, lifecycle evidence, licenses, checksums, and supplier/manufacturer instructions.
- Bring-up log, raw captures, calibration, environmental and interoperability results.
- Hazard analysis, compliance matrix, laboratory reports, declarations, labels, and approved deviations.
- Manufacturing test sources, fixtures, work instructions, yield, per-unit identity, and repair/rework history.
- Signed software/firmware artifacts, secure-update and rollback evidence, support window, vulnerability intake, and end-of-life plan.

Never store credentials, private user data, production exports, personal location traces, or restricted manufacturing/security material in this governance repository.

## High-leverage practices

- Build the test fixture before the final board.
- Preserve a known-good unit and golden electrical, protocol, RF, and sensor traces.
- Add zero-ohm options, jumpers, test pads, and separable power domains to make early hardware reversible.
- Test boundaries before internals: power, clocks, reset, communications, then application behavior.
- Maintain a “physics ledger” for power, heat, forces, bandwidth, tolerances, and uncertainty.
- When an approved data plan requires it, retain the minimum replayable timestamped raw sensor evidence with purpose, consent, access, retention, deletion, and redaction controls; prefer synthetic or controlled captures by default.
- Distinguish ordinary margin testing from destructive/abuse testing. Do not treat component absolute maximum ratings as normal targets. Predefine maximum stress and containment, use sacrificial units and qualified facilities/equipment where warranted, operate remotely when appropriate, and plan safe disposal.
- Make manufacturing tests deterministic, fast, repair-oriented, and independent of cloud availability.

## Tool and standard freshness

Tools and standards in these guides are examples, not timeless mandates. At adoption, record the exact version or edition, license, supported host and target, source URL, last verification date, known limitations, and replacement path. Recheck before a new hardware revision, market entry, certification submission, or major toolchain upgrade.

## Plain-English hardware terms

| Term | Meaning and why the owner may care |
|---|---|
| MCU | Microcontroller: a small computer for direct, low-power, often time-bounded device control. |
| RTOS | Real-time operating system: scheduling designed to make timing more bounded and analyzable. |
| FPGA/CPLD | Reprogrammable digital logic used for parallel or precisely timed hardware behavior. |
| ASIC | A custom chip; potentially efficient at volume but expensive and difficult to change. |
| ABI/ISA | The binary software contract and processor instruction set that determine what compiled code can run. |
| MMU/MPU/IOMMU | Hardware that controls or isolates memory access by software and devices. |
| DMA | Direct memory access: a device moves data without the CPU copying every byte, creating ownership/coherency risks. |
| ESD/EFT/EMC | Electrical disturbances and electromagnetic compatibility that can damage, reset, or interfere with a product. |
| VNA | Vector network analyzer: an instrument for RF impedance, matching, cables and antennas. |
| EVT/DVT/PVT | Engineering, design and production validation phases answering feasibility, specification and repeatable-manufacturing questions. |
