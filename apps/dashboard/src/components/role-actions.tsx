import { isGamePlayer } from '@repo/types';
import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';
import type { MockPlayer } from '@/store/mock-players';

type RoleActionsProps = {
  player: MockPlayer;
  onOpenWerewolfVoting: Dispatch<SetStateAction<boolean>>;
};

export function RoleActions({
  player,
  onOpenWerewolfVoting,
}: RoleActionsProps) {
  if (player.status !== 'in-game' || !player.player) {
    return null;
  }

  if (!isGamePlayer(player.player)) {
    return null;
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">Role Actions</h2>
      <div className="space-y-3">
        {player.player.role === 'WEREWOLF' && (
          <div>
            <h3 className="mb-3 text-lg font-semibold text-red-800">
              🐺 Werewolf Actions
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              Vote to eliminate a villager during the night phase.
            </p>
            {player.player.isAlive ? (
              <Button
                className="bg-red-600 hover:bg-red-700"
                onClick={() => onOpenWerewolfVoting(true)}
              >
                Open Werewolf Voting
              </Button>
            ) : (
              <div className="rounded bg-gray-100 p-3">
                <p className="text-sm text-gray-600">
                  💀 Dead players cannot participate in werewolf voting
                </p>
              </div>
            )}
          </div>
        )}

        {player.player.role === 'WITCH' && (
          <div>
            <h3 className="mb-3 text-lg font-semibold text-purple-800">
              🧙 Witch Actions
            </h3>
            <p className="mb-3 text-sm text-gray-600">
              Use your potions to heal or poison players during the night phase.
            </p>
            {player.player.isAlive ? (
              <div className="space-y-2">
                <div className="rounded bg-purple-50 p-3">
                  <p className="text-sm text-purple-800">
                    Witch modals will appear automatically when the server
                    prompts you.
                  </p>
                  <p className="mt-1 text-xs text-purple-600">
                    Heal: Save werewolf victim • Poison: Eliminate any player
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded bg-gray-100 p-3">
                <p className="text-sm text-gray-600">
                  💀 Dead players cannot use witch potions
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
