/**
 * Plays one narration clip and resolves when it has finished. The segment
 * loop awaits each clip, so a narrator's timing paces the game.
 *
 * `clip` is an asset path without extension, e.g. `Werewolves/Werewolves-1`.
 */
export type Narrator = {
  play(clip: string): Promise<void>;
};

/** Plays nothing; the default so tests and simulations never touch audio. */
export const silentNarrator: Narrator = {
  play: () => Promise.resolve(),
};
