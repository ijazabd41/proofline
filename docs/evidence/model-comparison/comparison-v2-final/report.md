# Controlled model comparison

Manifest: 950d7b2d70e8be66caac9a8b1a63c2f86e65a723bc8d5e8532925b0ff9dc485a

Execution complete: true. Cells: 16/16.

| Model | Matched reproductions | Control false positives | Verified repairs | Generation p95 | Unknown usage cells |
| --- | --- | --- | --- | --- | --- |
| local | 0/3 | 0/2 | 0/3 | 439591 ms | 0 |
| hosted | 2/3 | 0/2 | 2/3 | 2780 ms | 4 |

| Model | Input tokens | Output tokens | Known requests | Reproduction generation p95 | Repair generation p95 |
| --- | --- | --- | --- | --- | --- |
| local | 22306 | 2230 | 8 | 195089 ms (n=5) | 439591 ms (n=3) |
| hosted | 16180 | 4062 | 16 | 2780 ms (n=5) | 1769 ms (n=3) |

- Small controlled comparison, not a fresh held-out generalization claim.
- Report matching uses a conservative scripted rubric, not human acceptance.
- Repair approval is scripted for the benchmark; proposals and execution are live.
- Token counts are provider-specific; cost and local energy consumption are unknown.
- Cold model load timing is retained when supplied; wall latency includes runtime differences.

Raw evidence remains local. These results do not rescore historical held-out evaluations.

## Profiles and budgets

- local: ollama / qwen2.5-coder:3b / digest f72c60cabf6237b07f6e632b2c48d533cef25eda2efbd34bed21c5e9c01e6225
- hosted: openai / openai/gpt-oss-20b / provider weights are not immutable
- CPU: Intel(R) Core(TM) i7-8565U CPU @ 1.80GHz; 8 logical processors; 16 GiB RAM.
- Per-request timeout: 600000 ms; output cap: 2048 tokens; local context: 16384 tokens; regression check timeout: 120000 ms.

## Per-cell outcomes

| Model | Case | Stage | Outcome | Report match | Verified repair | Infrastructure failure |
| --- | --- | --- | --- | --- | --- | --- |
| hosted | cmp-control-usb-name | reproduction | BLOCKED | n/a | n/a | true |
| hosted | cmp-control-webcam-price | reproduction | BLOCKED | n/a | n/a | true |
| hosted | cmp-usb-price | repair | VERIFIED | n/a | true | false |
| hosted | cmp-usb-price | reproduction | AWAITING_TEST_REVIEW | true | n/a | false |
| hosted | cmp-webcam-name | repair | BLOCKED | n/a | n/a | true |
| hosted | cmp-webcam-name | reproduction | BLOCKED | n/a | n/a | true |
| hosted | cmp-webcam-quantity | repair | VERIFIED | n/a | true | false |
| hosted | cmp-webcam-quantity | reproduction | AWAITING_TEST_REVIEW | true | n/a | false |
| local | cmp-control-usb-name | reproduction | CANDIDATE_INVALID | n/a | n/a | false |
| local | cmp-control-webcam-price | reproduction | CANDIDATE_INVALID | n/a | n/a | false |
| local | cmp-usb-price | repair | BLOCKED | n/a | n/a | false |
| local | cmp-usb-price | reproduction | CANDIDATE_INVALID | n/a | n/a | false |
| local | cmp-webcam-name | repair | BLOCKED | n/a | n/a | false |
| local | cmp-webcam-name | reproduction | CANDIDATE_INVALID | n/a | n/a | false |
| local | cmp-webcam-quantity | repair | BLOCKED | n/a | n/a | false |
| local | cmp-webcam-quantity | reproduction | CANDIDATE_INVALID | n/a | n/a | false |

Local minus hosted: reproduction -66.66666666666666 percentage points; repair -66.66666666666666 percentage points.
