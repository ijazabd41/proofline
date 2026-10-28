import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { AIAssistant } from "./AIAssistant";

afterEach(cleanup);

const mockRun = {
  runId: "run-sample-123",
  caseId: "case-001",
  mode: "dynamic",
  state: "AWAITING_REVIEW",
  attempt: 1,
  maxAttempts: 3,
  originalSourceFingerprint: "fp123",
  proposal: {
    proposalId: "prop-456",
    diagnosis: "Off-by-one error in cart reducer",
    assumptions: ["Items are added incrementally"],
    rationale: "Sum all items using reduce",
    unifiedDiff: "--- a/cart.ts\n+++ b/cart.ts\n@@ -1 +1 @@\n-sum\n+total",
    proposalHash: "a".repeat(64),
    proposedAt: new Date().toISOString(),
  },
  requiredChecks: [
    {
      checkId: "chk-1",
      name: "MiniShop Unit Tests",
      type: "unit",
      command: "npm test",
      passed: true,
      durationMs: 50,
      output: "All tests passed",
    },
  ],
  events: [
    {
      timestamp: new Date().toISOString(),
      stage: "proposal",
      message: "Generated candidate patch",
    },
  ],
};

describe("AIAssistant Component", () => {
  it("publishes restored repair state to the surrounding case view", async () => {
    const onRunChange = vi.fn();
    const verified = { ...mockRun, state: "VERIFIED" };
    globalThis.fetch = vi.fn(async (url: any) => ({ ok: true, json: async () => String(url).includes("repair-runs") ? [verified] : {} })) as any;
    render(<AIAssistant caseId="case-001" onComplete={vi.fn().mockResolvedValue(undefined)} onRunChange={onRunChange} />);
    await waitFor(() => expect(onRunChange).toHaveBeenCalledWith(verified));
  });
  it("explains a restored failed attempt and the new approval, with readable test-target feedback", async () => {
    const retry = { ...mockRun, attempt: 2, attempts: [
      { attemptNumber: 1, state: "VERIFICATION_FAILED", failureReason: 'BTP_ASSERTION: targetCurrencySumEquals Received: "<missing-or-ambiguous>"' },
      { attemptNumber: 2, state: "AWAITING_REVIEW" },
    ], events: [{ stage: "retry", message: "Restoring pristine workspace.", timestamp: "2026-10-23" }] };
    globalThis.fetch = vi.fn(async (url: any) => ({ ok: true, json: async () => String(url).includes("repair-runs") ? [retry] : {} })) as any;
    render(<AIAssistant caseId="case-001" onComplete={vi.fn().mockResolvedValue(undefined)} />);
    expect(await screen.findByText("Reproduction test needs attention")).toBeInTheDocument();
    expect(screen.getByText(/previous candidate changes were rolled back/i)).toBeInTheDocument();
    expect(screen.getByText(/attempt 2 is a new proposal/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve & apply exact patch/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel Run" })).toBeInTheDocument();
  });
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("shows approval progress and makes a retried proposal visibly require fresh approval", async () => {
    let finishReview!: (value: any) => void;
    const retried = { ...mockRun, attempt: 2, proposal: { ...mockRun.proposal, proposalId: "prop-new" },
      attempts: [{ attemptNumber: 1, state: "VERIFICATION_FAILED", failureReason: "Expected total 30; received 25" }, { attemptNumber: 2, state: "AWAITING_REVIEW" }],
      events: [{ stage: "retry", message: "Restoring pristine workspace.", timestamp: "2026-10-23" }] };
    globalThis.fetch = vi.fn((url: any) => {
      if (String(url).endsWith("/review")) return new Promise(resolve => { finishReview = resolve; });
      return Promise.resolve({ ok: true, json: async () => String(url).includes("repair-runs") ? [mockRun] : {} });
    }) as any;
    render(<AIAssistant caseId="case-001" onComplete={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(await screen.findByRole("button", { name: /approve & apply exact patch/i }));
    expect(await screen.findByText("Submitting your approval")).toBeInTheDocument();
    finishReview({ ok: true, json: async () => retried });
    expect(await screen.findByText(/attempt 2 is a new proposal/i)).toBeInTheDocument();
    expect(screen.getByText("Waiting for your approval")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /approve & apply exact patch/i })).toBeEnabled();
  });

  it("restores saved repair runs on case load and renders proposal", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ semantic: false, embeddingProvider: "offline", chunks: 5 }),
        });
      }
      if (url.includes("/api/ai/cases/case-001/repair-runs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([mockRun]),
        });
      }
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;

    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<AIAssistant caseId="case-001" onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText(/Repair Run: run-sample-123/)).toBeDefined();
      expect(screen.getByText(/Off-by-one error in cart reducer/)).toBeDefined();
      expect(screen.getByText(/Approve & Apply Exact Patch/)).toBeDefined();
    });
  });

  it("renders retained Playwright screenshot and trace links for the repair baseline", async () => {
    const runWithEvidence = {
      ...mockRun,
      baselineArtifacts: {
        screenshot: "artifacts/runs/run-sample-123/baseline/failure/test-failed-1.png",
        trace: "artifacts/runs/run-sample-123/baseline/failure/trace.zip",
        resultJson: "artifacts/runs/run-sample-123/baseline/result.json",
      },
    };
    globalThis.fetch = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ semantic: false, embeddingProvider: "offline", chunks: 5 }) });
      if (url.includes("/api/ai/cases/case-001/repair-runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve([runWithEvidence]) });
      return Promise.resolve({ ok: false });
    });

    render(<AIAssistant caseId="case-001" onComplete={vi.fn().mockResolvedValue(undefined)} />);
    const screenshot = await screen.findByRole("img", { name: /baseline failure screenshot/i });
    expect(screenshot.getAttribute("src")).toContain("/artifacts/runs/run-sample-123/baseline/failure/test-failed-1.png");
    expect(screen.getByRole("link", { name: /open playwright trace/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open playwright report/i })).toBeInTheDocument();
  });

  it("renders cancel button and triggers cancel request when active", async () => {
    const runningRun = {
      ...mockRun,
      state: "RUNNING_CHECKS",
      proposal: undefined,
    };

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ semantic: false, embeddingProvider: "offline", chunks: 5 }),
        });
      }
      if (url.includes("/api/ai/cases/case-001/repair-runs")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve([runningRun]),
        });
      }
      if (url.includes("/api/ai/repair-runs/run-sample-123/cancel")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ ...runningRun, state: "CANCELLED" }),
        });
      }
      if (url.includes("/api/ai/repair-runs/run-sample-123")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve(runningRun),
        });
      }
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;

    const onComplete = vi.fn().mockResolvedValue(undefined);
    render(<AIAssistant caseId="case-001" onComplete={onComplete} />);

    await waitFor(() => {
      expect(screen.getByText("Cancel Run")).toBeDefined();
    });

    fireEvent.click(screen.getByText("Cancel Run"));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        expect.stringContaining("/api/ai/repair-runs/run-sample-123/cancel"),
        expect.objectContaining({ method: "POST" })
      );
    });
  });

  it("sends an explicit retrieval scope and explains extractive fallback", async () => {
    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("/api/ai/status")) return Promise.resolve({ ok: true, json: () => Promise.resolve({ semantic: false, embeddingProvider: "lexical", chunks: 5 }) });
      if (url.includes("/api/ai/cases/case-001/repair-runs")) return Promise.resolve({ ok: true, json: () => Promise.resolve([]) });
      if (url.includes("/api/ai/ask")) return Promise.resolve({ ok: true, json: () => Promise.resolve({
        answer: "source excerpt", mode: "extractive", scope: "source", warnings: ["GENERATION_UNAVAILABLE"],
        sources: [{ source: "apps/minishop/src/store/cartStore.ts", sourceType: "source", chunkId: "chunk-1", content: "total", score: 1 }],
      }) });
      return Promise.resolve({ ok: false });
    });
    globalThis.fetch = fetchMock;
    render(<AIAssistant caseId="case-001" onComplete={vi.fn().mockResolvedValue(undefined)} />);
    fireEvent.click(screen.getByRole("button", { name: /ask with sources/i }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/ai/ask"), expect.objectContaining({
      body: expect.stringContaining('"scope":"source"'),
    })));
    expect(await screen.findByText(/answer generation was unavailable; showing retrieved source evidence/i)).toBeInTheDocument();
  });
});
