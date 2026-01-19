import { Context, Effect, Layer, Ref } from 'effect';
import { GameService } from '@/core/game-effect';
import { ActionError } from '@/Domain/action-error';
import { AudioManagerTag } from '@/segments/audio-manager-effect';
import { SegmentsManagerService } from '@/segments/segments-manager-effect';
import { SocketService } from '@/server/socket-effect';

export class EventsActionsService extends Context.Tag('EventsActionsService')<
  EventsActionsService,
  {
    readonly handleHunterPlayerPick: (
      targetSid: string
    ) => Effect.Effect<void, ActionError>;
    readonly handleWerewolfVote: (
      werewolfSid: string,
      targetSid: string
    ) => Effect.Effect<void, ActionError>;
    readonly handleDayVote: (
      voterSid: string,
      targetPlayer: string
    ) => Effect.Effect<void, ActionError>;
  }
>() {}

export const EventsActionsLive = Layer.effect(
  EventsActionsService,
  Effect.gen(function* (_) {
    const game = yield* _(GameService);
    const segmentsManager = yield* _(SegmentsManagerService);
    const socket = yield* _(SocketService);
    const audioManager = yield* _(AudioManagerTag);

    // Internal state
    const hunterKilledDuringDayVoteRef = yield* _(Ref.make(false));

    const toActionError = (e: unknown) =>
      new ActionError({ message: 'EventsActions error', cause: e });

    const handleDayVoteHunterPlayerPick = (targetSid: string) =>
      Effect.gen(function* ($) {
        yield* $(game.killHunterRevenge(targetSid));
        yield* $(game.isHunterInLove);
        // Repeated kill in original? "this.game.killHunterRevenge(targetSid);" called twice in original
        // Assuming it's safe to call again or was a copy-paste quirk, but following logic:
        yield* $(game.killHunterRevenge(targetSid));
        yield* $(audioManager.playDayVoteAudio());
      });

    const handleHunterPlayerPick = (targetSid: string) =>
      Effect.gen(function* ($) {
        yield* $(Effect.log(`handleHunterPlayerPick called with ${targetSid}`));
        const hunterKilledDuringDayVote = yield* $(
          Ref.get(hunterKilledDuringDayVoteRef)
        );

        if (hunterKilledDuringDayVote) {
          yield* $(handleDayVoteHunterPlayerPick(targetSid));
          return;
        }

        yield* $(game.addPendingDeath(targetSid, 'HUNTER_REVENGE'));
        yield* $(game.isHunterInLove);
        yield* $(game.killHunterRevenge(targetSid));
        yield* $(segmentsManager.continueDayAction);
      }).pipe(Effect.mapError(toActionError));

    const handleWerewolfVote = (werewolfSid: string, targetSid: string) =>
      Effect.gen(function* ($) {
        yield* $(game.handleWerewolfVote(werewolfSid, targetSid));

        const hasAgreed = yield* $(game.hasAllWerewolvesAgreed);

        if (hasAgreed) {
          yield* $(game.handleAllWerewolvesAgree);
          yield* $(segmentsManager.finishSegment);
        }
      }).pipe(Effect.mapError(toActionError));

    const processPartnerLogic = (player: {
      getRole: () => string;
      getSocketId: () => string;
    }) =>
      Effect.gen(function* ($) {
        if (player.getRole() === 'HUNTER') {
          yield* $(audioManager.playDayVoteHunterHasPartner());
          yield* $(Ref.set(hunterKilledDuringDayVoteRef, true));
          yield* $(socket.emit('hunter:pick-required'));
        }
        yield* $(audioManager.playDayVoteLoversDeath());
      });

    const processDayVoteResult = (
      player:
        | { getRole: () => string; getSocketId: () => string }
        | undefined
        | null
    ) =>
      Effect.gen(function* ($) {
        if (!player) {
          return;
        }

        const hasPartner = yield* $(game.hasPartner(player.getSocketId()));

        if (hasPartner) {
          yield* $(processPartnerLogic(player));
        }

        if (player.getRole() === 'WITCH') {
          yield* $(segmentsManager.witchDied);
        }

        const isGameOver = yield* $(segmentsManager.isGameOver);
        if (!isGameOver) {
          yield* $(segmentsManager.finishSegment);
        }
      });

    const handleDayVote = (voterSid: string, targetPlayer: string) =>
      Effect.gen(function* ($) {
        yield* $(game.handleDayVote(voterSid, targetPlayer));
        const allVoted = yield* $(game.hasAllPlayersVoted);

        if (allVoted) {
          const player = yield* $(game.getDayVoteTarget);
          yield* $(processDayVoteResult(player));
        }
      }).pipe(Effect.mapError(toActionError));

    return {
      handleHunterPlayerPick,
      handleWerewolfVote,
      handleDayVote,
    };
  })
);
