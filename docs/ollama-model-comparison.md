# Local generation and model comparison

Ollama can generate reproduction candidates and repair proposals. `RAG_GENERATION_*` selects the shared generation provider despite its historical name. Embedding configuration is independent. An Ollama error does not trigger hosted fallback.

The [recorded comparison and interpretation](evidence/model-comparison/comparison-v2-final/interpretation.md) are available. The tested 3B local model produced no valid bug reproductions or verified patches; Groq completed two of three of each, with four later provider failures. Neither model yielded evaluable controls. Treat these as bounded operational results, not a general model ranking.

## Windows setup

Use Node.js 22.19 or newer (the recorded run used 24.15.0). Install Ollama, then run `./scripts/start-local-ollama.ps1` in a terminal. This starts a loopback server on port 11435 and stores models under the Git-ignored `artifacts/ollama-models` directory. It leaves the default Ollama instance on 11434 alone.

In another PowerShell terminal:

```powershell
$env:OLLAMA_HOST = '127.0.0.1:11435'
ollama pull qwen2.5-coder:3b
```

Configure `.env`:

```dotenv
RAG_GENERATION_PROVIDER=ollama
RAG_GENERATION_MODEL=qwen2.5-coder:3b
RAG_GENERATION_BASE_URL=http://127.0.0.1:11435
RAG_GENERATION_CONTEXT_TOKENS=16384
RAG_GENERATION_MAX_OUTPUT_TOKENS=2048
RAG_GENERATION_JSON_MODE=true
RAG_GENERATION_STRUCTURED_OUTPUTS=true
RAG_TIMEOUT_MS=600000
LLM_ENABLED=false
```

Restart the API. The longer bounded timeout accommodates CPU inference; it is a maximum, not an expected response time. The selected model must fit available memory. JSON mode aids formatting but does not establish test relevance or patch correctness. Existing schema, source-integrity, approval, regression, and proof checks still apply.

`LLM_ENABLED=false` disables the optional legacy hosted report-structuring call. It does not disable explicitly configured Ollama reproduction or patch generation. The dashboard already collects structured report fields directly. Keep hosted credentials in `.env` if you want to run the explicitly authorized comparison; they are not used as a fallback for local generation.

## Paired controlled evaluation

The v1 comparison contains three bug variants and two correct-behavior controls. It is a small controlled comparison, **not a new held-out generalization benchmark**. Historical AR7/v2/v3/v5 scores and consumption ledgers are unchanged.

The hosted profile reads `LLM_API_URL`, `LLM_MODEL`, and `LLM_API_KEY`; the local profile reads `COMPARISON_OLLAMA_URL` and `COMPARISON_OLLAMA_MODEL`. Keep credentials in `.env`. Do not put keys in endpoint URLs. Results do not include keys or raw response bodies.

Use a unique ID and run these steps in order:

```sh
npm run model:compare -- --id comparison-v1 --references
npm run model:compare -- --id comparison-v1 --freeze
npm run model:compare -- --id comparison-v1 --run --confirm-live --confirm-external-source
npm run model:compare -- --id comparison-v1
npm run model:compare -- --id comparison-v1 --publish
```

The reference phase uses real isolated MiniShop instances and the evidence runner: each bug's trusted test must fail before and pass after restoring fixed source; controls must pass. Freeze binds source fingerprints, test and fixture hashes, generation code, model settings, and the local model digest. Hosted model identity is a provider identifier rather than immutable weights.

Before freezing, `--id <unique-development-id> --smoke-local` exercises both native Ollama stages on one development case. `--smoke-hosted --confirm-external-source` does the same for the hosted profile. These development outputs are stored separately and excluded from comparison scores. Never treat a smoke run as a multi-case evaluation.

Each model gets one candidate-generation attempt per case, with the same output/timeout budgets and up to three transport retries. The first model alternates by fixture. Reproduction and repair are scored independently: every bug receives a repair attempt using the same trusted reference test, even if that model failed reproduction generation. Model prompts do not receive the gold patch or fixture definitions.

The same explicit output schema is supplied to Ollama and the supported Groq GPT-OSS endpoint. Other OpenAI-compatible models may not support strict JSON-schema output; leave `RAG_GENERATION_STRUCTURED_OUTPUTS=false` for those models rather than assuming support. Enforcing a JSON shape does not replace validation of bounds, target discovery, report relevance, or patch correctness.

Generated reproduction candidates are checked on the defective variant and unchanged on fixed source. A conservative scripted rubric requires the report-specific target and expected value. Semantically equivalent tests outside that rubric may be undercounted. This is not independent human review. Control false positives, invalid tests, execution errors, provider failures, and timeouts stay in the records.

Repair uses live model proposals and **scripted benchmark approval**, not human acceptance. A verified repair must pass the unchanged reference test, mandatory regressions, and independently extracted proof-bundle digest validation.

## Evidence and limitations

Outputs live under `artifacts/model-comparison/<id>/`: frozen manifest, per-cell sealed summaries, exact runner reports/specs, provider measurements, repair run references, proof ZIPs, Markdown report, and JSON scorecard. Token and timing fields are recorded only when supplied and valid. Dollar cost and local energy consumption remain unknown. Latency reflects hardware, serving implementation, and cold loading as well as model choice.

`--publish` requires a complete, integrity-checked comparison and creates a new public Markdown/JSON release under `docs/evidence/model-comparison/<id>/`. It exports the controlled fixture manifest and sealed numeric cell summaries, not raw model responses, prompts, logs, source snapshots, or proof archives. Publication refuses to overwrite an existing release. The public subset does not independently reconstruct every browser run; raw evidence remains local.

Completed cells are skipped on resume and cannot be silently overwritten. A cell left `RUNNING` after an interruption must be investigated before further provider requests; never simply delete it to obtain a better result. A manifest mismatch or changed source stops execution. Do not rerun old consumed held-out cohorts as if they were fresh.

If the evaluation process has actually exited, `--reconcile` preserves its old lock and seals unfinished cells as `INTERRUPTED` with unknown provider outcomes. It refuses to operate while the recorded process is alive. Interrupted cells are not retried and the comparison remains incomplete. Use `--model local` or `--model hosted` with `--run` to finish the other profile without overwriting prior cells.

Both models use the same 120-second regression-check timeout in the benchmark. The API also allows longer bounded run preparation for local inference. Changes to the generation pipeline or evidence checks after freezing stop further cells; create a separately named benchmark rather than mixing versions.

No numerical model-quality difference is claimed until both profiles have completed the frozen comparison. A transport-blocked run is not proof that a model can generate valid tests or verified patches.

## Implementation effort

The completed provider/control/telemetry changes currently touch 13 runtime TypeScript files: 171 added lines (including the new 54-line shared output-schema module) and 29 removed lines relative to the starting checkout. This excludes tests, dependency/configuration files, documentation, and the separate review-fingerprint fix. Switching an already supported model afterward is a configuration change; runtime changes were needed to make CPU timeouts, structured output, token accounting, and failure classification reliable.

The recorded evaluation is the larger addition: 423 lines across the comparison CLI and scoring/integrity module, plus controlled fixtures, browser references, and regression tests. These counts describe implementation size, not elapsed engineering hours. Live download/inference time depends heavily on the connection and hardware. This machine uses CPU inference; the small local model's rejected outputs remain evidence rather than being repaired manually or counted as successful generations.
