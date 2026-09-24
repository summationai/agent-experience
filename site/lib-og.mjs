// Renders the Open Graph image from an HTML template with Playwright's bundled Chromium.
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";

export async function renderOgImage({ out, template }) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1200, height: 630 },
      deviceScaleFactor: 1,
    });
    await page.goto(pathToFileURL(template).href);
    await page.screenshot({ path: out, type: "png" });
  } finally {
    await browser.close();
  }
}
