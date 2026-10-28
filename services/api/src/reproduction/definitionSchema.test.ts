import { describe, expect, it } from "vitest";
import { PATCH_JSON_SCHEMA, REPRODUCTION_JSON_SCHEMA, normalizeStructuredDefinition } from "./definitionSchema";
describe("generation schemas supplement the complete execution protocol", () => {
  it("uses unique action discriminators and normalizes only optional wire nulls", () => {
    const schema = REPRODUCTION_JSON_SCHEMA as any;
    for (const variants of [schema.properties.steps.items.anyOf, schema.properties.assertion.anyOf]) {
      const tags = variants.map((item: any) => item.properties.type.enum[0]);
      expect(new Set(tags).size).toBe(tags.length);
    }
    expect(JSON.parse(normalizeStructuredDefinition(JSON.stringify({ steps: [{ type: "click", within: null }, { type: "fill", text: null }], assertion: { type: "countEquals", name: null } })))).toEqual({ steps: [{ type: "click" }, { type: "fill", text: null }], assertion: { type: "countEquals" } });
    expect(normalizeStructuredDefinition("invalid")).toBe("invalid");
    const oversized = " ".repeat(32_000) + "{}";
    expect(normalizeStructuredDefinition(oversized)).toBe(oversized);
  });
  it("covers every action and assertion tag, including contextual and relational forms", () => {
    const schema = REPRODUCTION_JSON_SCHEMA as any;
    const tags = (variants: any[]) => [...new Set(variants.map(item => item.properties.type.enum[0]))].sort();
    expect(tags(schema.properties.steps.items.anyOf)).toEqual(["click", "clickTarget", "fill", "fillTarget", "goto", "reload", "selectOption", "waitForTargetVisible", "waitForVisible"].sort());
    expect(tags(schema.properties.assertion.anyOf)).toEqual(["accessibleAttributeEquals", "countEquals", "currencyEquals", "numberEquals", "targetCurrencyEquals", "targetCurrencySumEquals", "targetNumberEquals", "targetTextEquals", "targetVisibilityEquals", "urlPathEquals", "visibilityEquals", "visibleTextEquals"].sort());
    expect(schema.required).toEqual(["schemaVersion", "title", "startPath", "preconditions", "steps", "assertion", "rationale", "reportMapping"]);
  });
  it("makes all object fields explicit and disallows invented root keys in both schemas", () => {
    const visit = (node: any) => {
      if (!node || typeof node !== "object") return;
      if (node.type === "object") {
        expect(node.additionalProperties).toBe(false);
        expect(node.required).toEqual(Object.keys(node.properties));
      }
      for (const value of Object.values(node)) {
        if (Array.isArray(value)) value.forEach(visit); else visit(value);
      }
    };
    visit(REPRODUCTION_JSON_SCHEMA); visit(PATCH_JSON_SCHEMA);
    expect((PATCH_JSON_SCHEMA as any).required).toEqual(["diagnosis", "assumptions", "rationale", "edits"]);
  });
});
