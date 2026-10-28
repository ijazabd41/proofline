import fs from "node:fs";
import { runTest } from "../services/api/src/runner/playwrightRunner";

async function main() {
const dir = `artifacts/dashboard-repair-status-${Date.now()}`;
const result = await runTest("dashboard-repair-status", "tests/playwright/cases/dashboard-repair-status.spec.ts", "after", {
  targetUrl: "http://localhost:5173", artifactDir: `${process.cwd()}/${dir}`, timeoutMs: 120000,
});
fs.writeFileSync(`${dir}/verification.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify({ passed: result.passed, outcome: result.outcome, actual: result.actual, artifacts: result.artifactPaths }));
if (!result.passed) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; });
