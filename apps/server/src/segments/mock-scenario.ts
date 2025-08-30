import type { Role } from '@repo/types';
import type { Game } from '@/core/game';
import { Player } from '@/core/player';
import type { SegmentsManager } from '@/segments/segments-manager';

export class MockScenario {
  game: Game;
  segmentsManager: SegmentsManager;

  constructor(game: Game, segmentsManager: SegmentsManager) {
    this.game = game;
    this.segmentsManager = segmentsManager;
  }

  runWerewolfKillHunter() {
    const hunterPlayer = this.createPlayer('Player1', 'mock-id-1', 'HUNTER');

    const hunter = this.game.addPlayer(
      hunterPlayer.getName(),
      hunterPlayer.getSocketId()
    );

    hunter.setRole('HUNTER');
    this.game.setSpecialRolePlayer(hunter);

    this.game.addPendingDeath(hunter.getSocketId(), 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  runWerewolfKillLover() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('VILLAGER');
    player2.setRole('VILLAGER');

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );

    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // First lover dies, but second lover is the hunter
  runWerewolfKillLoverSecondIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player2);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // First lover dies and is the hunter
  runWerewolfKillLoverWhoIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player1);
    player2.setRole('VILLAGER');

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // Village killed hunter (post day vote)
  runDayVoteKillHunter() {
    const hunter = this.game.addPlayer('Hunter', 'mock-hunter-id');
    hunter.setRole('HUNTER');
    this.game.setSpecialRolePlayer(hunter);

    this.game.addPendingDeath('mock-hunter-id', 'DAY_VOTE');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // Village killed lover (post day vote)
  runDayVoteKillLover() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('VILLAGER');
    player2.setRole('VILLAGER');

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'DAY_VOTE');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // Village killed lover which is the hunter (post day vote)
  runDayVoteKillLoverWhoIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player1);
    player2.setRole('VILLAGER');

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'DAY_VOTE');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  // Village killed lover but second lover is hunter (post day vote)
  runDayVoteKillLoverSecondIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player2);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'DAY_VOTE');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
  }

  private createPlayer(name: string, sid: string, role: Role) {
    const player = new Player(name, sid);
    player.setRole(role);
    return player;
  }

  // private setupMockPlayers() {
  //   const player1 = this.createPlayer('Player1', 'mock-id-1', 'HUNTER');
  //   const player2 = this.createPlayer('Player2', 'mock-id-2', 'VILLAGER');
  //   const player3 = this.createPlayer('Player3', 'mock-id-3', 'VILLAGER');
  // }
}
