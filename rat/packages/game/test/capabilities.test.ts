import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";

import { describeDecision, health, runBatch } from "../src/capabilities.js";
import { GameHarness } from "../src/game-harness.js";

const TestLayer = GameHarness.layer;

describe("game capabilities", () => {
  it.layer(TestLayer)("stubs", (test) => {
    test.effect("health reports the loup-rat workspace", () =>
      Effect.gen(function* check() {
        const result = yield* health.handler({});
        expect(result.ok).toBe(true);
        expect(result.workspace).toBe("loup-rat");
      })
    );

    test.effect(
      "runBatch returns stub anomalies until the live driver lands",
      () =>
        Effect.gen(function* batch() {
          const report = yield* runBatch.handler({ games: 2 });
          expect(report.gamesRequested).toBe(2);
          expect(report.gamesFailed).toBe(2);
          expect(report.games[0]?.anomalies[0]?.kind).toBe("crash");
        })
    );

    test.effect("describeDecision builds a werewolf vote menu", () =>
      Effect.gen(function* menu() {
        const view = yield* describeDecision.handler({
          persona: "Ana",
          prompt: "WEREWOLF",
          aliveOthers: ["Bob", "Cara"],
        });
        expect(view.legalActions).toHaveLength(2);
        expect(view.legalActions[0]?.event).toBe("werewolf:player-voted");
      })
    );
  });
});
