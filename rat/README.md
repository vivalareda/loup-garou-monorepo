# `rat/` — Loup-Garou rat-stack workspace

Isolated Effect **4** + Alchemy workspace for the agent harness and the future
Cloudflare deploy path. The legacy game under `apps/server` / `apps/worker`
keeps running on Effect 3 + wrangler until the port in `MIGRATION.md` lands.

## Layout

```
rat/
  packages/capability   # vendored from joelhooks/rat-stack (see PROVENANCE.md)
  packages/game         # health / runBatch / describeDecision capabilities
  apps/cli              # loup CLI + MCP (stdio)
  apps/worker           # Alchemy Worker stub
  apps/infra            # Alchemy stack stub
```

## Quick start

```sh
cd rat
pnpm install
pnpm check
pnpm --filter @loup/cli cli health
pnpm --filter @loup/cli cli describeDecision --persona Ana --prompt WEREWOLF \
  --aliveOthers '["Bob","Cara"]'
```

`runBatch` currently returns structured stub anomalies until `GameHarness` is
wired to live sockets.

## Docs

- `VISION.md` — product boundaries
- `MIGRATION.md` — ordered cutover from the legacy tree
- https://ratstack.sh — capability / Alchemy reference
