import { Game } from '@/core/game';
import { GameEvents } from '@/server/event';
import { startServer } from '@/server/http-server';
const game = new Game();
const events = new GameEvents(game);
events.setupSocketHandlers();
startServer();
