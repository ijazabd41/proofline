import { describe, expect, it } from "vitest";
import { comparisonFixtures } from "../data/evals/model-comparison-fixtures";
import { hash, matchesReport, pairedSummary, publicComparison, sealCell, validateManifest, type ComparisonManifest, type ComparisonCell } from "./model-comparison-core";
function fixtureManifest(): ComparisonManifest {
  const payload = { schemaVersion: "1.0" as const, id: "test", createdAt: "2026-10-23", purpose: "controlled test", sourceFingerprint: "source", referenceTestHash: "tests", fixturesHash: hash(comparisonFixtures), referencesHash: "refs", promptHash: "prompt", compilerVersion: "test", pipelineHash: "pipeline", hardware: { cpu: "test", logicalCpus: 1, memoryBytes: 1, platform: "test", node: "test" },
    models: [{ id: "local" as const, provider: "ollama" as const, endpoint: "http://127.0.0.1:11435", model: "local", digest: "digest" }, { id: "hosted" as const, provider: "openai" as const, endpoint: "https://example.invalid/v1", model: "hosted" }],
    policy: { timeoutMs: 600000, contextTokens: 16384, maxOutputTokens: 2048, candidateAttempts: 1, transportAttempts: 3, jsonMode: true, structuredOutputs: true, order: "paired", regressionTimeoutMs: 120000 }, fixtures: structuredClone(comparisonFixtures) };
  return { ...payload, manifestHash: hash(payload) };
}
describe("paired comparison evidence and scoring", () => {
  it("retains cell integrity across JSON persistence when optional measurements are unknown", () => {
    const manifest = fixtureManifest();
    const cell = sealCell(manifest, { id: "hosted--cmp-usb-price--reproduction", model: "hosted", caseId: "cmp-usb-price", label: "bug", stage: "reproduction", status: "COMPLETE", startedAt: "now", inputTokens: undefined, providerTimings: undefined });
    const persisted = JSON.parse(JSON.stringify(cell));
    expect(() => pairedSummary(manifest, [persisted])).not.toThrow();
  });
  it("rejects altered fixtures and credential-bearing endpoints", () => {
    const manifest = fixtureManifest(); validateManifest(manifest);
    manifest.fixtures[0].expectedValue = 999;
    expect(() => validateManifest(manifest)).toThrow(/integrity/);
    const credentialManifest = fixtureManifest(); credentialManifest.models[1].endpoint = "https://user:password@example.invalid/v1";
    const { manifestHash: _hash, ...payload } = credentialManifest; credentialManifest.manifestHash = hash(payload);
    expect(() => validateManifest(credentialManifest)).toThrow(/Credentials/);
  });
  it("does not turn an arbitrary failing assertion into a report match", () => {
    const fixture = comparisonFixtures[0];
    expect(matchesReport({ assertion: { type: "targetCurrencyEquals", testId: fixture.expectedTarget, expected: 15, currency: "USD" } }, fixture)).toBe(true);
    expect(matchesReport({ assertion: { type: "targetCurrencyEquals", testId: "cart-total", expected: 15, currency: "USD" } }, fixture)).toBe(false);
    expect(matchesReport({ assertion: { type: "targetCurrencyEquals", testId: fixture.expectedTarget, expected: 17, currency: "USD" } }, fixture)).toBe(false);
  });
  it("retains infrastructure failures in denominators and keeps stage scores separate", () => {
    const manifest = fixtureManifest(); const cells: ComparisonCell[] = [];
    for (const model of manifest.models) for (const fixture of manifest.fixtures) for (const stage of ["reproduction", ...(fixture.label === "bug" ? ["repair"] : [])] as const) {
      const success = model.id === "hosted";
      const cell: ComparisonCell = { id: `${model.id}--${fixture.id}--${stage}`, model: model.id, caseId: fixture.id, label: fixture.label, stage: stage as "reproduction" | "repair", status: "COMPLETE", startedAt: "now",
        reportMatched: success && fixture.label === "bug" && stage === "reproduction", verified: success && stage === "repair", infrastructureFailure: !success };
      cells.push(sealCell(manifest, cell));
    }
    const summary = pairedSummary(manifest, cells);
    expect(summary.complete).toBe(true);
    expect(summary.models[0].reproduction).toMatchObject({ denominator: 3, reportMatched: 0 });
    expect(summary.models[0].repair).toMatchObject({ denominator: 3, verified: 0 });
    expect(summary.models[1].repair.verified).toBe(3);
    expect(summary.localMinusHosted?.repairPercentagePoints).toBe(-100);
    expect(summary.models[0].inputTokens).toBeNull();
    expect(summary.models[0].unknownUsageCells).toBe(8);
    cells[0].verified = true;
    expect(() => pairedSummary(manifest, cells)).toThrow(/integrity/);
  });
  it("does not publish a model-effect delta for missing or interrupted cells", () => {
    const manifest = fixtureManifest();
    expect(pairedSummary(manifest, []).localMinusHosted).toBeNull();
    expect(() => publicComparison(manifest, [])).toThrow(/incomplete/);
    const cell = sealCell(manifest, { id: "local--cmp-usb-price--reproduction", model: "local", caseId: "cmp-usb-price", label: "bug", stage: "reproduction", status: "INTERRUPTED", startedAt: "now" });
    expect(pairedSummary(manifest, [cell]).complete).toBe(false);
    expect(() => pairedSummary(manifest, [cell, cell])).toThrow(/duplicate/);
  });
});
