import { defineConfig } from "vitest/config"

export default defineConfig({
    test: {
        projects: [
            {
                test: {
                    include: [
                        "src/indexedDB/w3c-vitest-tests/concurrent/**/*.test.ts",
                    ],
                    globals: true,
                    browser: {
                        provider: "playwright",
                        enabled: true,
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                    testTimeout: 1000,
                    hookTimeout: 10000,
                },
            },
            {
                test: {
                    include: [
                        "src/indexedDB/w3c-vitest-tests/serial/**/*.test.ts",
                    ],
                    poolOptions: { threads: { singleThread: true } },
                    globals: true,
                    browser: {
                        provider: "playwright",
                        enabled: true,
                        headless: true,
                        instances: [{ browser: "chromium" }],
                    },
                    testTimeout: 60000,
                    hookTimeout: 60000,
                },
            },
        ],
        coverage: {
            provider: "v8",
            reporter: ["text", "json", "html"],
        },
    },
})
