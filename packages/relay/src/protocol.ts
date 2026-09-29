/**
 * The messages between a tab (`connectRelay`) and the relay server: JSON text frames over one
 * WebSocket the page opens. Types only, plus the constants both sides agree on; nothing here
 * imports a runtime dependency, so the browser client stays small.
 */
import type {
  ActRequest,
  ActResult,
  LedgerEntry,
  Observation,
  RecordRequest,
} from "@summationai/axe-surface";
import type { ErrorResult, JsonValue } from "@summationai/axe-core/types";
import type { ReadOptions, WaitCondition } from "@summationai/axe-surface/auto";

/** A wait condition as it crosses the wire: texts are strings (`/pattern/flags` for an expression). */
export type WireWaitCondition = Omit<WaitCondition, "text" | "gone" | "any" | "all"> & {
  text?: string;
  gone?: string;
  any?: WireWaitCondition[];
  all?: WireWaitCondition[];
};

/** The WebSocket subprotocol and message version. */
export const RELAY_PROTOCOL = "axe-relay.v1";

/** Prefix used in `window.name` by the relay's cross-origin connection handoff page. */
export const RELAY_HANDOFF_WINDOW_PREFIX = "summationai-axe-relay-handoff:";

/** WebSocket close codes the relay uses (4000 to 4999 are application codes). */
export const CLOSE = {
  /** A message the relay could not read, or the wrong order of messages. */
  badMessage: 4400,
  /** The relay token is missing, invalid, or expired. A fresh token may succeed. */
  unauthorized: 4401,
  /** The origin, tenant, or token is not allowed here. Retrying will not help. */
  forbidden: 4403,
  /** No `hello` arrived in time. */
  helloTimeout: 4408,
  /** Another connection took this tab id (a duplicated tab). The client picks a new id. */
  replaced: 4409,
  /** The person pressed Stop. */
  stopped: 4410,
} as const;

/**
 * `attended`: a person is looking at the tab (the default). `unattended`: the tab runs in a hidden
 * browser session a host started for the person (`@summationai/axe-host`), and no one is looking at it.
 */
export type RelayMode = "attended" | "unattended";

/**
 * Where the person decides an act that needs approval: `page`, the tab's own agent panel;
 * `agent`, the calling agent's MCP client (elicitation), with the relay's approval page for
 * sensitive acts; `both`, whichever answers first.
 */
export type RelayApprovalChannel = "page" | "agent" | "both";

/** Who a relay token speaks for: one signed-in person in one tenant. */
export interface RelayPrincipal {
  principal: string;
  tenant: string;
}

export type TabMessage =
  | {
      t: "hello";
      v: 1;
      token: string;
      /** Stable for the browser tab (sessionStorage), so a reload reattaches to the same record. */
      tabId: string;
      /** New on every page load, so the relay knows the surface was recreated. */
      instance: string;
      title: string;
      path: string;
      /** Absent: `attended`. */
      mode?: RelayMode;
      /** Where approvals may be decided; absent: `page`. The tab accepts `approve` and `deny` from the relay only for `agent` or `both`. */
      approvals?: RelayApprovalChannel;
    }
  | { t: "renew"; token: string }
  | { t: "snapshot"; re: number; observation: Observation; ledger: LedgerEntry[] }
  | {
      t: "result";
      re: number;
      result: ActResult | ErrorResult;
      observation: Observation;
      ledger: LedgerEntry[];
    }
  | {
      t: "fulfilled";
      re: number;
      error?: string;
      observation?: Observation;
      ledger?: LedgerEntry[];
    }
  | {
      t: "recorded";
      re: number;
      error?: string;
      observation?: Observation;
      ledger?: LedgerEntry[];
    }
  | {
      /** The answer to `approve` or `deny`: whether the tab now holds that decision for the approval. */
      t: "decided";
      re: number;
      ok: boolean;
      error?: string;
      observation?: Observation;
      ledger?: LedgerEntry[];
    }
  /** The answer to `read` or `wait`: the page's `PageRead` or `WaitResult`, in the tab's revisions. */
  | { t: "content"; re: number; result?: JsonValue; error?: string }
  /** The surface changed; `title` and `path` as `hello` gives them, which a client-side route change moves. */
  | { t: "changed"; rev: number; ledgerSeq: number; title?: string; path?: string }
  | { t: "active" }
  | { t: "stop" }
  /** The page's principal or tenant changed (`rekey`): drop this tab's record and revoke its token. */
  | { t: "leave" };

export type RelayMessage =
  | {
      t: "ready";
      tabId: string;
      principal: string;
      tenant: string;
      /** The actor the page records for every act the relay forwards. */
      actor: string;
      /** When the token expires, in ms since the epoch; the client renews before then. */
      expiresAt: number;
      /** Development pairing: the code the person gives the agent. Absent once an agent is paired. */
      pairing?: { code: string; expiresAt: number };
      /** An agent is paired with (or authenticated as) this principal. */
      agent: boolean;
    }
  | { t: "renewed"; expiresAt: number }
  | { t: "sync"; id: number; since: number }
  | { t: "act"; id: number; since: number; request: ActRequest }
  | {
      t: "fulfill";
      id: number;
      since: number;
      entryId: string;
      kind: string;
      payload: JsonValue;
      actor: string;
    }
  | {
      /** Record a refusal the relay's runtime made before the page ([S-AXE-14]), in the tab's revisions. */
      t: "record";
      id: number;
      since: number;
      change: RecordRequest;
    }
  | { t: "agent"; state: "paired" | "active" }
  | {
      /**
       * The person approved the pending approval `approval` outside the page (in the agent's MCP
       * client, or on the relay's approval page). The tab grants it exactly as its panel's
       * Approve does, records the decision in its ledger under `by`, and answers `decided`. Sent
       * only to a tab whose `hello` accepted approvals from the agent.
       */
      t: "approve";
      id: number;
      since: number;
      approval: string;
      by: string;
    }
  | {
      /** The person declined the pending approval `approval` outside the page; answered by `decided`. */
      t: "deny";
      id: number;
      since: number;
      approval: string;
      by: string;
    }
  /** Read the page's content through its surface's page-content reader ([S-AUTO-14]). */
  | { t: "read"; id: number; options: ReadOptions }
  /** Wait on the page until a condition holds or the bound runs out ([S-AUTO-15]). */
  | {
      t: "wait";
      id: number;
      condition: WireWaitCondition;
      options: { timeoutMs?: number; pollMs?: number };
    }
  | { t: "agent"; state: "paired" | "active" };

/** Tab ids and instance ids: short, URL-safe. */
export const ID_PATTERN = /^[A-Za-z0-9_-]{8,64}$/;
