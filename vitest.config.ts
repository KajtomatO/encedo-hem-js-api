import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";

// Unit tests (tests/unit) run twice: in Node and in headless Chromium.
// Static and packaging checks (tests/static) read files and run in Node only.
// CHROMIUM_PATH points Playwright at a preinstalled Chromium when set.
const executablePath = process.env.CHROMIUM_PATH;

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "node",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "tests/static/**/*.test.ts"],
          setupFiles: ["tests/support/setup.ts"],
          globalSetup: ["tests/support/global-build.ts"],
          testTimeout: 30_000,
        },
      },
      {
        test: {
          name: "browser",
          include: ["tests/unit/**/*.test.ts"],
          setupFiles: ["tests/support/setup.ts"],
          testTimeout: 30_000,
          browser: {
            enabled: true,
            headless: true,
            provider: playwright(
              executablePath ? { launchOptions: { executablePath } } : {},
            ),
            instances: [{ browser: "chromium" }],
          },
        },
      },
    ],
  },
});
