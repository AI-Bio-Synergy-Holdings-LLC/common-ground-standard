import assert from "node:assert/strict";
import { readFile, readdir, access } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("../", import.meta.url));
const pages = (await readdir(root)).filter((name) => name.endsWith(".html"));
const read = (name) => readFile(path.join(root, name), "utf8");

test("every public page has valid structured data, unique IDs and existing local resources", async () => {
  for (const name of pages) {
    const source = await read(name);
    const ids = [...source.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
    assert.equal(new Set(ids).size, ids.length, `${name}: duplicate ID`);
    assert.equal((source.match(/<h1\b/g) || []).length, 1, `${name}: exactly one primary heading`);
    for (const match of source.matchAll(/<script\b[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)) {
      assert.doesNotThrow(() => JSON.parse(match[1]), `${name}: invalid JSON-LD`);
    }
    for (const match of source.matchAll(/<(?:a|link|script|img)\b[^>]*\b(?:href|src)="([^"]+)"/g)) {
      const target = match[1].replaceAll("&amp;", "&");
      const url = new URL(target, `https://offline.invalid/${name}`);
      if (url.origin !== "https://offline.invalid") continue;
      const targetName = decodeURIComponent(url.pathname.slice(1)) || "index.html";
      const resolved = path.resolve(root, targetName);
      assert.ok(!path.relative(root, resolved).startsWith(".."), `${name}: local path escape`);
      await access(resolved);
      if (url.hash && targetName.endsWith(".html")) {
        const targetSource = await read(targetName);
        const id = decodeURIComponent(url.hash.slice(1));
        assert.ok(targetSource.includes(`id="${id}"`), `${name}: missing fragment ${targetName}#${id}`);
      }
    }
  }
});

test("Formspree's public AJAX dependency is exact-version pinned with matching SRI and CORS", async () => {
  for (const name of ["contact.html", "review-feedback.html"]) {
    const source = await read(name);
    const scripts = [...source.matchAll(/<script\b[^>]*\bsrc="https:\/\/unpkg\.com\/[^"\s]+"[^>]*>/g)];
    assert.equal(scripts.length, 1, `${name}: one reviewed CDN dependency`);
    assert.match(scripts[0][0], /src="https:\/\/unpkg\.com\/@formspree\/ajax@1\.1\.5\/dist\/global\.js"/);
    assert.match(scripts[0][0], /integrity="sha384-9fQrvHz7unHjhv7e\+pJqhvNxPV4tYHHsSn3PxBIEyPTGY8Q\/PAKM1sfhL\+zTYmhc"/);
    assert.match(scripts[0][0], /crossorigin="anonymous"/);
    assert.match(scripts[0][0], /\bdefer\b/);
  }
});

test("required CI runs for every main PR and push without path-filter gaps", async () => {
  const workflow = await read(".github/workflows/public-evidence-validator.yml");
  assert.match(workflow, /pull_request:\s*\r?\n\s+branches: \[main\]/);
  assert.match(workflow, /push:\s*\r?\n\s+branches: \[main\]/);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/m);
});
