import type { WerewolvesVoteState } from '@repo/types';
import type { Player } from '@/core/player.js';

export const calculateWerewolfVoteTallies = (
  werewolfVotes: Map<string, string>
): WerewolvesVoteState => {
  const tallies: WerewolvesVoteState = {};

  for (const targetSid of werewolfVotes.values()) {
    tallies[targetSid] = (tallies[targetSid] || 0) + 1;
  }

  return tallies;
};

export const hasAllWerewolvesAgreed = (
  werewolfVotes: Map<string, string>,
  werewolfSids: string[]
): boolean => {
  const allVoted = werewolfSids.every((sid) => werewolfVotes.has(sid));
  if (!allVoted) {
    return false;
  }

  const votes = Array.from(werewolfVotes.values());
  const firstVote = votes[0];
  return votes.every((vote) => vote === firstVote);
};

export const getWerewolfTarget = (
  werewolfVotes: Map<string, string>,
  werewolfSids: string[]
): string | undefined => {
  if (!hasAllWerewolvesAgreed(werewolfVotes, werewolfSids)) {
    return;
  }

  const tallies = calculateWerewolfVoteTallies(werewolfVotes);

  let maxVotes = 0;
  let targetSid: string | null = null;

  for (const [playerSid, votes] of Object.entries(tallies)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      targetSid = playerSid;
    }
  }

  return targetSid ?? undefined;
};

export const calculateDayVoteTallies = (
  dayVotes: Map<string, string>
): Record<string, number> => {
  const tallies: Record<string, number> = {};

  for (const targetSid of dayVotes.values()) {
    tallies[targetSid] = (tallies[targetSid] || 0) + 1;
  }

  return tallies;
};

export const getDayVoteTarget = (
  dayVotes: Map<string, string>,
  players: Map<string, Player>
): Player => {
  const tallies = calculateDayVoteTallies(dayVotes);

  let maxVotes = 0;
  let targetSid: string | null = null;
  let tieCount = 0;

  for (const [playerSid, votes] of Object.entries(tallies)) {
    if (votes > maxVotes) {
      maxVotes = votes;
      targetSid = playerSid;
      tieCount = 1;
    } else if (votes === maxVotes && maxVotes > 0) {
      tieCount += 1;
    }
  }

  if (tieCount > 1) {
    throw new Error('Tie in day vote - will be implemented later');
  }

  if (!targetSid) {
    throw new Error('No valid target found in day vote');
  }

  const player = players.get(targetSid);

  if (!player) {
    throw new Error(`Player with sid ${targetSid} not found`);
  }

  return player;
};
