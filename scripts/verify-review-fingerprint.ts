import fs from "fs";
import path from "path";
import { runTest } from "../services/api/src/runner/playwrightRunner";
import { WORKSPACE_ROOT } from "../services/api/src/utils/paths";

const source = String.raw`
import { test, expect } from "@playwright/test";
import fs from "fs";
import path from "path";
import { applyEditsTransactionally, computeExpectedPatchedFingerprint } from "../../../services/api/src/ai/repair/patchPolicy";
import { computeSourceManifest } from "../../../services/api/src/ai/repair/workspace";
for (const ending of ["LF", "CRLF"]) {
  test("multiple edits in one file match approved workspace fingerprint - " + ending, async ({}, info) => {
    const pristine = info.outputPath("pristine");
    const candidate = info.outputPath("candidate");
    const text = "const total = useCartStore((s) => s.total);\nconst cartTotal = total();\n";
    for (const root of [pristine, candidate]) {
      fs.mkdirSync(path.join(root, "src/pages"), { recursive: true });
      fs.writeFileSync(path.join(root, "src/pages/CartPage.tsx"), ending === "CRLF" ? text.replace(/\n/g, "\r\n") : text);
    }
    const edits = [
      { relativePath: "src/pages/CartPage.tsx", oldContent: "const total = useCartStore((s) => s.total);", newContent: "const total = useCartStore((s) => s.total);\nconst shipping = useCartStore((s) => s.shipping);" },
      { relativePath: "apps/minishop/src/pages/CartPage.tsx", oldContent: "const cartTotal = total();", newContent: "const cartTotal = total() + shipping();" },
    ];
    const original = computeSourceManifest(pristine).fingerprint;
    const expected = computeExpectedPatchedFingerprint(pristine, edits);
    expect(applyEditsTransactionally(candidate, edits).success).toBe(true);
    const actual = computeSourceManifest(candidate).fingerprint;
    await info.attach("btp-assertion", { body: Buffer.from(JSON.stringify({ expected, actual })), contentType: "application/json" });
    expect(actual, "BTP_ASSERTION: fully applied approved edits must match predicted fingerprint").toBe(expected);
    expect(actual).not.toBe(original);
    // Identical state remains resumable; unrelated modifications still fail the binary invariant.
    expect(computeSourceManifest(candidate).fingerprint).toBe(expected);
    fs.appendFileSync(path.join(candidate, "src/pages/CartPage.tsx"), "\n// unrelated mutation\n");
    const changed = computeSourceManifest(candidate).fingerprint;
    expect(changed).not.toBe(original);
    expect(changed).not.toBe(expected);
    expect(fs.readFileSync(path.join(pristine, "src/pages/CartPage.tsx"), "utf8")).toBe(ending === "CRLF" ? text.replace(/\n/g, "\r\n") : text);
  });
}
`;

async function main() {
  const phase = process.argv[2];
  if (phase !== "before" && phase !== "after") throw new Error("Specify before or after");
  const file = path.join(WORKSPACE_ROOT, "tests/playwright/cases/review-fingerprint-regression.spec.ts");
  const dir = path.join(WORKSPACE_ROOT, "artifacts/review-fingerprint", phase);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, source, { flag: "wx" });
  try {
    const result = await runTest("review-fingerprint", path.relative(WORKSPACE_ROOT, file), phase, { artifactDir: dir, timeoutMs: 90000 });
    fs.writeFileSync(path.join(dir, "executed.spec.ts"), source);
    fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(result, null, 2));
    console.log(JSON.stringify({ phase, outcome: result.outcome, testFingerprint: result.testFingerprint, actual: result.actual }, null, 2));
    if (result.outcome !== (phase === "before" ? "ASSERTION_FAILED" : "PASSED")) process.exitCode = 1;
  } finally { fs.unlinkSync(file); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
