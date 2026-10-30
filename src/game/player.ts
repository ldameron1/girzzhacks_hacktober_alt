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
   * Generic 1928 rubber-hose steamboat deckhand in the public-domain
   * cartoon style of the era: solid ink head with round ears, cream face,
   * pillbox sailor cap, white shorts, hose limbs, gloves and big shoes.
   */
  private drawDeckhand(ctx: CanvasRenderingContext2D, px: number, py: number, shocked: boolean) {
    ctx.save();

    if (this.facing === 'left' && !shocked) {
      ctx.translate(px + this.width, py);
      ctx.scale(-1, 1);
      px = 0;
      py = 0;
    }

    const moving = this.onGround && Math.abs(this.vx) > 20;
    const swing = moving ? Math.sin(this.animTimer * 14) : 0;
    const armSwing = moving ? Math.sin(this.animTimer * 14 + Math.PI) : 0;
    const bob = moving ? Math.abs(Math.sin(this.animTimer * 14)) * 1.5 : 0;
    const airborneLimb = !this.onGround && !shocked;

    ctx.lineWidth = 2.6;
    ctx.strokeStyle = '#000000';
    ctx.lineCap = 'round';

    // ---- Legs: thin rubber-hose lines with big black shoes ----
    const legSpread = 3 + swing * 4;
    ctx.beginPath();
    ctx.moveTo(px + 11, py + 24 + bob * 0.5);
    ctx.quadraticCurveTo(px + 10, py + 27, px + 10 - legSpread, py + 28);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 11, py + 24 + bob * 0.5);
    ctx.quadraticCurveTo(px + 12, py + 27, px + 12 + (airborneLimb ? 5 : legSpread), py + 28 - (airborneLimb ? 3 : 0));
    ctx.stroke();
    // Shoes (large oval black, toe forward)
    const shoeY1 = py + 28;
    const shoeY2 = airborneLimb ? py + 25 : py + 28;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.ellipse(px + 9 - legSpread, shoeY1, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(px + 13 + (airborneLimb ? 5 : legSpread), shoeY2, 4.5, 2.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // ---- Torso: black body ----
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + 6, py + 16 + bob, 10, 9);

    // ---- White shorts with two button dots ----
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 5.5, py + 22 + bob, 11, 5);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(px + 5.5, py + 22 + bob, 11, 5);
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + 8, py + 23.5 + bob, 2, 2);
    ctx.fillRect(px + 12, py + 23.5 + bob, 2, 2);

    // ---- Arms: thin hose lines with big white gloves ----
    const armSpread = 4 + armSwing * 4;
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(px + 7, py + 18 + bob);
    ctx.quadraticCurveTo(px + 2, py + 20 + armSwing * 2, px + 2 - armSpread * 0.5, py + 24);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(px + 15, py + 18 + bob);
    ctx.quadraticCurveTo(px + 20, py + 20 + (moving ? -armSwing * 2 : airborneLimb ? -3 : 0), px + 20 + armSpread * 0.5, py + 24);
    ctx.stroke();
    // Gloves (white circles)
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(px + 2 - armSpread * 0.5, py + 24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(px + 20 + armSpread * 0.5, py + 24, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // ---- Head: big solid black circle + round ears ----
    const headCy = py + 8.5 + bob;
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(px + 11, headCy, 8.5, 0, Math.PI * 2);
    ctx.fill();
    // Ears: two big round black circles on top
    ctx.beginPath();
    ctx.arc(px + 4, py + 2.5 + bob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(px + 18, py + 2.5 + bob, 4, 0, Math.PI * 2);
    ctx.fill();

    // Cream face patch (lower front of head)
    ctx.fillStyle = '#f2ead9';
    ctx.beginPath();
    ctx.ellipse(px + 14, headCy + 3, 5.5, 4.5, 0, 0, Math.PI * 2);
    ctx.fill();

    // Long snout/muzzle extending forward
    ctx.fillStyle = '#f2ead9';
    ctx.beginPath();
    ctx.ellipse(px + 19, headCy + 3, 4, 2.8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    // Black nose tip
    ctx.fillStyle = '#000000';
    ctx.beginPath();
    ctx.arc(px + 22, headCy + 2.5, 1.6, 0, Math.PI * 2);
    ctx.fill();
    // Open smile showing when running
    if (moving || shocked) {
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.ellipse(px + 17, headCy + 5.5, 3.2, 2, 0, 0, Math.PI);
      ctx.fill();
      ctx.fillStyle = '#f2ead9';
      ctx.fillRect(px + 14.4, headCy + 5.5, 5.2, 0.9);
    } else {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(px + 17, headCy + 4.5, 2.2, 0.2, Math.PI - 0.2);
      ctx.stroke();
    }

    // ---- Eyes: pie-cut (white oval + black pupil wedge) ----
    if (shocked) {
      // X eyes during the death spin
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.moveTo(px + 10, headCy - 2);
      ctx.lineTo(px + 13.5, headCy + 1.5);
      ctx.moveTo(px + 13.5, headCy - 2);
      ctx.lineTo(px + 10, headCy + 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(px + 15.5, headCy - 1);
      ctx.lineTo(px + 18.5, headCy + 2);
      ctx.moveTo(px + 18.5, headCy - 1);
      ctx.lineTo(px + 15.5, headCy + 2);
      ctx.stroke();
    } else {
      // Right eye
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.ellipse(px + 15, headCy - 0.5, 2.2, 2.8, 0, 0, Math.PI * 2);
      ctx.fill();
      // Left eye (peeks behind profile)
      ctx.beginPath();
      ctx.ellipse(px + 10.5, headCy - 0.5, 2, 2.6, 0, 0, Math.PI * 2);
      ctx.fill();
      // Pupil wedges (pie-cut)
      ctx.fillStyle = '#000000';
      ctx.beginPath();
      ctx.moveTo(px + 15, headCy - 0.5);
      ctx.lineTo(px + 15.2, headCy + 2.2);
      ctx.lineTo(px + 16.9, headCy + 0.4);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(px + 10.5, headCy - 0.5);
      ctx.lineTo(px + 10.7, headCy + 2);
      ctx.lineTo(px + 12.3, headCy + 0.2);
      ctx.closePath();
      ctx.fill();
    }

    // ---- Pillbox sailor cap with band ----
    const capY = py + 1.5 + bob;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 5, capY - 6, 12, 6);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1.4;
    ctx.strokeRect(px + 5, capY - 6, 12, 6);
    // Band
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + 5, capY - 1.5, 12, 2);
    // Cap top line
    ctx.beginPath();
    ctx.moveTo(px + 5, capY - 6);
    ctx.lineTo(px + 4, capY - 8.5);
    ctx.lineTo(px + 18, capY - 8.5);
    ctx.lineTo(px + 17, capY - 6);
    ctx.stroke();

    // Steam-lantern puff when idle.
    if (this.onGround && Math.abs(this.vx) < 10 && !shocked) {
      const puffPhase = Math.sin(this.whistleTimer * 3);
      if (puffPhase > 0.5) {
        ctx.fillStyle = 'rgba(200, 220, 214, 0.5)';
        ctx.beginPath();
        ctx.arc(px + 22, py + 4 - puffPhase * 4, 2 + puffPhase * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(px + 25, py + 1 - puffPhase * 6, 1.5 + puffPhase, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  }
}
