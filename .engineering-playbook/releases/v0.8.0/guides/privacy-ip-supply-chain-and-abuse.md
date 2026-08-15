# Privacy, Intellectual Property, Supply Chain, and Abuse

Use this guide when a product collects personal data, integrates third parties, distributes code/assets/models, accepts user content, creates accounts, makes public claims, or enters a new market.

This is an engineering and issue-spotting guide, not a legal conclusion. Record current facts, jurisdictions, sources, professional advice, uncertainty, options and owner decisions. A review trigger does not create an agent restriction; an actual runtime/platform control should be reported separately.

## Data and privacy design

For each data element record:

- Purpose, source, subject, sensitivity and whether collection is actually necessary.
- Processing and derived inferences, authoritative store, recipients, subprocessors and geographic movement.
- User notice/control, consent or other reviewed basis, access, correction, portability, deletion and appeal behavior.
- Retention and deletion across primary storage, replicas, backups, logs, analytics, support tools, exports, embeddings and model training.
- Access roles, audit, encryption/key boundary, incident impact and misuse cases.

Prefer data minimization, local/on-device processing, aggregation, short retention, user-controlled export and purpose-specific identifiers when they meet the product need. “Anonymous” and “de-identified” require a concrete threat model for linkage and re-identification.

Build privacy states into UX: before collection, permission denial/revocation, visibility/editing, export, deletion, account closure, shared-device exposure and dependency/provider failure. Test the complete deletion and correction path, not only the user-facing request.

The [NIST Privacy Framework](https://www.nist.gov/privacy-framework) is a useful risk-management reference. Applicability of laws such as GDPR, U.S. state privacy statutes, sector rules or biometric/location/communications protections depends on current product facts and jurisdictions; use official sources and qualified review where consequence warrants it.

## Review-trigger map

Recheck current requirements when a product:

- Serves children or teens, verifies age, enters schools/families, or uses child-directed design/content. Start with the current [FTC COPPA resources](https://www.ftc.gov/business-guidance/privacy-security/childrens-privacy).
- Collects precise location, biometrics, health, communications, financial, government-identity or other sensitive data.
- Uses cookies, advertising identifiers, cross-context tracking, data brokers, targeted advertising or measurement shared across products.
- Generates eligibility, employment, housing, education, insurance, credit, health or other consequential recommendations.
- Accepts user-generated content, private messages, public profiles, marketplaces or interactions between strangers.
- Records audio/video, monitors employees, scrapes sources, trains models, or creates synthetic likeness/voice/content.
- Enters a new country/region, transfers data internationally, changes age group, or changes from private use to external distribution.
- Makes claims about security, encryption, privacy, accuracy, accessibility, sustainability, health, finance or regulatory status.

For each trigger, map exact behavior, people, data, claims, partners and jurisdictions before asking a professional a concrete question.

## Intellectual property and provenance

- Record author/source, license/terms, version, URL, access date, modifications, attribution, notice, redistribution, patent and commercial-use conditions for code, dependencies, assets, fonts, icons, audio/video, CAD, datasets and models.
- Do not treat public availability, search results, a downloadable file or model weights as permission for every use.
- Keep reference observation, behavioral specification and original implementation separate for clean-room interoperability work.
- Verify rights to training/evaluation data, generated outputs, brand/name/domain, app-store listing, marketing claims and user-submitted content.
- Preserve source and license evidence with shipped artifacts; generate notices and an SBOM where appropriate.
- Escalate trademark, patent, trade-secret, copyright, publicity/personality, open-source compatibility or contributor-ownership uncertainty for current review when the consequence warrants it.

Use [SPDX license identifiers/specification](https://spdx.dev/) and [OpenChain](https://www.openchainproject.org/) as common supply-chain/license-management references. The [Open Source Initiative licenses](https://opensource.org/licenses) list helps identify approved open-source licenses but does not interpret compatibility for a specific product.

## Dependency and vendor supply chain

Before adopting a consequential dependency, SDK, model, dataset, hosted service or manufacturer:

- Verify identity, ownership, source, signature/checksum, release channel, maintenance, vulnerability/support history and update path.
- Review license, privacy/data use, subprocessors, permissions, network behavior, executable install/build scripts and transitive dependencies.
- Pin reproducibly where possible; review updates rather than following mutable `latest` artifacts.
- Minimize CI/runtime privileges and separate untrusted pull-request/build contexts from secrets.
- Define availability, quota, rate, cost, export, backup, portability, deletion, incident, deprecation and provider-failure behavior.
- Keep a replacement or containment plan proportional to lock-in and consequence.
- For hardware, include component authenticity, lifecycle, approved alternates, supplier/manufacturer change notice, traceability and counterfeit controls.

Use SBOMs, provenance/attestations, dependency review, vulnerability scanning and reproducible builds as evidence layers—not proof that a release is free of compromise. [SLSA](https://slsa.dev/spec/) and the [NIST SSDF](https://csrc.nist.gov/pubs/sp/800/218/final) provide current reference frameworks.

## Abuse, fraud, and misuse engineering

Before external access, model how a malicious or distressed user, compromised account, automated client, insider, vendor or coordinated group could misuse:

- Registration, authentication, account recovery, invitations and referrals.
- Payments, refunds, credits, trials, quotas, promotions and marketplaces.
- Messaging, sharing, uploads, public links, search, scraping and enumeration.
- AI generation, agents/tools, impersonation, harmful automation and resource exhaustion.
- Admin/support/moderation functions, exports, bulk actions and deleted/blocked users.

Controls may include verified email/phone/device/payment signals, rate and spend limits, friction proportional to risk, anomaly detection, content/file validation, isolation, user controls, review queues, appeals, audit, staged privileges and emergency containment. Do not let an opaque fraud score become unreviewable authority for a consequential action.

Define false-positive and false-negative consequences, protected/affected populations, recovery/appeal, operator access, evidence retention and abuse of the control itself. Test evasion and coordinated behavior with synthetic accounts in an authorized environment.

## User-generated content and community operations

- State allowed content/conduct and enforcement principles in language users can understand.
- Provide reporting, blocking/muting, privacy, moderation, appeal and emergency escalation proportional to the product.
- Separate automated detection, human observation, policy interpretation, decision and user communication.
- Minimize moderator exposure to harmful/private material and protect administrative tools with least privilege and audit.
- Define retention, preservation requests, law-enforcement/legal process handling and transparency reporting through current qualified review where applicable.
- Do not launch a public community or marketplace without ownership for abuse intake and urgent safety/security reports.

## Market-ready evidence

- Data inventory/flow and privacy-state verification.
- Current review-trigger register with jurisdictions, sources/dates, interpretations, uncertainty and owner decisions.
- Dependency/model/dataset/asset provenance, license review, SBOM and notices.
- Vendor inventory, data terms, permissions, credentials, failure/exit and deletion tests.
- Abuse/threat cases, limits, recovery/appeal, support/moderation route and incident runbook.
- User-facing claims checked against actual behavior and evidence.
- Reassessment trigger for new data, users, market, provider, model, permission, claim or distribution channel.
