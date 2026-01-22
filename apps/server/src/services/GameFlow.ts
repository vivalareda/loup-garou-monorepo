import type { SegmentType } from '@repo/types';
import { Effect, Ref } from 'effect';
import { AudioManager } from './AudioManager.js';
import { Game } from './Game.js';
import { Lobby } from './Lobby.js';
import { SocketServer } from './SocketServer.js';

export type SegmentState = {
  type: SegmentType;
  skip: boolean;
};

export type SpecialScenario =
  | 'hunter-revenge'
  | 'lover-suicide'
  | 'hunter-lover'
  | null;

export class GameFlow extends Effect.Service<GameFlow>()('GameFlow', {
  effect: Effect.gen(function* () {
    const game = yield* Game;
    const lobby = yield* Lobby;
    const io = yield* SocketServer;
    const audio = yield* AudioManager;

    // Initialize segments with proper skip states based on segments-manager.ts logic
    const initialSegments: SegmentState[] = [
      { type: 'CUPID', skip: false },
      { type: 'LOVERS', skip: false },
      { type: 'WEREWOLF', skip: false },
      { type: 'WITCH-HEAL', skip: true }, // Starts as skip=true in original
      { type: 'WITCH-POISON', skip: true }, // Starts as skip=true in original
      { type: 'DAY', skip: false },
      { type: 'HUNTER', skip: true }, // Starts as skip=true in original
    ];

    const segmentsRef = yield* Ref.make(initialSegments);
    const firstNightCompletedRef = yield* Ref.make(false);

    const getSegments = Ref.get(segmentsRef);

    const getSegmentByType = (type: SegmentType) =>
      Effect.gen(function* () {
        const segments = yield* getSegments;
        return segments.find((s) => s.type === type);
      });

    const updateSegmentSkip = (type: SegmentType, skip: boolean) =>
      Effect.gen(function* () {
        const segments = yield* getSegments;
        const updated = segments.map((s) =>
          s.type === type ? { ...s, skip } : s
        );
        yield* Ref.set(segmentsRef, updated);
      });

    const skipSegment = (type: SegmentType) =>
      Effect.gen(function* () {
        yield* updateSegmentSkip(type, true);
      });

    const unskipSegment = (type: SegmentType) =>
      Effect.gen(function* () {
        yield* updateSegmentSkip(type, false);
      });

    const shouldSkipCupid = Effect.gen(function* () {
      const firstNightCompleted = yield* Ref.get(firstNightCompletedRef);
      return firstNightCompleted;
    });

    const shouldSkipLovers = Effect.gen(function* () {
      const firstNightCompleted = yield* Ref.get(firstNightCompletedRef);
      return firstNightCompleted;
    });

    const shouldSkipWitchHeal = Effect.gen(function* () {
      const canHeal = yield* game.canWitchHeal;
      return !canHeal;
    });

    const shouldSkipWitchPoison = Effect.gen(function* () {
      const canPoison = yield* game.canWitchPoison;
      return !canPoison;
    });

    const shouldSkipHunter = Effect.gen(function* () {
      const hunterInDeathQueue = yield* game.hunterIsInDeathQueue;
      return !hunterInDeathQueue;
    });

    const applySkipLogic = Effect.gen(function* () {
      // Cupid and Lovers skip after first night
      const skipCupid = yield* shouldSkipCupid;
      const skipLovers = yield* shouldSkipLovers;
      if (skipCupid) {
        yield* updateSegmentSkip('CUPID', true);
      }
      if (skipLovers) {
        yield* updateSegmentSkip('LOVERS', true);
      }

      // Witch segments skip when no potions
      const skipWitchHeal = yield* shouldSkipWitchHeal;
      const skipWitchPoison = yield* shouldSkipWitchPoison;
      yield* updateSegmentSkip('WITCH-HEAL', skipWitchHeal);
      yield* updateSegmentSkip('WITCH-POISON', skipWitchPoison);

      // Hunter skips unless in death queue
      const skipHunter = yield* shouldSkipHunter;
      yield* updateSegmentSkip('HUNTER', skipHunter);
    });

    const markFirstNightComplete = Effect.gen(function* () {
      yield* Ref.set(firstNightCompletedRef, true);
    });

    const checkPostNightScenarios = Effect.gen(
      function* (): Effect.Effect<SpecialScenario> {
        const hunterInDeathQueue = yield* game.hunterIsInDeathQueue;

        if (hunterInDeathQueue) {
          const hunter = yield* game.getSpecialRolePlayer('HUNTER');
          const isLover = yield* game.isPlayerLover(hunter.getSocketId());

          if (isLover) {
            const partner = yield* game.getPartner(hunter.getSocketId());
            if (partner && partner.getRole() === 'HUNTER') {
              // Both lovers are hunters - complex scenario
              return 'hunter-lover';
            }
            // Hunter died and is a lover (partner will commit suicide)
            return 'hunter-lover';
          }
          // Hunter died but is not a lover
          return 'hunter-revenge';
        }

        // Check if a lover died (not hunter)
        const deaths = yield* game.processPendingDeaths;
        const lovers = yield* game.getLovers();

        if (lovers && deaths.length > 0) {
          const isOneLoverInDeathQueue = deaths.some(
            (d) =>
              d.playerId === lovers[0].getSocketId() ||
              d.playerId === lovers[1].getSocketId()
          );

          if (isOneLoverInDeathQueue) {
            const deadLover = deaths.find(
              (d) =>
                d.playerId === lovers[0].getSocketId() ||
                d.playerId === lovers[1].getSocketId()
            );
            const partner =
              deadLover?.playerId === lovers[0].getSocketId()
                ? lovers[1]
                : lovers[0];

            const isPartnerHunter = partner.getRole() === 'HUNTER';

            if (isPartnerHunter) {
              // Lover died, partner is hunter
              return 'hunter-lover';
            }

            // Lover died, partner will commit suicide
            return 'lover-suicide';
          }
        }

        return null;
      }
    );

    const checkPostDayVoteScenarios = Effect.gen(
      function* (): Effect.Effect<SpecialScenario> {
        const target = yield* game.getDayVoteTarget;
        const deaths = yield* game.processPendingDeaths;

        const hunterInDeathQueue = deaths.some(
          (d) =>
            d.playerId === target.getSocketId() && target.getRole() === 'HUNTER'
        );

        if (hunterInDeathQueue) {
          const isLover = yield* game.isPlayerLover(target.getSocketId());
          if (isLover) {
            const partner = yield* game.getPartner(target.getSocketId());
            if (partner && partner.getRole() === 'HUNTER') {
              // Hunter voted out, partner is also hunter
              return 'hunter-lover';
            }
            // Hunter voted out and is a lover
            return 'hunter-lover';
          }
          // Hunter voted out but not a lover
          return 'hunter-revenge';
        }

        const lovers = yield* game.getLovers();
        if (lovers) {
          const isTargetLover =
            target.getSocketId() === lovers[0].getSocketId() ||
            target.getSocketId() === lovers[1].getSocketId();

          if (isTargetLover) {
            const partner =
              target.getSocketId() === lovers[0].getSocketId()
                ? lovers[1]
                : lovers[0];

            if (partner.getRole() === 'HUNTER') {
              // Lover voted out, partner is hunter
              return 'hunter-lover';
            }

            // Lover voted out, partner will suicide
            return 'lover-suicide';
          }
        }

        return null;
      }
    );

    return {
      /**
       * Retrieves all segments with their current skip states.
       * @returns Effect containing an array of SegmentState objects.
       */
      getSegments,

      /**
       * Retrieves a specific segment by type.
       * @param type - The type of segment to retrieve.
       * @returns Effect containing the SegmentState or undefined if not found.
       */
      getSegmentByType,

      /**
       * Marks a segment to be skipped.
       * @param type - The type of segment to skip.
       * @returns Effect that completes when the segment is marked as skipped.
       */
      skipSegment,

      /**
       * Marks a segment to not be skipped.
       * @param type - The type of segment to unskip.
       * @returns Effect that completes when the segment is marked as not skipped.
       */
      unskipSegment,

      /**
       * Applies skip logic to all segments based on current game state.
       * Skips Cupid/Lovers after first night, Witch segments when no potions, Hunter unless in death queue.
       * @returns Effect that completes when skip logic is applied.
       * @dependencies Depends on Game service for potion availability and death queue state.
       */
      applySkipLogic,

      /**
       * Marks the first night as completed, triggering Cupid/Lovers skip in subsequent nights.
       * @returns Effect that completes when the first night is marked as complete.
       */
      markFirstNightComplete,

      /**
       * Determines if the Cupid segment should be skipped.
       * @returns Effect containing true if Cupid should be skipped (after first night), false otherwise.
       */
      shouldSkipCupid,

      /**
       * Determines if the Lovers segment should be skipped.
       * @returns Effect containing true if Lovers should be skipped (after first night), false otherwise.
       */
      shouldSkipLovers,

      /**
       * Determines if the Witch Heal segment should be skipped.
       * @returns Effect containing true if Witch Heal should be skipped (no potion), false otherwise.
       * @dependencies Depends on Game service for potion availability.
       */
      shouldSkipWitchHeal,

      /**
       * Determines if the Witch Poison segment should be skipped.
       * @returns Effect containing true if Witch Poison should be skipped (no potion), false otherwise.
       * @dependencies Depends on Game service for potion availability.
       */
      shouldSkipWitchPoison,

      /**
       * Determines if the Hunter segment should be skipped.
       * @returns Effect containing true if Hunter should be skipped (not in death queue), false otherwise.
       * @dependencies Depends on Game service for death queue state.
       */
      shouldSkipHunter,

      /**
       * Checks for special scenarios that need handling after the night phase.
       * @returns Effect containing the special scenario ('hunter-revenge', 'lover-suicide', 'hunter-lover') or null.
       * @dependencies Depends on Game service for death queue and lovers state.
       */
      checkPostNightScenarios,

      /**
       * Checks for special scenarios that need handling after the day vote.
       * @returns Effect containing the special scenario ('hunter-revenge', 'lover-suicide', 'hunter-lover') or null.
       * @dependencies Depends on Game service for vote target and lovers state.
       */
      checkPostDayVoteScenarios,

      /**
       * Starts the game by initializing players, assigning roles, and notifying clients.
       * @returns Effect that completes when the game is started.
       * @dependencies Depends on Game, Lobby, SocketServer, and AudioManager services.
       */
      startGame: Effect.gen(function* () {
        yield* game.startGame;

        const players = yield* game.getPlayers;
        for (const player of players) {
          io.to(player.getSocketId()).emit(
            'player:role-assigned',
            player.getRole()
          );
        }

        yield* lobby.clear;

        yield* audio.playIntro();
      }),

      /**
       * Runs the night phase by processing all non-skipped night segments.
       * @returns Effect that completes when the night phase audio is played for all segments.
       * @dependencies Depends on Game and AudioManager services.
       */
      runNightPhase: Effect.gen(function* () {
        yield* applySkipLogic;
        const segments = yield* getSegments;

        for (const segment of segments) {
          if (
            segment.type === 'DAY' ||
            segment.type === 'DAY_VOTE' ||
            segment.type === 'HUNTER'
          ) {
            continue;
          }

          if (segment.skip) {
            continue;
          }

          yield* audio.playSegmentStart(segment.type);
        }
      }),

      /**
       * Runs the day phase by processing night deaths, checking special scenarios, and starting day voting.
       * @returns Effect that completes when the day phase is initiated.
       * @dependencies Depends on Game, SocketServer, and AudioManager services.
       */
      runDayPhase: Effect.gen(function* () {
        const scenario = yield* checkPostNightScenarios;

        if (scenario === 'hunter-revenge') {
          yield* audio.playHunterDeath();
          io.emit('hunter:pick-required');
          return;
        }

        if (scenario === 'hunter-lover') {
          yield* audio.playHunterWithLoverDeath();
          io.emit('hunter:pick-required');
          return;
        }

        if (scenario === 'lover-suicide') {
          yield* audio.playLoverDeath();
          const deaths = yield* game.processPendingDeaths;
          io.emit('night:deaths-announced', deaths);

          const winner = yield* game.checkWinner;
          if (winner) {
            yield* audio.playWinnerAudio(winner);
            io.emit(
              winner === 'werewolves' ? 'alert:player-lost' : 'alert:player-won'
            );
            return;
          }

          yield* audio.playDayVoteAudio();
          io.emit('day:voting-phase-start');
          return;
        }

        const deaths = yield* game.processPendingDeaths;
        yield* audio.nightHasEndedAudio();
        yield* audio.playDeathAnnouncement(deaths.length > 0);

        io.emit('night:deaths-announced', deaths);

        const winner = yield* game.checkWinner;
        if (winner) {
          yield* audio.playWinnerAudio(winner);
          io.emit(
            winner === 'werewolves' ? 'alert:player-lost' : 'alert:player-won'
          );
          return;
        }

        yield* audio.playDayVoteAudio();
        io.emit('day:voting-phase-start');
      }),

      /**
       * Handles continuation after the Cupid segment completes.
       * @returns Effect that completes when Cupid segment cleanup is done.
       * @dependencies Depends on AudioManager service.
       */
      continueAfterCupid: Effect.gen(function* () {
        yield* audio.playSegmentEnd('CUPID');
        yield* markFirstNightComplete;
      }),

      /**
       * Handles continuation after the Lovers Reveal segment completes.
       * @returns Effect that completes when Lovers Reveal segment cleanup is done.
       * @dependencies Depends on AudioManager service.
       */
      continueAfterLoversReveal: Effect.gen(function* () {
        yield* audio.playSegmentEnd('LOVERS_REVEAL');
      }),

      /**
       * Handles continuation after the werewolf vote segment completes.
       * @returns Effect that completes when werewolf segment cleanup is done.
       * @dependencies Depends on Game and AudioManager services.
       */
      continueAfterWerewolfVote: Effect.gen(function* () {
        const targetSid = yield* game.getWerewolfTarget;
        if (targetSid) {
          yield* game.addPendingDeath(targetSid, 'WEREWOLVES');
        }

        yield* audio.playSegmentEnd('WEREWOLF');
        yield* game.clearWerewolfVotes;
      }),

      /**
       * Handles continuation after the Witch Heal segment completes.
       * @returns Effect that completes when Witch Heal segment cleanup is done.
       * @dependencies Depends on AudioManager service.
       */
      continueAfterWitchHeal: Effect.gen(function* () {
        yield* audio.playSegmentEnd('WITCH-HEAL');
      }),

      /**
       * Handles continuation after the Witch Poison segment completes.
       * @returns Effect that completes when Witch Poison segment cleanup is done.
       * @dependencies Depends on AudioManager service.
       */
      continueAfterWitchPoison: Effect.gen(function* () {
        yield* audio.playSegmentEnd('WITCH-POISON');
      }),

      /**
       * Handles continuation after the day vote segment completes, processing the vote result and checking scenarios.
       * @returns Effect that completes when day vote segment cleanup is done.
       * @dependencies Depends on Game, SocketServer, and AudioManager services.
       */
      continueAfterDayVote: Effect.gen(function* () {
        const target = yield* game.getDayVoteTarget;
        yield* game.addPendingDeath(target.getSocketId(), 'DAY_VOTE');

        const scenario = yield* checkPostDayVoteScenarios;

        if (scenario === 'hunter-revenge') {
          yield* audio.playSegmentEnd('DAY_VOTE');
          io.emit('hunter:pick-required');
          return;
        }

        if (scenario === 'hunter-lover') {
          yield* audio.playDayVoteHunterHasPartner();
          io.emit('hunter:pick-required');
          return;
        }

        if (scenario === 'lover-suicide') {
          yield* audio.playDayVoteLoversDeath();
          yield* game.clearDayVotes;

          const winner = yield* game.checkWinner;
          if (winner) {
            yield* audio.playWinnerAudio(winner);
            io.emit(
              winner === 'werewolves' ? 'alert:player-lost' : 'alert:player-won'
            );
          }
          return;
        }

        yield* audio.playSegmentEnd('DAY_VOTE');
        yield* game.clearDayVotes;

        const winner = yield* game.checkWinner;
        if (winner) {
          yield* audio.playWinnerAudio(winner);
          io.emit(
            winner === 'werewolves' ? 'alert:player-lost' : 'alert:player-won'
          );
        }
      }),

      /**
       * Handles continuation after the hunter revenge segment completes.
       * @returns Effect that completes when hunter revenge segment cleanup is done.
       * @dependencies Depends on Game, SocketServer, and AudioManager services.
       */
      continueAfterHunterRevenge: Effect.gen(function* () {
        yield* audio.playSegmentEnd('HUNTER');

        const winner = yield* game.checkWinner;
        if (winner) {
          yield* audio.playWinnerAudio(winner);
          io.emit(
            winner === 'werewolves' ? 'alert:player-lost' : 'alert:player-won'
          );
          return;
        }

        yield* audio.playPostHunterAudio();
        io.emit('day:voting-phase-start');
      }),
    };
  }),
  dependencies: [
    Game.Default,
    Lobby.Default,
    SocketServer.Default,
    AudioManager.Default,
  ],
}) {}
