export const roles = [
  'villager',
  'werewolf',
  'seer',
  'hunter',
  'cupid',
  'witch',
] as const;

export type Role = Uppercase<(typeof roles)[number]>;

export const roleDescriptions: Record<Role, string> = {
  VILLAGER:
    "Un simple villageois. Votre but est d'identifier et d'éliminer tous les loups-garous.",
  WEREWOLF:
    'Chaque nuit, vous dévorez un villageois avec les autres loups-garous. Éliminez tous les villageois pour gagner.',
  SEER: "Chaque nuit, vous pouvez voir le vrai rôle d'un joueur. Utilisez cette information pour aider les villageois.",
  HUNTER:
    'Si vous mourez, vous pouvez immédiatement éliminer un autre joueur avec votre dernière balle.',
  CUPID:
    'On the first night, choose two players to fall in love. If one dies, the other dies too.',
  WITCH:
    'Vous avez deux potions : une de guérison pour sauver un joueur attaqué par un loup-garou, et une de poison pour éliminer un joueur. Utilisez-les judicieusement.',
};

export function getRoleDescription(role: Role): string {
  return roleDescriptions[role];
}
