import { GameEngine } from './game/engine.js';
import { GameHUD } from './ui/hud.js';
import { OverseerTerminal } from './ui/overseer.js';

window.addEventListener('DOMContentLoaded', () => {
  const canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }

  const hud = new GameHUD();
  const overseer = new OverseerTerminal();

  // Overlays & Banners
  const startOverlay = document.getElementById('start-overlay')!;
  const btnStart = document.getElementById('btn-start')!;
  const deathBanner = document.getElementById('death-banner')!;
  const gameoverOverlay = document.getElementById('gameover-overlay')!;
  const btnContinue = document.getElementById('btn-continue')!;
  const btnFullReset = document.getElementById('btn-fullreset')!;
  const victoryOverlay = document.getElementById('victory-overlay')!;
  const btnReplay = document.getElementById('btn-replay')!;

  const engine = new GameEngine(canvas, {
    onTelemetryUpdate: (telemetry) => {
      hud.update(
        telemetry.totalDeaths,
        telemetry.coinsCollected,
        telemetry.furthestX,
        telemetry.currentDifficulty,
        engine.bot.enabled,
        engine.totalMutationsApplied
      );
    },
    onGemmaArchitectUpdate: (data) => {
      overseer.displayGemmaResponse(data);
      if (data.brutalityLevel) {
        engine.telemetry.currentDifficulty = data.brutalityLevel;
      }
    },
    onVictory: () => {
      victoryOverlay.classList.remove('hidden');
    },
    onDeath: (cause, totalDeaths, consecutive) => {
      hud.update(
        totalDeaths,
        engine.telemetry.coinsCollected,
        engine.telemetry.furthestX,
        engine.telemetry.currentDifficulty,
        engine.bot.enabled,
        engine.totalMutationsApplied
      );

      // Flash death banner
      if (deathBanner) {
        deathBanner.textContent = `☠ DEATH #${totalDeaths} (${consecutive}/5): ${cause.toUpperCase()}`;
        deathBanner.classList.remove('hidden');
        setTimeout(() => {
          deathBanner.classList.add('hidden');
        }, 1200);
      }
    },
    onGameOver: (consecutiveDeaths, stats) => {
      // 5 consecutive deaths Game Over
      if (gameoverOverlay) {
        const deathsSpan = document.getElementById('gameover-deaths');
        const mutationsSpan = document.getElementById('gameover-mutations');
        const progressSpan = document.getElementById('gameover-progress');
        const coinsSpan = document.getElementById('gameover-coins');

        if (deathsSpan) deathsSpan.textContent = `${consecutiveDeaths}`;
        if (mutationsSpan) mutationsSpan.textContent = `${engine.totalMutationsApplied}`;
        if (progressSpan) {
          const pct = Math.min(100, Math.round((stats.furthestX / (110 * 32)) * 100));
          progressSpan.textContent = `${pct}%`;
        }
        if (coinsSpan) coinsSpan.textContent = `${stats.coinsCollected}`;

        gameoverOverlay.classList.remove('hidden');
      }
    }
  });

  // Start Screen Dismiss
  const dismissStart = () => {
    if (startOverlay && !startOverlay.classList.contains('hidden')) {
      startOverlay.classList.add('hidden');
      engine.audio.initCtx();
      engine.audio.startBgm();
    }
  };
  btnStart?.addEventListener('click', dismissStart);

  // Unlock AudioContext on first user interaction
  const unlockAudio = () => {
    engine.audio.initCtx();
    dismissStart();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
  };
  window.addEventListener('click', unlockAudio);
  window.addEventListener('keydown', unlockAudio);

  // Start engine loop
  engine.start();

  // Periodic HUD sync
  setInterval(() => {
    hud.update(
      engine.telemetry.totalDeaths,
      engine.telemetry.coinsCollected,
      engine.telemetry.furthestX,
      engine.telemetry.currentDifficulty,
      engine.bot.enabled,
      engine.totalMutationsApplied
    );
  }, 200);

  // Game Over Handlers
  btnContinue?.addEventListener('click', () => {
    gameoverOverlay.classList.add('hidden');
    engine.player.clearConsecutiveDeaths();
    engine.isPaused = false;
  });

  btnFullReset?.addEventListener('click', () => {
    gameoverOverlay.classList.add('hidden');
    engine.level.createDefaultMap();
    engine.totalMutationsApplied = 0;
    engine.player.clearConsecutiveDeaths();
    engine.player.reset(3 * 32, 11 * 32);
    engine.telemetry.startNewRun(engine.player.x);
    engine.resetLevelEntities();
    engine.isPaused = false;
  });

  // Setup Toolbar Button Controls
  const btnBot = document.getElementById('btn-toggle-bot')!;
  btnBot?.addEventListener('click', () => {
    const isBot = engine.bot.toggle();
    btnBot.classList.toggle('active', isBot);
    hud.update(
      engine.telemetry.totalDeaths,
      engine.telemetry.coinsCollected,
      engine.telemetry.furthestX,
      engine.telemetry.currentDifficulty,
      isBot,
      engine.totalMutationsApplied
    );
  });

  const btnHeatmap = document.getElementById('btn-toggle-heatmap')!;
  btnHeatmap?.addEventListener('click', () => {
    const active = engine.heatmap.toggle();
    btnHeatmap.classList.toggle('active', active);
  });

  const btnGhost = document.getElementById('btn-toggle-ghost')!;
  btnGhost?.addEventListener('click', () => {
    engine.showGhostPath = !engine.showGhostPath;
    btnGhost.classList.toggle('active', engine.showGhostPath);
  });

  const btnAudio = document.getElementById('btn-toggle-audio')!;
  btnAudio?.addEventListener('click', () => {
    const muted = engine.audio.toggleMute();
    btnAudio.innerHTML = `<span class="btn-icon">${muted ? '🔇' : '🔊'}</span> Audio: ${muted ? 'OFF' : 'ON'}`;
  });

  const btnReset = document.getElementById('btn-reset')!;
  btnReset?.addEventListener('click', () => {
    engine.level.createDefaultMap();
    engine.totalMutationsApplied = 0;
    engine.player.clearConsecutiveDeaths();
    engine.player.reset(3 * 32, 11 * 32);
    engine.telemetry.startNewRun(engine.player.x);
    engine.resetLevelEntities();
    victoryOverlay.classList.add('hidden');
    gameoverOverlay.classList.add('hidden');
    engine.isPaused = false;
  });

  btnReplay?.addEventListener('click', () => {
    victoryOverlay.classList.add('hidden');
    engine.player.clearConsecutiveDeaths();
    engine.player.reset(3 * 32, 11 * 32);
    engine.telemetry.startNewRun(engine.player.x);
    engine.resetLevelEntities();
    engine.isPaused = false;
  });
});
