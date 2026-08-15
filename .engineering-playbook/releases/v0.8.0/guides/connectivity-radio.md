# Wired, Wireless, Radio, RFID, NFC, and Infrared

Use this guide when a product communicates through a cable, local network, radio, optical link, or externally defined protocol.

## Communication stack mental model

Keep the layers separate:

> application meaning -> messages/frames -> security and error control -> transport/link -> electrical or radio symbols -> cable/air/optical channel -> peer decoding -> application meaning

A connector is not a data protocol, and a frequency is not a throughput or range guarantee. USB-C, for example, describes a connector ecosystem whose supported data, display, role, cable, and power capabilities must be negotiated and verified separately.

For radio, reason from bandwidth, signal-to-noise ratio, modulation/coding, transmit power, antenna efficiency/pattern/polarization, path loss, interference, fading, regulation, duty cycle, coexistence, and protocol overhead. Software can schedule, encode, retry, adapt, and interpret; it cannot repeal RF physics, create an absent antenna/sensor/actuator, or authorize spectrum use.

When the product boundary is an API, process, event, agent tool, or MCP server, also use [APIs, MCP, and System Integration](apis-mcp-and-system-integration.md).

## Establish the protocol contract

For every interface record:

- Authoritative specification, exact revision, optional profiles, extensions, errata, and licensing or membership conditions.
- Connector, cable, voltage, current, impedance, termination, shielding, grounding, pinout, ESD protection, and hot-plug behavior.
- Role, discovery, addressing, pairing or session setup, authentication, state machine, timeouts, retries, ordering, flow control, and recovery.
- Payload schema, byte order, units, bounds, version negotiation, feature discovery, and unknown-field behavior.
- Security and privacy boundary, credentials or keys, replay/downgrade exposure, logging/redaction, and update path.
- Compatibility matrix across hardware, firmware, OS, stack, peer, cable/accessory, and environmental conditions.

Do not implement from packet captures alone when a specification is available. Captures prove observed examples; the specification and interoperability tests define the intended range.

## Wired interfaces

Select physical and protocol layers separately. Common candidates include:

- UART, RS-232, RS-485, I2C, SPI and GPIO for board and equipment links.
- USB 2/3/4, Type-C and USB Power Delivery for peripherals, data, display and power.
- Ethernet for local and routed networks; PoE where power delivery is justified.
- CAN/CAN FD and LIN for distributed embedded control.
- PCIe, MIPI CSI/DSI and other high-speed internal links.
- Modbus and industrial field buses where ecosystem compatibility requires them.

Test electrical margin as well as decoded data. Include wrong role or cable, hot-plug, disconnect during transfer, duplicate/reordered data, saturation, timeout, malformed input, peer reset, sleep/resume, and version mismatch.

## Network workflow

This section owns device connectivity, provisioning, and link/interoperability evidence. Use [Software Architecture, Data, Networking, and Distributed Systems](software-architecture-data-networking.md) for routed application protocols, service deadlines, APIs, queues, and distributed-state semantics.

- Draw addressing, name resolution, routing, firewall, NAT, discovery, trust, and cloud/local fallback paths.
- Define bounded connection, retry and backoff behavior; prevent retry storms.
- Authenticate endpoints and authorize each operation independently.
- Decide whether availability is local, internet-dependent, or degraded-capable and make that visible to the user.
- Capture golden traffic at the closest useful boundary without storing credentials or personal payloads.
- Test latency, loss, duplication, reordering, fragmentation, MTU changes, roaming, network switching, captive portals, IPv4/IPv6, and clock failure where relevant.
- Treat packet success as transport evidence, not proof that durable product state converged.

## Bluetooth and Wi-Fi

Record the exact Bluetooth roles, profiles, GATT services, characteristics, security modes, bonding behavior, connection parameters, MTU, notification/indication semantics, and platform background limits.

For Wi-Fi, record bands, channel widths, regulatory domain, credentials/provisioning, roaming, power save, coexistence, access-point assumptions, enterprise or personal security, and offline behavior.

Test coexistence with the product's other radios and noisy real environments. Antenna placement, enclosure, battery, cables, display, clocks, and human proximity can materially change performance.

## RF and software-defined radio

Before transmitting, identify the jurisdiction, applicable licensed service or unlicensed allocation, authorized frequencies, bandwidth, power/effective isotropic radiated power (EIRP), duty cycle, antenna constraints, spurious limits, RF-exposure conditions, service-specific rules, and equipment-authorization path. A pre-certified module remains subject to its grant and finished-host conditions, including antenna, enclosure, separation, labeling, simultaneous transmitters, and integration/retest requirements. Use conducted tests, attenuation, shielding, loads, or an appropriate controlled site when needed.

Engineering work should include:

- Link budget, sensitivity, fade margin, noise figure, occupied bandwidth, modulation, coding, latency, and throughput.
- Antenna impedance/matching, efficiency, polarization, pattern, placement, feed line, enclosure detuning, and coexistence.
- Receiver blocking/desense and transmitter harmonic, spurious, and adjacent-channel behavior.
- Repeatable RF test setup with calibrated loss, instrument settings, firmware, region, power level, antenna, orientation, distance, and environment.

Software-defined radio is useful for controlled observation, stimulus, prototyping, and conformance research. A waveform that works in a lab is not evidence of permission to radiate it or of regulatory conformity. Reception, decoding, retention, or redistribution can also raise authorization, privacy, communications-law, contract, or platform questions; use owned/synthetic signals and minimized captures by default, and apply the [Authorized Security Research guide](authorized-security-research.md) when relevant.

## RFID, NFC, and infrared

- Distinguish LF/HF/UHF RFID; record air interface, tag type, memory/identity model, anticollision, range, orientation, environment, and privacy/security behavior.
- For NFC, identify reader/writer, card-emulation, peer, or charging behavior; record NDEF and application/profile requirements.
- Treat identifiers as potentially personal or security-sensitive; use authentication and anti-replay appropriate to the product rather than relying on proximity alone.
- Distinguish consumer IR remote protocols, IrDA data links, proximity/ToF sensing, and thermal imaging.
- For optical links, document wavelength, source/detector, line of sight, ambient-light rejection, modulation, eye-safety questions, and capture method.

## Interoperability and evidence

1. Build a reference implementation against the current specification.
2. Model the state machine and generate positive, negative, boundary, and recovery cases.
3. Retain golden logic, packet, RF, or optical traces with source and version.
4. Test at least two independent peers where ecosystem diversity matters.
5. Use official compliance suites or an appropriate laboratory for claims and marks.
6. Re-run affected tests after radio module, antenna, enclosure, cable, clock, stack, firmware, or manufacturing changes.

## Example tools and primary references

Last verified: **2026-08-07**. Specifications and qualification programs change; recheck before design freeze or a product claim.

| Area | Examples | Primary reference |
|---|---|---|
| USB and Type-C | Wireshark, usbmon/USBPcap, protocol analyzers | [USB-IF document library](https://usb.org/documents?items_per_page=50&tid_2%5B0%5D=40) |
| Bluetooth | Platform sniffers, nRF Sniffer, dedicated analyzers | [Bluetooth SIG specifications](https://www.bluetooth.com/specifications/specs/) |
| Ethernet | Wireshark/tshark, managed-switch capture | [IEEE 802.3 working group](https://www.ieee802.org/3/) |
| Wi-Fi | Wireshark monitor mode, spectrum tools | [IEEE 802.11 standards](https://standards.ieee.org/standard/802_11-2024.html), [Wi-Fi Alliance certification](https://www.wi-fi.org/certification) |
| Board buses | sigrok/PulseView, Saleae and other logic analyzers | [sigrok project](https://sigrok.org/wiki/Main_Page) |
| SDR | GNU Radio, SDR++, rtl-sdr, HackRF, USRP, LimeSDR | [GNU Radio documentation](https://www.gnuradio.org/doc/doxygen/index.html) |
| NFC | Protocol analyzers and vendor tools | [NFC Forum specifications](https://nfc-forum.org/build/specifications/) |
| UHF RFID/EPC | Reader diagnostics and RF instruments | [GS1 standards](https://ref.gs1.org/standards/) |
| US RF equipment authorization and applicable unlicensed operation | Accredited pre-compliance/compliance facilities | [47 CFR Part 2](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-2/subpart-J), [47 CFR Part 15](https://www.ecfr.gov/current/title-47/chapter-I/subchapter-A/part-15), [FCC modular integration](https://apps.fcc.gov/oetcf/kdb/forms/FTSSearchResultPage.cfm?id=44637&switch=P) |
| EU radio products | Harmonized-standard and conformity-assessment evidence | [EU Radio Equipment Directive guidance](https://single-market-economy.ec.europa.eu/sectors/electrical-and-electronic-engineering-industries-eei/radio-equipment-directive-red_en) |

Membership, adopted specifications, interoperability qualification, trademark licenses, spectrum rules, and product regulation answer different questions. Track each one separately.
