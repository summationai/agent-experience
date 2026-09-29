// #region egress
import { AXEClient } from "@summationai/axe-client";
import type { DestinationRequest } from "@summationai/axe-client";

// A client running inside an MCP server on a company network. The site is untrusted, and the
// server's network access is not the site's to borrow. Every outbound URL, redirects included,
// passes through destinationPolicy after the built-in origin and scheme checks.
const allowedHosts = new Set(["oakridge-rentals.example", "api.oakridge-rentals.example"]);

function destinationPolicy(request: DestinationRequest): boolean {
  const { protocol, hostname } = new URL(request.url);
  return protocol === "https:" && allowedHosts.has(hostname);
}

export const client = await AXEClient.discover("https://oakridge-rentals.example", {
  auth: () => process.env.OAKRIDGE_TOKEN,
  trust: {
    origins: ["https://api.oakridge-rentals.example"],
    // https everywhere, loopback included: this host is a server, not a laptop.
    allowHttp: false,
    destinationPolicy,
  },
});
// #endregion egress
