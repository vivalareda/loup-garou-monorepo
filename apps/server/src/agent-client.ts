import { createInterface } from 'node:readline';
import { createRealtimeClient } from '@repo/realtime';
import { Schema } from 'effect';
import {
  type ClientToServerEvents,
  isClientEvent,
  type PlayerGameSnapshot,
  roomUrl,
} from '@repo/types';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
const roomCode = process.env.ROOM_CODE || undefined;
const name = process.argv[2];

if (!name) {
  console.error('Usage: pnpm --filter server agent <name>');
  process.exit(1);
}

const accessToken = process.env.ACCESS_TOKEN || undefined;
const socket = createRealtimeClient(roomUrl(serverUrl, roomCode, accessToken));

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

/** One stdin line: an event name plus its (unvalidated) payload args. */
const AgentCommand = Schema.parseJson(
  Schema.Struct({
    event: Schema.String,
    args: Schema.optional(Schema.Array(Schema.Unknown)),
  })
);

const decodeCommand = Schema.decodeUnknownSync(AgentCommand);

const input = createInterface({ input: process.stdin });

input.on('line', (line) => {
  try {
    const command = decodeCommand(line);

    if (command.event === 'agent:get-state') {
      emitState();

      return;
    }

    if (!isClientEvent(command.event)) {
      throw new Error(`Unknown event "${command.event}"`);
    }

    // SAFETY: only the event name is checked here; the payload args are
    // forwarded as-is because the server validates every payload it receives
    const emit = socket.emit.bind(socket) as (
      event: keyof ClientToServerEvents,
      ...args: unknown[]
    ) => void;

    emit(command.event, ...(command.args ?? []));
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
