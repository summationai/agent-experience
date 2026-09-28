[AXE API reference](../../README.md) / @axe/relay

# `@axe/relay`

Carries a page-held `@axe/surface` to an authenticated agent outside the browser. A provider host can inject a scoped connection with no pairing; attended pairing remains a development fallback.

Applications normally do not configure a relay URL. The generated integration reads a provider-injected connection when present and otherwise stays browser-local.

Use `connection.disconnect()` for component or route cleanup. `connection.stop()` is reserved for an explicit user decision to revoke the agent's access.

See [Relay](../../_media/relay.md) and the [application/provider boundary](../../_media/architecture.md).

## Modules

- [cli](cli.md)
- [client](client.md)
- [server](server.md)
- [token](token.md)
