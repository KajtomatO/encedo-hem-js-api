// supports: REQ-BUILD-001
// Builds the package once before the Node project runs, so the static checks
// inspect output that matches the current source.
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

export default function setup(): void {
  const root = fileURLToPath(new URL("../..", import.meta.url));
  const require = createRequire(import.meta.url);
  const tsc = require.resolve("typescript/bin/tsc");
  rmSync(new URL("../../dist", import.meta.url), { recursive: true, force: true });
  execFileSync(process.execPath, [tsc, "-p", "tsconfig.build.json"], {
    cwd: root,
    stdio: "inherit",
  });
}
