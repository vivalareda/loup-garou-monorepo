# Plan 029: Rat-stack migration scaffold (CLI + MCP + Alchemy path)

## Status

- **Priority**: P2 (infra / agent harness)
- **Category**: migration scaffold
- **Branch**: `cursor/ratstack-migration-fc62`

## Why

Full rat-stack adoption is easier as a **new Effect 4 base** under `rat/` than
retrofitting Effect 3 + wrangler in place. Agents get MCP + CLI from one
capability registry; Cloudflare deploy moves to Alchemy when the Worker is
ported.

## In scope (this change)

- Vendor `@rat-stack/capability` under `rat/packages/capability`
- Stub `@loup/game` capabilities: `health`, `runBatch`, `describeDecision`
- Slim `@loup/cli` projecting those to CLI + stdio MCP
- Stub `@loup/worker` + `@loup/infra` (Alchemy gated)
- `rat/VISION.md`, `rat/MIGRATION.md`, root README pointer

## Out of scope (follow-ups)

- Live `GameHarness` WebSocket driver
- Porting `GameRoom` / `createGameRuntime` into Alchemy
- Deleting wrangler or Effect-3 server code

## Verify

```sh
cd rat && pnpm install && pnpm check
pnpm --filter @loup/cli cli health
pnpm --filter @loup/game test
```
