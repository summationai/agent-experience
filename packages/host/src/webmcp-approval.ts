/**
 * Approvals for the WebMCP bridge when the agent's MCP client cannot ask the person itself: a
 * single-use approval page on loopback, and the decisions it records. A decision is bound to one
 * control at one revision and is used once, by the agent's next call of the same tool.
 */
import { createServer } from "node:http";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { randomBytes } from "node:crypto";

/** One approval question, as the person reads it. */
export interface ApprovalQuestion {
  /** The tool the agent called. */
  tool: string;
  entryId: string;
  name: string;
  app: string;
  risk: string;
  mutates: string;
  reversible: boolean | null;
  expectedRev: number;
  /** "Approve “Delete the plan” on planner? It changes plan, risk high, and cannot be undone." */
  message: string;
  /** "It changes plan, risk high, and cannot be undone." */
  summary: string;
}

export interface ApprovalDecision {
  approve: boolean;
  by: string;
}

interface Link {
  token: string;
  nonce: string;
  key: string;
  question: ApprovalQuestion;
  expiresAt: number;
  state: "open" | "used";
}

/** The key a decision is stored under: one control at one revision. */
export const decisionKey = (q: Pick<ApprovalQuestion, "entryId" | "expectedRev">): string =>
  `${q.entryId}@${q.expectedRev}`;

export function questionFor(q: Omit<ApprovalQuestion, "message" | "summary">): ApprovalQuestion {
  const summary = `It changes ${q.mutates}, risk ${q.risk}${q.reversible === false ? ", and cannot be undone" : ""}.`;
  return {
    ...q,
    summary,
    message: `Approve “${q.name}” on ${q.app}? ${summary} Your agent asked to do this in your session of the application. Nothing runs unless you approve.`,
  };
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export interface ApprovalPages {
  /** A single-use link for this question; a newer link for the same key replaces it. */
  mint(question: ApprovalQuestion): Promise<string>;
  /** The decision recorded for this key, taken (it is used once), or null. */
  take(key: string): ApprovalDecision | null;
  close(): Promise<void>;
}

export function approvalPages(options: { ttlMs?: number } = {}): ApprovalPages {
  const ttl = options.ttlMs ?? 5 * 60_000;
  const links = new Map<string, Link>();
  const decisions = new Map<string, ApprovalDecision & { expiresAt: number }>();
  let server: Server | null = null;
  let origin: Promise<string> | null = null;

  const page = (title: string, body: string) =>
    `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(title)}</title><style>body{font:16px/1.5 system-ui,sans-serif;max-width:34rem;margin:3rem auto;padding:0 1rem;color:#1a1a1a;background:#fff}button{font:inherit;padding:.5rem 1.2rem;margin-right:.5rem;border-radius:.4rem;border:1px solid #888;background:#f4f4f4;cursor:pointer}button.approve{background:#1a4fd6;color:#fff;border-color:#1a4fd6}@media (prefers-color-scheme:dark){body{background:#161616;color:#eee}button{background:#2a2a2a;color:#eee}}</style></head><body>${body}</body></html>`;

  const listen = (): Promise<string> =>
    (origin ??= new Promise<string>((resolve, reject) => {
      server = createServer((req, res) => {
        const send = (status: number, html: string) => {
          res.writeHead(status, {
            "Content-Type": "text/html; charset=utf-8",
            "Content-Security-Policy":
              "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
            "Cache-Control": "no-store",
            "Referrer-Policy": "no-referrer",
            "X-Frame-Options": "DENY",
          });
          res.end(html);
        };
        const m = /^\/approve\/([A-Za-z0-9_-]{32})$/.exec((req.url ?? "").split("?")[0]!);
        const link = m ? links.get(m[1]!) : undefined;
        if (!link || link.state !== "open" || Date.now() > link.expiresAt)
          return send(
            404,
            page(
              "Link not valid",
              "<h1>This link is not valid</h1><p>It was used, it lapsed, or a newer request replaced it. Ask your agent again.</p>",
            ),
          );
        const q = link.question;
        if (req.method === "GET")
          return send(
            200,
            page(
              `Approve ${q.name}?`,
              `<h1>Approve “${esc(q.name)}”?</h1><p>On ${esc(q.app)}. ${esc(q.summary)}</p><p>Your agent asked to do this in your session of the application. Nothing runs unless you approve.</p><form method="post"><input type="hidden" name="nonce" value="${link.nonce}"><button class="approve" name="decision" value="approve">Approve</button><button name="decision" value="deny">Decline</button></form>`,
            ),
          );
        if (req.method !== "POST") return send(405, page("Not allowed", "<p>Not allowed.</p>"));
        let body = "";
        req.on("data", (c: Buffer) => {
          body += c.toString();
          if (body.length > 2048) req.destroy();
        });
        req.on("end", () => {
          const form = new URLSearchParams(body);
          const decision = form.get("decision");
          if (form.get("nonce") !== link.nonce || (decision !== "approve" && decision !== "deny"))
            return send(
              400,
              page("Not accepted", "<p>That was not accepted. Reload the page.</p>"),
            );
          link.state = "used";
          const approve = decision === "approve";
          decisions.set(link.key, {
            approve,
            by: `the person (${approve ? "approved" : "declined"} on the approval page)`,
            expiresAt: Date.now() + ttl,
          });
          send(
            200,
            page(
              approve ? "Approved" : "Declined",
              `<h1>${approve ? "Approved" : "Declined"}</h1><p>Return to your agent${approve ? "; it can go ahead now." : "."}</p>`,
            ),
          );
        });
      });
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () =>
        resolve(`http://127.0.0.1:${(server!.address() as AddressInfo).port}`),
      );
    }));

  return {
    async mint(question) {
      const base = await listen();
      const key = decisionKey(question);
      for (const [t, l] of links) if (l.key === key || Date.now() > l.expiresAt) links.delete(t);
      const link: Link = {
        token: randomBytes(24).toString("base64url"),
        nonce: randomBytes(18).toString("base64url"),
        key,
        question,
        expiresAt: Date.now() + ttl,
        state: "open",
      };
      links.set(link.token, link);
      return `${base}/approve/${link.token}`;
    },
    take(key) {
      const d = decisions.get(key);
      decisions.delete(key);
      return d && Date.now() <= d.expiresAt ? { approve: d.approve, by: d.by } : null;
    },
    async close() {
      const s = server;
      server = null;
      origin = null;
      if (s) await new Promise<void>((r) => s.close(() => r()));
    },
  };
}
