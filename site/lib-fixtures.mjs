// Captures real protocol data for the landing page by running the docs' apartment example
// in-process: the ladder envelopes (both paths), the reference toHTML() rendering of the
// Bellevue search, and an actual `axe audit` report. Randomness and the clock are pinned so
// the build is reproducible byte for byte.
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { readFileSync } from "node:fs";
import { highlight } from "./lib-render.mjs";
import { extractRegion } from "./build.mjs";

const FIXED_NOW = Date.parse("2026-10-01T17:00:00Z");
const FIXED_SECRET = "site-build-fixture-secret-0123456789";

function pinDeterminism() {
  const realNow = Date.now;
  const realUuid = globalThis.crypto.randomUUID.bind(globalThis.crypto);
  let tick = 0;
  let counter = 0;
  Date.now = () => FIXED_NOW + tick++ * 0;
  globalThis.crypto.randomUUID = () => {
    counter++;
    const hex = counter.toString(16).padStart(12, "0");
    return `00000000-0000-4000-8000-${hex}`;
  };
  return () => {
    Date.now = realNow;
    globalThis.crypto.randomUUID = realUuid;
  };
}

const UNITS = [
  {
    id: "u_204",
    name: "The Meridian 204",
    address: "10800 NE 8th St, Bellevue",
    photos: [],
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
    _axe: {
      affordances: [{ action: "tours.book", title: "Schedule a tour", input: { unitId: "u_118" } }],
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
];

const ACH = {
  accountHolderName: "Dana Whitfield",
  routingNumber: "125000024",
  accountNumber: "000123454471",
  accountType: "checking",
  amount: 500,
  currency: "USD",
  authorizedAt: "2026-10-01T17:00:00Z",
  authorizationText:
    "I authorize Oakridge Rentals to debit $500.00 as a refundable holding deposit.",
};

export async function captureFixtures({ root, highlighter }) {
  const restore = pinDeterminism();
  try {
    process.env.AXE_SECRET = FIXED_SECRET;
    const { tsImport } = await import("tsx/esm/api");
    const site = await tsImport(
      pathToFileURL(join(root, "docs/examples/apartments/site.ts")).href,
      import.meta.url,
    );
    const { resolveDisplay } = await import(
      pathToFileURL(join(root, "packages/core/dist/display.js")).href
    );
    const { toHTML } = await import(
      pathToFileURL(join(root, "packages/client/dist/present.js")).href
    );
    const { runAudit, formatAuditHtml } = await import(
      pathToFileURL(join(root, "packages/testing/dist/index.js")).href
    );
    const axe = site.axe;
    const manifest = axe.describe();
    const base = manifest.baseUrl;
    const AUTH = { Authorization: "Bearer sess_dana" };

    const call = async (method, path, body, headers = {}) => {
      const init = { method, headers: { "content-type": "application/json", ...headers } };
      if (body !== undefined) init.body = JSON.stringify(body);
      const res = await axe.handle(new Request(`${base}${path}`, init));
      return { status: res.status, body: await res.json() };
    };
    const pretty = (v) => JSON.stringify(v, null, 2);
    const step = (caption, request, response, extra = {}) => ({
      caption,
      status: response?.status ?? null,
      request: request
        ? { title: request.title, html: highlight(highlighter, pretty(request.body), "json") }
        : null,
      response: response ? { html: highlight(highlighter, pretty(response), "json") } : null,
      ...extra,
    });

    // Path A: the agent fulfills from its wallet.
    const submitReq = {
      input: { unitId: "u_204" },
      idempotencyKey: "00000000-0000-4000-8000-0000000000a1",
      context: { agent: { name: "AcmeAgent", version: "2.1.0", vendor: "Acme" } },
    };
    const a1 = await call("POST", "/axe/actions/applications.submit", submitReq, AUTH);
    const a2 = await call(
      "POST",
      "/axe/continue",
      { continuationToken: a1.body.continuationToken, kind: "payment.ach-debit", payload: ACH },
      AUTH,
    );
    // Path B: nothing in the wallet, human pays on the site, agent resumes.
    const b1 = await call(
      "POST",
      "/axe/actions/applications.submit",
      {
        ...submitReq,
        input: { unitId: "u_310" },
        idempotencyKey: "00000000-0000-4000-8000-0000000000b1",
      },
      AUTH,
    );
    const b2 = await call(
      "POST",
      "/axe/resume",
      { resumeToken: b1.body.fallback.resumeToken },
      AUTH,
    );

    const ladder = {
      wallet: [
        step(
          "The agent calls the action the user picked. The request carries an idempotency key because the action changes state.",
          { title: "POST /axe/actions/applications.submit", body: submitReq },
          null,
        ),
        step(
          "The site cannot finish: a deposit is due and it only takes bank transfers. It asks the agent first, listing two kinds it accepts, and attaches a fallback handoff in case the agent has neither.",
          null,
          a1.body,
        ),
        step(
          "The agent holds an ACH authorization in its wallet. The option is marked sensitive, so it confirms with the user, then continues with the token and a payload matching the kind's schema.",
          {
            title: "POST /axe/continue",
            body: {
              continuationToken: a1.body.continuationToken,
              kind: "payment.ach-debit",
              payload: ACH,
            },
          },
          null,
        ),
        step(
          "The site validates the payload against the schema it offered, settles the deposit, and submits the application. The token is now consumed.",
          null,
          a2.body,
        ),
      ],
      handoff: [
        step(
          "Same action, same requirement.",
          {
            title: "POST /axe/actions/applications.submit",
            body: {
              ...submitReq,
              input: { unitId: "u_310" },
              idempotencyKey: "00000000-0000-4000-8000-0000000000b1",
            },
          },
          null,
        ),
        step(
          "The agent can satisfy neither kind. Because the result carries a fallback, it goes straight to the human: it says whatAgentShouldSayToUser, sends them to the url, and keeps the resumeToken.",
          null,
          b1.body,
        ),
        step(
          "The human pays the deposit on the site. The agent resumes with the token it kept; the site's onResume runs with the state it saved.",
          { title: "POST /axe/resume", body: { resumeToken: b1.body.fallback.resumeToken } },
          null,
        ),
        step("Done. Same output as the wallet path, one human step later.", null, b2.body),
      ],
      manifestUrl: `${base}/.well-known/axe.json`,
      unitIds: { wallet: "u_204", handoff: "u_310" },
    };

    // The arc: the reference renderer against the Bellevue result.
    const search = manifest.actions.find((a) => a.name === "units.search");
    const presented = resolveDisplay(search, { units: UNITS, nextCursor: null }, manifest.brand);
    const arcHtml = toHTML(presented, { heading: "Search available units — Oakridge Rentals" });
    const siteSource = readFileSync(join(root, "docs/examples/apartments/site.ts"), "utf8");
    const arcDeclaration = `${extractRegion(siteSource, "display")}\n${extractRegion(siteSource, "affordances")}`;

    // The audit, against the same in-process server.
    const inProcess = (input, init) => {
      const url = new URL(String(input));
      if (url.pathname === "/robots.txt")
        return Promise.resolve(
          new Response(`AXE-Manifest: ${base}/.well-known/axe.json\n`, {
            headers: { "content-type": "text/plain" },
          }),
        );
      if (
        url.pathname === "/" ||
        url.pathname.startsWith("/units/") ||
        url.pathname.startsWith("/applications/")
      ) {
        return Promise.resolve(
          new Response("<html><body>Oakridge Rentals</body></html>", {
            headers: { "content-type": "text/html" },
          }),
        );
      }
      return axe.handle(new Request(url, init));
    };
    const report = await runAudit(base, { fetch: inProcess, auth: "sess_dana" });
    report.generatedAt = "at site build time, against docs/examples/apartments/site.ts";
    const auditHtml = extractAuditBody(formatAuditHtml(report));

    return { ladder, arcHtml, arcDeclaration, auditHtml, auditScore: report.score, manifest };
  } finally {
    restore();
    delete process.env.AXE_SECRET;
  }
}

/** The report's <main> content, with its stylesheet scoped under .audit-embed. */
function extractAuditBody(html) {
  const style = /<style>([\s\S]*?)<\/style>/.exec(html)?.[1] ?? "";
  const main = /<main>([\s\S]*?)<\/main>/.exec(html)?.[1] ?? "";
  const scoped = style
    .replace(/(^|})\s*body\s*\{[^}]*\}/g, "$1")
    .replace(/(^|})\s*main\s*\{/g, "$1 .audit-embed .audit-main{")
    .replace(
      /(^|[},])\s*([.#a-z][^{},]*)\s*(?=\{)/g,
      (m, pre, sel) => `${pre} .audit-embed ${sel.trim()}`,
    )
    .replace(/@media[^{]*\{[\s\S]*?\}\s*\}/g, "");
  const linked = main.replace(
    /href="docs\/([^"#]+)\.md(#[^"]*)?"/g,
    (_m, path, anchor) => `href="docs/${path}.html${anchor ?? ""}"`,
  );
  return `<style>${scoped}</style><div class="audit-main">${linked}</div>`;
}
