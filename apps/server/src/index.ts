import { Game } from '@/core/game';
import { SegmentsManager } from '@/segments/segments-manager';
import { GameEvents } from '@/server/event';
import { startServer } from '@/server/http-server';
import { io } from '@/server/sockets';

const game = new Game(io);
const segmentsManager = new SegmentsManager(game, io);
const events = new GameEvents(game, segmentsManager, io);
events.setupSocketHandlers();

startServer();
