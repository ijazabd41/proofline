# Ollama implementation and comparison progress

Updated 23 October 2026. Implementation, recorded comparison, export, local activation, and final validation are complete. The tested 3B model's poor task performance and hosted provider failures are explicitly disclosed.

Subsequent configuration change, 23 October 2026: at the user's request, generation was restored to Groq (`openai/gpt-oss-20b`). The API was restarted and health/preflight returned 200, ready=true. Legacy hosted report structuring remains disabled to reduce requests. The Ollama activation and benchmark descriptions below record the state at completion, rather than the current provider. No Fireworks key was found in the project configuration; Fireworks has not been activated.

## Delivered

- Native Ollama reproduction and patch generation without hosted fallback; explicit context/output/timeout/schema controls and bounded usage/timing metadata.
- Shared structured schemas with optional wire-field normalization; original model content is preserved before compiler validation. Compiler, discovery, patch, same-test, regression, review, and proof gates remain enforced.
- Long CPU requests pair Undici's fetch and dispatcher; a real HTTP regression covers the prior incompatible-dispatcher error.
- Frozen controlled evaluation, independent trusted references, sealed cells, interruption/reconciliation, per-stage scoring, and sanitized Markdown/JSON exports. No historical held-out cohorts were rescored.
- Active local API: Ollama qwen2.5-coder:3b on 11435, timeout 600000, context 16384, output 2048, JSON/schema enabled, legacy hosted structuring disabled. Hosted credentials remain private. API health and model/browser/target preflight returned 200, ready=true.

## Recorded comparison

Corrected benchmark `comparison-v2-final` completed all 16 cells; session 16359 exited 0. Frozen manifest: `950d7b2d70e8be66caac9a8b1a63c2f86e65a723bc8d5e8532925b0ff9dc485a`.

| Measure | Local 3B | Groq GPT-OSS 20B |
| --- | --- | --- |
| Report-matched bug reproductions | 0/3 | 2/3 |
| Verified repairs | 0/3 | 2/3 |
| Infrastructure failures | 0/8 | 4/8 |
| Evaluable controls | 0/2 | 0/2 |

The local model returned all eight responses but generated invalid tests/patches. Groq's third bug and both controls failed with request_failed. The 66.7-point completion difference is operational, not a clean model-quality estimate. Neither model's control accuracy was measured. Received-response generation times: local 104.4–439.6 seconds; hosted 1.68–2.78 seconds. Costs/energy remain unknown.

Public results and interpretation: `docs/evidence/model-comparison/comparison-v2-final/`. Guide and implementation-size accounting: `docs/ollama-model-comparison.md`. Raw evidence remains under `artifacts/model-comparison/`.

## Validation

- Fresh reference gate passed all three unchanged bug fail/pass pairs and both controls.
- Current typecheck, evaluation typecheck, and both production builds passed: completion-typecheck.log, completion-evaluation-typecheck.log, completion-build.log.
- Real HTTP/provider checks: 13 passed. Schema/service checks: 19 passed. Prior complete suite: 377 tests passed before the final fetch/dispatcher pairing.
- Final default-pool attempt: 376 passed, one 5-second listing timeout; unchanged six-test route recheck passed. Live API listed 1009 records with HTTP 200 in 2428 ms.
- Default-pool confirmation: 376 passed; Windows worker exited 0xc0000409 before asyncRepairStart.test.ts ran. That unchanged one-test file then passed separately. No assertions or timeouts were changed.
- Complete unchanged suite using thread workers passed **377/377 tests across 79 files**, exit 0, in 300.25 seconds. Session **80832** is terminal; log `artifacts/model-comparison/final-thread-full-unit.log`.
- Completion integrity audit passed all 16 seals, public/private summary agreement, unchanged application/pipeline, two proof ZIP digests and all 52 payload digests: completion-integrity.json. Public files had no matches for private credential values.
- API process remains active in session 76674; project Ollama is intentionally left available. No deployment or merge.

## Completion

The requirement-by-requirement audit is `docs/evidence/model-comparison/completion-audit.md`. Post-test source/pipeline/proof/release integrity and actual API health/model preflight were rechecked. No implementation or verification work remains in the approved scope. The 3B model is not reliable for these tasks; the comparison records this result without bypassing validation, and does not claim clean hosted model quality or measured control accuracy.

## Preserved exclusions

Development smokes remain excluded. Incomplete `comparison-v1-final` retained 11 sealed/interrupt records after dispatcher failures; it is not published as a model-quality comparison. Its lock was reconciled only after confirming its exact processes had exited. The corrected benchmark has a separate manifest and fresh references.
