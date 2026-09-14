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
    /**
     * Raised from the 5s default, because the suite now contains a dozen
     * source-scanning guards that walk every file under src -- the one-today
     * sweep, the duplicate-rule sweep, the eaten-escape sweeps, the Hebrew
     * plural sweep, the signature-coverage check.
     *
     * Individually each takes well under a second. Run in parallel with the
     * jsdom component tests they occasionally pushed a NEIGHBOURING test past
     * five seconds, so the suite failed with timeouts on tests that pass in
     * isolation -- the worst kind of red, because the named test is innocent
     * and the real cause is elsewhere. A flaky suite gets ignored, and an
     * ignored suite protects nothing.
     *
     * The guards are the point, so the budget moves rather than the guards.
     */
    testTimeout: 20_000,
  },
});
