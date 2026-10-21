import { Context, Effect, Layer } from "effect";

export type AnomalyData = {
  readonly kind:
    | "action-error"
    | "stall"
    | "crash"
    | "no-winner"
    | "join-rejected"
    | "unexpected-disconnect"
    | "invalid-decision"
    | "timeout";
  readonly message: string;
  readonly persona?: string;
};

export type GameReportData = {
  readonly gameIndex: number;
  readonly seed: number;
  readonly winner: "villagers" | "werewolves" | null;
  readonly ok: boolean;
  readonly decisions: number;
  readonly durationMs: number;
  readonly anomalies: ReadonlyArray<AnomalyData>;
  readonly personas: ReadonlyArray<{
    readonly name: string;
    readonly role: string | null;
  }>;
};

export type BatchReportData = {
  readonly gamesRequested: number;
  readonly gamesCompleted: number;
  readonly gamesOk: number;
  readonly gamesFailed: number;
  readonly durationMs: number;
  readonly games: ReadonlyArray<GameReportData>;
};

export type RunBatchInput = {
  readonly games: number;
  readonly playerCount: number;
  readonly seed: number;
  readonly policy: "persona" | "random";
  readonly serverUrl: string | undefined;
  readonly roomCode: string | undefined;
};

/**
 * Port for driving real games. The first adapter is a deterministic stub so
 * CLI/MCP surfaces work before the live WebSocket driver is ported from
 * `apps/server` / `apps/worker`.
 */
export class GameHarness extends Context.Service<
  GameHarness,
  {
    readonly runBatch: (
      input: RunBatchInput
    ) => Effect.Effect<BatchReportData>;
  }
>()("@loup/game/GameHarness", {
  make: Effect.succeed({
    runBatch: (input: RunBatchInput) =>
      Effect.succeed({
        gamesRequested: input.games,
        gamesCompleted: 0,
        gamesOk: 0,
        gamesFailed: input.games,
        durationMs: 0,
        games: Array.from({ length: input.games }, (_, gameIndex) => ({
          gameIndex,
          seed: input.seed + gameIndex,
          winner: null,
          ok: false,
          decisions: 0,
          durationMs: 0,
          anomalies: [
            {
              kind: "crash" as const,
              message:
                "GameHarness stub: wire createGameRuntime / live sockets next (see rat/MIGRATION.md)",
            },
          ],
          personas: Array.from({ length: input.playerCount }, (_, i) => ({
            name: `Agent-${i + 1}`,
            role: null,
          })),
        })),
      }),
  }),
}) {
  static readonly layer = Layer.effect(this, this.make);
}
