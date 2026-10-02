import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const read = (p: string) => readFileSync(fileURLToPath(new URL(`../../${p}`, import.meta.url)), "utf8");
const readme = read("README.md");
const section = (title: string) => {
  const start = readme.indexOf(`## ${title}`);
  expect(start, title).toBeGreaterThanOrEqual(0);
  const end = readme.indexOf("\n## ", start + 3);
  return readme.slice(start, end < 0 ? undefined : end);
};

describe("README", () => {
  // verifies: REQ-BUILD-004
  it("states the Node.js and browser requirements", () => {
    const s = section("Requirements");
    expect(s).toMatch(/Node\.js 24 or later/);
    expect(s).toMatch(/X25519/);
  });

  // verifies: REQ-API-010
  it("explains comparing HEM_API_VERSION with the firmware version", () => {
    const s = section("Checking the API version");
    expect(s).toContain("HEM_API_VERSION");
    expect(s).toContain("fwv");
    expect(s).toContain("system.version()");
  });

  // verifies: REQ-NET-011
  it("documents browser use: 412, where the allow-list is set, its syntax and the error class", () => {
    const s = section("Browser use and the device's origin allow-list");
    expect(s).toContain("412");
    expect(s).toMatch(/provisioned/);
    expect(s).toMatch(/configuration write/);
    expect(s).toContain("`*`");
    expect(s).toContain("`*.example.com`");
    expect(s).toMatch(/exact origin/);
    expect(s).toContain("HemOriginRejectedError");
    expect(s).toMatch(/caller's job/);
  });

  // verifies: REQ-NET-012
  it("documents custom TLS trust through fetch", () => {
    const s = section("TLS trust: bring your own `fetch`");
    expect(s).toMatch(/no TLS settings/i);
    expect(s).toContain("NODE_EXTRA_CA_CERTS");
    expect(s).toMatch(/connect: \{ ca:/);
    expect(s).toMatch(/Connecting by IP address/);
    expect(s).toContain("checkServerIdentity");
    expect(s).toMatch(/Browsers offer no such override/);
    expect(s).toMatch(/does \*\*not recover automatically from an expired device\s+certificate/);
  });
});

describe("CI workflow", () => {
  // comment lines are excluded from the content checks
  const ci = read(".github/workflows/ci.yml").split("\n").filter((l) => !l.trim().startsWith("#")).join("\n");

  // verifies: REQ-BUILD-005, REQ-BUILD-004
  it("runs the local check script on Node 24 for every push and pull request, without secrets", () => {
    expect(ci).toMatch(/^on:\s*\n\s+push:\s*\n\s+pull_request:/m);
    expect(ci).toMatch(/node-version: 24/);
    expect(ci).toContain("npm ci");
    expect(ci).toContain("playwright install --with-deps chromium");
    expect(ci).toContain("npm run check");
    expect(ci).not.toMatch(/secrets\.|integration|attended|HEM_/);
    const pkg = JSON.parse(read("package.json"));
    expect(pkg.scripts.check).toBe("npm run build && npm run typecheck && npm test");
    expect(pkg.scripts.test).toBe("vitest run");
  });
});
