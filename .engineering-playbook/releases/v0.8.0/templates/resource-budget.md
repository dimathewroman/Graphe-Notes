# Hardware-System Resource Budget

## Identity and assumptions

- Project/product and revision:
- Scenario, duty cycle, environment, and operating mode:
- Measurement or calculation sources:
- Margin policy:
- Owner/date/status:

Use separate rows for idle, typical, peak, startup, fault, degraded, and update states where they differ.

## Power and energy

| Rail/source/state | Voltage tolerance | Typical current/power | Peak/inrush and duration | Efficiency/loss | Margin | Measured or estimated | Evidence |
|---|---:|---:|---:|---:|---:|---|---|
| | | | | | | | |

- Battery capacity and usable-energy assumptions:
- Exact cell/pack, supplier/revision, transport test-summary, charger, battery-management/protection, and fault-energy evidence:
- Charging, venting/thermal propagation, damaged-pack isolation, shipping/storage state, replacement, recycling, and change-trigger assumptions:
- Target runtime and measured runtime:

## Compute, memory, and storage

| Resource/scenario | Available | Expected | Measured peak/tail | Reserved/margin | Failure or shedding behavior | Evidence |
|---|---:|---:|---:|---:|---|---|
| CPU/deadline | | | | | | |
| RAM/stack/heap/native/managed | | | | | | |
| Graphics/media/model/database working set | | | | | | |
| Flash/storage/endurance/free-space headroom | | | | | | |
| Database/index/WAL/temp/migration | | | | | | |
| GPU/NPU/DSP/FPGA fabric | | | | | | |

## Timing and data flow

| Path or control loop | Source rate | Payload/bandwidth | Deadline/latency target | Jitter/order/loss tolerance | Measured typical/tail | Overload behavior |
|---|---:|---:|---:|---|---:|---|
| | | | | | | |

## Application and rendering path

| Journey/tier | Startup/readiness | Input/frame or response deadline | CPU/GPU time | Allocation/copy/I/O | Queue depth/backpressure | Sustained thermal/energy | Evidence |
|---|---:|---:|---:|---:|---:|---:|---|
| | | | | | | | |

- Cold/warm/hot and foreground/background states:
- Low/middle/high tier feature detection and adaptation:
- Cache/prefetch/eviction and low-memory behavior:
- Reduced-motion, accessibility, and correctness guardrails:

## Thermal, mechanical, and RF

| Quantity | Operating envelope or limit | Expected | Measured worst case | Margin | Test configuration/evidence |
|---|---:|---:|---:|---:|---|
| Junction/case/ambient temperature | | | | | |
| Heat dissipation/airflow | | | | | |
| Load/deflection/fatigue | | | | | |
| Mass/envelope/clearance | | | | | |
| Link budget/RF exposure as applicable | | | | | |

## Cost and production

| Quantity | Prototype | Target production | Current evidence | Threshold or owner decision |
|---|---:|---:|---|---|
| Unit BOM | | | | |
| Assembly/test time | | | | |
| Tooling/NRE | | | | |
| Yield/rework | | | | |
| Support/repair/hosting | | | | |

## Exceptions and next measurements

| Over-budget item or uncertainty | User/system consequence | Proposed action or trade-off | Owner | Due/trigger | Status |
|---|---|---|---|---|---|
| | | | | | |
