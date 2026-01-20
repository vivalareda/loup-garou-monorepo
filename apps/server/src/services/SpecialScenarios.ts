import { Effect } from 'effect';
import { AudioManager } from './AudioManager.js';
import { DeathManager } from './DeathManager.js';
import { Game } from './Game.js';

export const makeSpecialScenarios = Effect.gen(function* () {
  const game = yield* Game;
  const audioManager = yield* AudioManager;
  const deathManager = yield* DeathManager;

  return {
    handleSpecialDeathScenarios: Effect.gen(function* () {
      const pendingDeaths = yield* deathManager.getPendingDeaths();
      let hunterIsLover = false;
      let partnerOfHunterDied = false;
      let loverDied = false;

      for (const death of pendingDeaths) {
        const player = yield* game.getPlayerBySocketId(death.playerId);
        const role = player.getRole();

        // Check if player is a lover
        const partner = yield* game.getPartner(player);
        const isLover = Boolean(partner);

        if (role === 'HUNTER' && isLover) {
          hunterIsLover = true;
        }

        if (isLover) {
          loverDied = true;
          // Check if partner is hunter
          if (partner?.getRole() === 'HUNTER') {
            partnerOfHunterDied = true;
          }
        }
      }

      // Prioritize narrative logic
      if (hunterIsLover) {
        yield* audioManager.playSpecialAudio('HUNTER_IS_LOVER');
        return 'HUNTER_IS_LOVER';
      }

      if (partnerOfHunterDied) {
        // Play Lover death first, then reveal partner was hunter
        yield* audioManager.playSpecialAudio('LOVER_DEATH');
        yield* Effect.sleep('2 seconds');
        yield* audioManager.playSpecialAudio('PARTNER_IS_HUNTER');
        return 'PARTNER_IS_HUNTER';
      }

      if (loverDied) {
        yield* audioManager.playSpecialAudio('LOVER_DEATH');
        return 'LOVER_DEATH';
      }

      return null;
    }),
  };
});

export class SpecialScenarios extends Effect.Service<SpecialScenarios>()(
  '@app/SpecialScenarios',
  {
    effect: makeSpecialScenarios,
    dependencies: [Game.Default, AudioManager.Default, DeathManager.Default],
  }
) {}
