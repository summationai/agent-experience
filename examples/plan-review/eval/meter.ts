// Counting what a run exchanges, and the statistics the report prints.
import type {
  Transport,
  TransportSendOptions,
} from "@modelcontextprotocol/sdk/shared/transport.js";
import type { JSONRPCMessage, MessageExtraInfo } from "@modelcontextprotocol/sdk/types.js";

/** Traffic for one run. `http*` is between the agent's side and the app; `agent*` is what the
 * agent program itself sent and read (MCP messages, or page snapshots for browser variants). */
export class Meter {
  httpRequests = 0;
  httpBytesOut = 0;
  httpBytesIn = 0;
  agentMessages = 0;
  agentBytesOut = 0;
  agentBytesIn = 0;
  reset(): void {
    this.httpRequests = this.httpBytesOut = this.httpBytesIn = 0;
    this.agentMessages = this.agentBytesOut = this.agentBytesIn = 0;
  }
}

const enc = new TextEncoder();
export const byteLength = (s: string): number => enc.encode(s).length;

/** Thrown by the counting fetch for an injected lost response: the request was applied. */
export class LostResponse extends Error {
  constructor(url: string) {
    super(`fetch failed: the response from ${url} was lost (injected by the harness)`);
  }
}

export interface FetchFaults {
  /** Called for every request; true means: send it, let the server apply it, drop the response. */
  dropResponse?: (url: string, method: string) => boolean;
}

/** A fetch that counts request and response body bytes and can lose a response on purpose. */
export function countingFetch(meter: Meter, faults: FetchFaults = {}): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : (input as Request).url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const body = typeof init?.body === "string" ? init.body : "";
    meter.httpRequests++;
    meter.httpBytesOut += byteLength(body);
    const res = await fetch(input, init);
    const text = await res.text();
    meter.httpBytesIn += byteLength(text);
    if (faults.dropResponse?.(url, method)) throw new LostResponse(url);
    return new Response(text, {
      status: res.status,
      statusText: res.statusText,
      headers: res.headers,
    });
  };
}

/** Wraps the MCP client's transport and counts every JSON-RPC message in both directions. */
export class MeteredTransport implements Transport {
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: <T extends JSONRPCMessage>(message: T, extra?: MessageExtraInfo) => void;
  constructor(
    private readonly inner: Transport,
    private readonly meter: Meter,
  ) {}
  async start(): Promise<void> {
    this.inner.onmessage = (message, extra) => {
      this.meter.agentMessages++;
      this.meter.agentBytesIn += byteLength(JSON.stringify(message));
      this.onmessage?.(message, extra);
    };
    this.inner.onclose = () => this.onclose?.();
    this.inner.onerror = (e) => this.onerror?.(e);
    await this.inner.start();
  }
  async send(message: JSONRPCMessage, options?: TransportSendOptions): Promise<void> {
    this.meter.agentMessages++;
    this.meter.agentBytesOut += byteLength(JSON.stringify(message));
    await this.inner.send(message, options);
  }
  async close(): Promise<void> {
    await this.inner.close();
  }
}

/** Wilson score interval for k successes in n trials (95% by default). */
export function wilson(k: number, n: number, z = 1.96): { low: number; high: number } {
  if (n === 0) return { low: 0, high: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const centre = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { low: Math.max(0, centre - half), high: Math.min(1, centre + half) };
}

export function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m]! : (s[m - 1]! + s[m]!) / 2;
}
