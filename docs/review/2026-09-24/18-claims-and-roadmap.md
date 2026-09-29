# Item 18: Audit claims clarified; roadmap prioritized

Phase 4 of the 2026-09-24 review. Branch `review/claims`, based on `herz/surface-integration` at `49c11be` (phases 1 to 3 merged).

**Status:** done.

## Finding

The review asked that the docs keep four kinds of evidence apart (protocol conformance, tested security properties, measured task effectiveness, heuristic checks), that a passing audit not read as proof of safety, truthful behavior, or commercial value, and that positioning lead with consistent human and agent behavior instead of protocol adoption.

Verified at `49c11be`:

- **The score counted skipped checks as passes in three ways.** In `finish()` (`packages/testing/src/audit/index.ts`), a category whose checks all skipped scored its full maximum (`totalW === 0 ? c.max`). When no manifest was found, `runAudit` returned only the Discoverable checks, so the other four categories earned 80 points: a URL serving nothing scored 80, the floor this repository's CI gate uses. `presentable.pointers-resolve` gave the live half (0.5) whenever `runtime.example-roundtrip` was skipped or absent, and `trustworthy.tokens` did the same for an unexercised half. `describable.examples-validate` scored 1 when its conformance check was absent. A skipped check carried `earned: 1` in the JSON report.
- **Vacuous passes.** `ladder.needs-human-avoidable` passed when no `needs_human` was observed at all (the apartments fixture and the getting-started example both), and the audit's `actionable.needs-input-first` scored it. Proportional checks with nothing to count (`fraction(0, 0) = 1`) passed on a manifest with no actions or no input fields.
- **Reports.** Neither the audit table, the HTML report, nor the conformance table said anything about skipped checks beyond a count, or what a score does not show. "Conformant." printed after 27 skipped checks.
- **Docs.** `docs/audit.md` called the score a way "to see how well agents will do on your site". `docs/testing-and-conformance.md` said every requirement "is verified somewhere, and a test proves it". `docs/why-axe.md` linked a README anchor that does not exist, claimed orders-of-magnitude cost differences without a measurement, and presented discovery as something that happens when a manifest is published. `README.md` said agents get "an MCP server for free" and discovery at a fixed path; the landing page hero said "Agents are becoming the front door to every website." `docs/faq.md` "Will agents actually use it?" argued adoption was likely. Payment and identity kinds were described as things "an agent wallet can fulfill", with no statement that a valid shape is not an accepted payment. `ROADMAP.md` was an unordered list of deferrals.

## Change

### Score and reports (`@summationai/axe-testing`)

- `packages/testing/src/audit/index.ts`: a skipped check has `earned: 0`. `AuditCategory` gains `scored: boolean`; a category with no scored check has `score: 0`, `scored: false`, and is left out of the total, which is scaled to 100 over the scored categories (the plain sum when all are scored). Fix-list points are scaled the same way, so they stay in total-score points. `presentable.pointers-resolve` and `trustworthy.tokens` score only the halves that ran and name the half that did not. `describable.examples-validate` skips when its conformance check is absent or skipped. `describable.examples-present`, `describable.input-descriptions`, `describable.structured-filters`, and `actionable.graph-connected` skip when there is nothing to count. `discoverable.index` skips when there is no manifest.
- `packages/testing/src/conformance/index.ts`: `ladder.needs-human-avoidable` skips when no `needs_human` was observed; `runtime.error-hygiene` skips when no error body was seen. `formatConformanceTable` adds, when anything skipped, "Skipped checks were not verified: "Conformant" means no check failed, not that every requirement was exercised", and always a line that conformance is not a security review, with a link to the new doc section.
- `packages/testing/src/audit/format.ts`: the terminal table and the HTML report end with "What this score is not": the number of checks counted and skipped, unscored categories, the conformance counts, and the limits. An unscored category prints "not scored: no check applied". The CLI (`packages/cli/src/commands/audit.ts`, `conformance.ts`) prints these formatters unchanged, so `axe audit` and `axe conformance` carry the footer.

No wire, vocabulary, or spec rule changed. The requirement map is unchanged: P-RES-2 and P-HAND-2 still map to `ladder.needs-human-avoidable`, which now has tests for its pass and fail cases.

Effect on shipped numbers: the getting-started tutorial scores 88 (was 89) and 87 in CI where the fallback URL is unreachable (was 88): the `needs_input`-first check skips instead of passing, leaving Actionable at 10.8 of 20. The apartments fixture still scores above 90.

### Claims in the docs

| File | Old | New |
| --- | --- | --- |
| `README.md` opening | Protocol and SDK "that let any organization with a website expose" an agent interface; agents get "an MCP server for free" | SDK exposing an application's existing capabilities to people and agents through the same logic (permissions, availability with reasons, five statuses, bound approval, replayed retries); agents reach it through MCP, WebMCP, or the DOM; AXE is the HTTP representation underneath and optional; a manifest does not make agents find a site |
| `README.md` | No claims section; packages table without intro | "What is and is not claimed" (four kinds of evidence, none is evidence of production readiness, adoption, or value; the first-user hypothesis); a packages intro by how callers reach the logic |
| `docs/why-axe.md` | Web-agent problem only; "Why headless browsing does not scale" with unmeasured cost claims; discovery as the answer to discoverability; broken README anchor | A planning-team story first; "How agents reach it" (MCP, WebMCP, DOM, AXE optional); SEO analogy "about shape, not reach"; kinds as shapes; audit as heuristic; "Why driving the UI alone is fragile" with concurrent edits and no cost claim; "Who is likely to benefit first", labeled a hypothesis with no pilot run |
| `docs/concepts.md` intro | The dozen ideas of the protocol | Adds that the ideas are behavior, not wire, and hold over MCP, WebMCP, the page, and AXE |
| `docs/faq.md` | MCP answer: "If you want every agent to find you, write the manifest"; "Will agents use it": adoption "likely", an afternoon to add support | Discovery only for clients that look; declare once for MCP, browser, and AXE clients; adoption of AXE unshown, no framework known to read manifests, value comes through existing interfaces, measure on your own tasks; kinds and payments as shapes, not accepted authorization; audit detection as pattern matches |
| `docs/requirements-and-kinds.md`, `spec/KINDS.md` | Kinds exist so wallets fulfill requirements | Also: a kind is a payload shape; a valid payload is well-formed, not accepted; no wallet is known to produce these kinds; charging and verification stay with the site; offer a fallback |
| `docs/platforms.md` | "Puts every site it hosts in front of agents" | Exposes every site's actions; the index helps agents that read AXE; others reach tenants through configured MCP servers |
| `docs/audit.md` | "See how well agents will do on your site"; skipped checks excluded | "How legible your manifest and responses are"; a lint with a live smoke test, not a certification; scoring rules for skips, halves, and unscored categories; "What a score does not mean"; tutorial numbers updated |
| `docs/testing-and-conformance.md` | "Checks every numbered requirement"; "Every requirement is verified somewhere" | Evidence table (conformance, tested security properties with pointers to items 01 to 12, measured task effectiveness in `docs/evaluation.md`, heuristics); SKIP is not a pass; requirement coverage means mapped, verified only when the check runs; "What conformance does not show" |
| `docs/security.md` | Mitigation table without provenance | Each row pinned by tests named per review item; tests cover this code, not a deployment; conformance and audit are not security reviews (also in Known gaps) |
| `docs/getting-started.md` | "Any agent can discover"; score 89 | "An AXE client can discover"; the conformance summary and its skip note as printed now; score 88 |
| `site/src/index.html` | "Agents are becoming the front door to every website."; "There is a number to move."; "Any organization with a website" | "One set of application logic, for people and for agents."; "A score, a fix list, and its limits." with a heuristic note and a link to the limits; "Applications where people and agents share work", labeled a hypothesis, with a planning-team tile |

The name and tagline are unchanged. `site/dist` was not rebuilt; the landing page's build output, including the embedded apartments audit report (which gains the footer), changes on the next `pnpm site:build`.

### Roadmap

`ROADMAP.md` is two parts. Priorities, in order, each with why, what exists (with paths and review items), the next concrete step, and a label:

1. Capability and permissions inspector: open SDK primitive (a hosted cross-app view is a commercial hypothesis).
2. Outcome-based regression evaluation (item 17's harness as a CI gate): open primitive; hosted evaluation is a commercial hypothesis.
3. Durable execution and observability (PostgreSQL stores, events and ledger into the app's audit log, tracing): open primitive; hosted operational visibility is a commercial hypothesis.
4. Human review and receipts (batching, delegation, policy, atomic decisions): open primitive; a hosted review queue is a commercial hypothesis.
5. Selective discovery (MCP server configs, customer-run registries on `axe-index.json`, WebMCP, filtering): open primitive; no hosted registry.
6. Native adapters (one more UI binding chosen by the first pilot): open primitive.

The deferred entries that remain true are kept; three were updated for what phases 1 to 3 shipped (the MCP resource server under OAuth, the MCP Apps view under result cards, Surface's DOM and WebMCP under the browser-extension fallback). The file states that this repository will not build a hosted registry, billing, an identity provider, a payment platform, or hosted analytics.

`DECISIONS.md`: two Audit entries (skips earn nothing; the reports state limits) and a Positioning section (why, the first-user hypothesis, humor limited to the name and tagline). `CHANGELOG.md`: an item 18 section with the migration note on scores.

## Tests

`packages/testing/test/audit-skips.test.ts` (new). Proved by `git stash push -- packages/testing/src`: every test below fails on the unfixed source except the one marked as a guard.

- a URL that serves no manifest scores 0, not the maxima of the categories it could not check (was 80);
- a skipped check reports earned 0 (was 1);
- a category with no scored check is left out of the total instead of earning its maximum (a manifest with one mutating action and no display);
- checks that count actions or fields skip, not pass, when there is nothing to count (a manifest with no actions);
- `presentable.pointers-resolve` scores only the halves that ran (a failing static pointer check on a read the suite cannot call earned 0.5);
- the text and HTML reports say what a score is not, with the skipped count and the doc link;
- the conformance table says skipped checks were not verified;
- `ladder.needs-human-avoidable` skips when no `needs_human` was observed, and the audit's `actionable.needs-input-first` skips with it;
- guard: `ladder.needs-human-avoidable` fails a `needs_human` with reason `payment_required` and passes one with `signature_required` (passes before and after; no test pinned either case before).

`packages/testing/test/conformance.test.ts`: the apartments fixture now expects `ladder.needs-human-avoidable` to be `skip` (it passed vacuously). The CLI audit test (score 90 or above on the apartments fixture) and `scripts/ci-conformance.mjs` (floor 80) pass unchanged.

## Limitations

- The scaling rule means a site where no Presentable check applies is scored over 85 points of evidence and reported out of 100. The report names the unscored category, but a reader comparing two sites by the number alone will not see it.
- The honesty checks are still regular expressions and the parity check still a sample; this item documents that, it does not improve them.
- Conformance still exits 0 with any number of skipped checks. A `--require` flag that fails a run when named checks skip would let CI insist on the ladder; not added.
- `docs/evaluation.md` and `docs/pilot-plan.md` are linked but written by item 17 on another branch; the links resolve once both branches are merged. The site's link check will fail until then.
- `docs/README.md` (the docs hub) still opens with "Agents are becoming a front door to your business" and "an MCP server for free"; item 17 is editing that file, so it was left for the merge. `llms.txt` was not edited; suggested text is in the report to the coordinator.
- The roadmap's commercial hypotheses are untested. No pilot has run, and nothing here shows that the first-user hypothesis is right or that anyone would pay for a hosted offering.
