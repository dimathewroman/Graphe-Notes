# Release Checklist

## Identity and scope

- [ ] The versioned repository/product artifact, semantic version classification, target channel, commit, and artifacts are identified.
- [ ] The release uses `X.Y.Z` in manifests and an annotated `vX.Y.Z` Git tag; prerelease suffixes identify a real alpha, beta, or release candidate rather than an ordinary commit.
- [ ] Independent platform build, schema, API/protocol, event, file/export, instruction-manifest, model/prompt/evaluation, dataset, or firmware identities are recorded when applicable rather than hidden in the product version.
- [ ] The changelog, compatibility statement, and written `1.0.0` stability criteria remain accurate; released tags and records are not rewritten.
- [ ] Included changes match the approved scope; unrelated work is excluded.
- [ ] Risk level, owner-visible behavior, and rollback path are recorded.
- [ ] Roadmap, issue, decision, and changelog state agree.
- [ ] Applicable specialist guides, standards/versions, and Not Applicable rationales are recorded.
- [ ] The latest stable playbook release and current authoritative sources were checked; newer guidance used, deferred, or found incompatible is recorded.

## Review and verification

- [ ] Complete diff reviewed, including generated files and dependencies.
- [ ] Relevant unit, integration, UI/device, migration, and regression tests pass.
- [ ] Performance was measured on representative hardware for affected paths.
- [ ] Relevant adaptive layouts cover breakpoint boundaries, folded/unfolded and posture states, orientation, live resizing/multi-window, inputs, theme, accessibility, and degraded states.
- [ ] Critical editing/creation/submission journeys preserve task identity, entered values, navigation, focus/anchor where material, and effect count through stateful transitions, recreation, and required process restoration; final-state screenshots are not the sole evidence.
- [ ] Baseline failures are separated from regressions introduced by this release.

## Security, privacy, and data

- [ ] No secrets or private data are present in source, artifacts, logs, screenshots, or test fixtures.
- [ ] Permissions, credentials, external dependencies, and supply-chain changes were reviewed.
- [ ] Data migrations, compatibility, backup, restore, retry, and reconciliation behavior were tested when applicable.
- [ ] Telemetry and crash reporting collect only approved data.

## Delivery and recovery

- [ ] Artifact provenance, signature, checksum, and destination are verified.
- [ ] Canary/private testing is complete when required.
- [ ] Rollback or forward-fix procedure is viable and has an owner.
- [ ] Production-health signals and post-release review timing are defined.
- [ ] Final evidence and known limitations are recorded.
- [ ] Support, compatibility, export, dependency-exit, and retirement effects are understood.
