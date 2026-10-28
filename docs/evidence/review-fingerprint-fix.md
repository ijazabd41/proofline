# Review rejection: multiple edits to one file

Verified 23 October 2026 for repair run `run-d594acad-f3f8-4238-86ad-84b64e4c52e6`.

## Root cause and change

The proposal has two edits to `src/pages/CartPage.tsx`. The patch writer applies both, but `computeExpectedPatchedFingerprint` stored one edit per normalized path in a Map, discarding earlier edits. The first approval therefore left a fully patched candidate whose fingerprint differed from the predicted value. A retry rejected that candidate as ambiguous.

The predictor now groups edits by normalized path and applies each group in proposal order, using the writer's line-ending handling. Unrelated source mutations remain outside the permitted original-or-patched invariant. No integrity checks were removed and the affected run's files were not reset or rewritten.

Read-only inspection of the actual run confirms:

- Pristine source: `5f05334359364ab89e747dda08ea11c2c1671254a426b86011946a24318cd9c4`.
- Old predicted patched source: `537e61ea9c1afa41d5be0568b7ed33249e5622cc75bc25b13fc14ce95e003aeb` (from the reported rejection).
- Corrected predicted patched source: `45de378bbc73f46f34bb2b6b333ac5361f58984ef544a9e698d547ebee950a4b`.
- Existing candidate source: `45de378bbc73f46f34bb2b6b333ac5361f58984ef544a9e698d547ebee950a4b`.

## Recorded verification

`scripts/verify-review-fingerprint.ts` creates isolated LF and CRLF fixtures, applies two approved edits to the same normalized file through the real writer, and compares the result to the prediction. It also checks that unrelated modifications still differ from both permitted fingerprints and the pristine fixture is unchanged.

The identical specification was executed through the project evidence runner before editing application code and after the fix:

| Phase | Outcome |
| --- | --- |
| Original predictor | `ASSERTION_FAILED`, both LF and CRLF |
| Corrected predictor | `PASSED`, both LF and CRLF |

Both executions have test fingerprint `9390f42c535f5985a2ff958525cc5128815a4993f63561e58c3d2b9b21df52f5`. Exact specs, JSON results, output logs, and manifests are retained under `artifacts/review-fingerprint/before/` and `after/`.

The patch-policy, lifecycle, verification-gate, and repair-graph regression suites passed **25/25 tests across four files**. API typechecking passed. Logs: `artifacts/review-fingerprint/regression.log` and `typecheck.log`.

## Separate baseline limitation

The affected run's accepted test navigates from the catalog to the cart route, then attempts to sum `product-price-1` and `shipping-fee`. Its retained failure is `<missing-or-ambiguous>`, not a numeric total mismatch. The catalog price target is not present on that destination page. This does not establish the reported shipping-total defect. Existing baseline evidence and accepted bytes were preserved; approval was not automatically replayed. Generate and review a fresh report-matched reproduction before treating a repair as verified.
