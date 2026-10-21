import { implement } from "@rat-stack/capability";
import { Effect } from "effect";

import {
  describeDecisionContract,
  GameError,
  healthContract,
  runBatchContract,
} from "./contracts.js";
import { GameHarness } from "./game-harness.js";

export const health = implement(healthContract, () =>
  Effect.succeed({
    ok: true,
    workspace: "loup-rat" as const,
    next: "Implement GameHarness live adapter; see rat/MIGRATION.md",
  })
);

export const runBatch = implement(runBatchContract, (input) =>
  GameHarness.use((harness) =>
    harness.runBatch({
      games: input.games,
      playerCount: input.playerCount ?? 6,
      seed: input.seed ?? 1,
      policy: input.policy ?? "persona",
      serverUrl: input.serverUrl,
      roomCode: input.roomCode,
    })
  )
);

export const describeDecision = implement(describeDecisionContract, (input) =>
  Effect.gen(function* describe() {
    const aliveOthers = input.aliveOthers;
    if (aliveOthers.length === 0 && input.prompt !== "LOVERS") {
      return yield* Effect.fail(
        new GameError({
          message: "aliveOthers must list at least one other living player",
        })
      );
    }

    const legalActions = (() => {
      switch (input.prompt) {
        case "LOVERS":
          return [
            {
              index: 0,
              event: "alert:lover-closed-alert",
              description: "Acknowledge lover alert",
            },
          ];
        case "CUPID": {
          const actions: Array<{
            index: number;
            event: string;
            description: string;
          }> = [];
          let index = 0;
          for (let i = 0; i < aliveOthers.length; i++) {
            for (let j = i + 1; j < aliveOthers.length; j++) {
              const a = aliveOthers[i];
              const b = aliveOthers[j];
              if (a === undefined || b === undefined) continue;
              actions.push({
                index: index++,
                event: "cupid:lovers-pick",
                description: `Link ${a} and ${b} as lovers`,
              });
            }
          }
          return actions;
        }
        case "WITCH-HEAL":
          return [
            {
              index: 0,
              event: "witch:healed-player",
              description: "Heal the night victim",
            },
            {
              index: 1,
              event: "witch:skipped-heal",
              description: "Skip heal",
            },
          ];
        case "WITCH-POISON":
          return [
            ...aliveOthers.map((name, index) => ({
              index,
              event: "witch:poisoned-player",
              description: `Poison ${name}`,
            })),
            {
              index: aliveOthers.length,
              event: "witch:skipped-poison",
              description: "Skip poison",
            },
          ];
        case "WEREWOLF":
        case "DAY-VOTE":
        case "HUNTER":
        case "SEER": {
          const event =
            input.prompt === "WEREWOLF"
              ? "werewolf:player-voted"
              : input.prompt === "DAY-VOTE"
                ? "day:player-voted"
                : input.prompt === "HUNTER"
                  ? "hunter:killed-player"
                  : "seer:picked-player";
          return aliveOthers.map((name, index) => ({
            index,
            event,
            description: `Target ${name}`,
          }));
        }
        default: {
          const _exhaustive: never = input.prompt;
          return _exhaustive;
        }
      }
    })();

    return {
      persona: input.persona,
      phase: input.prompt,
      prompt: input.prompt,
      role: "UNKNOWN",
      legalActions,
      publicMemory: ["scaffold: no live public memory yet"],
    };
  })
);

/** Registry order is public: CLI flags and MCP tool order follow this tuple. */
export const capabilities = [health, runBatch, describeDecision] as const;
