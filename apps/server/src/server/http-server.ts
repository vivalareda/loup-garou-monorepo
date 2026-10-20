import { createServer } from 'node:http';

const SUCCESS_CODE = 200;

// Plain requests get a health-check answer; the game runs over the
// WebSocket upgrade handled in sockets.ts
const httpServer = createServer((_, res) => {
  res.writeHead(SUCCESS_CODE, { 'Content-Type': 'text/plain' });
  res.end('ok');
});

const PORT = process.env.PORT || '3000';

export function startServer() {
  httpServer.listen(Number.parseInt(PORT, 10), '0.0.0.0', () => {
    console.log(`Werewolf Game Server running on port ${PORT}`);
  });
}

export { httpServer };
