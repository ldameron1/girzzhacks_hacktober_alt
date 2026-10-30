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

    const nextX = this.x + this.vx * dt;
    const edgeX = this.facing < 0 ? nextX : nextX + this.width;
    const tileX = Math.floor(edgeX / TILE_SIZE);
    const tileY = Math.floor((this.y + this.height - 4) / TILE_SIZE);
    const floorX = Math.floor((nextX + this.width / 2) / TILE_SIZE);
    const floorY = Math.floor((this.y + this.height + 2) / TILE_SIZE);
    const nextFloor = level.getTile(floorX, floorY);
    const walkableFloor = nextFloor === TileType.SOLID ||
      nextFloor === TileType.CRUMBLING || nextFloor === TileType.CHECKPOINT;

    // Turn around at walls and pit edges instead of falling forever.
    if (level.getTile(tileX, tileY) === TileType.SOLID || !walkableFloor) {
      this.facing *= -1;
      this.vx = this.facing * this.speed;
    } else {
      this.x = nextX;
    }

    // Apply gravity
    this.vy += 1200 * dt;
    this.y += this.vy * dt;

    // Floor collision
    const floorTileY = Math.floor((this.y + this.height) / TILE_SIZE);
    const curTileX = Math.floor((this.x + this.width / 2) / TILE_SIZE);
    const floor = level.getTile(curTileX, floorTileY);
    if (floor === TileType.SOLID || floor === TileType.CRUMBLING || floor === TileType.CHECKPOINT) {
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
      // Flattened mechanical buoy.
      ctx.fillStyle = '#b45309';
      ctx.fillRect(px, py + 18, this.width, 8);
      ctx.fillStyle = '#facc15';
      ctx.fillRect(px + 4, py + 20, 18, 3);
      return;
    }

    // Non-human mechanical buoy hazard: geometric, nautical, and clearly
    // distinct from a human or animal caricature.
    ctx.fillStyle = '#c2410c';
    ctx.beginPath();
    ctx.arc(px + 13, py + 14, 11, Math.PI, 0, false);
    ctx.lineTo(px + 23, py + 24);
    ctx.lineTo(px + 3, py + 24);
    ctx.closePath();
    ctx.fill();

    // Warning bands and a central metal plate; no face-like features.
    ctx.fillStyle = '#facc15';
    ctx.fillRect(px + 3, py + 10, 20, 4);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(px + 7, py + 17, 12, 5);
    ctx.fillStyle = '#e2e8f0';
    ctx.fillRect(px + 11, py + 18, 4, 3);
    ctx.fillStyle = '#334155';
    ctx.fillRect(px + 10, py + 1, 6, 4);
    ctx.fillRect(px + 12, py - 3, 2, 4);
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

    // Suspended warning lantern: a readable silhouette at game scale.
    ctx.strokeStyle = '#91a5ad';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + 10, py);
    ctx.lineTo(px + 10, py - 24);
    ctx.stroke();
    ctx.fillStyle = '#b98a4b';
    ctx.fillRect(px + 6, py - 27, 8, 4);

    ctx.fillStyle = this.state === 'shaking' ? '#f3c969' : '#c4573c';
    ctx.beginPath();
    ctx.arc(px + 10, py + 5, 8, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6d88c';
    ctx.fillRect(px + 6, py + 1, 8, 3);
    ctx.fillStyle = '#23343c';
    ctx.fillRect(px + 8, py - 1, 4, 12);
    ctx.fillStyle = '#c4573c';
    ctx.fillRect(px + 3, py + 12, 14, 4);
    ctx.fillStyle = '#91a5ad';
    ctx.fillRect(px + 2, py + 16, 16, 3);
  }
}
