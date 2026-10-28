import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { EvidencePanel } from "./EvidencePanel";

afterEach(cleanup);

describe("EvidencePanel phase labels", () => {
  it("describes an assertion-failed baseline as a reproduced bug and recovers its expected value", () => {
    render(<EvidencePanel evidence={[]} phase="before" run={{
      passed: false,
      outcome: "ASSERTION_FAILED",
      expected: "",
      actual: "BTP_ASSERTION: targetCurrencyEquals\nExpected: 30\nReceived: 10",
      durationMs: 10,
      runAt: "2026-10-24T12:00:00.000Z",
      evidenceIds: [],
    }} />);
    expect(screen.getByText(/bug reproduced/i)).toBeDefined();
    expect(screen.getByText("30")).toBeDefined();
    expect(screen.queryByText(/assertion failed/i)).toBeNull();
  });

  it("labels a post-patch pass as a reproduction-test pass, not complete verification", () => {
    render(<EvidencePanel evidence={[]} phase="after" run={{
      passed: true,
      outcome: "PASSED",
      expected: "30",
      actual: "30",
      durationMs: 10,
      runAt: "2026-10-24T12:00:00.000Z",
      evidenceIds: [],
    }} />);
    expect(screen.getByText(/reproduction test passed/i)).toBeDefined();
    expect(screen.queryByText(/^passed$/i)).toBeNull();
  });

  it("retries a screenshot that is briefly unavailable instead of keeping a permanent error", () => {
    vi.useFakeTimers();
    try {
      render(<EvidencePanel evidence={[{
        id: "ev-run-screenshot",
        type: "screenshot",
        phase: "before",
        path: "artifacts/case/before/run/test-failed-1.png",
        createdAt: "2026-10-24T12:00:00.000Z",
        description: "Screenshot captured before patch",
      }]} phase="before" run={{
        passed: false,
        outcome: "ASSERTION_FAILED",
        expected: "30",
        actual: "10",
        durationMs: 10,
        runAt: "2026-10-24T12:00:00.000Z",
        evidenceIds: ["ev-run-screenshot"],
      }} />);

      fireEvent.error(screen.getByRole("img", { name: "Screenshot captured before patch" }));
      expect(screen.getByText(/retrying screenshot/i)).toBeDefined();

      act(() => vi.advanceTimersByTime(1_000));
      expect(screen.getByRole("img", { name: "Screenshot captured before patch" }).getAttribute("src")).toContain("btp_retry=1");
    } finally {
      vi.useRealTimers();
    }
  });
});
