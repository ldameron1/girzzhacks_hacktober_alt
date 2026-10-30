import { Level, TILE_SIZE, TileType } from './level.js';
import { Player } from './player.js';

export interface DeathRecord {
  x: number;
  y: number;
  cause: string;
  timestamp: number;
}

export class TelemetryRecorder {
  private static readonly MAX_DEATH_HISTORY = 100;
  public totalRuns: number = 0;
  public totalDeaths: number = 0;
  public furthestX: number = 0;
  public coinsCollected: number = 0;

  // Granular behavioral metrics
  private speedsSampled: number[] = [];
  private sprintTicks: number = 0;
  private totalTicks: number = 0;
  public hesitationSeconds: number = 0;
  private jumpsHeldDurations: number[] = [];
  private edgeDistancesSampled: number[] = [];
  private directionChanges: number = 0;
  private lastFacing: string = 'right';

  public deathHistory: DeathRecord[] = [];
  public currentDifficulty: number = 3;

  startNewRun(spawnX: number) {
    this.totalRuns++;
    this.furthestX = Math.max(this.furthestX, spawnX);
  }

  reset() {
    this.totalRuns = 0;
    this.totalDeaths = 0;
    this.furthestX = 0;
    this.coinsCollected = 0;
    this.speedsSampled = [];
    this.sprintTicks = 0;
    this.totalTicks = 0;
    this.hesitationSeconds = 0;
    this.jumpsHeldDurations = [];
    this.edgeDistancesSampled = [];
    this.directionChanges = 0;
    this.lastFacing = 'right';
    this.deathHistory = [];
    this.currentDifficulty = 3;
  }

  recordTick(dt: number, player: Player, level: Level, sprintHeld: boolean) {
    this.totalTicks++;
    if (sprintHeld) this.sprintTicks++;

    const speed = Math.abs(player.vx);
    this.speedsSampled.push(speed);
    if (this.speedsSampled.length > 500) this.speedsSampled.shift();

    this.furthestX = Math.max(this.furthestX, player.x);

    // Direction flips (panic jitter)
    if (player.facing !== this.lastFacing && speed > 20) {
      this.directionChanges++;
      this.lastFacing = player.facing;
    }

    // Detect hesitation near gaps
    if (player.onGround && speed < 30) {
      const tileAheadX = Math.floor((player.x + (player.facing === 'right' ? 32 : -16)) / TILE_SIZE);
      const floorBelow = level.getTile(tileAheadX, Math.floor(player.y / TILE_SIZE) + 1);
      if (floorBelow === TileType.EMPTY) {
        this.hesitationSeconds += dt;
      }
    }
  }

  recordJump(player: Player, level: Level) {
    // Check distance to upcoming ledge
    const currentTileX = Math.floor(player.x / TILE_SIZE);
    const currentTileY = Math.floor((player.y + player.height) / TILE_SIZE);

    let edgeDist = 32;
    for (let checkX = currentTileX; checkX < currentTileX + 4; checkX++) {
      if (level.getTile(checkX, currentTileY) === TileType.EMPTY) {
        edgeDist = (checkX * TILE_SIZE) - player.x;
        break;
      }
    }
    this.edgeDistancesSampled.push(Math.max(0, edgeDist));
  }

  recordJumpEnd(holdDuration: number) {
    this.jumpsHeldDurations.push(holdDuration);
    if (this.jumpsHeldDurations.length > 50) this.jumpsHeldDurations.shift();
  }

  recordDeath(x: number, y: number, cause: string) {
    this.totalDeaths++;
    this.deathHistory.push({
      x,
      y,
      cause,
      timestamp: Date.now()
    });
    if (this.deathHistory.length > TelemetryRecorder.MAX_DEATH_HISTORY) {
      this.deathHistory.shift();
    }
  }

  getAverages() {
    const avgSpeed = this.speedsSampled.length > 0
      ? this.speedsSampled.reduce((a, b) => a + b, 0) / this.speedsSampled.length
      : 150;

    const sprintRatio = this.totalTicks > 0 ? this.sprintTicks / this.totalTicks : 0.3;

    const avgJumpHold = this.jumpsHeldDurations.length > 0
      ? this.jumpsHeldDurations.reduce((a, b) => a + b, 0) / this.jumpsHeldDurations.length
      : 0.22;

    const avgEdgeDist = this.edgeDistancesSampled.length > 0
      ? this.edgeDistancesSampled.reduce((a, b) => a + b, 0) / this.edgeDistancesSampled.length
      : 16;

    const panicRate = Math.min(1.0, this.directionChanges / Math.max(1, this.totalTicks * 0.1));

    return {
      avgSpeed,
      sprintRatio,
      avgJumpHold,
      avgEdgeDist,
      panicRate
    };
  }

  exportPayload() {
    const stats = this.getAverages();
    return {
      totalRuns: this.totalRuns,
      totalDeaths: this.totalDeaths,
      furthestX: this.furthestX,
      averageSpeed: stats.avgSpeed,
      sprintRatio: stats.sprintRatio,
      hesitationTimeSec: this.hesitationSeconds,
      jumpCount: this.jumpsHeldDurations.length,
      jumpHoldAvgSec: stats.avgJumpHold,
      edgeJumpDistanceAvg: stats.avgEdgeDist,
      panicJitterRate: stats.panicRate,
      coinsCollected: this.coinsCollected,
      recentDeaths: this.deathHistory.slice(-5),
      currentDifficulty: this.currentDifficulty
    };
  }
}
