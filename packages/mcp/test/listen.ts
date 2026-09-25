// A real HTTP listener on 127.0.0.1 in front of a Web-standard `(Request) => Promise<Response>`
// handler, with streaming responses (the MCP transport answers with SSE). Test-only.
import { createServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo, Socket } from "node:net";

export interface Listening {
  url: string;
  close(): Promise<void>;
}

async function toRequest(req: IncomingMessage, origin: string): Promise<Request> {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) for (const x of v) headers.append(k, x);
    else if (v !== undefined) headers.set(k, v);
  }
  const method = req.method ?? "GET";
  const init: RequestInit & { duplex?: string } = { method, headers };
  if (method !== "GET" && method !== "HEAD") {
    const chunks: Buffer[] = [];
    for await (const c of req) chunks.push(c as Buffer);
    init.body = Buffer.concat(chunks);
  }
  return new Request(new URL(req.url ?? "/", origin), init);
}

async function send(res: ServerResponse, response: Response): Promise<void> {
  const headers: Record<string, string | string[]> = {};
  response.headers.forEach((v, k) => {
    headers[k] = v;
  });
  res.writeHead(response.status, headers);
  if (!response.body) return void res.end();
  const reader = response.body.getReader();
  res.on("close", () => void reader.cancel().catch(() => undefined));
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  } catch {
    // client went away
  }
  res.end();
}

export async function listen(handler: (request: Request) => Promise<Response>): Promise<Listening> {
  const sockets = new Set<Socket>();
  let origin = "";
  const server = createServer((req, res) => {
    toRequest(req, origin)
      .then(handler)
      .then(
        (r) => send(res, r),
        (e: unknown) => {
          res.writeHead(500, { "content-type": "text/plain" });
          res.end(e instanceof Error ? e.message : String(e));
        },
      );
  });
  server.on("connection", (s) => {
    sockets.add(s);
    s.on("close", () => sockets.delete(s));
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return {
    url: origin,
    close: () =>
      new Promise<void>((resolve) => {
        for (const s of sockets) s.destroy();
        server.close(() => resolve());
      }),
  };
}
