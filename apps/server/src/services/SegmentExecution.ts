import type { SegmentType } from '@repo/types';
import { Effect, Either } from 'effect';
import { AudioManager } from './AudioManager.js';
import { DeathManager } from './DeathManager.js';
import { HunterNotFoundError, SegmentExecutionError } from './errors.js';
import { Game } from './Game.js';
import { GameActions } from './GameActions.js';
import { SegmentManager } from './SegmentManager.js';
import { SpecialScenarios } from './special-scenarios.js';

export class SegmentExecution extends Effect.Service<SegmentExecution>()(
  '@app/SegmentExecution',
  {
    effect: Effect.gen(function* () {
      const segmentManager = yield* SegmentManager;
      const gameActions = yield* GameActions;
      const audioManager = yield* AudioManager;
      const game = yield* Game;
      const specialScenarios = yield* SpecialScenarios;
      const deathManager = yield* DeathManager;

      const getSegmentAction = (segmentType: SegmentType) =>
        Effect.gen(function* () {
          switch (segmentType) {
            case 'CUPID':
              yield* gameActions.cupidAction;
              break;
            case 'LOVERS':
              yield* gameActions.loversAction;
              break;
            case 'WEREWOLF':
              yield* gameActions.werewolfAction;
              break;
            case 'WITCH-HEAL':
              yield* gameActions.witchHealAction;
              break;
            case 'WITCH-POISON':
              yield* gameActions.witchPoisonAction;
              break;
            case 'DAY':
              yield* gameActions.dayAction;
              break;
            case 'HUNTER':
              yield* gameActions.hunterAction;
              break;
          }
        });

      const playSegment = Effect.gen(function* () {
        const currentSegment = yield* segmentManager.getCurrentSegment;
        const segmentType = currentSegment.type;

        yield* audioManager.playSegmentStart(segmentType);
        yield* getSegmentAction(segmentType);
      });

      const finishSegment = Effect.gen(function* () {
        const currentSegment = yield* segmentManager.getCurrentSegment;
        const segmentType = currentSegment.type;

        yield* audioManager.playSegmentEnd(segmentType);

        const isFirstNight =
          yield* segmentManager.isFirstNightSegment(segmentType);
        if (isFirstNight) {
          yield* segmentManager.markFirstNightSegmentsAsSkipped;
        }

        yield* segmentManager.nextSegment;
      });

      const runHunterSegment = Effect.gen(function* () {
        const hunterResult = yield* Effect.either(
          game.getSpecialRolePlayer('HUNTER')
        );

        if (Either.isLeft(hunterResult)) {
          return yield* Effect.fail(new HunterNotFoundError());
        }

        const hunter = hunterResult.right;

        const isLover = yield* game.isPlayerLover(hunter.socketId);

        if (isLover) {
          const partner = yield* game.getPartner(hunter.socketId);
          if (!partner) {
            return yield* Effect.fail(
              new SegmentExecutionError({
                segment: 'HUNTER',
                message: 'lover could not be found',
              })
            );
          }
          yield* deathManager.addPartnerSuicide(
            hunter.socketId,
            partner.socketId
          );
          yield* specialScenarios.hunterIsLover;
        } else {
          yield* audioManager.playHunterAudio;
        }

        yield* Effect.sleep('18 seconds');
        yield* gameActions.hunterAction;
      });

      const runLoverSegment = Effect.gen(function* () {
        yield* audioManager.playLoverAudio;

        const winner = yield* game.checkIfWinner;

        if (!winner) {
          const currentSegment = yield* segmentManager.getCurrentSegment;
          if (currentSegment.type === 'DAY') {
            yield* gameActions.dayAction;
          }
        }
      });

      const continueDayAction = Effect.gen(function* () {
        const winner = yield* game.checkIfWinner;

        if (winner) {
          return yield* Effect.void;
        }

        const hunterDiedFirst = yield* specialScenarios.getHunterDiedFirst;

        if (hunterDiedFirst) {
          yield* audioManager.playPostHunterAudio;
          yield* specialScenarios.resetHunterDiedFirst;
        } else {
          yield* audioManager.nightHasEndedAudio;
        }

        yield* gameActions.dayAction;
      });

      const startGame = Effect.gen(function* () {
        yield* playSegment;
      });

      const isGameOver = Effect.gen(function* () {
        const winner = yield* game.checkIfWinner;

        if (winner) {
          yield* audioManager.playWinnerAudio(winner);
          return yield* Effect.succeed(true);
        }

        return yield* Effect.succeed(false);
      });

      const checkPostDayVoteScenarios = Effect.gen(function* () {
        const hunterInQueue = yield* game.hunterIsInDeathQueue;

        if (hunterInQueue) {
          yield* runHunterSegment;
          return yield* Effect.succeed(true);
        }

        const loverInQueue = yield* game.isOneOfLoversInDeathQueue;

        if (loverInQueue) {
          const isPartnerHunter = yield* game.isPartnerHunter;

          if (isPartnerHunter) {
            yield* specialScenarios.partnerIsHunter;
            yield* runHunterSegment;
            return yield* Effect.succeed(true);
          }

          yield* runLoverSegment;
          return yield* Effect.succeed(true);
        }

        return yield* Effect.succeed(false);
      });

      return {
        playSegment,
        finishSegment,
        runHunterSegment,
        runLoverSegment,
        checkPostDayVoteScenarios,
        continueDayAction,
        startGame,
        isGameOver,
      };
    }),
    dependencies: [
      SegmentManager.Default,
      GameActions.Default,
      AudioManager.Default,
      Game.Default,
      SpecialScenarios.Default,
      DeathManager.Default,
    ],
  }
) {}
