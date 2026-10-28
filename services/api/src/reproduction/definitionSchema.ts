import { ROLES, REPRODUCTION_DEFINITION_LIMITS } from "./definitionCompiler";
type Schema = Record<string, unknown>;
export const schemaObject = (properties: Record<string, Schema>): Schema => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const string: Schema = { type: "string" };
const number: Schema = { type: "number" };
const integer: Schema = { type: "integer" };
const boolean: Schema = { type: "boolean" };
const tag = (value: string): Schema => ({ type: "string", enum: [value] });
const role: Schema = { type: "string", enum: [...ROLES] };
const shape = (type: string, properties: Record<string, Schema> = {}) => schemaObject({ type: tag(type), ...properties });
const array = (items: Schema): Schema => ({ type: "array", items });
const within = schemaObject({ kind: tag("product"), productId: integer });
const nullable = (schema: Schema): Schema => ({ anyOf: [schema, { type: "null" }] });
export const REPRODUCTION_JSON_SCHEMA: Schema = schemaObject({
  schemaVersion: tag("1.0"), title: string, startPath: string,
  preconditions: array({ anyOf: [shape("clearLocalStorage"), shape("seedCart", { productId: integer, quantity: integer })] }),
  steps: array({ anyOf: [
    shape("goto", { path: string }), shape("reload"),
    ...["click", "waitForVisible"].map(type => shape(type, { role, name: string, within: nullable(within) })),
    shape("fill", { label: string, text: string }), shape("selectOption", { label: string, value: string }),
    shape("clickTarget", { testId: string }), shape("fillTarget", { testId: string, text: string }), shape("waitForTargetVisible", { testId: string }),
  ] }),
  assertion: { anyOf: [
    shape("visibleTextEquals", { role, name: string, expected: string }),
    shape("numberEquals", { role, name: string, expected: number }),
    shape("currencyEquals", { role, name: string, expected: number, currency: string }),
    shape("countEquals", { role, name: nullable(string), expected: number }),
    shape("urlPathEquals", { expected: string }), shape("visibilityEquals", { role, name: string, visible: boolean }),
    shape("accessibleAttributeEquals", { role, name: string, attribute: string, expected: string }),
    shape("targetTextEquals", { testId: string, expected: string }), shape("targetNumberEquals", { testId: string, expected: number }),
    shape("targetCurrencyEquals", { testId: string, expected: number, currency: string }),
    shape("targetCurrencySumEquals", { testId: string, terms: array(string), currency: string }),
    shape("targetVisibilityEquals", { testId: string, visible: boolean }),
  ] },
  rationale: string, reportMapping: array(schemaObject({ reportFact: string, definitionPath: string })),
});
// Strict providers require every property. Null encodes an absent optional field
// on the wire; execution still receives the original optional-field protocol.
export function normalizeStructuredDefinition(raw: string): string {
  if (Buffer.byteLength(raw, "utf8") > REPRODUCTION_DEFINITION_LIMITS.maxBytes) return raw;
  let value: any;
  try { value = JSON.parse(raw); } catch { return raw; }
  if (!value || typeof value !== "object" || Array.isArray(value)) return raw;
  if (Array.isArray(value.steps)) for (const step of value.steps) {
    if (step && ["click", "waitForVisible"].includes(step.type) && step.within === null) delete step.within;
  }
  if (value.assertion?.type === "countEquals" && value.assertion.name === null) delete value.assertion.name;
  return JSON.stringify(value);
}
// Shape constraints supplement rather than replace the compiler's bounds and discovery policy.
export const PATCH_JSON_SCHEMA: Schema = schemaObject({
  diagnosis: string, assumptions: array(string), rationale: string,
  edits: array(schemaObject({ relativePath: string, oldContent: string, newContent: string })),
});
