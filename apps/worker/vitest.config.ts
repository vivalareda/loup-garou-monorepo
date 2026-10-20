import { fileURLToPath } from 'node:url';
import { cloudflareTest } from '@cloudflare/vitest-plugin';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: './wrangler.jsonc' },
      // A 4-player game, so a test can fill a room without 6 sockets, and a
      // small cap so a test can reach it
      miniflare: {
        bindings: { PLAYER_COUNT: '4', MAX_CONNECTIONS_PER_ROOM: '6' },
      },
    }),
  ],
  test: {
    // The first request loads the whole game bundle into workerd
    testTimeout: 20_000,
  },
  resolve: {
    // Wrangler resolves `@/` through tsconfig paths; Vite needs it spelled out
    alias: [
      {
        find: /^@\//,
        replacement: fileURLToPath(new URL('../server/src/', import.meta.url)),
      },
    ],
  },
});
