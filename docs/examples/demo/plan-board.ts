// A runnable demo: one planning board shared by a person in a browser and an agent over MCP.
// The quick version; the full workflow (sessions, tenants, conditional writes, approvals bound to
// the call, browser tests) is the reference app in examples/plan-review (docs/reference-app.md).
//
//   pnpm install && pnpm -r build
//   node --import tsx docs/examples/demo/plan-board.ts        # http://localhost:4000
//
// Both participants act through the same door: the board's controls are registered once on a
// Surface, served as AXE actions, and the page's buttons call those same actions. Every act is
// revision-guarded and recorded in the ledger with who made it. Locking March needs the person's
// approval, which only the page can give, so an agent that tries is handed back to the human.
//
// The ledger is the board's one history. It holds every act through the controls, run or refused;
// the approval, which the app makes outside `act` and records itself (`surface.record`); and a
// stale call the server refuses before any control runs, which the bridge records on its own
// (`addProvider` wires its result hook). So every revision move has an entry.
//
// Two demo sessions, passed as bearer tokens (never use fixed tokens outside a local demo):
//   dana-browser  the person, used by the page
//   dana-agent    the agent acting for the same person, used by `axe mcp`
import express from "express";
import { createAXE } from "@axe/core";
import { axeExpress } from "@axe/express";
import { createSurface } from "@axe/surface";
import { surfaceActions } from "@axe/surface/axe";

const PORT = Number(process.env.PORT ?? 4000);
const BASE = `http://localhost:${PORT}`;
const SESSIONS: Record<string, string> = {
  "dana-browser": "dana",
  "dana-agent": "dana's agent",
};

type Month = { key: string; label: string; demand: number; locked: boolean; approved: boolean };
const months: Month[] = [
  { key: "2026-01", label: "January", demand: 4_200_000, locked: false, approved: true },
  { key: "2026-02", label: "February", demand: 3_900_000, locked: false, approved: true },
  { key: "2026-03", label: "March", demand: 4_450_000, locked: false, approved: false },
];

// The surface owns the revision here (bump); a server-state app would setRev its own counter.
const surface = createSurface({ app: "plan-board" });

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function sync(): void {
  for (const m of months) {
    surface.register({
      id: `demand:${m.key}`,
      kind: "field",
      role: "textbox",
      name: `${m.label} demand`,
      object: `month:${m.key}`,
      value: money(m.demand),
      edit: m.locked
        ? { readOnly: true, reason: `${m.label} is locked` }
        : {
            maxLength: 12,
            schema: { type: "string", pattern: "^[0-9]{1,12}$" },
            set: (text) => {
              m.demand = Number(text);
              sync();
              surface.bump({ what: `demand:${m.key}` });
              return { changed: [`demand:${m.key}`] };
            },
          },
    });
    surface.register({
      id: `lock:${m.key}`,
      kind: "action",
      role: "button",
      name: m.locked ? `Unlock ${m.label}` : `Lock ${m.label}`,
      object: `month:${m.key}`,
      state:
        m.locked || m.approved
          ? { available: true }
          : {
              available: false,
              reason: `${m.label} needs the planner's approval before it can be locked`,
              handoff: {
                reason: "approval_required",
                instructions: `Open the board and press "Approve ${m.label}", then tell the agent to try again.`,
                url: `${BASE}/#approve-${m.key}`,
                whatAgentShouldSayToUser: `Locking ${m.label} needs your approval. Press "Approve ${m.label}" on the board, then tell me to continue.`,
              },
            },
      effect: m.locked
        ? { mutates: "locks", idempotent: true, reversible: true, risk: "medium" }
        : {
            mutates: "locks",
            idempotent: true,
            reversible: true,
            risk: "high",
            text: "reason for the lock",
          },
      handler: () => {
        m.locked = !m.locked;
        sync();
        surface.bump({ what: `lock:${m.key}` });
        return { changed: [`lock:${m.key}`, `demand:${m.key}`] };
      },
    });
  }
  surface.setObjects(() => ({
    plan: months.map((m) => ({
      month: m.label,
      demand: money(m.demand),
      locked: m.locked,
      approved: m.approved,
    })),
  }));
}
sync();

const axe = createAXE({
  name: "Plan Board",
  description:
    "A shared three-month demand plan: read the board, change a month's demand, and lock or unlock a month; locking March needs the planner's approval.",
  baseUrl: BASE,
  humanFallbackUrl: BASE,
  auth: {
    modes: ["user"],
    authenticate: (request) => {
      const token = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
      const who = SESSIONS[token];
      return who ? { onBehalfOf: who } : null;
    },
  },
  revision: surface.currentRev,
  secret: process.env.AXE_SECRET ?? "local-demo-secret-not-for-production-use",
});
axe.addProvider(surfaceActions(surface, { namespace: "plan", auth: "user" }));

const app = express();
// AXE first, so it reads and bounds its own request bodies (an oversized body gets an AXE
// envelope, not the body parser's HTML 413); the parser only serves the routes below.
app.use(axeExpress(axe));
app.use(express.json());

// The approval only a person can give. The page calls this with the browser session; the agent's
// session is refused, so an agent cannot approve its own lock. This is a demo shortcut, not the
// SDK's approval primitive: it approves a month in general, bound to nothing (not the call, the
// revision, or an expiry), and cannot be cancelled. For the real thing, requestApproval with
// approveHandoff and cancelHandoff, see docs/human-oversight.md and the reference app in
// examples/plan-review (docs/reference-app.md).
app.post("/demo/approve/:month", (req, res) => {
  const token = req.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (token !== "dana-browser") {
    res.status(403).json({ error: "Only the planner's browser session can approve." });
    return;
  }
  const m = months.find((x) => x.key === req.params.month);
  if (!m) {
    res.status(404).json({ error: "No such month." });
    return;
  }
  // The approval is the app's own change, made outside `act`: record it, spanning the revision it
  // moved, so the ledger has no gap where the person approved.
  const revBefore = surface.currentRev();
  m.approved = true;
  sync();
  surface.bump({ what: `approve:${m.key}` });
  const entry = surface.record({
    op: "APPROVE",
    target: `lock:${m.key}`,
    actor: SESSIONS[token]!,
    changed: [`lock:${m.key}`],
    revBefore,
  });
  res.json({ ok: true, rev: surface.currentRev(), seq: entry.seq });
});

app.get("/", (_req, res) => {
  res.type("html").send(PAGE);
});

app.listen(PORT, () => {
  console.log(`Plan Board on ${BASE}`);
  console.log(`  manifest  ${BASE}/.well-known/axe.json`);
  console.log(`  agent     node packages/cli/dist/index.js mcp ${BASE} --auth dana-agent`);
});

const PAGE = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Plan Board</title>
<style>
  body { font: 15px/1.5 system-ui, sans-serif; max-width: 860px; margin: 32px auto; padding: 0 16px; color: #1a1a1a; }
  table { border-collapse: collapse; width: 100%; margin: 16px 0; }
  th, td { text-align: left; padding: 8px; border-bottom: 1px solid #ddd; }
  input { width: 130px; font: inherit; padding: 4px; }
  button { font: inherit; padding: 4px 10px; margin-right: 4px; cursor: pointer; }
  button[aria-disabled="true"] { opacity: .45; cursor: not-allowed; }
  .rev { color: #666; font-size: 13px; }
  .agent { color: #6b3fa0; font-weight: 600; }
  #log td { font-size: 13px; padding: 4px 8px; }
  .err { color: #b00020; }
  .src { color: #666; font-style: italic; }
</style></head>
<body>
<h1>Plan Board</h1>
<p class="rev">Signed in as <b>dana</b> (browser). Revision <span id="rev">…</span>. The agent acts for dana through the same controls; its changes appear here within a second.</p>
<p id="msg" class="err"></p>
<table><thead><tr><th>Month</th><th>Demand</th><th></th><th>Status</th></tr></thead><tbody id="rows"></tbody></table>
<h2>Ledger</h2>
<p class="rev">Every act through the board by either participant, run or refused; the approvals, recorded by the app; and stale calls the server refused before any control ran.</p>
<table id="log"><thead><tr><th>#</th><th>Who</th><th>What</th><th>Result</th><th>Revision</th><th>Source</th></tr></thead><tbody></tbody></table>
<script>
const TOKEN = "dana-browser";
let view = null;
async function call(name, body) {
  const r = await fetch("/axe/actions/" + name, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: "Bearer " + TOKEN },
    body: JSON.stringify(body),
  });
  return r.json();
}
function slug(id) { return id.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""); }
async function act(id, input) {
  document.getElementById("msg").textContent = "";
  const r = await call("plan." + slug(id), { input, expectedRev: view.rev, idempotencyKey: crypto.randomUUID() });
  if (r.status !== "ok") document.getElementById("msg").textContent = (r.error && r.error.message) || r.message || r.status;
  refresh();
}
async function approve(key) {
  await fetch("/demo/approve/" + key, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer " + TOKEN }, body: "{}" });
  refresh();
}
async function refresh() {
  const o = await call("plan.observe", { input: {} });
  if (o.status !== "ok") { document.getElementById("msg").textContent = JSON.stringify(o.error || o); return; }
  view = o.output;
  document.getElementById("rev").textContent = view.rev;
  const byId = Object.fromEntries(view.entries.map((e) => [e.id, e]));
  const rows = view.objects.plan.map((p, i) => {
    const key = ["2026-01", "2026-02", "2026-03"][i];
    const f = byId["demand:" + key], l = byId["lock:" + key];
    const editable = f.edit && !f.edit.readOnly;
    const lockOk = l.state.available;
    return "<tr id='approve-" + key + "'><td>" + p.month + "</td>" +
      "<td>" + (editable ? "<input id='v-" + key + "' value='" + p.demand.replace(/[$,]/g, "") + "' aria-label='" + f.name + "'> <button onclick=\\"act('demand:" + key + "', { text: document.getElementById('v-" + key + "').value })\\">Save</button>" : p.demand) + "</td>" +
      "<td><button aria-disabled='" + !lockOk + "' title='" + (lockOk ? "" : l.state.reason) + "' onclick=\\"" + (lockOk ? "act('lock:" + key + "', " + (p.locked ? "{}" : "{ text: 'locked from the board' }") + ")" : "") + "\\">" + l.name + "</button>" +
      (p.approved ? "" : "<button onclick=\\"approve('" + key + "')\\">Approve " + p.month + "</button>") + "</td>" +
      "<td>" + (p.locked ? "locked" : "open") + (lockOk ? "" : " · " + l.state.reason) + "</td></tr>";
  });
  document.getElementById("rows").innerHTML = rows.join("");
  const led = await call("plan.ledger", { input: { limit: 20 } });
  if (led.status === "ok") {
    document.querySelector("#log tbody").innerHTML = led.output.entries.slice().reverse().map((e) =>
      "<tr><td>" + e.seq + "</td><td class='" + (e.actor.includes("agent") ? "agent" : "") + "'>" + e.actor + "</td><td>" + e.op + " " + e.target + (e.text ? " “" + e.text + "”" : "") + "</td><td>" + e.status + (e.expectedRev !== undefined ? " (saw rev " + e.expectedRev + ")" : "") + "</td><td>" + e.revBefore + "→" + e.revAfter + "</td><td class='src'>" + (e.source === "application" ? "recorded" : e.source === "server" ? "refused by server" : "act") + "</td></tr>").join("");
  }
}
refresh();
setInterval(() => { if (document.activeElement.tagName !== "INPUT") refresh(); }, 1000);
</script>
</body></html>`;
