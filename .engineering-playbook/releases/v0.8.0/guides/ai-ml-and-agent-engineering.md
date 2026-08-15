# AI, Machine Learning, and Agent Engineering

Use this guide when a product learns from data, calls a model, runs inference locally, retrieves knowledge, generates media/code, or lets an agent use tools. It supplements the core AI profile in `PLAYBOOK.md`.

AI is one implementation option. Begin with the user outcome and failure cost, then choose the least complex mechanism that meets it.

## Capability ladder

Evaluate in this order:

1. Clear UX, deterministic rules, search, SQL, constraints, scheduling, optimization, signal processing, or conventional algorithms.
2. Statistics or classical machine learning for prediction, ranking, clustering, anomaly detection, forecasting, or recommendations.
3. A specialized local or hosted model for perception, language, generation, or embeddings.
4. Retrieval plus a model when current/private knowledge is required and can be cited or verified.
5. A tool-using workflow when multiple deterministic operations must be selected dynamically.
6. A more autonomous agent only when planning and adaptation add measured value and every consequential action remains authorized, observable, bounded, and recoverable.

Do not use an LLM as financial truth, authorization, durable state, a database, a calculator, or a substitute for a parser/validator when a deterministic mechanism can own that responsibility.

## Machine-learning lifecycle

### Define the task

- Name the decision or user outcome, unit of prediction, allowed inputs, latency/cost budget, and action taken from the output.
- Establish a simple heuristic or existing-system baseline before training a complex model.
- Define errors by consequence, not only an aggregate score. Specify subgroup, rare-event, tail-latency and abstention behavior.
- Separate prediction quality from product value. A statistically better model may not improve the user workflow.

### Govern data

- Record provenance, license/consent, collection purpose, schema, time range, population, exclusions, transformations and retention.
- Detect label leakage, train/test contamination, duplicates, future information, selection bias, class imbalance and distribution shift.
- Split by the boundary that represents deployment—often time, user, device, organization or location—not convenient random rows.
- Version raw data references, transformation code, features, labels and evaluation sets. Protect private data and never commit it to this governance repository.
- Use synthetic data to test plumbing and privacy boundaries; do not assume it reproduces real-world quality or bias.

### Train and compare

- Record code, configuration, random seeds, environment, hardware, dataset/model hashes, checkpoints, metrics and cost.
- Compare against the baseline and ablations. Change one important variable at a time when causal understanding matters.
- Reserve a representative final test set; repeated tuning against it turns it into training data.
- Reproduce the selected result from a clean environment before promotion.
- Use independent review for consequential claims and statistical expertise when uncertainty, experimental design or inference warrants it.

### Deploy and monitor

- Identify the exact model, tokenizer/preprocessor, quantization, prompt/tool contract and runtime in every release.
- Use shadow, offline replay, canary or limited cohorts before expanding exposure.
- Monitor input validity, data freshness, drift, output quality proxies, critical-error samples, latency, memory, energy, cost and fallback rate without collecting unapproved sensitive content.
- Preserve a known-good model and define a deterministic fallback, safe degraded experience, human route, or disable path appropriate to the failure cost. Define rollback, shutdown, retraining and retirement conditions.

## Generative-AI product contract

For each capability, record:

- Model/provider/version and whether routing may change it.
- System/developer/user prompt ownership and version.
- Input sources, retrieval filters, context limits and citation/provenance behavior.
- Output schema, validators, uncertainty/abstention behavior and deterministic post-processing.
- Allowed tools, credentials, data, network destinations, mutations and approval points.
- Conversation/state persistence, export/deletion, retention and model-training use.
- Latency, quality and cost budgets plus fallback/degraded experience.
- Evaluation dataset, critical failures, red-team cases, human review and release threshold.

Treat generated text, code, queries, paths, URLs, tool arguments and retrieved instructions as untrusted inputs. Validate structure and authority at the operation boundary. Parameterize database queries, constrain files and hosts, escape rendered content, and give tools the least privilege required for the current task.

### Provider access, subscriptions, and credentials

Consumer AI subscriptions and API-platform usage are normally separate products, entitlements, data controls, quotas, and billing. Verify the current provider terms and account configuration rather than assuming a ChatGPT, Claude, Gemini, or other subscription grants programmatic API use.

- Never ship a product-owned provider API key in an iOS, Android, desktop, or web client. Put it behind an authenticated, authorized, rate-limited service boundary.
- If a product supports bring-your-own-key, explain where the key is sent and stored, use platform secure storage, minimize scope, avoid logs/backups, provide test/revoke/delete flows, and make provider charges visible.
- Record endpoint/model routing, region, storage/retention, provider training use, subprocessors, moderation, rate limits, spend ceilings, and outage/price-change behavior.
- Give every generation or tool workflow a stable operation identity, cost attribution, cancellation, retry budget, and abuse controls without logging sensitive content.
- Preserve provider portability at the product-contract boundary when it is valuable, but do not flatten away capabilities that materially improve the product. Test substitutions against the same evaluation set.

For retrieval architecture and local data/index trade-offs, use [On-Device Data, Indexing, Search, and RAG](on-device-data-indexing-search-and-rag.md). For agent-tool and MCP boundaries, use [APIs, MCP, and System Integration](apis-mcp-and-system-integration.md).

## Evaluation system

An AI feature is testable only when “good” is operationally defined.

Use a portfolio:

- Deterministic checks for schema, required facts, calculations, citations, prohibited mutations and tool-call arguments.
- Versioned scenario sets drawn from real task shapes but stripped of private data.
- Adversarial cases for injection, exfiltration, ambiguity, conflicting sources, long context, malformed tools and unavailable dependencies.
- Pairwise or rubric-based review for subjective quality, with blinded human evaluation when the decision matters.
- Differential comparison against the current production model, a smaller baseline and a non-AI workflow.
- Repeated trials and confidence intervals where nondeterminism could change the decision.
- End-to-end outcome measures such as task success, correction rate, time saved, abandonment, escalation and cost per successful task.

An automated model judge can scale triage but is another fallible measurement instrument. Calibrate it against human labels, check position/style/self-preference bias, version the judge and preserve appeal/review for consequential outcomes.

## Agent architecture

Prefer explicit workflows over unrestricted loops. A dependable agent system separates:

1. **Intent and authority:** what the user requested and what actions are actually authorized.
2. **Planner:** proposes steps and identifies unknowns; it does not silently gain permissions.
3. **Context builder:** retrieves the minimum current, relevant and permitted evidence.
4. **Skills:** versioned Markdown or code packages containing domain instructions, templates, examples and validation routines.
5. **Tools:** narrow typed operations with input validation, scoped credentials, idempotency where possible and clear read/write effects.
6. **State/checkpoints:** durable task, decision, tool-result and artifact identity so work can resume and be audited.
7. **Verifier:** tests outputs and claims independently from the producing step when consequence warrants it.
8. **Approval/commit boundary:** presents user-visible consequences before consequential external or irreversible actions.
9. **Observability and controls:** step, latency, cost, errors, retries, cancellation, budgets and kill switch without sensitive prompt logging.

### Runtime capability discovery

At the start of a material agent task, inspect the capabilities the current runtime actually exposes: repository instructions, skills, plugins/extensions, connected apps or data sources, tools/MCP servers, browser/computer control, subagents, worktrees, approvals, and deployment/review integrations. Use relevant capabilities without requiring the owner to know or name their mechanism, but never claim a capability that is unavailable or treat another provider's feature as transferable.

- Match capability to task and data sensitivity; loading everything creates cost, distraction, and broader access.
- Prefer versioned repository instructions for durable project rules, skills for repeatable specialist workflows, connected apps for scoped data/actions, and narrow tools for deterministic operations.
- Record material tool/plugin/provider assumptions and a fallback when availability, plan, administrator settings, region, or runtime can vary.
- Treat third-party plugins, instructions, retrieved content, and tool results as untrusted supply-chain inputs. Review permissions, provenance, data handling, and mutation scope.
- Recheck current official capability documentation before designing a workflow around a named AI product; product surfaces change quickly.

### Subagents and parallel work

Use subagents when tasks are genuinely independent and have bounded outputs. Give each one:

- One outcome, allowed files/resources, forbidden scope and expected artifact.
- Relevant source material instead of the entire conversation.
- Stable interfaces, risk tier, tests and completion evidence.
- Exclusive ownership of mutable files or an isolated worktree.

The coordinating agent reviews actual artifacts, reconciles conflicting evidence and runs combined verification. More agents can increase duplicated work, context cost and integration errors; parallelism is not intrinsically better.

When the current runtime permits delegation and a task has two or more genuinely independent, bounded outcomes, the coordinating agent should consider subagents proactively; the owner should not need to request them by product-specific name. Keep serial work serial when it shares one decision chain or mutable surface. For code changes, prefer isolated worktrees or exclusive file ownership, one integration owner, narrow commits, and a final combined diff/test pass before a pull request.

### Skill design

A reusable skill should state:

- Exact trigger and non-trigger conditions.
- Required inputs and authority assumptions.
- Ordered workflow, approval points and stop conditions.
- Templates/scripts/assets to reuse rather than recreate.
- Expected outputs and validation commands.
- Security/privacy considerations and common failure modes.
- Version, owner, tests and examples.

Keep durable domain knowledge in versioned artifacts and keep transient task state in the task record. Test skills with representative prompts, ambiguous prompts, missing inputs, malicious embedded instructions and tool failures.

## Prompt and context engineering

- Put stable authority, role, definitions and non-negotiable contracts in the appropriate high-priority instruction layer. Keep changing task state out of permanent global instructions.
- Give a material task a compact contract: **Outcome**, **Context**, **Constraints and authority**, **Evidence**, **Done when**, **Output**, and **Ambiguities to resolve or assumptions allowed**.
- Supply examples when format or judgment is hard to infer; include counterexamples for critical boundaries.
- Ask for explicit separation of facts, observations, interpretations, assumptions and unresolved questions.
- Use structured outputs and validators for machine-consumed results.
- Retrieve small source-backed passages rather than pasting an entire knowledge base.
- Summarize completed history into durable decisions and artifacts; do not repeatedly pay to re-read irrelevant conversation.
- Batch independent reads/searches, cache immutable context and use smaller models for classification/extraction/routing when quality evidence supports it.
- Allocate tokens to the hardest reasoning and evidence, not ceremonial restatement. Measure cost per successful outcome rather than tokens alone.
- State each important instruction once at the highest appropriate scope. Repetition can create conflicts and waste context without improving adherence.
- Expose only relevant tools and context when the runtime supports selection. More tools can increase confusion, permissions, latency, and token use.
- Prefer outcome and evidence requirements over a brittle transcript of exact implementation steps. Prescribe steps when sequence, safety, compatibility, or reproducibility actually depends on them.

Prompts cannot enforce permissions, guarantee truth, protect a shipped secret, or replace validation. Put security boundaries in code, infrastructure and tool capabilities.

### Durable guidance and adaptive tactics

Keep the system dynamic without making governance optional:

- **Durable:** owner authority, product outcomes, invariants, data boundaries, approval points, supported behavior, evidence gates, and recovery requirements.
- **Adaptive:** model, prompt wording, decomposition, tool choice, search strategy, library, optimization technique, and implementation sequence.
- **Current-source required:** model capabilities/pricing, provider data rules, API versions, platform policies, standards, vulnerabilities, library maintenance, and hardware support.

Agents may change adaptive tactics when evidence or runtime capabilities change. They must not silently change durable product truth or consequential boundaries. When a tactic repeatedly fails or a better pattern repeatedly succeeds, convert the lesson into a small regression case, template, skill, project instruction, or proposed playbook change rather than adding a vague global rule.

## Systems-thinking and continuous-learning loop

For each material task:

1. Define the user outcome, system boundary, invariants, and scarce resources.
2. Draw the causal path across UI, data, process, device, network, provider, and operational layers.
3. Identify the smallest uncertain assumption that could invalidate the plan and test it early.
4. Build a thin vertical slice through real boundaries before scaling breadth.
5. Measure correctness, usability, latency, resource use, cost, and failure recovery together.
6. Record surprising success/failure as evidence and add it to the relevant evaluation or regression set.
7. Generalize only after recurrence: task note -> repeatable test -> local project practice -> reusable skill/template -> playbook proposal -> validated release.
8. Retire obsolete guidance when current evidence shows it no longer helps.

This loop lets later products inherit verified learning without freezing one model's behavior, one framework, or one moment in the ecosystem.

## Local models, quantization, distillation and fine-tuning

Select from measured workload evidence:

- **Quantization** reduces numeric precision to lower memory/storage and often improve speed, but quality and hardware-kernel support vary by model, layer, task and quantizer.
- **Distillation** trains a smaller model from labels or behavior produced by a larger teacher; provenance, licensing, privacy and inherited errors still apply.
- **Fine-tuning/LoRA/adapters** can improve format, style or narrow task behavior but do not automatically add current facts or reliable reasoning.
- **Retrieval** updates knowledge without changing weights but introduces indexing, authorization, freshness, citation and injection risks.
- **Speculative decoding, batching, caching and optimized kernels** can improve throughput/latency without changing intended behavior, but need end-to-end verification.

Benchmark the exact artifact and runtime on representative hardware. Record model and tokenizer hashes, context length, prompt, quantization, batch, threads, accelerator/offload, memory, time to first output, generation rate, total latency, energy/thermal behavior, output quality and failure rate. A headline benchmark from different hardware or prompts is not adoption evidence.

Do not execute unreviewed remote model code. Prefer safe tensor formats and verified sources; inspect model cards, licenses, custom code, preprocessing and dependency changes. Keep model artifacts out of Git unless repository policy explicitly supports their size, license and provenance.

## Creative and unconventional AI work

- Combine deterministic solvers with models: the model proposes or explains; the solver verifies constraints and calculations.
- Use multiple diverse implementations for differential testing, not majority vote as truth.
- Generate simulations, fixtures, test cases, counterexamples and design alternatives before generating production code.
- Route difficult cases to a larger model or human while keeping common cases local and cheap.
- Train task-specific small models only after a labeled evaluation set proves the recurring task exists.
- Preserve failed experiments and surprising examples; they often define the next evaluation set.
- Treat model/provider substitution as an experiment against the product contract, not a transparent dependency update.

## Monetization and operating economics

Before selling or scaling an AI capability, measure:

- Cost per attempted and successful task, including retries, retrieval, tools, storage, moderation, human review and support.
- Quality/latency tiers, quotas, abuse resistance, provider capacity and regional availability.
- Whether generated artifacts need stable IDs, provenance, reproducibility, billing records and user deletion/export.
- Provider/model failure behavior, price-change exposure, routing portability and a degraded non-AI path.
- Claims users may reasonably rely on and how corrections, refunds, disputes or appeals work.

## References

- [NIST AI Risk Management Framework](https://www.nist.gov/itl/ai-risk-management-framework)
- [NIST Generative AI Profile](https://doi.org/10.6028/NIST.AI.600-1)
- [OWASP AI Security and Privacy Guide](https://owasp.org/www-project-ai-security-and-privacy-guide/)
- [OWASP LLM Top 10](https://genai.owasp.org/llm-top-10/)
- [Hugging Face model cards](https://huggingface.co/docs/hub/model-cards)
- [Safetensors](https://huggingface.co/docs/safetensors/)
- [ONNX Runtime performance documentation](https://onnxruntime.ai/docs/performance/)
- [MLX documentation](https://ml-explore.github.io/mlx/build/html/index.html)
- [llama.cpp](https://github.com/ggml-org/llama.cpp)
- [OpenAI: Plugins in ChatGPT and Codex](https://help.openai.com/en/articles/20001256-plugins-in-chatgpt-and-codex)
- [OpenAI: Apps in ChatGPT](https://help.openai.com/en/articles/11487775-connectors-in)
- [OpenAI: API usage is billed separately from ChatGPT](https://help.openai.com/en/articles/8156019-is-api-usage-included-in-my-chatgpt-subscription-even-if-i-have-a-paid-chatgpt-account)
- [OpenAI model selection and prompting guidance](https://developers.openai.com/api/docs/guides/latest-model)
- [Model Context Protocol architecture](https://modelcontextprotocol.io/specification/2025-06-18/architecture)
- [GitHub Copilot custom instructions support](https://docs.github.com/en/copilot/reference/custom-instructions-support)

These sources inform engineering decisions; they do not make a project compliant, safe, correct, or suitable without project-specific evidence.
