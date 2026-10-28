import fs from "fs";
import path from "path";
import { createHash } from "crypto";
import { extractZipArchive } from "../services/api/src/utils/zip";
import { WORKSPACE_ROOT } from "../services/api/src/utils/paths";

// Explicit allowlist: never copy raw provider data, logs, snapshots, or whole bundles.
const reportFile = path.resolve(process.argv[2] ?? "artifacts/system-testing/real-browser-verification/browser-workflow-result.json");
const report = JSON.parse(fs.readFileSync(reportFile, "utf8"));
if (!/^run-[a-zA-Z0-9-]+$/.test(report.runId)) throw new Error("Invalid run ID");
const runDir = path.join(WORKSPACE_ROOT, "artifacts/runs", report.runId);
const run = JSON.parse(fs.readFileSync(path.join(runDir, "run.json"), "utf8"));
if (report.status !== "VERIFIED" || run.state !== "VERIFIED" || run.baselineRun?.outcome !== "ASSERTION_FAILED" || run.postPatchRun?.outcome !== "PASSED") throw new Error("Source run is not verified");
if (!run.baselineRun.testFingerprint || run.baselineRun.testFingerprint !== run.postPatchRun.testFingerprint) throw new Error("Tests differ");
if (!["typecheck", "build", "unit-tests"].every(type => run.requiredChecks.some((check: any) => check.type === type && check.passed && check.exitCode === 0))) throw new Error("Missing passing gate");
const zipName = fs.readdirSync(runDir).find(name => name.endsWith(".zip"));
if (!zipName) throw new Error("Missing proof ZIP");
const zip = fs.readFileSync(path.join(runDir, zipName));
const entries = extractZipArchive(zip);
const manifest = JSON.parse(entries.get("manifest.json")!.toString("utf8"));
if (!manifest.verified || !manifest.files.length) throw new Error("Unverified manifest");
for (const entry of manifest.files) {
  const bytes = entries.get(entry.path);
  if (!bytes || createHash("sha256").update(bytes).digest("hex") !== entry.sha256) throw new Error(`Invalid ZIP entry: ${entry.path}`);
}
const out = path.join(WORKSPACE_ROOT, "docs/evidence/portfolio");
fs.mkdirSync(out, { recursive: true });
const summary = {
  schemaVersion: "1.0", sourceRunId: run.runId, sourceRecordedAt: report.timestamp,
  packagedAt: new Date().toISOString(), target: "Configured local MiniShop",
  proposalMode: "deterministic reference", approvalMode: "scripted reference approval",
  baselineOutcome: run.baselineRun.outcome, postPatchOutcome: run.postPatchRun.outcome,
  testFingerprint: run.baselineRun.testFingerprint, sameTest: true,
  baselineReportHash: run.baselineRun.reportHash, postPatchReportHash: run.postPatchRun.reportHash,
  checks: run.requiredChecks.map((check: any) => ({ type: check.type, passed: check.passed, exitCode: check.exitCode })),
  proofZipSha256: createHash("sha256").update(zip).digest("hex"), validatedPayloadFiles: manifest.files.length,
  limitation: "Configured-case reference recorded on sourceRecordedAt; scripted approval is not independent human acceptance or live-model repair. Public subset omits the raw ZIP and cannot independently reconstruct the complete run.",
};
fs.writeFileSync(path.join(out, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
fs.copyFileSync(path.join(runDir, "baseline/screenshot.png"), path.join(out, "before.png"));
fs.copyFileSync(path.join(runDir, "attempt-1/verification/screenshot.png"), path.join(out, "after.png"));
console.log(JSON.stringify(summary, null, 2));
