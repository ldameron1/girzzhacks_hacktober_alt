export const TILE_SIZE = 32;

export enum TileType {
  EMPTY = 0,
  SOLID = 1,
  QUESTION = 2,
  SPIKE = 3,
  CRUMBLING = 4,
  SPRING = 5,
  CHECKPOINT = 6,
  FLAGPOLE = 7,
  KAIZO = 8 // Invisible until hit from below
}

export interface DynamicTileState {
  revealed: boolean;
  crumbleTimer?: number;
  crumbled?: boolean;
}

export class Level {
  public width: number;
  public height: number;
  public tiles: number[][];
  public dynamicState: Map<string, DynamicTileState>;
  public coins: Array<{ x: number; y: number; collected: boolean }>;
  public initialEnemies: Array<{ type: string; x: number; y: number }>;
  public checkpointX: number = 3 * TILE_SIZE;
  public checkpointY: number = 13 * TILE_SIZE;

  constructor() {
    this.width = 110;
    this.height = 18;
    this.tiles = [];
    this.dynamicState = new Map();
    this.coins = [];
    this.initialEnemies = [];

    this.createDefaultMap();
  }

  createDefaultMap() {
    this.tiles = Array.from({ length: this.height }, () => Array(this.width).fill(TileType.EMPTY));
    this.dynamicState.clear();
    this.coins = [];
    this.initialEnemies = [];

    // Base ground (row 15 and 16)
    for (let x = 0; x < this.width; x++) {
      // Pits at X: 22-24, 45-48, 72-74
      const isPit = (x >= 22 && x <= 24) || (x >= 45 && x <= 48) || (x >= 72 && x <= 74);
      if (!isPit) {
        this.tiles[15][x] = TileType.SOLID;
        this.tiles[16][x] = TileType.SOLID;
        this.tiles[17][x] = TileType.SOLID;
      }
    }

    // Section 1: Introduction blocks
    this.tiles[11][10] = TileType.QUESTION;
    this.tiles[11][12] = TileType.SOLID;
    this.tiles[11][13] = TileType.QUESTION;
    this.tiles[11][14] = TileType.SOLID;
    this.tiles[7][13] = TileType.QUESTION;

    // Pipes (X: 18, 30, 40)
    this.buildPipe(18, 2);
    this.buildPipe(30, 3);
    this.buildPipe(40, 4);

    // Section 2: First Pit with floating stepping stone
    this.tiles[13][23] = TileType.SOLID;
    // Initial classic Kaizo block bait right over the pit jump!
    this.setKaizo(23, 10);

    // Section 3: Midpoint Checkpoint Flag
    this.tiles[14][35] = TileType.CHECKPOINT;

    // Section 4: Crumbling bridge over second wide pit
    for (let x = 45; x <= 48; x++) {
      this.tiles[12][x] = TileType.CRUMBLING;
    }

    // Section 5: High platforms & Springboard
    this.tiles[14][55] = TileType.SPRING;
    this.tiles[8][58] = TileType.SOLID;
    this.tiles[8][59] = TileType.SOLID;
    this.tiles[8][60] = TileType.SOLID;

    // Section 6: Spiky corridor
    this.tiles[14][65] = TileType.SPIKE;
    this.tiles[14][66] = TileType.SPIKE;
    this.tiles[11][65] = TileType.SOLID;
    this.tiles[11][66] = TileType.SOLID;

    // Section 7: Staircase leading to flagpole
    this.buildStairs(80, 5, true);

    // Flagpole at X: 92
    for (let y = 6; y <= 14; y++) {
      this.tiles[y][92] = TileType.FLAGPOLE;
    }
    this.tiles[15][92] = TileType.SOLID;

    // Spawn some initial coins
    this.coins.push({ x: 10, y: 10, collected: false });
    this.coins.push({ x: 13, y: 6, collected: false });
    this.coins.push({ x: 23, y: 11, collected: false });
    this.coins.push({ x: 58, y: 7, collected: false });
    this.coins.push({ x: 59, y: 7, collected: false });

    // Initial enemies
    this.initialEnemies.push({ type: 'gloomba', x: 14 * TILE_SIZE, y: 14 * TILE_SIZE });
    this.initialEnemies.push({ type: 'gloomba', x: 26 * TILE_SIZE, y: 14 * TILE_SIZE });
    this.initialEnemies.push({ type: 'gloomba', x: 37 * TILE_SIZE, y: 14 * TILE_SIZE });
    this.initialEnemies.push({ type: 'gloomba', x: 62 * TILE_SIZE, y: 14 * TILE_SIZE });
  }

  private buildPipe(x: number, height: number) {
    const topY = 15 - height;
    for (let y = topY; y < 15; y++) {
      this.tiles[y][x] = TileType.SOLID;
      this.tiles[y][x + 1] = TileType.SOLID;
    }
  }

  private buildStairs(startX: number, steps: number, ascend: boolean) {
    for (let i = 0; i < steps; i++) {
      const x = startX + i;
      const height = ascend ? i + 1 : steps - i;
      const topY = 15 - height;
      for (let y = topY; y < 15; y++) {
        this.tiles[y][x] = TileType.SOLID;
      }
    }
  }

  setKaizo(x: number, y: number) {
    if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
      this.tiles[y][x] = TileType.KAIZO;
      this.dynamicState.set(`${x},${y}`, { revealed: false });
    }
  }

  revealKaizo(x: number, y: number) {
    const key = `${x},${y}`;
    const state = this.dynamicState.get(key) || { revealed: false };
    state.revealed = true;
    this.dynamicState.set(key, state);
  }

  isKaizoRevealed(x: number, y: number): boolean {
    const key = `${x},${y}`;
    return !!this.dynamicState.get(key)?.revealed;
  }

  getTile(tx: number, ty: number): number {
    if (tx < 0 || tx >= this.width || ty < 0 || ty >= this.height) {
      return TileType.EMPTY;
    }
    return this.tiles[ty][tx];
  }

  updateCrumbling(dt: number) {
    for (const [key, state] of this.dynamicState.entries()) {
      if (state.crumbleTimer !== undefined && !state.crumbled) {
        state.crumbleTimer -= dt;
        if (state.crumbleTimer <= 0) {
          state.crumbled = true;
          const [tx, ty] = key.split(',').map(Number);
          this.tiles[ty][tx] = TileType.EMPTY;
        }
      }
    }
  }

  render(ctx: CanvasRenderingContext2D, cameraX: number, viewportWidth: number, viewportHeight: number) {
    const startTileX = Math.max(0, Math.floor(cameraX / TILE_SIZE));
    const endTileX = Math.min(this.width, Math.ceil((cameraX + viewportWidth) / TILE_SIZE));

    for (let y = 0; y < this.height; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = this.tiles[y][x];
        const px = x * TILE_SIZE - cameraX;
        const py = y * TILE_SIZE;

        switch (tile) {
          case TileType.SOLID:
            this.renderSolidBlock(ctx, px, py);
            break;

          case TileType.QUESTION:
            this.renderQuestionBlock(ctx, px, py);
            break;

          case TileType.SPIKE:
            this.renderSpike(ctx, px, py);
            break;

          case TileType.CRUMBLING:
            this.renderCrumblingBlock(ctx, px, py, `${x},${y}`);
            break;

          case TileType.SPRING:
            this.renderSpring(ctx, px, py);
            break;

          case TileType.CHECKPOINT:
            this.renderCheckpoint(ctx, px, py);
            break;

          case TileType.FLAGPOLE:
            this.renderFlagpole(ctx, px, py);
            break;

          case TileType.KAIZO:
            if (this.isKaizoRevealed(x, y)) {
              this.renderRevealedKaizo(ctx, px, py);
            }
            break;
        }
      }
    }

    // Render Coins
    this.coins.forEach(c => {
      if (!c.collected) {
        const cx = c.x * TILE_SIZE + 16 - cameraX;
        const cy = c.y * TILE_SIZE + 16;
        if (cx > -32 && cx < viewportWidth + 32) {
          this.renderCoin(ctx, cx, cy);
        }
      }
    });
  }

  private renderSolidBlock(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // Retro Brick
    ctx.fillStyle = '#b84218';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#db6c42';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Brick mortar lines
    ctx.fillStyle = '#4a1506';
    ctx.fillRect(px, py + 15, TILE_SIZE, 2);
    ctx.fillRect(px + 15, py, 2, 15);
    ctx.fillRect(px + 8, py + 16, 2, 16);
  }

  private renderQuestionBlock(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#f8b800';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#fcde5c';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Screws in corners
    ctx.fillStyle = '#8a5800';
    ctx.fillRect(px + 4, py + 4, 2, 2);
    ctx.fillRect(px + 26, py + 4, 2, 2);
    ctx.fillRect(px + 4, py + 26, 2, 2);
    ctx.fillRect(px + 26, py + 26, 2, 2);

    // '?' symbol
    ctx.fillStyle = '#7a4200';
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('?', px + 16, py + 24);
  }

  private renderSpike(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#dcdcdc';
    ctx.beginPath();
    // 3 sharp triangles
    ctx.moveTo(px, py + TILE_SIZE);
    ctx.lineTo(px + 5, py);
    ctx.lineTo(px + 10, py + TILE_SIZE);
    ctx.lineTo(px + 16, py);
    ctx.lineTo(px + 22, py + TILE_SIZE);
    ctx.lineTo(px + 27, py);
    ctx.lineTo(px + TILE_SIZE, py + TILE_SIZE);
    ctx.closePath();
    ctx.fill();

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  private renderCrumblingBlock(ctx: CanvasRenderingContext2D, px: number, py: number, key: string) {
    const state = this.dynamicState.get(key);
    ctx.fillStyle = '#78716c';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Cracks
    ctx.strokeStyle = '#292524';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(px + 4, py + 4);
    ctx.lineTo(px + 16, py + 16);
    ctx.lineTo(px + 28, py + 8);
    ctx.stroke();

    if (state?.crumbleTimer !== undefined) {
      // Shaking highlight
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(px + 2, py + 2, 4, 4);
    }
  }

  private renderSpring(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#38bdf8';
    ctx.fillRect(px + 4, py + 16, 24, 16);
    ctx.fillStyle = '#0284c7';
    ctx.fillRect(px + 2, py + 12, 28, 4);
  }

  private renderCheckpoint(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#a8a29e';
    ctx.fillRect(px + 14, py, 4, TILE_SIZE);
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.moveTo(px + 18, py + 4);
    ctx.lineTo(px + 30, py + 12);
    ctx.lineTo(px + 18, py + 20);
    ctx.closePath();
    ctx.fill();
  }

  private renderFlagpole(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(px + 14, py, 4, TILE_SIZE);

    if (py % 100 < 32) {
      ctx.fillStyle = '#eab308';
      ctx.beginPath();
      ctx.arc(px + 16, py + 4, 6, 0, Math.PI * 2);
      ctx.fill();

      // Flag
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.moveTo(px + 14, py + 8);
      ctx.lineTo(px - 16, py + 16);
      ctx.lineTo(px + 14, py + 24);
      ctx.closePath();
      ctx.fill();
    }
  }

  private renderRevealedKaizo(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#1e1b4b';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.strokeStyle = '#a855f7';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    ctx.fillStyle = '#c084fc';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KAIZO', px + 16, py + 20);
  }

  private renderCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 7, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#d97706';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#fef3c7';
    ctx.fillRect(cx - 2, cy - 6, 4, 12);
  }
}
