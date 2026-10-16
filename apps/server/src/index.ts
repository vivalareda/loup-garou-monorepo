import { resolvePlayerCount } from '@/config';
import { createGameRuntime } from '@/game-runtime';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { startServer } from '@/server/http-server';
import { LocalNarrator } from '@/server/local-narrator';
import { host } from '@/server/sockets';

// Fail fast on a bad PLAYER_COUNT before any socket is accepted
console.log(`Game starts at ${resolvePlayerCount()} players`);

// Raw mode only exists on a real terminal; skip the restart key when
// running without a TTY (CI, piped output, process managers)
if (process.stdin.isTTY) {
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding('utf8');

  console.log('Press r to restart new game');
}

// NARRATOR=dashboard plays the clips in a dashboard tab instead of on this
// machine's speakers (the only option once the server runs on Workers).
// DEBUG_AUDIO only applies to speaker playback
const narrator =
  process.env.NARRATOR === 'dashboard'
    ? new DashboardNarrator(host)
    : new LocalNarrator();

const runtime = createGameRuntime({ host, narrator });

process.stdin.on('data', (key: string) => {
  const keyPressed = key.toString().toLowerCase();

  if (keyPressed === 'r') {
    // In-place reset: the same handler objects keep serving the existing
    // sockets, so no second 'connection' handler is ever registered
    console.log('Resetting game state...');
    runtime.reset();
  }
});

startServer();
