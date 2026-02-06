// Load .env before tests/constants so process.env.NEXT_PUBLIC_* etc. are available in tests
import "dotenv/config";

import { defineConfig, devices } from "@playwright/test";
import { TEST_BASE_URL } from "tests/constants";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",

  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
  },

  projects: [
    // 1) Setup project: runs ONLY auth.setup.ts and CREATES the state file
    {
      name: "setup",
      testMatch: /auth\.setup\.ts/,
      use: {
        ...devices["Desktop Chrome"], // run login once in Chromium
        storageState: undefined,
      },
    },

    // 2) Real browser projects use the generated storageState
    {
      name: "chromium",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/state.json",
      },
    },
    {
      name: "firefox",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Firefox"],
        storageState: "playwright/.auth/state.json",
      },
    },
    {
      name: "webkit",
      dependencies: ["setup"],
      use: {
        ...devices["Desktop Safari"],
        storageState: "playwright/.auth/state.json",
      },
    },
  ],
});
