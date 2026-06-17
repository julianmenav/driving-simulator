/// <reference types="vitest/config" />
import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/driving-simulator/',
  plugins: [react()],
  resolve: {
    alias: {
      // The domain now lives in the shared workspace package; the other layers
      // stay in the client, so client import statements are unchanged.
      '@domain': fileURLToPath(new URL('../shared/src/domain', import.meta.url)),
      '@application': fileURLToPath(new URL('./src/application', import.meta.url)),
      '@infrastructure': fileURLToPath(new URL('./src/infrastructure', import.meta.url)),
      '@ui': fileURLToPath(new URL('./src/ui', import.meta.url)),
    },
  },
  server: {
    // Bind to 0.0.0.0 so other devices on the LAN can load the client (they
    // then reach the server at the same host, see multiplayerStore).
    host: true,
    // The shared package sits outside the client root; allow Vite to read it.
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
  },
});
