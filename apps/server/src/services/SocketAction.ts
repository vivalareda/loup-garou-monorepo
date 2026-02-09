import type { SegmentType } from '@repo/types';
import { Context, Effect, Layer } from 'effect';
import { DayVote } from './DayVote.js';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { GameFlow } from './GameFlow.js';
import { Lobby } from './Lobby.js';
import { WerewolvesVote } from './WerewolvesVote.js';

const makeSocketAction = Effect.gen(function* () {
  const lobby = yield* Lobby;
  const game = yield* Game;
  const gameFlow = yield* GameFlow;
  const werewolvesVotes = yield* WerewolvesVote;
  const dayVote = yield* DayVote;

  const handlePlayerJoin = Effect.fn('handlePlayerJoin')(function* (
    playerName: string,
    socketId: string
  ) {
    const player = yield* lobby.addPlayer(playerName, socketId);
    return player;
  });

  const handleGetPlayersList = Effect.fn('handleGetPlayersList')(function* () {
    const players = yield* game.getClientPlayerList;
    return players;
  });

  const handleWerewolfVote = Effect.fn('handleWerewolfVote')(function* (
    socketId: string,
    victim: string
  ) {
    const target = yield* werewolvesVotes.registerWerewolfVote(
      socketId,
      victim
    );

    if (target && typeof target === 'string') {
      yield* gameFlow.completeWerewolfVote(target);
      yield* werewolvesVotes.clear;
      return { shouldFinish: true, target };
    }

    return { shouldFinish: false };
  });

  const handleWerewolfUpdateVote = Effect.fn('handleWerewolfUpdateVote')(
    function* (socketId: string, victim: string) {
      yield* werewolvesVotes.updateWerewolfVote(socketId, victim);
    }
  );

  const handleDayVote = Effect.fn('handleDayVote')(function* (
    socketId: string,
    victim: string
  ) {
    const outcome = yield* dayVote.registerVote(socketId, victim);
    if (outcome === false) {
      return { shouldFinish: false };
    }

    if (outcome.result === 'InProgress') {
      return { shouldFinish: false };
    }

    if (outcome.result === 'MajorityVote') {
      yield* gameFlow.completeDayVote(outcome.victim);
      yield* dayVote.clear;
      return { shouldFinish: true, target: outcome.victim };
    }

    const resolved = yield* gameFlow.runDayVoteTie(outcome.tiedPlayers);
    yield* dayVote.clear;
    return { shouldFinish: true, target: resolved };
  });

  const handleDayVoteUpdate = Effect.fn('handleDayVoteUpdate')(function* (
    socketId: string,
    victim: string
  ) {
    const outcome = yield* dayVote.updateVote(socketId, victim);

    if (outcome.result === 'InProgress') {
      return { shouldFinish: false };
    }

    if (outcome.result === 'MajorityVote') {
      yield* gameFlow.completeDayVote(outcome.victim);
      yield* dayVote.clear;
      return { shouldFinish: true, target: outcome.victim };
    }

    const resolved = yield* gameFlow.runDayVoteTie(outcome.tiedPlayers);
    yield* dayVote.clear;
    return { shouldFinish: true, target: resolved };
  });

  const handleSheriffPick = Effect.fn('handleSheriffPick')(function* (
    socketId: string,
    target: string
  ) {
    const sheriffSid = yield* game.getSheriffPlayer;
    if (!sheriffSid || sheriffSid !== socketId) {
      yield* Effect.log('Ignoring sheriff pick from non-sheriff player', {
        socketId,
      });
      return;
    }

    yield* gameFlow.completeDayVoteTie(target);
  });

  const handleHunterKill = Effect.fn('handleHunterKill')(function* (
    target: string
  ) {
    yield* gameFlow.completeHunterKill(target);
  });

  const handleLoverClosedAlert = Effect.fn('handleLoverClosedAlert')(function* (
    alertCount: number
  ) {
    const newCount = alertCount + 1;
    if (newCount === 2) {
      yield* gameFlow.completeLoversDefer();
    }
    return newCount;
  });

  const handleStartGame = Effect.fn('handleStartGame')(function* () {
    yield* Effect.log('starting game');
    yield* gameFlow.startGame;
  });

  const handleStartMock = Effect.fn('handleStartMock')(function* (
    segment: SegmentType
  ) {
    yield* Effect.log(`starting mock segment ${segment}`);
    yield* gameFlow.loadMockScenario(segment);
  });

  const getAlertWerewolvesAboutVotes = Effect.fn(
    'getAlertWerewolvesAboutVotes'
  )(function* () {
    const voteData = yield* werewolvesVotes.getVotes;
    const werewolves = yield* game.getWerewolves;

    return { voteData, werewolves };
  });

  const getAlertVillageAboutVotes = Effect.fn('getAlertVillageAboutVotes')(
    function* () {
      const voteData = yield* dayVote.getVotes;

      return { voteData };
    }
  );

  return {
    handlePlayerJoin,
    handleGetPlayersList,
    handleWerewolfVote,
    handleWerewolfUpdateVote,
    handleDayVote,
    handleDayVoteUpdate,
    handleSheriffPick,
    handleHunterKill,
    handleLoverClosedAlert,
    handleStartGame,
    handleStartMock,
    getAlertWerewolvesAboutVotes,
    getAlertVillageAboutVotes,
  };
});

type SocketActionService = typeof makeSocketAction extends Effect.Effect<
  infer A,
  unknown,
  unknown
>
  ? A
  : never;

export class SocketAction extends Context.Tag('SocketAction')<
  SocketAction,
  SocketActionService
>() {
  static readonly DefaultWithoutDependencies = Layer.effect(
    this,
    makeSocketAction
  );
  static readonly Default = this.DefaultWithoutDependencies.pipe(
    Layer.provide(Lobby.Default),
    Layer.provide(Game.Default),
    Layer.provide(GameFlow.Default),
    Layer.provide(WerewolvesVote.Default),
    Layer.provide(DayVote.Default),
    Layer.provide(DeathManager.Default)
  );
}
