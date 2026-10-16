import { resolvePlayerCount } from '@/config';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { EventsActions } from '@/server/events-actions';
import { startServer } from '@/server/http-server';
import { LocalNarrator } from '@/server/local-narrator';
import { GameEvents } from '@/server/server-events';
import { host } from '@/server/sockets';
import { SpecialScenarios } from './core/special-scenarios';

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

let game: Game;
let audioManager: AudioManager;
let segmentsManager: SegmentsManager;
let events: GameEvents;
let deathManager: DeathManager;
let eventsActions: EventsActions;
let specialScenarios: SpecialScenarios;

// NARRATOR=dashboard plays the clips in a dashboard tab instead of on this
// machine's speakers (the only option once the server runs on Workers).
// DEBUG_AUDIO only applies to speaker playback
const dashboardNarrator =
  process.env.NARRATOR === 'dashboard'
    ? new DashboardNarrator(host)
    : undefined;
const narrator = dashboardNarrator ?? new LocalNarrator();

const initGame = () => {
  deathManager = new DeathManager();
  game = new Game(host, deathManager);
  audioManager = new AudioManager(deathManager, narrator);
  specialScenarios = new SpecialScenarios(game, audioManager);
  segmentsManager = new SegmentsManager(
    game,
    host,
    audioManager,
    specialScenarios
  );
  eventsActions = new EventsActions(game, segmentsManager, host);
  events = new GameEvents(game, segmentsManager, host, eventsActions);
  events.setupSocketHandlers();
};

process.stdin.on('data', (key: string) => {
  const keyPressed = key.toString().toLowerCase();

  if (keyPressed === 'r') {
    // In-place reset: the same handler objects keep serving the existing
    // sockets, so no second 'connection' handler is ever registered
    console.log('Resetting game state...');
    events.resetGame();
  }
});

initGame();

if (dashboardNarrator) {
  host.on('connection', (connection) => {
    connection.on('narrator:register', () =>
      dashboardNarrator.attach(connection.id)
    );
    connection.on('narrator:done', (clipId) =>
      dashboardNarrator.complete(connection.id, clipId)
    );
    connection.on('disconnect', () => dashboardNarrator.detach(connection.id));
  });
}

startServer();
