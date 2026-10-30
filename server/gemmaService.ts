import { Mutation } from './levelPatcher.js';

export interface TelemetryPayload {
  totalRuns: number;
  totalDeaths: number;
  furthestX: number;
  averageSpeed: number;
  sprintRatio: number; // 0.0 - 1.0
  hesitationTimeSec: number;
  jumpCount: number;
  jumpHoldAvgSec: number;
  edgeJumpDistanceAvg: number; // distance from ledge when jumping
  panicJitterRate: number; // 0.0 - 1.0 (rapid left/right button flips)
  coinsCollected: number;
  recentDeaths: Array<{ x: number; y: number; cause: string }>;
  currentDifficulty: number;
}

export interface KaizoArchitectResponse {
  playerArchetype: string;
  diagnosis: string;
  taunt: string;
  mutations: Mutation[];
  fairnessAudit: string;
  brutalityLevel: number;
  modelUsed: string;
  latencyMs: number;
  fallbackUsed: boolean;
}

export class GemmaArchitectService {
  private apiKey: string;
  private openRouterKey: string;
  /** Set when Google rejects the key (401/403/400); skips Google calls until a new key arrives. */
  private googleKeyInvalid = false;

  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    this.openRouterKey = process.env.OPENROUTER_API_KEY || '';
  }

  setApiKey(key: string) {
    this.apiKey = String(key || '').trim();
    this.googleKeyInvalid = false;
    console.log('[GemmaArchitect] Google API key swapped at runtime:', this.apiKey ? 'configured' : 'cleared');
  }

  getApiKeyConfigured() {
    return !!this.apiKey;
  }

  isGoogleKeyInvalid() {
    return this.googleKeyInvalid;
  }

  async analyzeAndMutate(telemetry: TelemetryPayload): Promise<KaizoArchitectResponse> {
    const startTime = Date.now();

    // 1. Try Google Gemma 4 API if key available
    if (this.apiKey) {
      try {
        const result = await this.callGoogleGemma(telemetry);
        result.latencyMs = Date.now() - startTime;
        return result;
      } catch (err) {
        console.warn('[GemmaArchitect] Google Gemma 4 API call failed, attempting fallback:', err);
      }
    }

    // 2. Try OpenRouter Gemma 4 / free models if key available
    if (this.openRouterKey) {
      try {
        const result = await this.callOpenRouterGemma(telemetry);
        result.latencyMs = Date.now() - startTime;
        return result;
      } catch (err) {
        console.warn('[GemmaArchitect] OpenRouter Gemma 4 fallback failed:', err);
      }
    }

    // 3. Deterministic Heuristic Kaizo Engine (Always works 100% offline)
    const heuristic = this.generateHeuristicResponse(telemetry);
    heuristic.latencyMs = Date.now() - startTime;
    return heuristic;
  }

  private async callGoogleGemma(telemetry: TelemetryPayload): Promise<KaizoArchitectResponse> {
    const prompt = this.buildPrompt(telemetry);
    const modelsToTry = ['gemma-4-26b-a4b-it', 'gemini-2.5-flash'];

    for (const model of modelsToTry) {
      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${this.apiKey}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              temperature: 0.7,
              maxOutputTokens: 800
            }
          })
        });

        if (!response.ok) {
          throw new Error(`Google API returned status ${response.status}: ${await response.text()}`);
        }

        const data = await response.json();
        const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = this.parseJsonFromMarkdown(rawText);

        if (parsed) {
          return {
            playerArchetype: parsed.player_archetype || 'The Test Subject',
            diagnosis: parsed.architect_diagnosis || 'Player exhibits predictable locomotion patterns.',
            taunt: parsed.live_taunt || 'You walked right into that one.',
            mutations: this.sanitizeMutations(parsed.mutations),
            fairnessAudit: parsed.fairness_audit || 'All traps bypassable via momentum cancel or micro-hop.',
            brutalityLevel: Math.min(10, Math.max(1, parsed.brutality_level || 5)),
            modelUsed: `Google ${model}`,
            latencyMs: 0,
            fallbackUsed: model !== modelsToTry[0]
          };
        }
      } catch (err) {
        console.warn(`Model ${model} failed, trying next...`, err);
      }
    }

    throw new Error('All Google models failed to return valid JSON');
  }

  private async callOpenRouterGemma(telemetry: TelemetryPayload): Promise<KaizoArchitectResponse> {
    const prompt = this.buildPrompt(telemetry);
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.openRouterKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/ldameron1/girzzhacks_hacktober_alt',
        'X-Title': 'GemmaKaizo Architect'
      },
      body: JSON.stringify({
        model: 'google/gemma-4-26b-a4b-it',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 800,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter returned status ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    const rawText = data?.choices?.[0]?.message?.content || '';
    const parsed = this.parseJsonFromMarkdown(rawText);

    if (parsed) {
      return {
        playerArchetype: parsed.player_archetype || 'The OpenRouter Test Subject',
        diagnosis: parsed.architect_diagnosis || 'Biometric analysis confirms sub-optimal reflex profiles.',
        taunt: parsed.live_taunt || 'Did you really think that gap was safe?',
        mutations: this.sanitizeMutations(parsed.mutations),
        fairnessAudit: parsed.fairness_audit || 'Micro-timing allows continuous speedrunner traversal.',
        brutalityLevel: Math.min(10, Math.max(1, parsed.brutality_level || 5)),
        modelUsed: 'OpenRouter Gemma 4 26B',
        latencyMs: 0,
        fallbackUsed: true
      };
    }

    throw new Error('OpenRouter response lacked valid JSON');
  }

  private buildPrompt(telemetry: TelemetryPayload): string {
    return `
You are the Gemma 4 Kaizo Architect. You are an all-seeing, cold, hyper-analytical, and wickedly witty AI Game Master presiding over a Mario-style "Rage Kaizo" platformer.

Analyze the player's run telemetry below and engineer targeted level mutations to exploit their psychological and motor habits.
IMPORTANT: The game must feel intensely brutal and punishing ("rage mario"), BUT REMAIN STRICTLY FAIR (every trap must be survivable with precise reflexes, tap jumps, or momentum control). Never make an impossible wall.

PLAYER TELEMETRY:
- Total Runs: ${telemetry.totalRuns}
- Total Deaths: ${telemetry.totalDeaths}
- Furthest Progress (Tile X): ${Math.floor(telemetry.furthestX / 32)} (out of 100 tiles)
- Average Horizontal Speed: ${Math.round(telemetry.averageSpeed)} px/s
- Sprint Usage Ratio: ${(telemetry.sprintRatio * 100).toFixed(1)}% (Aggressive rusher > 60%, cautious walker < 30%)
- Hesitation Time at Gaps: ${telemetry.hesitationTimeSec.toFixed(1)} seconds
- Jump Style: ${telemetry.jumpCount} total jumps, avg hold duration ${telemetry.jumpHoldAvgSec.toFixed(2)}s (Floaty leaper > 0.35s, tap hopper < 0.2s)
- Ledge Jump Distance: ${telemetry.edgeJumpDistanceAvg.toFixed(1)} px before ledge (Early leaper > 25px, frame-perfect late leaper < 8px)
- Panic Input Jitter Rate: ${(telemetry.panicJitterRate * 100).toFixed(1)}% (Button mashing / direction oscillation)
- Coins Grabbed: ${telemetry.coinsCollected}
- Recent Death Coordinates (Tile X, Tile Y, Cause):
${telemetry.recentDeaths.map(d => `  * (${Math.floor(d.x / 32)}, ${Math.floor(d.y / 32)}) - Cause: ${d.cause}`).join('\n') || '  * None yet'}

INSTRUCTIONS:
1. Determine the player's Archetype (e.g. "The Blind Rusher", "The Paralyzed Hesitator", "The Floaty Sky-Diver", "The Greedy Coin Goblin").
2. Write a sharp 2-sentence clinical diagnosis of their fatal habits.
3. Write a biting, hilarious 1-sentence live taunt to print on their HUD.
4. Choose 2 to 4 tactical mutations targeted right near their death clusters or comfort zones.
   Mutation Types:
   - "KAIZO_BLOCK": Invisible solid block at jump apex that bonks their head into a pit.
   - "CRUMBLING_FLOOR": Solid tile that collapses 0.3s after being stepped on (punishes hesitation).
   - "FALLING_SPIKE": Ceiling spike that drops when approached.
   - "CEILING_SPIKE": Lowers ceiling clearance (punishes floaty max jumps).
   - "DECEPTIVE_COIN": Shiny bait coin placed directly above a pit or trap.
   - "BOUNCE_TRAP": Trampoline launching player unexpectedly.
   - "ENEMY_AMBUSH": Fast patrol critter.
   (Tile X range: 8 to 90, Tile Y range: 4 to 15).
5. Provide a Speedrunner Fairness Audit explaining the exact inputs required to beat the modified section.
6. Rate Brutality Level (1 to 10).

RESPOND ONLY WITH A VALID JSON OBJECT MATCHING THIS SCHEMA (no preamble or prose outside JSON):
{
  "player_archetype": "string",
  "architect_diagnosis": "string",
  "live_taunt": "string",
  "mutations": [
    {
      "type": "KAIZO_BLOCK",
      "x": 18,
      "y": 8,
      "justification": "Player always leaps at max height here; invisible block will bonk them into the hazard."
    }
  ],
  "fairness_audit": "string",
  "brutality_level": 7
}
`;
  }

  private parseJsonFromMarkdown(text: string): any {
    try {
      // Direct JSON parse
      return JSON.parse(text.trim());
    } catch {
      // Extract from ```json ... ``` or first { ... }
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || text.match(/(\{[\s\S]*\})/);
      if (jsonMatch && jsonMatch[1]) {
        try {
          return JSON.parse(jsonMatch[1]);
        } catch (e) {
          console.error('[GemmaArchitect] JSON parse error inside markdown codeblock:', e);
        }
      }
    }
    return null;
  }

  private sanitizeMutations(rawMutations: any[]): Mutation[] {
    if (!Array.isArray(rawMutations)) return [];
    const validTypes = ['KAIZO_BLOCK', 'CRUMBLING_FLOOR', 'FALLING_SPIKE', 'CEILING_SPIKE', 'DECEPTIVE_COIN', 'BOUNCE_TRAP', 'ENEMY_AMBUSH'];
    return rawMutations
      .filter(m => m && validTypes.includes(m.type) && typeof m.x === 'number' && typeof m.y === 'number')
      .map(m => ({
        type: m.type,
        x: Math.max(6, Math.min(95, Math.round(m.x))),
        y: Math.max(3, Math.min(16, Math.round(m.y))),
        justification: String(m.justification || 'Targeting player behavioral telemetry.')
      }));
  }

  private generateHeuristicResponse(telemetry: TelemetryPayload): KaizoArchitectResponse {
    const isRusher = telemetry.sprintRatio > 0.5;
    const isHesitator = telemetry.hesitationTimeSec > 3;
    const isFloaty = telemetry.jumpHoldAvgSec > 0.28;
    const isEarlyLeaper = telemetry.edgeJumpDistanceAvg > 20;

    let archetype = 'The Methodical Jumper';
    let diagnosis = ''; // no fake model commentary when offline
    let taunt = '';
    const mutations: Mutation[] = [];

    const focusX = telemetry.recentDeaths.length > 0 
      ? Math.floor(telemetry.recentDeaths[telemetry.recentDeaths.length - 1].x / 32)
      : Math.floor(telemetry.furthestX / 32) + 4;

    const targetX = Math.max(10, Math.min(85, focusX));

    if (isRusher) {
      archetype = 'The Impatient Speedster';
      diagnosis = '';
      taunt = '';
      mutations.push({
        type: 'CRUMBLING_FLOOR',
        x: targetX,
        y: 14,
        justification: 'Crumbling floor collapses immediately under sprinting momentum.'
      });
      mutations.push({
        type: 'KAIZO_BLOCK',
        x: targetX + 2,
        y: 10,
        justification: 'Hidden block intercepts blind sprint-jump arc at peak height.'
      });
    } else if (isFloaty) {
      archetype = 'The Floaty Dreamer';
      diagnosis = '';
      taunt = '';
      mutations.push({
        type: 'CEILING_SPIKE',
        x: targetX,
        y: 7,
        justification: 'Ceiling spike punishes full-height floaty jumps, demanding a disciplined micro-tap.'
      });
      mutations.push({
        type: 'KAIZO_BLOCK',
        x: targetX + 3,
        y: 9,
        justification: 'Invisible Kaizo ceiling block bonks player mid-float.'
      });
    } else if (isHesitator) {
      archetype = 'The Paralyzed Analyst';
      diagnosis = '';
      taunt = '';
      mutations.push({
        type: 'CRUMBLING_FLOOR',
        x: targetX - 1,
        y: 14,
        justification: 'Collapses underfoot if the player pauses for more than 0.4 seconds.'
      });
      mutations.push({
        type: 'ENEMY_AMBUSH',
        x: targetX + 4,
        y: 13,
        justification: 'Pushes forward pressure to deny the player hesitation time.'
      });
    } else {
      archetype = 'The Greedy Collector';
      diagnosis = '';
      taunt = '';
      mutations.push({
        type: 'DECEPTIVE_COIN',
        x: targetX + 2,
        y: 11,
        justification: 'Bait coin floating right above a disguised Kaizo bonk block.'
      });
      mutations.push({
        type: 'KAIZO_BLOCK',
        x: targetX + 2,
        y: 12,
        justification: 'Blocks ascent to the bait coin, dropping player into pit.'
      });
    }

    return {
      playerArchetype: archetype,
      diagnosis,
      taunt,
      mutations,
      fairnessAudit: 'All traps can be circumvented via a controlled short-hop followed by horizontal momentum air-strafe.',
      brutalityLevel: Math.min(10, Math.max(3, telemetry.totalDeaths + 3)),
      modelUsed: 'Gemma 4 Heuristic Core (Offline Safe)',
      latencyMs: 5,
      fallbackUsed: true
    };
  }
}
