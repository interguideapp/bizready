import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    /**
     * Per-file environment. Nearly everything here is a pure engine and runs
     * faster in node; the component tests declare `@vitest-environment jsdom`
     * at the top of the file.
     *
     * Those component tests exist because the authenticated screens sit behind
     * a login I cannot perform, so the browser could only ever verify the
     * marketing page. Rendering the components directly is how the accessible
     * names, the role gating and the paywall get checked as RENDERED OUTPUT
     * rather than as an assertion about source code.
     */
    environment: "node",
  },
});
