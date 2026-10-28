# Ollama and recorded model comparison

## Required outcome

- Native Ollama generation for both report-to-test and patch proposals, without hosted fallback.
- Explicit context, output, timeout, and JSON-generation controls; retain numeric token/timing metadata without secrets or raw response bodies in summaries.
- A reproducible paired comparison with the configured hosted model, using a new frozen controlled benchmark. Historical consumed held-out sets remain unchanged; this comparison is not a new generalization claim.
- Score reproduction separately from repair. Repair uses identical trusted reference tests for every model, including models that failed generation.
- Verify reference failures and controls with the evidence runner before provider evaluation. Verify generated tests on defective and fixed variants. Record invalid candidates, mismatches, infrastructure failures, and same-test repair/regression/proof results.
- Frozen manifest binds source, prompts, model settings, test hashes, and case inputs. Completed cells cannot be overwritten; interrupted cells remain explicit and resume does not silently repeat requests.
- Sanitized Markdown/JSON comparison reports, setup instructions, configuration example, and a working local configuration.
- Unit/integration checks, full typecheck/build/test gates, and live local plus hosted execution. No deployment, merge, or rewriting old evaluations.

## Scope and validation

Preserve existing user edits and saved runs. Use isolated MiniShop workspaces. Provider failures are results, not product failures; an all-blocked evaluation is not evidence that provider integration works. Human review and scripted benchmark approval are distinct. A test failing on fixed source cannot count as a report match.

Run a small development smoke first, then freeze the paired benchmark and execute each model once per declared cell. Keep retrieval fixed as lexical so generation is the variable. Record hardware, model identity/digest, cold/warm timing, attempts, and unknown costs explicitly. No model-quality claim until evidence supports it.
