# Installing Surface in the Summation web app

This file is no longer a separate installation prompt. The application integration is intentionally generic so fixes survive package upgrades and apply to every adopter.

For an existing installation, rerun the same generic command after updating the SDK. The installer applies reviewed safe migrations to its generated files and leaves application-specific edits in place; inspect its diff before accepting it.

From the web-app directory, give a coding agent the canonical prompt:

```sh
npx @summationai/axe surface prompt
```

Or preview/apply directly:

```sh
npx @summationai/axe surface init \
  --app-id summation \
  --app-name Summation \
  --mount <application-shell-that-covers-login-and-tenant-selection> \
  --dry-run

npx @summationai/axe surface init \
  --app-id summation \
  --app-name Summation \
  --mount <application-shell-that-covers-login-and-tenant-selection> \
  --yes --install
```

The only Summation-specific installation facts are the connector identity and the appropriate application shell. Wire the profile's `authentication.state` to Summation's existing session source (`unknown` while resolving, `signed-out` on login, and `signed-in` afterward). Login, organization selection, tenant selection, tables, reports, and action safety must otherwise be reported by the Summation Surface as live application state—not described in MCP code or copied into an installation prompt.

Provider-side URL, allowed-origin, OAuth, optional session-broker configuration, and the secure interactive-browser handoff belong in the Agent Experience service and connector registry. None is installed into the Summation repository.
