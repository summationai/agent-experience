import { fileURLToPath } from "node:url";

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // The workspace root, so Turbopack resolves the SDK packages linked from ../../packages.
  turbopack: { root: fileURLToPath(new URL("../..", import.meta.url)) },
  // Hosts a development server may be reached through besides localhost (a tunnel, for testing
  // the agent web's site pages from a real agent), comma-separated: Next blocks its dev
  // resources for any other origin, and the page never hydrates.
  allowedDevOrigins: (process.env.NEXT_ALLOWED_DEV_ORIGINS ?? "")
    .split(",")
    .map((h) => h.trim())
    .filter(Boolean),
};

export default nextConfig;
