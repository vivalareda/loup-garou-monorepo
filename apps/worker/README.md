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

The infrastructure is declared in TypeScript with
[Alchemy](https://alchemy.run) in `alchemy.run.ts`: the Worker, its
`GameRoom` Durable Object namespace, the dashboard assets, the vars and
the `ACCESS_TOKEN` secret. There is no wrangler config.

The Durable Object builds one game with `createGameRuntime`
(`apps/server/src/game-runtime.ts`, the same wiring as the Node entry) on
a `WebSocketHost` and a `DashboardNarrator`. The game code is bundled
straight from `apps/server/src` through the `@/*` path in `tsconfig.json`.

## Local development

```sh
pnpm dev:worker                # builds the dashboard, then alchemy dev on :8787
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

`alchemy dev` runs the Worker in a local workerd, with no Cloudflare
account and no cloud calls. Its state (and the local Durable Object
storage) goes to the git-ignored `.alchemy/`. Source edits hot reload
(dropping the open sockets: clients reconnect into a fresh game). To
reach it from a phone on the LAN, bind it to every interface:
`DEV_HOST=0.0.0.0 pnpm --filter worker dev`.

Game config comes from `vars` in `settings.ts` (read through
`process.env`, with the Node defaults). For a short test game, override
them for `alchemy dev` from the shell or a git-ignored `.env` (see
`.env.example`). A deploy ignores these overrides and always binds the
values in `settings.ts`:

```sh
PLAYER_COUNT=4 SEGMENT_TIMEOUT_MS=5000 ENABLE_ADMIN_EVENTS=true \
  pnpm --filter worker dev
```

To make another server env var overridable, add it to `vars`.

Worker-only vars:

| Var | Default | Effect |
|-----|---------|--------|
| `ENABLE_ADMIN_EVENTS` | `"false"` | `"true"` registers the dashboard's `admin:*` / `admin:mock-*` testing tools. They let any client advance phases, inject players or change deaths, so keep them off outside local testing; off, those events are ignored. |
| `MAX_CONNECTIONS_PER_ROOM` | `"32"` | Upgrades beyond this many open sockets in one room get a 503 (players, dashboard tabs and mock players all count). |
| `ACCESS_TOKEN` | unset | When set in the shell or `.env` of whoever runs `alchemy deploy` (or `alchemy dev`), it is bound as a secret and `/room/<code>` and `/rooms` need `?token=<value>`, answering 401 otherwise, before any Durable Object is reached. Unset, they are open. Every deploy rebinds it, so set it on every deploy. |

Clients append the token from `EXPO_PUBLIC_ACCESS_TOKEN` (mobile),
`VITE_PUBLIC_ACCESS_TOKEN` (dashboard, at build time) or `ACCESS_TOKEN`
(agent CLI). A token compiled into the app or the dashboard bundle is a
speed bump against random scanners, not authentication: anyone with a
client build has it.

`Env` is inferred from the Worker's `env` in `alchemy.run.ts` (see
`env.d.ts`), so there is no type generation step. The tests don't go
through Alchemy: `vitest.config.ts` gives the pool the same compatibility
date and vars (from `settings.ts`) and the `GameRoom` namespace as
miniflare options.

### Why Alchemy 2 (beta)

`alchemy@2.0.0-beta.83` is pinned exactly. It is npm's `latest` and what
alchemy.run documents, and rat-stack pins the same release. The 0.x line
(v1, async/await) is legacy now, and its state doesn't carry over to v2,
so starting there would mean a migration later. v2 is an Effect program,
so the worker has its own `effect` (4.0.5, the minimum Alchemy's
dependencies accept) and `@effect/platform-node`; the server keeps its
own `effect`. The Worker code itself stays a plain `fetch` handler and
Durable Object class (Alchemy's "async Worker"). Being a beta, bump it
deliberately and read the release notes.

## Deploying (later)

Nothing has been deployed yet. What you need:

- **Cloudflare credentials.** Locally, `pnpm --filter worker exec alchemy
  profile edit --add Cloudflare` once (OAuth or a pasted API token, saved
  in `~/.alchemy/profiles.json`; no `wrangler login`). In CI, set
  `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` instead.
- **`ACCESS_TOKEN`** (optional), in the shell or `apps/worker/.env`.
- **Nothing else.** Alchemy 2 has no `ALCHEMY_PASSWORD`. Secrets are
  bound as Worker secrets, but the local state keeps their values in
  plain JSON, so treat `.alchemy/` as a secret (it is git-ignored;
  `Cloudflare.state()` encrypts state at rest).

```sh
pnpm --filter worker deploy    # builds the dashboard, then alchemy deploy --stage prod
pnpm --filter worker destroy   # deletes the Worker and its Durable Objects
```

It prints the `https://loup-garou.<account>.workers.dev` URL (the Worker's
name is pinned to `loup-garou`) to put in the mobile app's
`EXPO_PUBLIC_BACKEND_SERVER_URL`.

**State.** Alchemy records what it deployed in `apps/worker/.alchemy/`
(local state, git-ignored), so deploy from one machine. If it is lost,
`alchemy deploy --stage prod --adopt` takes the existing `loup-garou`
Worker back over by name, rooms and all. To deploy from CI or several
machines, switch the stack's `state` to `Cloudflare.state()` (a state
store Worker Alchemy creates on the account the first time), see
https://alchemy.run/state-store.

**Durable Objects.** Alchemy declares the `GameRoom` namespace through
Cloudflare's `exports` map, not wrangler's `migrations` list, and creates
new classes SQLite-backed (what the wrangler config's `v1` migration
did). A Worker deployed with `exports` can't go back to `migrations`, and
keeping the class name `GameRoom` keeps its namespace and data.

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
