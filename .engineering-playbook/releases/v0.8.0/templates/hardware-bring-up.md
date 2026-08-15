# Hardware Bring-Up Record

## Identity and safe test envelope

- Product/board and revision:
- Unit/serial or fixture identity:
- Firmware/bootloader/FPGA build and checksum:
- Schematic, BOM, assembly, errata, and expected-measurement references:
- Operator, date, location, and environmental conditions:
- Approved voltage, current, temperature, motion, optical/RF, battery, and other energy limits:
- Every energy source, stored-energy discharge method, isolation/de-energization procedure, and absence-of-voltage test:
- Signal ground, chassis, protective earth, isolation boundary, instrument category/rating, and differential/isolated probing requirements:
- Emergency isolation or shutdown method:

## Equipment

| Instrument/fixture | Model/asset ID | Relevant configuration | Calibration/status |
|---|---|---|---|
| | | | |

## Pre-power inspection

- [ ] Correct revision, assembly options, orientation, polarity, connectors, rework, and foreign material checked.
- [ ] Unpowered resistance/continuity to ground and between relevant rails is within expectation.
- [ ] Every energy source is isolated; capacitors/stored energy are discharged; absence of hazardous voltage is verified with appropriately rated equipment.
- [ ] Power source polarity, current limit, grounding, isolation, and probe connections are verified.
- [ ] Oscilloscope/instrument earth references cannot short or energize the circuit; an appropriately rated differential/isolated method is used when required.
- [ ] Dangerous outputs and actuators are disconnected, constrained, shielded, loaded, or otherwise controlled as planned.
- [ ] Expected measurement table and stop conditions are available.

## Staged checks

Record the actual order. Do not mark a later stage as evidence for an omitted earlier check.

| Stage/test point | Expected value/behavior and tolerance | Observed | Instrument/setup | Evidence | Pass/fail/deviation |
|---|---|---|---|---|---|
| Unpowered checks | | | | | |
| Input and protected rails | | | | | |
| Sequencing, reset, and clocks | | | | | |
| Debug/program connection | | | | | |
| Boot and memory | | | | | |
| Local buses/peripherals | | | | | |
| External interfaces/radios | | | | | |
| Sensors/actuators | | | | | |
| Fault, watchdog, power loss, and recovery | | | | | |
| Typical and peak thermal/current behavior | | | | | |

## Findings and rework

| Finding or symptom | Confirmed evidence versus inference | Root cause/status | Rework or containment | Affected units/revisions | Verification |
|---|---|---|---|---|---|
| | | | | | |

## Disposition

- Result: Pass / Conditional / Fail / Unsafe to continue
- If unsafe: system de-energized, quarantined/marked, hazard reported, and named authority required before re-enable:
- Known limitations:
- Configuration that is now the known-good baseline:
- Next test or design action:
- Owner decision required, if any:
- Reviewer/date:
