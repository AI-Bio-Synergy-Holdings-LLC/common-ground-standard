#!/usr/bin/env node

import { cp, mkdir, readdir, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const artifactRoot = path.join(repoRoot, "dist-render");
const topLevelHtmlFiles = (await readdir(repoRoot)).filter((entry) => entry.endsWith(".html"));
const publicEntries = [
  ...topLevelHtmlFiles,
  "assets",
  "review",
  "standards",
  "favicon.svg",
  "robots.txt",
  "sitemap.xml",
  "site.js",
  "styles.css",
];

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true });

for (const entry of publicEntries) {
  await cp(path.join(repoRoot, entry), path.join(artifactRoot, entry), { recursive: true });
}

console.log(`Common Ground Standard Render artifact prepared at ${path.relative(repoRoot, artifactRoot)}`);
console.log(`Included public entries: ${publicEntries.join(", ")}`);
