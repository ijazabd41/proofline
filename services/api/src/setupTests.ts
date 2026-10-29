import fs from "node:fs";
import path from "node:path";
import { afterAll } from "vitest";

// Configure storage before application modules are imported. Each test file gets
// a fresh store so startup reconciliation cannot touch retained developer runs.
const repositoryRoot = path.resolve(__dirname, "../../..");
const parent = path.join(repositoryRoot, "artifacts", "unit-test-storage");
fs.mkdirSync(parent, { recursive: true });
const storageRoot = fs.mkdtempSync(path.join(parent, "api-"));
const dataRoot = path.join(storageRoot, "data");
const caseRoot = path.join(dataRoot, "cases");
fs.mkdirSync(caseRoot, { recursive: true });
for (const name of [
  "case-001-cart-total.json", "case-001.json", "case-001.seed.json",
  "case-002-repeated-item-qty.json", "case-003-item-removal.json",
  "case-004-cart-clear.json", "case-005-cart-total-quantities.json",
  "case-007-promo-discount.json",
]) {
  fs.copyFileSync(path.join(repositoryRoot, "data", "cases", name), path.join(caseRoot, name));
}
const artifactsRoot = path.join(storageRoot, "artifacts");
fs.mkdirSync(artifactsRoot, { recursive: true });
process.env.DATA_DIR = dataRoot;
process.env.ARTIFACTS_DIR = artifactsRoot;

afterAll(async () => {
  // Only this test file's freshly allocated directory is disposable.
  if (path.dirname(storageRoot) !== parent) throw new Error("Test storage escaped its parent");
  await fs.promises.rm(storageRoot, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 });
});
