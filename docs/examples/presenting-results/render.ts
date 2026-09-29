/**
 * Render one `ok` result from units.search three ways: a normalized PresentedResult,
 * a Markdown table for a chat surface, and a self-contained HTML page with affordance buttons.
 * Run it: pnpm --filter body-spray-docs exec tsx examples/presenting-results/render.ts
 */
// #region imports
import { present, toMarkdown, toHTML } from "@summationai/axe-client/present";
import type { Result } from "@summationai/axe-core/types";
import { axe } from "../apartments/site.js";
// #endregion imports

// #region result
// What POST /axe/actions/units.search returned. In an agent this is the value of AXEClient.invoke().
const result: Result = {
  status: "ok",
  output: {
    units: [
      {
        id: "u_204",
        name: "The Meridian 204",
        address: "10800 NE 8th St, Bellevue",
        photos: ["https://oakridge-rentals.example/img/u204-1.jpg"],
        humanUrl: "https://oakridge-rentals.example/units/u_204",
        rentUsd: 2950,
        bedrooms: 1,
        bathrooms: 1,
        sqft: 720,
        availableFrom: "2026-10-15",
        petPolicy: "Cats and dogs under 40 lb",
        parking: "1 garage space included",
        badges: ["Pet friendly"],
      },
      {
        id: "u_118",
        name: "Lakeview 118",
        address: "800 Bellevue Way NE, Bellevue",
        photos: [],
        humanUrl: "https://oakridge-rentals.example/units/u_118",
        rentUsd: 3150,
        bedrooms: 1,
        bathrooms: 1,
        sqft: 810,
        availableFrom: "2026-10-01",
        petPolicy: "Cats only",
        parking: "Street",
        badges: ["Available now"],
        // The applicant already applied here, so the site offers only a tour.
        _axe: {
          affordances: [
            { action: "tours.book", title: "Schedule a tour", input: { unitId: "u_118" } },
          ],
        },
      },
      {
        id: "u_310",
        name: "Parkside 310",
        address: "12 108th Ave NE, Bellevue",
        photos: [],
        humanUrl: "https://oakridge-rentals.example/units/u_310",
        rentUsd: 3050,
        bedrooms: 1,
        bathrooms: 1.5,
        sqft: 765,
        availableFrom: "2026-11-01",
        petPolicy: "No pets",
        parking: "Garage, $150/mo",
        badges: [],
      },
    ],
    nextCursor: null,
  },
};
// #endregion result

// #region render
const manifest = axe.describe();
const search = manifest.actions.find((a) => a.name === "units.search");
if (!search) throw new Error("units.search is not in the manifest");

// 1. Apply display and affordances. Throws unless result.status is "ok".
const presented = present(search, result, manifest.brand);

// 2. A comparison table for a chat surface.
const markdown = toMarkdown(presented);

// 3. A self-contained page. Its buttons dispatch CustomEvent("axe:select") on window.
const html = toHTML(presented, { heading: "1-bedrooms in Bellevue under $3,200" });

console.log(markdown);
console.log(`\n${presented.items.length} items; ${html.length} bytes of HTML`);
// #endregion render
