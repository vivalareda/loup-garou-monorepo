# Vision — Loup-Garou on rat-stack

Grow this product out of [rat-stack](https://ratstack.sh): one typed program for
the game cloud (Alchemy → Cloudflare) and one capability contract for every
agent surface (CLI + MCP).

## Why

- Agents need MCP tools and humans need a CLI; rat-stack projects both from one
  handler.
- The live game already targets Cloudflare Workers (`apps/worker`); Alchemy
  should own that deploy graph instead of wrangler.
- The multi-persona harness should drive real games many times and surface
  anomalies — not mock only the segment loop.

## Boundaries

- **`rat/`** is the Effect 4 + Alchemy workspace. It does not share Effect with
  the legacy `apps/server` (Effect 3) tree.
- **Mobile / dashboard** stay as clients of the Worker WebSocket protocol; they
  are not Foldkit apps.
- **Capability handlers** stay thin; game logic lives behind `GameHarness` (and
  later the ported `createGameRuntime`).

## Outcomes

1. `pnpm --filter @loup/cli cli health` and `… mcp` share `health` / `runBatch` /
   `describeDecision`.
2. `GameHarness` runs live sockets against a room and returns batch anomaly
   reports.
3. Alchemy deploys the GameRoom Worker; wrangler deploy is deleted.
