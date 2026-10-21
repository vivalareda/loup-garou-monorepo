# Migration plan: legacy monorepo → `rat/`

Branch: `cursor/ratstack-migration-fc62`  
Upstream capability pin: `joelhooks/rat-stack@9ecc954af2d73527b1d6e120763cea7feb57a6df`

## Keep (for now)

| Path | Role |
|------|------|
| `apps/server` | Live Node game + tests (Effect 3) |
| `apps/worker` | Live wrangler Worker until Alchemy replaces it |
| `apps/mobile` / `apps/dashboard` | Clients |
| `packages/types` / `packages/realtime` | Wire protocol + WS client |

## New (`rat/`)

| Path | Role |
|------|------|
| `packages/capability` | Vendored `@rat-stack/capability` (CLI/MCP projections) |
| `packages/game` | Game harness contracts + stub `GameHarness` |
| `apps/cli` | `loup` CLI + `loup mcp` |
| `apps/worker` | Alchemy Worker stub |
| `apps/infra` | Alchemy stack stub (plan/deploy gated) |

## Ordered work

1. **Scaffold (this PR)** — capability vendor, stub capabilities, CLI/MCP, docs.
2. **Live `GameHarness` adapter** — boot ephemeral server or talk to Worker via
   `@repo/realtime`; persona/random policies; batch anomaly JSON.
3. **Port `GameRoom`** — move `createGameRuntime` into `@loup/worker` under
   Effect 4 boundaries (or keep a thin adapter calling the existing bundle).
4. **Alchemy deploy** — declare Worker + DO in `alchemy.run.ts`; cut wrangler.
5. **Retire** — delete dead Effect scaffolding in `apps/server`, then eventually
   fold remaining Node entry into `rat/` or keep Node as a Layer for local dev.

## Cut from rat-stack (not vendored)

Per [keep-or-cut](https://ratstack.sh/skills/keep-or-cut): lore, Foldkit web,
interest signup, learn mode, code-mode sandbox, CAFE, auth, database. Re-add
only as cartridges if needed.

## Commands

```sh
cd rat
pnpm install
pnpm check
pnpm --filter @loup/cli cli health
pnpm --filter @loup/cli cli runBatch --games 3
pnpm --filter @loup/cli mcp   # stdio MCP for Cursor / Claude
```

Cursor MCP example (`~/.cursor/mcp.json`):

```json
{
  "mcpServers": {
    "loup-garou": {
      "command": "pnpm",
      "args": ["--filter", "@loup/cli", "mcp"],
      "cwd": "/absolute/path/to/repo/rat"
    }
  }
}
```
