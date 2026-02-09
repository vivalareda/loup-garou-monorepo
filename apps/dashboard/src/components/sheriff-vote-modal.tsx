import { isGamePlayer } from '@repo/types';
import { Button } from '@/components/ui/button';
import { Modal } from '@/components/ui/modal';
import { useMockPlayerStore } from '@/store/mock-players';

type SheriffVoteModalProps = {
  playerId: string;
};

export function SheriffVoteModal({ playerId }: SheriffVoteModalProps) {
  const { players, pickSheriffTarget, closeSheriffVoteModal } =
    useMockPlayerStore();
  const player = players.get(playerId);

  if (!player?.showSheriffVoteModal) {
    return null;
  }

  const topVictims = Array.from(players.values())
    .filter((p) => p.player && isGamePlayer(p.player) && p.player.isAlive)
    .filter((p) => player.sheriffTopVictims.includes(p.player!.sid));

  return (
    <Modal
      isOpen
      onClose={() => closeSheriffVoteModal(playerId)}
      title={`⭐ Sheriff Tie-Break - ${player.name}`}
    >
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          The vote is tied. As the sheriff, you must choose who dies.
        </p>

        <div className="space-y-2">
          {topVictims.length === 0 ? (
            <div className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              No tied victims available.
            </div>
          ) : (
            topVictims.map((p) => (
              <Button
                className="w-full justify-start"
                key={p.id}
                onClick={() => pickSheriffTarget(playerId, p.player!.sid)}
                variant="destructive"
              >
                Kill {p.name}
              </Button>
            ))
          )}
        </div>

        <div className="flex gap-2 pt-2">
          <Button
            className="flex-1"
            onClick={() => closeSheriffVoteModal(playerId)}
            variant="outline"
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
}
