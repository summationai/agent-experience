/**
 * Northwind Outfitters: the shop's existing OpenAPI document becomes the agent interface.
 * The document decides names, flags, schemas, and the HTTP calls; the overrides are the author's.
 */
// #region generate
import { readFileSync } from "node:fs";
import { createAXE } from "@axe/core";
import { formatWarnings, fromOpenAPI, generate, registerGenerated } from "@axe/generate";
import type { OpenAPIDocument } from "@axe/generate";

const document = JSON.parse(
  readFileSync(new URL("./openapi.json", import.meta.url), "utf8"),
) as OpenAPIDocument;

export const axe = createAXE({
  name: "Northwind Outfitters",
  description:
    "Search the catalog and place, change, or track orders. Signed-in customers act on their own orders only.",
  baseUrl: "https://shop.northwind.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.northwind.example/login" },
  secret: process.env.AXE_SECRET,
});

const generated = generate(
  [
    fromOpenAPI(document, {
      baseUrl: "https://api.northwind.example/v1",
      // The customer's bearer token travels to the API unchanged; nothing is sent otherwise.
      auth: { forward: true },
    }),
  ],
  {
    // #region overrides
    overrides: {
      // GET /products had no description in the document. Write it here, not in the generator.
      "products.list": {
        description:
          "Searches the catalog by free text. Returns up to 100 products with SKU, name, and price in USD.",
        risk: "none",
        display: {
          kind: "list",
          items: "/result",
          item: { id: "/sku", title: "/name", url: "/url" },
          disclaimer: "Prices exclude tax and shipping.",
        },
      },
      // Not for agents, at least not yet.
      "orders.delete": { exclude: true },
      // No operationId in the document; the derived name reads badly.
      "POST /products/{sku}/reviews": { name: "reviews.create" },
    },
    // #endregion overrides
    // #region policy
    policy: {
      // First rollout: nothing that moves money or cannot be undone.
      maxRisk: "medium",
      exclude: ["*.internal-*", /^admin\./],
    },
    // #endregion policy
  },
);

// Anything left out is a gap in the document, reported with the operation and the field.
const dropped = generated.warnings.filter((w) => w.dropped);
if (dropped.length > 0) console.warn(formatWarnings(dropped));

registerGenerated(axe, generated);

export const handler = axe.fetchHandler();
// #endregion generate
