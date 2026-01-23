import { describe, expect, it } from 'vitest';
import type { MockGameState } from '../mock-game-state';
import type { Role } from '../role';

describe('MockGameState type', () => {
  it('should be a valid type definition', () => {
    const mockGameState: MockGameState = {
      playersList: [],
      villagersList: [],
      roleAssigned: null,
      werewolfVotes: {},
      playerVote: '',
      isVotingComplete: false,
      votingResult: null,
    };

    expect(mockGameState.playersList).toEqual([]);
    expect(mockGameState.villagersList).toEqual([]);
    expect(mockGameState.roleAssigned).toBeNull();
  });

  it('should accept playersList and villagersList', () => {
    const players = [
      { name: 'Alice', socketId: 'socket-1' },
      { name: 'Bob', socketId: 'socket-2' },
    ];
    const villagers = [{ name: 'Charlie', socketId: 'socket-3' }];

    const mockGameState: MockGameState = {
      playersList: players,
      villagersList: villagers,
      roleAssigned: 'VILLAGER',
      werewolfVotes: {},
      playerVote: '',
      isVotingComplete: false,
      votingResult: null,
    };

    expect(mockGameState.playersList).toHaveLength(2);
    expect(mockGameState.playersList[0]?.name).toBe('Alice');
    expect(mockGameState.villagersList).toHaveLength(1);
    expect(mockGameState.villagersList[0]?.name).toBe('Charlie');
  });

  it('should accept all role types', () => {
    const roles: Role[] = [
      'VILLAGER',
      'WEREWOLF',
      'SEER',
      'HUNTER',
      'CUPID',
      'WITCH',
    ];

    for (const role of roles) {
      const mockGameState: MockGameState = {
        ...baseMockGameState(),
        roleAssigned: role,
      };

      expect(mockGameState.roleAssigned).toBe(role);
    }
  });

  it('should support werewolf voting state', () => {
    const werewolfVotes = {
      'socket-1': 2,
      'socket-2': 1,
      'socket-3': 3,
    };

    const mockGameState: MockGameState = {
      ...baseMockGameState(),
      werewolfVotes,
    };

    expect(mockGameState.werewolfVotes['socket-1']).toBe(2);
    expect(mockGameState.werewolfVotes['socket-2']).toBe(1);
    expect(mockGameState.werewolfVotes['socket-3']).toBe(3);
  });

  it('should support player vote', () => {
    const mockGameState: MockGameState = {
      ...baseMockGameState(),
      playerVote: 'socket-1',
    };

    expect(mockGameState.playerVote).toBe('socket-1');
  });

  it('should support voting completion state', () => {
    const incompleteGameState: MockGameState = {
      ...baseMockGameState(),
      isVotingComplete: false,
    };
    const completeGameState: MockGameState = {
      ...baseMockGameState(),
      isVotingComplete: true,
    };

    expect(incompleteGameState.isVotingComplete).toBe(false);
    expect(completeGameState.isVotingComplete).toBe(true);
  });

  it('should support voting result', () => {
    const mockGameState: MockGameState = {
      ...baseMockGameState(),
      votingResult: 'socket-1',
    };

    expect(mockGameState.votingResult).toBe('socket-1');
  });

  it('should support all optional fields being null or empty', () => {
    const mockGameState: MockGameState = {
      playersList: [],
      villagersList: [],
      roleAssigned: null,
      werewolfVotes: {},
      playerVote: '',
      isVotingComplete: false,
      votingResult: null,
    };

    expect(mockGameState.roleAssigned).toBeNull();
    expect(mockGameState.votingResult).toBeNull();
    expect(mockGameState.playerVote).toBe('');
    expect(mockGameState.werewolfVotes).toEqual({});
  });

  it('should represent a complete game state', () => {
    const completeState: MockGameState = {
      playersList: [
        { name: 'Alice', socketId: 'socket-1' },
        { name: 'Bob', socketId: 'socket-2' },
        { name: 'Charlie', socketId: 'socket-3' },
      ],
      villagersList: [
        { name: 'Alice', socketId: 'socket-1' },
        { name: 'Charlie', socketId: 'socket-3' },
      ],
      roleAssigned: 'WEREWOLF',
      werewolfVotes: {
        'socket-1': 2,
        'socket-2': 1,
      },
      playerVote: 'socket-3',
      isVotingComplete: true,
      votingResult: 'socket-1',
    };

    expect(completeState.playersList).toHaveLength(3);
    expect(completeState.villagersList).toHaveLength(2);
    expect(completeState.roleAssigned).toBe('WEREWOLF');
    expect(completeState.werewolfVotes['socket-1']).toBe(2);
    expect(completeState.playerVote).toBe('socket-3');
    expect(completeState.isVotingComplete).toBe(true);
    expect(completeState.votingResult).toBe('socket-1');
  });
});

function baseMockGameState(): MockGameState {
  return {
    playersList: [],
    villagersList: [],
    roleAssigned: null,
    werewolfVotes: {},
    playerVote: '',
    isVotingComplete: false,
    votingResult: null,
  };
}
