# Repair status feedback and missing-target classification

23 October 2026. The supplied repair run applied attempt 1, failed verification, restored the candidate, and generated another proposal awaiting approval. The case record did not establish a verified repair. The accepted reproduction navigates to `/cart` but its sum assertion references `product-price-1`, a ProductCard target on the shop page.

There were two problems: retry progress was mostly hidden in technical logs, and missing targets in generated assertions were counted as behavioral failures. Neither a missing target nor an HTTP 200 review response establishes a fixed bug.

## Changes

- Visible repair progress summary, attempt history, rollback explanation, fresh-approval notice, and submission feedback. The panel polls during approval to expose actual progress.
- Missing-target failures receive plain-language feedback and a correction step. Approval is disabled for these known invalid tests; paused runs can be cancelled. Repeated technical diagnostics are deduplicated and collapsed.
- The evidence classifier rejects generated missing/ambiguous-target assertions as `SELECTOR_OR_ACTION_ERROR`, rather than `ASSERTION_FAILED`. Genuine numeric relational mismatches still count as behavior assertions. Existing accepted tests, saved case evidence, and model proposals were not rewritten or approved.

## Recorded evidence

- Original focused tests: two failures, 17 passes (`artifacts/status-feedback/baseline-tests.log`).
- Exact accepted test fingerprint before and after: `1631dadd11a4c2f963af9d03643cc907eb9d0b978ae4d22dc365e4ee5561984b`.
- Original isolated evidence-runner result: `ASSERTION_FAILED` with `<missing-or-ambiguous>`. Corrected result for the unchanged test: `INFRASTRUCTURE_ERROR`, `SELECTOR_OR_ACTION_ERROR`. See `original-isolated.json` and `corrected-classification.json` in `artifacts/status-feedback/`. An earlier loopback-address reachability failure is retained separately and was not treated as reproduction evidence.
- Focused classifier/integrity/repair-graph/UI regression checks: 29 passed across four files. Final layout UI checks: six passed. Monorepo typechecks and dashboard production build passed.
- Browser visual check rendered the supplied saved records and confirmed visible feedback and disabled invalid-test approval. It sent no approval or model request. Screenshot: `artifacts/status-feedback/repair-progress.png`.
- API restarted with the corrected classifier. Existing dashboard and MiniShop servers respond on `localhost:5173` and `localhost:5174`; API health returns 200. Groq configuration is retained.

The current saved reproduction still needs correction/regeneration and review. This change improves classification and communication; it does not claim that the shipping bug or the invalid accepted test has been repaired.

## Follow-up: reviewable replacement

The separate `/cart` route also lacks the shipping line. The report describes the shop page, whose cart sidebar displays shipping. A corrected candidate therefore stays on the shop page after adding one Keyboard and compares the visible cart line amount plus shipping against its total. An added `cart-item-total-${productId}` test target labels the existing line amount without changing calculation behavior.

Candidate `6d555144-b4f3-4bc8-8b9a-05af732486a9` is explicitly marked `provider: manual`, `model: cart-target-correction`, zero provider requests. It is saved in the standard reproduction run store and remains `AWAITING_TEST_REVIEW`. On the persistent demo URL its recorded failure was Expected 15 / Received 10. The identical test passed after the minimal Cart total fix in an isolated workspace; main application calculation was not patched. Details: `artifacts/status-feedback/cart-target-correction.json`. Temporary preparation attempts, including the still-invalid cart-route attempt, remain recorded rather than being relabelled as successful evidence.

The dashboard now exposes replacement generation and test review even when a prior test is configured, and no longer calls the legacy missing-target result a reproduced bug. Stopped runs tell users to replace the test rather than cancel an already stopped run. Live browser checking confirmed that the replacement and **Approve & Confirm Baseline** action are visible; no approval was submitted. Thirty-two focused tests passed across five files, plus typechecks and the dashboard production build. The configured-test workflow remains available, while incomplete reports remain blocked.
