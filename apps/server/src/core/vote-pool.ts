import type { WerewolvesVoteState } from '@repo/types';

/**
 * A set of votes keyed by voter: voterSid → targetSid. Used for both the
 * werewolves' night vote and the village's day vote.
 */
export class VotePool {
  private readonly votes: Map<string, string> = new Map();

  setVote(voterSid: string, targetSid: string) {
    this.votes.set(voterSid, targetSid);
  }

  getVote(voterSid: string) {
    return this.votes.get(voterSid);
  }

  hasVote(voterSid: string) {
    return this.votes.has(voterSid);
  }

  removeVote(voterSid: string) {
    this.votes.delete(voterSid);
  }

  clear() {
    this.votes.clear();
  }

  size() {
    return this.votes.size;
  }

  /**
   * Vote count per target. When `voterSids` is given, only those voters'
   * votes are counted (e.g. werewolves still alive and connected).
   */
  tallies(voterSids?: readonly string[]) {
    const tallies: WerewolvesVoteState = {};

    const targets = voterSids
      ? voterSids.flatMap((sid) => this.votes.get(sid) ?? [])
      : [...this.votes.values()];

    for (const targetSid of targets) {
      tallies[targetSid] = (tallies[targetSid] || 0) + 1;
    }

    return tallies;
  }

  /**
   * Socket IDs double as player IDs, so on reconnect both the voter key and
   * any vote pointing at the old ID must move to the new one. Otherwise the
   * stale vote lingers and the phase never sees everyone as having voted.
   */
  remapSocketId(oldSid: string, newSid: string) {
    if (oldSid === newSid) {
      return;
    }

    const ownVote = this.votes.get(oldSid);

    if (ownVote !== undefined) {
      this.votes.delete(oldSid);
      this.votes.set(newSid, ownVote);
    }

    for (const [voterSid, targetSid] of this.votes.entries()) {
      if (targetSid === oldSid) {
        this.votes.set(voterSid, newSid);
      }
    }
  }
}
