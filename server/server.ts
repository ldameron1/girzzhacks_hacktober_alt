import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { GemmaArchitectService } from './gemmaService.js';
import { PlayerDecisionService } from './decisionService.js';
import { LevelPatcher } from './levelPatcher.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

const app = express();
const port = parseInt(process.env.PORT || '3001', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const gemmaArchitect = new GemmaArchitectService();
const playerDecision = new PlayerDecisionService();

function servePresentation(res: express.Response) {
  const presentationPath = path.resolve(
    rootDir,
    process.env.NODE_ENV === 'production' ? 'dist/presentation.html' : 'presentation.html'
  );
  return res.sendFile(presentationPath);
}

// Health & Status endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'online',
    googleApiKeyConfigured: gemmaArchitect.getApiKeyConfigured(),
    openRouterApiKeyConfigured: !!process.env.OPENROUTER_API_KEY,
    models: {
      architect: 'google/gemma-4-26b-a4b-it',
      architectFallback: 'google/gemini-2.5-flash',
      playerAgent: 'openrouter/free-models'
    },
    timestamp: new Date().toISOString()
  });
});

// Key configuration endpoints (swap the Gemini key without a server restart)
app.get('/api/config', (req, res) => {
  res.json({ googleApiKeyConfigured: gemmaArchitect.getApiKeyConfigured() });
});
app.post('/api/config', (req, res) => {
  const key = typeof req.body?.apiKey === 'string' ? req.body.apiKey : '';
  gemmaArchitect.setApiKey(key);
  res.json({ ok: true, googleApiKeyConfigured: gemmaArchitect.getApiKeyConfigured() });
});

// Telemetry & Kaizo Mutation endpoint (Gemma 4)
app.post('/api/mutate', async (req, res) => {
  try {
    const { telemetry, currentLevel } = req.body;
    if (!telemetry) {
      return res.status(400).json({ error: 'Missing telemetry payload' });
    }

    console.log(`[API /mutate] Received telemetry: ${telemetry.totalRuns} runs, ${telemetry.totalDeaths} deaths. Furthest X: ${telemetry.furthestX}`);
    
    // Call Gemma 4 Kaizo Architect
    const analysis = await gemmaArchitect.analyzeAndMutate(telemetry);

    // Apply & validate mutations against level map
    let patchedLevel = currentLevel;
    let accepted = analysis.mutations;
    let rejected: any[] = [];

    if (currentLevel && currentLevel.tiles) {
      const patchResult = LevelPatcher.applyMutations(currentLevel, analysis.mutations);
      patchedLevel = patchResult.level;
      accepted = patchResult.accepted;
      rejected = patchResult.rejected;
    }

    console.log(`[API /mutate] Generated ${accepted.length} valid mutations via ${analysis.modelUsed} (${analysis.latencyMs}ms)`);

    res.json({
      ...analysis,
      mutations: accepted,
      rejectedMutations: rejected,
      patchedLevel
    });
  } catch (error: any) {
    console.error('[API /mutate] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to process telemetry' });
  }
});

// Player Decision Agent endpoint (OpenRouter Free / Google / Reflex)
app.post('/api/decision', async (req, res) => {
  try {
    const state = req.body;
    const decision = await playerDecision.decideNextAction(state);
    res.json(decision);
  } catch (error: any) {
    console.error('[API /decision] Error:', error);
    res.status(500).json({ error: error.message || 'Failed to compute action' });
  }
});

// Keep the presenter deck on the same origin as the game so it can be opened directly.
// This route is registered before Vite and the SPA fallback in both environments.
app.get('/present', (req, res) => {
  servePresentation(res);
});

// Setup Vite in development or serve static in production
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
      root: rootDir
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(rootDir, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(rootDir, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`=======================================================`);
    console.log(`  GemmaKaizo Server is live at http://localhost:${port}`);
    console.log(`  Kaizo Architect: Gemma 4 (API configured: ${!!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY)})`);
    console.log(`  OpenRouter Free Agent: (API configured: ${!!process.env.OPENROUTER_API_KEY})`);
    console.log(`=======================================================`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
});
