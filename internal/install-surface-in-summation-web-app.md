# Installing Surface in the Summation web app

This file is no longer a separate installation prompt. The application integration is intentionally generic so fixes survive package upgrades and apply to every adopter.

From the web-app directory, give a coding agent the canonical prompt:

```sh
npx axe surface prompt
```

Or preview/apply directly:

```sh
npx axe surface init \
  --app-id summation \
  --app-name Summation \
  --mount <application-shell-that-covers-login-and-tenant-selection> \
  --dry-run

npx axe surface init \
  --app-id summation \
  --app-name Summation \
  --mount <application-shell-that-covers-login-and-tenant-selection> \
  --yes --install
```

The only Summation-specific installation facts are the connector identity and the appropriate application shell. Login, organization selection, tenant selection, tables, reports, and action safety must be reported by the Summation Surface as live application state—not described in MCP code or copied into an installation prompt.

Provider-side URL, allowed-origin, OAuth, and session-broker configuration belongs in the Agent Experience connector registry. It is not installed into the Summation repository.
