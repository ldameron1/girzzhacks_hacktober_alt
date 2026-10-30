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
  private stuckTimer: number = 0;
  private lastX: number = 0;

  toggle(): boolean {
    this.enabled = !this.enabled;
    return this.enabled;
  }

  computeInput(dt: number, player: Player, level: Level, enemies: Entity[]): PlayerInput {
    if (!this.enabled) {
      return { left: false, right: false, jump: false, jumpPressed: false, sprint: false };
    }

    this.queryCooldown -= dt;

    // Track stuck state — if X hasn't changed in 0.8s, something's wrong
    if (Math.abs(player.x - this.lastX) < 2) {
      this.stuckTimer += dt;
    } else {
      this.stuckTimer = 0;
    }
    this.lastX = player.x;

    // Trigger strategic API query periodically
    if (this.queryCooldown <= 0 && !this.isQuerying) {
      this.triggerStrategicQuery(player, level, enemies);
      this.queryCooldown = 1.0;
    }

    // =============================================
    //  HIGH-FREQUENCY REFLEX CONTROLLER (~60 FPS)
    // =============================================
    let jump = false;
    let jumpPressed = false;
    let right = true;
    let left = false;
    let sprint = true;

    const tileX = Math.floor(player.x / TILE_SIZE);
    const tileY = Math.floor(player.y / TILE_SIZE);
    const groundY = Math.floor((player.y + player.height + 2) / TILE_SIZE);

    // 1. Lookahead: Scan tiles ahead for gaps, spikes, enemies
    let gapDistance = -1;      // px to nearest gap edge
    let gapWidth = 0;          // tiles of gap
    let spikeAhead = false;
    let crumblingAhead = false;
    let springAhead = false;
    let wallAhead = false;

    for (let dx = 1; dx <= 6; dx++) {
      const checkX = tileX + dx;
      const floorTile = level.getTile(checkX, groundY);
      const bodyTile = level.getTile(checkX, tileY);
      const bodyTileBelow = level.getTile(checkX, tileY + 1);

      // Gap detection
      if (floorTile === TileType.EMPTY && gapDistance < 0) {
        gapDistance = (checkX * TILE_SIZE) - player.x;
        // Measure gap width
        for (let gx = checkX; gx < checkX + 8; gx++) {
          if (level.getTile(gx, groundY) === TileType.EMPTY) {
            gapWidth++;
          } else break;
        }
      }

      // Spike detection
      if (floorTile === TileType.SPIKE || bodyTile === TileType.SPIKE || bodyTileBelow === TileType.SPIKE) {
        spikeAhead = true;
      }

      // Crumbling floor ahead
      if (floorTile === TileType.CRUMBLING) {
        crumblingAhead = true;
      }

      // Spring detection
      if (floorTile === TileType.SPRING || bodyTileBelow === TileType.SPRING) {
        springAhead = true;
      }

      // Wall blocking horizontal path
      if (bodyTile === TileType.SOLID || bodyTileBelow === TileType.SOLID) {
        wallAhead = true;
      }
    }

    // Detect enemies ahead
    let nearestEnemyDist = 999;
    let nearestEnemyAbove = false;
    for (const e of enemies) {
      if (e.dead) continue;
      const dx = e.x - player.x;
      if (dx > 0 && dx < nearestEnemyDist) {
        nearestEnemyDist = dx;
        nearestEnemyAbove = e.y < player.y;
      }
    }

    // 2. Decision Logic

    // Stuck recovery: back up and try jumping
    if (this.stuckTimer > 0.6 && player.onGround) {
      if (this.stuckTimer > 1.2) {
        // Back up for a running start
        right = false;
        left = true;
        sprint = true;
        if (this.stuckTimer > 1.8) {
          this.stuckTimer = 0; // Reset and try again
        }
      } else {
        // Try a jump
        jump = true;
        jumpPressed = true;
        this.isJumping = true;
        this.jumpHoldTimer = 0.35;
        this.stuckTimer = 0;
      }
    }

    // Wall ahead: jump over it
    else if (wallAhead && !this.isJumping && player.onGround) {
      jump = true;
      jumpPressed = true;
      this.isJumping = true;
      this.jumpHoldTimer = 0.32;
      this.currentTactic = 'Wall jump-over';
    }

    // Gap ahead
    else if (gapDistance > 0 && gapDistance < 90 && player.onGround && !this.isJumping) {
      // Wide gap: sprint jump with long hold
      if (gapWidth >= 3) {
        sprint = true;
        if (gapDistance < 55) {
          jump = true;
          jumpPressed = true;
          this.isJumping = true;
          this.jumpHoldTimer = 0.38; // Full hold for max distance
          this.currentTactic = `Sprint-leaping ${gapWidth}-tile gap`;
        }
      }
      // Narrow gap: standard jump
      else {
        if (gapDistance < 50) {
          jump = true;
          jumpPressed = true;
          this.isJumping = true;
          this.jumpHoldTimer = 0.22;
          this.currentTactic = `Hopping ${gapWidth}-tile gap`;
        }
      }
    }

    // Spike ahead: micro-hop to clear
    else if (spikeAhead && player.onGround && !this.isJumping) {
      jump = true;
      jumpPressed = true;
      this.isJumping = true;
      this.jumpHoldTimer = 0.25;
      sprint = false; // Careful approach
      this.currentTactic = 'Clearing spikes';
    }

    // Enemy ahead: stomp or dodge
    else if (nearestEnemyDist < 80 && player.onGround && !this.isJumping) {
      jump = true;
      jumpPressed = true;
      this.isJumping = true;
      // If enemy is close, do a short stomp hop
      this.jumpHoldTimer = nearestEnemyDist < 45 ? 0.18 : 0.26;
      sprint = nearestEnemyDist > 50;
      this.currentTactic = 'Stomping enemy';
    }

    // Crumbling floor: sprint through fast, don't hesitate
    else if (crumblingAhead) {
      sprint = true;
      this.currentTactic = 'Sprinting over crumbling bridge';
    }

    // Spring: just walk into it and hold jump to maximize launch height
    else if (springAhead) {
      sprint = false;
      jump = true;
      this.currentTactic = 'Riding spring launcher';
    }

    // Default: run right
    else {
      this.currentTactic = 'Advancing →';
    }

    // Wall-kick recovery: if on wall and not on ground, kick off
    if (player.onWall && !player.onGround && !this.isJumping) {
      jump = true;
      jumpPressed = true;
      this.isJumping = true;
      this.jumpHoldTimer = 0.2;
      this.currentTactic = 'Wall-kicking';
    }

    // Air recovery: if falling into void, try to steer
    if (!player.onGround && player.vy > 200 && player.y > 14 * TILE_SIZE) {
      // Too late — just accept fate
      this.currentTactic = '...accepting gravity';
    }

    // Manage jump hold duration for variable height control
    if (this.isJumping) {
      this.jumpHoldTimer -= dt;
      if (this.jumpHoldTimer > 0) {
        jump = true;
      } else {
        this.isJumping = false;
      }
    }

    return { left, right, jump, jumpPressed, sprint };
  }

  private async triggerStrategicQuery(player: Player, level: Level, enemies: Entity[]) {
    this.isQuerying = true;
    try {
      const tileX = Math.floor(player.x / TILE_SIZE);
      const tileY = Math.floor(player.y / TILE_SIZE);

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

      let gapDist = 999;
      for (let x = tileX; x < tileX + 10; x++) {
        if (level.getTile(x, 15) === TileType.EMPTY) {
          gapDist = (x * TILE_SIZE) - player.x;
          break;
        }
      }

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
