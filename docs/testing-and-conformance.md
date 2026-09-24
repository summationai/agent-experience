# Testing and conformance

Three layers keep an AXE integration honest. Unit tests run your actions in-process and assert on the result envelope. The conformance suite runs against a URL and checks every numbered requirement in the protocol that can be observed from outside. A vocabulary drift check keeps the names in your docs equal to the names on the wire. This page covers all three, then explains how to read a report.

Everything here ships in `@axe/testing`:

```sh
npm install -D @axe/testing
```

## Unit testing your actions

You do not need a port, a server process, or a mock of HTTP to test an action. `createTestClient` returns an `AXEClient` bound to your server object in-process, so the same code path an agent would exercise (`/axe/actions/{name}`, `/axe/continue`, `/axe/resume`) runs inside the test. Three helpers cover most tests:

- `createTestClient(axe, { identity })` returns an `AXEClient` whose `invoke`, `continue`, `resume`, and `run` go straight to your server object. Pass `identity` with `onBehalfOf` to act as a signed-in user without going through your `authenticate` function; omit it to act anonymously. Mutating calls get an `idempotencyKey` automatically.
- The invokeAction helper calls one action and returns the raw result envelope, untyped beyond `Result`. Use it when you want to assert on the envelope itself rather than drive a flow.
- The samplePayload helper returns a valid payload for any well-known kind (`payment.card`, `contact.address`, `consent.terms`, and the rest of [`spec/KINDS.md`](../spec/KINDS.md)), so a test that continues past `needs_input` does not hand-roll a bank account. It returns undefined for custom kinds.

Here is the Sunrise Yoga `classes.book` action under test. Booking requires a signed-in member; members without a class pass are asked for a card. The file uses Node's built-in test runner so it runs anywhere; in your project, import from Vitest, Jest, or whichever runner you already use.

<!-- include: examples/testing/classes.test-example.ts#site -->
```ts
const axe = createAXE({
  name: "Sunrise Yoga Studio",
  description:
    "Search upcoming yoga classes by date and style, see instructor names and spots left, and (once signed in) book or cancel a spot.",
  baseUrl: "http://localhost:3000",
  humanFallbackUrl: "http://localhost:3000",
  // `user` mode with a login page: anonymous callers of a `user` action get a login handoff.
  auth: { modes: ["none", "user"], userLoginUrl: "http://localhost:3000/login" },
  secret: "test-only-secret-change-in-production",
});

// Stand-ins for the studio's database.
const CLASSES = new Map([["c_101", { title: "Morning Vinyasa", dropInUsd: 24 }]]);
const MEMBERS_WITH_PASS = new Set(["m_priya"]);
const bookings = {
  async create(memberId: string, classId: string) {
    return { bookingId: `b_${memberId}_${classId}` };
  },
};

type BookState = { memberId: string; classId: string };

axe.register(
  action("classes.book", {
    title: "Book a spot in a class",
    description:
      "Reserves one spot in an upcoming class for the signed-in member. Members with an active class pass are booked immediately; otherwise a drop-in fee is charged to a card. Returns the booking id. Cancellation is free until two hours before the class.",
    risk: "medium",
    reversible: true,
    auth: "user",
    input: z
      .object({
        classId: z.string().describe("Class id from classes.search"),
        guests: z
          .number()
          .int()
          .min(0)
          .max(3)
          .optional()
          .describe("Additional spots for guests, 0-3"),
      })
      .strict(),
    output: z.object({
      bookingId: z.string(),
      classId: z.string(),
      status: z.literal("confirmed"),
    }),
    examples: [
      {
        input: { classId: "c_101" },
        output: { bookingId: "b_m_priya_c_101", classId: "c_101", status: "confirmed" },
      },
    ],
    handler: async ({ input, context, needsInput, fail }) => {
      const memberId = context.onBehalfOf!;
      const cls = CLASSES.get(input.classId);
      if (!cls) return fail("not_found", `No upcoming class with id ${input.classId}.`);
      if (MEMBERS_WITH_PASS.has(memberId)) {
        const { bookingId } = await bookings.create(memberId, input.classId);
        return { bookingId, classId: input.classId, status: "confirmed" as const };
      }
      return needsInput({
        reason: "payment_required",
        message: `A $${cls.dropInUsd} drop-in fee applies without an active class pass.`,
        accepts: [accept(kinds.payment.card, { description: "Charge the drop-in fee to a card." })],
        state: { memberId, classId: input.classId } satisfies BookState,
      });
    },
    onContinue: async ({ state }) => {
      const { memberId, classId } = state as BookState;
      const { bookingId } = await bookings.create(memberId, classId);
      return { bookingId, classId, status: "confirmed" as const };
    },
  }),
);
```
<!-- /include -->

The tests cover the four outcomes an agent can hit: `ok`, `needs_human` for an anonymous caller, `needs_input` followed by a continue, and `invalid_input`.

<!-- include: examples/testing/classes.test-example.ts#tests -->
```ts
describe("classes.book", () => {
  it("books immediately for a member with an active pass", async () => {
    const client = createTestClient(axe, { identity: { onBehalfOf: "m_priya" } });
    const result = await client.invoke("classes.book", { classId: "c_101" });
    assert.equal(result.status, "ok");
    if (result.status === "ok") {
      assert.deepEqual(result.output, {
        bookingId: "b_m_priya_c_101",
        classId: "c_101",
        status: "confirmed",
      });
    }
  });

  it("hands off to the login page when the caller is anonymous", async () => {
    const result = await invokeAction(axe, "classes.book", { classId: "c_101" });
    assert.equal(result.status, "needs_human");
    if (result.status === "needs_human") {
      assert.equal(result.handoff.reason, "login_required");
      assert.ok(result.handoff.url.startsWith("http://localhost:3000/login"));
      assert.ok(result.handoff.resumeToken.length > 0);
    }
  });

  it("asks for a card without a pass, then books when the agent continues", async () => {
    const client = createTestClient(axe, { identity: { onBehalfOf: "m_guest" } });
    const first = await client.invoke("classes.book", { classId: "c_101" });
    assert.equal(first.status, "needs_input");
    if (first.status !== "needs_input") return;
    assert.equal(first.reason, "payment_required");
    assert.deepEqual(
      first.accepts.map((a) => a.kind),
      [kinds.payment.card.kind],
    );
    assert.equal(first.accepts[0]!.sensitive, true);

    // A valid payload for any well-known kind, so the test does not hand-roll one.
    const payload = samplePayload(kinds.payment.card.kind)!;
    const second = await client.continue(first.continuationToken, kinds.payment.card.kind, payload);
    assert.equal(second.status, "ok");
  });

  it("names each invalid input path", async () => {
    const result = await invokeAction(
      axe,
      "classes.book",
      { classId: "c_101", guests: 12 },
      { identity: { onBehalfOf: "m_priya" } },
    );
    assert.equal(result.status, "error");
    if (result.status === "error") {
      assert.equal(result.error.code, "invalid_input");
      assert.deepEqual(
        result.error.details?.issues?.map((i) => i.path),
        ["/guests"],
      );
    }
  });
});
```
<!-- /include -->

Two details worth knowing. The anonymous call returns `needs_human` with reason `login_required` because the manifest declares `userLoginUrl`; the SDK mints that handoff for you, and the test asserts on it without any login code in the action. The `invalid_input` error names `/guests` as a JSON Pointer in `details.issues`, which is what lets an agent correct itself without asking the user. Both behaviors are protocol requirements, so asserting on them in your own tests is cheap insurance against a framework adapter or middleware changing them.

Narrow on `status` before touching members. `Result` is a discriminated union, so `if (result.status === "ok")` gives you `output` and nothing else; the same holds for `handoff`, `accepts`, and `error`.

## Running conformance locally

`axe conformance` runs the protocol suite against a live URL and prints one line per check:

```sh
npx axe conformance http://localhost:3000
````

```
AXE conformance: http://localhost:3000/
Manifest: http://localhost:3000/.well-known/axe.json

PASS  discovery.well-known            Manifest at /.well-known/axe.json
PASS  discovery.alias                 Manifest also at /axe/manifest
PASS  discovery.headers               Manifest Content-Type and Cache-Control
PASS  runtime.protocol-header         AXE-Protocol header on the manifest
WARN  discovery.hints                 Discovery hint (robots.txt directive, link tag, or header)
                                      No AXE-Manifest line in robots.txt, no <link rel="axe-manifest">, no AXE-Manifest header on the home page. Optional, but it helps agents that start from a page URL.
PASS  manifest.schema                 Manifest validates against the schema
...
PASS  runtime.example-roundtrip       Read actions return ok for their examples; outputs validate; display resolves
...
35 passed, 0 failed, 1 warnings, 18 skipped. Conformant.
```

The exit code is 0 when no check failed and 1 otherwise. Warnings do not fail the run.

> **Warning**
> The suite calls your actions. It invokes every read action with its first example, and when it can, it invokes a mutating action three times to test idempotency, continues a `needs_input` with a sample payload, and resumes a fallback handoff. Run it against staging, or against a local instance with a disposable database. Never point it at production with credentials.

Flags:

| Flag                                        | Effect                                                                                                                                                             |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `--auth <token>`                            | Sent as a bearer token in `Authorization`. Without it, `user` and `site` actions are not callable, and every check that needs one is skipped.                      |
| `--no-mutate`                               | Skip every check that calls a mutating action: idempotency, the whole escalation ladder, token tampering. Use it against an environment you cannot reset.          |
| `--ladder <action> --ladder-input '<json>'` | Name an action and input known to return `needs_input`. Use it when none of your examples does (examples are supposed to show the `ok` output, so this is common). |
| `--vendor <name>`                           | The vendor presented in `context.agent`. Use it to verify a `policies.agents` allow or deny list; a denied vendor skips every live check.                          |
| `--json`                                    | Emit the full `ConformanceReport` as JSON instead of the table, including per-check spec requirement ids and the observations the audit reuses.                    |

A typical staging run for Oakridge Rentals, whose application flow needs a signed-in renter and a deposit:

```sh
npx axe conformance https://staging.oakridge-rentals.example \
  --auth "$AXE_TEST_TOKEN" \
  --ladder applications.submit --ladder-input '{"unitId":"u_204"}'
```

## Running conformance in CI

Start your app, wait for the manifest, run conformance, then run the audit with a floor. A GitHub Actions job:

```yaml
name: AXE conformance

on:
  pull_request:
  push:
    branches: [main]

jobs:
  conformance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run build

      - name: Start the app
        run: |
          PORT=3000 AXE_BASE_URL=http://localhost:3000 npm start &
          for i in $(seq 1 50); do
            curl -sf http://localhost:3000/.well-known/axe.json > /dev/null && break
            sleep 0.2
          done

      - name: Conformance
        run: npx axe conformance http://localhost:3000

      - name: Audit
        run: npx axe audit http://localhost:3000 --min-score 80 --html axe-audit.html

      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: axe-audit
          path: axe-audit.html
```

Both commands exit non-zero on failure, so the job fails on a broken check or a score below the floor. Add `--auth` with a staging token stored as a secret to unskip the ladder checks. This repository runs exactly this shape in `scripts/ci-conformance.mjs`: it starts the getting-started Express example, waits for the manifest, and runs `axe conformance` and `axe audit --min-score 80` against it on every push.

When a shell script is not enough (you want to fail only on specific checks, post the table to a pull request, or run against several tenants), call `runConformance` directly. It takes the same options as the CLI and returns the report the CLI prints:

<!-- include: examples/testing/programmatic.ts#conformance -->
```ts
const url = process.env.AXE_TARGET_URL ?? "https://staging.oakridge-rentals.example";

const options: ConformanceOptions = { vendor: "Oakridge CI" };
// A staging user's bearer token lets the suite call `user` actions and walk the ladder.
if (process.env.AXE_TEST_TOKEN) options.auth = process.env.AXE_TEST_TOKEN;
// Name an action and input known to return needs_input when no example does.
options.ladder = { action: "applications.submit", input: { unitId: "u_204" } };

const report = await runConformance(url, options);
console.log(formatConformanceTable(report));

const failed = report.checks.filter((c) => c.status === "fail");
for (const c of failed)
  console.error(`${c.id}: ${c.detail} (see ${c.docs}; spec ${c.requirements.join(", ")})`);

const ladderSkipped = report.checks.filter(
  (c) => c.id.startsWith("ladder.") && c.status === "skip",
);
if (ladderSkipped.length > 0) {
  console.warn(`${ladderSkipped.length} ladder checks skipped: ${ladderSkipped[0]!.detail}`);
}

process.exitCode = report.ok ? 0 : 1;
```
<!-- /include -->

Every `Check` carries the spec requirement ids it verifies and a `docs` path to the section that explains the fix, so a script can link straight to the remedy.

## Reading the report

Each check has one of four statuses:

| Status | Meaning | Affects exit code |
| --- | --- | --- |
| PASS | The requirement was verified. | No |
| FAIL | A MUST in the spec is violated, or a live call returned something the protocol forbids. | Yes: `ok` is false and the CLI exits 1. |
| WARN | A SHOULD is unmet, or the check could not fully confirm a MUST (for example, the variant input was rejected before the idempotency key was compared). Agents will still work; something is leaving value on the table. | No |
| SKIP | The check needs something the run did not have: credentials, a mutating action with an example, a fallback handoff, CORS, a platform index. The detail line says what. | No |

Below is every check the suite emits, grouped by prefix, with the spec requirements it cites. Requirement ids refer to [`spec/AXE-PROTOCOL.md`](../spec/AXE-PROTOCOL.md).

### discovery.*

| Check | Verifies | Requirements |
| --- | --- | --- |
| `discovery.well-known` | The manifest is served at `/.well-known/axe.json`. Fails if it is only at the alias. | P-DISC-1 |
| `discovery.alias` | The manifest is also served at `/axe/manifest`. Warns when absent. | P-DISC-2 |
| `discovery.headers` | The manifest has a JSON `Content-Type` and a `Cache-Control` max-age of at least 60 seconds. Warns on a short max-age. | P-DISC-3 |
| `discovery.hints` | A hint points at the manifest: an `AXE-Manifest` line in robots.txt, a `<link rel="axe-manifest">` on the home page, or an `AXE-Manifest` response header. Warns when none is found. | P-DISC-6 |

### manifest.*

| Check | Verifies | Requirements |
| --- | --- | --- |
| `manifest.schema` | The manifest validates against the published JSON Schema. Every later phase depends on this. | P-MAN-1, P-ACT-1, P-DISP-7 |
| `manifest.protocol` | `protocol` is `axe/0.1`. Another minor version warns; another major fails. | P-VER-1 |
| `manifest.https` | `baseUrl` is HTTPS (localhost is accepted). | P-MAN-2 |
| `manifest.unique-names` | No two actions share a name. | P-ACT-2 |
| `manifest.truthful-metadata` | No mutating action has `risk` `none`; no action declared `readOnly` is named like a mutation (book, cancel, submit, pay, and so on). | P-ACT-3, P-HON-7 |
| `manifest.object-schemas` | Every `input` and `output` schema is an object. | P-ACT-4 |
| `manifest.examples-validate` | Every example validates against its schemas. Warns when an action has no examples. | P-ACT-5 |
| `manifest.reserved-key` | No output schema declares the reserved `_axe` key. | P-ACT-6, P-AFF-5 |
| `manifest.description-length` | The manifest description and every action description are 40 to 400 characters. | P-ACT-7 |
| `manifest.honesty` | No agent-read text contains instructions to the agent (fail) or persuasion (warn). See [Honesty rules](audit.md#honesty-rules). | P-MAN-3, P-ACT-7, P-REQ-4, P-HAND-3, P-HON-1, P-HON-2 |
| `manifest.auth-modes` | Every action's `auth` is one of the manifest's `auth.modes`. | P-AUTH-1 |
| `manifest.display-pointers` | Every `display` pointer resolves against the output schema. A missing `display.item.url` warns. | P-DISP-1, P-DISP-2, P-DISP-3 |
| `manifest.affordances` | Affordances target actions in the manifest, bind pointers that exist to inputs the target accepts, number at most 6 per item, and mark at most one `primary`. | P-AFF-1, P-AFF-2, P-HON-4 |
| `manifest.pagination` | `pagination` pointers resolve: `cursorIn` against the input, `cursorOut` against the output. | P-AFF-7 |
| `manifest.freshness` | `freshness` pointers resolve against the output. | P-AFF-8 |
| `manifest.structured-filters` | Search inputs are not a lone free-text field. Warns. | P-AFF-9 |
| `manifest.flows` | Every step in every flow names an action in the manifest. | P-FLOW-1 |
| `manifest.agents-policy` | Evaluates `policies.agents` for the vendor the suite presents. Always passes; when the vendor is denied, the live phases are skipped. | P-DISC-11, P-DISC-12 |
| `manifest.index` | When the manifest has an `indexUrl`, the platform index validates and each listed tenant's `baseUrl` origin matches its `manifestUrl` origin. Skips without an `indexUrl`. | P-DISC-8, P-DISC-9, P-DISC-10 |

### runtime.*

| Check | Verifies | Requirements |
| --- | --- | --- |
| `runtime.protocol-header` | The `AXE-Protocol` header is on the manifest response. Emitted a second time, as a failure, if the header is missing from an error response. | P-VER-2, P-VER-3 |
| `runtime.unknown-action` | An unknown action name returns HTTP 404 with a `not_found` envelope. | P-INV-5, P-INV-6 |
| `runtime.missing-input` | An envelope without `input` returns HTTP 400 with `invalid_input`. | P-INV-1 |
| `runtime.invalid-input` | A bogus property and a wrong type return HTTP 400 with `invalid_input` and one issue per path. Warns when the schema accepts unknown properties and has nothing to violate. | P-INV-2, P-ERR-3, P-INV-6 |
| `runtime.unsupported-version` | A request with `AXE-Protocol: axe/99.0` returns `unsupported`. | P-VER-5 |
| `runtime.unknown-fields-ignored` | An unknown envelope field does not change the result of a read action. | P-VER-4 |
| `runtime.get-definition` | GET on an action URL returns the definition, 404, or 405. | P-INV-4 |
| `runtime.continue-endpoint` | `/axe/continue` rejects an unknown token with 404 `not_found`. | P-REQ-7, P-TOK-3 |
| `runtime.resume-endpoint` | `/axe/resume` rejects an unknown token with 404 `not_found`. | P-HAND-4, P-TOK-3 |
| `runtime.envelope-schema` | A live result validates against the result envelope schema. | P-RES-1, P-ERR-1 |
| `runtime.example-roundtrip` | Every callable read action returns `ok` for its first example; the live output validates against the output schema; `display` resolves to items with an id and a title and no more than 6 affordances. | P-DISP-2 |
| `runtime.pagination-roundtrip` | A paginated read action's `cursorOut` feeds back through `cursorIn` and the second page returns `ok`. | P-AFF-7 |
| `runtime.cors` | When CORS is enabled, the preflight allows POST, `Authorization`, and `AXE-Protocol`. Skips when CORS is off. | P-INV-9 |
| `runtime.rate-limit-header` | When `policies.rateLimit` is declared, responses carry `RateLimit-Policy`. Warns when either is missing. | P-AGENT-2 |
| `runtime.idempotency-required` | A mutating call without `idempotencyKey` returns `invalid_input`. Warns if accepted. | P-IDEM-1 |
| `runtime.idempotency-replay` | The same key and input twice return an identical non-error result. | P-IDEM-2 |
| `runtime.idempotency-conflict` | The same key with different input returns `conflict`. | P-IDEM-3 |
| `runtime.token-tamper` | A continuation token with its last characters altered returns `not_found`. | P-TOK-3 |
| `runtime.error-hygiene` | No error body seen during the run contains a stack trace, a node_modules path, or an HTML error page. | P-ERR-2 |

### live.*

Live state (spec §21). Every check skips when the manifest has no `live` member.

| Check | Verifies | Requirements |
| --- | --- | --- |
| `live.state-endpoint` | `GET` on `live.url` (or `/axe/state`) returns a valid state document listing every action, with `Cache-Control: no-store`. | P-LIVE-7, P-LIVE-8 |
| `live.rev-on-envelopes` | A read action's envelope carries `rev` when the state reports a revision. | P-LIVE-2 |
| `live.stale-conflict` | Calling with an `expectedRev` that differs returns 409 `conflict`, `retryable`, with `expectedRev` and `currentRev` in `details`. | P-LIVE-1, P-LIVE-3 |
| `live.fresh-accepted` | Calling with the current `rev` as `expectedRev` is not refused. Warns when the revision moved between the two requests. | P-LIVE-3 |
| `live.reasons` | Every unavailable action in the manifest and the state has a plain-language `reason` with no instruction aimed at the agent. | P-LIVE-5 |
| `live.availability-honored` | An action the state reports unavailable does not return `ok` for its example. Skips with `--no-mutate` unless the action is read-only. | P-LIVE-6 |

### ladder.*

| Check | Verifies | Requirements |
| --- | --- | --- |
| `ladder.needs-input-shape` | A `needs_input` result has a snake_case `reason`, a non-empty `message`, and at least one `accepts` entry with `kind`, `title`, `description`, `schema`, and a boolean `sensitive`. | P-REQ-1, P-REQ-2, P-REQ-5 |
| `ladder.sensitive-kinds` | Any well-known kind the registry marks sensitive is offered with `sensitive` true. | P-REQ-3 |
| `ladder.continue-invalid` | Continuing with an invalid payload returns 400 `invalid_input` with issues and does not consume the token; continuing with a kind not in `accepts` also returns `invalid_input`. | P-REQ-8 |
| `ladder.continue-valid` | Continuing with a valid sample payload returns a non-error status. | P-REQ-7 |
| `ladder.continue-replay` | Continuing again with the consumed token returns `conflict`. | P-REQ-9 |
| `ladder.fallback-resume` | Resuming with the `fallback` handoff's `resumeToken` returns a non-error status, or `conflict` while the handoff is gated on completion. | P-REQ-6, P-HAND-4 |
| `ladder.resume-replay` | Resuming again with the consumed token returns `conflict`. | P-HAND-6 |
| `ladder.handoff-shape` | Every handoff observed has all six members: `reason`, `instructions`, `url`, `resumeToken`, `expiresAt`, `whatAgentShouldSayToUser`. | P-HAND-1 |
| `ladder.token-ttl` | The continuation token expires within about 15 minutes and the fallback resume token within about 24 hours. Warns outside those bounds. | P-TOK-5 |
| `ladder.fake-kinds` | No custom `x-` kind in `accepts` has a schema structurally identical to a well-known kind. | P-HON-5 |
| `ladder.consent-scope` | Every `consent.terms` entry requires a policy URL, a policy version, and a scope. Skips when no consent kind is offered. | P-HON-6 |
| `ladder.needs-human-avoidable` | No `needs_human` observed has a reason that names a payment, deposit, identity, consent, document, address, email, or phone, which a well-known kind would have covered. | P-RES-2, P-HAND-2 |

### Why checks skip

The getting-started example skips 18 checks. That is expected, not a problem. Each skip has one of these causes, and the detail line names it:

- **No credentials.** Actions with `auth` `user` or `site` are not callable without `--auth`. If every mutating action needs a user, the idempotency and ladder checks skip. Pass a staging user's token.
- **No mutating action with an example.** The ladder needs an action to call. Add `examples` to your mutating actions; they are validated at registration and used here.
- **No example returns needs_input.** Examples show the `ok` output, so the suite may call every mutating action and see only `ok`. Pass `--ladder` with an action and input that reach the requirement, such as an application for a unit whose deposit is unpaid.
- **No fallback handoff.** `ladder.fallback-resume` and `ladder.resume-replay` need a `needs_input` that carries a `fallback`. If your requirement has no human alternative, these stay skipped; that is a design choice, not a defect.
- **Only custom kinds offered.** The suite has sample payloads for well-known kinds only, so `ladder.continue-valid` skips when every `accepts` entry is an `x-` kind. Offer a well-known kind first where one fits; see [Designing requirements](designing-actions.md#designing-requirements).
- **Feature not used.** `runtime.cors`, `runtime.pagination-roundtrip`, `manifest.index`, `ladder.consent-scope`, and every `live.*` check skip when your site does not enable CORS, paginate, publish an index, ask for consent, or publish live state.
- **`--no-mutate`.** Every check that would call a mutating action skips with that reason.

## The drift check

`checkVocabularyDrift` is the test that keeps these docs truthful. [`spec/VOCABULARY.md`](../spec/VOCABULARY.md) is the single list of every name on the wire, in the CLI, in the MCP server, and in the public API; `packages/core/src/vocabulary.ts` is generated from it. The drift check reads the vocabulary and the repository, and reports:

- **Unknown tokens.** Inline code spans in `spec/`, `docs/`, and the README that look like wire names (camelCase identifiers, snake_case codes, paths under `/axe/` or `/.well-known/axe`, `AXE-` headers, `axe_` tool names, `axe <command>`, and kinds in the well-known namespaces) but are not in the vocabulary. Fenced blocks are not scanned: TypeScript blocks are typechecked from `docs/examples/`, and JSON blocks legitimately contain example data.
- **Unmentioned entries.** Vocabulary names no page mentions.
- **Unused entries.** Vocabulary names no source file uses.
- **Missing from types.** `field` and `api` entries that appear in no package's public `.d.ts`, which means the docs describe an API that does not exist.
- **Literals.** Source files that spell a path, header, or tool name as a string literal instead of reading it from `@axe/core/vocabulary`.

The check passes only when all five lists are empty and the allowlist is shorter than its limit. The allowlist exists for tokens like a file name that happen to match a pattern; the limit keeps it from becoming a way around the check. The reasoning is recorded in [`DECISIONS.md`](../DECISIONS.md#vocabulary-and-drift-prevention).

If you extend the protocol in your own repository (custom kinds with their own documentation, a platform-specific header, a wrapper package), run the same check there. It needs a `spec/VOCABULARY.md` in the same table format, a `docs/` directory, a `packages/` directory with built `.d.ts` files, and a README:

<!-- include: examples/testing/drift.ts#drift -->
```ts
const report = checkVocabularyDrift({
  // Must contain spec/VOCABULARY.md, docs/, packages/, and README.md.
  root: process.cwd(),
  // Markdown to scan for inline code spans. docs/api is always skipped.
  docPaths: ["spec", "docs", "README.md"],
  // Tokens that look like wire names but are legitimately not vocabulary.
  allowlistPath: "spec/drift-allowlist.json",
  // The check fails once the allowlist reaches this size; keep it a short list of exceptions.
  maxAllowlist: 15,
});

console.log(formatDriftReport(report));
for (const [token, files] of Object.entries(report.unknown)) {
  console.error(`"${token}" is not in spec/VOCABULARY.md (${files.join(", ")})`);
}
process.exitCode = report.ok ? 0 : 1;
```
<!-- /include -->

Run it from your test suite or as a CI step. The first run against an existing set of docs usually lists a few dozen unknown tokens; most are prose that should not have been in backticks, and the rest are names your vocabulary table is missing.

## Requirement coverage

Every numbered requirement in [`spec/AXE-PROTOCOL.md`](../spec/AXE-PROTOCOL.md) is verified somewhere, and a test proves it. `packages/testing/src/conformance/requirements.ts` maps each requirement id to one or more of:

- a conformance check id, when the requirement can be observed from outside against any URL (for example P-IDEM-2 maps to `runtime.idempotency-replay`);
- a named test in `@axe/core` or `@axe/client`, when the requirement is about behavior only the implementation can show (for example P-TOK-4, "the wire token carries only binding fields", maps to a test in the core token suite).

`packages/testing/test/requirements.test.ts` asserts three things: every `[P-...]` identifier that appears in the spec is in the map and nothing in the map is absent from the spec; every check id the map references is emitted by a real run of the suite against the Oakridge Rentals fixture; and every test name the map references is the title of a real test. Add a requirement to the spec without covering it and the build fails. The map is summarized in the spec's [Appendix B](../spec/AXE-PROTOCOL.md#appendix-b-requirement-index).

One requirement, P-HON-3 (parity), maps to `audit.parity`, which is not a pass/fail conformance check. Parity can only be spot-checked; see [The parity spot-check](audit.md#the-parity-spot-check).

## Next steps

- [Audit](audit.md): the AXE Score built on top of the conformance observations, and the honesty rules.
- [Designing actions](designing-actions.md): examples, requirements, and the metadata the truthfulness checks compare against.
- [Deploying](deploying.md): the discovery hints, caching, and rate-limit headers the discovery and runtime checks look for.
- [For agent builders](for-agent-builders.md): what an agent does with each status the suite exercises.
````
