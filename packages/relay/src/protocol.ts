/**
 * The messages between a tab (`connectRelay`) and the relay server: JSON text frames over one
 * WebSocket the page opens. Types only, plus the constants both sides agree on; nothing here
 * imports a runtime dependency, so the browser client stays small.
 */
import type { ActRequest, ActResult, LedgerEntry, Observation, RecordRequest } from "@axe/surface";
import type { ErrorResult, JsonValue } from "@axe/core/types";
import type { ReadOptions, WaitCondition } from "@axe/surface/auto";

/** A wait condition as it crosses the wire: texts are strings (`/pattern/flags` for an expression). */
export type WireWaitCondition = Omit<WaitCondition, "text" | "gone" | "any" | "all"> & {
  text?: string;
  gone?: string;
  any?: WireWaitCondition[];
  all?: WireWaitCondition[];
};

/** The WebSocket subprotocol and message version. */
export const RELAY_PROTOCOL = "axe-relay.v1";

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
  /** The answer to `read` or `wait`: the page's `PageRead` or `WaitResult`, in the tab's revisions. */
  | { t: "content"; re: number; result?: JsonValue; error?: string }
  | { t: "changed"; rev: number; ledgerSeq: number }
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
