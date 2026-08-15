# Authorized Security Research, Reverse Engineering, and Disclosure Guide

Use this guide when assessing owned systems, participating in a vulnerability disclosure or bounty program, studying interoperability, or inviting outside research.

This guide does not grant authorization, determine legality, or extend any third party's safe harbor. Authorization must come from each party with legal authority over the target and conduct and is bounded by its current written terms; it does not resolve separate third-party, statutory, contractual, privacy, or platform questions. Legal and program rules are review inputs, not agent-created restrictions. If the current runtime or tool actually blocks an action, report that separate observable boundary.

## Required research record

Before active testing, record:

- Research objective and smallest evidence needed.
- Asset owner, exact targets, environments, accounts, dates, and authorization source.
- In-scope and out-of-scope techniques, data, identities, services, and third parties.
- Rate, load, availability, persistence, social-engineering, physical-access, and destructive-test limits.
- Test-data plan, privacy boundary, storage location, retention, and deletion.
- Emergency contact, stop conditions, disclosure channel, coordination terms, and any bounty eligibility conditions.
- Applicable contract, program policy, license, platform rule, and unresolved legal questions, each with source and review date.

If a target, technique, account, dataset, or downstream service is not clearly covered, clarify it before expanding the test. Do not infer that one company's authorization binds a cloud provider, customer, user, carrier, bank, platform, or other third party.

## Controlled research workflow

1. **Model the system.** Map trust boundaries, identities, privileges, data flows, update channels, protocol states, dependencies, and likely abuse cases.
2. **Use the least invasive method.** Begin with documentation, configuration, static review, owned fixtures, local replicas, and test accounts. Escalate only as the research question requires and authorization permits.
3. **Keep evidence reproducible.** Record target version, environment, prerequisites, exact observations, timestamps, request or trace identifiers, and expected versus observed behavior without retaining unnecessary sensitive content.
4. **Verify impact carefully.** Demonstrate the minimum access or effect necessary. Do not browse unrelated records to make the report look stronger.
5. **Contain unexpected access.** Stop when personal, third-party, privileged, regulated, or production data appears unexpectedly; preserve minimal metadata; notify the designated contact; follow their handling direction.
6. **Avoid collateral effects.** Do not establish persistence, exfiltrate data, degrade service, pivot to third parties, access unrelated accounts, or socially engineer people unless the exact act is explicitly authorized and safely contained.
7. **Report privately.** Use the designated channel. State impact and uncertainty separately and propose remediation or compensating controls without overstating exploitability.
8. **Clean up and learn.** Remove test artifacts and access, verify restoration, retain only approved evidence, and record defensive lessons and coverage gaps.

## High-quality finding report

- Concise title and affected asset/version.
- Authorization/program and scope reference.
- Preconditions and attacker capabilities.
- Expected behavior and observed behavior.
- Minimal reproduction or proof of concept.
- Security property bypassed and realistic impact.
- Evidence with secrets and personal data redacted.
- Confidence, uncertainty, variants not tested, and possible false-positive conditions.
- Suggested containment, remediation, regression tests, and disclosure coordination.

A vulnerability disclosure program is not necessarily a bounty. Payment, recognition, eligibility, duplicate handling, publication, and safe harbor are program-specific and may change. Re-read the current rules immediately before testing and reporting. [Apple Security Bounty](https://security.apple.com/bounty/guidelines/), [Google Bug Hunters](https://bughunters.google.com/about), and [Microsoft bounty guidelines](https://www.microsoft.com/en-us/msrc/bounty-guidelines) provide examples of report and conduct expectations, not universal authorization.

## Reverse engineering and interoperability

For clean-room work, separate three artifacts and preferably three roles or review passes:

1. **Observation record:** lawfully obtained public behavior, traffic from owned/test accounts, published documentation, public metadata, and independently measured state transitions.
2. **Behavioral specification:** inputs, outputs, state machine, errors, timing, compatibility constraints, and evidence references; no copied proprietary code, secrets, credentials, or unnecessary expressive material.
3. **Independent implementation:** original code written from the behavioral specification and verified against lawful observations.

Additional practices:

- Track the provenance and license of every artifact, tool, dependency, protocol description, and test fixture.
- Distinguish an open standard, a publicly documented API, observed behavior, inference, and an undocumented private service.
- Use owned devices, accounts, data, backups, and network captures unless broader access is explicitly authorized.
- Never use extracted credentials, private user data, signing material, or access to an unrelated service as a shortcut to compatibility.
- Study security controls to understand and test them; do not silently weaken production encryption, authentication, integrity, update trust, or user consent to make interoperability easier.
- Seek current legal review before circumvention, access-control bypass, proprietary protocol redistribution, confidential-material use, or public disclosure where authorization or an exemption is uncertain.

The U.S. Copyright Office's DMCA Section 1201 exemptions are limited classes with conditions and a three-year rulemaking cycle, not blanket permission. Check the exact current exemption and jurisdiction. See the [2024 Section 1201 proceeding](https://www.copyright.gov/1201/2024/).

## Running a vulnerability disclosure program

Before inviting public research:

- Publish a clear policy naming covered assets, allowed techniques, prohibited harm, data-handling rules, authorization/safe-harbor commitment, contact method, and disclosure expectations.
- Publish a standards-conformant [`security.txt`](https://www.rfc-editor.org/rfc/rfc9116.html) and monitor every listed contact.
- Accept reports without requiring unnecessary personal information or a particular nationality.
- Define acknowledgement, triage, status-update, remediation, and disclosure targets; provide a secure channel for sensitive evidence.
- Separate severity, exploitability, affected scope, remediation priority, and bounty amount.
- Protect reporters acting within the policy, while stating honestly which third parties the organization cannot bind.
- Maintain duplicate handling, appeals, coordinated disclosure, credit, advisory, CVE, supported-version, patch, and customer-notification processes appropriate to the product.
- Exercise intake with a test report before publishing the program.

[NIST SP 800-216](https://csrc.nist.gov/pubs/sp/800/216/final) provides a vulnerability disclosure program lifecycle. [CISA BOD 20-01](https://www.cisa.gov/news-events/news/cisa-issues-final-vulnerability-disclosure-policy-directive-for-federal-agencies) governs U.S. federal civilian agencies but offers a useful policy model for scope, authorization, contact, and coordinated disclosure.

## Legal and policy review boundaries

- The U.S. Department of Justice's CFAA charging policy says good-faith security research should not be charged under that policy. It is not immunity from private civil claims, other laws, state law, contractual claims, third-party rights, or conduct outside its definition. See the [DOJ policy announcement](https://www.justice.gov/archives/opa/pr/department-justice-announces-new-policy-charging-cases-under-computer-fraud-and-abuse-act).
- Vendor safe harbor covers only what the vendor can authorize and only conduct within the current policy. “A bounty exists” does not establish that a particular asset or technique is in scope.
- Possession of a device, binary, account, subscription, or URL does not by itself answer authorization, copyright, confidentiality, privacy, export, platform, or contract questions.
- When the answer matters, preserve the exact current policy and source date, ask the asset owner or qualified counsel a concrete question, and record the response and owner decision.

## Project evidence

- Signed or otherwise durable authorization and scope record.
- Test environment and synthetic-data evidence.
- Research log separating observations, hypotheses, actions, and results.
- Minimal report with redacted evidence and delivery receipt.
- Cleanup and restoration verification.
- Disclosure timeline and current owner for remediation.
- For clean-room work, traceability from lawful observation to behavioral requirement to original implementation test.

Primary references were reviewed in August 2026. Program scope and legal interpretations are especially time- and jurisdiction-sensitive; verify them for each engagement.
