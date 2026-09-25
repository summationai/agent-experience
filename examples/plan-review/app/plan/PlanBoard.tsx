"use client";
// The plan page. The plan itself is the server's (fetched from /api/state, changed through the
// app's own endpoints). The controls below also register browser-local entries on this tab's
// page surface (lib/browser-surface.ts): the unsaved draft of each cell, "Save", "Scroll to
// <month>", and "Open the approval requests". Those exist while this component is mounted and
// only in this tab; they are not AXE actions.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSurfaceProps } from "@axe/surface/react";
import { pageSurface } from "../../lib/browser-surface";
import { cellKey, monthLabel, planTotal } from "../../lib/model";
import type { PageState } from "../../lib/ui-api";

type Drafts = Record<string, string>;

async function post(path: string, body: unknown) {
  const res = await fetch(`/api${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json()) as { error?: string; conflict?: boolean } };
}

export function PlanBoard({ initial }: { initial: PageState }) {
  const [state, setState] = useState(initial);
  const [drafts, setDrafts] = useState<Drafts>({});
  // The revision the drafts were typed against. Saving presents it, so a draft made before
  // someone else's change is refused instead of overwriting that change after a refresh.
  const [baseRev, setBaseRev] = useState<number | null>(null);
  const [conflict, setConflict] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { plan, session, can } = state;

  const refresh = useCallback(async () => {
    const res = await fetch("/api/state", { cache: "no-store" });
    if (res.ok) setState((await res.json()) as PageState);
  }, []);

  // Changes by other people and agents arrive by polling; the page never assumes it is alone.
  useEffect(() => {
    const t = setInterval(refresh, 1500);
    return () => clearInterval(t);
  }, [refresh]);

  // The page surface reports the server's revision: an agent in the page and the server agree.
  useEffect(() => {
    pageSurface.setRev(plan.rev);
  }, [plan.rev]);

  const dirty = Object.keys(drafts).length;

  const act = useCallback(
    async (path: string, body: Record<string, unknown>, done: string, rev = plan.rev) => {
      setBusy(true);
      const r = await post(path, { expectedRev: rev, ...body });
      setBusy(false);
      setMessage(r.status === 200 ? done : (r.body.error ?? "That did not work."));
      await refresh();
      return r;
    },
    [plan.rev, refresh],
  );

  const save = useCallback(async () => {
    const cells = Object.entries(drafts).map(([key, text]) => {
      const [item, month] = key.split("|");
      return { item: item!, month: month!, value: Number(text) };
    });
    const r = await act(
      "/plan/values",
      { cells },
      `Saved ${cells.length} change${cells.length === 1 ? "" : "s"}.`,
      baseRev ?? plan.rev,
    );
    if (r.status === 200) {
      setDrafts({});
      setBaseRev(null);
    }
    setConflict(!!r.body.conflict);
    return r.status === 200;
  }, [act, drafts, baseRev, plan.rev]);

  const discard = () => {
    setDrafts({});
    setBaseRev(null);
    setConflict(false);
  };

  const saveProps = useSurfaceProps(
    {
      id: "save",
      kind: "action",
      role: "button",
      name: dirty === 1 ? "Save 1 unsaved change" : `Save ${dirty} unsaved changes`,
      object: `plan:${plan.id}`,
      state:
        dirty === 0
          ? { available: false, reason: "There are no unsaved changes" }
          : can.edit
            ? { available: false, reason: can.edit }
            : { available: true },
      effect: { mutates: "plan", risk: "low", reversible: true },
      handler: async () => {
        await save();
      },
    },
    [dirty, can.edit, plan.id],
    pageSurface,
  );

  const dialogProps = useSurfaceProps(
    {
      id: "dialog:approvals",
      kind: "action",
      role: "button",
      name: "Open the approval requests",
      effect: { mutates: "view", risk: "low", reversible: true, idempotent: true },
      handler: () => setDialogOpen(true),
    },
    [],
    pageSurface,
  );

  const total = useMemo(() => planTotal(plan), [plan]);

  return (
    <main>
      <header className="bar">
        <div>
          <h1>{plan.name}</h1>
          <p className="muted">
            {session.tenantName}, signed in as <strong data-testid="who">{session.user}</strong> (
            {session.role})
          </p>
        </div>
        <nav className="row">
          <Link href="/history">History</Link>
          <button onClick={() => post("/logout", {}).then(() => window.location.assign("/login"))}>
            Sign out
          </button>
        </nav>
      </header>

      <section className="row status">
        <span data-testid="status">Status: {plan.status}</span>
        <span data-testid="rev">Revision {plan.rev}</span>
        <span>Total {total.toLocaleString("en-US")} units</span>
        {plan.frozen ? (
          <span className="warn" data-testid="frozen">
            Frozen by {plan.frozen.by}: agents paused
          </span>
        ) : null}
      </section>

      {message ? (
        <p role="status" data-testid="message">
          {message}
        </p>
      ) : null}

      <div className="grid-wrap">
        <table className="grid">
          <thead>
            <tr>
              <th>Item</th>
              {plan.months.map((m) => (
                <MonthHeader key={m} month={m} />
              ))}
            </tr>
          </thead>
          <tbody>
            {plan.items.map((item) => (
              <tr key={item}>
                <th scope="row">{item}</th>
                {plan.months.map((month) => (
                  <Cell
                    key={month}
                    planId={plan.id}
                    item={item}
                    month={month}
                    saved={plan.values[cellKey(item, month)] ?? 0}
                    draft={drafts[cellKey(item, month)]}
                    readOnlyReason={can.edit}
                    onDraft={(text) => {
                      if (baseRev === null) setBaseRev(plan.rev);
                      setDrafts((d) => {
                        const key = cellKey(item, month);
                        const next = { ...d };
                        if (text === String(plan.values[key] ?? 0)) delete next[key];
                        else next[key] = text;
                        return next;
                      });
                    }}
                  />
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <section className="row">
        <button {...saveProps} disabled={busy || dirty === 0 || !!can.edit} onClick={save}>
          Save {dirty > 0 ? `(${dirty})` : ""}
        </button>
        {dirty > 0 ? <button onClick={discard}>Discard drafts</button> : null}
        {conflict && dirty > 0 ? (
          <button
            onClick={() => {
              setBaseRev(plan.rev);
              setConflict(false);
              setMessage("Your drafts now apply to the current plan. Check them, then save.");
            }}
          >
            Keep my drafts on the current plan
          </button>
        ) : null}
        <button
          disabled={busy || !!can.submit}
          title={can.submit ?? ""}
          onClick={() => act("/plan/submit", {}, "Submitted for approval.")}
        >
          Submit for approval
        </button>
        <button
          disabled={busy || !!can.lock}
          title={can.lock ?? ""}
          onClick={() => act("/plan/lock", {}, "Approved and locked.")}
        >
          Approve and lock
        </button>
        <button
          disabled={busy || !!can.reopen}
          title={can.reopen ?? ""}
          onClick={() => act("/plan/reopen", {}, "Reopened as a draft.")}
        >
          Reopen (undo submit or lock)
        </button>
        <button onClick={() => post("/plan/freeze", { frozen: !plan.frozen }).then(refresh)}>
          {plan.frozen
            ? "Unfreeze (let agents act again)"
            : "Freeze (pause agents, cancel their requests)"}
        </button>
        <button {...dialogProps} onClick={() => setDialogOpen(true)}>
          Approval requests ({state.approvals.length})
        </button>
      </section>

      {dialogOpen ? (
        <div role="dialog" aria-label="Approval requests" className="dialog">
          <h2>Approval requests</h2>
          {state.approvals.length === 0 ? <p>No request is waiting.</p> : null}
          <ul>
            {state.approvals.map((a) => (
              <li key={a.id}>
                <Link href={`/approvals/${a.id}`}>
                  Agent for {a.onBehalfOf}: approve and lock ({a.status})
                </Link>
              </li>
            ))}
          </ul>
          <button onClick={() => setDialogOpen(false)}>Close</button>
        </div>
      ) : null}

      <section>
        <h2>Recent history</h2>
        <ol className="history" data-testid="history">
          {state.history.slice(0, 10).map((e) => (
            <li key={e.seq}>
              <strong>{e.actor}</strong> {e.summary}
            </li>
          ))}
        </ol>
      </section>

      <section className="muted">
        <h2>Connect an agent</h2>
        <p>
          Server actions for this team are at{" "}
          <code>{state.agent.baseUrl}/.well-known/axe.json</code>. Your agent token for{" "}
          {session.tenantName}: <code data-testid="agent-token">{state.agent.token}</code>
        </p>
        <pre>{`node packages/cli/dist/index.js mcp ${state.agent.baseUrl} --auth ${state.agent.token}`}</pre>
        <p>
          The controls on this page (drafts, Save, scrolling, the approval dialog) are published
          only to agents running in this tab, at window.__surface.
        </p>
      </section>
    </main>
  );
}

function MonthHeader({ month }: { month: string }) {
  const ref = useRef<HTMLTableCellElement>(null);
  const label = monthLabel(month);
  const props = useSurfaceProps(
    {
      id: `scroll:${month}`,
      kind: "action",
      role: "button",
      name: `Scroll to ${label}`,
      effect: { mutates: "view", risk: "low", reversible: true, idempotent: true },
      handler: () => {
        ref.current?.scrollIntoView({ block: "nearest", inline: "center" });
      },
    },
    [label],
    pageSurface,
  );
  // The header cell is the control an agent's "scroll" names; scrolling is all it does.
  return (
    <th ref={ref} {...props} tabIndex={-1} id={`month-${month}`}>
      {label}
    </th>
  );
}

// #region cell
function Cell(props: {
  planId: string;
  item: string;
  month: string;
  saved: number;
  draft: string | undefined;
  readOnlyReason: string | null;
  onDraft: (text: string) => void;
}) {
  const { planId, item, month, saved, draft, readOnlyReason, onDraft } = props;
  const value = draft ?? String(saved);
  const surfaceProps = useSurfaceProps(
    {
      id: `draft:${item}:${month}`,
      kind: "field",
      role: "textbox",
      name: `${item}, ${monthLabel(month)}`,
      object: `plan:${planId}`,
      value,
      // Typing here changes only this tab's unsaved draft; "Save" sends it to the server.
      edit: readOnlyReason
        ? { readOnly: true, reason: readOnlyReason }
        : {
            maxLength: 8,
            schema: { type: "string", pattern: "^[0-9]{1,8}$" },
            set: (text: string) => onDraft(text),
          },
    },
    [value, readOnlyReason],
    pageSurface,
  );
  return (
    <td className={draft !== undefined ? "dirty" : undefined}>
      <input
        {...surfaceProps}
        inputMode="numeric"
        value={value}
        readOnly={!!readOnlyReason}
        onChange={(e) => onDraft(e.target.value.replace(/[^0-9]/g, "").slice(0, 8))}
      />
    </td>
  );
}
// #endregion cell
