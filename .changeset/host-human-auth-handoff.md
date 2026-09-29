---
"@axe/host": minor
"@axe/relay": minor
---

Add a provider-owned, session-bound human authentication view for unattended browsers. A Surface
that reports `signed-out` now pauses the original tool request, lets the verified person interact
with that exact private browser context without putting credentials in MCP, and resumes once a
fresh Surface observation reports `signed-in`. Provider deployments authenticate the handoff page
through OAuth; loopback development uses its configured local identity.

Render the application's standard visible sign-in fields and actions as a clean provider-owned
semantic form, without screenshots, visual imitation, or a remote-control toolbar. Bind every
submission to the exact page and form revision, apply a complete step atomically to the private
browser, and reject stale steps. External identity-provider redirects require a provider OAuth
connector instead of collecting those credentials on the handoff page. Keep framework-only field
remounts from clearing input, wait for the next semantic step to settle, filter password-visibility
controls out of form actions, and render a value-preserving eye control inside password fields. On
successful sign-in, replace the form with a persistent, unambiguous completion state rather than
attempting to close an embedded agent browser.

Serialize status polling and preserve the current form through temporary connection failures. Keep
the completion status available after agent resume, distinguish completion from true expiry, wait
for a submitted application step to settle, and suppress duplicate handoff URLs while the original
page is active.

Prefer the MCP client's native URL handoff over pasting a raw capability URL. Base post-submit
settlement on the form after its input events have enabled dynamic controls, re-read and invoke a
newly available primary submit generically, show staged progress for slow applications, and let an
immediate resume wait briefly for the Surface's signed-in state.

Add `Relay.refresh` so hosts can verify fresh profile state across sign-in navigations.
