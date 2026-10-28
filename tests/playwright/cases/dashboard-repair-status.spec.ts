import { test, expect } from "@playwright/test";
test.skip(process.env.CASE_ID !== "dashboard-repair-status", "Run through scripts/verify-dashboard-repair-status.ts against the saved dashboard case.");

test("latest saved repair drives workflow and comparison", async ({ page }, info) => {
  test.setTimeout(90000);
  await page.goto("/cases/case-1791834872639-wdq7dsy2");
  const workflow = page.getByRole("list", { name: "Repair workflow" });
  await expect(workflow.locator('[aria-current="step"]')).toContainText("Verify", { timeout: 30000 });
  const comparison = page.locator(".verification-overview");
  await expect(comparison).toContainText("Baseline / Post-Patch Evidence");
  await expect(comparison).toContainText("BUG REPRODUCED");
  await expect(comparison).toContainText("ALL GATES PASSED");
  await expect(comparison).toContainText("candidate verified");
  await expect(comparison).not.toContainText("Not run yet.");
  await expect(page.getByText("Baseline Evidence (before patch)", { exact: true })).toBeVisible();
  await expect(page.getByText("Before Evidence", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: info.outputPath("verified-dashboard.png"), fullPage: true });
  await page.reload();
  await expect(workflow.locator('[aria-current="step"]')).toContainText("Verify", { timeout: 30000 });
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 });
    const checks = page.getByRole("heading", { name: "Independent Verification Checks" }).locator("..");
    await expect(checks).toBeVisible();
    expect(await checks.evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
  }
});
