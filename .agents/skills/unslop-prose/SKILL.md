---
name: unslop-prose
description: Edit eligible human-facing prose, product copy, messages, and narrative documentation to remove generic AI phrasing while preserving voice, facts, citations, and technical meaning. Do not use for technical truth artifacts, even when explicitly requested.
---

# Unslop prose

Use this skill for prose that people read for meaning, tone, or persuasion. Do not let it override technical precision, source attribution, accessibility, legal meaning, or a requested house style.

## When to use

Use it for:

- product copy;
- release announcements;
- explanatory prose;
- emails, posts, and messages;
- narrative documentation;
- headings, onboarding text, and error messages.

Do not use it automatically for:

- source code or comments whose wording is part of an interface;
- configuration, commands, SQL, schemas, or structured data;
- specifications;
- ADRs;
- test plans;
- evidence reports;
- security reports;
- provenance reports;
- machine-readable artifacts;
- schemas;
- contracts;
- other technical truth artifacts;
- quoted material;
- text governed by a legal, compliance, localization, or accessibility requirement.

An explicit request does not extend this boundary. These protected artifacts
are hard non-eligible for this skill. For a human-facing changelog or release
note, use this skill only after its technical meaning is frozen and preserve its
exact technical and provenance terms.

## Process

1. Identify the audience, purpose, tone, and non-negotiable facts.
2. Scan for the patterns below.
3. Rewrite only where the change improves clarity or voice.
4. Preserve citations, measurements, terminology, constraints, and uncertainty.
5. Read the result once for rhythm and once for factual drift.
6. Ask: "What still sounds generic, inflated, or evasive?" Fix only those parts.

## Add a human voice without inventing one

- Prefer concrete facts, examples, and consequences.
- Vary sentence length when it improves readability.
- Use first person only when the speaker actually owns the opinion or experience.
- Allow some texture, but do not add fake anecdotes, confidence, emotion, or controversy.
- Preserve deliberate whimsy when it fits the product.
- Do not manufacture an opinion merely to sound human.

## Patterns to reduce

### Empty content

- Puffery such as "pivotal moment," "testament to," or "evolving landscape."
- Promotional adjectives that replace evidence.
- Vague attribution such as "experts believe" without a source.
- Formulaic transitions and generic conclusions.
- Name-dropping that does not explain why a source matters.
- Repeated restatement of the same point.

### Generic AI phrasing

Prefer plain words when they are equally precise:

- "use" instead of "utilize" or "leverage";
- "help" instead of "facilitate";
- "many" instead of "numerous";
- "if" instead of "in the event that";
- a direct statement instead of "not just X, but Y";
- the actual mechanism instead of a vague metaphor.

Technical terms such as "API surface," "test harness," "primitive," "modality," or "scaffolding" are allowed when they are the correct terms. Replace them only when they obscure the meaning.

### Structure and punctuation

- Avoid repetitive em dashes, colons, bold lead-ins, title-case headings, and decorative emoji.
- Parentheses, dashes, colons, and technical notation are allowed when they improve clarity.
- Do not force every idea into three bullets.
- Do not cycle through synonyms merely to avoid repeating the right noun.
- Use headings and lists only when they help the reader navigate.

### Chatbot residue

Remove phrases such as:

- "Of course!";
- "Certainly!";
- "I hope this helps";
- generic praise that does not add information;
- invitations for follow-up that the artifact does not need;
- cutoff disclaimers that should instead become sourced facts or explicit unknowns.

### Sentence quality

- Split sentences that require rereading.
- Prefer active voice when the actor matters.
- Replace weak verbs plus adverbs with a stronger verb or a measurement.
- State what a mechanism does, not merely how it feels.
- Keep uncertainty that is real. Remove only stacked or evasive hedging.

## Technical-prose safety rules

When editing technical prose:

1. Keep exact commands, identifiers, file paths, API names, version numbers, units, and error text unchanged unless the task explicitly asks to alter them.
2. Keep requirement keywords such as MUST, SHOULD, MAY, PASS, FAIL, and INCONCLUSIVE.
3. Do not turn a qualified claim into certainty.
4. Do not remove a caveat because it sounds awkward.
5. Do not compress separate security, privacy, cost, or rollback consequences into one vague sentence.
6. Do not change the scope of an approval, permission, or prohibition.
7. Preserve citations next to the claims they support.

## Completion check

The finished prose should be:

- more specific;
- easier to read aloud;
- less repetitive;
- faithful to the source;
- appropriate for its audience;
- free of invented facts or personality.

Return the revised prose only when the caller asks for a finished artifact. Otherwise, explain the most important edits and show representative examples.
