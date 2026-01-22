/**
 * Pure vote tallying functions for werewolf game voting mechanics.
 * All functions are pure (no side effects) and can be used for any voting scenario.
 */

/**
 * Calculates vote tallies from a map of votes.
 * @param votes - Map of voter IDs to target IDs
 * @returns Record of target IDs to vote counts
 */
export const calculateTallies = (
  votes: Map<string, string>
): Record<string, number> => {
  const tallies: Record<string, number> = {};

  for (const targetId of votes.values()) {
    tallies[targetId] = (tallies[targetId] || 0) + 1;
  }

  return tallies;
};

/**
 * Checks if all expected voters have voted.
 * @param voters - Array of voter IDs who should vote
 * @param votes - Map of voter IDs to target IDs
 * @returns true if all voters have voted
 */
export const hasAllVoted = (
  voters: string[],
  votes: Map<string, string>
): boolean => {
  return voters.every((voterId) => votes.has(voterId));
};

/**
 * Gets the target with the most votes from tallies.
 * Returns null if there's no clear winner (tie or no votes).
 * @param tallies - Record of target IDs to vote counts
 * @returns The winning target ID or null
 */
export const getWinningTarget = (
  tallies: Record<string, number>
): string | null => {
  if (Object.keys(tallies).length === 0) {
    return null;
  }

  let maxVotes = 0;
  let winningTarget: string | null = null;
  let winnerCount = 0;

  for (const [targetId, voteCount] of Object.entries(tallies)) {
    if (voteCount > maxVotes) {
      maxVotes = voteCount;
      winningTarget = targetId;
      winnerCount = 1;
    } else if (voteCount === maxVotes) {
      winnerCount++;
    }
  }

  // Return null if there's a tie
  if (winnerCount > 1) {
    return null;
  }

  return winningTarget;
};

/**
 * Checks if there's a tie in the vote tallies.
 * A tie exists when multiple targets have the same highest vote count.
 * @param tallies - Record of target IDs to vote counts
 * @returns true if there's a tie
 */
export const checkForTie = (tallies: Record<string, number>): boolean => {
  if (Object.keys(tallies).length === 0) {
    return false;
  }

  const voteCounts = Object.values(tallies);
  const maxVotes = Math.max(...voteCounts);
  const targetsWithMaxVotes = voteCounts.filter(
    (count) => count === maxVotes
  ).length;

  return targetsWithMaxVotes > 1;
};

// Legacy functions for backward compatibility
// These wrap the new generic functions with game-specific logic

/**
 * @deprecated Use calculateTallies instead
 */
export const calculateWerewolfVoteTallies = calculateTallies;

/**
 * @deprecated Use calculateTallies instead
 */
export const calculateDayVoteTallies = calculateTallies;

/**
 * Checks if all werewolves have voted and agreed on a target.
 * @param werewolfVotes - Map of werewolf voter IDs to target IDs
 * @param werewolfSids - Array of werewolf socket IDs
 * @returns true if all werewolves voted for the same target
 */
export const hasAllWerewolvesAgreed = (
  werewolfVotes: Map<string, string>,
  werewolfSids: string[]
): boolean => {
  if (!hasAllVoted(werewolfSids, werewolfVotes)) {
    return false;
  }

  const votes = Array.from(werewolfVotes.values());
  const firstVote = votes[0];
  return votes.every((vote) => vote === firstVote);
};

/**
 * Gets the werewolf target if all werewolves have agreed.
 * @param werewolfVotes - Map of werewolf voter IDs to target IDs
 * @param werewolfSids - Array of werewolf socket IDs
 * @returns The target socket ID or undefined
 */
export const getWerewolfTarget = (
  werewolfVotes: Map<string, string>,
  werewolfSids: string[]
): string | undefined => {
  if (!hasAllWerewolvesAgreed(werewolfVotes, werewolfSids)) {
    return;
  }

  const tallies = calculateTallies(werewolfVotes);
  const target = getWinningTarget(tallies);

  return target ?? undefined;
};

/**
 * Gets the day vote target player.
 * @param dayVotes - Map of voter IDs to target IDs
 * @param players - Map of socket IDs to Player objects
 * @returns The Player object with the most votes
 * @throws Error if there's a tie or no valid target
 */
export const getDayVoteTarget = <T>(
  dayVotes: Map<string, string>,
  players: Map<string, T>
): T => {
  const tallies = calculateTallies(dayVotes);

  if (checkForTie(tallies)) {
    throw new Error('Tie in day vote - will be implemented later');
  }

  const targetSid = getWinningTarget(tallies);

  if (!targetSid) {
    throw new Error('No valid target found in day vote');
  }

  const player = players.get(targetSid);

  if (!player) {
    throw new Error(`Player with sid ${targetSid} not found`);
  }

  return player;
};
