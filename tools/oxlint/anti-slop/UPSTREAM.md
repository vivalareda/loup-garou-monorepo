# anti-slop (vendored)

- Source: https://github.com/dmmulroy/anti-slop, `skills/install-anti-slop/assets/anti-slop`
- Commit: `13909c9e07590f5a85d93c62712259fe14a883f7` (upstream HEAD on 2026-10-21; the copied
  assets were diffed against a fresh clone of that commit and are byte-identical)
- Installed with: `npx skills add dmmulroy/anti-slop --skill install-anti-slop`, then
  `node .agents/skills/install-anti-slop/scripts/install.mjs`
- Plugin entry points (registered in the root `.oxlintrc.json`):
  - `tools/oxlint/anti-slop/index.ts` (generic rules)
  - `tools/oxlint/anti-slop/effect/index.ts` (Effect rules; `effect` is a direct dependency of `apps/server`)
- Peer packages: `oxlint` and `@oxlint/plugins`, both pinned to `1.89.0` at the root.
- Intentional deviations from upstream: added `package.json` (`"type": "module"`) so Node loads the
  TypeScript entry points as ESM without a reparse warning; rule files are unchanged. All generic and Effect rules are enabled at `error`.
  Upgrade via the skill's `references/update.md` procedure, not by re-copying over these files.
