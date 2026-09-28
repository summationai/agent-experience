# `@axe/relay`

Carries a page-held `@axe/surface` to an authenticated agent outside the browser. A provider host can inject a scoped connection with no pairing; attended pairing remains a development fallback.

Applications normally do not configure a relay URL. The generated integration reads a provider-injected connection when present and otherwise stays browser-local.

See [Relay](../../docs/relay.md) and the [application/provider boundary](../../docs/architecture.md).
