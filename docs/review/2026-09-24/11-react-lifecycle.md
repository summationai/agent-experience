# 11. Mounted React behavior

Phase 2.

## Finding

The review said `useSurface` stored the first id in a ref and registered only on the caller's `deps`, and that the React tests rendered static markup, which never runs an effect. Checked on `review/react` at `ce6ef1d` with new mounted tests (`packages/surface/test/react-mounted.test.ts`: `react-dom/client` createRoot and `act` from `react` 18.3 under jsdom). Each hypothesis, with the test that settles it:

| Hypothesis | Result | Test |
| --- | --- | --- |
| An id change leaves the old entry registered or unregisters the wrong one at cleanup | Confirmed. After `old` → `new` the table held `["old"]`; unmount then removed `old` (from the ref) and would have left `new` | an id change moves the registration: the old id leaves, the new id stays until unmount; an id change is the control's new data-surface-id |
| A target change fails to register in the new surface or leaves the entry in the old one | Confirmed, the first half. The new surface stayed empty (the register effect was keyed on `deps` only); the old one was cleaned up, since the unregister effect was keyed on `[target]` | a target change moves the registration to the new surface and out of the old one |
| Handler closures go stale when `deps` omit a value the handler reads | Confirmed. With `count` left out of `deps`, acts after `setCount(5)` and `setCount(7)` saw `[0, 0]`; the same for `edit.set` and `more` (`first:hi`, `first:more`) | an act runs the latest render's handler even when deps leave out what the handler reads; a field's setter and a collection's more are the latest render's too |
| Strict Mode's mount, unmount, mount leaves the registry wrong or reorders rows | Refuted on its own. Three rows under `<StrictMode>` stayed `a, b, c` through a refresh and were gone after unmount. It failed only through the id-change defect (`x` → `y` left `x`) | is safe under Strict Mode: one row per entry, in render order, and none after unmount; an id change under Strict Mode leaves only the new id |
| Ordinary updates move a row ([S-ENT-5]) | Refuted. A re-render with the same `deps` did not move `registryVersion`; refreshing the middle row kept `1 a, 2 b2, 3 c` | re-rendering or refreshing one row keeps every row where it was [S-ENT-5] |
| `useSurfaceProps` misses notifications for `register`, `unregister`, `reconcile` | Confirmed for changes made outside the component: an in-place `register` of the same id by another writer never reached the control, since registration did not notify `onChange` | the control follows register, unregister, and reconcile made outside the component; subscribe [S-OBS-4] › fires after every change a reader could see |
| ... for `setRev` in app mode, where no `bump` happens | Refuted for the control: the hook's own re-render and useSyncExternalStore's post-commit snapshot check carried the change. At the registry, `setRev` and `seedRev` notified nobody | a change in app revision mode with setRev, and no bump, still reaches the control; subscribe [S-OBS-4] |
| ... for `freeze` / `thaw` | Refuted: both notify in both revision modes | freeze and thaw show on the control and leave no attribute behind (surface mode); freeze and thaw show on the control in app revision mode, where the revision does not move |
| Live name and value changes are not reflected | Refuted, when the name is in `deps`: the aria-label and the observed name both updated | a live name change is the control's new accessible name and the observed name |
| Stale `aria-disabled` / `data-surface-reason` are not removed after availability returns | Refuted: React drops a prop that is no longer passed | availability that returns removes aria-disabled and data-surface-reason from the DOM |
| getSnapshot / `subscribe` instability | Confirmed as waste, not as a loop: a fresh `subscribe` closure made React resubscribe on every render (six subscriptions over six renders). The snapshot is a string, so no render loop | subscribes once across re-renders and does not loop |

Two refutations depended on an accident: the render read the previous registration, and useSyncExternalStore corrected it after commit only because getSnapshot was a new function on every render. A stable getSnapshot without a registration notification would have made them real.

## Change

`packages/surface/src/react.ts`:

- `useSurface` owns the pair `(entry.id, target)`. One effect keyed on `[target, entry.id]` has only a cleanup, which unregisters that pair on unmount or when either changes. A second effect keyed on `[target, entry.id, ...deps]` registers, replacing in place on a `deps` change. Cleanups run before setups, so an id or target change unregisters the old pair before registering the new one. The id ref is gone.
- The registered entry is a copy whose `handler`, `edit.set`, `more`, and `state.requires.fulfill` are wrappers that call the same function on `latest.current`, a ref updated after every commit. An act always runs the latest committed render's closure; a new closure alone does not re-register.
- The effects are layout effects (useEffect when `document` is undefined, to avoid React 18's server warning), so the table and the control's props are current before paint.
- `useSurfaceProps`: `subscribe` and getSnapshot are useCallbacks (`[target]` and `[target, id, own attributes]`), and the store is `target.subscribe`.

`packages/surface/src/index.ts` (additive): `Surface.subscribe(fn): () => void`. It is called after `register`, an `unregister` or `reconcile` that removed a row, `bump`, `setRev`, a `seedRev` that adopted a revision, `freeze`, `thaw` (through `notify`), and `reset`, which keeps store subscribers (mounted components) and notifies them. `onChange` is unchanged. It was not made to fire on registration: the bridge forwards it, filtered by `registryVersion`, to `onActionsChanged`, which sends MCP `tools/list_changed`, so an adapter re-registering hundreds of rows would send one notification per row.

Contract: `spec/SURFACE.md` v0.6. This is a contract change because of the new rule [S-OBS-4] (`subscribe`). The hook fixes alone would not have bumped it. [S-ENT-5] now states the React rules: `deps` refresh in place, the registration belongs to the id and target, the latest render's functions run, Strict Mode leaves the same table, and two components sharing an id share a row. [S-DOM-1] says `useSurfaceProps` reads through `subscribe`. The changes line and the provenance are updated. Vocabulary: `subscribe`.

Docs: `docs/surface.md` "Accessible names" (`subscribe` versus `onChange`, new `docs/examples/surface/dom.ts#follow`, typechecked), "Using it from React" (what the hooks own), and the bundle size (about 26 kB). `CHANGELOG.md` and `DECISIONS.md` are updated.

Migration for React consumers (fantasy-draft `lib/useSurface.js` is its own copy and is unaffected until it adopts `@axe/surface/react`): nothing is required. Handler inputs listed in `deps` only to keep the closure fresh can be dropped. `deps` still carry every value the entry reports (availability, reason, name, value). A mirror outside React that re-applies `attributesFor` on `onChange` should use `subscribe` under an application-owned revision, where `onChange` does not fire on a re-registration.

## Tests

`packages/surface/test/react-mounted.test.ts` (new, `// @vitest-environment jsdom`, 17 tests), `packages/surface/test/surface.test.ts` (one new test), `packages/surface/test/bundle.test.ts` (asserts no jsdom input). Proved with `git stash push -- packages/surface/src`: 9 fail on the original source.

Failing on the original: an id change moves the registration; a target change moves the registration; an act runs the latest render's handler; a field's setter and a collection's more are the latest render's too; an id change under Strict Mode leaves only the new id; an id change is the control's new data-surface-id; the control follows register, unregister, and reconcile made outside the component; subscribes once across re-renders and does not loop (with the original it resubscribed six times to `onChange`; the committed version spies on `subscribe`, which the original lacks); subscribe [S-OBS-4] › fires after every change a reader could see.

Passing on both (no-regression checks for refuted hypotheses): registers on mount, refreshes in place, unregisters on unmount; re-rendering or refreshing one row keeps every row where it was [S-ENT-5]; is safe under Strict Mode (useSurface and useSurfaceProps); freeze and thaw, surface and app mode; availability that returns removes the stale attributes; a live name change; a change in app mode with setRev and no bump.

Bundle: `@axe/surface` plus `/react` went from 25,290 to 26,308 bytes minified, no Node built-ins, no Zod, no jsdom.

No browser integration was added. jsdom settled every hypothesis. Tearing under concurrent rendering (startTransition with a store change mid-render) is not tested; useSyncExternalStore is React's own guarantee against it, and the snapshot is a string.

## Limitations

- Two mounted components registering the same id on one surface share one row; the first to unmount removes it. The spec now says to give each control its own id. The hook does not reference-count.
- An id or target change registers the new id at the end of the table, like any new id. Its index changes.
- The latest handler is the latest committed render's. A handler invoked during a render that has not committed yet runs the previous one.
- `deps` still govern the data an entry reports. A value left out of `deps` stays stale until something else re-registers the entry. Only functions are always fresh. A `name` given as a function is called at read time, as before.
- The bridge's `onChange` still fires only after `bump`, `freeze`, or `thaw`. Under an application-owned revision (`setRev`, no `bump`), a changed action set is picked up by the next request (the provider is read on every enumeration), but MCP clients get no `tools/list_changed` until a freeze or a bump. That is outside this item (`packages/surface/src/axe.ts` was not touched).
- The mounted tests run under jsdom, not a browser. Layout-before-paint is asserted by React's semantics, not measured.
- `llms.txt` is not updated here (see the report for the wording it needs).

## Status

Done on `review/react`. Verified with `pnpm gen:vocabulary -- --check`, `pnpm -r build`, `pnpm check:snippets`, `pnpm lint`, `pnpm -r typecheck`, `pnpm -r test`, and `pnpm docs:api`.
