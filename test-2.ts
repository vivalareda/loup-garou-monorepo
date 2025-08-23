type Role = 'VILLAGER' | 'WEREWOLF' | 'SEER' | 'HUNTER' | 'CUPID' | 'WITCH';
type RoleDescription = {
  roleName: Role;
  description: string;
};

const roleDescriptions: RoleDescription[] = [
  {
    roleName: 'VILLAGER',
    description:
      "Un simple villageois. Votre but est d'identifier et d'éliminer tous les loups-garous.",
  },
  {
    roleName: 'WEREWOLF',
    description:
      'Chaque nuit, vous dévorez un villageois avec les autres loups-garous. Éliminez tous les villageois pour gagner.',
  },
];

export function getRoleDescription(role: Role): string {
  return roleDescriptions.find((r) => r.roleName === role)?.description || '';
}
