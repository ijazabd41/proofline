import React from "react";
import type { Evidence, Verification } from "../types";
import { EvidencePanel } from "./EvidencePanel";

interface BeforeAfterComparisonProps {
  evidence: Evidence[];
  verification?: Verification | null;
  candidate?: boolean;
}

export function BeforeAfterComparison({ evidence, verification, candidate }: BeforeAfterComparisonProps) {
  const beforeRun = verification?.beforeRun ?? null;
  const afterRun = verification?.afterRun ?? null;

  const hasBeforeEvidence = evidence.some((e) => e.phase === "before");
  const hasAfterEvidence = evidence.some((e) => e.phase === "after");

  // Derive before-panel label from actual run data
  let beforeLabel: React.ReactNode;
  let beforeBorder = "#e2e8f0";

  if (beforeRun != null) {
    if (beforeRun.outcome === "INFRASTRUCTURE_ERROR") {
      beforeLabel = (
        <span style={{ color: "#c2410c" }}>
          Infrastructure error — no reproduced bug
        </span>
      );
      beforeBorder = "#fed7aa";
    } else if (!beforeRun.outcome) {
      beforeLabel = (
        <span style={{ color: "#64748b" }}>Legacy run — proof unavailable</span>
      );
    } else if (beforeRun.outcome === "ASSERTION_FAILED") {
      beforeLabel = (
        <>
          <span style={{ color: "#b91c1c", fontWeight: 700 }}>BUG REPRODUCED</span>
          <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>
            {" "}— baseline assertion failed as expected
          </span>
        </>
      );
      beforeBorder = "#fecaca";
    } else {
      beforeLabel = <span style={{ color: "#c2410c", fontWeight: 700 }}>BUG NOT REPRODUCED</span>;
      beforeBorder = "#fed7aa";
    }
  } else {
    beforeLabel = <span style={{ color: "#64748b" }}>Not run</span>;
  }

  // Derive after-panel label from actual run data
  let afterLabel: React.ReactNode;
  let afterBorder = "#e2e8f0";

  if (afterRun != null) {
    if (afterRun.passed) {
      afterLabel = (
        <>
          <span style={{ color: "#15803d", fontWeight: 700 }}>{verification?.status === "VERIFIED" ? "ALL GATES PASSED" : "TEST PASSED"}</span>
          <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>
            {" "}— {verification?.status === "VERIFIED" ? candidate ? "candidate verified" : "repair verified" : "reproduction test passed; verification gates pending"}
          </span>
        </>
      );
      afterBorder = "#bbf7d0";
    } else {
      afterLabel = (
        <>
          <span style={{ color: "#c2410c", fontWeight: 700 }}>⚠️ FAILED</span>
          <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>
            {" "}— {afterRun.outcome === "INFRASTRUCTURE_ERROR" ? "Infrastructure error; verification blocked" : "Verification failed"}
          </span>
        </>
      );
      afterBorder = "#fed7aa";
    }
  } else {
    afterLabel = <span style={{ color: "#64748b" }}>Not run</span>;
  }

  return (
    <div
      className="btp-before-after"
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)",
        gap: 20,
      }}
    >
      <style>{`
        @media (max-width: 640px) {
          .btp-before-after { grid-template-columns: 1fr !important; }
        }
      `}</style>

      {/* Before panel */}
      <div
        className="comparison-card"
        style={{
          border: `1px solid ${beforeBorder}`,
          borderRadius: 10,
          padding: 18,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <h4
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#0f172a",
          }}
        >
          <span>Baseline (before patch) —</span> {beforeLabel}
        </h4>
        {hasBeforeEvidence || beforeRun ? (
          <EvidencePanel evidence={evidence} phase="before" run={beforeRun} />
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Evidence unavailable.</p>
        )}
      </div>

      {/* After panel */}
      <div
        className="comparison-card"
        style={{
          border: `1px solid ${afterBorder}`,
          borderRadius: 10,
          padding: 18,
          background: "#ffffff",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.05)",
        }}
      >
        <h4
          style={{
            fontSize: 13,
            fontWeight: 700,
            marginBottom: 14,
            display: "flex",
            alignItems: "center",
            gap: 8,
            color: "#0f172a",
          }}
        >
          <span>Post-patch reproduction —</span> {afterLabel}
        </h4>
        {hasAfterEvidence || afterRun ? (
          <EvidencePanel evidence={evidence} phase="after" run={afterRun} />
        ) : (
          <p style={{ color: "#94a3b8", fontSize: 13 }}>Not run yet.</p>
        )}
      </div>
    </div>
  );
}
