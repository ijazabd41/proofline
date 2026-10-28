import { describe, expect, it } from "vitest";
import { classifyProposalFailure } from "./proposalFailure";

it("distinguishes an invalid patch snippet from a missing provider model", () => {
  const failure = classifyProposalFailure(new Error("Model proposed invalid edits: oldContent not found in src/components/Cart.tsx"));
  expect(failure.boundary).toBe("invalid_proposal");
});

describe("repair proposal provider failure diagnostics", () => {
  it.each([
    ["401 Unauthorized", "authentication_failed"],
    ["404 model not found", "model_or_endpoint_not_found"],
    ["429 Too Many Requests", "rate_limited"],
    ["request timed out", "timed_out"],
    ["Model returned an empty response", "empty_response"],
    ["fetch failed", "request_failed"],
  ])("classifies %s without retaining raw provider output", (message, boundary) => {
    const result = classifyProposalFailure(new Error(message));
    expect(result.boundary).toBe(boundary);
    expect(result.diagnostic).not.toBe(message);
    expect(result.diagnostic).not.toMatch(/https?:\/\/|api[_ -]?key|bearer\s/i);
  });
});
