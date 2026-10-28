import { afterEach, describe, expect, it, vi } from "vitest";
import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { generateProposal } from "./repair/proposal";
import { createRunWorkspace, releaseWorkspaceLock } from "./repair/workspace";
import { generateReproductionCandidate, preflightReproductionProvider } from "../reproduction/generationProvider";
import { discoverTargetSurface } from "../reproduction/targetDiscovery";
import { ARTIFACTS_DIR } from "../utils/paths";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("Ollama reproduction and repair integration (HTTP simulated)", () => {
  it("routes both stages locally, retains measurements, and never sends a hosted authorization header", async () => {
    vi.stubEnv("RAG_GENERATION_PROVIDER", "ollama"); vi.stubEnv("RAG_GENERATION_MODEL", "coder:test");
    vi.stubEnv("RAG_GENERATION_BASE_URL", "http://127.0.0.1:11435"); vi.stubEnv("RAG_GENERATION_JSON_MODE", "true");
    vi.stubEnv("LLM_ENABLED", "true"); vi.stubEnv("LLM_API_KEY", "hosted-key-must-not-leak");
    const ws = createRunWorkspace(`ollama-contract-${randomUUID()}`);
    try {
      const requests: Array<{ url: string; headers: any; body: any }> = [];
      let responseContent = "{}";
      vi.stubGlobal("fetch", vi.fn(async (url, init) => {
        if (String(url).endsWith("/api/tags")) return new Response(JSON.stringify({ models: [{ name: "coder:test" }] }));
        requests.push({ url: String(url), headers: init.headers, body: JSON.parse(init.body) });
        return new Response(JSON.stringify({ message: { content: responseContent }, prompt_eval_count: 10, eval_count: 3, total_duration: 1e9 }));
      }));
      expect(await preflightReproductionProvider()).toMatchObject({ ready: true, model: "coder:test" });
      const discovery = discoverTargetSurface(ws.minishopDir);
      const generated = await generateReproductionCandidate({ report: { title: "USB price", description: "Expected 15", steps: ["Open shop"], expected: "15", actual: "17" }, discovery, attempt: 1, previousDiagnostics: [], promptVersion: "reproduction-v2" });
      expect(generated.usage).toMatchObject({ inputTokens: 10, outputTokens: 3 });
      vi.stubEnv("LLM_ENABLED", "false");
      responseContent = JSON.stringify({ diagnosis: "Reference comment", rationale: "Contract test only", assumptions: [], edits: [{ relativePath: "src/store/cartStore.ts", oldContent: "clearCart: () => set({ items: [] }),", newContent: "clearCart: () => set({ items: [] }), // contract" }] });
      const onGeneration = vi.fn();
      const proposal = await generateProposal({ caseTitle: "Contract", caseDescription: "Comment", reproductionTestFile: "test.spec.ts", minishopDir: ws.minishopDir, onGeneration });
      expect(proposal.generation).toMatchObject({ provider: "ollama", model: "coder:test", usage: { inputTokens: 10, outputTokens: 3 } });
      expect(onGeneration).toHaveBeenCalledOnce();
      expect(requests).toHaveLength(2);
      expect(requests.every(request => request.url === "http://127.0.0.1:11435/api/chat")).toBe(true);
      expect(requests.every(request => !request.headers.Authorization && request.body.format === "json")).toBe(true);
      expect(requests[1].body.messages[0].content).not.toContain("hosted-key-must-not-leak");
      responseContent = "not-json";
      const invalidTelemetry = vi.fn();
      await expect(generateProposal({ caseTitle: "Contract", caseDescription: "Comment", reproductionTestFile: "test.spec.ts", minishopDir: ws.minishopDir, onGeneration: invalidTelemetry })).rejects.toThrow(/valid JSON/);
      expect(invalidTelemetry).toHaveBeenCalledWith(expect.objectContaining({ usage: { inputTokens: 10, outputTokens: 3, totalTokens: 13 } }));
      // A local transport failure remains local even when hosted credentials exist.
      vi.stubEnv("LLM_ENABLED", "true");
      vi.stubGlobal("fetch", vi.fn(async (url) => { expect(String(url)).toContain("127.0.0.1:11435"); return new Response("", { status: 404 }); }));
      await expect(generateProposal({ caseTitle: "Contract", caseDescription: "Comment", reproductionTestFile: "test.spec.ts", minishopDir: ws.minishopDir })).rejects.toThrow(/http_error:404/);
    } finally {
      releaseWorkspaceLock(ws);
      expect(path.resolve(ws.runDir)).toBe(path.resolve(ARTIFACTS_DIR, "runs", ws.runId));
      fs.rmSync(ws.runDir, { recursive: true, force: true });
    }
  });
});
