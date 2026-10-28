import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { randomUUID, createHash } from "node:crypto";
import { config } from "dotenv";
import { comparisonFixtures, type ComparisonFixture } from "../data/evals/model-comparison-fixtures";
import { hash, pairedSummary, publicComparison, validateManifest, matchesReport, sealCell, type ComparisonManifest, type ComparisonCell, type ModelProfile } from "./model-comparison-core";
import { WORKSPACE_ROOT as root } from "../services/api/src/utils/paths";
import { createRunWorkspace, releaseWorkspaceLock, startIsolatedMiniShop, stopIsolatedMiniShop, restoreOriginalWorkspace, computeSourceManifest } from "../services/api/src/ai/repair/workspace";
import { runTest, testFingerprint } from "../services/api/src/runner/playwrightRunner";
import { discoverTargetSurface } from "../services/api/src/reproduction/targetDiscovery";
import { generateReproductionCandidate } from "../services/api/src/reproduction/generationProvider";
import { ReproductionService } from "../services/api/src/reproduction/reproductionService";
import { ReproductionRunStore } from "../services/api/src/reproduction/reproductionRunStore";
import { COMPILER_VERSION } from "../services/api/src/reproduction/definitionCompiler";
import { writeCase } from "../services/api/src/storage/caseStore";
import { createAndStartRepairRun, reviewAndApplyRepairRun } from "../services/api/src/ai/repair/repairService";
import { generateProposal } from "../services/api/src/ai/repair/proposal";
import { buildProofBundle } from "../services/api/src/ai/repair/proofBundle";
import { extractZipArchive } from "../services/api/src/utils/zip";
import type { BugCase } from "@bug-to-proof/shared-types";

config({ path: path.join(root, ".env"), quiet: true });
const args = process.argv.slice(2);
const arg = (name: string) => args[args.indexOf(name) + 1];
const id = args.includes("--id") ? arg("--id") : "comparison-v1";
if (!/^[a-zA-Z0-9-]{1,48}$/.test(id)) throw new Error("Invalid comparison ID");
const out = path.join(root, "artifacts/model-comparison", id);
const referenceTest = "tests/playwright/cases/model-comparison-reference.spec.ts";
const json = (file: string) => JSON.parse(fs.readFileSync(file, "utf8"));
const save = (file: string, value: unknown, exclusive = false) => {
  const bytes = JSON.stringify(value, null, 2) + "\n";
  if (exclusive) { fs.writeFileSync(file, bytes, { flag: "wx" }); return; }
  const temporary = `${file}.${process.pid}.tmp`;
  try { fs.writeFileSync(temporary, bytes, { flag: "wx" }); fs.renameSync(temporary, file); }
  finally { if (fs.existsSync(temporary)) fs.unlinkSync(temporary); }
};
const sourceFingerprint = () => computeSourceManifest(path.join(root, "apps/minishop")).fingerprint;
const promptHash = () => hash(["services/api/src/reproduction/generationProvider.ts", "services/api/src/ai/repair/proposal.ts", "services/api/src/llm/client.ts", "services/api/src/ai/providers.ts"].map(file => fs.readFileSync(path.join(root, file), "utf8").replace(/\r\n/g, "\n")));
const pipelineHash = () => {
  const files = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? files(path.join(directory, entry.name)) : entry.name.endsWith(".ts") && !entry.name.endsWith(".test.ts") ? [path.join(directory, entry.name)] : []);
  return hash([...files(path.join(root, "services/api/src")), path.join(root, "scripts/compare-models.ts"), path.join(root, "scripts/model-comparison-core.ts")].sort().map(file => [path.relative(root, file), fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n")]));
};
const sha = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");
function seed(dir: string, fixture: ComparisonFixture) {
  for (const defect of fixture.defects) {
    const file = path.join(dir, defect.relativePath);
    const text = fs.readFileSync(file, "utf8").replace(/\r\n/g, "\n");
    if (text.split(defect.fixedContent).length !== 2) throw new Error(`Reference source changed: ${defect.relativePath}`);
    fs.writeFileSync(file, text.replace(defect.fixedContent, defect.buggyContent));
  }
}
async function withVariant<T>(fixture: ComparisonFixture, action: (ws: ReturnType<typeof createRunWorkspace>, url: string) => Promise<T>) {
  const ws = createRunWorkspace(`mc-${randomUUID()}`);
  let app: Awaited<ReturnType<typeof startIsolatedMiniShop>> | undefined;
  try { seed(ws.minishopDir, fixture); app = await startIsolatedMiniShop(ws); return await action(ws, app.url); }
  finally { if (app) await stopIsolatedMiniShop(ws); releaseWorkspaceLock(ws); }
}
async function localIdentity(profile: ModelProfile) {
  const response = await fetch(`${profile.endpoint}/api/tags`, { signal: AbortSignal.timeout(10000) });
  if (!response.ok) throw new Error("Ollama inventory unavailable");
  const data = await response.json() as { models: Array<{ name: string; digest: string }> };
  const model = data.models.find(item => item.name === profile.model);
  if (!model) throw new Error("Local coding model is not installed");
  return model.digest;
}
async function references() {
  const directory = path.join(out, "references");
  fs.mkdirSync(directory, { recursive: false });
  const before = sourceFingerprint(); const results: any[] = [];
  for (const fixture of comparisonFixtures) {
    process.env.BTP_COMPARISON_CASE = fixture.id;
    console.log(`Reference ${fixture.id}`);
    const result = await withVariant(fixture, async (ws, url) => {
      const base = await runTest(fixture.id, referenceTest, "before", { targetUrl: url, artifactDir: path.join(directory, fixture.id, "before") });
      let fixed: Awaited<ReturnType<typeof runTest>> | undefined;
      if (fixture.label === "bug") {
        restoreOriginalWorkspace(ws);
        fixed = await runTest(fixture.id, referenceTest, "after", { targetUrl: url, artifactDir: path.join(directory, fixture.id, "after") });
      }
      return { caseId: fixture.id, baseline: base.outcome, fixed: fixed?.outcome, sameTest: !fixed || fixed.testFingerprint === base.testFingerprint,
        passed: base.outcome === (fixture.label === "bug" ? "ASSERTION_FAILED" : "PASSED") && (!fixed || fixed.outcome === "PASSED") };
    });
    results.push(result);
    save(path.join(directory, "progress.json"), results);
  }
  if (sourceFingerprint() !== before || results.some(item => !item.passed || !item.sameTest)) throw new Error("Reference verification failed; inspect retained evidence");
  save(path.join(out, "references.json"), { sourceFingerprint: before, referenceTestHash: testFingerprint(referenceTest), fixturesHash: hash(comparisonFixtures), results }, true);
}
async function freeze() {
  const reference = json(path.join(out, "references.json"));
  if (reference.sourceFingerprint !== sourceFingerprint() || reference.referenceTestHash !== testFingerprint(referenceTest) || reference.fixturesHash !== hash(comparisonFixtures)) throw new Error("References are stale");
  const local: ModelProfile = { id: "local", provider: "ollama", model: process.env.COMPARISON_OLLAMA_MODEL || "qwen2.5-coder:3b", endpoint: process.env.COMPARISON_OLLAMA_URL || "http://127.0.0.1:11435" };
  local.digest = await localIdentity(local);
  const hosted: ModelProfile = { id: "hosted", provider: "openai", model: process.env.LLM_MODEL || "", endpoint: (process.env.LLM_API_URL || "").replace(/\/$/, "") };
  if (!hosted.model || !process.env.LLM_API_KEY) throw new Error("Hosted comparison configuration is missing");
  const payload: Omit<ComparisonManifest, "manifestHash"> = { schemaVersion: "1.0", id, createdAt: new Date().toISOString(), purpose: "Paired controlled MiniShop model comparison; not held-out generalization",
    sourceFingerprint: sourceFingerprint(), referenceTestHash: testFingerprint(referenceTest), fixturesHash: hash(comparisonFixtures), referencesHash: hash(reference),
    promptHash: promptHash(), compilerVersion: COMPILER_VERSION, models: [local, hosted], fixtures: comparisonFixtures,
    pipelineHash: pipelineHash(), hardware: { cpu: os.cpus()[0]?.model ?? "unknown", logicalCpus: os.cpus().length, memoryBytes: os.totalmem(), platform: `${os.platform()} ${os.arch()}`, node: process.version },
    policy: { timeoutMs: 600000, contextTokens: 16384, maxOutputTokens: 2048, candidateAttempts: 1, transportAttempts: 3, jsonMode: true, structuredOutputs: true, regressionTimeoutMs: 120000, order: "fixture order; alternate local/hosted first by index; reproduction then independent repair" } };
  const manifest = { ...payload, manifestHash: hash(payload) };
  validateManifest(manifest);
  save(path.join(out, "manifest.json"), manifest, true);
  console.log(`Frozen ${manifest.manifestHash}`);
}
function configure(profile: ModelProfile, manifest: Pick<ComparisonManifest, "policy">) {
  process.env.RAG_GENERATION_PROVIDER = profile.provider;
  process.env.RAG_GENERATION_MODEL = profile.model;
  process.env.RAG_GENERATION_BASE_URL = profile.endpoint;
  process.env.RAG_GENERATION_API_KEY = profile.provider === "openai" ? process.env.LLM_API_KEY || "" : "";
  process.env.RAG_EMBEDDING_PROVIDER = "lexical";
  process.env.RAG_TIMEOUT_MS = String(manifest.policy.timeoutMs);
  process.env.RAG_GENERATION_CONTEXT_TOKENS = String(manifest.policy.contextTokens);
  process.env.RAG_GENERATION_MAX_OUTPUT_TOKENS = String(manifest.policy.maxOutputTokens);
  process.env.RAG_GENERATION_JSON_MODE = String(manifest.policy.jsonMode);
  process.env.RAG_GENERATION_STRUCTURED_OUTPUTS = String(manifest.policy.structuredOutputs);
}
async function reproduce(fixture: ComparisonFixture, cell: ComparisonCell, dir: string) {
  await withVariant(fixture, async (ws, url) => {
    let baseline: Awaited<ReturnType<typeof runTest>> | undefined;
    const generatedRoot = path.join(dir, "generated");
    const store = new ReproductionRunStore(path.join(dir, "records"));
    const service = new ReproductionService({ store, generatedRoot,
      discover: async () => discoverTargetSurface(ws.minishopDir),
      generate: async (context, signal) => {
        const started = Date.now();
        try {
          const generated = await generateReproductionCandidate(context, signal);
          cell.inputTokens = generated.usage?.inputTokens; cell.outputTokens = generated.usage?.outputTokens;
          cell.modelRequests = generated.requestAttempts; cell.providerTimings = generated.timings;
          return generated;
        } catch (error: any) { if (Number.isInteger(error.requestAttempts)) cell.modelRequests = error.requestAttempts; throw error; }
        finally { cell.generationMs = Date.now() - started; }
      },
      execute: async input => {
        baseline = await runTest(input.caseId, input.testFile, "before", { targetUrl: url, generatedTestRoot: generatedRoot, artifactDir: path.join(dir, "baseline", input.runId) });
        return baseline;
      },
      fingerprintSource: () => computeSourceManifest(ws.minishopDir).fingerprint,
    });
    const run = await service.run({ reproductionRunId: randomUUID(), caseId: fixture.id, report: fixture.report, targetUrl: url, limits: { maxAttempts: 1 } });
    cell.runId = run.reproductionRunId; cell.outcome = run.state;
    const attempt = run.attempts[run.attempts.length - 1];
    cell.validCandidate = !!attempt?.compiledTestHash;
    cell.executable = attempt?.classification === "ASSERTION_FAILED" || attempt?.classification === "BASELINE_PASSED";
    cell.assertionFailed = attempt?.classification === "ASSERTION_FAILED";
    cell.falsePositive = fixture.label === "control" && !!cell.assertionFailed;
    cell.failureCode = attempt?.failureKind ?? (attempt?.classification === "PROVIDER_ERROR" ? attempt.responseShape : undefined);
    cell.infrastructureFailure = run.state === "BLOCKED" || ["TARGET_UNREACHABLE", "BROWSER_UNAVAILABLE", "INPUTS_CHANGED", "CANCELLED"].includes(attempt?.failureKind ?? "");
    if (cell.executable && attempt?.compiledTestHash) {
      const compiled = path.join(generatedRoot, `${attempt.attemptExecutionId}.spec.ts`);
      // Obtain the exact persisted spec from the compiler's run directory.
      const findSpec = (directory: string): string[] => fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? findSpec(path.join(directory, entry.name)) : entry.name.endsWith(".spec.ts") ? [path.join(directory, entry.name)] : []);
      const files = findSpec(generatedRoot);
      const testFile = fs.existsSync(compiled) ? compiled : files.find(file => file.includes(attempt.attemptExecutionId));
      if (!testFile) throw new Error("Compiled candidate spec not found");
      restoreOriginalWorkspace(ws);
      const fixed = await runTest(fixture.id, testFile, "after", { targetUrl: url, generatedTestRoot: generatedRoot, artifactDir: path.join(dir, "fixed") });
      cell.fixedPassed = fixed.outcome === "PASSED";
      cell.sameTest = !!baseline?.testFingerprint && baseline.testFingerprint === fixed.testFingerprint && JSON.stringify(baseline.testIds) === JSON.stringify(fixed.testIds);
      cell.reportMatched = fixture.label === "bug" && !!cell.assertionFailed && cell.fixedPassed && cell.sameTest && matchesReport(attempt.definition, fixture);
    }
    save(path.join(dir, "run.json"), run);
  });
}
async function repair(fixture: ComparisonFixture, cell: ComparisonCell, dir: string) {
  const caseId = `case-2026-${hash(cell.id + id).slice(0, 18)}`;
  const now = new Date().toISOString();
  writeCase({ id: caseId, title: fixture.report.title, description: fixture.report.description,
    status: "READY_TO_REPRODUCE", createdAt: now, updatedAt: now,
    reproduction: { preconditions: [], steps: [...fixture.report.steps!], expected: fixture.report.expected!, actual: fixture.report.actual!, testFile: referenceTest, lastRun: null },
    patch: null, verification: null, evidence: [], rootCauseExplanation: null,
  } as BugCase);
  process.env.BTP_COMPARISON_CASE = fixture.id;
  const started = await createAndStartRepairRun(caseId, { mode: "dynamic", maxAttempts: 1, timeoutMs: 900000, regressionTimeoutMs: 120000,
    seedDefects: fixture.defects.map(defect => ({ relativePath: defect.relativePath, originalSnippet: defect.fixedContent, defectiveSnippet: defect.buggyContent })) }, {
    generate: async input => {
      const start = Date.now();
      try {
        const proposal = await generateProposal({ ...input, onRawResponse: text => fs.writeFileSync(path.join(dir, "model-output.txt"), text), onGeneration: metadata => {
          cell.inputTokens = metadata.usage?.inputTokens; cell.outputTokens = metadata.usage?.outputTokens;
          cell.modelRequests = metadata.requestAttempts; cell.providerTimings = metadata.timings;
        } });
        cell.inputTokens = proposal.generation?.usage?.inputTokens; cell.outputTokens = proposal.generation?.usage?.outputTokens;
        cell.modelRequests = proposal.generation?.requestAttempts; cell.providerTimings = proposal.generation?.timings;
        return proposal;
      } finally { cell.generationMs = Date.now() - start; }
    },
  });
  cell.runId = started.runId; cell.outcome = started.state;
  if (started.state !== "AWAITING_REVIEW" || !started.proposal) {
    const failure = started.events.find(event => event.stage === "proposal_blocked");
    cell.failureCode = typeof failure?.data?.boundary === "string" ? failure.data.boundary : undefined;
    cell.infrastructureFailure = started.state === "BLOCKED" && cell.failureCode !== "invalid_proposal";
    save(path.join(dir, "run.json"), started); return;
  }
  // Benchmark approval is explicitly scripted; this is not human approval evidence.
  const finalized = await reviewAndApplyRepairRun(started.runId, { proposalId: started.proposal.proposalId, proposalHash: started.proposal.proposalHash, decision: "APPROVED", reviewerNotes: "Scripted controlled model comparison approval; not human acceptance." });
  cell.outcome = finalized.state;
  cell.infrastructureFailure = finalized.postPatchRun?.outcome === "INFRASTRUCTURE_ERROR" || finalized.requiredChecks.some(check => check.exitCode === -1 || check.exitCode === null);
  cell.sameTest = !!finalized.baselineRun?.testFingerprint && finalized.baselineRun.testFingerprint === finalized.postPatchRun?.testFingerprint;
  cell.verified = finalized.state === "VERIFIED" && cell.sameTest;
  if (cell.verified) {
    const bundle = await buildProofBundle(finalized.runId);
    const extracted = extractZipArchive(bundle.buffer);
    if (!bundle.manifest.verified || bundle.manifest.files.some(entry => !extracted.has(entry.path) || sha(extracted.get(entry.path)!) !== entry.sha256)) throw new Error("Proof validation failed");
    fs.writeFileSync(path.join(dir, bundle.filename), bundle.buffer);
    cell.proofPayloads = bundle.manifest.files.length; cell.proofZipHash = sha(bundle.buffer);
  }
  save(path.join(dir, "run.json"), finalized);
}
function summarize(manifest: ComparisonManifest) {
  const directory = path.join(out, "cells");
  const cells: ComparisonCell[] = fs.existsSync(directory) ? fs.readdirSync(directory).filter(file => file.endsWith(".json")).map(file => json(path.join(directory, file))) : [];
  const report = pairedSummary(manifest, cells);
  save(path.join(out, "summary.json"), report);
  const lines = ["# Controlled model comparison", "", `Manifest: ${manifest.manifestHash}`, "", `Execution complete: ${report.complete}. Cells: ${report.observedCells}/${report.expectedCells}.`, "", "| Model | Matched reproductions | Control false positives | Verified repairs | Generation p95 | Unknown usage cells |", "| --- | --- | --- | --- | --- | --- |"];
  for (const model of report.models) lines.push(`| ${model.model} | ${model.reproduction.reportMatched}/${model.reproduction.denominator} | ${model.controls.falsePositives}/${model.controls.denominator} | ${model.repair.verified}/${model.repair.denominator} | ${model.generationLatencyP95Ms ?? "unknown"} ms | ${model.unknownUsageCells} |`);
  lines.push("", "| Model | Input tokens | Output tokens | Known requests | Reproduction generation p95 | Repair generation p95 |", "| --- | --- | --- | --- | --- | --- |");
  for (const model of report.models) lines.push(`| ${model.model} | ${model.inputTokens ?? "unknown"} | ${model.outputTokens ?? "unknown"} | ${model.modelRequests ?? "unknown"} | ${model.stageLatency.reproduction.p95Ms ?? "unknown"} ms (n=${model.stageLatency.reproduction.samples}) | ${model.stageLatency.repair.p95Ms ?? "unknown"} ms (n=${model.stageLatency.repair.samples}) |`);
  lines.push("", ...report.limitations.map(line => `- ${line}`), "", "Raw evidence remains local. These results do not rescore historical held-out evaluations.");
  lines.push("", "## Profiles and budgets", "", ...manifest.models.map(model => `- ${model.id}: ${model.provider} / ${model.model}${model.digest ? ` / digest ${model.digest}` : " / provider weights are not immutable"}`),
    `- CPU: ${manifest.hardware.cpu}; ${manifest.hardware.logicalCpus} logical processors; ${Math.round(manifest.hardware.memoryBytes / 1024 ** 3)} GiB RAM.`,
    `- Per-request timeout: ${manifest.policy.timeoutMs} ms; output cap: ${manifest.policy.maxOutputTokens} tokens; local context: ${manifest.policy.contextTokens} tokens; regression check timeout: ${manifest.policy.regressionTimeoutMs} ms.`,
    "", "## Per-cell outcomes", "", "| Model | Case | Stage | Outcome | Report match | Verified repair | Infrastructure failure |", "| --- | --- | --- | --- | --- | --- | --- |");
  for (const cell of cells) lines.push(`| ${cell.model} | ${cell.caseId} | ${cell.stage} | ${cell.outcome ?? cell.status} | ${cell.reportMatched ?? "n/a"} | ${cell.verified ?? "n/a"} | ${cell.infrastructureFailure ?? false} |`);
  if (report.localMinusHosted) lines.push("", `Local minus hosted: reproduction ${report.localMinusHosted.reproductionPercentagePoints} percentage points; repair ${report.localMinusHosted.repairPercentagePoints} percentage points.`);
  fs.writeFileSync(path.join(out, "report.md"), lines.join("\n") + "\n");
  if (args.includes("--publish")) {
    const released = publicComparison(manifest, cells);
    const destination = path.join(root, "docs/evidence/model-comparison", id);
    fs.mkdirSync(destination, { recursive: true });
    save(path.join(destination, "results.json"), released, true);
    fs.writeFileSync(path.join(destination, "report.md"), lines.join("\n") + "\n", { flag: "wx" });
  }
  console.log(JSON.stringify(report, null, 2));
}
async function run(manifest: ComparisonManifest) {
  if (!args.includes("--confirm-live")) throw new Error("Live comparison requires --confirm-live");
  if (!args.includes("--confirm-external-source")) throw new Error("Hosted repair sends configured MiniShop source externally; --confirm-external-source is required");
  fs.mkdirSync(path.join(out, "cells"), { recursive: true });
  for (const [index, fixture] of manifest.fixtures.entries()) {
    const models = index % 2 ? [...manifest.models].reverse() : manifest.models;
    for (const stage of ["reproduction", ...(fixture.label === "bug" ? ["repair"] : [])] as Array<ComparisonCell["stage"]>) for (const model of models) {
      if (args.includes("--model") && arg("--model") !== model.id) continue;
      const cellId = `${model.id}--${fixture.id}--${stage}`; const file = path.join(out, "cells", `${cellId}.json`);
      if (fs.existsSync(file)) { if (json(file).status === "RUNNING") throw new Error(`Interrupted or active cell ${cellId}; inspect before resuming`); continue; }
      if (sourceFingerprint() !== manifest.sourceFingerprint || promptHash() !== manifest.promptHash || pipelineHash() !== manifest.pipelineHash || testFingerprint(referenceTest) !== manifest.referenceTestHash || hash(json(path.join(out, "references.json"))) !== manifest.referencesHash) throw new Error("Frozen source, pipeline, prompt, references, or test changed");
      if (model.provider === "ollama" && await localIdentity(model) !== model.digest) throw new Error("Frozen local model changed");
      configure(model, manifest);
      const cell: ComparisonCell = { id: cellId, model: model.id, caseId: fixture.id, stage, label: fixture.label, status: "RUNNING", startedAt: new Date().toISOString() };
      save(file, cell, true); const start = Date.now();
      const dir = path.join(out, "evidence", cellId); fs.mkdirSync(dir, { recursive: true });
      console.log(`START ${cellId}`);
      try { if (stage === "reproduction") await reproduce(fixture, cell, dir); else await repair(fixture, cell, dir); cell.status = "COMPLETE"; }
      catch (error) { cell.status = "ERROR"; cell.verified = false; cell.failureCode = error instanceof Error ? error.name : "UnknownError"; cell.infrastructureFailure = true; fs.writeFileSync(path.join(dir, "error.log"), String(error)); }
      cell.completedAt = new Date().toISOString(); cell.durationMs = Date.now() - start; save(file, sealCell(manifest, cell));
      if (sourceFingerprint() !== manifest.sourceFingerprint) throw new Error("Primary MiniShop mutated during evaluation");
      console.log(`END ${cellId}: ${cell.outcome ?? cell.status}`);
      summarize(manifest);
    }
  }
}
function reconcile(manifest: ComparisonManifest) {
  const directory = path.join(out, "cells");
  if (!fs.existsSync(directory)) return;
  for (const file of fs.readdirSync(directory).filter(name => name.endsWith(".json"))) {
    const cell = json(path.join(directory, file)) as ComparisonCell;
    if (cell.status === "RUNNING") {
      cell.status = "INTERRUPTED"; cell.failureCode = "INTERRUPTED_WITH_UNKNOWN_PROVIDER_OUTCOME";
      cell.completedAt = new Date().toISOString(); cell.verified = false;
      save(path.join(directory, file), sealCell(manifest, cell));
    }
  }
}
async function smokeProfile(which: "local" | "hosted") {
  if (which === "hosted" && !args.includes("--confirm-external-source")) throw new Error("Hosted smoke requires explicit source-transmission confirmation");
  const directory = path.join(out, "development-smoke"); fs.mkdirSync(directory);
  const profile: ModelProfile = which === "hosted"
    ? { id: "hosted", provider: "openai", endpoint: process.env.LLM_API_URL || "", model: process.env.LLM_MODEL || "" }
    : { id: "local", provider: "ollama", endpoint: process.env.COMPARISON_OLLAMA_URL || "http://127.0.0.1:11435", model: process.env.COMPARISON_OLLAMA_MODEL || "qwen2.5-coder:3b" };
  if (which === "hosted" && (!process.env.LLM_API_KEY || !profile.endpoint || !profile.model)) throw new Error("Hosted configuration missing");
  if (which === "local") profile.digest = await localIdentity(profile);
  configure(profile, { policy: { timeoutMs: 600000, contextTokens: 16384, maxOutputTokens: 2048, candidateAttempts: 1, transportAttempts: 3, jsonMode: true, structuredOutputs: true, regressionTimeoutMs: 120000, order: "development smoke" } });
  const fixture = comparisonFixtures[0]; const results: ComparisonCell[] = [];
  for (const stage of ["reproduction", "repair"] as const) {
    const dir = path.join(directory, stage); fs.mkdirSync(dir);
    const cell: ComparisonCell = { id: `dev-${stage}`, model: which, caseId: fixture.id, label: "bug", stage, status: "RUNNING", startedAt: new Date().toISOString() };
    console.log(`Development ${stage}`);
    try { if (stage === "reproduction") await reproduce(fixture, cell, dir); else await repair(fixture, cell, dir); cell.status = "COMPLETE"; }
    catch (error) { cell.status = "ERROR"; fs.writeFileSync(path.join(dir, "error.log"), String(error)); }
    cell.completedAt = new Date().toISOString(); save(path.join(dir, "cell.json"), cell); results.push(cell);
  }
  save(path.join(directory, "results.json"), { scope: "Development pipeline smoke, excluded from paired comparison", profile, results });
  if (!results[0].reportMatched || !results[1].verified) throw new Error("Development smoke did not pass both stages; inspect retained outcomes");
}
async function main() {
  if (args.includes("--model") && !["local", "hosted"].includes(arg("--model"))) throw new Error("Model must be local or hosted");
  fs.mkdirSync(out, { recursive: true });
  const lock = path.join(out, "evaluation.lock");
  if (args.includes("--reconcile") && fs.existsSync(lock)) {
    const prior = json(lock);
    let alive = true; try { process.kill(prior.pid, 0); } catch (error: any) { if (error.code === "ESRCH") alive = false; else throw error; }
    if (alive) throw new Error("Evaluation process is still alive; cannot reconcile");
    fs.renameSync(lock, path.join(out, `interrupted-lock-${Date.now()}.json`));
  }
  const fd = fs.openSync(lock, "wx"); fs.writeSync(fd, JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() })); fs.closeSync(fd);
  try {
    if (args.includes("--references")) return await references();
    if (args.includes("--smoke-hosted")) return await smokeProfile("hosted");
    if (args.includes("--smoke-local")) return await smokeProfile("local");
    if (args.includes("--freeze")) return await freeze();
    const manifest = json(path.join(out, "manifest.json")) as ComparisonManifest; validateManifest(manifest);
    if (args.includes("--reconcile")) reconcile(manifest);
    if (args.includes("--run")) await run(manifest);
    summarize(manifest);
  } finally { fs.unlinkSync(lock); }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
