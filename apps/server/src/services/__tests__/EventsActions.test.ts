import { Effect, Layer } from 'effect';
import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from '../AudioManager.js';
import { DayVoting } from '../DayVoting.js';
import { DeathManager } from '../DeathManager.js';
import { EventsActions } from '../EventsActions.js';
import { Game } from '../Game.js';
import { HunterService } from '../HunterService.js';
import { SeerService } from '../SeerService.js';
import { SocketServer } from '../SocketServer.js';
import { WerewolfVoting } from '../WerewolfVoting.js';
import { WitchService } from '../WitchService.js';

describe('EventsActions', () => {
  it('should handle werewolf vote', async () => {
    const handleVoteMock = vi.fn();
    const werewolfVotingMock = {
      handleVote: handleVoteMock.mockReturnValue(Effect.void),
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, werewolfVotingMock as any),
      Layer.succeed(Game, {} as any),
      Layer.succeed(SocketServer, {} as any),
      Layer.succeed(DayVoting, {} as any),
      Layer.succeed(DeathManager, {} as any),
      Layer.succeed(AudioManager, {} as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.handleWerewolfVote('werewolf-sid', 'victim-sid');
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(handleVoteMock).toHaveBeenCalledWith('werewolf-sid', 'victim-sid');
  });

  it('should handle day vote', async () => {
    const handleVoteMock = vi.fn();
    const dayVotingMock = {
      handleVote: handleVoteMock.mockReturnValue(Effect.void),
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, {} as any),
      Layer.succeed(SocketServer, {} as any),
      Layer.succeed(DayVoting, dayVotingMock as any),
      Layer.succeed(DeathManager, {} as any),
      Layer.succeed(AudioManager, {} as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.handleDayVote('voter-sid', 'target-sid');
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(handleVoteMock).toHaveBeenCalledWith('voter-sid', 'target-sid');
  });

  it('should handle finalize day vote (normal victim)', async () => {
    const finalizeVoteMock = vi
      .fn()
      .mockReturnValue(Effect.succeed('victim-sid'));
    const getPlayerMock = vi.fn().mockReturnValue(
      Effect.succeed({
        getName: () => 'Victim',
        getRole: () => 'VILLAGER',
        getSocketId: () => 'victim-sid',
      })
    );
    const addDeathMock = vi.fn().mockReturnValue(Effect.void);
    const getPartnerMock = vi.fn().mockReturnValue(Effect.succeed(undefined)); // No partner

    const dayVotingMock = { finalizeVote: finalizeVoteMock() };
    const gameMock = {
      getPlayerBySocketId: getPlayerMock,
      getPartner: getPartnerMock,
    };
    const deathManagerMock = {
      addDayVoteElimination: addDeathMock,
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, gameMock as any),
      Layer.succeed(SocketServer, {} as any),
      Layer.succeed(DayVoting, dayVotingMock as any),
      Layer.succeed(DeathManager, deathManagerMock as any),
      Layer.succeed(AudioManager, {
        playDayVoteLoversDeath: Effect.void,
      } as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.finalizeDayVote;
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(deathManagerMock.addDayVoteElimination).toHaveBeenCalledWith(
      'victim-sid',
      0
    );
  });

  it('should handle finalize day vote (hunter victim)', async () => {
    const finalizeVoteMock = vi
      .fn()
      .mockReturnValue(Effect.succeed('hunter-sid'));
    const getPlayerMock = vi.fn().mockReturnValue(
      Effect.succeed({
        getName: () => 'Hunter',
        getRole: () => 'HUNTER',
        getSocketId: () => 'hunter-sid',
      })
    );
    const addDeathMock = vi.fn().mockReturnValue(Effect.void);
    const getPartnerMock = vi.fn().mockReturnValue(Effect.succeed(undefined));
    const emitMock = vi.fn().mockReturnValue(Effect.void);

    const dayVotingMock = { finalizeVote: finalizeVoteMock() };
    const gameMock = {
      getPlayerBySocketId: getPlayerMock,
      getPartner: getPartnerMock,
    };
    const deathManagerMock = {
      addDayVoteElimination: addDeathMock,
    };
    const socketServerMock = {
      emit: emitMock,
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, gameMock as any),
      Layer.succeed(SocketServer, socketServerMock as any),
      Layer.succeed(DayVoting, dayVotingMock as any),
      Layer.succeed(DeathManager, deathManagerMock as any),
      Layer.succeed(AudioManager, {
        playDayVoteHunterHasPartner: Effect.void,
      } as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.finalizeDayVote;
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(socketServerMock.emit).toHaveBeenCalledWith('hunter:pick-required');
  });

  it('should handle finalize day vote (lover victim)', async () => {
    const finalizeVoteMock = vi
      .fn()
      .mockReturnValue(Effect.succeed('lover-sid'));
    const getPlayerMock = vi.fn().mockReturnValue(
      Effect.succeed({
        getName: () => 'Lover',
        getRole: () => 'VILLAGER',
        getSocketId: () => 'lover-sid',
      })
    );
    const addDeathMock = vi.fn().mockReturnValue(Effect.void);
    const getPartnerMock = vi.fn().mockReturnValue(Effect.succeed({})); // Has partner
    const playAudioMock = vi.fn().mockReturnValue(Effect.void);

    const dayVotingMock = { finalizeVote: finalizeVoteMock() };
    const gameMock = {
      getPlayerBySocketId: getPlayerMock,
      getPartner: getPartnerMock,
    };
    const deathManagerMock = {
      addDayVoteElimination: addDeathMock,
    };
    const audioManagerMock = {
      playDayVoteLoversDeath: Effect.sync(() => playAudioMock()),
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, gameMock as any),
      Layer.succeed(SocketServer, {} as any),
      Layer.succeed(DayVoting, dayVotingMock as any),
      Layer.succeed(DeathManager, deathManagerMock as any),
      Layer.succeed(AudioManager, audioManagerMock as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.finalizeDayVote;
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(playAudioMock).toHaveBeenCalled();
  });

  it('should handle seer check', async () => {
    const checkPlayerMock = vi.fn().mockReturnValue(Effect.succeed('WEREWOLF'));
    const emitToMock = vi.fn().mockReturnValue(Effect.void);

    const seerServiceMock = {
      checkPlayer: checkPlayerMock,
    };
    const socketServerMock = {
      emitTo: emitToMock,
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, {} as any),
      Layer.succeed(SocketServer, socketServerMock as any),
      Layer.succeed(DayVoting, {} as any),
      Layer.succeed(DeathManager, {} as any),
      Layer.succeed(AudioManager, {} as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, seerServiceMock as any),
      Layer.succeed(WitchService, {} as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.handleSeerCheck('seer-sid', 'target-sid');
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(checkPlayerMock).toHaveBeenCalledWith('target-sid');
    expect(socketServerMock.emitTo).toHaveBeenCalledWith(
      'seer-sid',
      'player:role-assigned',
      'WEREWOLF'
    );
  });

  it('should handle witch action (heal)', async () => {
    const healPlayerMock = vi.fn().mockReturnValue(Effect.void);
    const emitToMock = vi.fn().mockReturnValue(Effect.void);

    const witchServiceMock = {
      healPlayer: healPlayerMock(),
    };
    const socketServerMock = {
      emitTo: emitToMock,
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, {} as any),
      Layer.succeed(SocketServer, socketServerMock as any),
      Layer.succeed(DayVoting, {} as any),
      Layer.succeed(DeathManager, {} as any),
      Layer.succeed(AudioManager, {} as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, witchServiceMock as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.handleWitchAction('witch-sid', 'heal');
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(socketServerMock.emitTo).toHaveBeenCalledWith(
      'witch-sid',
      'witch:healed-player'
    );
  });

  it('should handle witch action (poison)', async () => {
    const poisonPlayerMock = vi.fn().mockReturnValue(Effect.void);
    const emitToMock = vi.fn().mockReturnValue(Effect.void);

    const witchServiceMock = {
      poisonPlayer: poisonPlayerMock,
    };
    const socketServerMock = {
      emitTo: emitToMock,
    };

    const mocksLayer = Layer.mergeAll(
      Layer.succeed(WerewolfVoting, {} as any),
      Layer.succeed(Game, {} as any),
      Layer.succeed(SocketServer, socketServerMock as any),
      Layer.succeed(DayVoting, {} as any),
      Layer.succeed(DeathManager, {} as any),
      Layer.succeed(AudioManager, {} as any),
      Layer.succeed(HunterService, {} as any),
      Layer.succeed(SeerService, {} as any),
      Layer.succeed(WitchService, witchServiceMock as any)
    );

    const layer = EventsActions.Test.pipe(Layer.provide(mocksLayer));

    const program = Effect.gen(function* () {
      const eventsActions = yield* EventsActions;
      yield* eventsActions.handleWitchAction(
        'witch-sid',
        'poison',
        'target-sid'
      );
    });

    await Effect.runPromise(Effect.provide(program, layer));

    expect(poisonPlayerMock).toHaveBeenCalledWith('target-sid');
    expect(socketServerMock.emitTo).toHaveBeenCalledWith(
      'witch-sid',
      'witch:poisoned-player',
      'target-sid'
    );
  });
});
