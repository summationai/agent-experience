# `@summationai/axe-host`

Runs an application in a private browser session for the identity an agent authenticated as, injects a scoped relay connection, and serves the page’s live Surface without pairing.

`createHost` is application-neutral. Provider services supply trusted connector configuration and session adapters; application behavior comes from the page’s Surface.

See [Host](https://github.com/summationai/agent-experience/blob/main/docs/host.md) and the [application/provider boundary](https://github.com/summationai/agent-experience/blob/main/docs/architecture.md).
