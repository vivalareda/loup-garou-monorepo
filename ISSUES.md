# Known issues — deferred, to triage

Items from the 2026-08-04 functionality audit that were deliberately NOT
fixed yet. Each entry says what is wrong, what it costs, and where to
start. Items 1–3 (dead targets in werewolf lists, silent rejections, join
flow) and 5–7, 9 (parity rule, Seer, countdowns, day discussion) from that
audit are already fixed.

## 4. No lovers win condition

Cross-team lovers (werewolf + villager, via Cupid) can never win together.
`checkIfWinner()` in `apps/server/src/core/game.ts` only knows
`villagers | werewolves`: if the last two alive are the lover couple, the
werewolf faction is declared the winner. Classic rules treat surviving
lovers as a third winning faction.

- Cost: the most romantic ending in the game is unreachable; Cupid's role
  loses its point once the couple is mixed-team.
- Fix sketch: add a `lovers` faction to `GameEndResult.winningFaction`,
  check "only the two lovers remain alive" before the parity rule, and
  render the third outcome on the mobile result screens
  (`apps/mobile/components/end-game-panel.tsx`). The `didWin` computation
  in `buildSnapshotFor` (`apps/server/src/server/server-events.ts`) also
  needs the third case.

## 8. Death screen is not a spectator view

`apps/mobile/app/(game)/death-screen.tsx` shows only "Vous êtes mort".
The game-level listeners keep feeding the stores after death (phase,
roster, night deaths, vote ties), but none of it is rendered there.

- Cost: dead players stare at a static screen for the rest of the game
  instead of following it.
- Fix sketch: render current phase, the public roster with alive/dead
  states, announced deaths, and tie results from `useGameStore` — all
  already client-safe data. No server change needed.

## 10. No auth on admin events + wide-open CORS

`apps/server/src/server/sockets.ts` uses `origin: '*'` with
`credentials: true`, and every `admin:*` / mock event in
`apps/server/src/server/server-events.ts` is callable by any connected
socket (`admin:start-game`, `admin:next-segment`, mock scenarios…).

- Cost: fine on a LAN; on any public deployment, anyone can start/derail
  games.
- Fix sketch: `plans/023-restrict-socket-cors.md` already covers CORS via
  a `CORS_ORIGIN` env var. Gate admin/mock handlers behind
  `NODE_ENV !== 'production'` or a shared admin token.

## 11. No runtime payload validation or rate limiting

Socket payloads are trusted to match their TypeScript types. Only
`player:join` validates its payload shape at runtime; other handlers
pass strings straight into game logic. There is no rate limiting on any
event.

- Cost: a malformed or hostile client can throw inside handlers or spam
  events; TypeScript types do not validate network input.
- Fix sketch: small runtime guards (typeof checks or zod at the socket
  boundary in `server-events.ts`), plus a per-socket event budget. Also
  add a top-level error boundary so one throwing handler cannot crash the
  process.

## 12. Audio only works on macOS/Windows servers + intro TODO

`apps/server/src/segments/audio-manager.ts` plays audio through
`sound-play`, which shells out to `afplay` (macOS) / PowerShell
(Windows). On Linux, nothing plays. The intro audio is still a TODO in
`apps/server/src/segments/segments-manager.ts` (`startGame`). The
`Seer/Seer-wake-up`, `Seer/Seer-end` assets referenced by the new Seer
segment do not exist yet — missing assets are skipped silently.

- Cost: a Linux deployment is silent; the game still works (audio
  failures never block progression).
- Fix sketch: swap `sound-play` for a player with Linux support (or make
  audio a client-side concern), record/add the missing Seer and intro
  assets, and re-run the audio-sequence simulations
  (`apps/server/src/__tests__/simulation/`).
