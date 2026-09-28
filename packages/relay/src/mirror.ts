/**
 * The server-side mirror of one tab's surface. It implements the `Surface` interface the bridges
 * read (`observe`, `ledger`, `get`, `entries`, `availability`, `currentRev`, `act`), so
 * `domainActions` from `@axe/surface/axe`, `createAXE`, and `@axe/mcp` serve a tab exactly as
 * they serve an in-process surface. Reads come from the latest snapshot the tab sent; `act`
 * forwards to the tab, whose own surface is authoritative: its act queue, revision check,
 * availability, handlers, and ledger decide. The mirror's registration methods throw, since the
 * page owns its entries.
 *
 * Revisions and ledger sequence numbers are presented monotonic per tab across page reloads: a
 * reloaded page starts a new surface at rev 0 and seq 1, so the mirror adds an offset per page
 * instance. An `expectedRev` observed before a reload can then never equal a revision after it.
 */
import type {
  ActRequest,
  ActResult,
  Entry,
  EntryAvailability,
  LedgerEntry,
  LedgerQuery,
  Observation,
  RecordRequest,
  ObservedEntry,
  Surface,
} from "@axe/surface";
import type { ErrorResult, JsonValue } from "@axe/core/types";
import type {
  PageContent,
  PageRead,
  ReadOptions,
  WaitCondition,
  WaitResult,
} from "@axe/surface/auto";
import type { WireWaitCondition } from "./protocol";

/** Where a surface keeps its page-content reader (`CONTENT` in `@axe/surface/auto`). */
const CONTENT = Symbol.for("axe.surface.content");

/** How the mirror reaches its tab. Implemented by the relay's tab record. */
export interface TabLink {
  /**
   * Forward an act, with `expectedRev` in the mirror's revisions: the link translates it with
   * `toTabRev` once the tab is connected (a reload changes the translation), and resolves with
   * the tab's envelope and fresh snapshot, in the tab's revisions.
   */
  act(request: ActRequest): Promise<{
    result: ActResult | ErrorResult;
    observation?: Observation;
    ledger?: LedgerEntry[];
  }>;
  /** Run a `requires.fulfill` in the page. */
  fulfill(entryId: string, kind: string, payload: JsonValue, actor: string): Promise<void>;
  /**
   * Append a change or refusal to the page's own ledger ([S-LED-8]), with revisions already in
   * the tab's terms. The page records it under its relay actor; the entry returns in the reply.
   */
  record(change: RecordRequest): Promise<void>;
  /** Read the page's content in the tab ([S-AUTO-14]); revisions in the tab's terms. */
  read?(options: ReadOptions): Promise<PageRead>;
  /** Wait on the page in the tab ([S-AUTO-15]); revisions in the tab's terms. */
  wait?(
    condition: WireWaitCondition,
    options: { timeoutMs?: number; pollMs?: number },
  ): Promise<WaitResult>;
}

const READ_ONLY = "a relay mirror is read-only: the page registers its own entries.";

export class TabMirror {
  /** Added to the tab's revision for this page instance. */
  private revOffset = 0;
  /** Added to the tab's ledger seq for this page instance. */
  private seqOffset = 0;
  private instance: string | null = null;
  private view: Observation | null = null;
  /** Highest mirrored revision and seq presented so far, across instances. */
  private maxRev = -1;
  private maxSeq = 0;
  /** The tab's own latest seq in this instance. */
  private tabSeq = 0;
  private log: LedgerEntry[] = [];
  private entryCache = new Map<string, { sig: string; entry: Entry }>();
  private version = 0;
  private readonly subscribers = new Set<() => void>();
  readonly surface: Surface;

  /**
   * @param base The first revision this mirror presents. The relay gives each tab a random base,
   * so a revision read from one tab never matches another tab's.
   */
  constructor(
    private readonly link: TabLink,
    private readonly ledgerMax = 1000,
    base = 0,
  ) {
    this.maxRev = base - 1;
    this.surface = this.build();
  }

  /** A new page instance connected: revisions and seqs continue above everything presented so far. */
  beginInstance(instance: string, tabRev: number): void {
    if (this.instance === instance) return;
    this.instance = instance;
    this.revOffset = Math.max(0, this.maxRev + 1 - tabRev);
    this.seqOffset = this.maxSeq;
    this.tabSeq = 0;
  }

  /** The tab's seq the relay has seen, to ask for the ledger after it. */
  since(): number {
    return this.tabSeq;
  }

  /** The tab's revision for a mirrored one. */
  toTabRev(rev: number): number {
    return rev - this.revOffset;
  }

  rev(): number {
    return this.view ? this.view.rev : Math.max(0, this.maxRev);
  }

  hasView(): boolean {
    return this.view !== null;
  }

  /** A change notification from the tab: the revision moved (the table is refreshed on the next read). */
  noteRev(tabRev: number): void {
    if (!this.view) return;
    const rev = tabRev + this.revOffset;
    if (rev === this.view.rev) return;
    this.view = { ...this.view, rev, entries: this.view.entries.map((r) => ({ ...r, rev })) };
    this.maxRev = Math.max(this.maxRev, rev);
    this.notify();
  }

  /** Adopt a snapshot from the tab: its observation and the ledger entries after `since()`. */
  apply(observation: Observation, ledger: LedgerEntry[]): void {
    const rev = observation.rev + this.revOffset;
    const view: Observation = {
      ...observation,
      rev,
      ledgerSeq: observation.ledgerSeq > 0 ? observation.ledgerSeq + this.seqOffset : this.maxSeq,
      entries: observation.entries.map((r) => ({ ...r, rev })),
    };
    this.maxRev = Math.max(this.maxRev, rev);
    for (const e of ledger) {
      if (typeof e?.seq !== "number" || e.seq <= this.tabSeq) continue;
      this.tabSeq = e.seq;
      const out: LedgerEntry = {
        ...e,
        seq: e.seq + this.seqOffset,
        revBefore: e.revBefore + this.revOffset,
        revAfter: e.revAfter + this.revOffset,
      };
      if (e.ignoredRev !== undefined) out.ignoredRev = e.ignoredRev + this.revOffset;
      this.log.push(out);
      this.maxSeq = Math.max(this.maxSeq, out.seq);
    }
    if (this.log.length > this.ledgerMax) this.log.splice(0, this.log.length - this.ledgerMax);
    const before = this.shape();
    this.view = view;
    if (this.shape() !== before) this.version += 1;
    this.notify();
  }

  /** Translate the revisions in an envelope from the tab back to mirrored ones. */
  translate(result: ActResult | ErrorResult): ActResult | ErrorResult {
    if (result.status === "ok") {
      const output = result.output as unknown as Record<string, unknown>;
      return {
        ...result,
        output: {
          ...(result.output as object),
          rev: Number(output["rev"]) + this.revOffset,
          seq: Number(output["seq"]) + this.seqOffset,
        } as ActResult extends { output: infer O } ? O : never,
      } as ActResult;
    }
    const details = result.error.details ? { ...result.error.details } : undefined;
    if (details) {
      for (const k of ["rev", "expectedRev", "currentRev"])
        if (typeof details[k] === "number") details[k] = (details[k] as number) + this.revOffset;
      if (typeof details["seq"] === "number")
        details["seq"] = (details["seq"] as number) + this.seqOffset;
    }
    return { ...result, error: { ...result.error, ...(details ? { details } : {}) } };
  }

  private shape(): string {
    return this.view ? this.view.entries.map((r) => r.id).join("\u0000") : "";
  }

  private notify(): void {
    for (const fn of [...this.subscribers]) fn();
  }

  /** A registry entry for an observed row, reused while the row is unchanged. */
  private entryFor(row: ObservedEntry): Entry {
    const sig = JSON.stringify(row, (k, v) => (k === "rev" || k === "index" ? undefined : v));
    const known = this.entryCache.get(row.id);
    if (known && known.sig === sig) return known.entry;
    const refuse = (): never => {
      throw new Error("A relay mirror entry has no local handler; acts go through surface.act.");
    };
    let entry: Entry;
    if (row.kind === "action") {
      const s = row.state ?? { available: true, reason: null };
      const f = row.effect;
      entry = {
        id: row.id,
        kind: "action",
        role: row.role,
        name: row.name,
        ...(row.object !== null ? { object: row.object } : {}),
        state: s.available
          ? { available: true }
          : {
              available: false,
              reason: s.reason ?? "unavailable",
              ...(s.requires
                ? {
                    requires: {
                      // A wire `accepts` entry needs a description; an application's may omit one.
                      accepts: s.requires.map((a) => ({
                        ...a,
                        description: a.description ?? a.title ?? a.kind,
                      })) as never,
                      fulfill: (kind: string, payload: JsonValue, actor: string) =>
                        this.link.fulfill(row.id, kind, payload, actor),
                    },
                  }
                : {}),
              ...(s.handoff ? { handoff: { ...s.handoff } } : {}),
            },
        effect: {
          mutates: f?.mutates ?? "state",
          idempotent: f?.idempotent ?? false,
          reversible: f?.reversible ?? false,
          risk: f?.risk === "none" || !f?.risk ? "medium" : f.risk,
          ...(f?.confirm ? { confirm: true } : {}),
          ...(f?.text ? { text: f.text } : {}),
        },
        handler: refuse,
      };
    } else if (row.kind === "field") {
      const ed = row.edit;
      entry = {
        id: row.id,
        kind: "field",
        role: row.role,
        name: row.name,
        ...(row.object !== null ? { object: row.object } : {}),
        ...(row.sensitive ? { sensitive: true } : { value: (row.value ?? null) as JsonValue }),
        edit:
          ed && ed.readOnly
            ? { readOnly: true, reason: ed.reason ?? "read only" }
            : {
                ...(ed?.maxLength ? { maxLength: ed.maxLength } : {}),
                ...(ed?.schema ? { schema: ed.schema } : {}),
                set: refuse,
              },
      };
    } else {
      entry = {
        id: row.id,
        kind: "collection",
        role: row.role,
        name: row.name,
        ...(row.object !== null ? { object: row.object } : {}),
        total: row.total ?? null,
        loaded: row.loaded ?? null,
        ...(row.filter !== undefined && row.filter !== null ? { filter: row.filter } : {}),
        ...(row.sort !== undefined && row.sort !== null ? { sort: row.sort } : {}),
        // A collection can load more exactly when the page's row carries an index; `more`
        // itself runs in the page.
        ...(row.index !== null ? { more: refuse } : {}),
      };
    }
    this.entryCache.set(row.id, { sig, entry });
    return entry;
  }

  private build(): Surface {
    const empty = (): Observation => ({
      protocol: "axe/0.1",
      app: "tab",
      rev: Math.max(0, this.maxRev),
      at: new Date().toISOString(),
      entries: [],
      objects: {},
      ledgerSeq: this.maxSeq,
    });
    const rowOf = (id: string): ObservedEntry | undefined =>
      this.view?.entries.find((r) => r.id === id);
    const surface: Surface = {
      configure: () => undefined,
      register: () => {
        throw new Error(READ_ONLY);
      },
      unregister: () => {
        throw new Error(READ_ONLY);
      },
      reconcile: () => {
        throw new Error(READ_ONLY);
      },
      freeze: () => {
        throw new Error(READ_ONLY);
      },
      seedRev: () => undefined,
      setRev: () => undefined,
      bump: () => {
        throw new Error(READ_ONLY);
      },
      currentRev: () => this.rev(),
      revisionMode: () => "app",
      onChange: () => () => undefined,
      subscribe: (fn) => {
        this.subscribers.add(fn);
        return () => void this.subscribers.delete(fn);
      },
      setObjects: () => undefined,
      setProfile: () => undefined,
      observe: () => {
        const v = this.view ?? empty();
        return { ...v, entries: v.entries.map((r) => ({ ...r })) };
      },
      // The bridge records a refusal the runtime made before the page ([S-AXE-14]) on the caller's
      // surface, which here is this mirror: forward it so the page's ledger has it too. `record`
      // is synchronous; the tab writes the real entry, which arrives with the reply.
      record: (change: RecordRequest): LedgerEntry => {
        const toTab = (rev: number | undefined) =>
          typeof rev === "number" ? Math.max(0, this.toTabRev(rev)) : undefined;
        const forwarded: RecordRequest = { ...change };
        const expectedRev = toTab(change.expectedRev);
        const revBefore = toTab(change.revBefore);
        if (expectedRev === undefined) delete forwarded.expectedRev;
        else forwarded.expectedRev = expectedRev;
        if (revBefore === undefined) delete forwarded.revBefore;
        else forwarded.revBefore = revBefore;
        void this.link.record(forwarded).catch(() => undefined);
        const rev = this.rev();
        const provisional: LedgerEntry = {
          seq: this.maxSeq + 1,
          at: new Date().toISOString(),
          op: change.op,
          target: change.target,
          actor: change.actor,
          revBefore: change.status && change.status !== "ok" ? rev : (change.revBefore ?? rev),
          revAfter: rev,
          status: change.status ?? "ok",
          changed: change.changed ?? [],
        };
        if (change.source) provisional.source = change.source;
        return provisional;
      },
      act: async (request: ActRequest) => {
        const reply = await this.link.act(request);
        if (reply.observation) this.apply(reply.observation, reply.ledger ?? []);
        return this.translate(reply.result) as ActResult;
      },
      ledger: (query: LedgerQuery = {}) => {
        let out = this.log;
        if (query.since !== undefined) out = out.filter((e) => e.seq > query.since!);
        if (query.actor !== undefined) out = out.filter((e) => e.actor === query.actor);
        if (query.limit !== undefined && query.limit >= 0 && out.length > query.limit)
          out =
            query.since !== undefined
              ? out.slice(0, query.limit)
              : out.slice(out.length - query.limit);
        return out.map((e) => ({ ...e }));
      },
      expose: () => undefined,
      get: (id) => {
        const row = rowOf(id);
        return row ? this.entryFor(row) : undefined;
      },
      entries: () => (this.view?.entries ?? []).map((r) => this.entryFor(r)),
      registryVersion: () => this.version,
      availability: (id): EntryAvailability | undefined => {
        const row = rowOf(id);
        if (!row) return undefined;
        if (this.view?.frozen) return { available: false, reason: this.view.frozen.reason };
        if (row.kind === "action") {
          const s = row.state;
          if (!s || s.available) return { available: true };
          return {
            available: false,
            reason: s.reason ?? "unavailable",
            ...(s.requires ? { requires: s.requires } : {}),
            ...(s.handoff ? { handoff: s.handoff } : {}),
          };
        }
        if (row.kind === "field")
          return row.index !== null
            ? { available: true }
            : { available: false, reason: row.edit?.reason ?? "read only" };
        return row.index !== null
          ? { available: true }
          : { available: false, reason: "cannot load more" };
      },
      attributesFor: () => undefined,
      reset: () => {
        throw new Error(READ_ONLY);
      },
    };
    // The page's content and waits are the tab's: forwarded, with revisions translated both ways.
    const link = this.link;
    if (link.read && link.wait) {
      const read = link.read.bind(link);
      const wait = link.wait.bind(link);
      const toWire = (c: WaitCondition): WireWaitCondition => {
        const out: WireWaitCondition = {};
        const text = (v: string | RegExp) => (v instanceof RegExp ? `/${v.source}/${v.flags}` : v);
        if (c.text !== undefined) out.text = text(c.text);
        if (c.gone !== undefined) out.gone = text(c.gone);
        if (c.entry !== undefined) out.entry = c.entry;
        if (c.available !== undefined) out.available = c.available;
        if (c.revMoved !== undefined) out.revMoved = this.toTabRev(c.revMoved);
        if (c.idle !== undefined) out.idle = c.idle;
        if (c.route !== undefined) out.route = c.route;
        if (c.any) out.any = c.any.map(toWire);
        if (c.all) out.all = c.all.map(toWire);
        return out;
      };
      const content: PageContent = {
        read: async (options = {}) => {
          const r = await read(options);
          return { ...r, rev: r.rev + this.revOffset };
        },
        wait: async (condition, options = {}) => {
          const o: { timeoutMs?: number; pollMs?: number } = {};
          if (options.timeoutMs !== undefined) o.timeoutMs = options.timeoutMs;
          if (options.pollMs !== undefined) o.pollMs = options.pollMs;
          const r = await wait(toWire(condition), o);
          return { ...r, rev: r.rev + this.revOffset, fromRev: r.fromRev + this.revOffset };
        },
      };
      (surface as unknown as Record<symbol, unknown>)[CONTENT] = content;
    }
    return surface;
  }
}
