import { Box, Physics } from './physics.js';
import { Level, TILE_SIZE, TileType } from './level.js';
import { AudioManager } from './audio.js';

export interface PlayerInput {
  left: boolean;
  right: boolean;
  jump: boolean;
  jumpPressed: boolean;
  sprint: boolean;
}

export class Player implements Box {
  public x: number;
  public y: number;
  public width: number = 22;
  public height: number = 30;
  public vx: number = 0;
  public vy: number = 0;

  public onGround: boolean = false;
  public onWall: boolean = false;
  public wallDir: number = 0;
  public facing: 'left' | 'right' = 'right';

  public isDead: boolean = false;
  public deathCause: string = '';
  public hasWon: boolean = false;

  // Consecutive deaths for Game Over
  public consecutiveDeaths: number = 0;
  public isGameOver: boolean = false;

  // Jump physics constants
  private readonly WALK_SPEED = 200;
  private readonly SPRINT_SPEED = 320;
  private readonly ACCELERATION = 950;
  private readonly FRICTION = 850;
  private readonly GRAVITY = 1350;
  private readonly JUMP_FORCE = -520;
  private readonly WALL_JUMP_FORCE_Y = -480;
  private readonly WALL_JUMP_FORCE_X = 260;

  // Timers
  private coyoteTimer: number = 0;
  private jumpBufferTimer: number = 0;
  public jumpHoldTimer: number = 0;
  public isHoldingJump: boolean = false;

  // Death sequence
  private deathVy: number = -400;
  private animTimer: number = 0;

  // Steam-lantern idle animation
  private whistleTimer: number = 0;

  constructor(startX: number, startY: number) {
    this.x = startX;
    this.y = startY;
  }

  reset(x: number, y: number) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.onGround = false;
    this.onWall = false;
    this.isDead = false;
    this.deathCause = '';
    this.hasWon = false;
    this.coyoteTimer = 0;
    this.jumpBufferTimer = 0;
    this.jumpHoldTimer = 0;
    this.deathVy = -400;
    this.whistleTimer = 0;
  }

  kill(cause: string, audio: AudioManager) {
    if (this.isDead || this.hasWon) return;
    this.isDead = true;
    this.deathCause = cause;
    this.deathVy = -480;
    this.consecutiveDeaths++;
    if (this.consecutiveDeaths >= 5) {
      this.isGameOver = true;
    }
    audio.playDeath();
  }

  clearConsecutiveDeaths() {
    this.consecutiveDeaths = 0;
    this.isGameOver = false;
  }

  update(dt: number, input: PlayerInput, level: Level, audio: AudioManager) {
    this.animTimer += dt;
    this.whistleTimer += dt;

    if (this.isDead) {
      this.deathVy += 1300 * dt;
      this.y += this.deathVy * dt;
      return;
    }

    if (this.hasWon) {
      this.vy = 120;
      this.y += this.vy * dt;
      return;
    }

    const maxSpeed = input.sprint ? this.SPRINT_SPEED : this.WALK_SPEED;

    // Horizontal acceleration & friction
    if (input.left && !input.right) {
      this.facing = 'left';
      if (this.vx > 0) this.vx -= this.FRICTION * 1.8 * dt;
      this.vx = Math.max(-maxSpeed, this.vx - this.ACCELERATION * dt);
    } else if (input.right && !input.left) {
      this.facing = 'right';
      if (this.vx < 0) this.vx += this.FRICTION * 1.8 * dt;
      this.vx = Math.min(maxSpeed, this.vx + this.ACCELERATION * dt);
    } else {
      if (this.vx > 0) {
        this.vx = Math.max(0, this.vx - this.FRICTION * dt);
      } else if (this.vx < 0) {
        this.vx = Math.min(0, this.vx + this.FRICTION * dt);
      }
    }

    // Coyote time tracking
    if (this.onGround) {
      this.coyoteTimer = 0.1;
    } else {
      this.coyoteTimer = Math.max(0, this.coyoteTimer - dt);
    }

    // Jump buffer tracking
    if (input.jumpPressed) {
      this.jumpBufferTimer = 0.12;
    } else {
      this.jumpBufferTimer = Math.max(0, this.jumpBufferTimer - dt);
    }

    // Jump execution
    if (this.jumpBufferTimer > 0) {
      if (this.coyoteTimer > 0) {
        this.vy = this.JUMP_FORCE;
        this.onGround = false;
        this.coyoteTimer = 0;
        this.jumpBufferTimer = 0;
        this.isHoldingJump = true;
        this.jumpHoldTimer = 0;
        audio.playJump();
      } else if (this.onWall && !this.onGround) {
        this.vy = this.WALL_JUMP_FORCE_Y;
        this.vx = -this.wallDir * this.WALL_JUMP_FORCE_X;
        this.facing = this.wallDir < 0 ? 'right' : 'left';
        this.onWall = false;
        this.jumpBufferTimer = 0;
        audio.playJump();
      }
    }

    // Variable jump height cut
    if (this.isHoldingJump) {
      this.jumpHoldTimer += dt;
      if (!input.jump && this.vy < -150) {
        this.vy *= 0.45;
        this.isHoldingJump = false;
      }
    }

    // Gravity
    const effectiveGravity = (this.vy > 0) ? this.GRAVITY * 1.25 : this.GRAVITY;
    this.vy += effectiveGravity * dt;

    // Wall slide damping
    if (this.onWall && this.vy > 100) {
      this.vy = 100;
    }

    // Horizontal Movement & Collisions
    this.x += this.vx * dt;
    this.checkHorizontalCollisions(level);

    // Vertical Movement & Collisions
    this.y += this.vy * dt;
    this.checkVerticalCollisions(level, audio);

    // Pit death
    if (this.y > (level.height + 2) * TILE_SIZE) {
      this.kill('Fell into bottomless pit', audio);
    }
  }

  private checkHorizontalCollisions(level: Level) {
    const startTileX = Math.floor(this.x / TILE_SIZE);
    const endTileX = Math.floor((this.x + this.width) / TILE_SIZE);
    const startTileY = Math.floor(this.y / TILE_SIZE);
    const endTileY = Math.floor((this.y + this.height - 1) / TILE_SIZE);

    this.onWall = false;
    this.wallDir = 0;

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const tile = level.getTile(tx, ty);

        if (tile === TileType.SOLID || tile === TileType.QUESTION || (tile === TileType.KAIZO && level.isKaizoRevealed(tx, ty))) {
          if (this.vx > 0) {
            this.x = tx * TILE_SIZE - this.width;
            this.vx = 0;
            this.onWall = true;
            this.wallDir = 1;
          } else if (this.vx < 0) {
            this.x = (tx + 1) * TILE_SIZE;
            this.vx = 0;
            this.onWall = true;
            this.wallDir = -1;
          }
        }
      }
    }
  }

  private checkVerticalCollisions(level: Level, audio: AudioManager) {
    const startTileX = Math.floor((this.x + 3) / TILE_SIZE);
    const endTileX = Math.floor((this.x + this.width - 3) / TILE_SIZE);
    const startTileY = Math.floor(this.y / TILE_SIZE);
    const endTileY = Math.floor((this.y + this.height) / TILE_SIZE);

    this.onGround = false;

    for (let ty = startTileY; ty <= endTileY; ty++) {
      for (let tx = startTileX; tx <= endTileX; tx++) {
        const tile = level.getTile(tx, ty);

        // Lethal Spike Collision
        if (tile === TileType.SPIKE) {
          const spikeBox = { x: tx * TILE_SIZE + 4, y: ty * TILE_SIZE + 4, width: 24, height: 24 };
          if (Physics.checkAABB(this, spikeBox)) {
            this.kill('Impaled by spikes', audio);
            return;
          }
        }

        // Flagpole victory
        if (tile === TileType.FLAGPOLE && ty <= 3) {
          if (!this.hasWon) {
            this.hasWon = true;
            this.consecutiveDeaths = 0; // Victory resets streak
            audio.playVictory();
            return;
          }
        }

        // Downward floor collision
        if (this.vy >= 0) {
          if (tile === TileType.SOLID || tile === TileType.QUESTION || (tile === TileType.KAIZO && level.isKaizoRevealed(tx, ty))) {
            const floorY = ty * TILE_SIZE;
            if (this.y + this.height >= floorY && this.y + this.height - this.vy * 0.05 <= floorY + 12) {
              this.y = floorY - this.height;
              this.vy = 0;
              this.onGround = true;
              this.isHoldingJump = false;
            }
          } else if (tile === TileType.CRUMBLING) {
            const floorY = ty * TILE_SIZE;
            if (this.y + this.height >= floorY) {
              this.y = floorY - this.height;
              this.vy = 0;
              this.onGround = true;
              this.isHoldingJump = false;
              const key = `${tx},${ty}`;
              const state = level.dynamicState.get(key) || { revealed: true };
              if (state.crumbleTimer === undefined) {
                state.crumbleTimer = 0.35;
                level.dynamicState.set(key, state);
              }
            }
          } else if (tile === TileType.SPRING) {
            const floorY = ty * TILE_SIZE;
            if (this.y + this.height >= floorY) {
              this.y = floorY - this.height;
              this.vy = -800;
              audio.playJump();
            }
          }
        }

        // Upward ceiling collision
        if (this.vy < 0) {
          if (tile === TileType.SOLID || tile === TileType.QUESTION) {
            const ceilY = (ty + 1) * TILE_SIZE;
            if (this.y <= ceilY && this.y - this.vy * 0.05 >= ceilY - 12) {
              this.y = ceilY;
              this.vy = 40;
              audio.playStomp();
            }
          } else if (tile === TileType.KAIZO) {
            const ceilY = (ty + 1) * TILE_SIZE;
            if (this.y <= ceilY) {
              this.y = ceilY;
              this.vy = 80;
              level.revealKaizo(tx, ty);
              audio.playKaizoBonk();
            }
          }
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    const px = this.x - cameraX;
    const py = this.y;

    if (this.isDead) {
      ctx.save();
      ctx.translate(px + this.width / 2, py + this.height / 2);
      ctx.rotate(this.animTimer * 12);
      this.drawDeckhand(ctx, -this.width / 2, -this.height / 2, true);
      ctx.restore();
      return;
    }

    this.drawDeckhand(ctx, px, py, false);
  }

  /**
   * Original moonlit deckhand sprite: a compact brass-and-navy silhouette
   * designed for this steamboat setting without imitating a known character.
   */
  private drawDeckhand(ctx: CanvasRenderingContext2D, px: number, py: number, shocked: boolean) {
    ctx.save();

    if (this.facing === 'left' && !shocked) {
      ctx.translate(px + this.width, py);
      ctx.scale(-1, 1);
      px = 0;
      py = 0;
    }

    // A compact ink keyline keeps the deckhand readable against moonlit fog.
    ctx.fillStyle = 'rgba(5, 12, 18, 0.82)';
    ctx.fillRect(px + 2, py + 2, 18, 27);
    ctx.fillRect(px - 1, py + 24, 25, 5);

    // Brass cap and shadowed faceplate.
    ctx.fillStyle = '#172b35';
    ctx.fillRect(px + 4, py + 3, 14, 10);
    ctx.fillStyle = '#d5a85d';
    ctx.fillRect(px + 3, py, 16, 4);
    ctx.fillStyle = shocked ? '#ef4444' : '#8ed0c1';
    ctx.fillRect(px + 8, py + 7, 8, 3);

    // Navy work coat with brass fasteners.
    ctx.fillStyle = '#203b48';
    ctx.fillRect(px + 4, py + 13, 14, 12);
    ctx.fillStyle = '#31566a';
    ctx.fillRect(px + 6, py + 14, 3, 10);
    ctx.fillStyle = '#d5a85d';
    ctx.fillRect(px + 10, py + 15, 2, 2);
    ctx.fillRect(px + 10, py + 20, 2, 2);

    // Flexible tool arms.
    ctx.strokeStyle = '#172b35';
    ctx.lineWidth = 3;
    const armWave = Math.sin(this.animTimer * 8) * 4;
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 17);
    ctx.quadraticCurveTo(px - 2, py + 20 + armWave, px, py + 26);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 17, py + 17);
    ctx.quadraticCurveTo(px + 24, py + 20 - armWave, px + 22, py + 26);
    ctx.stroke();
    ctx.fillStyle = '#d5a85d';
    ctx.fillRect(px - 2, py + 25, 4, 3);
    ctx.fillRect(px + 20, py + 25, 4, 3);

    // Boots and compact stance.
    const walkBob = (this.onGround && Math.abs(this.vx) > 20) ? Math.sin(this.animTimer * 16) * 3 : 0;
    ctx.strokeStyle = '#172b35';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 26);
    ctx.lineTo(px + 5, py + 29 + walkBob);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 15, py + 26);
    ctx.lineTo(px + 17, py + 29 - walkBob);
    ctx.stroke();
    ctx.fillStyle = '#111c23';
    ctx.beginPath();
    ctx.ellipse(px + 4, py + 29 + walkBob, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + 18, py + 29 - walkBob, 4, 2, 0, 0, Math.PI * 2);
    ctx.fill();

    // Steam-lantern puff when idle.
    if (this.onGround && Math.abs(this.vx) < 10 && !shocked) {
      const puffPhase = Math.sin(this.whistleTimer * 3);
      if (puffPhase > 0.5) {
        ctx.fillStyle = 'rgba(200, 220, 214, 0.5)';
        ctx.beginPath();
        ctx.arc(px + 20, py + 6 - puffPhase * 4, 2 + puffPhase * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + 23, py + 3 - puffPhase * 6, 1.5 + puffPhase, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
