import { createInterface } from 'node:readline';
import { io } from 'socket.io-client';
import type { PlayerGameSnapshot } from '@repo/types';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
const name = process.argv[2];
if (!name) {
  console.error('Usage: pnpm --filter server agent <name>');
  process.exit(1);
}

const socket = io(serverUrl);
const emitState = () => {
  socket.emit('agent:get-state', (snapshot: PlayerGameSnapshot) => {
    process.stdout.write(`${JSON.stringify({ type: 'state', ...snapshot })}\n`);
  });
};

socket.on('connect', () => socket.emit('player:join', name));
socket.on('lobby:player-data', () => emitState());
socket.on('game:snapshot', (snapshot) => {
  process.stdout.write(`${JSON.stringify({ type: 'state', ...snapshot })}\n`);
});
socket.on('alert:action-error', (message) => {
  process.stdout.write(`${JSON.stringify({ type: 'error', message })}\n`);
  emitState();
});

const input = createInterface({ input: process.stdin });
input.on('line', (line) => {
  try {
    const command = JSON.parse(line) as {
      event: string;
      args?: unknown[];
    };
    if (command.event === 'agent:get-state') {
      emitState();
      return;
    }
    socket.emit(command.event, ...(command.args ?? []));
    setTimeout(emitState, 25);
  } catch (error) {
    process.stdout.write(
      `${JSON.stringify({ type: 'error', message: String(error) })}\n`
    );
  }
});

process.on('SIGINT', () => {
  socket.disconnect();
  process.exit(0);
});
