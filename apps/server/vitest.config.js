import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/index.ts',
        'src/services/AudioManager.ts',
        'src/services/GameFlow.ts',
        'src/services/HttpServer.ts',
        'src/services/SocketServer.ts',
        'src/services/SocketHandlers.ts',
        'src/services/socket-event-handlers.ts',
        'src/services/socket-server.ts',
        'src/services/game-state.ts',
        'src/services/lobby.bk.ts',
      ],
    },
  },
});
