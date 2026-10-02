# Generating actions from what you already have

[Designing actions](designing-actions.md) assumes you write each action by hand. That is right for a site whose agent interface differs from its developer API, and it is how the worked examples in these docs are built. It has a cost: the actions are a second description of operations the application already defines, and two descriptions drift the first time one changes without the other. The audit catches drift after the fact. `@summationai/axe-generate` removes the second description: it derives the manifest from a definition the application already has and regenerates it on every build.

Three sources ship:

- **An OpenAPI 3.x document**, with a handler that performs the HTTP call.
- **A table of zod-typed functions**: server actions, service methods, anything with a schema and a function.
- **A tRPC router**, read structurally, without a dependency on tRPC.

Anything else that has typed operations can be a source too; the interface is one method.

## What the generator refuses to invent

The honesty rules in [Audit](audit.md#honesty-rules) are about text and metadata that only the author can vouch for. A generator that filled them in would produce confident text with nothing behind it. So `generate` declines, and says so:

| AXE needs                            | The generator does                                                                                                                                                     |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `description` (40 to 400 characters) | Takes the definition's own description. When there is none, leaves the action out with a warning naming the operation and the field.                                   |
| `risk` on a mutation                 | OpenAPI: defaults by method (see below). Functions and tRPC: takes the entry's `risk` or the policy's `defaultRisk`; otherwise leaves the action out.                  |
| `display` and the human URL          | Never generated. The lints report a read action that returns a list without display hints; an override supplies the shape.                                             |
| `examples`                           | Never generated. Reported by the lints.                                                                                                                                |
| `title`                              | Takes the summary or a label derived from the operation's id. A title is a label, not a claim.                                                                         |
| Agent-directed or persuasive text    | Runs the core lints on every generated definition. An error (an instruction to the agent, a description outside the length rule) leaves the action out with the issue. |

Every one of these is a `GenerateWarning` in the result, with the action name, the source reference (`GET /orders/{id}`), the field, and whether the action was left out. The `axe generate` command prints them; the module it emits has a TODO per gap.

## From an OpenAPI document

<!-- include: examples/generating/openapi.ts#generate -->
```ts
import { readFileSync } from "node:fs";
import { createAXE } from "@summationai/axe-core";
import {
  formatWarnings,
  fromOpenAPI,
  generate,
  registerGenerated,
} from "@summationai/axe-generate";
import type { OpenAPIDocument } from "@summationai/axe-generate";

const document = JSON.parse(
  readFileSync(new URL("./openapi.json", import.meta.url), "utf8"),
) as OpenAPIDocument;

export const axe = createAXE({
  name: "Northwind Outfitters",
  description:
    "Search the catalog and place, change, or track orders. Signed-in customers act on their own orders only.",
  baseUrl: "https://shop.northwind.example",
  auth: { modes: ["none", "user"], userLoginUrl: "https://shop.northwind.example/login" },
  secret: process.env.AXE_SECRET,
});

const generated = generate(
  [
    fromOpenAPI(document, {
      baseUrl: "https://api.northwind.example/v1",
      // The customer's bearer token travels to the API unchanged; nothing is sent otherwise.
      auth: { forward: true },
    }),
  ],
  {
    overrides: {
      // GET /products had no description in the document. Write it here, not in the generator.
      "products.list": {
        description:
          "Searches the catalog by free text. Returns up to 100 products with SKU, name, and price in USD.",
        risk: "none",
        display: {
          kind: "list",
          items: "/result",
          item: { id: "/sku", title: "/name", url: "/url" },
          disclaimer: "Prices exclude tax and shipping.",
        },
      },
      // Not for agents, at least not yet.
      "orders.delete": { exclude: true },
      // No operationId in the document; the derived name reads badly.
      "POST /products/{sku}/reviews": { name: "reviews.create" },
    },
    policy: {
      // First rollout: nothing that moves money or cannot be undone.
      maxRisk: "medium",
      exclude: ["*.internal-*", /^admin\./],
    },
  },
);

// Anything left out is a gap in the document, reported with the operation and the field.
const dropped = generated.warnings.filter((w) => w.dropped);
if (dropped.length > 0) console.warn(formatWarnings(dropped));

registerGenerated(axe, generated);

export const handler = axe.fetchHandler();
```
<!-- /include -->

One action per operation, mapped like this:

| Action member                            | From the operation                                                                                                                                                                                                                                                                                                              |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| name                                     | The `operationId`, sanitised to the AXE grammar: dotted ids keep their segments; a flat id is namespaced under the path's first static segment with that word removed (listOrders on `/orders` is `orders.list`, getOrderById is `orders.get-by-id`). Without an id: the method and path (`GET /orders/{id}` is `orders.get`), with a warning suggesting a rename. |
| `title`, `description`                   | The operation's summary and description. A summary of 40 characters or more stands in for a missing description.                                                                                                                                                                                                                |
| `readOnly`, `idempotent`, `reversible`   | `readOnly` for GET and HEAD; `idempotent` for GET, HEAD, PUT, DELETE; `reversible` only for reads. The document cannot say whether a POST can be undone, so the generator does not claim it.                                                                                                                                       |
| `risk`                                   | GET and HEAD `low`, POST, PUT, PATCH `medium`, DELETE `high`. Reads are `low` rather than `none` because the generator cannot tell public data from a customer's order history; say `none` in an override for public reads. The `risk` option changes the table.                                                                   |
| `auth`                                   | `none` when the operation has no security requirement. Otherwise `site` for an API-key scheme and `user` for HTTP, OAuth 2, and OpenID Connect schemes; the auth `mode` option overrides. The mode must be in the server's `auth.modes`.                                                                                        |
| `input`                                  | Path, query, and header parameters plus the properties of the JSON request body, as one strict object. A body that is not an object, or whose properties collide with a parameter, is nested under `body`. Cookie parameters and non-JSON bodies are reported and skipped.                                                     |
| `output`                                 | The schema of the lowest 2xx response with JSON content. A non-object response (an array) is wrapped as `{ result }`. No content, as for 204, is an empty object.                                                                                                                                                                 |
| handler                                  | Builds the URL from the path template and query parameters, sends header parameters and the JSON body, and returns the parsed response. Non-2xx statuses become AXE errors: 400 and 422 `invalid_input`, 401 `unauthorized`, 403 `forbidden`, 404 and 410 `not_found`, 409 `conflict`, 429 `rate_limited`, 5xx `unavailable`. The upstream status and body are in `details`. |
| deprecated operations                    | Left out with a warning; `includeDeprecated` keeps them.                                                                                                                                                                                                                                                                        |

The action's `input` is validated before the handler runs, so a request the document rejects never reaches the upstream.

### Upstream authentication

The handler sends no credentials unless you say how. `auth.forward` copies the `Authorization` header of the AXE request to the upstream call, which is right when the agent's bearer token is the customer's own API token. `auth.token` produces the header value from the handler context instead, for a service token or a per-user exchange. `headers` adds static headers or computes them per call.

### Overrides

Overrides are keyed by the generated action name or by the source reference, and are applied before the lints run:

<!-- include: examples/generating/openapi.ts#overrides -->
```ts
overrides: {
  // GET /products had no description in the document. Write it here, not in the generator.
  "products.list": {
    description:
      "Searches the catalog by free text. Returns up to 100 products with SKU, name, and price in USD.",
    risk: "none",
    display: {
      kind: "list",
      items: "/result",
      item: { id: "/sku", title: "/name", url: "/url" },
      disclaimer: "Prices exclude tax and shipping.",
    },
  },
  // Not for agents, at least not yet.
  "orders.delete": { exclude: true },
  // No operationId in the document; the derived name reads badly.
  "POST /products/{sku}/reviews": { name: "reviews.create" },
},
```
<!-- /include -->

An override can set any action member the document cannot express: `description`, `title`, `risk`, `display`, `affordances`, `pagination`, `freshness`, `examples`, `auth`, the flags. `name` renames; `exclude` leaves the action out. An override that matches nothing is itself a warning.

### Policy

Policy applies to every candidate from every source:

<!-- include: examples/generating/openapi.ts#policy -->
```ts
policy: {
  // First rollout: nothing that moves money or cannot be undone.
  maxRisk: "medium",
  exclude: ["*.internal-*", /^admin\./],
},
```
<!-- /include -->

`exclude` and `include` match names and source references with `*` wildcards or regular expressions. `maxRisk` leaves out anything above a level. `defaultRisk` is a value or a function for candidates whose source did not decide. `requireInputDescriptions` turns the input-description lint into an exclusion, for teams that want every field described before an agent sees it.

### The schema converter

OpenAPI carries JSON Schema; the SDK wants Zod, because the runtime validates with it and `z.toJSONSchema` produces the manifest. The in-house converter handles the subset documents use in practice: objects with required and additional properties, arrays, strings with enum, const, format (date-time, date, time, email, uri, uuid), length and pattern, numbers and integers with bounds, booleans, null, nullability in both the 3.0 and 3.1 spellings, local `$ref`, a shallow allOf merge of object members, and anyOf or oneOf as unions. Descriptions and defaults carry over.

Anything else, a recursive `$ref`, an allOf mixing types, a schema with no type, becomes `z.unknown()` with a warning that names the exact path, so you can see which part of an input an agent will not be told about. Width was traded for that visibility on purpose; the reasoning is in [DECISIONS.md](../DECISIONS.md#generate).

### The command

`axe generate` runs the same source from the command line, prints the actions and the warnings, and writes files for review:

```sh
npx @summationai/axe@latest generate openapi.json --base-url https://api.northwind.example/v1 --out axe.json --code axe.ts
```

`--out` writes a static manifest JSON with the generated actions and the document's title and description, so a reviewer can read what agents would see without running anything. `--code` writes an `axe.ts` that calls `fromOpenAPI` with an overrides block holding one TODO per operation that was left out, and comments marking the members you still have to decide (the server's own `baseUrl`, the login URL for `user` mode). Run `axe validate axe.ts` when the TODOs are gone. `--json` prints everything as one JSON object for tooling.

The command reads JSON. The repository carries no YAML parser as a direct dependency, and a YAML library is not small; convert once (`npx js-yaml openapi.yaml > openapi.json`) and pass the JSON file.

## From a function table

When the operations are functions with Zod schemas, the table is the definition:

<!-- include: examples/generating/functions.ts#table -->
```ts
const Class = z.object({ id: z.string(), title: z.string(), startsAt: z.string() });

const generated = generate([
  fromFunctions({
    "classes.search": {
      title: "Search upcoming classes",
      description:
        "Find classes on or after a date. Returns up to 50 classes with start time, instructor, and spots left.",
      readOnly: true,
      input: z.object({ from: z.string().date().describe("Earliest date, YYYY-MM-DD") }),
      output: z.object({ classes: z.array(Class) }),
      handler: async ({ from }) => ({ classes: await findClasses(from) }),
    },
    "classes.book": {
      description:
        "Books one spot in a class for the signed-in member. Free cancellation until two hours before the class starts.",
      risk: "medium",
      reversible: true,
      auth: "user",
      input: z.object({ classId: z.string().describe("Class id from classes.search") }),
      output: z.object({ bookingId: z.string() }),
      handler: ({ classId }, ctx) => bookClass(classId, ctx.context.onBehalfOf!),
    },
  }),
]);

registerGenerated(axe, generated);
```
<!-- /include -->

Each entry is what `action` takes minus the name, with three differences. The handler receives `input` first and the AXE context second, so an existing function slots in without a wrapper. `output` is optional; without it the action declares an open object and a warning says agents are not told the result shape. `risk` is optional for reads, which default to `low`; a mutation without a risk is left out unless `defaultRisk` decides, because the generator will not guess how consequential your function is.

## From a tRPC router

The adapter reads the router's flat procedure table and calls procedures through the router's own caller, so the procedures' middleware and context stay in charge:

<!-- include: examples/generating/trpc.ts#router -->
```ts
import { fromTRPCRouter, generate } from "@summationai/axe-generate";
import type { TRPCRouterLike } from "@summationai/axe-generate";

// Your router, for example `export const appRouter = router({ classes: router({ ... }) })`.
// The adapter needs only `_def.procedures` and `createCaller`, so no tRPC types are imported here.
declare const appRouter: TRPCRouterLike<{ memberId: string | null }>;

export const generated = generate([
  fromTRPCRouter(appRouter, {
    // The tRPC context for a call, built from the AXE handler context.
    createContext: (ctx) => ({ memberId: ctx.context.onBehalfOf ?? null }),
  }),
]);
```
<!-- /include -->

Queries become read actions; mutations become mutating actions and need a `risk`; subscriptions are skipped with a warning. tRPC has no place for a description, so the adapter reads the procedure's meta:

<!-- include: examples/generating/trpc.ts#meta -->
```ts
// In the router, the procedure's meta carries what AXE needs and tRPC does not ask for:
//
//   book: publicProcedure
//     .meta({
//       description:
//         "Books one spot in a class for the signed-in member. Free cancellation until two hours before.",
//       risk: "medium",
//       reversible: true,
//     })
//     .input(z.object({ classId: z.string() }))
//     .output(z.object({ bookingId: z.string() }))
//     .mutation(({ input, ctx }) => bookClass(input.classId, ctx.memberId)),
```
<!-- /include -->

Procedure paths with a dot are used as action names as they are (`classes.book`); single-segment paths are namespaced. Inputs must be Zod objects, as for any action; a procedure whose input is a bare string is reported and skipped. Nothing from tRPC is imported: the adapter is typed against the shape of the procedure table and the caller factory that v10 and v11 share. If a future version changes that shape, feed the procedures' schemas and functions to `fromFunctions` instead.

## Writing a source

A source is an object with a name and a method that yields candidates. A candidate is an action spec whose honesty fields may be missing, plus provenance. `generate` does the rest: overrides, policy, the completeness check, the lints.

<!-- include: examples/generating/custom-source.ts#source -->
```ts
import { z } from "@summationai/axe-core";
import type { ActionSource, GeneratedAction } from "@summationai/axe-generate";

interface Command {
  id: string;
  summary?: string;
  help?: string;
  params: z.ZodObject;
  mutates: boolean;
  run: (params: unknown) => Promise<unknown>;
}

export function fromCommands(commands: Command[]): ActionSource {
  return {
    source: "commands",
    actions: () =>
      commands.map((c): GeneratedAction => ({
        name: `tools.${c.id}`,
        spec: {
          title: c.summary ?? c.id,
          // Leave description out when the registry has none: generate() reports the gap
          // and leaves the action out until an override fills it.
          ...(c.help ? { description: c.help } : {}),
          input: c.params,
          output: z.object({ result: z.unknown() }),
          readOnly: !c.mutates,
          handler: async ({ input }) => ({ result: await c.run(input) }),
        },
        provenance: { source: "commands", ref: c.id },
      })),
  };
}
```
<!-- /include -->

A source can also return `{ actions, warnings }` to report things about the source as a whole, such as a definition it could read but not use.

## Keeping the manifest honest

Generation removes the copy; it does not remove the review. Three habits keep the result trustworthy:

- **Regenerate on every build.** Load the document or the table at startup and call `generate` there, as the examples do. A manifest committed once and generated never is a hand-written manifest with extra steps.
- **Treat every warning as a decision.** A missing description is a question for the person who owns the operation, not a string for the generator. `formatWarnings` prints them one per line; fail the build on `dropped` warnings once the initial review is done.
- **Run `axe validate` and `axe audit`.** The generated actions are ordinary actions. Parity between what the API returns and what a human sees at `display.item.url` is still checked by the audit, and still yours to keep.

## Next steps

- [Designing actions](designing-actions.md) for what the overrides should say: descriptions written for a model, choosing risk, designing read actions.
- [Presenting results](presenting-results.md) for the `display` an override adds to a read action.
- [Surface](surface.md) for the other half of the same idea: when the definition is a running application's live controls rather than a document.
- [Audit](audit.md) for the honesty rules the generator enforces and the parity check it cannot.
