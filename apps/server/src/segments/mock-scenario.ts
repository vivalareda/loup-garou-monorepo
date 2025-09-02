import type { Role } from '@repo/types';
import type { Game } from '@/core/game';
import { Player } from '@/core/player';
import type { SegmentsManager } from '@/segments/segments-manager';
import type { EventsActions } from '@/server/events-actions';
import type { SocketType } from '@/server/sockets';

export class MockScenario {
  game: Game;
  segmentsManager: SegmentsManager;
  io: SocketType;
  eventsActions: EventsActions;

  constructor(
    game: Game,
    segmentsManager: SegmentsManager,
    io: SocketType,
    eventsActions: EventsActions
  ) {
    this.game = game;
    this.segmentsManager = segmentsManager;
    this.io = io;
    this.eventsActions = eventsActions;
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
    const player3 = this.game.addPlayer('Player3', 'mock-id-3');
    const player4 = this.game.addPlayer('Player4', 'mock-id-4');
    const player5 = this.game.addPlayer('Player5', 'mock-id-5');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    player3.setRole('VILLAGER');
    player4.setRole('WEREWOLF');
    player5.setRole('VILLAGER');

    this.game.setPlayerTeams(player1);
    this.game.setPlayerTeams(player2);
    this.game.setPlayerTeams(player3);
    this.game.setPlayerTeams(player4);
    this.game.setPlayerTeams(player5);

    this.game.setSpecialRolePlayer(player2);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
    setTimeout(() => {
      this.eventsActions.handleHunterPlayerPick('mock-id-3');
      console.log(
        'After handleHunterPlayerPick, death queue:',
        this.game.getDeathQueue()
      );
    }, 35_000);
  }

  // First lover dies and is the hunter
  runWerewolfKillLoverWhoIsHunter() {
    console.log('🚀 Starting runWerewolfKillLoverWhoIsHunter scenario');
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');
    const player3 = this.game.addPlayer('Player3', 'mock-id-3');
    const player4 = this.game.addPlayer('Player4', 'mock-id-4');

    player1.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player1);
    player2.setRole('VILLAGER');
    player3.setRole('VILLAGER');
    player4.setRole('WEREWOLF');

    this.game.setPlayerTeams(player1);
    this.game.setPlayerTeams(player2);
    this.game.setPlayerTeams(player3);
    this.game.setPlayerTeams(player4);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);
    console.log(
      'Players:',
      Array.from(this.game.getPlayerList().values()).map(
        (p) => `${p.getName()}:${p.isAlive}`
      )
    );

    this.game.addPendingDeath('mock-id-1', 'WEREWOLVES');

    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();
    setTimeout(() => {
      this.eventsActions.handleHunterPlayerPick('mock-id-3');
      console.log(
        'After handleHunterPlayerPick, death queue:',
        this.game.getDeathQueue()
      );
    }, 20_000);
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
}
