import React from "react";
import type { CaseStatus } from "../types";

const steps = [
  ["Report", "Describe the issue"],
  ["Reproduce", "Confirm the behavior"],
  ["Review patch", "Assess the proposed fix"],
  ["Verify", "Run tests and checks"],
];

const phase: Record<CaseStatus, number> = {
  REPORTED: 0,
  READY_TO_REPRODUCE: 1,
  REPRODUCING: 1,
  REPRODUCED: 1,
  REPRODUCTION_FAILED: 1,
  PATCH_PROPOSED: 2,
  PATCH_APPLIED: 3,
  VERIFYING: 3,
  VERIFIED: 3,
  VERIFICATION_FAILED: 3,
};

export function Workflow({ status, repairState }: { status?: CaseStatus; repairState?: string }) {
  const repairPhase: Record<string, number> = {
    INITIALIZING: 1, REPRODUCING_BASELINE: 1, INVESTIGATING: 2, PROPOSING: 2,
    AWAITING_REVIEW: 2, APPLYING: 3, VERIFYING_REPRODUCTION: 3, RUNNING_CHECKS: 3,
    VERIFIED: 3, VERIFICATION_FAILED: 3, REJECTED: 2,
  };
  const currentPhase = repairState ? (repairPhase[repairState] ?? 1) : status ? (phase[status] ?? 0) : 0;

  return (
    <ol className="workflow" aria-label="Repair workflow">
      {steps.map(([title, description], i) => {
        const isCurrent = i === currentPhase;
        const isCompleted = i < currentPhase;
        const itemClass = isCurrent ? "current" : isCompleted ? "completed" : "upcoming";

        return (
          <li
            key={title}
            className={itemClass}
            aria-current={status && isCurrent ? "step" : undefined}
          >
            <span className="step-number">
              {isCompleted ? "✓" : i + 1}
            </span>
            <div className="step-content">
              <strong>{title}</strong>
              <span>{description}</span>
            </div>
            <span className="step-arrow" aria-hidden="true">
              →
            </span>
          </li>
        );
      })}
    </ol>
  );
}
