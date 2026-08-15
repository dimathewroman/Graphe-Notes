# On-Device Data, Indexing, Search, and RAG

Use this guide when a product must ingest, store, synchronize, search, retrieve, or reason over large collections of text, images, audio, video, sensor data, or embeddings—especially on resource-constrained devices.

The goal is not to “put everything in optimized arrays.” The goal is to choose representations and indexes that fit actual access patterns, correctness, privacy, storage, memory, latency, battery, and recovery budgets.

## Begin with a data contract

For each data class, record:

- Source, ownership, consent/license, sensitivity, trust, and authoritative copy.
- Expected item count, item-size distribution, ingest/growth rate, update/delete frequency, and retention.
- Required queries, filters, sorts, joins, text/semantic search, recency, and acceptable stale results.
- Offline, sync, backup, export, deletion, migration, and corruption-recovery behavior.
- Latency, storage, RAM, CPU/GPU, energy, network, and monetary budgets by representative device tier.
- Stable identity, content hash, version, timestamps, provenance, access-control labels, and schema.

Estimate the complete footprint:

> originals + thumbnails/transcodes + database + indexes + embeddings + write-ahead log/temp/compaction + backup/sync staging + migration/rollback headroom

Hundreds of thousands of text records may fit comfortably while a much smaller media collection dominates storage. Measure real distributions; averages conceal large files and tail queries.

## Separate bytes, metadata, and indexes

A robust default for mixed media is:

- Store large binary originals and derivatives as files or object blobs with stable IDs and content hashes.
- Store metadata, relationships, state, permissions, and blob references in a transactional database.
- Generate bounded thumbnails, previews, waveforms, transcripts, or lower-resolution derivatives for common workflows.
- Use dedicated indexes for the queries they accelerate; every index costs storage, ingest work, memory, migration time, and delete/update complexity.

Storing blobs inside a database can be correct when atomicity, backup, encryption, or deployment evidence supports it. Files plus database references can be correct when lifecycle reconciliation is implemented. Test orphan cleanup, missing blobs, partial writes, backup/restore, and migration either way.

## Pick the structure from the access pattern

| Need | Typical starting structure | Important trade-off |
|---|---|---|
| Exact identity lookup | Primary key/hash index | Stable identity and collision handling |
| Filters, ranges, ordering | B-tree-style database index | Write/storage cost; column order matters |
| Sparse subset query | Partial index | Query must match predicate |
| Full-text words/phrases | Inverted full-text index such as SQLite FTS5 | Tokenization, language, index size, delete/update sync |
| Tags/facets | Normalized relation or indexed mapping | Avoid unbounded denormalized strings |
| Exact vector similarity | Flat vector scan/index | Accurate but compute grows with collection |
| Approximate semantic search | HNSW, IVF, product-quantized or platform-supported ANN | Recall, RAM, build/update time, portability |
| Analytics across columns | Columnar/vectorized representation | Poor fit for transactional item updates |
| Dense numeric/media kernels | Contiguous arrays/tiles/batches | Conversion and unused-data cost |

Row-oriented transactional databases are normally the right source of truth for app operations. Arrays and columnar formats can be excellent for repeated numeric or analytical kernels; they are not a universal replacement for a database.

## Ingestion pipeline

Make ingestion restartable and observable:

1. Accept or discover an item and assign stable operation/content identity.
2. Validate type from content as well as extension; bound size, dimensions, duration, archive expansion, and parser resources.
3. Write to staging, compute hash, deduplicate according to product semantics, and scan/sanitize where required.
4. Extract metadata with provenance and confidence; never silently treat model-inferred labels as original facts.
5. Persist authoritative metadata and blob state transactionally where possible.
6. Generate derivatives and text/vector indexes in resumable background jobs.
7. Mark searchable/available states explicitly; reconcile missing, duplicate, orphaned, or half-indexed items.
8. Propagate updates, access changes, and deletion to every derivative, cache, index, backup, and peer according to policy.

Bound concurrent decoding, thumbnailing, hashing, embedding, and uploads. Backpressure or pause ingestion when storage, memory, thermals, battery, or queue age reaches a declared threshold.

## Query and retrieval efficiency

- Start from the user query and inspect the actual query plan; an index that exists may still be unused or harmful.
- Fetch only required columns/bytes and decode media only at the displayed or processing size.
- Prefer keyset/cursor pagination for large changing collections; avoid unbounded offset scans.
- Batch where it removes repeated overhead, but small local SQLite queries can be efficient when they express clear domain steps.
- Keep caches bounded, keyed by complete semantics, observable, and safely invalidated. Cache correctness before hit rate.
- Precompute expensive stable derivatives; compute volatile or rarely used results on demand.
- Partition or shard only after one-device/one-database limits and operational costs are measured.
- Preserve free-space and compaction/migration headroom. Optimize and vacuum based on evidence and lifecycle constraints, not a blind schedule.

Measure typical and tail query latency, bytes read, rows scanned, index size, cache hit/miss, allocation, energy, thermal drift, ingest lag, delete propagation, and result quality.

## Search ladder

Use the least complex mechanism that meets the outcome:

1. Exact lookup and structured filters.
2. Prefix, token, phrase, and ranked full-text search.
3. Synonyms, normalization, stemming, language-aware tokenization, typo tolerance, and explicit tags.
4. Hybrid lexical plus semantic retrieval when evaluated queries show a real gap.
5. Reranking when first-stage recall is adequate but ordering is not.
6. Generative answers only when synthesis adds value beyond showing retrieved records.

Tags can be user-authored, rule-derived, imported, or model-suggested. Preserve source, confidence, editable state, and evaluation; do not collapse an inference into authoritative metadata.

## RAG as a product pipeline

Retrieval-augmented generation is not “attach a vector database.” Define:

> ingest -> parse -> chunk/structure -> label provenance and access -> index -> retrieve -> filter -> optionally rerank -> assemble bounded context -> generate -> cite/verify -> evaluate -> refresh/delete

For each stage:

- **Parsing/chunking:** preserve document structure, stable source IDs, positions, and version. Test tables, images, OCR, code, long records, and malformed inputs.
- **Embeddings/index:** record model/version, dimensions, normalization, quantization, index type, memory/storage, build/update/delete behavior, and exact-search baseline.
- **Retrieval:** combine metadata/authorization filters with lexical/vector retrieval; measure recall on a labeled query set.
- **Reranking:** budget added latency/cost and compare against simple ranking.
- **Context assembly:** deduplicate, diversify, respect token budget, keep provenance adjacent, and treat retrieved instructions as untrusted content.
- **Generation:** require supported claims, uncertainty/abstention, and deterministic handling for calculations or consequential truth.
- **Freshness/deletion:** ensure changed or deleted source data stops appearing in retrieval, caches, and answers within the promised interval.

Evaluate retrieval and generation separately. An answer can fail because the right source was never retrieved, because ranking/context excluded it, or because the model misused good evidence.

## On-device vector and model choices

- Establish lexical and exact-vector baselines before approximate indexes.
- HNSW often provides fast search but can consume substantial memory; IVF and product quantization trade recall and build/training complexity for smaller or faster indexes.
- Quantize embeddings or models only after measuring task-quality loss on representative data.
- Load indexes and model weights lazily when startup and memory pressure matter; define eviction and recovery.
- Use platform accelerators only where exact operator support, transfer cost, power, thermals, and fallback are proven.
- Route by capability: local for privacy/offline/low marginal cost, hosted for harder tasks or larger context, deterministic fallback when neither is appropriate.

Never ship a provider secret in a client app. A user-authored provider key requires explicit secure storage, scope, disclosure, deletion, and failure UX; a product-owned key normally belongs behind an authenticated, rate-limited service boundary.

## Failure and recovery matrix

Test at least:

- Process death during ingest, migration, index build, sync, or deletion.
- Low memory, low storage, locked/protected files, unavailable accelerator, and thermal throttling.
- Corrupt database/index/blob, stale schema, missing derivative, duplicate item, hash mismatch, and orphaned file.
- Offline, partial download/upload, peer conflict, server rollback, expired credential, and quota/rate limit.
- Rebuild indexes from authoritative state and restore data from a verified backup/export.
- Access revocation and deletion across search, embeddings, generated caches, logs, and other devices.

## Primary references

- [SQLite query planner](https://sqlite.org/queryplanner.html)
- [SQLite FTS5](https://sqlite.org/fts5.html)
- [SQLite partial indexes](https://sqlite.org/partialindex.html)
- [SQLite: many small queries are efficient](https://sqlite.org/np1queryprob.html)
- [Faiss documentation](https://github.com/facebookresearch/faiss/wiki)
- [Faiss index selection guidance](https://github.com/facebookresearch/faiss/wiki/Guidelines-to-choose-an-index)
- [Android memory overview](https://developer.android.com/topic/performance/memory-overview)
- [Apple memory-use analysis](https://developer.apple.com/documentation/xcode/analyzing-memory-usage/)

Library support, platform acceleration, codecs, and storage behavior change. Verify exact target devices, data, versions, licenses, and quality/resource evidence before adoption.
