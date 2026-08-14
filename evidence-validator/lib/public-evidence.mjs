import { createHash } from "node:crypto";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";

export const MANIFEST_SCHEMA = "common-ground-public-evidence/v0.1";
export const RECEIPT_SCHEMA = "common-ground-public-evidence-receipt/v0.1";
export const VALIDATOR_EFFECT = "STRUCTURAL_VALIDITY_ONLY";
export const CLAIM_BOUNDARY =
  "Structural validity and byte-level integrity do not establish truth, evidence sufficiency, independence, review, alignment, endorsement, certification, compliance, partnership, pilot status, public benefit, or authority.";

const MAX_MANIFEST_BYTES = 1_048_576;
const MAX_FILES = 1_000;
const MAX_PACKAGE_BYTES = 104_857_600;
const SHA256_PATTERN = /^[a-f0-9]{64}$/u;
const RECORD_ID_PATTERN = /^CGR-[A-Z0-9][A-Z0-9._-]{2,63}$/u;
const ASSET_REGISTRY_ID_PATTERN = /^IP-[0-9]{3,}$/u;
const SOURCE_ID_PATTERN = /^SRC-[A-Z0-9][A-Z0-9._-]{1,31}$/u;
const MEDIA_TYPE_PATTERN = /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;

const STATUS_AUTHORITIES = Object.freeze({
  DRAFT_ASSERTION: "SELF_DECLARATION",
  REVIEW_RECORD: "REVIEW_AUTHORITY",
  ALIGNMENT_RECORD: "ALIGNMENT_AUTHORITY",
  ENDORSEMENT_RECORD: "ENDORSEMENT_AUTHORITY",
  CERTIFICATION_RECORD: "CERTIFICATION_AUTHORITY",
});

const AFFECTED_PARTY_STATUSES = new Set([
  "NOT_ESTABLISHED",
  "DECLARED",
  "DOCUMENTED",
]);

export class PublicEvidenceValidationError extends Error {
  constructor(code, location, message) {
    super(`${code} at ${location}: ${message}`);
    this.name = "PublicEvidenceValidationError";
    this.code = code;
    this.location = location;
  }
}

function fail(code, location, message) {
  throw new PublicEvidenceValidationError(code, location, message);
}

function isPlainObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

export function parseStrictJson(text, location = "json") {
  if (typeof text !== "string") {
    fail("JSON_INPUT_TYPE", location, "JSON input must be text");
  }
  if (text.charCodeAt(0) === 0xfeff) {
    fail("JSON_BOM", location, "a byte-order mark is not permitted");
  }

  let cursor = 0;
  const whitespace = /[\u0009\u000a\u000d\u0020]/u;

  function skipWhitespace() {
    while (cursor < text.length && whitespace.test(text[cursor])) cursor += 1;
  }

  function parseString() {
    const start = cursor;
    cursor += 1;
    while (cursor < text.length) {
      const code = text.charCodeAt(cursor);
      if (code === 0x22) {
        cursor += 1;
        try {
          return JSON.parse(text.slice(start, cursor));
        } catch {
          fail("JSON_STRING", location, "string escape is invalid");
        }
      }
      if (code < 0x20) {
        fail("JSON_STRING", location, "unescaped control character in string");
      }
      if (code === 0x5c) {
        cursor += 1;
        if (cursor >= text.length || !/["\\/bfnrtu]/u.test(text[cursor])) {
          fail("JSON_STRING", location, "string escape is invalid");
        }
        if (text[cursor] === "u") {
          const escape = text.slice(cursor + 1, cursor + 5);
          if (!/^[a-fA-F0-9]{4}$/u.test(escape)) {
            fail("JSON_STRING", location, "unicode escape is invalid");
          }
          cursor += 4;
        }
      }
      cursor += 1;
    }
    fail("JSON_STRING", location, "unterminated string");
  }

  function parseNumber() {
    const remaining = text.slice(cursor);
    const match = /^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/u.exec(remaining);
    if (!match) fail("JSON_NUMBER", location, "number is invalid");
    cursor += match[0].length;
    const value = Number(match[0]);
    if (!Number.isFinite(value)) {
      fail("JSON_NUMBER", location, "number must be finite");
    }
    return value;
  }

  function parseArray() {
    const values = [];
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === "]") {
      cursor += 1;
      return values;
    }
    while (cursor < text.length) {
      values.push(parseValue());
      skipWhitespace();
      if (text[cursor] === "]") {
        cursor += 1;
        return values;
      }
      if (text[cursor] !== ",") {
        fail("JSON_ARRAY", location, "expected ',' or ']'");
      }
      cursor += 1;
      skipWhitespace();
    }
    fail("JSON_ARRAY", location, "unterminated array");
  }

  function parseObject() {
    const value = Object.create(null);
    const keys = new Set();
    cursor += 1;
    skipWhitespace();
    if (text[cursor] === "}") {
      cursor += 1;
      return value;
    }
    while (cursor < text.length) {
      if (text[cursor] !== '"') {
        fail("JSON_OBJECT", location, "object key must be a string");
      }
      const key = parseString();
      if (keys.has(key)) {
        fail("DUPLICATE_KEY", location, `duplicate object key '${key}'`);
      }
      keys.add(key);
      skipWhitespace();
      if (text[cursor] !== ":") {
        fail("JSON_OBJECT", location, "expected ':' after object key");
      }
      cursor += 1;
      value[key] = parseValue();
      skipWhitespace();
      if (text[cursor] === "}") {
        cursor += 1;
        return value;
      }
      if (text[cursor] !== ",") {
        fail("JSON_OBJECT", location, "expected ',' or '}'");
      }
      cursor += 1;
      skipWhitespace();
    }
    fail("JSON_OBJECT", location, "unterminated object");
  }

  function parseValue() {
    skipWhitespace();
    const character = text[cursor];
    if (character === '"') return parseString();
    if (character === "{") return parseObject();
    if (character === "[") return parseArray();
    if (character === "-" || /\d/u.test(character ?? "")) return parseNumber();
    for (const [token, value] of [
      ["true", true],
      ["false", false],
      ["null", null],
    ]) {
      if (text.startsWith(token, cursor)) {
        cursor += token.length;
        return value;
      }
    }
    fail("JSON_VALUE", location, "unexpected token");
  }

  const value = parseValue();
  skipWhitespace();
  if (cursor !== text.length) {
    fail("JSON_TRAILING_DATA", location, "unexpected trailing data");
  }
  return value;
}

export function canonicalizeJson(value, location = "json") {
  if (value === null || typeof value === "boolean" || typeof value === "string") {
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value) || !Number.isSafeInteger(value)) {
      fail("NON_CANONICAL_NUMBER", location, "numbers must be safe integers");
    }
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalizeJson(item, `${location}[${index}]`)).join(",")}]`;
  }
  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalizeJson(value[key], `${location}.${key}`)}`)
      .join(",")}}`;
  }
  fail("NON_CANONICAL_VALUE", location, "value is not valid canonical JSON");
}

function assertObject(value, location, keys) {
  if (!isPlainObject(value)) fail("TYPE", location, "must be an object");
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    const extras = actual.filter((key) => !expected.includes(key));
    const missing = expected.filter((key) => !actual.includes(key));
    fail(
      "OBJECT_KEYS",
      location,
      `closed contract mismatch; missing=[${missing.join(",")}], extra=[${extras.join(",")}]`,
    );
  }
}

function assertString(value, location, { pattern, max = 4_096, min = 1 } = {}) {
  if (typeof value !== "string") fail("TYPE", location, "must be a string");
  if (value !== value.trim()) fail("STRING_WHITESPACE", location, "must not have outer whitespace");
  if (value !== value.normalize("NFC")) {
    fail("STRING_NORMALIZATION", location, "must use Unicode NFC normalization");
  }
  if (value.length < min || value.length > max) {
    fail("STRING_LENGTH", location, `length must be between ${min} and ${max}`);
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/u.test(value)) {
    fail("STRING_CONTROL", location, "must not contain control characters");
  }
  if (pattern && !pattern.test(value)) fail("STRING_PATTERN", location, "has an unsupported format");
}

function assertStringArray(value, location, { min = 1, max = 100, pattern } = {}) {
  if (!Array.isArray(value) || value.length < min || value.length > max) {
    fail("ARRAY_LENGTH", location, `must contain between ${min} and ${max} items`);
  }
  const seen = new Set();
  value.forEach((item, index) => {
    assertString(item, `${location}[${index}]`, { pattern });
    if (seen.has(item)) fail("DUPLICATE_ITEM", `${location}[${index}]`, "duplicate value");
    seen.add(item);
  });
}

function assertHttpsUri(value, location) {
  assertString(value, location, { max: 2_048 });
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("URI", location, "must be an absolute HTTPS URI");
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    fail("URI", location, "must be an absolute HTTPS URI without credentials");
  }
}

function assertSortedUnique(items, selector, location) {
  const values = items.map(selector);
  const expected = [...values].sort();
  if (values.some((value, index) => value !== expected[index])) {
    fail("ARRAY_ORDER", location, "must be sorted lexicographically");
  }
  if (new Set(values).size !== values.length) {
    fail("DUPLICATE_ITEM", location, "must not contain duplicate identifiers");
  }
}

function assertSafeRelativePath(value, location) {
  assertString(value, location, { max: 512 });
  if (
    !/^[A-Za-z0-9._/-]+$/u.test(value) ||
    value !== value.normalize("NFC") ||
    value.includes("\\") ||
    value.startsWith("/") ||
    /^[A-Za-z]:/u.test(value) ||
    value.endsWith("/") ||
    value.includes("//")
  ) {
    fail("UNSAFE_PATH", location, "must be a normalized POSIX relative file path");
  }
  const segments = value.split("/");
  if (segments.some((segment) => segment === "." || segment === ".." || segment.length === 0)) {
    fail("UNSAFE_PATH", location, "dot and empty path segments are not permitted");
  }
  if (
    segments.some((segment) =>
      /^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\..*)?$/iu.test(segment),
    )
  ) {
    fail("UNSAFE_PATH", location, "reserved platform device names are not permitted");
  }
  if (value === "manifest.json" || value === "receipt.json") {
    fail("RESERVED_PATH", location, "manifest.json and receipt.json are reserved");
  }
}

function validateClaim(claim) {
  assertObject(claim, "manifest.claim", [
    "assertedBy",
    "authority",
    "grantsStatus",
    "primaryStatus",
  ]);
  assertString(claim.assertedBy, "manifest.claim.assertedBy", { max: 200 });
  if (!(claim.primaryStatus in STATUS_AUTHORITIES)) {
    fail("CLAIM_STATUS", "manifest.claim.primaryStatus", "unsupported claim status");
  }
  if (claim.grantsStatus !== false) {
    fail("STATUS_GRANT", "manifest.claim.grantsStatus", "must be false; the record cannot grant status");
  }
  assertObject(claim.authority, "manifest.claim.authority", ["kind", "reference"]);
  const expectedAuthority = STATUS_AUTHORITIES[claim.primaryStatus];
  if (claim.authority.kind !== expectedAuthority) {
    fail(
      "STATUS_CONFLATION",
      "manifest.claim.authority.kind",
      `must be ${expectedAuthority} for ${claim.primaryStatus}`,
    );
  }
  if (claim.primaryStatus === "DRAFT_ASSERTION") {
    if (claim.authority.reference !== null) {
      fail("UNSUPPORTED_AUTHORITY", "manifest.claim.authority.reference", "draft assertions must use null");
    }
  } else {
    if (claim.authority.reference === null) {
      fail(
        "UNSUPPORTED_AUTHORITY",
        "manifest.claim.authority.reference",
        "non-draft status requires a declared public HTTPS authority reference",
      );
    }
    assertHttpsUri(claim.authority.reference, "manifest.claim.authority.reference");
  }
}

function validateManifest(manifest) {
  assertObject(manifest, "manifest", [
    "affectedPartyGovernance",
    "assetRegistryId",
    "claim",
    "claimBoundary",
    "files",
    "limitations",
    "recordId",
    "reviewScope",
    "schemaVersion",
    "sources",
    "title",
    "validatorEffect",
  ]);
  if (manifest.schemaVersion !== MANIFEST_SCHEMA) {
    fail("SCHEMA_VERSION", "manifest.schemaVersion", `must be ${MANIFEST_SCHEMA}`);
  }
  assertString(manifest.recordId, "manifest.recordId", { pattern: RECORD_ID_PATTERN });
  if (manifest.assetRegistryId !== null) {
    assertString(manifest.assetRegistryId, "manifest.assetRegistryId", {
      pattern: ASSET_REGISTRY_ID_PATTERN,
    });
  }
  assertString(manifest.title, "manifest.title", { max: 300 });
  validateClaim(manifest.claim);

  assertObject(manifest.reviewScope, "manifest.reviewScope", ["excluded", "included", "purpose"]);
  assertString(manifest.reviewScope.purpose, "manifest.reviewScope.purpose", { max: 2_000 });
  assertStringArray(manifest.reviewScope.included, "manifest.reviewScope.included");
  assertStringArray(manifest.reviewScope.excluded, "manifest.reviewScope.excluded");

  assertObject(manifest.affectedPartyGovernance, "manifest.affectedPartyGovernance", [
    "description",
    "sourceIds",
    "status",
  ]);
  if (!AFFECTED_PARTY_STATUSES.has(manifest.affectedPartyGovernance.status)) {
    fail(
      "AFFECTED_PARTY_STATUS",
      "manifest.affectedPartyGovernance.status",
      "unsupported governance status",
    );
  }
  assertString(
    manifest.affectedPartyGovernance.description,
    "manifest.affectedPartyGovernance.description",
    { max: 2_000 },
  );
  assertStringArray(
    manifest.affectedPartyGovernance.sourceIds,
    "manifest.affectedPartyGovernance.sourceIds",
    { min: 0, pattern: SOURCE_ID_PATTERN },
  );
  const sortedGovernanceSourceIds = [...manifest.affectedPartyGovernance.sourceIds].sort();
  if (
    manifest.affectedPartyGovernance.sourceIds.some(
      (value, index) => value !== sortedGovernanceSourceIds[index],
    )
  ) {
    fail(
      "ARRAY_ORDER",
      "manifest.affectedPartyGovernance.sourceIds",
      "must be sorted lexicographically",
    );
  }
  if (
    manifest.affectedPartyGovernance.status === "NOT_ESTABLISHED" &&
    manifest.affectedPartyGovernance.sourceIds.length !== 0
  ) {
    fail(
      "GOVERNANCE_CONFLATION",
      "manifest.affectedPartyGovernance.sourceIds",
      "NOT_ESTABLISHED cannot cite authority sources",
    );
  }
  if (
    manifest.affectedPartyGovernance.status === "DOCUMENTED" &&
    manifest.affectedPartyGovernance.sourceIds.length === 0
  ) {
    fail(
      "UNSUPPORTED_AUTHORITY",
      "manifest.affectedPartyGovernance.sourceIds",
      "DOCUMENTED requires at least one declared source",
    );
  }

  assertStringArray(manifest.limitations, "manifest.limitations", { min: 1, max: 100 });
  if (manifest.validatorEffect !== VALIDATOR_EFFECT) {
    fail("VALIDATOR_EFFECT", "manifest.validatorEffect", `must be ${VALIDATOR_EFFECT}`);
  }
  if (manifest.claimBoundary !== CLAIM_BOUNDARY) {
    fail("CLAIM_BOUNDARY", "manifest.claimBoundary", "must use the exact v0.1 boundary statement");
  }

  if (!Array.isArray(manifest.sources) || manifest.sources.length < 1 || manifest.sources.length > 1_000) {
    fail("ARRAY_LENGTH", "manifest.sources", "must contain between 1 and 1000 sources");
  }
  manifest.sources.forEach((source, index) => {
    const location = `manifest.sources[${index}]`;
    assertObject(source, location, ["id", "retrievedOn", "title", "uri"]);
    assertString(source.id, `${location}.id`, { pattern: SOURCE_ID_PATTERN });
    assertString(source.title, `${location}.title`, { max: 300 });
    assertHttpsUri(source.uri, `${location}.uri`);
    assertString(source.retrievedOn, `${location}.retrievedOn`, { pattern: DATE_PATTERN });
  });
  assertSortedUnique(manifest.sources, (source) => source.id, "manifest.sources");
  const sourceIds = new Set(manifest.sources.map((source) => source.id));
  for (const [index, sourceId] of manifest.affectedPartyGovernance.sourceIds.entries()) {
    if (!sourceIds.has(sourceId)) {
      fail(
        "UNDECLARED_SOURCE",
        `manifest.affectedPartyGovernance.sourceIds[${index}]`,
        "source ID is not declared",
      );
    }
  }

  if (!Array.isArray(manifest.files) || manifest.files.length < 1 || manifest.files.length > MAX_FILES) {
    fail("ARRAY_LENGTH", "manifest.files", `must contain between 1 and ${MAX_FILES} files`);
  }
  manifest.files.forEach((file, index) => {
    const location = `manifest.files[${index}]`;
    assertObject(file, location, ["bytes", "mediaType", "path", "sha256", "sourceIds"]);
    assertSafeRelativePath(file.path, `${location}.path`);
    if (!Number.isSafeInteger(file.bytes) || file.bytes < 0) {
      fail("FILE_SIZE", `${location}.bytes`, "must be a non-negative safe integer");
    }
    assertString(file.mediaType, `${location}.mediaType`, { pattern: MEDIA_TYPE_PATTERN, max: 127 });
    assertString(file.sha256, `${location}.sha256`, { pattern: SHA256_PATTERN });
    assertStringArray(file.sourceIds, `${location}.sourceIds`, {
      min: 1,
      max: 1_000,
      pattern: SOURCE_ID_PATTERN,
    });
    const sortedSourceIds = [...file.sourceIds].sort();
    if (file.sourceIds.some((value, sourceIndex) => value !== sortedSourceIds[sourceIndex])) {
      fail("ARRAY_ORDER", `${location}.sourceIds`, "must be sorted lexicographically");
    }
    file.sourceIds.forEach((sourceId, sourceIndex) => {
      if (!sourceIds.has(sourceId)) {
        fail("UNDECLARED_SOURCE", `${location}.sourceIds[${sourceIndex}]`, "source ID is not declared");
      }
    });
  });
  assertSortedUnique(manifest.files, (file) => file.path, "manifest.files");
  const foldedPaths = new Set();
  manifest.files.forEach((file, index) => {
    const folded = file.path.toLocaleLowerCase("en-US");
    if (foldedPaths.has(folded)) {
      fail("PATH_COLLISION", `manifest.files[${index}].path`, "case-insensitive path collision");
    }
    foldedPaths.add(folded);
  });
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function collectPackageFiles(rootDirectory, relativeDirectory = "") {
  const absoluteDirectory = path.join(rootDirectory, ...relativeDirectory.split("/").filter(Boolean));
  const entries = await readdir(absoluteDirectory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, "en"))) {
    const relativePath = relativeDirectory ? `${relativeDirectory}/${entry.name}` : entry.name;
    const absolutePath = path.join(absoluteDirectory, entry.name);
    const stats = await lstat(absolutePath);
    if (stats.isSymbolicLink()) fail("SYMLINK", relativePath, "symbolic links are not permitted");
    if (stats.isDirectory()) {
      files.push(...(await collectPackageFiles(rootDirectory, relativePath)));
    } else if (stats.isFile()) {
      files.push(relativePath.split(path.sep).join("/"));
    } else {
      fail("UNSUPPORTED_ENTRY", relativePath, "only regular files and directories are permitted");
    }
  }
  return files;
}

export async function inspectEvidencePackage(packageDirectory) {
  const rootDirectory = await realpath(packageDirectory).catch(() => {
    fail("PACKAGE_NOT_FOUND", packageDirectory, "package directory does not exist");
  });
  const rootStats = await lstat(rootDirectory);
  if (!rootStats.isDirectory()) fail("PACKAGE_TYPE", packageDirectory, "must be a directory");

  const manifestPath = path.join(rootDirectory, "manifest.json");
  const manifestStats = await lstat(manifestPath).catch(() => {
    fail("MISSING_MANIFEST", "manifest.json", "required manifest is missing");
  });
  if (manifestStats.isSymbolicLink()) {
    fail("SYMLINK", "manifest.json", "symbolic links are not permitted");
  }
  if (!manifestStats.isFile()) fail("MANIFEST_TYPE", "manifest.json", "must be a regular file");
  if (manifestStats.size > MAX_MANIFEST_BYTES) {
    fail("MANIFEST_SIZE", "manifest.json", `must not exceed ${MAX_MANIFEST_BYTES} bytes`);
  }
  const manifestBuffer = await readFile(manifestPath).catch(() => {
    fail("MANIFEST_READ", "manifest.json", "required manifest could not be read");
  });
  if (manifestBuffer.length > MAX_MANIFEST_BYTES) {
    fail("MANIFEST_SIZE", "manifest.json", `must not exceed ${MAX_MANIFEST_BYTES} bytes`);
  }
  const manifestText = manifestBuffer.toString("utf8");
  if (!Buffer.from(manifestText, "utf8").equals(manifestBuffer)) {
    fail("MANIFEST_ENCODING", "manifest.json", "must be valid UTF-8");
  }
  const manifest = parseStrictJson(manifestText, "manifest.json");
  const canonicalManifest = `${canonicalizeJson(manifest, "manifest")}\n`;
  if (manifestText !== canonicalManifest) {
    fail("NON_CANONICAL_MANIFEST", "manifest.json", "bytes must equal canonical JSON plus one LF");
  }
  validateManifest(manifest);

  const packagePaths = (await collectPackageFiles(rootDirectory)).filter(
    (filePath) => filePath !== "manifest.json" && filePath !== "receipt.json",
  );
  if (packagePaths.length > MAX_FILES) {
    fail("FILE_COUNT", packageDirectory, `must not contain more than ${MAX_FILES} evidence files`);
  }
  const declaredPaths = manifest.files.map((file) => file.path);
  const undeclared = packagePaths.filter((filePath) => !declaredPaths.includes(filePath));
  const missing = declaredPaths.filter((filePath) => !packagePaths.includes(filePath));
  if (undeclared.length > 0) {
    fail("UNDECLARED_FILE", undeclared[0], "file is not declared in manifest.files");
  }
  if (missing.length > 0) fail("MISSING_FILE", missing[0], "declared file is missing");

  let totalBytes = manifestBuffer.length;
  const observedFiles = [];
  for (const declaredFile of manifest.files) {
    const absolutePath = path.join(rootDirectory, ...declaredFile.path.split("/"));
    const resolvedParent = await realpath(path.dirname(absolutePath));
    const relativeParent = path.relative(rootDirectory, resolvedParent);
    if (relativeParent.startsWith("..") || path.isAbsolute(relativeParent)) {
      fail("PATH_ESCAPE", declaredFile.path, "resolved parent escapes the package directory");
    }
    const fileStats = await lstat(absolutePath);
    if (fileStats.isSymbolicLink() || !fileStats.isFile()) {
      fail("FILE_TYPE", declaredFile.path, "must be a regular non-symbolic file");
    }
    if (fileStats.size !== declaredFile.bytes) {
      fail("SIZE_MISMATCH", declaredFile.path, `declared ${declaredFile.bytes}, observed ${fileStats.size}`);
    }
    totalBytes += fileStats.size;
    if (totalBytes > MAX_PACKAGE_BYTES) {
      fail("PACKAGE_SIZE", packageDirectory, `must not exceed ${MAX_PACKAGE_BYTES} bytes`);
    }
    const buffer = await readFile(absolutePath);
    if (buffer.length !== declaredFile.bytes) {
      fail("SIZE_MISMATCH", declaredFile.path, `declared ${declaredFile.bytes}, observed ${buffer.length}`);
    }
    const observedDigest = sha256(buffer);
    if (observedDigest !== declaredFile.sha256) {
      fail("DIGEST_MISMATCH", declaredFile.path, "SHA-256 digest does not match manifest");
    }
    observedFiles.push({ bytes: buffer.length, path: declaredFile.path, sha256: observedDigest });
  }

  const manifestReceipt = {
    bytes: manifestBuffer.length,
    path: "manifest.json",
    sha256: sha256(manifestBuffer),
  };
  const receiptBasis = {
    files: observedFiles,
    manifest: manifestReceipt,
    recordId: manifest.recordId,
    schemaVersion: RECEIPT_SCHEMA,
    validatorEffect: VALIDATOR_EFFECT,
  };
  const receipt = {
    ...receiptBasis,
    packageSha256: sha256(Buffer.from(canonicalizeJson(receiptBasis), "utf8")),
  };

  return { manifest, receipt };
}

export async function createEvidenceReceipt(packageDirectory) {
  const { receipt } = await inspectEvidencePackage(packageDirectory);
  return `${canonicalizeJson(receipt, "receipt")}\n`;
}

export async function verifyEvidenceReceipt(packageDirectory, receiptPath) {
  const receiptStats = await lstat(receiptPath).catch(() => {
    fail("MISSING_RECEIPT", receiptPath, "receipt file does not exist");
  });
  if (receiptStats.isSymbolicLink() || !receiptStats.isFile()) {
    fail("RECEIPT_TYPE", receiptPath, "must be a regular non-symbolic file");
  }
  if (receiptStats.size > MAX_MANIFEST_BYTES) {
    fail("RECEIPT_SIZE", receiptPath, `must not exceed ${MAX_MANIFEST_BYTES} bytes`);
  }
  const receiptBuffer = await readFile(receiptPath).catch(() => {
    fail("RECEIPT_READ", receiptPath, "receipt file could not be read");
  });
  const receiptText = receiptBuffer.toString("utf8");
  if (!Buffer.from(receiptText, "utf8").equals(receiptBuffer)) {
    fail("RECEIPT_ENCODING", receiptPath, "must be valid UTF-8");
  }
  const receipt = parseStrictJson(receiptText, receiptPath);
  const canonicalReceipt = `${canonicalizeJson(receipt, "receipt")}\n`;
  if (receiptText !== canonicalReceipt) {
    fail("NON_CANONICAL_RECEIPT", receiptPath, "bytes must equal canonical JSON plus one LF");
  }
  const expected = await createEvidenceReceipt(packageDirectory);
  if (receiptText !== expected) {
    fail("RECEIPT_MISMATCH", receiptPath, "receipt does not match the package bytes");
  }
  return receipt;
}

export function validationSummary(receipt) {
  return {
    claimBoundary: CLAIM_BOUNDARY,
    fileCount: receipt.files.length,
    packageSha256: receipt.packageSha256,
    recordId: receipt.recordId,
    schemaVersion: MANIFEST_SCHEMA,
    valid: true,
    validatorEffect: VALIDATOR_EFFECT,
  };
}
