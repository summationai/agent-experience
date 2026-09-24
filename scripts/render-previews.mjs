#!/usr/bin/env node
// Renders the reference toHTML() output for the apartments example and screenshots it into docs/images.
// Requires a Playwright-compatible chromium; pass PLAYWRIGHT_MODULE to point at a playwright install.
import { writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const { resolveDisplay } = await import(join(root, "packages/core/dist/display.js"));
const { toHTML } = await import(join(root, "packages/client/dist/present.js"));
const { tsImport } = await import("tsx/esm/api");
const site = await tsImport(join(root, "docs/examples/apartments/site.ts"), import.meta.url);
const manifest = site.axe.describe();
const search = manifest.actions.find((a) => a.name === "units.search");
const output = {
  units: [
    { id: "u_204", name: "The Meridian 204", address: "10800 NE 8th St, Bellevue", photos: [], humanUrl: "https://oakridge-rentals.example/units/u_204", rentUsd: 2950, bedrooms: 1, bathrooms: 1, sqft: 720, availableFrom: "2026-10-15", petPolicy: "Cats and dogs under 40 lb", parking: "1 garage space included", badges: ["Pet friendly"] },
    { id: "u_118", name: "Lakeview 118", address: "800 Bellevue Way NE, Bellevue", photos: [], humanUrl: "https://oakridge-rentals.example/units/u_118", rentUsd: 3150, bedrooms: 1, bathrooms: 1, sqft: 810, availableFrom: "2026-10-01", petPolicy: "Cats only", parking: "Street", badges: ["Available now"], _axe: { affordances: [{ action: "tours.book", title: "Schedule a tour", input: { unitId: "u_118" } }] } },
    { id: "u_310", name: "Parkside 310", address: "12 108th Ave NE, Bellevue", photos: [], humanUrl: "https://oakridge-rentals.example/units/u_310", rentUsd: 3050, bedrooms: 1, bathrooms: 1.5, sqft: 765, availableFrom: "2026-11-01", petPolicy: "No pets", parking: "Garage, $150/mo", badges: [] },
  ],
  nextCursor: null,
};
const presented = resolveDisplay(search, output, manifest.brand);
const out = join(root, "docs/images");
mkdirSync(out, { recursive: true });
const pages = {
  "preview-cards": toHTML(presented, { heading: "Search available units — Oakridge Rentals" }),
  "preview-table": toHTML(presented, { heading: "Search available units — Oakridge Rentals", layout: "table" }),
};
for (const [name, html] of Object.entries(pages)) writeFileSync(join(out, `${name}.html`), html);

const pw = await import(process.env.PLAYWRIGHT_MODULE ?? "playwright");
const browser = await pw.chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {});
for (const [name, html] of Object.entries(pages)) {
  for (const [suffix, scheme, width] of [["", "light", 1100], ["-dark", "dark", 1100], ["-mobile", "light", 420]]) {
    if (name === "preview-table" && suffix) continue;
    const page = await browser.newPage({ viewport: { width, height: name === "preview-table" ? 420 : 520 }, colorScheme: scheme });
    await page.setContent(html, { waitUntil: "load" });
    await page.screenshot({ path: join(out, `${name}${suffix}.png`), fullPage: true });
    await page.close();
  }
}
await browser.close();
console.log("wrote screenshots to docs/images/");
