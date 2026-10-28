# Dashboard repair status synchronization

The case workflow and comparison previously read only the saved case record. Dynamic repairs persist separately, so a verified candidate left the stepper on Reproduce and the comparison on Not run yet.

The assistant now publishes its restored and polled repair run to the surrounding case view. The workflow, progress summary, and before/after results use that same run, scoped to the displayed case. Recorded results render even when there are no screenshot attachments. Candidate verification is explicitly labeled as verification in the isolated workspace; the saved case status is labeled separately. No main application patch or case-status mutation is implied.

Long regression commands are expandable and wrap within their cards.

Validation:

- Before changes, the workflow regression test failed for awaiting review, applying, and verified states (3 failures, 1 pass).
- After changes, 29 focused dashboard tests passed across workflow, case detail, assistant, and comparison.
- Dashboard production build passed.
- The evidence runner checked the real saved run `run-4a02153f-279b-4852-8050-279c5b216577`, including reload, displayed pass, and verification-card containment at 1440px and 390px: PASSED.
- Recorded browser report: `artifacts/dashboard-repair-status-1792771115621/result.json`; runner manifest: `artifacts/dashboard-repair-status-1792771115621/verification.json`.

The first browser attempt timed out after five seconds while loading the saved run. It is retained in `artifacts/dashboard-repair-status`; the successful repeat allows thirty seconds for restoration and uses a separate artifact directory. No API responses or repair statuses were mocked in that browser check.
