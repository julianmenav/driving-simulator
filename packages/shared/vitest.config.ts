import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

// Several domain tests import via the `@domain` alias (e.g. RoadGraph.test.ts,
// TrafficSignals.test.ts), so the test runner needs it resolved here too.
export default defineConfig({
  resolve: {
    alias: {
      '@domain': fileURLToPath(new URL('./src/domain', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
  },
});
