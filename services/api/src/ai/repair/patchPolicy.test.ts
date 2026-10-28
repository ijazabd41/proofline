import { describe, it, expect, beforeEach, afterEach } from "vitest";
import path from "path";
import fs from "fs";
import {
  validateEdits,
  generateUnifiedDiff,
  applyEditsTransactionally,
  isAllowedEditablePath,
  computeExpectedPatchedFingerprint,
} from "./patchPolicy";
import { createRunWorkspace, releaseWorkspaceLock, computeSourceManifest } from "./workspace";
import { ARTIFACTS_DIR } from "../../utils/paths";

import { randomUUID } from "crypto";

describe("Dynamic AI Repair Patch Policy", () => {
  let testRunId: string;
  let ws: ReturnType<typeof createRunWorkspace>;

  beforeEach(() => {
    testRunId = "test-policy-" + randomUUID();
    ws = createRunWorkspace(testRunId);
  });

  afterEach(() => {
    releaseWorkspaceLock(ws);
    const runDir = path.join(ARTIFACTS_DIR, "runs", testRunId);
    if (fs.existsSync(runDir)) {
      try {
        fs.rmSync(runDir, { recursive: true, force: true });
      } catch {
        // ignore Windows file lock latency
      }
    }
  });

  it("checks allowed editable paths correctly", () => {
    expect(isAllowedEditablePath("src/store/cartStore.ts")).toBe(true);
    expect(isAllowedEditablePath("apps/minishop/src/App.tsx")).toBe(true);
    expect(isAllowedEditablePath("src/store/cartStore.test.ts")).toBe(false);
    expect(isAllowedEditablePath("vite.config.ts")).toBe(false);
    expect(isAllowedEditablePath("package.json")).toBe(false);
  });

  it.each(["\n", "\r\n"])("predicts the complete fingerprint for multiple edits to one file (%j)", (newline) => {
    const file = path.join(ws.minishopDir, "src/pages/ReviewFixture.tsx");
    fs.writeFileSync(file, ["const total = subtotal;", "const fee = shipping;", ""].join(newline));
    const original = computeSourceManifest(ws.minishopDir).fingerprint;
    const edits = [
      { relativePath: "src/pages/ReviewFixture.tsx", oldContent: "const total = subtotal;", newContent: "const total = subtotal + shipping;" },
      { relativePath: "apps/minishop/src/pages/ReviewFixture.tsx", oldContent: "const fee = shipping;", newContent: "const fee = shipping;\nconst includesShipping = true;" },
    ];
    const expected = computeExpectedPatchedFingerprint(ws.minishopDir, edits);
    expect(applyEditsTransactionally(ws.minishopDir, edits).success).toBe(true);
    expect(computeSourceManifest(ws.minishopDir).fingerprint).toBe(expected);
    expect(fs.readFileSync(file, "utf8")).toBe(["const total = subtotal + shipping;", "const fee = shipping;", "const includesShipping = true;", ""].join(newline));
    fs.appendFileSync(file, "\n// unrelated change\n");
    const mutated = computeSourceManifest(ws.minishopDir).fingerprint;
    expect(mutated).not.toBe(original);
    expect(mutated).not.toBe(expected);
  });

  it("validates valid edits and rejects invalid or ambiguous edits", () => {
    const validEdit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    expect(validateEdits(ws.minishopDir, validEdit).valid).toBe(true);

    const missingContentEdit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "non_existent_code_snippet_xyz",
        newContent: "something else",
      },
    ];
    expect(validateEdits(ws.minishopDir, missingContentEdit).valid).toBe(false);

    const forbiddenPathEdit = [
      {
        relativePath: "package.json",
        oldContent: `"name": "@bug-to-proof/minishop"`,
        newContent: `"name": "@bug-to-proof/hacked"`,
      },
    ];
    expect(validateEdits(ws.minishopDir, forbiddenPathEdit).valid).toBe(false);
  });

  it("generates unified diff for valid edits", () => {
    const edit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    const diff = generateUnifiedDiff(ws.minishopDir, edit);
    expect(diff).toContain("--- a/src/store/cartStore.ts");
    expect(diff).toContain("+++ b/src/store/cartStore.ts");
    expect(diff).toContain("-  clearCart: () => set({ items: [] }),");
    expect(diff).toContain("+  clearCart: () => set({ items: [] }), // reset items");
  });

  it("applies edits transactionally to isolated workspace and preserves primary source", () => {
    const edit = [
      {
        relativePath: "src/store/cartStore.ts",
        oldContent: "  clearCart: () => set({ items: [] }),",
        newContent: "  clearCart: () => set({ items: [] }), // reset items",
      },
    ];

    const result = applyEditsTransactionally(ws.minishopDir, edit);
    expect(result.success).toBe(true);
    expect(result.modifiedFiles).toContain("src/store/cartStore.ts");

    const updatedContent = fs.readFileSync(
      path.join(ws.minishopDir, "src", "store", "cartStore.ts"),
      "utf-8"
    );
    expect(updatedContent).toContain("clearCart: () => set({ items: [] }), // reset items");
  });
});
