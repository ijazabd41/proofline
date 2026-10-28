# Results and practical interpretation

All 16 planned cells completed under frozen manifest `950d7b2d70e8be66caac9a8b1a63c2f86e65a723bc8d5e8532925b0ff9dc485a`. Read this interpretation alongside the immutable [generated report](report.md) and [sealed results](results.json).

| Observed outcome | Ollama / qwen2.5-coder:3b | Groq / openai/gpt-oss-20b |
| --- | --- | --- |
| Report-matched bug reproductions, including unchanged fixed-source pass | 0/3 | 2/3 |
| Verified repairs, including unchanged test, regressions, and proof digests | 0/3 | 2/3 |
| Provider/infrastructure failures | 0/8 cells | 4/8 cells |
| Evaluable correct-behavior controls | 0/2 | 0/2 |
| Generation requests, including transport retries | 8 | 16 |
| Recorded generation wall time when a model response was received | 104.4–439.6 seconds (8 responses) | 1.68–2.78 seconds (4 responses) |

The observed end-to-end completion difference is 66.7 percentage points in Groq's favor for both reproduction and repair. **This is not a clean model-quality estimate:** Groq's third bug and both controls were blocked by `request_failed` before a usable provider response. The records do not prove the underlying network cause. Those cells were retained without retrying the benchmark to improve its score.

Every local bug reproduction was invalid. Every local patch failed proposal/source-edit validation before verification. Responses included invented original snippets; the quantity proposal also supplied identical original and replacement text. The provider integration received all eight local responses and retained their usage; zero verified repairs is a result, not a claim that the integration failed. The selected 3B model is unsuitable for reliable unattended use on these tasks under this policy.

**The generated report's “0/2 control false positives” does not establish control accuracy.** Neither model produced an executable control test: local candidates were invalid, hosted requests were blocked. Control behavior remains unmeasured.

Latency is CPU-local versus hosted serving, not a model-size-only comparison. The local machine has an i7-8565U, 16 GiB RAM, and no GPU offload. Local input/output tokens total 22,306/2,230. Hosted known totals are 16,180/4,062; four cells have unknown usage. Provider tokenizers differ. Dollar cost and local energy were not measured. No cost or generalization claim follows from this small controlled cohort.

The local API is configured for Ollama on loopback port 11435; optional legacy hosted report structuring is disabled. Explicit hosted comparison credentials remain private. Health and reproduction preflight returned 200, with the installed local model, browser, and target ready. Raw model responses, source snapshots, logs, and proof archives remain local under `artifacts/model-comparison/comparison-v2-final/`; the public JSON contains the controlled fixtures, manifest, sealed cell summaries, and aggregate results.

Earlier development smokes and the incomplete `comparison-v1-final` transport run are excluded from these scores. Historical held-out cohorts were not rescored. Human acceptance is separate from the scripted approval used for benchmark repairs.
