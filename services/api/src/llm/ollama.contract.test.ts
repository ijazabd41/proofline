import { afterEach, describe, expect, it, vi } from "vitest";
import { callLLMWithDiagnostics } from "./client";
import { ragConfig } from "../ai/providers";
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });
describe("local generation configuration and numeric telemetry", () => {
  it.each(["ollama", "openai"] as const)("transmits the same explicit output schema through %s", async protocol => {
    let body: any;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify(protocol === "ollama" ? { message: { content: "{}" } } : { choices: [{ message: { content: "{}" } }] }));
    }));
    const schema = { type: "object", properties: { ok: { type: "boolean" } }, required: ["ok"], additionalProperties: false };
    await callLLMWithDiagnostics("JSON please", 1000, undefined, 100, { apiUrl: "http://127.0.0.1:11435", protocol, model: "test", apiKey: "placeholder", schema } as any);
    expect(protocol === "ollama" ? body.format : body.response_format).toEqual(protocol === "ollama" ? schema : { type: "json_schema", json_schema: { name: "bug_to_proof", strict: true, schema } });
  });
  it("retains Ollama token and timing measurements and explicit generation limits", async () => {
    let body: any;
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      body = JSON.parse(init.body);
      return new Response(JSON.stringify({ message: { content: '{"ok":true}' }, done: true,
        prompt_eval_count: 12, eval_count: 4, total_duration: 3e9, load_duration: 1e9,
        prompt_eval_duration: 5e8, eval_duration: 1e9, secret: "not-retained" }));
    }));
    const result = await callLLMWithDiagnostics("JSON please", 1000, undefined, 100,
      { apiUrl: "http://127.0.0.1:11435", protocol: "ollama", model: "local", contextTokens: 16384, jsonMode: true } as any);
    expect(body.options).toMatchObject({ temperature: 0, num_predict: 100, num_ctx: 16384 });
    expect(body.format).toBe("json");
    expect(result).toMatchObject({ usage: { inputTokens: 12, outputTokens: 4, totalTokens: 16 }, timings: { totalMs: 3000, loadMs: 1000, promptEvalMs: 500, evalMs: 1000 } });
    expect(JSON.stringify(result)).not.toContain("not-retained");
  });
  it("does not invent usage when a provider omits or corrupts counters", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ choices: [{ message: { content: "{}" } }], usage: { prompt_tokens: -1, completion_tokens: "5" } }))));
    const result = await callLLMWithDiagnostics("JSON please", 1000, undefined, 100, { apiUrl: "https://example.invalid/v1", protocol: "openai", model: "hosted", apiKey: "placeholder" });
    expect(result).not.toHaveProperty("usage");
  });
  it("allows a bounded CPU inference timeout and explicit context/output settings", () => {
    vi.stubEnv("RAG_TIMEOUT_MS", "600000");
    vi.stubEnv("RAG_GENERATION_CONTEXT_TOKENS", "16384");
    vi.stubEnv("RAG_GENERATION_MAX_OUTPUT_TOKENS", "2048");
    expect(ragConfig()).toMatchObject({ timeoutMs: 600000, generationContextTokens: 16384, generationMaxOutputTokens: 2048 });
    vi.stubEnv("RAG_TIMEOUT_MS", "600001");
    expect(() => ragConfig()).toThrow(/RAG_TIMEOUT_MS/);
  });
});
