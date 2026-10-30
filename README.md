# GemmaKaizo: AI-Powered Adaptive Rage Platformer
> **GrizzHacks 2026 / Hacktoberfest Project**  
> **Track:** Best Use of Gemma 4 (Google Generative AI)
> **Repository:** `girzzhacks_hacktober_alt`  
> **Protagonist:** An original moonlit steamboat deckhand

[![Gemma 4](https://img.shields.io/badge/AI%20Model-Gemma%204%2026B-purple.svg)](https://ai.google.dev/)
[![Moonlit Steamboat](https://img.shields.io/badge/Setting-Moonlit%20Steamboat-black.svg)](#)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 📜 Alterations to Core Rule Set (Documented)

To transform the classic 1985 platformer paradigm into an intelligent, legally distinct, and competitive AI hackathon project, **5 fundamental rule alterations** have been implemented and documented:

| # | Alteration | Traditional Rule | GemmaKaizo Rule | Purpose |
|---|---|---|---|---|
| **1** | **Original Deckhand Silhouette** | Familiar platformer mascots | **Moonlit steamboat deckhand** | Uses an original brass-and-navy mechanical silhouette, with nautical materials and steam-lantern idle cues. |
| **2** | **Dynamic Kaizo Architecture** | Static, pre-designed level layouts | **Gemma 4 Adaptive Mutations** | After each player death, the server sends behavioral telemetry to the Gemma architect and applies validated targeted mutations such as Kaizo blocks, crumbling floors, and spikes. |
| **3** | **5 Consecutive Deaths Game Over** | Arbitrary 3 lives with world reset | **Streak-Based Game Over (5 Deaths)** | Losing 5 times consecutively triggers the Gemma 4 Game Over screen, displaying run statistics, mutations deployed, and offering Continue vs Full Reset. |
| **4** | **Estimated Clearance Guidance** | Arbitrary impossible "troll" traps | **Model-assisted route estimate** | Press `G` to view a visual clearance estimate while server-side guards reject invalid mutation coordinates and unsupported hazards. |
| **5** | **Optional Player Advice** | Human-only controller input | **Local reflex bot with remote advice** | The `B` toggle demonstrates a local 60 FPS reflex controller; remote decision responses are telemetry/advice and do not directly drive movement. |

---

## 🎞️ Visual direction

The presentation intentionally embraces a Steamboat Willie-era black-and-white
riverboat language: high-contrast ink silhouettes, silver-screen contrast,
smoke, deck planks, and moonlit water. Halloween dressing is original
procedural canvas art built from primitives (ghosts, bats, pumpkins, bones, and
skeleton silhouettes). It uses public-domain motifs rather than modern
copyrighted character designs, and the audio uses original procedural cues
instead of sampled or reproduced melodies.

## 🎮 What is GemmaKaizo?

**GemmaKaizo** is a retro 16-bit precision platformer inspired by kaizo-style challenge games and managed by an adversarial AI Game Master.

Powered by **Gemma 4** (`gemma-4-26b-a4b-it`) via the Google Generative Language API, the AI audits granular behavioral telemetry after each player death. It identifies player archetypes—such as *The Impatient Rusher*, *The Floaty Dreamer*, *The Paralyzed Hesitator*, or *The Greedy Coin Goblin*—and injects targeted Kaizo obstacles right where the player's comfort zones lie.

---

## 🧠 Dual-AI Architecture

```
                       ┌────────────────────────┐
                       │   Human Player (WASD)  │
                       │           OR           │
                       │  Local Reflex Bot      │
                       └───────────┬────────────┘
                                   │ Real-time Inputs
                                   ▼
                       ┌────────────────────────┐
                       │  HTML5 Canvas Platform │
                       │    (60 FPS Engine)     │
                       └───────────┬────────────┘
                                   │
              ┌────────────────────┴────────────────────┐
              │                                         │
              ▼                                         ▼
   ┌──────────────────────┐                  ┌──────────────────────┐
   │ Real-Time Telemetry  │                     │  Optional Remote Advice│
   │  * Average Speed     │                  │  * OpenRouter Free   │
   │  * Sprint Ratio      │                  │  * Gemma 4 Reflex    │
   │  * Hesitation Time   │                  │  * Lookahead Planner │
   │  * Jump Hold Avg     │                  └──────────────────────┘
   │  * Edge Jump Margin  │
   │  * Panic Jitter APM  │
   │  * Death Coordinates │
   └──────────┬───────────┘
              │ (Upon Death / Checkpoint)
              ▼
   ┌────────────────────────────────────────────────────┐
   │            Gemma 4 Kaizo Architect                 │
   │   (models/gemma-4-26b-a4b-it via Google AI Studio) │
   ├────────────────────────────────────────────────────┤
   │ 1. Archetype Classification                        │
   │ 2. Clinical Motor Diagnosis                        │
   │ 3. Sarcastic Real-Time Taunt                       │
   │ 4. Adaptive Mutation Injection (Kaizo blocks, etc) │
   │ 5. Clearance estimate and mutation validation      │
   └────────────────────────────────────────────────────┘
```

---

## ✨ Key Features

1. **Gemma 4 Kaizo Architect**:
   - Analyzes run telemetry and writes custom JSON patches to the level.
   - Deploys:
     - **Kaizo Blocks**: Invisible solid blocks that bonk the player mid-air into pits.
     - **Crumbling Floors**: Solid stone that collapses under sprinting momentum or hesitation.
     - **Ceiling Spikes**: Punishes excessive high-float jumps.
     - **Falling Spikes**: Triggers drop when player is near.
     - **Deceptive Bait Coins**: Lures greedy players into hazard arcs.
     - **Ambush Enemies**: Fast-moving patrol units.
2. **Original Moonlit Deckhand**:
   - Procedural brass-and-navy deckhand silhouette with a steam-lantern idle puff and nautical materials.
3. **Streak-Based Game Over System**:
   - 5 consecutive deaths triggers the Gemma 4 Game Over screen.
4. **Optional Player Bot**:
   - Built-in local reflex controller can play the level autonomously.
   - Remote decision requests provide periodic advice/telemetry; the local controller remains responsible for movement.
5. **Death Heatmap Overlay**:
   - Visual skull markers and radial glow displaying the exact death density across the stage.
6. **Estimated Clearance Path**:
   - Real-time parabolic guidance overlay; it is an estimate, not a collision-tested solvability proof.
7. **Procedural 8-Bit Audio Synth**:
   - 100% Web Audio API procedural synthesis (jump, stomp, bonk, death jingle, victory fanfare, and dark Kaizo bassline BGM). Zero missing audio files!
8. **Provider Fallback Mode**:
   - When the backend can reach the provider but Google Gemma is unavailable, the service tries Gemini, then OpenRouter, then its deterministic heuristic engine.
   - A completely unavailable backend is reported in the request feed rather than presented as a successful model response.

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ or Node.js 22+
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` (configured locally in `~/.bashrc` or `.env`)
- (Optional) `OPENROUTER_API_KEY` for free player decision bot

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/ldameron1/girzzhacks_hacktober_alt.git
cd girzzhacks_hacktober_alt

# Install dependencies
npm install

# Start development server (source changes refresh through Vite on port 3001)
npm run dev
```

For the stable production demo, build the browser assets and boot the server:

```bash
npm run build
npm run hackathon-boot
```

The demo stays on **port 3001**. `hackathon-boot` is idempotent: if that port
already answers `/api/health`, it exits without restarting the existing server.
The production server serves `dist/`, not live TypeScript source. After editing
source files while the production demo is running, run:

```bash
npm run hackathon-refresh
```

That rebuilds `dist/` and deliberately leaves the server running; refresh the
browser afterward. Use `npm run dev` instead when you want Vite source/HMR
refresh during development.

The adaptive architect calls Gemma 4 first through the Google Generative Language
API (trying Gemini 2.5 Flash if the Gemma request fails), then falls back to
OpenRouter and finally the deterministic offline engine when a provider is
unavailable. The request feed exposes which path handled each mutation, so the
demo does not overclaim model activity.

Open your browser to: **`http://127.0.0.1:3001`**

Presenter notes are available at
**`http://127.0.0.1:3001/presentation.html`**.

## 🔌 Real Gemma integration path

The implemented mutation path is:

1. A client death records telemetry (movement, jumps, hesitation, deaths, and
   recent death coordinates) in `TelemetryRecorder`.
2. `GameEngine` sends that payload and a serializable level snapshot to
   `POST /api/mutate` (with one retry if the request fails).
3. `GemmaArchitectService` tries Google Gemma, Google Gemini, OpenRouter, then
   its deterministic heuristic response. Provider text is parsed as JSON,
   mutation types are allow-listed, and coordinates are clamped.
4. `LevelPatcher` validates each mutation against map bounds, spawn/goal
   protection, and the required floor/ceiling/air conditions. The response
   contains accepted mutations, rejected mutations, and `patchedLevel`.
5. The client displays provider, latency, diagnosis, taunt, fairness estimate,
   and accepted/rejected counts in the Overseer UI. It then applies accepted
   descriptors to the live level and rebuilds persistent dynamic entities after
   respawn.

The optional `/api/decision` endpoint is separate: its response is advice for
the local reflex bot and does not directly control player movement. There is no
MCP transport or direct remote-control path in this integration.

---

## 🕹️ Controls

| Key | Action |
|---|---|
| **A / D** or **◄ / ►** | Move Left / Right |
| **Space** or **W** / **Z** | Jump / Wall-Kick (Hold for higher jump) |
| **Shift** or **X** | Sprint / Dash |
| **B** | Toggle Local Reflex Player Bot |
| **H** | Toggle Death Heatmap Overlay |
| **G** | Toggle Speedrunner Ghost Path |

---

## 🧪 Testing

Run the automated physics and mutation safety test suite:

```bash
npm test
```

---

## 🏆 Hackathon Context

- **Event:** GrizzHacks (Oakland University) / Hacktoberfest 2026
- **Track:** Best Use of Gemma 4
- **API Model:** `models/gemma-4-26b-a4b-it` (Google Generative AI)
- **Author:** `ldameron1`
