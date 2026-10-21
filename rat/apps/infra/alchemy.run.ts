/**
 * Intended Alchemy stack for Loup-Garou.
 *
 * Not executable yet: Alchemy's `Cloudflare.Worker` construction needs the
 * GameRoom Durable Object ported into `@loup/worker` first. See
 * `rat/MIGRATION.md` and `scripts/not-yet.mjs`.
 *
 * Shape we are aiming for (mirrors joelhooks/rat-stack apps/infra):
 *
 *   Alchemy.Stack("LoupGarou", {
 *     providers: Cloudflare.providers(),
 *     state: Cloudflare.state(),
 *   }, Effect.gen(function* () {
 *     const game = yield* GameWorker; // DO: GameRoom per room code
 *     return { url: game.url };
 *   }))
 *
 * Until that lands, `pnpm --filter @loup/infra plan` prints the checklist.
 */

export const stackName = "LoupGarou" as const;

export const intendedResources = [
  {
    type: "Cloudflare.Worker",
    name: "GameWorker",
    replaces: "apps/worker (wrangler.jsonc)",
  },
  {
    type: "Cloudflare.DurableObject",
    name: "GameRoom",
    note: "One instance per room code; hosts createGameRuntime",
  },
] as const;
