import { createServer, type Server as HttpServer } from 'node:http';
import type { AddressInfo } from 'node:net';
import type {
  ClientToServerEvents,
  DeathInfo,
  GameEndResult,
  PlayerGameSnapshot,
  Role,
  ServerToClientEvents,
} from '@repo/types';
import { Server } from 'socket.io';
import { io as connectClient, type Socket as ClientSocket } from 'socket.io-client';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { DeathManager } from '@/core/death-manager';
import { Game } from '@/core/game';
import { SpecialScenarios } from '@/core/special-scenarios';
import { AudioManager } from '@/segments/audio-manager';
import { SegmentsManager } from '@/segments/segments-manager';
import { EventsActions } from '@/server/events-actions';
import { GameEvents } from '@/server/server-events';
import type { SocketType } from '@/server/sockets';

/**
 * Task 28: the happy-path live-socket test. Boots the live server path
 * (the same class wiring as src/index.ts) on an ephemeral port and drives
 * six real Socket.IO clients through a complete game:
 * join → roles → Cupid/Lovers → werewolf vote → both Witch decisions →
 * dawn deaths → day vote → winner → role reveal → client-triggered
 * restart → the start of a second game.
 *
 * Role assignment is injected: with Game's pop-from-the-end assignment,
 * this array gives (in join order)
 *   P1 WEREWOLF, P2 WEREWOLF, P3 CUPID, P4 WITCH, P5 VILLAGER, P6 VILLAGER
 */
const DETERMINISTIC_ROLES: Role[] = [
  'VILLAGER',
  'VILLAGER',
  'WITCH',
  'CUPID',
  'WEREWOLF',
  'WEREWOLF',
];

type Client = ClientSocket<ServerToClientEvents, ClientToServerEvents>;

/** Buffers every incoming event so nothing is lost before we await it. */
class EventRecorder {
  private readonly queues = new Map<string, unknown[][]>();
  private readonly waiters = new Map<string, ((args: unknown[]) => void)[]>();

  constructor(socket: Client) {
    socket.onAny((event: string, ...args: unknown[]) => {
      const waiter = this.waiters.get(event)?.shift();
      if (waiter) {
        waiter(args);
        return;
      }
      const queue = this.queues.get(event) ?? [];
      queue.push(args);
      this.queues.set(event, queue);
    });
  }

  take(event: string, timeoutMs = 10_000): Promise<unknown[]> {
    const queued = this.queues.get(event);
    if (queued && queued.length > 0) {
      const args = queued.shift();
      return Promise.resolve(args ?? []);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error(`Timed out waiting for "${event}"`)),
        timeoutMs
      );
      const list = this.waiters.get(event) ?? [];
      list.push((args) => {
        clearTimeout(timer);
        resolve(args);
      });
      this.waiters.set(event, list);
    });
  }
}

type Player = {
  name: string;
  socket: Client;
  events: EventRecorder;
  sid: string;
  sessionToken: string;
  role: Role | null;
};

describe('live-socket happy path', () => {
  let httpServer: HttpServer;
  let io: Server<ClientToServerEvents, ServerToClientEvents>;
  let players: Player[];
  let serverUrl: string;
  const savedEnv: Record<string, string | undefined> = {};

  beforeAll(async () => {
    for (const key of ['DEBUG_AUDIO', 'DAY_VOTE_DELAY_MS', 'LOVER_ALERT_DELAY_MS']) {
      savedEnv[key] = process.env[key];
    }
    process.env.DEBUG_AUDIO = '1';
    process.env.DAY_VOTE_DELAY_MS = '0';
    process.env.LOVER_ALERT_DELAY_MS = '0';

    httpServer = createServer();
    io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
      cors: { origin: '*' },
    });

    // Same wiring as src/index.ts initGame(), with deterministic roles
    const typedIo = io as unknown as SocketType;
    const deathManager = new DeathManager();
    const game = new Game(typedIo, deathManager, {
      shuffleRoles: () => [...DETERMINISTIC_ROLES],
    });
    const audioManager = new AudioManager(deathManager);
    const segmentsManager = new SegmentsManager(
      game,
      typedIo,
      audioManager,
      new SpecialScenarios(game, audioManager)
    );
    const eventsActions = new EventsActions(game, segmentsManager, typedIo);
    new GameEvents(game, segmentsManager, typedIo, eventsActions)
      .setupSocketHandlers();

    await new Promise<void>((resolve) => {
      httpServer.listen(0, '127.0.0.1', () => resolve());
    });
    const { port } = httpServer.address() as AddressInfo;
    serverUrl = `http://127.0.0.1:${port}`;

    players = Array.from({ length: 6 }, (_, index) => {
      const socket: Client = connectClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });
      return {
        name: `P${index + 1}`,
        socket,
        events: new EventRecorder(socket),
        sid: '',
        sessionToken: '',
        role: null,
      };
    });
  });

  afterAll(() => {
    for (const player of players ?? []) {
      player.socket.disconnect();
    }
    io?.close();
    httpServer?.close();
    for (const [key, value] of Object.entries(savedEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  const joinAll = async () => {
    // Join sequentially so the server-side join order (and therefore the
    // deterministic role assignment) is stable
    for (const player of players) {
      player.socket.emit('player:join', player.name);
      const [data] = (await player.events.take('lobby:player-data')) as [
        { socketId: string; sessionToken?: string },
      ];
      player.sid = data.socketId;
      player.sessionToken = data.sessionToken ?? '';
    }

    for (const player of players) {
      const [role] = (await player.events.take('player:role-assigned')) as [
        Role,
      ];
      player.role = role;
    }
  };

  const byRole = (role: Role) => {
    const matches = players.filter((player) => player.role === role);
    if (matches.length === 0) {
      throw new Error(`No player was assigned the ${role} role`);
    }
    return matches;
  };

  it(
    'plays a full game to a winner, reveals roles, restarts from a phone, and starts a second game',
    { timeout: 30_000 },
    async () => {
      // --- Join & deterministic roles ------------------------------------
      await joinAll();
      expect(players.map((player) => player.role)).toEqual([
        'WEREWOLF',
        'WEREWOLF',
        'CUPID',
        'WITCH',
        'VILLAGER',
        'VILLAGER',
      ]);
      const [wolf1, wolf2] = byRole('WEREWOLF');
      const [cupid] = byRole('CUPID');
      const [witch] = byRole('WITCH');
      const [villager1] = byRole('VILLAGER');

      // --- Cupid: make the two werewolves lovers --------------------------
      await cupid.events.take('cupid:pick-required');
      cupid.socket.emit('cupid:lovers-pick', [wolf1.sid, wolf2.sid]);

      // --- Lovers acknowledge each other ----------------------------------
      const [wolf1LoverName] = (await wolf1.events.take(
        'alert:player-is-lover'
      )) as [string];
      expect(wolf1LoverName).toBe(wolf2.name);
      await wolf2.events.take('alert:player-is-lover');
      wolf1.socket.emit('alert:lover-closed-alert');
      wolf2.socket.emit('alert:lover-closed-alert');

      // --- Werewolves agree on a victim ------------------------------------
      await wolf1.events.take('werewolf:pick-required');
      await wolf2.events.take('werewolf:pick-required');

      // Live reconnect: wolf2's phone "locks" mid-phase, the socket drops,
      // and a fresh socket recovers the seat with the session token —
      // receiving the pending werewolf prompt in the snapshot
      wolf2.socket.disconnect();
      const recoveredSocket: Client = connectClient(serverUrl, {
        transports: ['websocket'],
        forceNew: true,
      });
      wolf2.socket = recoveredSocket;
      wolf2.events = new EventRecorder(recoveredSocket);
      // An action tapped while offline is flushed from the new socket
      // BEFORE the rejoin: the server must reject it, not crash
      recoveredSocket.emit('werewolf:player-voted', villager1.sid);
      recoveredSocket.emit('player:rejoin', wolf2.sessionToken);
      await wolf2.events.take('alert:action-error');
      const [snapshot] = (await wolf2.events.take('game:snapshot')) as [
        PlayerGameSnapshot,
      ];
      expect(snapshot.phase).toBe('WEREWOLF');
      expect(snapshot.pendingPrompt).toEqual({ kind: 'WEREWOLF' });
      expect(snapshot.loverName).toBe(wolf1.name);
      wolf2.sid = snapshot.self.socketId;

      wolf1.socket.emit('werewolf:player-voted', villager1.sid);
      wolf2.socket.emit('werewolf:player-voted', villager1.sid);

      // --- Witch: skip both potions ----------------------------------------
      const [healTargetSid] = (await witch.events.take('witch:can-heal')) as [
        string,
      ];
      expect(healTargetSid).toBe(villager1.sid);
      witch.socket.emit('witch:skipped-heal');
      await witch.events.take('witch:pick-poison-player');
      witch.socket.emit('witch:skipped-poison');

      // --- Dawn: the victim dies and everyone hears about it ---------------
      await villager1.events.take('alert:player-is-dead');
      const [deaths] = (await cupid.events.take('night:deaths-announced')) as [
        DeathInfo[],
      ];
      expect(deaths).toHaveLength(1);
      expect(deaths[0]).toMatchObject({
        playerId: villager1.sid,
        playerName: villager1.name,
        cause: 'WEREWOLVES',
      });

      // --- Day vote: the village eliminates a werewolf ----------------------
      const aliveVoters = players.filter((player) => player !== villager1);
      await Promise.all(
        aliveVoters.map((player) => player.events.take('day:voting-phase-start'))
      );
      for (const voter of aliveVoters) {
        voter.socket.emit('day:player-voted', wolf1.sid);
      }

      // wolf1 is eliminated; wolf2 (the lover) dies of grief; the village wins
      const winners = [cupid, witch, villager1, ...byRole('VILLAGER').slice(1)];
      const results = (await Promise.all(
        winners.map(
          (player) => player.events.take('alert:player-won') as Promise<[
            GameEndResult,
          ]>
        )
      )).map(([result]) => result);
      const [wolfResult] = (await wolf1.events.take('alert:player-lost')) as [
        GameEndResult,
      ];
      await wolf2.events.take('alert:player-lost');

      // A player who died on the FIRST night still received the winner event
      const deadWinnerResult = results[2];
      expect(deadWinnerResult.winningFaction).toBe('villagers');

      // --- Role reveal -------------------------------------------------------
      expect(wolfResult.winningFaction).toBe('villagers');
      expect(wolfResult.players).toHaveLength(6);
      for (const player of players) {
        expect(wolfResult.players).toContainEqual(
          expect.objectContaining({
            name: player.name,
            socketId: player.sid,
            role: player.role,
          })
        );
      }
      const revealedVictim = wolfResult.players.find(
        (revealed) => revealed.socketId === villager1.sid
      );
      expect(revealedVictim?.isAlive).toBe(false);

      // --- Restart from a phone (any player, even a dead one) ---------------
      villager1.socket.emit('game:restart');
      await Promise.all(
        players.map((player) => player.events.take('game:restarted'))
      );

      // --- Second game over the SAME sockets ---------------------------------
      await joinAll();
      expect(players.map((player) => player.role)).toEqual([
        'WEREWOLF',
        'WEREWOLF',
        'CUPID',
        'WITCH',
        'VILLAGER',
        'VILLAGER',
      ]);
      // The second game reached its first phase: Cupid is prompted again
      await byRole('CUPID')[0].events.take('cupid:pick-required');
    }
  );
});
