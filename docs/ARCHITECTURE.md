# GemmaKaizo Runtime Architecture

This document describes the current implementation, not a future roadmap.

## Runtime shape

```text
Browser
  ├─ Canvas game loop (GameEngine, physics, level, entities)
  ├─ TelemetryRecorder
  ├─ OverseerTerminal (HUD and persisted request feed)
  └─ AutonomousPlayerBot (optional local controller)
          │
          ├─ POST /api/mutate  ──> GemmaArchitectService
          │                         └─ LevelPatcher
          └─ POST /api/decision ─> PlayerDecisionService

Express + Vite (`server/server.ts`)
  └─ static/development frontend and JSON API
```

The browser owns the 60 FPS simulation and applies accepted mutations to the
live `Level`. The server does not run the game loop; it analyzes telemetry,
validates level patches, and returns JSON.

## Gemma request lifecycle

1. `GameEngine.handlePlayerDeath()` records the death and starts one mutation
   request. A request already in flight is coalesced rather than duplicated.
2. The client sends `telemetry` plus a serializable `currentLevel` to
   `POST /api/mutate`.
3. `GemmaArchitectService` builds a structured prompt and tries providers in
   this order:
   - Google API: `gemma-4-26b-a4b-it`, then `gemini-2.5-flash`
   - OpenRouter: `google/gemma-4-26b-a4b-it`
   - deterministic local heuristic response
4. Model output is parsed as JSON and mutation types/coordinates are
   sanitized.
5. `LevelPatcher.applyMutations()` clones the supplied map, accepts only safe
   patches, and returns `accepted` and `rejected` mutations.
6. The browser applies accepted mutations to tiles, coins, and entities.
   `activeMutations` are rebuilt after respawn so accepted hazards persist.
7. The Overseer UI displays the response and stores up to 12 raw request or
   response entries in `localStorage` under
   `gemmakaizo-request-feed`.

The optional `POST /api/decision` path supplies bot advice. The local reflex
controller still owns movement; remote decision responses do not directly
drive player input.

## Telemetry contract

`TelemetryRecorder.exportPayload()` sends:

| Field | Meaning |
|---|---|
| `totalRuns` | Runs started, including checkpoint respawns |
| `totalDeaths` | Lifetime deaths since reset |
| `furthestX` | Furthest player position in pixels |
| `averageSpeed` | Rolling sampled horizontal speed |
| `sprintRatio` | Fraction of sampled ticks with sprint held |
| `hesitationTimeSec` | Time moving slowly beside an upcoming gap |
| `jumpCount` | Recorded jump releases |
| `jumpHoldAvgSec` | Average jump hold duration |
| `edgeJumpDistanceAvg` | Average distance from a detected ledge at jump |
| `panicJitterRate` | Direction-change rate, capped at `1.0` |
| `coinsCollected` | Coins collected in the current telemetry lifetime |
| `recentDeaths` | Last five `{ x, y, cause, timestamp }` records |
| `currentDifficulty` | Current displayed difficulty/brutality index |

Telemetry is sampled during gameplay and sent on death. The UI also receives
periodic local snapshots for the live telemetry stream.

## Mutation validation

`LevelPatcher` rejects patches outside the map, the spawn zone, or the flag
zone. It also requires:

- `KAIZO_BLOCK`: empty space with vertical clearance
- `CRUMBLING_FLOOR` and `BOUNCE_TRAP`: exposed solid floor
- `CEILING_SPIKE` / `FALLING_SPIKE`: empty space attached to a ceiling
- `DECEPTIVE_COIN`: empty space
- `ENEMY_AMBUSH`: empty space immediately above solid ground

The client performs a second integer coordinate and bounds check before
applying returned mutations. Unsupported or rejected patches are not counted
as applied mutations. These guards preserve map integrity, but they are not a
formal solvability proof.

## Demo and validation commands

From the repository root:

```bash
npm install
npm run build
npm run hackathon-boot   # production demo: http://127.0.0.1:3001
npm run hackathon-refresh # rebuild dist/ without restarting the demo
npm test
npx tsc --noEmit
```

`npm run dev` serves source files with Vite/HMR on port 3001. The production
server serves `dist/`; source edits therefore require `npm run hackathon-refresh`
followed by a browser refresh. `npm run server` uses `PORT` when set and
otherwise defaults to 3001. Check runtime status with:

```bash
curl http://127.0.0.1:3001/api/health
```

The presentation page is available at `/presentation.html` after a dev server
or production build.

## Integration points

- **Frontend:** `src/main.ts`, `src/game/engine.ts`, `src/game/level.ts`,
  `src/game/telemetry.ts`, `src/ui/overseer.ts`
- **Backend:** `server/server.ts`, `server/gemmaService.ts`,
  `server/levelPatcher.ts`, `server/decisionService.ts`
- **Runtime APIs:** `GET /api/health`, `POST /api/mutate`,
  `POST /api/decision`
- **Provider configuration:** `GEMINI_API_KEY` or `GOOGLE_API_KEY`;
  optional `OPENROUTER_API_KEY`; optional `PORT`
- **Persistent browser diagnostic state:** localStorage key
  `gemmakaizo-request-feed`

## Known limitations

- The current game contains one level; the flag ends that level.
- Google/OpenRouter availability, quotas, latency, and model output are
  external dependencies. The heuristic fallback keeps mutation requests
  functional but is not a remote Gemma response.
- The request feed records mutation traffic, not every decision request.
- The ghost overlay is a visual clearance estimate, not collision-tested route
  verification.
- The bot's remote advice does not control movement.
- The demo server enables unrestricted CORS and accepts broad JSON payloads;
  this setup is intended for local/demo use, not production exposure.
