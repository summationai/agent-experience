# Security policy

## Reporting a vulnerability

Email the maintainers at the address in the repository's package metadata with a description, reproduction steps, and the affected package and version. You will get an acknowledgment within three business days and a fix or a mitigation plan within thirty days for confirmed issues. Please do not open a public issue until a fix is released.

## Scope

In scope: `@axe/core`, `@axe/client`, `@axe/mcp`, the adapters, `@axe/testing`, and the `axe` CLI as published from this repository, plus the protocol as specified in `spec/`.

Out of scope: sites built with the SDK (report to them), agents built with the client (report to them), and the example domains in `docs/examples/`, which are fictional.

## What the SDK guarantees

- Continuation, resume, and poll tokens are HMAC-SHA256 signed, bound to action, input hash, acting user, and tenant, expire, and are single-use.
- Server-side `state` never crosses the wire.
- Sensitive payloads are never logged by the SDK and never appear in events.
- Thrown exceptions never reach agents; they are replaced with a generic `internal` error and delivered to `onError`.
- `context.onBehalfOf` from the request body is never trusted; identity comes from `authenticate` or the adapter.
- The reference HTML renderer escapes every value, validates every URL, and contains a single static script that reads only `data-*` attributes.

## What the SDK does not guarantee

- Authorization of actions. Your handler must apply the same checks your UI applies.
- Rate limiting. Declare `policies.rateLimit` and enforce it at your edge.
- Transport security. Serve over HTTPS; the protocol requires it.
- Behavior of agents. The honesty rules in the spec are enforced where they can be detected (`axe audit`); agents are expected to rank against sites that lie.

The full threat model is in `docs/security.md`.
