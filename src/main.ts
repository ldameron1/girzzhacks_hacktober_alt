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
  const victoryOverlay = document.getElementById('victory-overlay')!;
  const btnReplay = document.getElementById('btn-replay')!;

  const engine = new GameEngine(canvas, {
    onTelemetryUpdate: (telemetry) => {
      hud.update(
        telemetry.totalDeaths,
        telemetry.coinsCollected,
        telemetry.furthestX,
        telemetry.currentDifficulty,
        engine.bot.enabled
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
    onDeath: (cause, totalDeaths) => {
      hud.update(
        totalDeaths,
        engine.telemetry.coinsCollected,
        engine.telemetry.furthestX,
        engine.telemetry.currentDifficulty,
        engine.bot.enabled
      );
    }
  });

  // Unlock AudioContext on first user interaction
  const unlockAudio = () => {
    engine.audio.initCtx();
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
      engine.bot.enabled
    );
  }, 200);

  // Setup Toolbar Button Controls
  const btnBot = document.getElementById('btn-toggle-bot')!;
  btnBot.addEventListener('click', () => {
    const isBot = engine.bot.toggle();
    btnBot.classList.toggle('active', isBot);
    hud.update(
      engine.telemetry.totalDeaths,
      engine.telemetry.coinsCollected,
      engine.telemetry.furthestX,
      engine.telemetry.currentDifficulty,
      isBot
    );
  });

  const btnHeatmap = document.getElementById('btn-toggle-heatmap')!;
  btnHeatmap.addEventListener('click', () => {
    const active = engine.heatmap.toggle();
    btnHeatmap.classList.toggle('active', active);
  });

  const btnGhost = document.getElementById('btn-toggle-ghost')!;
  btnGhost.addEventListener('click', () => {
    engine.showGhostPath = !engine.showGhostPath;
    btnGhost.classList.toggle('active', engine.showGhostPath);
  });

  const btnAudio = document.getElementById('btn-toggle-audio')!;
  btnAudio.addEventListener('click', () => {
    const muted = engine.audio.toggleMute();
    btnAudio.innerHTML = `<span class="btn-icon">${muted ? '🔇' : '🔊'}</span> Audio: ${muted ? 'OFF' : 'ON'}`;
  });

  const btnReset = document.getElementById('btn-reset')!;
  btnReset.addEventListener('click', () => {
    engine.level.createDefaultMap();
    engine.player.reset(3 * 32, 13 * 32);
    engine.telemetry.startNewRun(engine.player.x);
    engine.resetLevelEntities();
    victoryOverlay.classList.add('hidden');
  });

  btnReplay.addEventListener('click', () => {
    victoryOverlay.classList.add('hidden');
    engine.player.reset(3 * 32, 13 * 32);
    engine.telemetry.startNewRun(engine.player.x);
    engine.resetLevelEntities();
  });
});
