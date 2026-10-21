import { defineContract } from "@rat-stack/capability";
import { Schema } from "effect";

/** Shared schemas for the multi-persona gameplay harness. */

export const PersonaName = Schema.String.annotate({
  description: "Display name for one bot seat in the room",
});

export const RoomCode = Schema.String.annotate({
  description: "Room code (Worker); ignored by the Node single-game server",
});

export class GameError extends Schema.TaggedError<GameError>()("GameError", {
  message: Schema.String,
}) {}

export const Anomaly = Schema.Struct({
  kind: Schema.Literals([
    "action-error",
    "stall",
    "crash",
    "no-winner",
    "join-rejected",
    "unexpected-disconnect",
    "invalid-decision",
    "timeout",
  ]),
  message: Schema.String,
  persona: Schema.optional(Schema.String),
});

export const GameReport = Schema.Struct({
  gameIndex: Schema.Int,
  seed: Schema.Int,
  winner: Schema.NullOr(Schema.Literals(["villagers", "werewolves"])),
  ok: Schema.Boolean,
  decisions: Schema.Int,
  durationMs: Schema.Int,
  anomalies: Schema.Array(Anomaly),
  personas: Schema.Array(
    Schema.Struct({
      name: Schema.String,
      role: Schema.NullOr(Schema.String),
    })
  ),
});

export const BatchReport = Schema.Struct({
  gamesRequested: Schema.Int,
  gamesCompleted: Schema.Int,
  gamesOk: Schema.Int,
  gamesFailed: Schema.Int,
  durationMs: Schema.Int,
  games: Schema.Array(GameReport),
});

export const PendingPromptKind = Schema.Literals([
  "CUPID",
  "LOVERS",
  "SEER",
  "WEREWOLF",
  "WITCH-HEAL",
  "WITCH-POISON",
  "DAY-VOTE",
  "HUNTER",
]);

export const LegalAction = Schema.Struct({
  index: Schema.Int,
  event: Schema.String,
  description: Schema.String,
});

export const DecisionView = Schema.Struct({
  persona: PersonaName,
  phase: Schema.String,
  prompt: PendingPromptKind,
  role: Schema.String,
  legalActions: Schema.Array(LegalAction),
  publicMemory: Schema.Array(Schema.String),
});

export const healthContract = defineContract("health", {
  annotations: { idempotent: true, readOnly: true },
  description: "Loup-Garou rat-stack scaffold health check",
  failure: Schema.Never,
  input: Schema.Struct({}),
  output: Schema.Struct({
    ok: Schema.Boolean,
    workspace: Schema.Literals(["loup-rat"]),
    next: Schema.String,
  }),
});

export const runBatchContract = defineContract("runBatch", {
  annotations: { destructive: false, openWorld: true },
  description:
    "Play N full games with one brain embodying every persona; return anomaly reports for bug hunting",
  failure: GameError,
  input: Schema.Struct({
    games: Schema.Int.check(
      Schema.isBetween({ minimum: 1, maximum: 100 })
    ).annotate({ description: "How many games to run (1–100)" }),
    playerCount: Schema.optional(
      Schema.Int.check(Schema.isBetween({ minimum: 4, maximum: 12 })).annotate({
        description: "Seats per game (default 6)",
      })
    ),
    seed: Schema.optional(
      Schema.Int.annotate({
        description: "Base RNG seed; game i uses seed+i",
      })
    ),
    policy: Schema.optional(
      Schema.Literals(["persona", "random"]).annotate({
        description: "Decision policy while the live socket driver is stubbed",
      })
    ),
    serverUrl: Schema.optional(
      Schema.String.annotate({
        description:
          "Existing server URL; omit to use the in-process stub (not yet wired to apps/server)",
      })
    ),
    roomCode: Schema.optional(RoomCode),
  }),
  output: BatchReport,
});

export const describeDecisionContract = defineContract("describeDecision", {
  annotations: { idempotent: true, readOnly: true },
  description:
    "Return the legal-action menu a model would see for a sample persona prompt (scaffold for MCP play)",
  failure: GameError,
  input: Schema.Struct({
    persona: PersonaName,
    prompt: PendingPromptKind,
    aliveOthers: Schema.Array(PersonaName).annotate({
      description: "Other living players by display name",
    }),
  }),
  output: DecisionView,
});
