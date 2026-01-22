import type { Dispatch, SetStateAction } from 'react';
import { Button } from '@/components/ui/button';

type TestSimulationProps = {
  playersList: Array<{ socketId: string; name: string }>;
  isAlive?: boolean;
  onOpenWerewolfSimulation: Dispatch<SetStateAction<boolean>>;
  onSimulateDayVotes: (targetPlayerName: string) => void;
};

export function TestSimulation({
  playersList,
  isAlive = true,
  onOpenWerewolfSimulation,
  onSimulateDayVotes,
}: TestSimulationProps) {
  return (
    <div className="mt-6 rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-gray-800">
        🧪 Test Simulation
      </h2>
      <div className="space-y-4">
        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Werewolf Voting Simulation
          </h3>
          <p className="mb-3 text-xs text-gray-600">
            Simulate all werewolves in the game voting for a single target
            player. This will send votes from every player with the WEREWOLF
            role.
          </p>
          <Button
            className="bg-purple-600 hover:bg-purple-700"
            onClick={() => onOpenWerewolfSimulation(true)}
            size="sm"
          >
            🐺 Simulate All Werewolf Votes
          </Button>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-medium text-gray-700">
            Day Vote Simulation
          </h3>
          <p className="mb-3 text-xs text-gray-600">
            Simulate all alive players voting for a single target player during
            the day phase.
          </p>
          {playersList.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {playersList.map((player) => (
                <Button
                  className="bg-orange-600 hover:bg-orange-700"
                  key={player.socketId}
                  onClick={() => onSimulateDayVotes(player.name)}
                  size="sm"
                >
                  ☀️ Vote {player.name}
                </Button>
              ))}
            </div>
          )}
          {playersList.length === 0 && !isAlive && (
            <div className="rounded bg-gray-100 p-3">
              <p className="text-sm text-gray-600">
                💀 Dead players cannot participate in day voting simulation
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
