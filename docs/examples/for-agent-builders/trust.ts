// #region trust
import { AXEClient, AXETrustError } from "@axe/client";

// The site's pages live on oakridge-rentals.example; its manifest names
// baseUrl https://api.oakridge-rentals.example. The token goes to the origin you discovered
// from and to the origins you list, nowhere else. Without the `origins` entry,
// AXEClient.discover throws AXETrustError instead of sending the token to the API origin.
try {
  const client = await AXEClient.discover("https://oakridge-rentals.example", {
    auth: () => process.env.OAKRIDGE_TOKEN,
    trust: { origins: ["https://api.oakridge-rentals.example"] },
  });
  await client.invoke("units.search", { location: "Bellevue, WA" });
} catch (e) {
  // Nothing was sent to e.url. Tell the operator; do not widen trust because a site asked.
  if (e instanceof AXETrustError) console.error(`Refused ${e.kind} request to ${e.url}`);
  else throw e;
}
// #endregion trust
