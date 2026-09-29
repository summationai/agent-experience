// #region refresh
import { AXEClient } from "@summationai/axe-client";

const client = await AXEClient.discover("https://oakridge-rentals.example", {
  // Never use a manifest older than two minutes, or the site's Cache-Control max-age if shorter.
  manifestMaxAgeMs: 120_000,
});

client.onManifestChange(({ added, removed, modified }) => {
  console.log(`actions added ${added}, removed ${removed}, changed ${modified}`);
});

// Before building tools for a new turn: revalidate if stale (a conditional GET, usually a 304).
await client.ensureFresh();

// Or refresh now, whatever the age.
const change = await client.refresh();
if (change.changed) console.log(`now ${change.manifest.actions.length} actions`);
// #endregion refresh
