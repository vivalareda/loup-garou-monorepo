import { Console, Effect, Layer } from 'effect';
import { AudioManager } from './AudioManager.js';
import { DayVoting } from './DayVoting.js';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';
import { HunterService } from './HunterService.js';
import { SocketServer } from './SocketServer.js';
import { WerewolfVoting } from './WerewolfVoting.js';

const make = Effect.gen(function* () {
  const game = yield* Game;
  const socketServer = yield* SocketServer;
  const werewolfVoting = yield* WerewolfVoting;
  const dayVoting = yield* DayVoting;
  const deathManager = yield* DeathManager;
  const audioManager = yield* AudioManager;
  const hunterService = yield* HunterService;

  return {
    _tag: '@app/EventsActions' as const,

    handleWerewolfVote: (werewolfSid: string, targetSid: string) =>
      Effect.gen(function* () {
        // Delegate to voting service
        yield* werewolfVoting.handleVote(werewolfSid, targetSid);
      }),

    handleDayVote: (voterSid: string, targetSid: string) =>
      Effect.gen(function* () {
        yield* dayVoting.handleVote(voterSid, targetSid);
      }),

    finalizeDayVote: Effect.gen(function* () {
      const victimId = yield* dayVoting.finalizeVote;

      if (!victimId) {
        yield* Console.log('[EventsActions] No victim chosen in day vote');
        return;
      }

      const victim = yield* game.getPlayerBySocketId(victimId);
      yield* Console.log(
        `[EventsActions] Day vote victim: ${victim.getName()}`
      );

      // Add death
      yield* deathManager.addDayVoteElimination(victimId, 0); // TODO: get real vote count if needed

      // Check if victim is Hunter
      if (victim.getRole() === 'HUNTER') {
        yield* Console.log('[EventsActions] Hunter died in day vote');
        // Hunter logic
        // If hunter has partner, special audio
        const partner = yield* game.getPartner(victim);
        if (partner) {
          yield* audioManager.playDayVoteHunterHasPartner;
        }

        // Prompt hunter revenge
        yield* socketServer.emit('hunter:pick-required');
        // We might need to pause or handle async revenge
      } else {
        // Normal death
        // Check for lovers death
        const partner = yield* game.getPartner(victim);
        if (partner) {
          yield* audioManager.playDayVoteLoversDeath;
        }
      }
    }),

    handleHunterPlayerPick: (hunterSid: string, targetSid: string) =>
      Effect.gen(function* () {
        // Delegate to HunterService
        yield* hunterService.processRevenge(hunterSid, targetSid);
      }),
  };
});

export class EventsActions extends Effect.Service<EventsActions>()(
  '@app/EventsActions',
  {
    effect: make,
    dependencies: [
      Game.Default,
      SocketServer.Default,
      WerewolfVoting.Default,
      DayVoting.Default,
      DeathManager.Default,
      AudioManager.Default,
      HunterService.Default,
    ],
  }
) {
  static readonly Test = Layer.effect(this, make);
}
