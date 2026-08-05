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
      this.eventsActions.submitHunterPick('mock-id-3');
      console.log(
        'After submitHunterPick, death queue:',
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
      this.eventsActions.submitHunterPick('mock-id-3');
      console.log(
        'After submitHunterPick, death queue:',
        this.game.getDeathQueue()
      );
    }, 20_000);
  }

  // Village killed hunter (post day vote)
  runDayVoteKillHunter() {
    const hunter = this.game.addPlayer('Hunter', 'mock-hunter-id');
    const villager = this.game.addPlayer('Villager', 'mock-villager-id');
    const werewolf = this.game.addPlayer('Werewolf', 'mock-werewolf-id');

    hunter.setRole('HUNTER');
    this.game.setSpecialRolePlayer(hunter);
    villager.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    this.game.setPlayerTeams(hunter);
    this.game.setPlayerTeams(villager);
    this.game.setPlayerTeams(werewolf);

    // The village voted the hunter out — resolution pauses until the
    // hunter sends hunter:killed-player
    this.eventsActions.resolveDayVote(hunter);
  }

  // Village killed lover (post day vote)
  runDayVoteKillLover() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');
    const player3 = this.game.addPlayer('Player3', 'mock-id-3');
    const werewolf = this.game.addPlayer('Werewolf', 'mock-werewolf-id');

    player1.setRole('VILLAGER');
    player2.setRole('VILLAGER');
    player3.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    this.game.setPlayerTeams(player1);
    this.game.setPlayerTeams(player2);
    this.game.setPlayerTeams(player3);
    this.game.setPlayerTeams(werewolf);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.eventsActions.resolveDayVote(player1);
  }

  // Village killed lover which is the hunter (post day vote)
  runDayVoteKillLoverWhoIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');
    const player3 = this.game.addPlayer('Player3', 'mock-id-3');
    const werewolf = this.game.addPlayer('Werewolf', 'mock-werewolf-id');

    player1.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player1);
    player2.setRole('VILLAGER');
    player3.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    this.game.setPlayerTeams(player1);
    this.game.setPlayerTeams(player2);
    this.game.setPlayerTeams(player3);
    this.game.setPlayerTeams(werewolf);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.eventsActions.resolveDayVote(player1);
  }

  // Village killed lover but second lover is hunter (post day vote)
  runDayVoteKillLoverSecondIsHunter() {
    const player1 = this.game.addPlayer('Player1', 'mock-id-1');
    const player2 = this.game.addPlayer('Player2', 'mock-id-2');
    const player3 = this.game.addPlayer('Player3', 'mock-id-3');
    const werewolf = this.game.addPlayer('Werewolf', 'mock-werewolf-id');

    player1.setRole('VILLAGER');
    player2.setRole('HUNTER');
    this.game.setSpecialRolePlayer(player2);
    player3.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    this.game.setPlayerTeams(player1);
    this.game.setPlayerTeams(player2);
    this.game.setPlayerTeams(player3);
    this.game.setPlayerTeams(werewolf);

    this.game.setLovers(['mock-id-1', 'mock-id-2']);

    this.eventsActions.resolveDayVote(player1);
  }

  // Hunter dies, then picks a lover as revenge target
  runHunterRevengeKillsLover() {
    console.log('🚀 Starting runHunterRevengeKillsLover scenario');

    // Create 5 players
    const hunter = this.game.addPlayer('Hunter', 'mock-hunter');
    const lover1 = this.game.addPlayer('Lover1', 'mock-lover-1');
    const lover2 = this.game.addPlayer('Lover2', 'mock-lover-2');
    const villager1 = this.game.addPlayer('Villager-1', 'mock-villager-1');
    const villager2 = this.game.addPlayer('Villager-2', 'mock-villager-2');
    const werewolf = this.game.addPlayer('Werewolf', 'mock-werewolf');

    // Assign roles
    hunter.setRole('HUNTER');
    lover1.setRole('VILLAGER');
    lover2.setRole('VILLAGER');
    villager1.setRole('VILLAGER');
    villager2.setRole('VILLAGER');
    werewolf.setRole('WEREWOLF');

    // Set teams
    this.game.setPlayerTeams(hunter);
    this.game.setPlayerTeams(lover1);
    this.game.setPlayerTeams(lover2);
    this.game.setPlayerTeams(villager1);
    this.game.setPlayerTeams(villager2);
    this.game.setPlayerTeams(werewolf);

    // Register special roles
    this.game.setSpecialRolePlayer(hunter);

    // Set up lovers (NOT including hunter)
    this.game.setLovers(['mock-lover-1', 'mock-lover-2']);

    console.log(
      '💕 Lovers set:',
      this.game.getLovers().map((l) => l.getName())
    );
    console.log(
      'Players:',
      Array.from(this.game.getPlayerList().values()).map(
        (p) => `${p.getName()}:${p.isAlive}`
      )
    );

    // Hunter dies from werewolves
    this.game.addPendingDeath('mock-hunter', 'WEREWOLVES');
    console.log('💀 Added hunter to pending deaths');

    // Jump to DAY segment to trigger hunter revenge flow
    const daySegmentIndex = this.segmentsManager.segments.findIndex(
      (s) => s.type === 'DAY'
    );
    this.segmentsManager.currentSegment = daySegmentIndex;
    this.segmentsManager.playSegment();

    // After audio plays, auto-pick Lover1 as revenge target
    setTimeout(() => {
      console.log('🎯💕 Hunter picking Lover1 as revenge target...');
      console.log(
        'Before hunter pick, death queue:',
        this.game.getDeathQueue()
      );
      this.eventsActions.submitHunterPick('mock-lover-1');
      console.log('After hunter pick, death queue:', this.game.getDeathQueue());
    }, 20_000); // Adjust timing based on audio length
  }

  private createPlayer(name: string, sid: string, role: Role) {
    const player = new Player(name, sid, this.io);
    player.setRole(role);
    return player;
  }
}
