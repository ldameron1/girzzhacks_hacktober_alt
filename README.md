# GemmaKaizo: AI-Powered Adaptive Rage Platformer
> **GrizzHacks 2026 / Hacktoberfest Project**  
> **Track:** Best Use of Gemma 4 (Google Generative AI) & OpenRouter Free Decision Agent  
> **Repository:** `girzzhacks_hacktober_alt`

[![Gemma 4](https://img.shields.io/badge/AI%20Model-Gemma%204%2026B-purple.svg)](https://ai.google.dev/)
[![TypeScript](https://img.shields.io/badge/Language-TypeScript-blue.svg)](https://www.typescriptlang.org/)
[![License](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)

---

## 🎮 What is GemmaKaizo?

**GemmaKaizo** is a retro 16-bit precision platformer inspired by Kaizo Mario and "rage games" (like *I Wanna Be The Guy*, *Syobon Action*, and *Celeste*), but with a revolutionary twist: **the game dynamically studies the player's psychology, motor reflexes, and behavioral flaws to engineer custom traps designed to stop them.**

Powered by **Gemma 4** (`gemma-4-26b-a4b-it`) via the Google Generative Language API, the AI Game Master audits granular biometric and behavioral telemetry after every run. It identifies player archetypes—such as *The Impatient Rusher*, *The Floaty Dreamer*, *The Paralyzed Hesitator*, or *The Greedy Coin Goblin*—and injects targeted Kaizo obstacles right where the player's comfort zones lie.

### The "Rage, but Strictly Fair" Philosophy
Unlike arbitrary unfair games, GemmaKaizo enforces a strict **Mathematical Speedrunner Fairness Guarantee**:
1. **Deterministic Physics**: Sub-pixel precision, variable jump height cuts, coyote time (0.1s), jump buffering (0.12s), and wall-kicks.
2. **Speedrunner Solvability Guarantee**: Every generated trap is validated through an arc-clearance solver. There is always a frame-perfect route through the level.
3. **Speedrunner Ghost Path**: Toggleable visual trajectory overlay showing the exact jump arc and inputs needed to beat Gemma 4's traps.
4. **Instant Respawn (< 100ms)**: Keep momentum and muscle memory alive.

---

## 🧠 Dual-AI Architecture

```
                       ┌────────────────────────┐
                       │   Human Player (WASD)  │
                       │           OR           │
                       │  OpenRouter Player Bot │
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
   │ Real-Time Telemetry  │                  │  AI Player Agent     │
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
   │ 5. Speedrunner Fairness Audit                      │
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
2. **Autonomous Player Bot (OpenRouter / Gemma 4)**:
   - Built-in AI agent capable of playing the game autonomously.
   - Queries OpenRouter free decision models or Gemma 4 to formulate obstacle strategy plans.
   - 60 FPS reflex controller executes timed hops, wall kicks, and gap clears.
3. **Death Heatmap Overlay**:
   - Visual skull markers and radial glow displaying the exact death density across the stage.
4. **Speedrunner Ghost Path**:
   - Real-time parabolic physics raycaster showing the mathematical proof of clearance.
5. **Procedural 8-Bit Audio Synth**:
   - 100% Web Audio API procedural synthesis (jump, stomp, bonk, death jingle, victory fanfare, and dark Kaizo bassline BGM). Zero missing audio files!
6. **Robust Offline Simulation Mode**:
   - If offline or API rate limits occur, an internal heuristic engine takes over seamlessly so the game and presentations never stall.

---

## 🚀 Quickstart

### Prerequisites
- Node.js 18+ or Node.js 22+
- `GEMINI_API_KEY` or `GOOGLE_API_KEY` (configured locally or in `.env`)
- (Optional) `OPENROUTER_API_KEY` for free player decision bot

### Installation & Run

```bash
# Clone the repository
git clone https://github.com/ldameron1/girzzhacks_hacktober_alt.git
cd girzzhacks_hacktober_alt

# Install dependencies
npm install

# Start development server (serves frontend + backend on port 3000)
npm run dev
```

Open your browser to: **`http://localhost:3000`**

---

## 🕹️ Controls

| Key | Action |
|---|---|
| **A / D** or **◄ / ►** | Move Left / Right |
| **Space** or **W** / **Z** | Jump / Wall-Kick (Hold for higher jump) |
| **Shift** or **X** | Sprint / Dash |
| **B** | Toggle Autonomous AI Player Bot |
| **H** | Toggle Death Heatmap Overlay |
| **G** | Toggle Speedrunner Ghost Path |

---

## 🧪 Testing

Run the automated physics and mutation safety test suite:

```bash
npm test
```

Verifies:
- AABB bounding box collision logic
- Level mutation safety boundary checks (preserves spawn and flagpole zones)
- Telemetry serialization and archetype classification

---

## 🏆 Hackathon Context

- **Event:** GrizzHacks (Oakland University) / Hacktoberfest 2026
- **Track:** Best Use of Gemma 4
- **API Model:** `models/gemma-4-26b-a4b-it` (Google Generative AI)
- **Author:** `ldameron1`
