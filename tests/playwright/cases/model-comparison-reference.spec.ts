import { test, expect } from "@playwright/test";
import { comparisonFixtures } from "../../../data/evals/model-comparison-fixtures";
const selected = process.env.BTP_COMPARISON_CASE;
for (const fixture of comparisonFixtures.filter(item => !selected || item.id === selected)) {
  test(`comparison reference ${fixture.id}`, async ({ page }, info) => {
    await page.goto("/");
    if (fixture.id === "cmp-webcam-quantity" || fixture.id === "cmp-webcam-name") await page.getByTestId("add-to-cart-4").click();
    const target = page.getByTestId(fixture.expectedTarget);
    await expect(target).toBeVisible();
    const actual = (await target.innerText()).trim();
    const expected = typeof fixture.expectedValue === "number" ? `$${fixture.expectedValue.toFixed(2)}` : fixture.expectedValue;
    await page.screenshot({ path: info.outputPath("reference.png") });
    await info.attach("btp-assertion", { body: Buffer.from(JSON.stringify({ expected, actual })), contentType: "application/json" });
    expect(actual, "BTP_ASSERTION: report-specific reference expectation").toBe(expected);
  });
}
