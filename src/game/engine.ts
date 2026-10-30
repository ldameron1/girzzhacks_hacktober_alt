import { Player, PlayerInput } from './player.js';
import { Level, TILE_SIZE, TileType } from './level.js';
import { Entity, Gloomba, FallingSpike, Particle } from './entities.js';
import { AudioManager } from './audio.js';
import { TelemetryRecorder } from './telemetry.js';
import { HeatmapRenderer } from './heatmap.js';
import { AutonomousPlayerBot } from './bot.js';
import { Physics } from './physics.js';

export interface EngineCallbacks {
  onTelemetryUpdate: (telemetry: any) => void;
  onGemmaRequest?: (entry: any) => void;
  onBotToggle?: (enabled: boolean) => void;
  onHeatmapToggle?: (enabled: boolean) => void;
  onGhostToggle?: (enabled: boolean) => void;
  onGemmaArchitectUpdate: (data: any) => void;
  onVictory: () => void;
  onDeath: (cause: string, totalDeaths: number, consecutive: number) => void;
  onGameOver: (consecutiveDeaths: number, stats: any) => void;
}

export class GameEngine {
  public canvas: HTMLCanvasElement;
  public ctx: CanvasRenderingContext2D;

  public player: Player;
  public level: Level;
  public enemies: Entity[] = [];
  public particles: Particle[] = [];
  public audio: AudioManager;
  public telemetry: TelemetryRecorder;
  public heatmap: HeatmapRenderer;
  public bot: AutonomousPlayerBot;

  public cameraX: number = 0;
  public showGhostPath: boolean = false;
  public isPaused: boolean = false;
  public totalMutationsApplied: number = 0;

  private isRunning: boolean = false;
  private lastTime: number = 0;
  private respawnTimer: number = 0;
  private telemetryNotifyTimer = 0;
  private mutationRequestInFlight = false;
  private deathRecorded = false;
  private runGeneration = 0;
  private activeMutations: Array<{ type: string; x: number; y: number }> = [];
  private backgroundGradient: CanvasGradient | null = null;
  private backgroundGradientHeight = 0;
  private callbacks: EngineCallbacks;

  // Active keyboard state
  private keyState = {
    left: false,
    right: false,
    jump: false,
    jumpPressed: false,
    sprint: false
  };

  constructor(canvas: HTMLCanvasElement, callbacks: EngineCallbacks) {
    this.canvas = canvas;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Failed to get 2D canvas context');
    this.ctx = context;

    this.callbacks = callbacks;
    this.audio = new AudioManager();
    this.level = new Level();
    this.player = new Player(3 * TILE_SIZE, 11 * TILE_SIZE);
    this.telemetry = new TelemetryRecorder();
    this.heatmap = new HeatmapRenderer();
    this.bot = new AutonomousPlayerBot();

    this.resetLevelEntities();
    this.setupInputListeners();
  }

  resetLevelEntities() {
    this.enemies = [];
    this.level.initialEnemies.forEach(e => {
      if (e.type === 'gloomba') {
        this.enemies.push(new Gloomba(e.x, e.y));
      }
    });

    // Add falling spikes over common gaps
    this.enemies.push(new FallingSpike(23 * TILE_SIZE + 6, 8 * TILE_SIZE));
    this.enemies.push(new FallingSpike(47 * TILE_SIZE + 6, 8 * TILE_SIZE));
    for (const mutation of this.activeMutations) {
      if (mutation.type === 'FALLING_SPIKE') {
        this.enemies.push(new FallingSpike(mutation.x * TILE_SIZE, mutation.y * TILE_SIZE));
      } else if (mutation.type === 'ENEMY_AMBUSH') {
        this.enemies.push(new Gloomba(mutation.x * TILE_SIZE, mutation.y * TILE_SIZE));
      }
    }
  }

  resetAdaptiveMutations() {
    this.activeMutations = [];
    this.runGeneration++;
  }

  private setupInputListeners() {
    window.addEventListener('keydown', (e) => {
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keyState.left = true;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keyState.right = true;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        if (!this.keyState.jump) {
          this.keyState.jumpPressed = true;
          this.telemetry.recordJump(this.player, this.level);
        }
        this.keyState.jump = true;
      }
      if (e.key === 'Shift' || e.key === 'x' || e.key === 'X') {
        this.keyState.sprint = true;
      }

      // Hotkeys
      if (e.key === 'b' || e.key === 'B') {
        this.callbacks.onBotToggle?.(this.bot.toggle());
      }
      if (e.key === 'h' || e.key === 'H') {
        this.callbacks.onHeatmapToggle?.(this.heatmap.toggle());
      }
      if (e.key === 'g' || e.key === 'G') {
        this.showGhostPath = !this.showGhostPath;
        this.callbacks.onGhostToggle?.(this.showGhostPath);
      }
    });

    window.addEventListener('keyup', (e) => {
      if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
        this.keyState.left = false;
      }
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
        this.keyState.right = false;
      }
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W' || e.key === ' ' || e.key === 'z' || e.key === 'Z') {
        this.keyState.jump = false;
        this.telemetry.recordJumpEnd(this.player.jumpHoldTimer);
      }
      if (e.key === 'Shift' || e.key === 'x' || e.key === 'X') {
        this.keyState.sprint = false;
      }
    });
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.telemetry.startNewRun(this.player.x);
    this.lastTime = performance.now();
    requestAnimationFrame(this.loop.bind(this));
  }

  private loop(currentTime: number) {
    if (!this.isRunning) return;

    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.05);
    this.lastTime = currentTime;

    if (!this.isPaused) {
      this.update(dt);
    }
    this.render();

    // Reset single-frame input flags
    this.keyState.jumpPressed = false;

    requestAnimationFrame(this.loop.bind(this));
  }

  private update(dt: number) {
    // Determine active input: Player vs Bot
    let activeInput: PlayerInput;
    if (this.bot.enabled) {
      activeInput = this.bot.computeInput(dt, this.player, this.level, this.enemies);
    } else {
      activeInput = { ...this.keyState };
    }

    // Update telemetry
    if (!this.player.isDead && !this.player.hasWon) {
      this.telemetry.recordTick(dt, this.player, this.level, activeInput.sprint);
      this.telemetryNotifyTimer += dt;
      if (this.telemetryNotifyTimer >= 0.2) {
        this.callbacks.onTelemetryUpdate(this.telemetry.exportPayload());
        this.telemetryNotifyTimer = 0;
      }
    }

    // Update level crumbling blocks
    this.level.updateCrumbling(dt);

    // Update player
    this.player.update(dt, activeInput, this.level, this.audio);
    // Pit and spike-tile deaths originate inside Player.update; route them
    // through the same telemetry/mutation pipeline as entity collisions.
    if (this.player.isDead) {
      this.handlePlayerDeath(this.player.deathCause || 'Unknown hazard');
    }

    // Camera follows player smoothly
    const targetCameraX = Math.max(0, Math.min(
      this.player.x - this.canvas.width * 0.4,
      (this.level.width * TILE_SIZE) - this.canvas.width
    ));
    this.cameraX = Physics.lerp(this.cameraX, targetCameraX, 0.12);

    // Update enemies & handle collision
    this.enemies.forEach(e => {
      e.update(dt, this.level, this.player.x, this.player.y);

      // Check collision with player
      if (!e.dead && !this.player.isDead && Physics.checkAABB(this.player, e)) {
        if (e instanceof Gloomba) {
          // Stomp if falling from above
          if (this.player.vy > 0 && this.player.y + this.player.height - e.y < 16) {
            e.stomp();
            this.player.vy = -360; // bounce
            this.audio.playStomp();
            this.spawnParticles(e.x + 13, e.y + 13, 10, '#fef08a');
          } else {
            this.handlePlayerDeath(`Trampled by ${e.constructor.name}`);
          }
        } else if (e instanceof FallingSpike) {
          this.handlePlayerDeath('Crushed by falling spike');
        }
      }
    });

    // Coin collection
    this.level.coins.forEach(c => {
      if (!c.collected) {
        const coinBox = { x: c.x * TILE_SIZE, y: c.y * TILE_SIZE, width: 32, height: 32 };
        if (Physics.checkAABB(this.player, coinBox)) {
          c.collected = true;
          this.telemetry.coinsCollected++;
          this.audio.playCoin();
          this.spawnParticles(c.x * TILE_SIZE + 16, c.y * TILE_SIZE + 16, 8, '#fbbf24');
        }
      }
    });

    // Checkpoint reach
    const curTileX = Math.floor(this.player.x / TILE_SIZE);
    const curTileY = Math.floor(this.player.y / TILE_SIZE);
    const checkpointTileY = Math.floor((this.player.y + this.player.height - 1) / TILE_SIZE);
    if (this.level.getTile(curTileX, checkpointTileY) === TileType.CHECKPOINT) {
      this.level.checkpointX = curTileX * TILE_SIZE;
      this.level.checkpointY = 12 * TILE_SIZE - this.player.height;
    }

    // Update particles
    this.particles = this.particles.filter(p => p.update(dt));

    // Handle Death & Respawn
    if (this.player.isDead) {
      this.respawnTimer += dt;
      if (this.player.isGameOver) {
        this.isPaused = true;
        this.callbacks.onGameOver(this.player.consecutiveDeaths, this.telemetry.exportPayload());
        return;
      }
      if (this.respawnTimer >= 1.2) {
        this.respawnPlayer();
      }
    }

    // Victory Trigger
    if (this.player.hasWon && this.player.y >= 14 * TILE_SIZE) {
      this.callbacks.onVictory();
    }
  }

  private handlePlayerDeath(cause: string) {
    if (this.deathRecorded || this.player.hasWon) return;
    if (!this.player.isDead) {
      this.player.kill(cause, this.audio);
    }
    this.deathRecorded = true;
    this.telemetry.recordDeath(this.player.x, this.player.y, cause);
    this.spawnParticles(this.player.x + 11, this.player.y + 15, 25, '#ef4444', 4);
    this.callbacks.onDeath(cause, this.telemetry.totalDeaths, this.player.consecutiveDeaths);

    // Call Gemma 4 Kaizo Architect to adaptively mutate level
    this.triggerGemmaMutation();
  }

  private async triggerGemmaMutation() {
    if (this.mutationRequestInFlight) return;
    this.mutationRequestInFlight = true;
    const requestGeneration = this.runGeneration;
    try {
      const payload = {
        telemetry: this.telemetry.exportPayload(),
        currentLevel: {
          width: this.level.width,
          height: this.level.height,
          tiles: this.level.tiles,
          enemies: this.level.initialEnemies,
          coins: this.level.coins.map(c => ({ x: c.x, y: c.y }))
        }
      };

      let data: any;
      let lastError: unknown;
      for (let attempt = 1; attempt <= 2; attempt++) {
        this.callbacks.onGemmaRequest?.({
          kind: 'mutation-request',
          status: attempt === 1 ? 'sending' : 'retrying',
          attempt,
          request: payload,
          receivedAt: new Date().toISOString()
        });
        try {
          const res = await fetch('/api/mutate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          });
          if (!res.ok) throw new Error(`Mutation API returned ${res.status}`);
          data = await res.json();
          break;
        } catch (error) {
          lastError = error;
          if (attempt === 1) await new Promise(resolve => setTimeout(resolve, 350));
        }
      }
      if (!data) throw lastError || new Error('Mutation API unavailable after retry');
      if (data) {
        if (requestGeneration !== this.runGeneration) return;
        this.callbacks.onGemmaArchitectUpdate(data);

        // Apply newly accepted mutations to live game
        if (data.mutations && Array.isArray(data.mutations)) {
          let rebuildEntities = false;
          data.mutations.forEach((m: any) => {
            if (!Number.isInteger(m.x) || !Number.isInteger(m.y) ||
                m.x < 0 || m.x >= this.level.width ||
                m.y < 0 || m.y >= this.level.height) {
              return;
            }
            if (m.type === 'KAIZO_BLOCK') {
              this.level.setKaizo(m.x, m.y);
              this.spawnParticles(m.x * TILE_SIZE + 16, m.y * TILE_SIZE + 16, 12, '#a855f7');
            } else if (m.type === 'CRUMBLING_FLOOR') {
              this.level.tiles[m.y][m.x] = TileType.CRUMBLING;
            } else if (m.type === 'CEILING_SPIKE') {
              this.level.tiles[m.y][m.x] = TileType.SPIKE;
            } else if (m.type === 'FALLING_SPIKE') {
              rebuildEntities = true;
            } else if (m.type === 'DECEPTIVE_COIN') {
              this.level.coins.push({ x: m.x, y: m.y, collected: false });
            } else if (m.type === 'ENEMY_AMBUSH') {
              rebuildEntities = true;
            } else if (m.type === 'BOUNCE_TRAP') {
              this.level.tiles[m.y][m.x] = TileType.SPRING;
            } else {
              return;
            }
            this.activeMutations.push({ type: m.type, x: m.x, y: m.y });
            this.totalMutationsApplied++;
          });
          if (rebuildEntities) {
            this.resetLevelEntities();
          }
          this.callbacks.onGemmaRequest?.({
            kind: 'mutation-applied',
            status: 'applied',
            accepted: data.mutations.length,
            rejected: data.rejectedMutations?.length || 0,
            receivedAt: new Date().toISOString()
          });
          this.audio.playMutationGlitch();
        }
      }
    } catch (err) {
      if (requestGeneration !== this.runGeneration) return;
      this.callbacks.onGemmaRequest?.({
        kind: 'mutation',
        status: 'offline-fallback',
        request: { telemetry: this.telemetry.exportPayload() },
        error: `Request failed after retry; local fallback remains active. ${String(err)}`,
        receivedAt: new Date().toISOString()
      });
      console.warn('Gemma mutation request failed:', err);
    } finally {
      this.mutationRequestInFlight = false;
    }
  }

  private respawnPlayer() {
    this.respawnTimer = 0;
    this.deathRecorded = false;
    this.player.reset(this.level.checkpointX, this.level.checkpointY);
    this.telemetry.startNewRun(this.player.x);
    this.resetLevelEntities();
  }

  private spawnParticles(x: number, y: number, count: number, color: string, size: number = 3) {
    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 220;
      this.particles.push(new Particle(
        x,
        y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed - 100,
        0.4 + Math.random() * 0.4,
        color,
        size
      ));
    }
  }

  private render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // 1. Retro Kaizo Parallax Background
    this.renderBackground();

    // 2. Level Tiles & Traps
    this.level.render(this.ctx, this.cameraX, this.canvas.width, this.canvas.height);

    // 3. Enemies & Entities
    this.enemies.forEach(e => {
      if (!e.dead) e.render(this.ctx, this.cameraX);
    });

    // 4. Speedrunner Ghost Path (Visual proof that level remains beatable)
    if (this.showGhostPath) {
      this.renderGhostPath();
    }

    // 5. Visual Death Heatmap
    this.heatmap.render(this.ctx, this.telemetry.deathHistory, this.cameraX, this.canvas.width);

    // 6. Player
    this.player.render(this.ctx, this.cameraX);

    // 7. Particle Effects
    this.particles.forEach(p => p.render(this.ctx, this.cameraX));
  }

  private renderBackground() {
    const time = performance.now() / 1000;

    // Ink-and-wash Mississippi twilight: navy sky, brass moon, and a warm
    // horizon that makes the deckhand silhouette read like a hand-inked cel.
    if (!this.backgroundGradient || this.backgroundGradientHeight !== this.canvas.height) {
      this.backgroundGradient = this.ctx.createLinearGradient(0, 0, 0, this.canvas.height);
      this.backgroundGradient.addColorStop(0, '#101827');   // Ink-blue night
      this.backgroundGradient.addColorStop(0.42, '#26324a'); // Indigo haze
      this.backgroundGradient.addColorStop(0.78, '#704332'); // Sepia horizon
      this.backgroundGradient.addColorStop(1, '#102f45');   // River shadow
      this.backgroundGradientHeight = this.canvas.height;
    }
    const skyGrad = this.backgroundGradient;
    this.ctx.fillStyle = skyGrad;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

    // A restrained night sky gives the deck a clear setting instead of a flat fill.
    this.ctx.fillStyle = 'rgba(255, 235, 180, 0.7)';
    const stars = [[72, 34], [164, 58], [286, 28], [418, 72], [566, 42], [704, 66]];
    stars.forEach(([sx, sy], index) => {
      const twinkle = 1 + Math.sin(time * 1.5 + index) * 0.35;
      this.ctx.fillRect(sx - (this.cameraX * 0.04) % 800, sy, twinkle * 2, twinkle * 2);
    });

    this.ctx.fillStyle = 'rgba(255, 224, 160, 0.18)';
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.width - 130, 86, 42, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = 'rgba(255, 238, 190, 0.9)';
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.width - 140, 78, 28, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.fillStyle = '#26324a';
    this.ctx.beginPath();
    this.ctx.arc(this.canvas.width - 128, 69, 27, 0, Math.PI * 2);
    this.ctx.fill();

    // Long moonlit bands suggest open water without competing with gameplay.
    this.ctx.save();
    this.ctx.globalAlpha = 0.09;
    this.ctx.fillStyle = '#f6d88c';
    this.ctx.beginPath();
    this.ctx.moveTo(this.canvas.width - 190, 104);
    this.ctx.lineTo(this.canvas.width - 60, 104);
    this.ctx.lineTo(this.canvas.width - 18, 220);
    this.ctx.lineTo(this.canvas.width - 250, 220);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.restore();

    // Original Halloween silhouettes: simple bats and river fog, not
    // references to any copyrighted character or asset.
    this.ctx.fillStyle = 'rgba(10, 15, 25, 0.82)';
    const bats = [[150, 112], [380, 92], [650, 128]];
    bats.forEach(([bx, by], index) => {
      const drift = Math.sin(time * 1.4 + index) * 5;
      this.ctx.beginPath();
      this.ctx.moveTo(bx, by + drift);
      this.ctx.quadraticCurveTo(bx - 9, by - 8 + drift, bx - 17, by + 1 + drift);
      this.ctx.quadraticCurveTo(bx - 12, by + 10 + drift, bx, by + 5 + drift);
      this.ctx.quadraticCurveTo(bx + 12, by + 10 + drift, bx + 17, by + 1 + drift);
      this.ctx.quadraticCurveTo(bx + 9, by - 8 + drift, bx, by + drift);
      this.ctx.fill();
    });

    // Distant stern and smokestacks: a layered ink silhouette anchors the
    // setting as a riverboat rather than a generic night platform.
    this.ctx.save();
    this.ctx.fillStyle = 'rgba(7, 16, 23, 0.72)';
    this.ctx.beginPath();
    this.ctx.moveTo(18, 220);
    this.ctx.lineTo(112, 220);
    this.ctx.lineTo(136, 205);
    this.ctx.lineTo(218, 205);
    this.ctx.lineTo(246, 220);
    this.ctx.lineTo(304, 220);
    this.ctx.lineTo(320, 232);
    this.ctx.lineTo(0, 232);
    this.ctx.closePath();
    this.ctx.fill();
    this.ctx.fillRect(92, 178, 18, 28);
    this.ctx.fillRect(188, 168, 18, 37);
    this.ctx.fillStyle = 'rgba(213, 168, 93, 0.38)';
    this.ctx.fillRect(94, 181, 14, 3);
    this.ctx.fillRect(190, 171, 14, 3);
    this.ctx.restore();

    // Billowing warm steam puffs from the ship's engine.
    this.ctx.fillStyle = 'rgba(245, 240, 232, 0.16)';
    for (let s = 0; s < 6; s++) {
      const sx = ((s * 150) - (this.cameraX * 0.15) + (time * 30)) % (this.canvas.width + 120) - 60;
      const sy = 40 + Math.sin(time * 2 + s) * 12;
      const rad = 24 + (s % 3) * 10;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      this.ctx.arc(sx + 18, sy - 8, rad * 0.8, 0, Math.PI * 2);
      this.ctx.fill();
    }

    // Distant misty Mississippi riverbanks (willow tree mounds)
    this.ctx.fillStyle = '#18202a';
    for (let i = -1; i < 12; i++) {
      const mx = (i * 160) - (this.cameraX * 0.2) % 160;
      this.ctx.beginPath();
      this.ctx.moveTo(mx, 12 * TILE_SIZE);
      this.ctx.quadraticCurveTo(mx + 80, 12 * TILE_SIZE - 90, mx + 160, 12 * TILE_SIZE);
      this.ctx.closePath();
      this.ctx.fill();
    }
    this.ctx.fillStyle = 'rgba(180, 203, 198, 0.08)';
    this.ctx.fillRect(0, 11 * TILE_SIZE, this.canvas.width, 28);

    // The riverboat identity is carried by the deck, funnels, bell and
    // pennant. Avoid a giant foreground paddlewheel that clips at camera
    // boundaries and reads like an unexplained obstacle.
  }

  private renderGhostPath() {
    this.ctx.save();
    this.ctx.strokeStyle = '#22c55e';
    this.ctx.lineWidth = 3;
    this.ctx.setLineDash([6, 6]);

    this.ctx.beginPath();
    const startX = this.player.x - this.cameraX;
    const startY = this.player.y + 15;
    this.ctx.moveTo(startX, startY);

    // Trace simulated speedrunner parabolic arc
    let simX = this.player.x;
    let simY = this.player.y;
    let simVx = 280;
    let simVy = -500;

    for (let i = 0; i < 40; i++) {
      simX += simVx * 0.025;
      simVy += 1350 * 0.025;
      simY += simVy * 0.025;
      this.ctx.lineTo(simX - this.cameraX, simY + 15);
    }
    this.ctx.stroke();

    // "SOLVABLE ROUTE" badge
    this.ctx.fillStyle = '#22c55e';
    this.ctx.font = 'bold 12px monospace';
    this.ctx.fillText('~ ESTIMATED CLEARANCE PATH', startX + 30, startY - 20);
    this.ctx.restore();
  }
}
