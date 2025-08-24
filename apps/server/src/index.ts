import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { GameEvents } from '@/server/events';
import { startServer } from '@/server/http-server';
import { io } from '@/server/sockets';

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

console.log('Press r to restart new game');

let game: Game;
let audioManager: AudioManager;
let segmentsManager: SegmentsManager;
let events: GameEvents;
let deathManager: DeathManager;

const initGame = () => {
  deathManager = new DeathManager();
  game = new Game(io, deathManager);
  audioManager = new AudioManager(deathManager);
  segmentsManager = new SegmentsManager(game, io, audioManager);
  events = new GameEvents(game, segmentsManager, io);
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
