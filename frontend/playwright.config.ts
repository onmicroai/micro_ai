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
  // Multiple reporters: HTML for viewing, JSON for parsing, JUnit for CI, list for console
  reporter: process.env.CI
    ? [
        ["html", { outputFolder: "playwright-report" }],
        ["json", { outputFile: "playwright-report/results.json" }],
        ["junit", { outputFile: "playwright-report/junit.xml" }],
        ["list"],
      ]
    : [["html"], ["list"]],

  use: {
    baseURL: TEST_BASE_URL,
    trace: "on-first-retry",
    // Capture screenshot and video on failure for better debugging
    screenshot: "only-on-failure",
    video: "retain-on-failure",
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
