import { io, type Socket } from 'socket.io-client';
import type { PlayerGameSnapshot, SnapshotPlayer } from '@repo/types';

const serverUrl = process.env.SERVER_URL ?? 'http://localhost:3000';
const names = process.argv.slice(2).length >= 6
  ? process.argv.slice(2)
  : ['agent-1', 'agent-2', 'agent-3', 'agent-4', 'agent-5', 'agent-6'];

const clients: Array<{ name: string; socket: Socket; acted: string }> = [];
let started = false;
let finished = false;

const pick = (players: SnapshotPlayer[], selfId: string) => {
  const alive = players.filter((player) => player.isAlive && player.socketId !== selfId);
  return alive[Math.floor(Math.random() * alive.length)];
};

const act = (client: (typeof clients)[number], snapshot: PlayerGameSnapshot) => {
  if (finished || !snapshot.pendingPrompt || !snapshot.self.socketId) return;
  const prompt = snapshot.pendingPrompt;
  const key = `${snapshot.phase}:${prompt.kind}`;
  if (client.acted === key) return;
  client.acted = key;

  const selfId = snapshot.self.socketId;
  const target = pick(snapshot.players, selfId);
  if (prompt.kind === 'CUPID') {
    const choices = snapshot.players.filter((p) => p.isAlive && p.socketId !== selfId).slice(0, 2);
    client.socket.emit('cupid:lovers-pick', choices.map((p) => p.socketId));
  } else if (prompt.kind === 'WEREWOLF' || prompt.kind === 'DAY-VOTE') {
    if (target) client.socket.emit(prompt.kind === 'WEREWOLF' ? 'werewolf:player-voted' : 'day:player-voted', target.socketId);
  } else if (prompt.kind === 'WITCH-HEAL') {
    client.socket.emit('witch:skipped-heal');
  } else if (prompt.kind === 'WITCH-POISON') {
    client.socket.emit('witch:skipped-poison');
  } else if (prompt.kind === 'HUNTER') {
    if (target) client.socket.emit('hunter:killed-player', target.socketId);
  } else if (prompt.kind === 'LOVERS') {
    client.socket.emit('alert:lover-closed-alert');
  }
};

for (const name of names) {
  const socket = io(serverUrl);
  const client = { name, socket, acted: '' };
  clients.push(client);
  socket.on('connect', () => {
    socket.emit('player:join', name);
    setTimeout(() => {
      socket.emit('agent:get-state', (snapshot: PlayerGameSnapshot) => {
        process.stdout.write(`${JSON.stringify({ agent: name, ...snapshot })}\\n`);
        act(client, snapshot);
      });
    }, 50);
  });
  const requestState = () => socket.emit('agent:get-state', (snapshot: PlayerGameSnapshot) => {
    client.acted = '';
    process.stdout.write(`${JSON.stringify({ agent: name, ...snapshot })}\\n`);
    if (snapshot.phase === 'FINISHED') finished = true;
    else act(client, snapshot);
  });
  socket.on('game:phase-changed', requestState);
  for (const promptEvent of ['cupid:pick-required', 'werewolf:pick-required', 'witch:can-heal', 'witch:pick-poison-player', 'hunter:pick-required', 'day:voting-phase-start']) {
    socket.on(promptEvent, requestState);
  }
  socket.on('game:snapshot', (snapshot: PlayerGameSnapshot) => {
    process.stdout.write(`${JSON.stringify({ agent: name, ...snapshot })}\n`);
    if (snapshot.phase === 'FINISHED') {
      finished = true;
      return;
    }
    act(client, snapshot);
  });
  socket.on('lobby:player-data', () => {
    socket.emit('agent:get-state', (snapshot: PlayerGameSnapshot) => act(client, snapshot));
  });
  socket.on('lobby:villagers-list', () => {
    if (!started && clients.length === names.length) {
      started = true;
      clients[0].socket.emit('admin:start-game');
    }
  });
  socket.on('alert:action-error', (message) => {
    client.acted = '';
    process.stderr.write(`${name}: ${message}\n`);
    setTimeout(requestState, 25);
  });
}

process.on('SIGINT', () => {
  for (const client of clients) client.socket.disconnect();
  process.exit(0);
});
