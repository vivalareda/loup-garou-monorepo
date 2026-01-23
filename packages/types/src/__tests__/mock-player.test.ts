import { describe, expect, it } from 'vitest';
import type { MockPlayer } from '../mock-player';
import type { GamePlayer, LobbyPlayer } from '../player';
import type { PlayerListItem } from '../player-utils';

describe('MockPlayer type', () => {
  it('should be a valid type definition', () => {
    const mockPlayer: MockPlayer = {
      id: 'player-1',
      name: 'Alice',
      socket: {} as never,
      player: null,
      playersList: [],
      isConnected: false,
      status: 'disconnected',
      isLover: false,
      loverName: null,
      canCloseLoverAlert: false,
      isCupid: false,
      canSelectLovers: false,
      selectedLovers: [],
      showHealModal: false,
      showPoisonModal: false,
      werewolfVictimId: null,
      showDayVoteModal: false,
      dayVoteTarget: null,
      canVote: false,
    };

    expect(mockPlayer.id).toBe('player-1');
    expect(mockPlayer.name).toBe('Alice');
    expect(mockPlayer.status).toBe('disconnected');
  });

  it('should accept a Player as player property', () => {
    const gamePlayer: GamePlayer = {
      type: 'game',
      name: 'Bob',
      socketId: 'socket-1',
      role: 'WEREWOLF',
      isAlive: true,
    };

    const mockPlayer: MockPlayer = {
      id: 'player-2',
      name: 'Bob',
      socket: {} as never,
      player: gamePlayer,
      playersList: [],
      isConnected: true,
      status: 'in-game',
      isLover: false,
      loverName: null,
      canCloseLoverAlert: false,
      isCupid: false,
      canSelectLovers: false,
      selectedLovers: [],
      showHealModal: false,
      showPoisonModal: false,
      werewolfVictimId: null,
      showDayVoteModal: false,
      dayVoteTarget: null,
      canVote: true,
    };

    expect(mockPlayer.player).toBe(gamePlayer);
    expect(mockPlayer.player?.type).toBe('game');
  });

  it('should accept a LobbyPlayer as player property', () => {
    const lobbyPlayer: LobbyPlayer = {
      type: 'lobby',
      name: 'Charlie',
      socketId: 'socket-2',
    };

    const mockPlayer: MockPlayer = {
      id: 'player-3',
      name: 'Charlie',
      socket: {} as never,
      player: lobbyPlayer,
      playersList: [],
      isConnected: true,
      status: 'lobby',
      isLover: false,
      loverName: null,
      canCloseLoverAlert: false,
      isCupid: false,
      canSelectLovers: false,
      selectedLovers: [],
      showHealModal: false,
      showPoisonModal: false,
      werewolfVictimId: null,
      showDayVoteModal: false,
      dayVoteTarget: null,
      canVote: false,
    };

    expect(mockPlayer.player).toBe(lobbyPlayer);
    expect(mockPlayer.player?.type).toBe('lobby');
  });

  it('should accept PlayerListItem as playersList property', () => {
    const playerList: PlayerListItem[] = [
      { name: 'Alice', socketId: 'socket-1' },
      { name: 'Bob', socketId: 'socket-2' },
    ];

    const mockPlayer: MockPlayer = {
      id: 'player-4',
      name: 'Charlie',
      socket: {} as never,
      player: null,
      playersList: playerList,
      isConnected: true,
      status: 'lobby',
      isLover: false,
      loverName: null,
      canCloseLoverAlert: false,
      isCupid: false,
      canSelectLovers: false,
      selectedLovers: [],
      showHealModal: false,
      showPoisonModal: false,
      werewolfVictimId: null,
      showDayVoteModal: false,
      dayVoteTarget: null,
      canVote: false,
    };

    expect(mockPlayer.playersList).toHaveLength(2);
    expect(mockPlayer.playersList[0]?.name).toBe('Alice');
  });

  it('should support all status types', () => {
    const disconnectedMock: MockPlayer = {
      ...baseMockPlayer(),
      status: 'disconnected',
    };
    const lobbyMock: MockPlayer = { ...baseMockPlayer(), status: 'lobby' };
    const inGameMock: MockPlayer = { ...baseMockPlayer(), status: 'in-game' };

    expect(disconnectedMock.status).toBe('disconnected');
    expect(lobbyMock.status).toBe('lobby');
    expect(inGameMock.status).toBe('in-game');
  });

  it('should support optional lover fields', () => {
    const loverMock: MockPlayer = {
      ...baseMockPlayer(),
      isLover: true,
      loverName: 'Alice',
      canCloseLoverAlert: true,
    };

    expect(loverMock.isLover).toBe(true);
    expect(loverMock.loverName).toBe('Alice');
    expect(loverMock.canCloseLoverAlert).toBe(true);
  });

  it('should support Cupid fields', () => {
    const cupidMock: MockPlayer = {
      ...baseMockPlayer(),
      isCupid: true,
      canSelectLovers: true,
      selectedLovers: ['Alice', 'Bob'],
    };

    expect(cupidMock.isCupid).toBe(true);
    expect(cupidMock.canSelectLovers).toBe(true);
    expect(cupidMock.selectedLovers).toEqual(['Alice', 'Bob']);
  });

  it('should support Witch modal fields', () => {
    const witchMock: MockPlayer = {
      ...baseMockPlayer(),
      showHealModal: true,
      showPoisonModal: true,
      werewolfVictimId: 'socket-1',
    };

    expect(witchMock.showHealModal).toBe(true);
    expect(witchMock.showPoisonModal).toBe(true);
    expect(witchMock.werewolfVictimId).toBe('socket-1');
  });

  it('should support day vote fields', () => {
    const dayVoteMock: MockPlayer = {
      ...baseMockPlayer(),
      showDayVoteModal: true,
      dayVoteTarget: 'socket-1',
      canVote: true,
    };

    expect(dayVoteMock.showDayVoteModal).toBe(true);
    expect(dayVoteMock.dayVoteTarget).toBe('socket-1');
    expect(dayVoteMock.canVote).toBe(true);
  });
});

function baseMockPlayer(): MockPlayer {
  return {
    id: 'player-id',
    name: 'Player Name',
    socket: {} as never,
    player: null,
    playersList: [],
    isConnected: false,
    status: 'disconnected',
    isLover: false,
    loverName: null,
    canCloseLoverAlert: false,
    isCupid: false,
    canSelectLovers: false,
    selectedLovers: [],
    showHealModal: false,
    showPoisonModal: false,
    werewolfVictimId: null,
    showDayVoteModal: false,
    dayVoteTarget: null,
    canVote: false,
  };
}
