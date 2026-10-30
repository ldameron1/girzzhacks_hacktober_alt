import { Player, PlayerInput } from './player.js';
import { Level, TILE_SIZE, TileType } from './level.js';
import { Entity, Gloomba } from './entities.js';

export class AutonomousPlayerBot {
  public enabled: boolean = false;
  public currentTactic: string = 'Advancing';
  public lastModelUsed: string = 'Reflex Engine';
  public latencyMs: number = 0;

  private jumpHoldTimer: number = 0;
  private currentJumpDuration: number = 0;
  private isJumping: boolean = false;
  private queryCooldown: number = 0;
  private isQuerying: boolean = false;

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  computeInput(dt: number, player: Player, level: Level, enemies: Entity[]): PlayerInput {
    if (!this.enabled) {
      return { left: false, right: false, jump: false, jumpPressed: false, sprint: false };
    }

    this.queryCooldown -= dt;

    // Trigger strategic API query periodically
    if (this.queryCooldown <= 0 && !this.isQuerying) {
      this.triggerStrategicQuery(player, level, enemies);
      this.queryCooldown = 0.75; // Query model every 750ms
    }

    // High frequency reflex execution
    let jump = false;
    let jumpPressed = false;
    let right = true;
    let left = false;
    let sprint = true;

    // Detect immediate gap ahead (< 64px)
    const currentTileX = Math.floor(player.x / TILE_SIZE);
    const groundY = Math.floor((player.y + player.height + 2) / TILE_SIZE);

    let gapAhead = false;
    for (let checkX = currentTileX + 1; checkX <= currentTileX + 3; checkX++) {
      if (level.getTile(checkX, groundY) === TileType.EMPTY) {
        gapAhead = true;
        break;
      }
    }

    // Detect immediate enemy ahead
    let enemyAhead = false;
    for (const e of enemies) {
      if (!e.dead && e.x > player.x && e.x - player.x < 75 && Math.abs(e.y - player.y) < 40) {
        enemyAhead = true;
        break;
      }
    }

    // Reflex jump trigger
    if ((gapAhead || enemyAhead) && player.onGround && !this.isJumping) {
      jump = true;
      jumpPressed = true;
      this.isJumping = true;
      this.currentJumpDuration = 0.28;
      this.jumpHoldTimer = this.currentJumpDuration;
    }

    // Manage jump hold duration for variable jump arc
    if (this.isJumping) {
      this.jumpHoldTimer -= dt;
      if (this.jumpHoldTimer > 0) {
        jump = true;
      } else {
        this.isJumping = false;
      }
    }

    return {
      left,
      right,
      jump,
      jumpPressed,
      sprint
    };
  }

  private async triggerStrategicQuery(player: Player, level: Level, enemies: Entity[]) {
    this.isQuerying = true;
    try {
      const tileX = Math.floor(player.x / TILE_SIZE);
      const tileY = Math.floor(player.y / TILE_SIZE);

      // Build ASCII horizon representation (12 tiles wide x 6 tiles high)
      let asciiGrid = '';
      for (let y = Math.max(0, tileY - 2); y <= Math.min(level.height - 1, tileY + 3); y++) {
        let rowStr = '';
        for (let x = tileX; x <= Math.min(level.width - 1, tileX + 11); x++) {
          const t = level.getTile(x, y);
          if (x === tileX && y === tileY) rowStr += 'P';
          else if (t === TileType.SOLID) rowStr += '#';
          else if (t === TileType.CRUMBLING) rowStr += '~';
          else if (t === TileType.SPIKE) rowStr += '^';
          else if (t === TileType.SPRING) rowStr += 'O';
          else if (t === TileType.FLAGPOLE) rowStr += 'F';
          else if (t === TileType.KAIZO && level.isKaizoRevealed(x, y)) rowStr += 'K';
          else rowStr += '.';
        }
        asciiGrid += rowStr + '\n';
      }

      // Find nearest gap distance
      let gapDist = 999;
      for (let x = tileX; x < tileX + 10; x++) {
        if (level.getTile(x, 15) === TileType.EMPTY) {
          gapDist = (x * TILE_SIZE) - player.x;
          break;
        }
      }

      // Find nearest enemy distance
      let enemyDist = 999;
      for (const e of enemies) {
        if (!e.dead && e.x > player.x) {
          enemyDist = Math.min(enemyDist, e.x - player.x);
        }
      }

      const res = await fetch('/api/decision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          x: player.x,
          y: player.y,
          vx: player.vx,
          vy: player.vy,
          onGround: player.onGround,
          facing: player.facing,
          currentSpeed: Math.abs(player.vx),
          upcomingTiles: asciiGrid,
          nearestGapDistance: Math.round(gapDist),
          nearestEnemyDistance: Math.round(enemyDist),
          knownTrapsCount: level.dynamicState.size
        })
      });

      if (res.ok) {
        const data = await res.json();
        this.currentTactic = `${data.action}: ${data.reasoning}`;
        this.lastModelUsed = data.modelUsed || 'Reflex Model';
        this.latencyMs = data.latencyMs || 0;
      }
    } catch (e) {
      // Keep running locally
    } finally {
      this.isQuerying = false;
    }
  }
}
