import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import { startServer } from '@/server/http-server';
import { GameEvents } from '@/server/server-events';
import { io } from '@/server/sockets';
import { SpecialScenarios } from './core/special-scenarios';

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

console.log('Press r to restart new game');

let game: Game;
let audioManager: AudioManager;
let segmentsManager: SegmentsManager;
let events: GameEvents;
let deathManager: DeathManager;
let eventsActions: EventsActions;
let specialScenarios: SpecialScenarios;

const initGame = () => {
  deathManager = new DeathManager();
  game = new Game(io, deathManager);
  audioManager = new AudioManager(deathManager);
  specialScenarios = new SpecialScenarios(game, audioManager);
  segmentsManager = new SegmentsManager(
    game,
    io,
    audioManager,
    specialScenarios
  );
  eventsActions = new EventsActions(game, segmentsManager, io);
  events = new GameEvents(game, segmentsManager, io, eventsActions);
  events.setupSocketHandlers();
};

process.stdin.on('data', (key: string) => {
  const keyPressed = key.toString().toLowerCase();

  if (keyPressed === 'r') {
    console.log('Resetting game state...');
    initGame();
  }
});

initGame();
startServer();
