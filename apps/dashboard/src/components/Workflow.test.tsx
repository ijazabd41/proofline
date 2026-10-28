import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import { Workflow } from "./Workflow";
afterEach(cleanup);
it.each([["AWAITING_REVIEW", "Review patch"], ["APPLYING", "Verify"], ["VERIFIED", "Verify"], ["BLOCKED", "Reproduce"]])("follows repair state %s over the older case status", (repairState, label) => {
  render(<Workflow status="REPRODUCED" repairState={repairState} />);
  expect(screen.getByText(label).closest("li")).toHaveAttribute("aria-current", "step");
});
