// #region all
import { AXEClient, discover, isOk, isNeedsHuman, isError } from "@axe/client";

// Start from any URL on the site. discover() tries /.well-known/axe.json, then /axe/manifest,
// then the AXE-Manifest header, then <link rel="axe-manifest"> in the page.
const { manifest, manifestUrl, via } = await discover("https://oakridge-rentals.example");
console.log(`${manifest.name}: ${manifest.actions.length} actions (manifest at ${manifestUrl}, via ${via})`);

const client = new AXEClient(manifest, {
  // Sent as context.agent and as the User-Agent. vendor is what policies.agents matches.
  agent: {
    name: "homefinder",
    version: "2.3.0",
    vendor: "Homefinder Labs",
    contact: "https://homefinder.example/agent",
  },
  locale: "en-US",
  timezone: "America/Los_Angeles",
  // Retries after rate_limited and unavailable, honoring Retry-After up to maxRetryAfterMs.
  retries: 2,
  maxRetryAfterMs: 15_000,
});

// Sites can allow or deny vendors. Check before the first call, not after a refusal.
if (!client.allowed()) {
  throw new Error(`${manifest.name} does not accept agents from Homefinder Labs`);
}

// One action's definition: description, schemas, risk, display, affordances.
const search = client.action("units.search");
console.log(search?.description);

// invoke() returns the result envelope. For mutating actions the client adds an
// idempotencyKey automatically; pass your own to make a retry replay the original.
const result = await client.invoke("units.search", {
  location: "Bellevue, WA",
  bedrooms: 1,
  maxRentUsd: 3200,
});

if (isOk(result)) {
  console.log(JSON.stringify(result.output, null, 2));
} else if (isNeedsHuman(result)) {
  console.log(result.handoff.whatAgentShouldSayToUser);
} else if (isError(result)) {
  console.error(`${result.error.code}: ${result.error.message}`);
}
// #endregion all
