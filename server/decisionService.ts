export interface PlayerGameState {
  x: number;
  y: number;
  vx: number;
  vy: number;
  onGround: boolean;
  facing: 'left' | 'right';
  currentSpeed: number;
  upcomingTiles: string; // ASCII visual representation of 12x6 grid ahead
  nearestGapDistance: number;
  nearestEnemyDistance: number;
  knownTrapsCount: number;
}

export interface PlayerDecisionResponse {
  action: 'RUN_RIGHT' | 'JUMP_RIGHT' | 'SPRINT_JUMP' | 'MICRO_HOP' | 'STOP_AND_WAIT' | 'RUN_LEFT';
  reasoning: string;
  sprint: boolean;
  jumpHoldDurationMs: number;
  modelUsed: string;
  latencyMs: number;
}

export class PlayerDecisionService {
  private openRouterKey: string;
  private googleKey: string;

  constructor() {
    this.openRouterKey = process.env.OPENROUTER_API_KEY || '';
    this.googleKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  }

  async decideNextAction(state: PlayerGameState): Promise<PlayerDecisionResponse> {
    const t0 = Date.now();

    // 1. Try OpenRouter free models if key available
    if (this.openRouterKey) {
      try {
        const res = await this.callOpenRouter(state);
        res.latencyMs = Date.now() - t0;
        return res;
      } catch (e) {
        // Continue to fallback
      }
    }

    // 2. Try Google Gemini / Gemma if key available
    if (this.googleKey) {
      try {
        const res = await this.callGoogleModel(state);
        res.latencyMs = Date.now() - t0;
        return res;
      } catch (e) {
        // Continue to fallback
      }
    }

    // 3. Fallback to Reflex Controller
    const res = this.reflexHeuristic(state);
    res.latencyMs = Date.now() - t0;
    return res;
  }

  private async callOpenRouter(state: PlayerGameState): Promise<PlayerDecisionResponse> {
    // List candidate free models on OpenRouter
    const freeModels = [
      'google/gemma-4-26b-a4b-it:free',
      'xingchen-agi/xing4.0-29b-a4b:free',
      'nvidia/nemotron-3.5-lightning:free'
    ];

    const prompt = this.buildPrompt(state);

    for (const model of freeModels) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 2000); // Fast timeout for game reactivity

        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          signal: controller.signal,
          headers: {
            'Authorization': `Bearer ${this.openRouterKey}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/ldameron1/girzzhacks_hacktober_alt',
            'X-Title': 'GemmaKaizo Player Bot'
          },
          body: JSON.stringify({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 150,
            temperature: 0.3
          })
        });

        clearTimeout(timeout);

        if (!response.ok) continue;

        const data = await response.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const parsed = this.parseJson(content);
        if (parsed && parsed.action) {
          return {
            action: parsed.action,
            reasoning: parsed.reasoning || 'Navigating obstacle horizon.',
            sprint: !!parsed.sprint,
            jumpHoldDurationMs: Math.min(400, Math.max(100, parsed.jump_duration_ms || 250)),
            modelUsed: `OpenRouter (${model})`,
            latencyMs: 0
          };
        }
      } catch (err) {
        // try next model
      }
    }

    throw new Error('All OpenRouter models timed out or failed');
  }

  private async callGoogleModel(state: PlayerGameState): Promise<PlayerDecisionResponse> {
    const prompt = this.buildPrompt(state);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 2000);

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${this.googleKey}`;
    const response = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 150
        }
      })
    });

    clearTimeout(timeout);

    if (!response.ok) throw new Error(`Google API status ${response.status}`);

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const parsed = this.parseJson(text);

    if (parsed && parsed.action) {
      return {
        action: parsed.action,
        reasoning: parsed.reasoning || 'Obstacle clearance calculated.',
        sprint: !!parsed.sprint,
        jumpHoldDurationMs: Math.min(400, Math.max(100, parsed.jump_duration_ms || 250)),
        modelUsed: 'Google Gemini 2.5 Flash',
        latencyMs: 0
      };
    }

    throw new Error('No valid JSON in Google response');
  }

  private buildPrompt(state: PlayerGameState): string {
    return `
You are the AI Player Agent playing a Kaizo Mario platformer.
You must choose the next action to survive and progress rightwards towards the goal.

Current Player State:
- Position: (${Math.round(state.x)}, ${Math.round(state.y)})
- Velocity: (${Math.round(state.vx)}, ${Math.round(state.vy)})
- On Ground: ${state.onGround}
- Distance to Next Pit/Gap: ${state.nearestGapDistance} pixels
- Distance to Nearest Enemy: ${state.nearestEnemyDistance} pixels
- Known Revealed Kaizo Traps: ${state.knownTrapsCount}

Grid Horizon (Ahead):
${state.upcomingTiles}

Choose ONE action from:
- "RUN_RIGHT": Normal progression
- "SPRINT_JUMP": Full sprint leap across wide pits
- "MICRO_HOP": Short tap jump to avoid ceiling Kaizo blocks or hop small obstacles
- "JUMP_RIGHT": Standard jump
- "STOP_AND_WAIT": Wait for enemy or moving hazard to pass
- "RUN_LEFT": Back off to gain running start or avoid trap

Output JSON only:
{
  "action": "SPRINT_JUMP",
  "reasoning": "Clearing the 3-tile gap ahead while avoiding low ceiling",
  "sprint": true,
  "jump_duration_ms": 300
}
`;
  }

  private parseJson(text: string): any {
    try {
      return JSON.parse(text.trim());
    } catch {
      const match = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
      if (match && match[1]) {
        try {
          return JSON.parse(match[1]);
        } catch {}
      }
    }
    return null;
  }

  private reflexHeuristic(state: PlayerGameState): PlayerDecisionResponse {
    // Gap immediately ahead (< 70px)
    if (state.nearestGapDistance > 0 && state.nearestGapDistance < 70) {
      return {
        action: state.nearestGapDistance > 40 ? 'SPRINT_JUMP' : 'JUMP_RIGHT',
        reasoning: 'Heuristic reflex: Approaching gap edge, initiating timed leap.',
        sprint: true,
        jumpHoldDurationMs: 280,
        modelUsed: 'Reflex Lookahead Engine (Local)',
        latencyMs: 1
      };
    }

    // Enemy approaching fast (< 80px)
    if (state.nearestEnemyDistance > 0 && state.nearestEnemyDistance < 80) {
      if (state.nearestEnemyDistance < 40) {
        return {
          action: 'JUMP_RIGHT',
          reasoning: 'Heuristic reflex: Stomping enemy or leaping over patrol path.',
          sprint: false,
          jumpHoldDurationMs: 200,
          modelUsed: 'Reflex Lookahead Engine (Local)',
          latencyMs: 1
        };
      }
    }

    return {
      action: 'RUN_RIGHT',
      reasoning: 'Heuristic reflex: Path clear, advancing towards flag.',
      sprint: true,
      jumpHoldDurationMs: 0,
      modelUsed: 'Reflex Lookahead Engine (Local)',
      latencyMs: 1
    };
  }
}
