import type { SegmentType } from '@repo/types';
import { Effect, Layer } from 'effect';
import { AudioManager } from '../AudioManager.js';
import { Game } from '../Game.js';
import { Lobby } from '../Lobby.js';
import { LobbyConfig } from '../LobbyConfig.js';
import { type SocketIOInstance, SocketServer } from '../SocketServer.js';

/**
 * Test Layers
 */

/**
 * LobbyTest layer: Lobby + LobbyConfig.Test
 * Pre-configured lobby with maxPlayers=2 for testing
 */
export const LobbyTest = Lobby.DefaultWithoutDependencies.pipe(
  Layer.provide(LobbyConfig.Test)
);

/**
 * GameTest layer: Game + LobbyTest
 * Pre-configured game service with lobby (maxPlayers=2)
 */
export const GameTest = Layer.mergeAll(
  Game.DefaultWithoutDependencies.pipe(Layer.provide(LobbyTest)),
  LobbyTest
);

/**
 * Mock Utilities
 */

/**
 * Creates a mock SocketServer with emission capture
 * @returns Object containing the layer and emissions array
 */
export const makeSocketCapture = () => {
  const emissions: Array<{
    to: string;
    event: string;
    data: unknown;
  }> = [];

  const mockSocketServer = {
    to: (sid: string) => ({
      emit: (event: string, data?: unknown) => {
        emissions.push({ to: sid, event, data });
      },
    }),
    emit: (event: string, data?: unknown) => {
      emissions.push({ to: 'broadcast', event, data });
    },
    on: () => {
      // No-op for testing
    },
  } as unknown as SocketIOInstance;

  const layer = Layer.succeed(SocketServer, mockSocketServer as never);

  return { layer, emissions };
};

/**
 * Creates a mock AudioManager with call recording
 * @returns Object containing the layer and calls array
 */
export const makeAudioCapture = () => {
  const calls: string[] = [];

  const mockAudioManager = new AudioManager({
    playIntro: () =>
      Effect.sync(() => {
        calls.push('intro');
      }),
    playSegmentStart: (segment: SegmentType) =>
      Effect.sync(() => {
        calls.push(`start:${segment}`);
      }),
    playSegmentEnd: (segment: SegmentType) =>
      Effect.sync(() => {
        calls.push(`end:${segment}`);
      }),
    playWinnerAudio: (winner: 'werewolves' | 'villagers') =>
      Effect.sync(() => {
        calls.push(`winner:${winner}`);
      }),
    playHunterDeath: () =>
      Effect.sync(() => {
        calls.push('hunter-death');
      }),
    playLoverDeath: () =>
      Effect.sync(() => {
        calls.push('lover-death');
      }),
    playHunterWithLoverDeath: () =>
      Effect.sync(() => {
        calls.push('hunter-with-lover-death');
      }),
    playDeathAnnouncement: (hasDeaths: boolean) =>
      Effect.sync(() => {
        calls.push(`death-announcement:${hasDeaths}`);
      }),
    playDayVoteHunterHasPartner: () =>
      Effect.sync(() => {
        calls.push('day-vote-hunter-has-partner');
      }),
    playDayVoteAudio: () =>
      Effect.sync(() => {
        calls.push('day-vote-audio');
      }),
    playDayVoteLoversDeath: () =>
      Effect.sync(() => {
        calls.push('day-vote-lovers-death');
      }),
    playSecondLoverIsHunterAudio: () =>
      Effect.sync(() => {
        calls.push('second-lover-is-hunter-audio');
      }),
    playPostHunterAudio: () =>
      Effect.sync(() => {
        calls.push('post-hunter-audio');
      }),
    nightHasEndedAudio: () =>
      Effect.sync(() => {
        calls.push('night-has-ended-audio');
      }),
    playHunterIsLoverAudio: () =>
      Effect.sync(() => {
        calls.push('hunter-is-lover-audio');
      }),
  });

  const layer = Layer.succeed(AudioManager, mockAudioManager);

  return { layer, calls };
};
