/**
 * Regenerates docs/terra-showcase.{png,html} from the running player.
 *
 *   pnpm --filter @webforms/cerner-player dev      # in one shell
 *   node packages/cerner-player/scripts/snapshot-terra-showcase.mjs
 *
 * The HTML snapshot is self-contained: in dev, Vite injects every CSS module
 * as a <style> tag whose class hashes match the rendered markup, so
 * serialising the live document keeps Terra's styling intact. Rendering the
 * markup separately (e.g. via renderToStaticMarkup in a test) does NOT —
 * those hashes come from a different pipeline and bind to nothing.
 *
 * Set CHROME_PATH to use a specific browser binary.
 */
import { chromium } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const DOCS = resolve(HERE, "../docs");
const PORT = process.env.PLAYER_PORT ?? "5209";
const URL_ =
  `http://localhost:${PORT}/?render=terra&theme=cerner` +
  `&documentUrl=./forms/terra-showcase.json`;

const browser = await chromium.launch(
  process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {},
);
const page = await browser.newPage({
  viewport: { width: 1100, height: 900 },
  deviceScaleFactor: 2,
});
await page.goto(URL_, { waitUntil: "networkidle" });
await page.waitForSelector('[data-terra-control="table"]', { timeout: 30_000 });

const stats = await page.evaluate(() => {
  const stamped = [...document.querySelectorAll("[data-terra-control]")];
  return {
    stamps: stamped.length,
    kinds: [...new Set(stamped.map((n) => n.dataset.terraControl))].sort(),
    tableCols: document.querySelectorAll("[data-terra-control=table] thead th").length,
    scopedHeaders: document.querySelectorAll("[data-terra-control=table] th[scope=col]").length,
  };
});
console.log(JSON.stringify(stats, null, 2));

mkdirSync(DOCS, { recursive: true });
await page.screenshot({ path: resolve(DOCS, "terra-showcase.png"), fullPage: true });

const html = await page.evaluate(() => {
  document.querySelectorAll("script").forEach((n) => n.remove());
  document
    .querySelectorAll("input,textarea,select")
    .forEach((n) => n.setAttribute("disabled", ""));
  return `<!doctype html>\n${document.documentElement.outerHTML}`;
});
writeFileSync(resolve(DOCS, "terra-showcase.html"), html);
console.log(`wrote docs/terra-showcase.{png,html} (${html.length} bytes html)`);

await browser.close();
