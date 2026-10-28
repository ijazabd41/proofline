import { createHash } from "node:crypto";
import type { ComparisonFixture } from "../data/evals/model-comparison-fixtures";
export const hash = (value: unknown): string => createHash("sha256").update(canonical(value)).digest("hex");
export const canonical = (value: unknown): string => value === undefined ? "null" : value === null || typeof value !== "object" ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonical).join(",")}]`
  : `{${Object.entries(value as Record<string, unknown>).filter(([, item]) => item !== undefined).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
export interface ModelProfile { id: "local" | "hosted"; provider: "ollama" | "openai"; model: string; endpoint: string; digest?: string }
export interface ComparisonManifest {
  schemaVersion: "1.0"; id: string; createdAt: string; purpose: string;
  sourceFingerprint: string; referenceTestHash: string; fixturesHash: string; referencesHash: string;
  promptHash: string; compilerVersion: string; models: ModelProfile[];
  pipelineHash: string;
  hardware: { cpu: string; logicalCpus: number; memoryBytes: number; platform: string; node: string };
  policy: { timeoutMs: number; contextTokens: number; maxOutputTokens: number; candidateAttempts: number; transportAttempts: number; jsonMode: boolean; structuredOutputs: boolean; order: string; regressionTimeoutMs: number };
  fixtures: ComparisonFixture[]; manifestHash: string;
}
export interface ComparisonCell {
  id: string; model: string; caseId: string; stage: "reproduction" | "repair";
  label: "bug" | "control"; status: "RUNNING" | "COMPLETE" | "ERROR" | "INTERRUPTED";
  startedAt: string; completedAt?: string; durationMs?: number;
  validCandidate?: boolean; executable?: boolean; assertionFailed?: boolean; fixedPassed?: boolean;
  reportMatched?: boolean; falsePositive?: boolean; verified?: boolean; infrastructureFailure?: boolean;
  modelRequests?: number; inputTokens?: number; outputTokens?: number; generationMs?: number;
  providerTimings?: import("../services/api/src/llm/client").LLMTimings; outcome?: string; runId?: string; failureCode?: string;
  sameTest?: boolean; proofPayloads?: number; proofZipHash?: string;
  recordHash?: string;
}
export function sealCell(manifest: ComparisonManifest, cell: ComparisonCell): ComparisonCell {
  const { recordHash: _prior, ...payload } = cell;
  return { ...payload, recordHash: hash({ manifestHash: manifest.manifestHash, cell: payload }) };
}
export function validateManifest(manifest: ComparisonManifest): void {
  const { manifestHash, ...payload } = manifest;
  if (hash(payload) !== manifestHash || hash(manifest.fixtures) !== manifest.fixturesHash) throw new Error("Comparison manifest integrity mismatch");
  if (manifest.models.length !== 2 || new Set(manifest.models.map(item => item.id)).size !== 2) throw new Error("Expected paired local/hosted profiles");
  for (const model of manifest.models) {
    const url = new URL(model.endpoint);
    if (url.username || url.password || url.search || url.hash) throw new Error("Credentials or query strings cannot enter a manifest endpoint");
    if (model.provider === "ollama" && !model.digest) throw new Error("Local model digest must be frozen");
  }
}
/** Conservative scripted rubric, separate from human acceptance. */
export function matchesReport(definition: any, fixture: ComparisonFixture): boolean {
  const assertion = definition?.assertion;
  if (!assertion || assertion.testId !== fixture.expectedTarget) return false;
  if (typeof fixture.expectedValue === "number") return assertion.type === "targetCurrencyEquals" && assertion.expected === fixture.expectedValue && assertion.currency === "USD";
  return assertion.type === "targetTextEquals" && assertion.expected === fixture.expectedValue;
}
export function scoreModel(cells: ComparisonCell[], model: string) {
  const selected = cells.filter(item => item.model === model);
  const bugs = selected.filter(item => item.stage === "reproduction" && item.label === "bug");
  const controls = selected.filter(item => item.stage === "reproduction" && item.label === "control");
  const repairs = selected.filter(item => item.stage === "repair");
  const count = (items: ComparisonCell[], key: keyof ComparisonCell) => items.filter(item => item[key] === true).length;
  const values = (key: "inputTokens" | "outputTokens" | "generationMs") => selected.map(item => item[key]).filter((value): value is number => value !== undefined && Number.isFinite(value));
  const latencies = values("generationMs").sort((a, b) => a - b);
  const stageLatency = (stage: ComparisonCell["stage"]) => {
    const samples = selected.filter(item => item.stage === stage && item.generationMs !== undefined).map(item => item.generationMs!).sort((a, b) => a - b);
    return { samples: samples.length, p95Ms: samples.length ? samples[Math.ceil(samples.length * .95) - 1] : null };
  };
  return {
    model, cells: selected.length, completed: selected.filter(item => item.status === "COMPLETE").length,
    errors: selected.filter(item => item.status === "ERROR" || item.status === "INTERRUPTED").length,
    reproduction: { denominator: bugs.length, valid: count(bugs, "validCandidate"), executable: count(bugs, "executable"), reportMatched: count(bugs, "reportMatched") },
    controls: { denominator: controls.length, falsePositives: count(controls, "falsePositive") },
    repair: { denominator: repairs.length, verified: count(repairs, "verified"), sameTest: count(repairs, "sameTest") },
    infrastructureFailures: count(selected, "infrastructureFailure"),
    inputTokens: values("inputTokens").length ? values("inputTokens").reduce((a, b) => a + b, 0) : null,
    outputTokens: values("outputTokens").length ? values("outputTokens").reduce((a, b) => a + b, 0) : null,
    unknownUsageCells: selected.filter(item => item.inputTokens === undefined || item.outputTokens === undefined).length,
    modelRequests: selected.some(item => item.modelRequests !== undefined) ? selected.reduce((sum, item) => sum + (item.modelRequests ?? 0), 0) : null,
    unknownRequestCountCells: selected.filter(item => item.modelRequests === undefined).length,
    generationLatencyP95Ms: latencies.length ? latencies[Math.ceil(latencies.length * .95) - 1] : null,
    measuredLatencyCells: latencies.length, costUsd: null,
    stageLatency: { reproduction: stageLatency("reproduction"), repair: stageLatency("repair") },
  };
}
export function publicComparison(manifest: ComparisonManifest, cells: ComparisonCell[]) {
  const summary = pairedSummary(manifest, cells);
  if (!summary.complete) throw new Error("Cannot publish an incomplete comparison");
  return { summary, manifest, cells };
}
export function pairedSummary(manifest: ComparisonManifest, cells: ComparisonCell[]) {
  validateManifest(manifest);
  const ids = new Set<string>();
  for (const cell of cells) {
    const fixture = manifest.fixtures.find(item => item.id === cell.caseId);
    if (!fixture || !manifest.models.some(item => item.id === cell.model) || !["reproduction", "repair"].includes(cell.stage) || !["RUNNING", "COMPLETE", "ERROR", "INTERRUPTED"].includes(cell.status) || cell.label !== fixture.label || (cell.stage === "repair" && fixture.label === "control") || cell.id !== `${cell.model}--${cell.caseId}--${cell.stage}` || ids.has(cell.id)) throw new Error("Invalid or duplicate comparison cell");
    ids.add(cell.id);
    if (cell.status !== "RUNNING" && cell.recordHash !== sealCell(manifest, cell).recordHash) throw new Error("Cell integrity mismatch");
  }
  const expectedCells = manifest.models.length * (manifest.fixtures.length + manifest.fixtures.filter(item => item.label === "bug").length);
  const models = manifest.models.map(model => scoreModel(cells, model.id));
  const local = models.find(item => item.model === "local")!; const hosted = models.find(item => item.model === "hosted")!;
  const delta = (a: number, ad: number, b: number, bd: number) => ad && bd ? 100 * (a / ad - b / bd) : null;
  const complete = cells.length === expectedCells && cells.every(item => item.status === "COMPLETE" || item.status === "ERROR");
  return { manifestHash: manifest.manifestHash, purpose: manifest.purpose, profiles: manifest.models, hardware: manifest.hardware, policy: manifest.policy, executionOrder: [...cells].sort((a, b) => a.startedAt.localeCompare(b.startedAt)).map(cell => cell.id), complete, expectedCells, observedCells: cells.length, models,
    localMinusHosted: complete ? {
      reproductionPercentagePoints: delta(local.reproduction.reportMatched, local.reproduction.denominator, hosted.reproduction.reportMatched, hosted.reproduction.denominator),
      repairPercentagePoints: delta(local.repair.verified, local.repair.denominator, hosted.repair.verified, hosted.repair.denominator),
    } : null,
    limitations: ["Small controlled comparison, not a fresh held-out generalization claim.", "Report matching uses a conservative scripted rubric, not human acceptance.", "Repair approval is scripted for the benchmark; proposals and execution are live.", "Token counts are provider-specific; cost and local energy consumption are unknown.", "Cold model load timing is retained when supplied; wall latency includes runtime differences."] };
}
