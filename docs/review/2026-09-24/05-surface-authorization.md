# 5. Authorization and privacy boundary for the Surface bridge

Phase 1, release-blocking.

## Finding

The review: `surfaceActions` had no auth option; the observe, ledger, and per-control actions it generated all inherited `auth: "none"` from `action()`, so configuring a server's modes as `none,user` did not protect them. Observation exposed field values and domain objects; the ledger captured supplied text.

Reproduced in this checkout at `3dd4ed3` with `createAXE({ auth: { modes: ["none", "user"], authenticate } })` and `axe.addProvider(surfaceActions(surface))` over a surface with a `save` action and an `ssn` field:

- `surfaceActions(surface).actions()` listed `surface.observe`, `surface.ledger`, `surface.save`, `surface.ssn`, each with `auth: "none"` (the review script's "surface auth" case).
- An anonymous `POST /axe/actions/surface.observe` returned `ok` with every entry and the field's value.
- An anonymous `POST /axe/actions/surface.ssn` with `{ text: "999-99-9999" }` returned `ok` and ran the setter as `agent`.
- An anonymous `POST /axe/actions/surface.ledger` returned the act, including `text: "999-99-9999"`.

There was also no way to host one surface per user on a server: the bridge took one surface, so every caller shared its state, values, and ledger.

## Change

`@axe/surface/axe` (`packages/surface/src/axe.ts`):

- `surfaceActions(source, options)` declares `auth` on every action. Options: `auth` (default `user`), `read` (mode of `<ns>.observe` and `<ns>.ledger`, default `auth`), `authFor(entry)` (one entry's mode, undefined keeps `auth`). A mode outside `none`, `site`, `user` throws at construction.
- The default rule: every action the bridge generates carries `auth: "user"` unless the integrator writes otherwise, so a server whose `auth.modes` lacks `user` (including `createAXE`'s public default `{ modes: ["none"] }`) refuses the bridge on its first request through the existing [P-AUTH-1] check, and a surface is public over HTTP only when `auth: "none"` is written.
- `source` may be a resolver `(context: SurfaceContext) => Surface | null | undefined` instead of a surface, with `template` (required) defining the action set. The context is `{ identity, tenant, siteKey, request }` as the runtime established it. Each request resolves once (memoized on the `Request` object); observe, ledger, acts, continue, and resume run against the caller's surface. A resolver returning nothing refuses with `unauthorized` (unidentified caller) or `forbidden` (identified), with no detail about other callers.
- `scopedSurfaces({ create, key?, max?, idleMs?, now?, onEvict? })` returns `{ resolve, keyFor, get, delete, size }`: one surface per key, default key `JSON.stringify([tenant.id ?? null, onBehalfOf ?? "site:<key id>"])` (null without a principal), least recently used evicted beyond `max` (1000), idle surfaces evicted after `idleMs` (30 minutes).
- Availability hooks never read a protected surface for a caller the runtime has not identified; they return `{ available: true }`, the protocol's non-claim, and `auth` says who may call. So the manifest (always anonymous) and anonymous `/axe/state` carry no reasons or values from a protected surface.
- `redactEvent(details, { action, entryId })` rewrites `surface.act` event details; events never carried text or values and still do not.
- Output schemas carry `sensitive` on observed rows and `textHash` on ledger entries.

`@axe/surface` (`packages/surface/src/index.ts`, additive, outside `act()` except one line in its ledger `record` closure):

- `FieldEntry.sensitive`: the row carries `sensitive: true` and no `value` in `observe()` (so also through `expose` and `<ns>.observe`); `describeEntry` says `value hidden`; the ledger never keeps its text.
- `createSurface({ ledger: { max, text: "keep" | "hash" | "omit", redact } })`; `LedgerEntry.textHash` (hex SHA-256, a synchronous in-package implementation so the browser bundle stays free of Node built-ins). The policy applies to every ledger write: ok, refusals, and thrown handlers. An unresolved target is treated as sensitive while any sensitive entry is registered.
- Types `LedgerOptions`, `LedgerTextPolicy`; `ObservedEntry.sensitive`.

Spec: `spec/SURFACE.md` v0.5, new §6.1 with [S-AUTH-1] to [S-AUTH-6] and [S-PRV-1] to [S-PRV-3]; [S-LED-1] (text policy) and [S-DOM-2] (browser-local) updated; changes line and provenance. Vocabulary rows: `scopedSurfaces`, `authFor`, `redactEvent`, `idleMs`, `onEvict`, `keyFor`, `textHash`, and the `sensitive` row extended.

Docs: `docs/surface.md` ("Serving a surface" says protected by default; new "Who can observe and act" with modes, the anonymous-versus-caller table, one surface per user, sensitive values); `docs/examples/surface/access.ts` (new), `serve.ts`, `events.ts`, and `docs/examples/live-state/surface.ts` pass `auth: "user"` explicitly; `docs/security.md` (threat paragraph and a mitigations row); `DECISIONS.md` (four paragraphs in Surface); `CHANGELOG.md`.

What `/.well-known/axe.json` shows anonymously versus `/axe/state` per caller:

- Single protected surface: the manifest lists every entry action (title = entry name, effect metadata) with `availability: { available: true }`; entry names are public there. Anonymous `/axe/state` reports `{ available: true }` for every protected action; a signed-in caller's `/axe/state` reports the surface's reasons. The manifest's `live.rev` still carries the server revision when `revision: surface.currentRev` is set (a counter, no content).
- Scoped: the manifest lists the template's actions only; no caller's names, ids, values, or reasons. Each signed-in caller's `/axe/state`, observe, and ledger come from that caller's surface.

Migration: a consumer that wants to stay public passes `auth: "none"` (the planning app's harness: `addProvider(surfaceActions(surface, { namespace: "grid", auth: "none" }))` with its `auth: { modes: ["none"] }`); without it that harness now fails on its first request with `auth "user" is not in manifest auth.modes [none]`. A consumer with signed-in users adds `user` to `auth.modes` and keeps the default. Existing tests in `packages/surface/test/axe.test.ts` pass `auth: "none"` in their helper.

## Tests

`packages/surface/test/auth.test.ts`, every protected path over HTTP through `axe.handle(new Request(...))`. Thirteen of the fourteen fail on the unfixed source (checked by stashing `packages/surface/src`); the fourteenth, the public case, passes on both by design.

- every generated action defaults to auth user, and a public server refuses the provider rather than serving it
- an anonymous request cannot observe, read the ledger, or act on a protected surface; a signed-in user can (401 `unauthorized` for observe, ledger, a field, an action; no handler ran; empty ledger; anonymous manifest and `/axe/state` contain neither the value nor a reason)
- with a login page configured, an anonymous act is a login handoff and nothing runs
- the read side and each entry can take their own mode: public observe, protected mutations, one public control
- site mode: no key is unauthorized, a key outside its allowlist is forbidden, a valid key acts
- an explicitly public surface works as before
- two users see only their own state, values, and ledger; anonymous callers get nothing
- the same user on two tenants gets two surfaces
- the cache is bounded by size and by idle time, and a caller with no scope is refused
- a resolver without a template is refused at construction
- a sensitive field's value never appears in observe, describeEntry, or the DOM mirror, locally or over HTTP
- the typed text of a sensitive field is not in the ledger or the action events, for acts that ran and acts that were refused (ok, `invalid_input`, surface `conflict`, unresolved numeric target)
- the ledger's text policy: keep by default, omit, hash, and a redact function
- redactEvent rewrites the details of every surface.act event, run or refused

## Limitations

- The manifest is one document for everyone ([P-LIVE-7]); with a single protected surface its entry names are public. Private names need the scoped form with a template.
- With a resolver, the server's `revision` provider cannot see the caller (`RevisionContext` has `request` and `tenant`, no identity), so envelopes carry no `rev` unless the application's provider resolves the caller itself; each surface's own guard checks `expectedRev`.
- The availability context carries no site key, so a `site` caller without a user identity gets the non-claim `{ available: true }` in `/axe/state` for protected entries; `observe` works for it.
- Continue and resume resolve the caller's surface again from the re-established identity. They land on the right surface only if the runtime refuses a token presented by another principal or tenant; item 1 (token binding) and item 7 (site principals) own that.
- `sensitive` applies to fields. An action's free `text` is kept by the ledger policy, and a `requires` ladder stores the act request (including `text`) in continuation token state.
- `setObjects` is the application's; the bridge does not redact domain objects.
- A `hash` links equal texts and does not hide guessable ones.
- `llms.txt` is not updated here (see the report for the wording it needs).

## Status

Done on `review/surface-auth`.
