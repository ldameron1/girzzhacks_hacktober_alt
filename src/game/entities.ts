import { Box, Physics } from './physics.js';
import { Level, TILE_SIZE, TileType } from './level.js';

export class Particle {
  public x: number;
  public y: number;
  public vx: number;
  public vy: number;
  public life: number;
  public maxLife: number;
  public color: string;
  public size: number;

  constructor(x: number, y: number, vx: number, vy: number, life: number, color: string, size: number = 3) {
    this.x = x;
    this.y = y;
    this.vx = vx;
    this.vy = vy;
    this.life = life;
    this.maxLife = life;
    this.color = color;
    this.size = size;
  }

  update(dt: number): boolean {
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.vy += 400 * dt; // gravity
    this.life -= dt;
    return this.life > 0;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number) {
    const alpha = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = this.color;
    ctx.fillRect(this.x - cameraX, this.y, this.size, this.size);
    ctx.restore();
  }
}

export abstract class Entity implements Box {
  public x: number;
  public y: number;
  public width: number;
  public height: number;
  public vx: number = 0;
  public vy: number = 0;
  public dead: boolean = false;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  abstract update(dt: number, level: Level, playerX: number, playerY: number): void;
  abstract render(ctx: CanvasRenderingContext2D, cameraX: number): void;
}

export class Gloomba extends Entity {
  public facing: number = -1; // -1: left, 1: right
  public speed: number = 65;
  public isStomped: boolean = false;
  private stompTimer: number = 0.3;

  constructor(x: number, y: number) {
    super(x, y, 26, 26);
    this.vx = this.facing * this.speed;
  }

  update(dt: number, level: Level): void {
    if (this.isStomped) {
      this.stompTimer -= dt;
      if (this.stompTimer <= 0) {
        this.dead = true;
      }
      return;
    }

    // Horizontal movement
    this.x += this.vx * dt;

    // Wall collision & reversal
    const checkX = this.facing < 0 ? this.x : this.x + this.width;
    const tileX = Math.floor(checkX / TILE_SIZE);
    const tileY = Math.floor((this.y + this.height - 4) / TILE_SIZE);

    if (level.getTile(tileX, tileY) === TileType.SOLID) {
      this.facing *= -1;
      this.vx = this.facing * this.speed;
    }

    // Apply gravity
    this.vy += 1200 * dt;
    this.y += this.vy * dt;

    // Floor collision
    const floorTileY = Math.floor((this.y + this.height) / TILE_SIZE);
    const curTileX = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    if (level.getTile(curTileX, floorTileY) === TileType.SOLID) {
      this.y = floorTileY * TILE_SIZE - this.height;
      this.vy = 0;
    }
  }

  stomp() {
    this.isStomped = true;
    this.vx = 0;
    this.vy = 0;
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const px = this.x - cameraX;
    const py = this.y;

    if (this.isStomped) {
      // Flattened brown pancake
      ctx.fillStyle = '#854d0e';
      ctx.fillRect(px, py + 16, this.width, 10);
      return;
    }

    // Gloomba body (Brown mushroom shape)
    ctx.fillStyle = '#92400e';
    ctx.beginPath();
    ctx.arc(px + 13, py + 12, 12, Math.PI, 0, false);
    ctx.lineTo(px + 23, py + 22);
    ctx.lineTo(px + 3, py + 22);
    ctx.closePath();
    ctx.fill();

    // Eyes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(px + 6, py + 10, 4, 7);
    ctx.fillRect(px + 16, py + 10, 4, 7);

    // Angry Kaizo pupils
    ctx.fillStyle = '#000000';
    ctx.fillRect(px + (this.facing < 0 ? 6 : 8), py + 12, 2, 4);
    ctx.fillRect(px + (this.facing < 0 ? 16 : 18), py + 12, 2, 4);

    // Spiky brow
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 4, py + 8, 18, 2);

    // Feet
    ctx.fillStyle = '#451a03';
    ctx.fillRect(px + 2, py + 22, 8, 4);
    ctx.fillRect(px + 16, py + 22, 8, 4);
  }
}

export class FallingSpike extends Entity {
  public state: 'idle' | 'shaking' | 'falling' = 'idle';
  private shakeTimer: number = 0.35;
  private shakeOffset: number = 0;

  constructor(x: number, y: number) {
    super(x, y, 20, 24);
  }

  update(dt: number, level: Level, playerX: number, playerY: number): void {
    if (this.state === 'idle') {
      // Trigger when player comes within 80px horizontally and is below spike
      if (Math.abs(playerX - this.x) < 70 && playerY > this.y) {
        this.state = 'shaking';
      }
    } else if (this.state === 'shaking') {
      this.shakeTimer -= dt;
      this.shakeOffset = (Math.random() - 0.5) * 6;
      if (this.shakeTimer <= 0) {
        this.state = 'falling';
        this.shakeOffset = 0;
      }
    } else if (this.state === 'falling') {
      this.vy += 1800 * dt; // fast lethal drop
      this.y += this.vy * dt;

      // Ground impact
      const tileX = Math.floor((this.x + 10) / TILE_SIZE);
      const tileY = Math.floor((this.y + this.height) / TILE_SIZE);
      if (level.getTile(tileX, tileY) === TileType.SOLID) {
        this.dead = true;
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number): void {
    const px = this.x + this.shakeOffset - cameraX;
    const py = this.y;

    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px + this.width, py);
    ctx.lineTo(px + this.width / 2, py + this.height);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
