#!/usr/bin/env node
// Fails unless every published workspace package is private to the summationai organization.
// Run by .github/workflows/release.yml after publishing; runnable locally.
//
// Checks per package, all made without credentials, as someone outside the organization:
//   1. The registry refuses the package metadata (401 or 403). GitHub's npm registry asks for a
//      token even for public packages, so this alone does not prove the package is private.
//   2. The package's page on github.com is not found (404). A public package's page is served to
//      anyone; a private one's is not. This is the check that catches a package made public.
// With GH_TOKEN set to a token the packages API accepts (a personal token with read:packages;
// the Actions GITHUB_TOKEN is not one), the API's `visibility` is checked as well.
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const ORG = "summationai";
const REGISTRY = "https://npm.pkg.github.com";
const root = new URL("..", import.meta.url).pathname;
const token = process.env.GH_TOKEN;

const names = (process.env.CHECK_PACKAGES?.split(",") ?? publishedNames()).filter(Boolean);

function publishedNames() {
  return readdirSync(join(root, "packages"))
    .map((d) => join(root, "packages", d, "package.json"))
    .filter((p) => existsSync(p))
    .map((p) => JSON.parse(readFileSync(p, "utf8")))
    .filter((p) => !p.private)
    .map((p) => p.name);
}

let failed = 0;
const fail = (msg) => {
  console.log(`::error::${msg}`);
  failed++;
};

for (const name of names) {
  if (!name.startsWith(`@${ORG}/`)) {
    fail(`${name} is not in the @${ORG} scope`);
    continue;
  }
  const bare = name.slice(ORG.length + 2);

  const meta = await fetch(`${REGISTRY}/${name.replace("/", "%2f")}`);
  if (meta.status !== 401 && meta.status !== 403)
    fail(`${name}: the registry answered an anonymous request with ${meta.status}, expected 401`);

  const page = await fetch(`https://github.com/orgs/${ORG}/packages/npm/package/${bare}`, {
    redirect: "manual",
  });
  if (page.status !== 404)
    fail(
      `${name}: its package page answered an anonymous request with ${page.status}, expected 404; is it public?`,
    );

  let visibility = "not checked";
  if (token) {
    const res = await fetch(`https://api.github.com/orgs/${ORG}/packages/npm/${bare}`, {
      headers: { authorization: `Bearer ${token}`, accept: "application/vnd.github+json" },
    });
    if (!res.ok) fail(`${name}: the packages API answered ${res.status}`);
    else {
      visibility = (await res.json()).visibility;
      if (visibility === "public")
        fail(`${name} is public; make it private in its package settings`);
    }
  }
  console.log(`${name}: registry ${meta.status}, page ${page.status}, visibility ${visibility}`);
}

if (failed) process.exit(1);
console.log(`${names.length} package(s) are private to ${ORG}`);
