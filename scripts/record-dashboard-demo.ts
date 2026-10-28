import fs from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { spawnSync } from "child_process";
import { runTest } from "../services/api/src/runner/playwrightRunner";
import { WORKSPACE_ROOT } from "../services/api/src/utils/paths";

const source = String.raw`
import { test, expect as baseExpect } from "@playwright/test";
const expect = baseExpect.configure({ timeout: 30000 });
test.use({ viewport: { width: 1440, height: 1000 }, video: { mode: "on", size: { width: 1440, height: 1000 } } });
test.setTimeout(240000);
test("Proofline dashboard: report entry and retained reference evidence", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  const pause = (ms = 1800) => page.waitForTimeout(ms);
  const capture = async (name: string) => {
    const file = info.outputPath(name + ".png");
    await page.screenshot({ path: file, fullPage: true });
    await info.attach(name, { path: file, contentType: "image/png" });
  };
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Investigations." })).toBeVisible();
  await pause(2500);
  await page.getByRole("searchbox", { name: "Search cases" }).pressSequentially("Cart total", { delay: 100 });
  await pause();
  await capture("01-register");
  await page.getByRole("searchbox", { name: "Search cases" }).fill("");
  await page.getByRole("button", { name: "New report" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await pause();
  const fields = [
    ["bug-title", "Cart total only counts the first product"],
    ["bug-description", "Adding a Keyboard and Mouse Pad shows only the first product price instead of their combined total."],
    ["bug-steps", "Open MiniShop with an empty cart.\nAdd one Keyboard ($10).\nAdd one Mouse Pad ($20).\nCheck the cart total."],
    ["bug-expected", "Cart total should be $30.00 ($10 + $20)."],
    ["bug-actual", "Cart total shows $10.00; the second product is ignored."],
    ["bug-start-path", "/"],
    ["bug-context", "Dashboard recording: this report describes the seeded reference defect, not a newly verified failure on current MiniShop."],
  ];
  for (const [id, value] of fields) {
    const field = page.locator("#" + id);
    await field.scrollIntoViewIfNeeded();
    await field.click();
    await field.pressSequentially(value, { delay: 24 });
    await pause(450);
  }
  await capture("02-completed-report");
  await pause(2200);
  const createdResponse = page.waitForResponse(response => response.url().endsWith("/api/cases") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create case", exact: true }).click();
  const response = await createdResponse;
  expect(response.status()).toBe(201);
  const created = await response.json();
  await expect(page).toHaveURL(new RegExp("/cases/" + created.id + "$"));
  await expect(page.getByRole("heading", { name: created.title, exact: true })).toBeVisible();
  await info.attach("created-report", { body: Buffer.from(JSON.stringify({ id: created.id, title: created.title, status: created.status })), contentType: "application/json" });
  await pause(3000);
  await capture("03-saved-case");
  await page.mouse.wheel(0, 600);
  await pause(2500);
  // A separate, genuinely retained reference case; no statuses or responses are mocked.
  await page.goto("/cases/case-1791917776888-hvza72c3");
  await expect(page.getByRole("heading", { name: "Cart total omits the shipping charge", exact: true })).toBeVisible();
  await pause(3000);
  await capture("04-existing-evidence");
  const comparison = page.getByRole("heading", { name: "Before / After Comparison" });
  await comparison.scrollIntoViewIfNeeded();
  await pause(3500);
  await page.getByRole("heading", { name: "Debugging & AI Repair Assistant" }).scrollIntoViewIfNeeded();
  await pause(3000);
  const bundle = page.getByRole("link", { name: "Download Proof Bundle (.zip)" });
  await expect(bundle).toBeVisible({ timeout: 15000 });
  await bundle.scrollIntoViewIfNeeded();
  await pause(3000);
  await capture("05-proof-export");
  expect(errors).toEqual([]);
});
`;

function findVideos(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? findVideos(path.join(dir, entry.name))
    : entry.name.endsWith(".webm") ? [path.join(dir, entry.name)] : []);
}

async function main() {
  const id = randomUUID();
  const dir = path.join(WORKSPACE_ROOT, "artifacts/dashboard-recording", id);
  const file = path.join(WORKSPACE_ROOT, `tests/playwright/cases/dashboard-recording-${id}.spec.ts`);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(file, source, { flag: "wx" });
  try {
    const result = await runTest("dashboard-recording", path.relative(WORKSPACE_ROOT, file), "after", {
      targetUrl: "http://localhost:5173", artifactDir: dir, timeoutMs: 270000,
    });
    fs.writeFileSync(path.join(dir, "executed.spec.ts"), source);
    fs.writeFileSync(path.join(dir, "recording-report.json"), JSON.stringify(result, null, 2));
    if (!result.passed) throw new Error(`Recording failed: ${result.outcome}: ${result.actual}. Evidence: ${dir}`);
    const videos = findVideos(dir);
    if (videos.length !== 1) throw new Error(`Expected one video, found ${videos.length}`);
    const output = path.join(WORKSPACE_ROOT, "docs/evidence/portfolio/proofline-dashboard-demo.mp4");
    fs.writeFileSync(path.join(dir, "scope.txt"), "Real Proofline dashboard: new report entry, then a separate saved reference case.\nReference repair proposal is deterministic; no live-model repair is performed in this recording.");
    const filter = "pad=1440:1080:0:0:color=0x111827,drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='Real dashboard - new report followed by a separate saved reference case':fontcolor=white:fontsize=23:x=25:y=1010,drawtext=fontfile='C\\:/Windows/Fonts/segoeui.ttf':text='Reference proposal is deterministic - no live-model repair is performed':fontcolor=white:fontsize=23:x=25:y=1045";
    const converted = spawnSync("ffmpeg", ["-y", "-hide_banner", "-loglevel", "error", "-i", videos[0], "-vf", filter, "-c:v", "libx264", "-crf", "20", "-pix_fmt", "yuv420p", "-movflags", "+faststart", output], { encoding: "utf8", cwd: dir });
    if (converted.status !== 0) throw new Error(converted.stderr || "Video conversion failed");
    console.log(JSON.stringify({ directory: dir, output, outcome: result.outcome, scope: "Real dashboard interactions and saved report; separate retained reference evidence, not live-model repair." }, null, 2));
  } finally { fs.unlinkSync(file); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
