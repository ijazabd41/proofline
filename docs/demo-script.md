# Bug-to-Proof reference demo

Bug-to-Proof is the engineering project; **Proofline** is its dashboard. This configured-case demo uses a predefined Playwright test and a deterministic repair proposal. Browser execution, regression checks, and ZIP extraction are real. The script submits approval automatically for demonstration; this is not independent human review or live-model repair.

## Run locally

Install Node.js 22+, run `npm install`, and install Chromium with `npx playwright install chromium`. From the repository root:

```sh
npm run demo:reference
```

No provider key or running dashboard is needed. The runner creates an isolated MiniShop workspace, seeds the first-item-only total defect there, starts its own local server, and executes the case-001 test before proposing a patch. It leaves the main MiniShop source unchanged.

Success requires `ASSERTION_FAILED` before the patch, `PASSED` afterward, identical test fingerprints, passing typecheck/build/unit checks, and independently validated bundle entries. An environment error is not a reproduced bug.

The result is saved in `artifacts/system-testing/real-browser-verification/browser-workflow-result.json`; the run directory contains screenshots, traces, logs, and the proof ZIP. Raw files remain Git-ignored.

## Recording sequence (about one minute)

1. **Problem:** Adding a $10 Keyboard and $20 Mouse Pad should show $30. The seeded defect shows $10. Show the captured baseline screenshot.
2. **Patch review:** Show the one-line reduction over price times quantity. Explain that the proposal is deterministic and approval is scripted.
3. **Verification:** Show the post-patch screenshot and identical test identity. The same test now passes.
4. **Evidence:** Show the actual regression results and ZIP digest validation. The output can be inspected outside the dashboard.
5. **Boundary:** This proves the configured MiniShop reference workflow. Separate live generation evaluation achieved 10/12 reviewed report matches; live-model repair remains unverified.

The shareable video is an edited walkthrough of recorded browser evidence, not continuous screen capture. See [the evidence example](evidence/portfolio-reference.md) for its exact source run and date.

## Hosted verification

CI runs on pushes and pull requests to master or main; a manual trigger is included in the local workflow changes. It checks Windows and Ubuntu. Publish reviewed changes with a writable GitHub account before using the manual trigger. A local pass is not a hosted CI pass.
