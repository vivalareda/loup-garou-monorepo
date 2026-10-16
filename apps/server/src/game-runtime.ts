import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import type { Narrator } from '@/segments/narrator';
import { SegmentsManager } from '@/segments/segments-manager';
import type { ConnectionHost } from '@/server/connection';
import { DashboardNarrator } from '@/server/dashboard-narrator';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';

export type GameRuntimeOptions = {
  /** The transport every client connects through. */
  host: ConnectionHost;
  /**
   * Plays the narration. A `DashboardNarrator` is also wired to the
   * dashboard tab that registers as narrator over `host`.
   */
  narrator: Narrator;
  /**
   * Registers the dashboard's testing tools (`admin:*`, `admin:mock-*`),
   * which let any client advance phases, inject players or change deaths.
   * Off, those events are ignored.
   */
  adminEvents: boolean;
};

export type GameRuntime = {
  game: Game;
  segmentsManager: SegmentsManager;
  events: GameEvents;
  /**
   * Starts a new game in place: the same objects keep serving the
   * connected clients, so no second `connection` handler is registered.
   *
   * Known limitation: work already in flight is not cancelled. A segment
   * awaiting a narration clip (or a paused resolution) resumes against
   * the new game when it settles. Reset is only reachable once a game
   * has finished (`game:restart`, an empty room on the Worker) or with
   * Node's `r` key, and a finished game has no deadlines left, so in
   * practice only a clip still playing can leak through.
   */
  reset: () => void;
};

/**
 * Builds one game and attaches its socket handlers (and the dashboard
 * narrator's, if any) to `host`. Shared by the Node entry (index.ts) and
 * the Worker's Durable Object, so it must import nothing Node-only.
 */
export function createGameRuntime({
  host,
  narrator,
  adminEvents,
}: GameRuntimeOptions): GameRuntime {
  const deathManager = new DeathManager();
  const game = new Game(host, deathManager);
  const audioManager = new AudioManager(deathManager, narrator);
  const specialScenarios = new SpecialScenarios(game, audioManager);
  const segmentsManager = new SegmentsManager(
    game,
    host,
    audioManager,
    specialScenarios
  );
  const eventsActions = new EventsActions(game, segmentsManager, host);
  const events = new GameEvents(game, segmentsManager, host, eventsActions);
  events.setupSocketHandlers({ adminEvents });

  if (narrator instanceof DashboardNarrator) {
    wireDashboardNarrator(host, narrator);
  }

  return { game, segmentsManager, events, reset: () => events.resetGame() };
}

/** Forwards the narrator events of every client to the dashboard narrator. */
function wireDashboardNarrator(
  host: ConnectionHost,
  narrator: DashboardNarrator
) {
  host.on('connection', (connection) => {
    connection.on('narrator:register', () => narrator.attach(connection.id));
    connection.on('narrator:done', (clipId) =>
      narrator.complete(connection.id, clipId)
    );
    connection.on('disconnect', () => narrator.detach(connection.id));
  });
}
