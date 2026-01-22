export function getStatusClassName(
  status: 'lobby' | 'in-game' | 'disconnected'
): string {
  const statusMap = {
    'in-game': 'bg-green-100 text-green-800',
    lobby: 'bg-yellow-100 text-yellow-800',
    disconnected: 'bg-gray-100 text-gray-600',
  };
  return statusMap[status];
}

export function getRoleClassName(role: string): string {
  const roleMap: Record<string, string> = {
    WEREWOLF: 'bg-red-100 text-red-800',
    WITCH: 'bg-purple-100 text-purple-800',
    SEER: 'bg-blue-100 text-blue-800',
    HUNTER: 'bg-orange-100 text-orange-800',
    CUPID: 'bg-pink-100 text-pink-800',
    VILLAGER: 'bg-green-100 text-green-800',
  };
  return roleMap[role] || 'bg-gray-100 text-gray-800';
}
