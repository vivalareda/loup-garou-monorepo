import { Game } from '@/core/game';
import { SegmentsManager } from '@/segments/segments-manager';
import { GameEvents } from '@/server/events';
import { startServer } from '@/server/http-server';
import { io } from '@/server/sockets';

process.stdin.setRawMode(true);
process.stdin.resume();
process.stdin.setEncoding('utf8');

console.log('Press r to restart new game');

let game: Game;
let segmentsManager: SegmentsManager;
let events: GameEvents;

const initGame = () => {
  game = new Game(io);
  segmentsManager = new SegmentsManager(game, io);
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
