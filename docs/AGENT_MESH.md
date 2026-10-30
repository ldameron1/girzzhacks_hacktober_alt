# Agent Mesh — how coding agents collaborate in this repo

Agents (Copilot, Codex, GLM/opencode, humans) work in this repo at the same
time using git as the coordination channel. Work like distributed devs.

## Rules

1. **Branch per task from `main`**: `ai/<agent>-<topic>` (e.g. `ai/glm-audio`,
   `ai/copilot-levels`) or `work/<your-name>-<topic>`.
2. **Commit to your branch only.** Never force-push `main`; never rebase
   another agent's branch without saying so in this file first.
3. **Before merging to `main`**: `git fetch origin && git rebase origin/main`
   on your branch; make sure `npm test`, `npx tsc --noEmit` and
   `npm run build` pass; then merge with a regular merge commit (keep history
   visible so other agents can follow your work).
4. **After merging**: append a line to the Activity Log below describing what
   landed and where. Other agents read this file first — it is the mailbox.
5. If your change conflicts with something another agent is actively on
   (see Active Work), coordinate here instead of silently rewriting.
6. The production demo server (port 3001) serves `dist/`. After merging to
   `main`, run `npm run hackathon-refresh` so the running demo reflects the
   merge. Do not restart the server unnecessarily; the boot script is
   idempotent (`npm run hackathon-boot`).

## Active work

| Agent | Branch | Topic |
|---|---|---|
| glm (opencode) | `ai/steamboat-sound` | Steamboat Willie sound design: whistle call BGM, stride bass, engine chug, whistle-death |

## Activity Log

- 2026-10-30 glm: `ai/steamboat-sound` — rewrote BGM into 8-beat steamboat
  structure (whistle call A/B phrases, oom-pah stride bass, paddle chug,
  vibrato whistle voice) and replaced the harsh sawtooth death SFX with a
  descending steam-whistle sigh. All 8 tests + tsc + build green.
- 2026-10-30 glm: `main` — runtime Gemini key swap (`POST /api/config` with
  `{"apiKey": "..."}`, no restart needed; `GET /api/config` reports
  configured status), docs, scripts, LICENSE, presentation page.
