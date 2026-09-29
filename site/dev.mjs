#!/usr/bin/env node
// A tiny static server for iterating on the site. The deliverable never needs it.
import { createServer } from "node:http";
import { readFileSync, existsSync, statSync } from "node:fs";
import { join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

const dist = join(fileURLToPath(new URL(".", import.meta.url)), "dist");
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css",
  ".js": "text/javascript",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".txt": "text/plain",
  ".json": "application/json",
};
const port = Number(process.env.PORT ?? 4173);
createServer((req, res) => {
  let path = decodeURIComponent(new URL(req.url, "http://x").pathname);
  if (path.endsWith("/")) path += "index.html";
  const file = join(dist, path);
  if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }
  res.setHeader("content-type", types[extname(file)] ?? "application/octet-stream");
  const body = readFileSync(file);
  if (
    /gzip/.test(req.headers["accept-encoding"] ?? "") &&
    /^(text\/|application\/|image\/svg)/.test(types[extname(file)] ?? "")
  ) {
    res.setHeader("content-encoding", "gzip");
    res.end(gzipSync(body));
    return;
  }
  res.end(body);
}).listen(port, () => console.log(`Serving ${dist} at http://localhost:${port}/`));
