# worker

The game on Cloudflare Workers. One Worker serves everything from a single
origin:

- `POST /rooms` creates a private room and answers 201 `{ "code": "K7MQ3XPD" }`.
- `GET /rooms/<code>` answers 200 `{ "code" }` for a live room and 404
  otherwise, so clients can report a mistyped code before connecting.
- `GET /room/<code>` (WebSocket upgrade) goes to that room's `GameRoom`
  Durable Object. Codes are 1-64 letters, digits, `-` or `_` (what
  `roomUrl` accepts) and are upper-cased, so `abc` and `ABC` are the same
  room. A bad code gets a 400, a plain request a 426, a missing or wrong
  access token (when one is set) a 401, a code that was never created
  (or expired) a 404, and a full room a 503.
- Every other path is the built dashboard (`apps/dashboard/dist-worker`,
  built by `pnpm --filter dashboard build:worker`), including the
  narration clips under `/audio/*.mp3`.

## Rooms

A room exists once `POST /rooms` created it; there is no default room.

- **Codes** are 8 characters from `23456789ABCDEFGHJKMNPQRSTVWXYZ` (no
  0/O, 1/I/L, U), drawn from the CSPRNG: ~39 bits, short enough to read
  out ("K7MQ-3XPD"; clients ignore case, spaces and dashes) and
  unguessable without a flood of requests (rate-limit before a public
  deploy, see below). The Worker draws a code and claims it with the
  Durable Object's `create()` RPC, retrying on the (all but impossible)
  collision.
- **Why HTTP and not a "create" socket:** the creator needs the code
  back, and a socket opened with a create intent would create another
  room on every reconnect. With `POST /rooms` each call creates exactly
  one room, and everyone, creator included, then joins the same way.
- **Existence** is the one thing a room persists (a `createdAt` key in
  its Durable Object's storage): a room survives eviction while its code
  is being passed around, and a socket or lookup for any other code gets
  a 404, so an unknown code never turns into a joinable room.
- **Expiry:** when the last socket leaves, an alarm is set for 15
  minutes later. If nobody is connected then, the room is deleted (a game
  still in progress pushes the check back until it ends). A room nobody
  ever joins expires the same way.
- **Host and player count:** the earliest joined player of the lobby is
  its host (passed on to the next one if they leave). The mobile app
  shows a room's code only in its waiting room, so a room's creator
  cannot share it before joining: knowing the code is the only way in,
  hence the creator is always the first player and the host, with no
  creator credential to carry through joins and restarts. The game starts on
  its own once `requiredPlayerCount` players joined: `PLAYER_COUNT` (6)
  for a new room, changed by the host with `lobby:set-player-count`
  (4-16, never below the players already in). Setting it to the current
  headcount starts the game at once; the mobile app offers that as
  "Lancer à N joueurs". Auto-start was kept over a separate "start"
  action: the lobby, the agents and mock players all already wait for a
  full room, and one event covers both "wait for N" and "start now".

The Durable Object builds one game with `createGameRuntime`
(`apps/server/src/game-runtime.ts`, the same wiring as the Node entry) on
a `WebSocketHost` and a `DashboardNarrator`. The game code is bundled
straight from `apps/server/src` through the `@/*` path in `tsconfig.json`.

## Local development

```sh
pnpm dev:worker                # builds the dashboard, then wrangler dev on :8787
pnpm --filter worker test:run  # Workers-runtime tests, offline
pnpm --filter worker check-types
```

Open http://localhost:8787, click "+ New room" (or open
`http://localhost:8787/?room=<code>` for a room created elsewhere), then
"Play narration here" to make the tab that room's narrator. Join with the
mobile app (`EXPO_PUBLIC_BACKEND_SERVER_URL` = the Worker's URL, see
`apps/mobile/.env.example`; "Créer une partie" or type the code), mock
players, or the agent CLIs:

```sh
# A whole game of five agents in a new room (the first sets the count to 5)
SERVER_URL=http://localhost:8787 pnpm --filter server agent:game a b c d e
# One interactive agent in an existing room
SERVER_URL=http://localhost:8787 ROOM_CODE=K7MQ3XPD pnpm --filter server agent Ana
```

The dashboard's game controls (Start Game, Next Segment, mock scenarios) are
`admin:*` events, ignored unless `ENABLE_ADMIN_EVENTS` is `"true"`.

Game config comes from `vars` in `wrangler.jsonc` (read through
`process.env`, with the Node defaults). For a short test game, override
them per run or in a git-ignored `.dev.vars`:

```sh
pnpm --filter worker dev --var PLAYER_COUNT:4 --var SEGMENT_TIMEOUT_MS:5000 \
  --var ENABLE_ADMIN_EVENTS:true
```

Worker-only vars:

| Var | Default | Effect |
|-----|---------|--------|
| `ENABLE_ADMIN_EVENTS` | `"false"` | `"true"` registers the dashboard's `admin:*` / `admin:mock-*` testing tools. They let any client advance phases, inject players or change deaths, so keep them off outside local testing; off, those events are ignored. |
| `MAX_CONNECTIONS_PER_ROOM` | `"32"` | Upgrades beyond this many open sockets in one room get a 503 (players, dashboard tabs and mock players all count). |
| `ACCESS_TOKEN` | unset | When set (`wrangler secret put ACCESS_TOKEN`, or `--var` locally), `/room/<code>` and `/rooms` need `?token=<value>` and answer 401 otherwise, before any Durable Object is reached. Unset, they are open. |

Clients append the token from `EXPO_PUBLIC_ACCESS_TOKEN` (mobile),
`VITE_PUBLIC_ACCESS_TOKEN` (dashboard, at build time) or `ACCESS_TOKEN`
(agent CLI). A token compiled into the app or the dashboard bundle is a
speed bump against random scanners, not authentication: anyone with a
client build has it.

Run `pnpm --filter worker cf-typegen` after changing `wrangler.jsonc`; it
regenerates `worker-configuration.d.ts`. Hot reload drops the open sockets
(clients reconnect into a fresh game).

## Deploying (later)

Nothing has been deployed yet. With a Cloudflare account:

```sh
pnpm --filter worker exec wrangler login
pnpm --filter worker deploy    # builds the dashboard, then wrangler deploy
```

It prints the `https://loup-garou.<account>.workers.dev` URL to put in the
mobile app's `EXPO_PUBLIC_BACKEND_SERVER_URL`. To check the bundle without
an account, `pnpm turbo run build --filter=worker` builds the dashboard
(`dashboard#build:worker`) and then does a `wrangler deploy --dry-run`
into `dist/`.

### Before a public deploy

The token, the unguessable room codes and the connection cap only keep
casual traffic out. Before sharing the URL beyond friends:

- Rate-limit `/room/*` and `/rooms*`: a Cloudflare rate-limiting rule,
  or the `ratelimit` binding checked in the Worker before the Durable
  Object. Without it, room creation is unbounded (each room is one
  storage key until it expires) and codes can be guessed by brute force.
- Real authentication or per-game invites instead of one shared token.
- Origin checks for browser clients (the dashboard), so other sites
  can't open sockets from their visitors' browsers.

## Things to know

- **No hibernation.** Sockets use `accept()`, not the hibernation API: the
  game's timers keep the object awake anyway, and hibernating would lose
  the in-memory game. A finished game clears its deadlines, and when the
  last socket leaves a lobby or a finished game the room resets itself,
  so the object can be evicted (its expiry alarm wakes it later). A game in progress is kept (players have
  the 90s reconnect grace), and its timers keep the object awake.
- **Resets are safe mid-narration.** A game generation
  (`segments/game-generation.ts`, bumped on finish and reset) is checked
  by `AudioManager.playAudio` after every clip: a clip that outlives its
  game rejects with `StaleGame`, so no further clip of a sequence plays
  and the segment or resolution awaiting it stops. A pending hunter pick
  is cancelled (with its 60s timeout), and the lovers alerts skip
  themselves.
  A segment also ends only once: a repeated finish (double vote, a
  deadline racing the last action) is ignored.
- **Only rooms are persisted, not games.** A deploy (or an eviction)
  resets every live game; clients reconnect into the same room and are
  sent back to its join screen.
- **The narrator is a dashboard tab.** There are no speakers on Workers:
  the clips play in the tab that clicked "Play narration here" for that
  room. With none, clips are skipped. The dashboard joins the room in its
  URL's `?room=<code>` (its room panel creates or switches rooms by
  reloading with a new one), falling back to the build-time
  `VITE_PUBLIC_ROOM_CODE`.
