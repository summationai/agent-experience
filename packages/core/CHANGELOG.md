# @summationai/axe-core

## 1.1.0

### Minor Changes

- `@summationai/axe-core/agent-site`: the site's side of the agent web, for the site's own server. `agentSiteHandler` serves `/agent` (on to the agent web's `/start`), `/agent/signin`, `/agent/approve/<id>`, and `/agent/input/<id>`, signed in with the site's own session, with nonce-signed forms and a shared-secret site API. `agentEntry(request)` sends a recognized agent (Claude's browser, `Claude-User`, `ChatGPT-User`, `Google-Agent`, `Perplexity-User`, or a signed agent) that opens the site from outside on to `/agent`; people and navigation within the site are untouched.
