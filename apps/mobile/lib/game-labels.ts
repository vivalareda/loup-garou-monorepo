import type { Role } from '@repo/types';

/** How each role is shown to players: its French name and an emblem. */
export const ROLES: Record<Role, { label: string; emblem: string }> = {
  WEREWOLF: { label: 'Loup-Garou', emblem: '🐺' },
  VILLAGER: { label: 'Villageois', emblem: '🧑‍🌾' },
  WITCH: { label: 'Sorcière', emblem: '🧪' },
  CUPID: { label: 'Cupidon', emblem: '💘' },
  HUNTER: { label: 'Chasseur', emblem: '🎯' },
  SEER: { label: 'Voyante', emblem: '🔮' },
};
