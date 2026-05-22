import { defineConfig } from "vitest/config";
import { fileURLToPath } from "url";

export default defineConfig({
  css: {
    postcss: {
      plugins: [],
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: ["./jest.setup.tsx"],
    include: ["tests/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    exclude: ["tests/e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      include: ["src/**/*.{js,jsx,ts,tsx}"],
      exclude: ["src/**/*.d.ts", "src/app/api/**"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
