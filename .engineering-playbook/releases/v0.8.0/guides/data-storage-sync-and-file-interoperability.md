# Data Storage, Sync, Files, Media, and Interoperability

For large local collections, mixed-media layout, full-text/vector search, tagging, ingestion pipelines, and retrieval-augmented generation, use [On-Device Data, Indexing, Search, and RAG](on-device-data-indexing-search-and-rag.md).

Use this guide when an app stores durable local data, synchronizes across devices, uses a cloud database, imports/exports files, processes Apple/Android media, or exchanges content with other apps or nearby devices.

The durable principle is: share semantic contracts, not accidental storage internals.

## Name every form of truth

For each important fact, record:

- Authoritative owner: device, server, external provider, user-approved ledger, or another system.
- Local representation and whether it is authoritative, pending, cached, indexed, or derived.
- Stable ID, version/revision, effective time, observed time, deletion/tombstone, provenance, and conflict rule.
- Transaction boundary, invariants, encryption/access, retention, backup, export, and recovery behavior.
- What the UI says while data is stale, offline, conflicted, partially synchronized, or unrecoverable.

Do not let Android Room entities, Core Data objects, React state, API response objects, or PostgreSQL rows silently become the product contract. Map them through explicit domain and transport schemas.

## Local storage choices

| Need | Common fit | Important boundary |
|---|---|---|
| Small preferences | Android DataStore, Apple preferences, browser storage where appropriate | Not a relational store, secret vault, or durable workflow journal |
| Structured local/offline data | SQLite through Room, SQLDelight, native bindings, or another justified layer | Transactions, migrations, constraints, WAL/journal files, concurrency, backup, corruption, and encryption |
| Apple object persistence | SwiftData/Core Data where its object graph, undo, migration, or CloudKit integration fits | Treat its model and CloudKit limitations as platform implementation, not universal schema |
| Files/documents | App container plus system document/file APIs | Atomic replace, coordination, permissions/scoped URLs, type metadata, backup, partial writes, and user ownership |
| Browser offline data | IndexedDB/Cache Storage/OPFS as support permits | Quotas/eviction, multi-tab concurrency, service-worker updates, and browser differences |

SQLite is a strong cross-platform local format, but an active WAL-mode database may include the main file plus `-wal` and `-shm` state. Do not copy or upload only the main file while it is open and call that a backup or sync protocol. Use a supported backup/checkpoint/export procedure and verify the restored result.

For high-value data, prefer a versioned logical export with a manifest and checksums in addition to implementation-specific backups. A raw database export can be useful for exact recovery, but it should not be the only long-term user interchange format.

## Cloud and API boundary

- A service database such as PostgreSQL normally sits behind an authenticated API; mobile clients do not receive owner/admin credentials or unrestricted database connectivity.
- Enforce authorization and tenant/user ownership server-side. Client filtering, hidden UI, or a guessed row ID is not access control.
- Use database constraints and transactions to reinforce domain invariants. Use exact decimal/minor units for money.
- Version APIs, events, and schemas; preserve unknown fields where the compatibility model requires it.
- Keep provider/source facts immutable when audit or reinterpretation matters. Build normalized and presentation views separately.
- Define backup, point-in-time recovery, regional/service failure, key loss, vendor exit, data export, and deletion evidence before the service becomes irreplaceable.

Avoid dual authority. If both device and server accept writes, define exactly how they reconcile.

## Offline sync protocol

A dependable sync design usually needs:

- Stable globally unique operation/entity IDs and idempotency keys.
- Local transaction that saves the user action before success is shown.
- Durable outbox and server receipt/acknowledgement.
- Incremental cursor or revision checkpoint with gap detection and full-reconciliation path.
- Explicit create/update/delete/tombstone semantics and retention.
- Conflict policy per field/entity: reject, merge, last-authoritative-write, user choice, CRDT, or domain-specific reconciliation.
- Ordering, duplicate, retry, clock-skew, device-reinstall, account-switch, schema-version, and partial-failure behavior.
- Observability for pending age, repeated failure, cursor freshness, reconciliation mismatch, and recovery without logging contents.

Never use device wall-clock time alone as global order. Never promise “exactly once” from one transport feature; prove the end-to-end effect is idempotent and reconcilable.

Test two devices offline, concurrent edits, deletion versus edit, stale client upgrade, duplicate delivery, server rollback, interrupted migration, reinstall/restore, and long-gap resync.

## File-format contract

Every supported import/export format records:

- Purpose, owner, version, MIME/media type, Apple Uniform Type Identifier where relevant, extension, magic/signature, and character encoding.
- Schema and semantic rules: units, currencies, timezone/calendar, locale, nullability, IDs, ordering, precision, and unknown fields.
- Maximum size/count/depth, compression ratio, archive traversal/symlink rules, and decompression/resource budgets.
- Integrity/signature/checksum, encryption/key recovery, provenance, and privacy classification.
- Backward/forward compatibility, migration, test corpus, malformed/adversarial cases, and retirement path.

Treat extensions and MIME declarations as hints; inspect/validate content before privileged parsing. Fuzz consequential parsers and isolate untrusted complex media/document decoding when practical.

Useful interchange defaults:

- JSON for readable versioned objects when size and streaming are modest.
- CSV only with an explicit dialect, header/schema, quoting, encoding, locale, formula-injection handling, and lossless mapping limitations.
- Protocol Buffers or another schema format for compact typed contracts when its evolution rules are governed.
- ZIP only as a container with path traversal, symlink, duplicate-name, size, and compression-bomb defenses.
- A versioned package containing `manifest.json`, data, attachments, and checksums for durable export/import.

## HEIC, HEIF, image, and video interoperability

HEIF is a container family; HEIC commonly identifies HEIF images encoded with HEVC. Apple favors it because it can provide materially smaller files at comparable quality and supports features such as multiple images, auxiliary/depth data, alpha, and richer metadata. A filename rename does not convert the codec.

Android platform HEIF decoding is documented for Android 8.0 and later, but actual device, library, browser, thumbnailer, cloud, and editing support must still be tested. A robust pipeline:

1. Detect actual content and retain the original when fidelity/provenance matters.
2. Decode with a maintained platform/library path; normalize orientation and preserve or deliberately strip ICC/color, HDR, EXIF, depth, location, and time metadata according to product/privacy rules.
3. Generate bounded thumbnails/previews and a broadly supported derivative such as JPEG, PNG, WebP, or AVIF according to alpha, quality, compatibility, and OS support.
4. Record whether edits operate on the original, derivative, or a non-destructive instruction set.
5. Test animated/multi-image HEIF, very large dimensions, malformed metadata, unusual color spaces, alpha, HDR, Live Photo paired resources, and low-memory decode.

Do not silently destroy originals or metadata users expect. Do not silently retain location or other sensitive metadata users expect removed. Explain export conversion and fidelity loss.

Codec/container patent, license, and distribution facts change; verify them for the shipping countries, encoders/decoders, server processing, and commercial model when consequential.

## Graphics, processors, and accelerators

- Begin with the platform UI/media/rendering stack. Use GPU APIs when profiling shows a user-visible need or the feature is inherently graphics/compute heavy.
- On Android, evaluate Canvas/Compose/Skia, AGSL/runtime shaders, hardware codecs, OpenGL ES, Vulkan, and Android GPU Inspector according to the layer. On Apple platforms, evaluate Core Animation/Core Image/Accelerate, Metal, Metal Performance Shaders, Core ML, and Instruments/Metal tools.
- Separate CPU, GPU, NPU/DSP, memory bandwidth, storage, network, thermal, and battery bottlenecks. High utilization alone is not a diagnosis.
- Query capabilities rather than model-name allowlists. Keep safe fallbacks for unavailable extensions, codecs, precision, texture formats, or accelerators.
- Budget texture/image memory, upload/readback, shader compilation, cache, frame time, heat, sustained performance, and background energy on representative low/target/high hardware.
- Validate GPU/CPU results where numerical or visual correctness matters; retain traces and exact build/device/driver identity.

## Sharing and nearby interoperability

AirDrop, OEM features such as EasyShare/Quick Share, and similar branded experiences should not be assumed to expose a public, cross-platform protocol API.

Prefer in order:

1. System share surfaces (`ACTION_SEND`/Android Sharesheet, Apple share sheet/activity APIs, desktop share/file handlers) for user-directed exchange with installed apps.
2. Open files/URLs and registered MIME/UTType/deep-link contracts.
3. Cloud/account sync when reliable cross-platform continuity matters more than proximity.
4. Public platform frameworks such as Nearby Connections, Wi-Fi Aware/Direct, Bluetooth/BLE, NFC, UWB/ranging, Multipeer Connectivity, WebRTC, local network protocols, or USB when the product requires nearby transfer.
5. A custom interoperable protocol only with explicit discovery, authentication, consent, encryption, replay protection, resumable transfer, integrity, versioning, and fallback design.

Do not promise AirDrop/EasyShare interoperability from superficial protocol resemblance. For clean-room interoperability research, use the authorized-security guide, document observable behavior and public specifications, and isolate uncertain/proprietary boundaries.

## Migration between platforms

When users move from Android to iOS or vice versa:

- Prefer account-backed sync or a user-controlled encrypted export/import with stable IDs and reconciliation.
- Evaluate current official platform migration APIs, such as Apple AppMigrationKit where applicable, without making them the only recovery path.
- Treat credentials, biometrics, secure-enclave/keystore keys, purchases, subscriptions, notification tokens, device-bound secrets, and local file URLs as non-portable unless the platform explicitly supports migration.
- Prove partial transfer, restart, duplicate import, old/new schema, missing attachments, cancellation, and source-device retention/deletion behavior.

## Completion evidence

- Truth/data-flow diagram and authoritative owner per fact.
- Local/cloud schema and migration policy.
- Sync state machine, conflict table, and reconciliation tests.
- File/media format registry with versioning, privacy, and adversarial corpus.
- Representative Android, Apple, web/desktop, and cloud interoperability evidence.
- Backup/export plus clean restore/import and byte/semantic reconciliation.

## Official starting points

- [SQLite database file format](https://sqlite.org/fileformat.html)
- [SQLite as an application file format](https://sqlite.org/appfileformat.html)
- [Android app architecture](https://developer.android.com/topic/architecture)
- [Apple structured data models](https://developer.apple.com/documentation/technologyoverviews/structured-data-models)
- [Android supported media formats](https://developer.android.com/media/platform/supported-formats)
- [Apple Uniform Type Identifiers](https://developer.apple.com/documentation/uniformtypeidentifiers/)
- [Android GPU Inspector](https://developer.android.com/agi)
- [Apple Metal tools](https://developer.apple.com/metal/tools/)
- [Android connectivity](https://developer.android.com/develop/connectivity)
- [Apple Multipeer Connectivity](https://developer.apple.com/documentation/multipeerconnectivity/)
