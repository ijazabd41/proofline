import React from "react";

interface ProgressRun {
  state: string;
  attempt?: number;
  attempts?: { attemptNumber: number; state: string; failureReason?: string }[];
  events: { stage: string; message: string }[];
  baselineRun?: { actual: string };
  postPatchRun?: { actual: string };
}

export function needsReproductionAttention(run: ProgressRun): boolean {
  return [run.baselineRun?.actual, run.postPatchRun?.actual, ...(run.attempts ?? []).map(item => item.failureReason)]
    .some(message => /<missing(?:-or-ambiguous)?>/.test(message ?? ""));
}

const labels: Record<string, string> = {
  INITIALIZING: "Preparing repair", REPRODUCING_BASELINE: "Checking the original failure",
  INVESTIGATING: "Investigating the issue", PROPOSING: "Preparing a patch proposal",
  AWAITING_REVIEW: "Waiting for your approval", APPLYING: "Applying the approved patch",
  VERIFYING_REPRODUCTION: "Checking whether the patch fixes the issue", RUNNING_CHECKS: "Running regression checks",
  VERIFIED: "Candidate verified", VERIFICATION_FAILED: "Patch did not pass verification",
  BLOCKED: "Repair could not continue", CANCELLED: "Repair cancelled", REJECTED: "Patch rejected",
};

export function RepairProgress({ run, submittingApproval }: { run: ProgressRun; submittingApproval: boolean }) {
  const attempt = run.attempt ?? 1;
  const targetIssue = needsReproductionAttention(run);
  const stopped = ["BLOCKED", "CANCELLED", "REJECTED", "VERIFICATION_FAILED"].includes(run.state);
  const previousFailure = (run.attempts ?? []).filter(item => item.attemptNumber < attempt && item.failureReason).slice(-1)[0];
  const restored = previousFailure && run.state === "AWAITING_REVIEW" && run.events.some(event => event.stage === "retry");
  const title = targetIssue ? "Reproduction test needs attention" : submittingApproval && run.state === "AWAITING_REVIEW"
    ? "Submitting your approval" : labels[run.state] ?? "Repair in progress";
  return <section aria-label="Repair progress" style={{ margin: "12px 0", padding: 14, borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 14, lineHeight: 1.5, background: targetIssue || previousFailure ? "#fffbeb" : "#f8fafc" }}>
    <div role="status" aria-live="polite" aria-atomic="true" style={{ display: "grid", gap: 8 }}>
      <h5 style={{ margin: 0, fontSize: 15 }}>{title}</h5>
      {previousFailure && <p>Attempt {previousFailure.attemptNumber} did not pass verification.</p>}
      {restored && <p>Previous candidate changes were rolled back.</p>}
      {targetIssue ? <>
        <p>The test could not find a required value on the page. It could not check the reported behavior.</p>
        {stopped && <p>This run has stopped. No patch was verified.</p>}
        <p><strong>Next step:</strong> {stopped ? "Regenerate or correct the reproduction test, review its replacement, then start a new repair run." : "Cancel this run and regenerate or correct the reproduction test before approving another patch."}</p>
      </> : run.state === "VERIFIED" ? <p>The candidate passed the reproduction test and required checks in the isolated workspace.</p>
        : run.state === "AWAITING_REVIEW" && !submittingApproval ? <p>Review the proposed changes below. Applying a patch is followed by verification; approval alone does not mean the issue is fixed.</p>
        : !["CANCELLED", "REJECTED"].includes(run.state) && <p>The repair is not verified yet.</p>}
      {run.state === "AWAITING_REVIEW" && attempt > 1 && <p>Attempt {attempt} is a new proposal and needs its own approval.</p>}
    </div>
    {!!run.attempts?.length && <div>
      <h5 style={{ margin: "12px 0 4px" }}>Attempt history</h5>
      <ol style={{ paddingLeft: 20, margin: 0 }}>{run.attempts.map(item => <li key={item.attemptNumber} style={{ marginBottom: 8 }}>
        <strong>Attempt {item.attemptNumber}: {labels[item.state] ?? item.state.replace(/_/g, " ").toLowerCase()}</strong>
        {item.failureReason && <details><summary>Failure details</summary><p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{item.failureReason}</p></details>}
      </li>)}</ol>
    </div>}
  </section>;
}
