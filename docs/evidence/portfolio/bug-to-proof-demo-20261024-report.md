# Bug-to-Proof demo recording — 24 October 2026

Final video: `docs/evidence/portfolio/bug-to-proof-demo-20261024.mp4`
Target: 285 seconds (4:45), 1920×1080, 25 fps, H.264 MP4, captions, no audio.

This is an edited browser-and-evidence walkthrough. Real local dashboard interactions show the case register, MiniShop's $10 total with $5 shipping, and report creation. Labeled evidence panels are rendered from retained records; they are presentation views, not new dashboard status changes. Static holds allow captions and hashes to be read. Application source was not edited by the recording scripts.

## Cases

- Created demo: `case-1792837997521-j13729pf` — Cart total excludes shipping [DEMO].
- Retained accepted shipping reference: `case-1791917776888-hvza72c3`.
- Retained generation/acceptance: `8dca2a60-8416-40e4-a4e6-e7de42948cf4`.
- Retained verified deterministic repair: `run-43ebe23d-fcf4-4f26-9494-4a2cb913427b`.
- Separate fresh preflight, not shown as verified in the video: case-001 / `run-97030545-02c3-424c-8975-73ff4275611f`.

## Outcomes and deviations

- `npm run demo:check`: PASSED.
- Fresh `npm run demo:reference`: baseline ASSERTION_FAILED, post-patch PASSED, same test IDs; typecheck and build passed. MiniShop unit gate exceeded its timeout. Final state VERIFICATION_FAILED. The fresh workflow did not reach new proof-bundle creation. It is not claimed as freshly verified.
- Live generation: `5766adba-740a-4b57-a80c-fa9a2c0aea65`, BLOCKED / PROVIDER_ERROR. Connection failed before an HTTP response. No live candidate was approved and no live repair was attempted.
- Scenes 4–6 therefore use the permitted retained-reference fallback. Approval is shown as a retained review record, not a newly performed approval.
- The raw generation interaction is retained; the final edit uses a clear failure-and-reference panel to omit waiting and keep classification legible.
- Proof ZIP was opened locally, extracted, and independently checked; it was copied into recording artifacts. The dashboard download control was not used in the final edit.
- Before/after screenshot entries are extracted directly from the retained proof ZIP.
- All 24 manifest-listed file hashes matched. ZIP SHA-256: `9c1a28860080877f2c2db82f5d9d8c213e337d7d9d370e980f816b0417654c14`.
- Deterministic-proposal and configured-local-MiniShop boundaries appear in captions. No arbitrary-site autonomous repair claim is made.
- Browser recordings use fresh contexts, no unrelated tabs, no browser chrome or terminal footage. Reviewed chapter images contain no API keys, .env content, authorization headers, raw provider payloads, usernames, or absolute private paths.

## Evidence

- `artifacts/dashboard-recording/storyboard-20261024/recording-result.json`: evidence-runner capture result.
- `artifacts/dashboard-recording/storyboard-20261024/timeline.json`: raw video mapping.
- `artifacts/dashboard-recording/storyboard-20261024/raw/`: unedited source videos.
- `artifacts/dashboard-recording/storyboard-20261024/live-generation-summary.json`.
- `artifacts/dashboard-recording/storyboard-20261024/downloaded-reference-proof.zip`.
- `artifacts/dashboard-recording/storyboard-20261024/independent-validation.json`.
- `artifacts/reproduction-runs/records/8dca2a60-8416-40e4-a4e6-e7de42948cf4.json`.
- `artifacts/arbitrary-reproduction/ar6-repair-proof/reference-result.json`.
- `artifacts/runs/run-43ebe23d-fcf4-4f26-9494-4a2cb913427b/run.json`.
- `artifacts/runs/run-97030545-02c3-424c-8975-73ff4275611f/`: failed fresh preflight evidence.

## Commands executed

- `npm run demo:reference` (restricted attempt; retried with local socket access).
- `npm run demo:check`.
- `npm run dev` (two duplicate startup attempts failed because existing services owned the ports; existing services were used).
- `npx tsx artifacts/dashboard-recording/storyboard-20261024/run.ts` (initial script-format and socket failures corrected; final capture PASSED).
- `npx tsx artifacts/dashboard-recording/storyboard-20261024/supplement-run.ts` (PASSED).
- `node artifacts/dashboard-recording/storyboard-20261024/edit.mjs` (FFmpeg scene export and concatenation).
- `npx tsx artifacts/dashboard-recording/storyboard-20261024/playback-run.ts` (final playback verification; see result).
- FFprobe metadata inspection and FFmpeg full-stream decode validation.

No deployment, merge, commit, or live source-bearing external-model repair was performed.

## Export validation

FFprobe confirms 285.000 seconds, 1920×1080, H.264, 25 fps, 6,685,259 bytes. Full-stream FFmpeg decode completed with exit code 0 and no decode errors.

Chromium played the exported MP4 from beginning to end at 4× speed: ended=true; playback evidence-runner test PASSED. Playback screenshots and machine-readable verification are retained under the recording directory.

