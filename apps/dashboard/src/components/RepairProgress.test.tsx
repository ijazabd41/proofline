import React from "react";
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { RepairProgress } from "./RepairProgress";
it("does not tell the user to cancel an already blocked run", () => {
  render(<RepairProgress run={{ state: "BLOCKED", events: [], baselineRun: { actual: "<missing-or-ambiguous>" } }} submittingApproval={false} />);
  expect(screen.getByText(/this run has stopped/i)).toBeInTheDocument();
  expect(screen.queryByText(/cancel this run/i)).not.toBeInTheDocument();
});
