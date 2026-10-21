#!/usr/bin/env node
const action = process.argv[2] ?? "plan";
console.error(`@loup/infra: alchemy ${action} is not wired yet.

Intended next steps (rat/MIGRATION.md):
  1. Port apps/worker GameRoom into @loup/worker as a Cloudflare.Worker + DO
  2. Declare the Worker in alchemy.run.ts (Alchemy.Stack + Cloudflare.providers)
  3. Replace \`pnpm --filter worker deploy\` with \`pnpm --filter @loup/infra deploy\`

Until then the live game still deploys via wrangler in apps/worker.
`);
process.exit(action === "plan" ? 0 : 1);
