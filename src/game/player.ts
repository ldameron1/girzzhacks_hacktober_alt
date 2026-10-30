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

  // Steamboat Willie whistle animation
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
        if (tile === TileType.FLAGPOLE) {
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
      this.drawSteamboatWillie(ctx, -this.width / 2, -this.height / 2, true);
      ctx.restore();
      return;
    }

    this.drawSteamboatWillie(ctx, px, py, false);
  }

  /**
   * Steamboat Willie (1928) inspired character sprite.
   * Public domain since January 1, 2024.
   * Classic black-and-white rubber hose style.
   */
  private drawSteamboatWillie(ctx: CanvasRenderingContext2D, px: number, py: number, shocked: boolean) {
    ctx.save();

    // Flip if facing left
    if (this.facing === 'left' && !shocked) {
      ctx.translate(px + this.width, py);
      ctx.scale(-1, 1);
      px = 0;
      py = 0;
    }

    // ---- STEAMBOAT WILLIE CLASSIC MONOCHROME ----

    // Ears (two round circles on top of head — the iconic silhouette)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.arc(px + 5, py + 3, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 17, py + 3, 5, 0, Math.PI * 2);
    ctx.fill();

    // Head (oval)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(px + 11, py + 9, 8, 7, 0, 0, Math.PI * 2);
    ctx.fill();

    // Face / snout area (lighter oval)
    ctx.fillStyle = '#f5f0e8';
    ctx.beginPath();
    ctx.ellipse(px + 13, py + 11, 5, 4, 0, 0, Math.PI * 2);
    ctx.fill();

    // Eye (classic pie-eye: white ellipse with black dot)
    ctx.fillStyle = '#f5f0e8';
    ctx.beginPath();
    ctx.ellipse(px + 11, py + 8, 3, 3.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Pupil
    ctx.fillStyle = shocked ? '#ef4444' : '#000000';
    const pupilX = this.facing === 'right' || shocked ? 12 : 10;
    ctx.beginPath();
    ctx.arc(px + pupilX, py + 8, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Nose (small black oval)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(px + 16, py + 10, 2, 1.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Mouth / grin
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px + 14, py + 12, 3, 0.1, Math.PI - 0.1, false);
    ctx.stroke();

    // Steamboat captain hat (the classic small pillbox)
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 4, py - 2, 14, 4);
    ctx.fillStyle = '#3a3a3a';
    ctx.fillRect(px + 6, py - 5, 10, 4);

    // Body (black with white buttons — classic 1928 shorts)
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(px + 5, py + 15, 12, 8);

    // Shorts / lower body
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(px + 4, py + 21, 14, 5);

    // White buttons on shorts (iconic)
    ctx.fillStyle = '#f5f0e8';
    ctx.beginPath();
    ctx.arc(px + 8, py + 23, 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 14, py + 23, 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Arms (rubber hose noodle arms)
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    const armWave = Math.sin(this.animTimer * 8) * 4;
    // Back arm
    ctx.beginPath();
    ctx.moveTo(px + 5, py + 17);
    ctx.quadraticCurveTo(px - 2, py + 20 + armWave, px, py + 26);
    ctx.stroke();
    // Front arm
    ctx.beginPath();
    ctx.moveTo(px + 17, py + 17);
    ctx.quadraticCurveTo(px + 24, py + 20 - armWave, px + 22, py + 26);
    ctx.stroke();

    // Gloves (white circles on hands)
    ctx.fillStyle = '#f5f0e8';
    ctx.beginPath();
    ctx.arc(px, py + 26, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 22, py + 26, 3, 0, Math.PI * 2);
    ctx.fill();

    // Legs (rubber hose style)
    const walkBob = (this.onGround && Math.abs(this.vx) > 20) ? Math.sin(this.animTimer * 16) * 3 : 0;
    ctx.strokeStyle = '#1a1a1a';
    ctx.lineWidth = 3;
    // Left leg
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 26);
    ctx.lineTo(px + 5, py + 29 + walkBob);
    ctx.stroke();
    // Right leg
    ctx.beginPath();
    ctx.moveTo(px + 15, py + 26);
    ctx.lineTo(px + 17, py + 29 - walkBob);
    ctx.stroke();

    // Shoes (big round classic shoes)
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath();
    ctx.ellipse(px + 4, py + 29 + walkBob, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + 18, py + 29 - walkBob, 5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Whistle steam puff when idle (Steamboat Willie iconic animation)
    if (this.onGround && Math.abs(this.vx) < 10 && !shocked) {
      const puffPhase = Math.sin(this.whistleTimer * 3);
      if (puffPhase > 0.5) {
        ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
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
