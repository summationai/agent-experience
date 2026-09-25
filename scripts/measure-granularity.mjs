#!/usr/bin/env node
// Measures the two Surface bridge granularities (review 2026-09-24, item 16) with scripted,
// deterministic runs: per control (`surfaceActions`) and per domain action (`domainActions`), over
// the same application, the same handlers, and the same state.
//
//   pnpm -r build && node scripts/measure-granularity.mjs            # writes the report
//   node scripts/measure-granularity.mjs --check                        # fails if the report differs
//
// Output: docs/review/2026-09-24/data/granularity.json and granularity.md.
//
// Everything here is a scripted measurement: byte counts of real payloads produced by the SDK
// (the AXE manifest, the derived MCP server's JSON-RPC messages over an in-memory transport, the
// observe output), counts of tools and notifications, and scripted agents whose success is checked
// against the application's state. No model is called. Token figures are an estimate, bytes / 4,
// and are labeled as such; they say nothing about how a model would choose or perform.
import { readFileSync, writeFileSync, mkdirSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const dist = (pkg, file) => pathToFileURL(join(root, "packages", pkg, "dist", file)).href;
const sdk = (file) =>
  pathToFileURL(
    join(
      realpathSync(join(root, "packages/mcp/node_modules/@modelcontextprotocol/sdk")),
      "dist/esm",
      file,
    ),
  ).href;

const { createAXE, toJsonSchema } = await import(dist("core", "index.js"));
const { accept, kinds } = await import(dist("core", "kinds.js"));
const { createSurface } = await import(dist("surface", "index.js"));
const { surfaceActions, domainActions } = await import(dist("surface", "axe.js"));
const { createMcpServer } = await import(dist("mcp", "index.js"));
const { Client } = await import(sdk("client/index.js"));
const { InMemoryTransport } = await import(sdk("inMemory.js"));
const { ToolListChangedNotificationSchema } = await import(sdk("types.js"));

const CHECK = process.argv.includes("--check");
const OUT_DIR = join(root, "docs/review/2026-09-24/data");
const SIZES = [5, 50, 300, 1000];
const MODES = ["control", "domain"];
const BASE = "https://plan.example";
const bytes = (value) =>
  Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value));
const tokens = (b) => Math.round(b / 4);
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Deterministic PRNG (mulberry32), so every run makes the same choices. */
function prng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------------------------
// The application: a demand plan. Each product row has ten controls: six monthly demand fields,
// a lock switch, an approval (needs consent on some rows), a publish button (a human sign-off
// with a page on unapproved rows), and a change history that can load more on most rows. Every
// fourth row is locked (its fields read only), every fifth row unapproved, every third row's
// history fully loaded. A surface of n controls is the first n controls in row order.
// ---------------------------------------------------------------------------------------------
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun"];
const PER_ROW = 10;

function buildApp(n) {
  const surface = createSurface({ app: "plan", now: () => new Date(0), toJsonSchema });
  const rows = new Map();
  let count = 0;
  const rowState = (r) => {
    if (!rows.has(r))
      rows.set(r, {
        locked: r % 4 === 3,
        approved: r % 5 !== 4,
        consented: false,
        published: false,
        loaded: r % 3 === 2 ? 30 : 10,
        demand: MONTHS.map((_, i) => 100 + r + i),
        present: true,
      });
    return rows.get(r);
  };
  const controlsFor = (r) => {
    const st = rowState(r);
    const product = `Widget ${r}`;
    const object = `row:${r}`;
    const sync = () => registerRow(r);
    const out = MONTHS.map((m, i) => ({
      id: `demand:${r}:${m}`,
      kind: "field",
      role: "textbox",
      name: `Demand for ${product}, ${m}`,
      object,
      value: String(st.demand[i]),
      edit: st.locked
        ? { readOnly: true, reason: `${product} is locked for the quarter` }
        : {
            maxLength: 7,
            schema: { type: "string", pattern: "^[0-9]{1,7}$" },
            set: (text) => {
              st.demand[i] = Number(text);
              sync();
              surface.bump();
            },
          },
    }));
    out.push({
      id: `lock:${r}`,
      kind: "action",
      role: "switch",
      name: st.locked ? `Unlock ${product}` : `Lock ${product}`,
      object,
      state: { available: true },
      effect: { mutates: "locks", idempotent: true, reversible: true, risk: "medium" },
      handler: () => {
        st.locked = !st.locked;
        sync();
        surface.bump();
      },
    });
    out.push({
      id: `approve:${r}`,
      kind: "action",
      role: "button",
      name: `Approve ${product}`,
      object,
      state: st.approved
        ? { available: false, reason: `${product} is already approved` }
        : st.consented
          ? { available: true }
          : {
              available: false,
              reason: `${product} needs the planner's recorded consent`,
              requires: {
                accepts: [
                  accept(kinds.consent.terms, {
                    description: "The planner's consent to the quarter's terms.",
                  }),
                ],
                fulfill: () => {
                  st.consented = true;
                  sync();
                  surface.bump();
                },
              },
            },
      effect: { mutates: "approvals", idempotent: true, reversible: false, risk: "medium" },
      handler: () => {
        st.approved = true;
        sync();
        surface.bump();
      },
    });
    out.push({
      id: `publish:${r}`,
      kind: "action",
      role: "button",
      name: `Publish ${product}`,
      object,
      state:
        st.approved && !st.published
          ? { available: true }
          : st.published
            ? { available: false, reason: `${product} is already published` }
            : {
                available: false,
                reason: `${product} needs the planner's sign-off`,
                handoff: {
                  reason: "signoff_required",
                  instructions: `Open ${product} in the plan and press Sign off.`,
                  url: `${BASE}/rows/${r}/signoff`,
                  whatAgentShouldSayToUser: `${product} needs your sign-off before it can be published.`,
                },
              },
      effect: { mutates: "publications", idempotent: false, reversible: false, risk: "high" },
      handler: () => {
        st.published = true;
        sync();
        surface.bump();
      },
    });
    out.push({
      id: `history:${r}`,
      kind: "collection",
      role: "list",
      name: `Change history of ${product}`,
      object,
      total: 30,
      loaded: st.loaded,
      ...(st.loaded < 30
        ? {
            more: () => {
              st.loaded = Math.min(30, st.loaded + 10);
              sync();
              surface.bump();
            },
          }
        : {}),
    });
    return out;
  };
  // A row registers its controls up to the surface's size; a row added later registers all ten.
  const limits = new Map();
  function registerRow(r) {
    const list = controlsFor(r).slice(0, limits.get(r) ?? PER_ROW);
    for (const e of list) surface.register(e);
  }
  for (let r = 0; count < n; r++) {
    const take = Math.min(PER_ROW, n - count);
    limits.set(r, take);
    registerRow(r);
    count += take;
  }
  surface.setObjects(() => ({ quarter: "2026-Q1", rows: rows.size }));
  const removeRow = (r) => {
    const st = rows.get(r);
    if (!st) return;
    st.present = false;
    surface.reconcile(`demand:${r}:`, new Set());
    for (const p of ["lock", "approve", "publish", "history"]) surface.unregister(`${p}:${r}`);
    surface.bump();
  };
  const addRow = (r) => {
    limits.set(r, PER_ROW);
    rowState(r).present = true;
    registerRow(r);
    surface.bump();
  };
  const human = {
    edit: (r, i, v) => {
      const st = rowState(r);
      st.demand[i] = v;
      registerRow(r);
      surface.bump();
    },
    lock: (r) => {
      const st = rowState(r);
      st.locked = !st.locked;
      registerRow(r);
      surface.bump();
    },
    approve: (r) => {
      const st = rowState(r);
      st.approved = true;
      registerRow(r);
      surface.bump();
    },
  };
  return {
    surface,
    rows,
    rowState,
    registerRow,
    removeRow,
    addRow,
    human,
    rowCount: () => limits.size,
  };
}

function serve(app, mode) {
  const axe = createAXE({
    name: "Demand Plan",
    description:
      "A quarterly demand plan: observe the product rows, change monthly demand, lock, approve, and publish rows.",
    baseUrl: BASE,
    auth: { modes: ["none"] },
    secret: "0123456789abcdef0123456789abcdef",
    revision: app.surface.currentRev,
  });
  // Public on purpose: the measurement is about shape, not authorization, and an anonymous
  // manifest then carries each action's live availability as a signed-in agent would see it.
  const bridge =
    mode === "control"
      ? surfaceActions(app.surface, { namespace: "plan", auth: "none", onError: () => undefined })
      : domainActions(app.surface, { namespace: "plan", auth: "none", onError: () => undefined });
  axe.addProvider(bridge);
  return { axe, bridge };
}

/** An MCP client over an in-memory transport, counting the bytes of every JSON-RPC message. */
async function mcpClient(axe) {
  const derived = await createMcpServer(axe, { elicitation: false, apps: false });
  const [clientT, serverT] = InMemoryTransport.createLinkedPair();
  const meter = { sent: 0, read: 0, calls: 0, notifications: 0 };
  const serverSend = serverT.send.bind(serverT);
  serverT.send = (message, options) => {
    meter.read += bytes(message);
    return serverSend(message, options);
  };
  const clientSend = clientT.send.bind(clientT);
  clientT.send = (message, options) => {
    meter.sent += bytes(message);
    if (message.method && message.id !== undefined) meter.calls++;
    return clientSend(message, options);
  };
  await derived.server.connect(serverT);
  const client = new Client({ name: "measure", version: "0" });
  client.setNotificationHandler(ToolListChangedNotificationSchema, () => {
    meter.notifications++;
  });
  await client.connect(clientT);
  const reset = () => Object.assign(meter, { sent: 0, read: 0, calls: 0 });
  return { client, meter, reset, close: () => client.close() };
}

async function post(axe, name, input, extra = {}) {
  const res = await axe.handle(
    new Request(`${BASE}/axe/actions/${name}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ input, ...extra }),
    }),
  );
  const text = await res.text();
  return { body: JSON.parse(text), bytes: bytes(text) };
}

/** Every page of `<ns>.observe` at the largest page size, and the default first page. */
async function observeSizes(axe) {
  const first = await post(axe, "plan.observe", {});
  let total = 0;
  let pages = 0;
  let cursor;
  const max = axe.describe().actions.find((a) => a.name === "plan.observe").pagination.pageSize.max;
  do {
    const page = await post(axe, "plan.observe", cursor ? { cursor, limit: max } : { limit: max });
    total += page.bytes;
    pages++;
    cursor = page.body.output.nextCursor;
  } while (cursor);
  return {
    firstPageBytes: first.bytes,
    firstPageRows: first.body.output.entries.length,
    fullBytes: total,
    fullPages: pages,
    rows: first.body.output.total,
  };
}

const toolKey = (t) => JSON.stringify([t.description, t.inputSchema, t.annotations]);

function diffTools(before, after) {
  const a = new Map(before.map((t) => [t.name, toolKey(t)]));
  const b = new Map(after.map((t) => [t.name, toolKey(t)]));
  let added = 0;
  let removed = 0;
  let changed = 0;
  for (const [name, key] of b) {
    if (!a.has(name)) added++;
    else if (a.get(name) !== key) changed++;
  }
  for (const name of a.keys()) if (!b.has(name)) removed++;
  return { added, removed, changed, total: added + removed + changed };
}

// ---------------------------------------------------------------------------------------------
// 1. Static sizes: manifest, tools/list, observe.
// ---------------------------------------------------------------------------------------------
async function staticSizes(n, mode) {
  const app = buildApp(n);
  const { axe } = serve(app, mode);
  const manifest = await axe.describeLive();
  const mcp = await mcpClient(axe);
  mcp.reset();
  const { tools } = await mcp.client.listTools();
  const toolsListBytes = mcp.meter.read;
  const observe = await observeSizes(axe);
  await mcp.close();
  return {
    controls: app.surface.entries().length,
    manifestBytes: bytes(manifest),
    manifestActions: manifest.actions.length,
    toolsListBytes,
    tools: tools.length,
    ...observe,
  };
}

// ---------------------------------------------------------------------------------------------
// 2. Churn: one row registers, one row unregisters, one availability flip; then a scripted
// sequence of 50 UI changes. After each change the client lists the tools again and the diff is
// counted; notifications are counted as the client receives them.
// ---------------------------------------------------------------------------------------------
async function churn(n, mode) {
  const app = buildApp(n);
  const { axe } = serve(app, mode);
  const mcp = await mcpClient(axe);
  const list = async () => (await mcp.client.listTools()).tools;
  const step = async (change) => {
    const before = await list();
    const n0 = mcp.meter.notifications;
    change();
    await tick();
    await tick();
    const after = await list();
    return { ...diffTools(before, after), notifications: mcp.meter.notifications - n0 };
  };
  const rowsNow = app.rowCount();
  const addOne = await step(() => app.addRow(rowsNow));
  const removeOne = await step(() => app.removeRow(rowsNow));
  const flip = await step(() => app.human.lock(0));

  // 50 changes a person makes in the UI, chosen by a seeded PRNG.
  const rand = prng(16);
  const present = () => [...app.rows.entries()].filter(([, s]) => s.present).map(([r]) => r);
  let next = app.rowCount() + 1;
  const kindsOfChange = { edit: 0, lock: 0, approve: 0, add: 0, remove: 0, freeze: 0 };
  let notifications = 0;
  let idleNotifications = 0;
  let toolsChanged = 0;
  let relistBytes = 0;
  const sizes = [];
  for (let i = 0; i < 50; i++) {
    const x = rand();
    const rs = present();
    const r = rs[Math.floor(rand() * rs.length)] ?? 0;
    let change;
    let kind;
    if (x < 0.4) {
      kind = "edit";
      change = () => app.human.edit(r, Math.floor(rand() * 6), Math.floor(rand() * 1000));
    } else if (x < 0.6) {
      kind = "lock";
      change = () => app.human.lock(r);
    } else if (x < 0.75) {
      kind = "approve";
      change = () => app.human.approve(r);
    } else if (x < 0.85) {
      kind = "add";
      const at = next++;
      change = () => app.addRow(at);
    } else if (x < 0.95) {
      kind = rs.length > 1 ? "remove" : "edit";
      change = rs.length > 1 ? () => app.removeRow(r) : () => app.human.edit(r, 0, 1);
    } else {
      kind = "freeze";
      change = () => {
        const thaw = app.surface.freeze("saving the plan");
        thaw();
      };
    }
    kindsOfChange[kind]++;
    const before = mcp.meter.read;
    const d = await step(change);
    notifications += d.notifications;
    if (d.notifications > 0 && d.total === 0) idleNotifications += d.notifications;
    toolsChanged += d.total;
    // An agent that lists the tools again on every notification reads this much.
    if (d.notifications > 0) relistBytes += mcp.meter.read - before;
    sizes.push(d.total);
  }
  await mcp.close();
  return {
    rowRegisters: addOne,
    rowUnregisters: removeOne,
    availabilityFlip: flip,
    sequence: {
      changes: 50,
      kinds: kindsOfChange,
      listChangedNotifications: notifications,
      notificationsWithNoToolChange: idleNotifications,
      toolsChanged,
      relistBytesOnNotification: relistBytes,
      maxToolsChangedInOneStep: Math.max(...sizes),
    },
  };
}

// ---------------------------------------------------------------------------------------------
// 3 and 4. Scripted agents: discovery cost and five tasks. Each agent reads the tool list once,
// then per task observes (filtered by the control's name, or the whole table), acts with the
// observed rev, and continues a needs_input with a payload. Success is checked against the
// application's state, never the agent's report.
// ---------------------------------------------------------------------------------------------
const structured = (r) => r.structuredContent ?? {};

function consentPayload() {
  return {
    policyUrl: `${BASE}/terms`,
    policyVersion: "2026-Q1",
    scope: "quarter-approval",
    acceptedAt: "2026-01-01T00:00:00Z",
  };
}

/** Runs one agent over the tasks; returns per-task calls, bytes, and verified outcomes. */
async function runAgent(n, mode, strategy, tasks) {
  const app = buildApp(n);
  const { axe } = serve(app, mode);
  const mcp = await mcpClient(axe);
  mcp.reset();
  const { tools } = await mcp.client.listTools();
  const listRead = mcp.meter.read;
  const listSent = mcp.meter.sent;
  const byTitle = new Map(tools.map((t) => [t.title, t.name]));
  const results = [];
  for (const task of tasks(app)) {
    mcp.reset();
    // Observe: the whole table (the one read before this item) or the rows named like the control.
    const obs = await mcp.client.callTool({
      name: "plan_observe",
      arguments: strategy === "full" ? {} : { query: task.control },
    });
    const view = structured(obs).output ?? {};
    const row = (view.entries ?? []).find((e) => e.name === task.control);
    const rev = structured(obs).rev ?? view.rev;
    let status = "not-found";
    if (row) {
      const affordance = row._axe?.affordances?.[0];
      const name =
        mode === "control"
          ? byTitle.get(task.control)
          : affordance
            ? affordance.action.replace(/\./g, "_")
            : task.fallbackTool;
      const args = mode === "control" ? { ...task.input } : { entryId: row.id, ...task.input };
      const r = await mcp.client.callTool({ name, arguments: { ...args, expectedRev: rev } });
      const env = structured(r);
      status = env.status ?? (r.isError ? "error" : "ok");
      if (status === "needs_input" && task.payload) {
        const c = await mcp.client.callTool({
          name: "axe_continue",
          arguments: {
            continuationToken: env.continuationToken,
            kind: env.accepts[0].kind,
            payload: task.payload,
          },
        });
        status = `needs_input>${structured(c).status ?? "error"}`;
      }
    }
    results.push({
      task: task.label,
      status,
      verified: task.verify(app, status),
      calls: mcp.meter.calls,
      bytesRead: mcp.meter.read,
      bytesSent: mcp.meter.sent,
    });
  }
  await mcp.close();
  return { toolsListRead: listRead, toolsListSent: listSent, tools: tools.length, results };
}

/** The five tasks, on rows every surface of 50 controls or more holds (row 1 and row 4). */
function fiveTasks() {
  const r1 = 1;
  const r4 = 4;
  return [
    {
      label: "set a demand field",
      control: `Demand for Widget ${r1}, Mar`,
      input: { text: "4200" },
      fallbackTool: "plan_set-field",
      verify: (a, s) => s === "ok" && a.rowState(r1).demand[2] === 4200,
    },
    {
      label: "lock a row",
      control: `Lock Widget ${r1}`,
      input: {},
      fallbackTool: "plan_run-control",
      verify: (a, s) => s === "ok" && a.rowState(r1).locked === true,
    },
    {
      label: "load more history",
      control: `Change history of Widget ${r1}`,
      input: {},
      fallbackTool: "plan_load-more",
      verify: (a, s) => s === "ok" && a.rowState(r1).loaded === 20,
    },
    {
      label: "publish without sign-off (needs_human, nothing applied)",
      control: `Publish Widget ${r4}`,
      input: {},
      fallbackTool: "plan_run-control",
      verify: (a, s) => s === "needs_human" && a.rowState(r4).published === false,
    },
    {
      label: "approve with consent (needs_input, continue)",
      control: `Approve Widget ${r4}`,
      input: {},
      payload: consentPayload(),
      fallbackTool: "plan_run-control",
      verify: (a, s) => s === "needs_input>ok" && a.rowState(r4).approved === true,
    },
  ];
}

/** Discovery: bytes read before the first correct act (list tools, observe, act) for one task. */
async function discovery(n, mode, strategy) {
  const task = () => [
    {
      label: "set a demand field",
      control: `Demand for Widget 0, Feb`,
      input: { text: "777" },
      fallbackTool: "plan_set-field",
      verify: (a, s) => s === "ok" && a.rowState(0).demand[1] === 777,
    },
  ];
  const run = await runAgent(n, mode, strategy, task);
  const t = run.results[0];
  return {
    calls: 1 + t.calls,
    bytesRead: run.toolsListRead + t.bytesRead,
    bytesSent: run.toolsListSent + t.bytesSent,
    verified: t.verified,
  };
}

// ---------------------------------------------------------------------------------------------
// 5. Two actors under one revision: a person edits while an agent acts on a row it observed
// earlier. Each trial: the agent observes (rev r), the person makes k edits (k drawn from the
// PRNG with the given mean), the agent acts on its target at rev r. A conflict is related when a
// person's edit touched the agent's target entry or another entry of the same row (shared state
// the application could derive from), unrelated otherwise.
// ---------------------------------------------------------------------------------------------
async function twoActors(mode, meanEdits, trials = 400, n = 300) {
  const app = buildApp(n);
  const { axe, bridge } = serve(app, mode);
  const rand = prng(1600 + Math.round(meanEdits * 10));
  const rowsWithFields = [...app.rows.keys()].filter((r) => !app.rowState(r).locked);
  const counts = { acts: 0, ok: 0, conflict: 0, related: 0, unrelated: 0, other: 0 };
  for (let t = 0; t < trials; t++) {
    const target = rowsWithFields[Math.floor(rand() * rowsWithFields.length)];
    const month = Math.floor(rand() * 6);
    const id = `demand:${target}:${MONTHS[month]}`;
    const rev = app.surface.currentRev();
    // Poisson-distributed number of the person's edits in the agent's think time.
    let k = 0;
    for (let p = Math.exp(-meanEdits), s = p, u = rand(); u > s; k++) {
      p *= meanEdits / (k + 1);
      s += p;
    }
    let related = false;
    for (let e = 0; e < k; e++) {
      const r = rand() < 0.1 ? target : rowsWithFields[Math.floor(rand() * rowsWithFields.length)];
      const m = Math.floor(rand() * 6);
      app.human.edit(r, m, Math.floor(rand() * 1000));
      if (r === target) related = true;
    }
    const name = mode === "control" ? bridge.actionNameFor(id) : bridge.actionFor(id);
    const input = mode === "control" ? { text: "500" } : { entryId: id, text: "500" };
    const { body } = await post(axe, name, input, {
      expectedRev: rev,
      idempotencyKey: `trial-${mode}-${meanEdits}-${t}`,
    });
    counts.acts++;
    if (body.status === "ok") counts.ok++;
    else if (body.status === "error" && body.error.code === "conflict") {
      counts.conflict++;
      if (related) counts.related++;
      else counts.unrelated++;
    } else counts.other++;
  }
  return {
    meanEdits,
    ...counts,
    conflictRate: +(counts.conflict / counts.acts).toFixed(3),
    unrelatedShareOfConflicts: counts.conflict
      ? +(counts.unrelated / counts.conflict).toFixed(3)
      : 0,
    unrelatedRate: +(counts.unrelated / counts.acts).toFixed(3),
  };
}

// ---------------------------------------------------------------------------------------------
// Run everything and write the report.
// ---------------------------------------------------------------------------------------------
const report = {
  title: "Surface bridge granularity: scripted measurements",
  note: "Deterministic scripted measurements of payloads the SDK produces, not model performance. Token figures are an estimate (bytes / 4). The application is public (auth none) so an anonymous manifest carries live availability; MCP payloads are JSON-RPC messages over an in-memory transport, elicitation and the Apps view off.",
  sizes: SIZES,
  static: {},
  churn: {},
  discovery: {},
  tasks: {},
  twoActors: [],
};

for (const n of SIZES) {
  report.static[n] = {};
  report.churn[n] = {};
  report.discovery[n] = {};
  for (const mode of MODES) {
    report.static[n][mode] = await staticSizes(n, mode);
    report.churn[n][mode] = await churn(n, mode);
    report.discovery[n][mode] = await discovery(n, mode, "filtered");
  }
  report.discovery[n]["control-full-observe"] = await discovery(n, "control", "full");
}
for (const n of [50, 300, 1000]) {
  report.tasks[n] = {};
  for (const mode of MODES) {
    const run = await runAgent(n, mode, "filtered", fiveTasks);
    const sum = (k) => run.results.reduce((a, r) => a + r[k], 0);
    report.tasks[n][mode] = {
      toolsListRead: run.toolsListRead,
      tools: run.tools,
      calls: 1 + sum("calls"),
      bytesRead: run.toolsListRead + sum("bytesRead"),
      bytesSent: run.toolsListSent + sum("bytesSent"),
      succeeded: run.results.filter((r) => r.verified).length,
      results: run.results,
    };
  }
}
for (const mean of [0.25, 1, 3])
  for (const mode of MODES) report.twoActors.push({ mode, ...(await twoActors(mode, mean)) });

// ---------------------------------------------------------------------------------------------
// Markdown.
// ---------------------------------------------------------------------------------------------
const kb = (b) => (b >= 10240 ? `${(b / 1024).toFixed(0)} KB` : `${(b / 1024).toFixed(1)} KB`);
const tk = (b) => `~${tokens(b).toLocaleString("en-US")}`;
const lines = [];
lines.push(`# ${report.title}`, "");
lines.push(
  "Generated by `node scripts/measure-granularity.mjs` from the built packages. Deterministic: the same checkout produces the same numbers (`--check` verifies). These are scripted measurements of payload sizes, tool counts, notifications, and scripted agents checked against application state. They are not model performance: no model was called, and token counts are an estimate, bytes / 4.",
  "",
  "The application is a demand plan whose rows have ten controls each: six monthly demand fields, a lock switch, an approval that needs consent on unapproved rows, a publish button that needs a human sign-off (with a page) on unapproved rows, and a change history that can load more. Every fourth row is locked, every fifth unapproved, every third history fully loaded. A surface of n controls is the first n controls in row order. `control` is `surfaceActions` (one action per control); `domain` is `domainActions` with its default actions (`set-field`, `run-control`, `load-more`). Both serve the same surface and the same handlers.",
  "",
);
lines.push("## Sizes", "");
lines.push(
  "| Controls | Mode | Manifest | Manifest tokens (est.) | Actions | MCP tools | tools/list | tools/list tokens (est.) | Observe, first page | Rows on first page | Observe, every page | Pages |",
  "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const n of SIZES)
  for (const mode of MODES) {
    const s = report.static[n][mode];
    lines.push(
      `| ${s.controls} | ${mode} | ${kb(s.manifestBytes)} | ${tk(s.manifestBytes)} | ${s.manifestActions} | ${s.tools} | ${kb(s.toolsListBytes)} | ${tk(s.toolsListBytes)} | ${kb(s.firstPageBytes)} | ${s.firstPageRows} | ${kb(s.fullBytes)} | ${s.fullPages} |`,
    );
  }
lines.push("");
lines.push("## Churn", "");
lines.push(
  "Tools changed = tools added, removed, or whose description, input schema, or annotations changed between two `tools/list` calls around the change. Notifications = `notifications/tools/list_changed` the client received. A row is ten controls. The availability flip locks a row (its six fields become read only). The sequence is 50 changes a person makes, drawn by a seeded PRNG: demand edits, locks, approvals, rows added and removed, a freeze and thaw.",
  "",
  "| Controls | Mode | Row registers: tools changed / notifications | Row unregisters | Availability flip | 50 changes: notifications | of which no tool changed | 50 changes: tools changed | Re-list bytes on notification |",
  "| ---: | --- | --- | --- | --- | ---: | ---: | ---: | ---: |",
);
for (const n of SIZES)
  for (const mode of MODES) {
    const c = report.churn[n][mode];
    const f = (d) => `${d.total} / ${d.notifications}`;
    lines.push(
      `| ${report.static[n][mode].controls} | ${mode} | ${f(c.rowRegisters)} | ${f(c.rowUnregisters)} | ${f(c.availabilityFlip)} | ${c.sequence.listChangedNotifications} | ${c.sequence.notificationsWithNoToolChange} | ${c.sequence.toolsChanged} | ${kb(c.sequence.relistBytesOnNotification)} |`,
    );
  }
lines.push("");
lines.push("## Discovery cost", "");
lines.push(
  "Bytes the agent reads before its first correct act, for one task (set one demand field): list the tools, observe, act. `filtered` observes with `query` set to the control's name; `control-full-observe` is the per-control agent reading the whole table, which was the only observe before this item. Verified against the application's state.",
  "",
  "| Controls | Agent | Calls | Bytes read | Tokens read (est.) | Bytes sent | Verified |",
  "| ---: | --- | ---: | ---: | ---: | ---: | --- |",
);
for (const n of SIZES)
  for (const mode of [...MODES, "control-full-observe"]) {
    const d = report.discovery[n][mode];
    lines.push(
      `| ${report.static[n].control.controls} | ${mode === "control" ? "control, filtered" : mode === "domain" ? "domain, filtered" : mode} | ${d.calls} | ${kb(d.bytesRead)} | ${tk(d.bytesRead)} | ${kb(d.bytesSent)} | ${d.verified ? "yes" : "no"} |`,
    );
  }
lines.push("");
lines.push("## Five tasks", "");
lines.push(
  "One scripted agent per mode, the same five tasks against the same starting state: set a demand field, lock a row, load more history, publish a row that needs a human sign-off (needs_human, nothing applied), and approve that row, which needs consent (needs_input, then `axe_continue`). The agent lists the tools once, then per task observes with `query` set to the control's name and acts on the row with the observed rev. Success is checked against the application's state.",
  "",
  "| Controls | Mode | Tools | Calls | Bytes read | Tokens read (est.) | Bytes sent | Succeeded |",
  "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const n of Object.keys(report.tasks))
  for (const mode of MODES) {
    const t = report.tasks[n][mode];
    lines.push(
      `| ${n} | ${mode} | ${t.tools} | ${t.calls} | ${kb(t.bytesRead)} | ${tk(t.bytesRead)} | ${kb(t.bytesSent)} | ${t.succeeded} of 5 |`,
    );
  }
lines.push("");
lines.push("## Two actors under one revision", "");
lines.push(
  "400 trials on a 300-control surface. Per trial the agent observes, a person makes a Poisson-distributed number of demand edits (mean in the first column) on random unlocked rows (10% on the agent's row), then the agent sets one demand field at the revision it observed. A conflict is related when the person edited the agent's row (the same entry or an entry the application may derive from), unrelated otherwise. The global revision refuses both; a per-entry revision would have accepted the unrelated ones.",
  "",
  "| Person's edits per agent act (mean) | Mode | Acts | ok | Conflicts | Related | Unrelated | Conflict rate | Unrelated share of conflicts |",
  "| ---: | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
);
for (const r of report.twoActors)
  lines.push(
    `| ${r.meanEdits} | ${r.mode} | ${r.acts} | ${r.ok} | ${r.conflict} | ${r.related} | ${r.unrelated} | ${(r.conflictRate * 100).toFixed(1)}% | ${(r.unrelatedShareOfConflicts * 100).toFixed(1)}% |`,
  );
lines.push("");

const json = `${JSON.stringify(report, null, 2)}\n`;
const md = `${lines.join("\n")}`;
const jsonPath = join(OUT_DIR, "granularity.json");
const mdPath = join(OUT_DIR, "granularity.md");
if (CHECK) {
  const same = (p, text) => {
    try {
      return readFileSync(p, "utf8") === text;
    } catch {
      return false;
    }
  };
  if (!same(jsonPath, json) || !same(mdPath, md)) {
    console.error(
      "measure-granularity: the committed report differs; run node scripts/measure-granularity.mjs",
    );
    process.exit(1);
  }
  console.log("measure-granularity: report is current");
} else {
  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(jsonPath, json);
  writeFileSync(mdPath, md);
  console.log(md);
}
