# Cryptography, Key Management, and Client Trust Guide

Use this guide for encryption, signatures, authentication secrets, signing, secure storage, attestation, update trust, and client-side protection. Cryptography is R3 work: document the threat model and invariants, use reviewed implementations, obtain independent review where possible, test failure and recovery, and keep the owner informed about material residual risk.

This guide is an engineering baseline, not a claim of certification, export classification, or legal compliance.

## Begin with the promise

Before choosing an algorithm or library, state:

- The asset and the consequence of disclosure, alteration, impersonation, replay, rollback, or permanent loss.
- The adversary and capabilities considered: stolen device, malicious app, compromised account, network attacker, insider, server compromise, supply-chain compromise, or future cryptanalysis.
- Where plaintext exists and which component is authoritative.
- Who must be able to decrypt, sign, rotate, revoke, recover, export, or destroy.
- Confidentiality lifetime and availability/recovery requirement.
- Metadata that encryption does not hide.
- What users are promised and what is explicitly out of scope.

Do not claim “end-to-end encrypted,” “zero knowledge,” “hardware protected,” “anonymous,” “FIPS validated,” or equivalent properties without a precise architecture and evidence matching the claim.

## Construction baseline

- Prefer current platform APIs or widely reviewed libraries and protocols. Do not design a new cipher, mode, signature scheme, password protocol, or key exchange for production.
- Use authenticated encryption for confidential structured data and bind relevant context as associated data.
- Use cryptographically secure randomness. Nonces and initialization vectors must follow the selected construction's uniqueness or randomness requirement.
- Derive subkeys with a standard key-derivation function (KDF) and domain separation. Do not reuse one key for encryption, signing, authentication, wrapping, and unrelated environments.
- Hash passwords with a salted, deliberately expensive password-hashing construction; do not reversibly encrypt them. Permit password-manager use and rate-limit verification.
- Version the ciphertext envelope: algorithm/suite, key version, format version, nonce, authenticated context, and migration metadata. Do not infer formats from ciphertext length.
- Authenticate protocol messages and bind identities, versions, purpose, sequence, and context to prevent substitution, downgrade, cross-protocol, and replay errors.
- Define fail-closed behavior for authenticity failures while preserving diagnosable, non-secret error evidence.
- Add known-answer, negative, corrupted-input, replay, rollback, cross-version, migration, and recovery tests. Cryptographic unit tests do not replace protocol and authorization tests.

For a beginner: **associated data** is metadata that is authenticated but not encrypted; a **ciphertext envelope** is the versioned package containing encrypted data and the metadata needed to process it safely; and a **cryptoperiod** is the approved time or usage span for a key.

## Key hierarchy and lifecycle

Separate data-encryption keys, key-encryption keys, signing keys, authentication secrets, recovery keys, and environment or tenant boundaries according to the threat model. Envelope encryption usually permits data keys to rotate or be destroyed without exposing a root key broadly.

Maintain a key inventory with:

| Field | Question |
|---|---|
| Owner and purpose | Who is accountable, and what single purpose may this key serve? |
| Scope | Which environment, tenant, device, user, data class, artifact, or protocol uses it? |
| Origin and storage | Where was it generated? Is it exportable? Is hardware protection verified? |
| Access | Which principals and operations are permitted? How are accesses audited? |
| Algorithm and version | Which exact suite, parameters, provider/module, and format are used? |
| Cryptoperiod | When does use begin and end? What rotates automatically or manually? |
| Recovery | Is backup allowed? Who can recover, under what quorum, and how is a drill verified? |
| Revocation and compromise | How is use stopped, affected data identified, re-keying performed, and users notified? |
| Destruction | What does deletion mean across replicas, backups, devices, exports, and caches? |

Operational rules:

- Keep root and high-impact signing material out of general developer and agent workspaces.
- Use a key-management service (KMS), hardware security module (HSM), Secure Enclave, Keychain, Android Keystore, or equivalent isolation where the threat model justifies it.
- Grant operation-specific access rather than broad read/export access. Separate production from development and recovery access.
- Rotate because the threat model, cryptoperiod, personnel, algorithm, provider, or compromise state calls for it—not as untested ceremony.
- Exercise generation, activation, rotation, rollback, revocation, recovery, migration, expiry, and destruction before depending on them.
- Backing up encrypted data without a deliberate key-recovery policy may create an unrecoverable backup. Backing up every key indefinitely may defeat deletion and compromise containment.

[NIST SP 800-57 Part 1 Rev. 5](https://csrc.nist.gov/pubs/sp/800/57/pt1/r5/final) is the primary lifecycle reference. [NIST SP 800-63B](https://pages.nist.gov/800-63-4/sp800-63b/authenticators/) provides current authenticator and password guidance.

## Platform secure storage and attestation

- Use [Android Keystore](https://developer.android.com/privacy-and-security/keystore) and [Apple Keychain](https://developer.apple.com/documentation/security/storing-keys-in-the-keychain) according to their documented access controls and backup behavior.
- Prefer non-exportable and hardware-backed keys when available and verified. Record the fallback behavior on devices without the desired security level.
- Hardware-backed storage limits extraction; it does not necessarily prevent compromised application code from asking the key to perform an allowed operation.
- For Android attestation, validate the certificate chain, trusted root, revocation state, challenge, package identity, authorization list, and security level on a trusted service. An API returning a certificate is not sufficient evidence. See [Android key attestation](https://developer.android.com/privacy-and-security/security-key-attestation).
- Treat lost-device, biometric change, passcode removal, restore, device migration, account recovery, and secure-hardware reset as product states with explicit user experience and tests.

## Transport and secure-update trust

- Use current platform transport security such as TLS, authenticate the intended peer and hostname, and do not disable certificate or hostname validation to make a connection work. Treat optional certificate pinning as a separate design with rotation, recovery, expiry, and dependency-change behavior.
- Define the complete update trust chain: root and delegated signing keys, signed metadata and artifacts, product/channel/version/hash binding, threshold or role separation where warranted, and trusted distribution paths.
- Prevent rollback, freeze, mix-and-match, wrong-product/channel, and indefinitely stale metadata according to the threat model. Define time/freshness behavior for offline or clock-invalid devices.
- Design signing-key delegation, rotation, revocation, compromise recovery, emergency release, offline recovery image, interrupted update, and compatible rollback before depending on remote updates.
- Verify the installed/running artifact, not only download success. Preserve signing/provenance evidence and test compromised-key and lost-update-service scenarios.

## Client trust and obfuscation

Assume a determined party can inspect, instrument, replay, and modify a distributed client.

- Enforce authorization, transaction validation, entitlements, quotas, and consequential state transitions at an authoritative boundary when the threat model requires it.
- Never place a reusable server credential, private signing key, global decryption key, or hidden authorization rule in a client and call it protected because it is obscured.
- Certificate pinning, integrity signals, attestation, jailbreak/root signals, anti-debugging, and anti-tamper checks can raise cost or inform risk decisions. Define failure, recovery, false-positive, and rotation behavior; do not treat any one signal as proof of trust.
- Obfuscation and symbol stripping deter casual inspection and copying but do not provide confidentiality. Keep mapping and symbol files protected and available for diagnostics.
- Android R8 is primarily a shrinking and optimization tool; name obfuscation is incidental resistance, not a security boundary. See [Android app optimization](https://developer.android.com/topic/performance/app-optimization/enable-app-optimization).
- Keep secret-independent functionality usable when possible so loss or rotation of a credential does not destroy unrelated user data.

OWASP treats mobile resilience as defense in depth, not a replacement for sound architecture, cryptography, or server validation. See [MASVS-RESILIENCE](https://mas.owasp.org/MASVS/11-MASVS-RESILIENCE/) and [MASTG obfuscation guidance](https://mas.owasp.org/MASTG/knowledge/generic/MASVS-RESILIENCE/MASTG-KNOW-0111/).

## Algorithm and provider change

- Maintain a crypto bill of materials: algorithms, parameters, protocols, libraries, providers, certificates, keys, formats, owners, data lifetime, and migration dependencies.
- Monitor standards and library/provider advisories. Separate an algorithm weakness from an implementation, configuration, protocol, or key-custody weakness.
- Test reading old data and writing the new format; define interrupted migration and rollback behavior.
- Inventory long-lived data exposed to “harvest now, decrypt later” risk. NIST finalized ML-KEM, ML-DSA, and SLH-DSA in 2024; adopt standardized, reviewed implementations through a planned migration rather than hand-built post-quantum hybrids. See [NIST Post-Quantum Cryptography](https://csrc.nist.gov/Projects/Post-Quantum-Cryptography) and [FIPS 203](https://csrc.nist.gov/pubs/fips/203/final).
- A product is not “FIPS validated” merely because it uses an approved algorithm. Validation applies to identified modules and configurations in the [Cryptographic Module Validation Program](https://csrc.nist.gov/Projects/cryptographic-module-validation-program/validated-modules); [FIPS 140-3](https://csrc.nist.gov/pubs/fips/140-3/final) defines module requirements.
- Apple distribution may require an export-compliance determination for software that uses or contains encryption. Verify the current obligation in [App Store Connect export compliance](https://developer.apple.com/help/app-store-connect/manage-app-information/overview-of-export-compliance).

## Review evidence

- Threat model and precise user-facing security promises.
- Protocol/state diagram and authoritative trust decisions.
- Crypto/key inventory with no secret values.
- Library, algorithm, parameter, module/provider, and platform-version evidence.
- Independent design and implementation review for consequential uses.
- Negative, tamper, replay, downgrade, migration, rotation, revocation, recovery, and lost-device tests.
- Evidence that logs, crash reports, analytics, build artifacts, backups, exports, and support tools do not disclose secrets or prohibited plaintext.
- Compromise runbook naming detection, containment, affected scope, re-keying, compatibility, user impact, notification review, and post-incident proof.

Primary references were reviewed in August 2026. Pin the exact standard and platform versions used by the project and recheck them before a material design or release.
