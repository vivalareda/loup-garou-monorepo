import { Effect } from 'effect';
import { DeathManager } from './death-manager.js';
import { Game } from './game.js';
import { GameActions } from './game-actions.js';
import { SegmentExecution } from './segment-execution.js';
import { WerewolfVictimNotFoundError } from './errors.js';

export class EventsActions extends Effect.Service<EventsActions>()(
  '@app/EventsActions',
  {
    effect: Effect.gen(function* () {
      const game = yield* Game;
      const gameActions = yield* GameActions;
      const segmentExecution = yield* SegmentExecution;
      const deathManager = yield* DeathManager;

      return {
        handleWerewolfVote: (werewolfSid: string, targetSid: string) =>
          Effect.gen(function* () {
            yield* gameActions.handleWerewolfVote(werewolfSid, targetSid);
            const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
            if (hasAllAgreed) {
              const targetSid = yield* game.getWerewolfTarget;
              if (!targetSid) {
                return yield* Effect.fail(
                  new WerewolfVictimNotFoundError({
                    reason: 'werewolves may not have reached agreement',
                  })
                );
              }
              const targetPlayer = yield* game.getPlayerBySocketId(targetSid);
              yield* deathManager.addPendingDeath(targetPlayer, 'WEREWOLVES');
              yield* segmentExecution.finishSegment;
            }
          }),

        handleWerewolfUpdateVote: (
          werewolfSid: string,
          targetSid: string,
          oldVote: string
        ) =>
          Effect.gen(function* () {
            yield* gameActions.handleWerewolfUpdateVote(
              werewolfSid,
              targetSid,
              oldVote
            );
            const hasAllAgreed = yield* game.hasAllWerewolvesAgreed;
            if (hasAllAgreed) {
              const targetSid = yield* game.getWerewolfTarget;
              if (!targetSid) {
                return yield* Effect.fail(
                  new WerewolfVictimNotFoundError({
                    reason: 'werewolves may not have reached agreement',
                  })
                );
              }
              const targetPlayer = yield* game.getPlayerBySocketId(targetSid);
              yield* deathManager.addPendingDeath(targetPlayer, 'WEREWOLVES');
              yield* segmentExecution.finishSegment;
            }
          }),

        handleDayVote: (voterSid: string, targetSid: string) =>
          Effect.gen(function* () {
            yield* gameActions.handleDayVote(voterSid, targetSid);
            const hasAllVoted = yield* game.hasAllPlayersVoted;
            if (hasAllVoted) {
              yield* gameActions.processDayVoteResult;
              const hunterInQueue = yield* game.hunterIsInDeathQueue;
              if (hunterInQueue) {
                yield* segmentExecution.runHunterSegment;
              } else {
                const loverInQueue = yield* game.isOneOfLoversInDeathQueue;
                if (loverInQueue) {
                  const isPartnerHunter = yield* game.isPartnerHunter;
                  if (isPartnerHunter) {
                    yield* segmentExecution.runHunterSegment;
                  } else {
                    yield* segmentExecution.runLoverSegment;
                  }
                }
              }
              yield* segmentExecution.finishSegment;
            }
          }),

        handleHunterPlayerPick: (targetSid: string) =>
          Effect.gen(function* () {
            yield* gameActions.handleHunterPlayerPick(targetSid);
            yield* segmentExecution.continueDayAction;
          }),

        handleCupidLoversPick: (selectedPlayers: string[]) =>
          Effect.gen(function* () {
            yield* game.setLovers(selectedPlayers);
            yield* segmentExecution.finishSegment;
          }),

        handleLoverClosedAlert: Effect.gen(function* () {
          yield* segmentExecution.finishSegment;
        }),

        handleWitchHeal: Effect.gen(function* () {
          yield* gameActions.healWerewolfVictim;
          yield* segmentExecution.finishSegment;
        }),

        handleWitchPoison: (playerSid: string) =>
          Effect.gen(function* () {
            yield* gameActions.witchKill(playerSid);
            yield* segmentExecution.finishSegment;
          }),

        handleWitchSkipHeal: Effect.gen(function* () {
          console.log('Witch skipped heal action');
          yield* segmentExecution.finishSegment;
        }),

        handleWitchSkipPoison: Effect.gen(function* () {
          console.log('Witch skipped poison action');
          yield* segmentExecution.finishSegment;
        }),
      };
    }),
    dependencies: [
      Game.Default,
      GameActions.Default,
      SegmentExecution.Default,
      DeathManager.Default,
    ],
  }
) {}
