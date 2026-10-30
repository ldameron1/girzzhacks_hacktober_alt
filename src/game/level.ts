export const TILE_SIZE = 32;

export enum TileType {
  EMPTY = 0,
  SOLID = 1,      // Steamboat Wooden Deck / Hull
  QUESTION = 2,   // Brass Cargo Crate
  SPIKE = 3,      // Rusty Iron Anchor Hazard
  CRUMBLING = 4,  // Rotting Driftwood Plank
  SPRING = 5,     // Nautical Lifebuoy Springboard
  CHECKPOINT = 6, // Ship's Brass Bell
  FLAGPOLE = 7,   // Steamboat Smoke Funnel Mast
  KAIZO = 8       // Phantom Film Reel Block
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
  public checkpointY: number = 12 * TILE_SIZE - 30;
  public waterAnimTimer: number = 0;

  constructor() {
    this.width = 110;
    this.height = 15; // Exactly 15 tiles = 480px canvas height
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

    // Steamboat deck is 3 tiles thick: rows 12, 13, 14
    // This ensures a couple visible ground tiles across the entire bottom!
    for (let x = 0; x < this.width; x++) {
      // Pits (Mississippi River Gaps): x=22-24, x=45-48, x=71-74
      const isPit = (x >= 22 && x <= 24) || (x >= 45 && x <= 48) || (x >= 71 && x <= 74);
      if (!isPit) {
        this.tiles[12][x] = TileType.SOLID; // Top deck plank
        this.tiles[13][x] = TileType.SOLID; // Mid timber hull
        this.tiles[14][x] = TileType.SOLID; // Lower hull keel
      }
    }

    // Section 1: Steamboat cargo crates
    this.tiles[8][9] = TileType.QUESTION;
    this.tiles[8][11] = TileType.SOLID;
    this.tiles[8][12] = TileType.QUESTION;
    this.tiles[8][13] = TileType.SOLID;
    this.tiles[4][12] = TileType.QUESTION;

    // Steamboat Steam Funnels (replaces pipes at X: 17, 29, 39)
    this.buildFunnel(17, 2);
    this.buildFunnel(29, 3);
    this.buildFunnel(39, 3);

    // Section 2: First River Gap with stepping raft
    this.tiles[10][23] = TileType.SOLID;
    // Classic Kaizo invisible block directly above river leap
    this.setKaizo(23, 7);

    // Section 3: Midpoint Ship's Bell Checkpoint
    this.tiles[11][34] = TileType.CHECKPOINT;
    // The bell becomes active only after the player reaches it.
    // Keep fresh runs anchored at the actual spawn instead of the midpoint.
    this.checkpointX = 3 * TILE_SIZE;
    this.checkpointY = 12 * TILE_SIZE - 30;

    // Section 4: Rotting driftwood suspension bridge over second river pit
    for (let x = 45; x <= 48; x++) {
      this.tiles[10][x] = TileType.CRUMBLING;
    }

    // Section 5: Lifebuoy Springboard & Upper Promenade Deck
    this.tiles[11][54] = TileType.SPRING;
    this.tiles[6][57] = TileType.SOLID;
    this.tiles[6][58] = TileType.SOLID;
    this.tiles[6][59] = TileType.SOLID;
    this.tiles[6][60] = TileType.SOLID;

    // Section 6: Rusty Anchor Hazard Corridor
    this.tiles[11][64] = TileType.SPIKE;
    this.tiles[11][65] = TileType.SPIKE;
    this.tiles[8][64] = TileType.SOLID;
    this.tiles[8][65] = TileType.SOLID;

    // Section 7: Grand Captain's Stairs leading to Pilot House
    this.buildStairs(79, 5, true);

    // Steamboat Flag Mast at X: 91
    for (let y = 3; y <= 11; y++) {
      this.tiles[y][91] = TileType.FLAGPOLE;
    }
    this.tiles[12][91] = TileType.SOLID;

    // Musical Notes / Gold Tokens
    this.coins.push({ x: 9, y: 7, collected: false });
    this.coins.push({ x: 12, y: 3, collected: false });
    this.coins.push({ x: 23, y: 8, collected: false });
    this.coins.push({ x: 57, y: 5, collected: false });
    this.coins.push({ x: 59, y: 5, collected: false });
    this.coins.push({ x: 65, y: 6, collected: false });

    // Pete's Deckhand Enforcers (patrolling enemies)
    this.initialEnemies.push({ type: 'gloomba', x: 14 * TILE_SIZE, y: 11 * TILE_SIZE });
    this.initialEnemies.push({ type: 'gloomba', x: 26 * TILE_SIZE, y: 11 * TILE_SIZE });
    // Keep the checkpoint approach clear so a death does not create an
    // immediate respawn loop with the next patrol.
    this.initialEnemies.push({ type: 'gloomba', x: 40 * TILE_SIZE, y: 11 * TILE_SIZE });
    this.initialEnemies.push({ type: 'gloomba', x: 61 * TILE_SIZE, y: 11 * TILE_SIZE });
  }

  private buildFunnel(x: number, height: number) {
    const topY = 12 - height;
    for (let y = topY; y < 12; y++) {
      this.tiles[y][x] = TileType.SOLID;
      this.tiles[y][x + 1] = TileType.SOLID;
    }
  }

  private buildStairs(startX: number, steps: number, ascend: boolean) {
    for (let i = 0; i < steps; i++) {
      const x = startX + i;
      const height = ascend ? i + 1 : steps - i;
      const topY = 12 - height;
      for (let y = topY; y < 12; y++) {
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
    this.waterAnimTimer += dt;
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

    // Water is painted first so the solid hull remains visible outside pits.
    this.renderRiverWater(ctx, cameraX, viewportWidth, viewportHeight);

    // Render Tiles
    for (let y = 0; y < this.height; y++) {
      for (let x = startTileX; x < endTileX; x++) {
        const tile = this.tiles[y][x];
        const px = x * TILE_SIZE - cameraX;
        const py = y * TILE_SIZE;

        switch (tile) {
          case TileType.SOLID:
            this.renderSteamboatDeck(ctx, px, py, y);
            break;

          case TileType.QUESTION:
            this.renderCargoCrate(ctx, px, py);
            break;

          case TileType.SPIKE:
            this.renderAnchorSpike(ctx, px, py);
            break;

          case TileType.CRUMBLING:
            this.renderDriftwoodBlock(ctx, px, py, `${x},${y}`);
            break;

          case TileType.SPRING:
            this.renderLifebuoySpring(ctx, px, py);
            break;

          case TileType.CHECKPOINT:
            this.renderShipBell(ctx, px, py);
            break;

          case TileType.FLAGPOLE:
            this.renderSteamMast(ctx, px, py);
            break;

          case TileType.KAIZO:
            if (this.isKaizoRevealed(x, y)) {
              this.renderRevealedFilmKaizo(ctx, px, py);
            }
            break;
        }
      }
    }

    // Render brass route tokens
    this.coins.forEach(c => {
      if (!c.collected) {
        const cx = c.x * TILE_SIZE + 16 - cameraX;
        const cy = c.y * TILE_SIZE + 16;
        if (cx > -32 && cx < viewportWidth + 32) {
          this.renderMusicNoteCoin(ctx, cx, cy);
        }
      }
    });
  }

  /**
   * Render Multi-layered Steamboat Deck:
   * y=12: Top polished oak deck with brass pegs & plank borders
   * y=13: Mid riverboat timber hull with iron bands
   * y=14: Keel foundation timbers
   */
  private renderSteamboatDeck(ctx: CanvasRenderingContext2D, px: number, py: number, tileY: number) {
    if (tileY < 12) {
      // Elevated structures use the same painted steel and brass language as
      // the riverboat superstructure, rather than looking like floating dirt.
      ctx.fillStyle = '#29434a';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
      ctx.fillStyle = '#355b5b';
      ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, 5);
      ctx.fillStyle = '#162b35';
      ctx.fillRect(px, py + 28, TILE_SIZE, 4);
      ctx.fillStyle = '#b98a4b';
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillRect(px + 5, py + 11, 3, 3);
      ctx.fillRect(px + 23, py + 11, 3, 3);
    } else if (tileY === 12) {
      // Top Deck Plank (Polished Warm Oak with brass rivets)
      ctx.fillStyle = '#9b6a3f';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // One broad deck plank with a restrained highlight; avoids a noisy
      // repeated checkerboard when the level is viewed at small scale.
      ctx.fillStyle = '#c18a51';
      ctx.fillRect(px + 1, py + 3, TILE_SIZE - 2, 5);
      ctx.fillStyle = '#b27a48';
      ctx.fillRect(px + 1, py + 17, TILE_SIZE - 2, 3);

      // Dark seam lines between deck boards
      ctx.fillStyle = '#4b3021';
      ctx.fillRect(px, py, TILE_SIZE, 2);
      ctx.fillRect(px, py + 30, TILE_SIZE, 2);

      // Brass deck nail rivets
      ctx.fillStyle = '#d5a85d';
      ctx.beginPath();
      ctx.arc(px + 6, py + 6, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 26, py + 6, 1.5, 0, Math.PI * 2);
      ctx.arc(px + 16, py + 25, 1.5, 0, Math.PI * 2);
      ctx.fill();

      // Top brass trim railing edge
      ctx.fillStyle = '#d19a4d';
      ctx.fillRect(px, py, TILE_SIZE, 1);
    } else if (tileY === 13) {
      // Mid Hull Planking (Darker Steamboat Cedar)
      ctx.fillStyle = '#8b5a2b';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Horizontal hull beams
      ctx.fillStyle = '#6f421a';
      ctx.fillRect(px, py + 15, TILE_SIZE, 2);

      // Black iron hull strapping
      ctx.fillStyle = '#1c1917';
      ctx.fillRect(px + 14, py, 4, TILE_SIZE);

      // Iron rivet bolts
      ctx.fillStyle = '#94a3b8';
      ctx.fillRect(px + 15, py + 6, 2, 2);
      ctx.fillRect(px + 15, py + 22, 2, 2);
    } else {
      // Lower Hull Keel (Submerged Deep Timber)
      ctx.fillStyle = '#4a2c11';
      ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

      // Waterline moss / barnacle green accent
      ctx.fillStyle = '#065f46';
      ctx.fillRect(px, py, TILE_SIZE, 3);
    }
  }

  /**
   * Brass Steam Cargo Crate with anchor stencil
   */
  private renderCargoCrate(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // Rich Brass Body
    ctx.fillStyle = '#b45309';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(px + 2, py + 2, TILE_SIZE - 4, TILE_SIZE - 4);

    // Corner brass braces
    ctx.fillStyle = '#78350f';
    ctx.fillRect(px + 2, py + 2, 6, 6);
    ctx.fillRect(px + 24, py + 2, 6, 6);
    ctx.fillRect(px + 2, py + 24, 6, 6);
    ctx.fillRect(px + 24, py + 24, 6, 6);

    // Original anchor stencil: readable as cargo, not a platformer question box.
    ctx.strokeStyle = '#fff1b8';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 16, py + 15, 5, 0, Math.PI * 2);
    ctx.moveTo(px + 16, py + 20);
    ctx.lineTo(px + 16, py + 25);
    ctx.moveTo(px + 11, py + 24);
    ctx.lineTo(px + 16, py + 27);
    ctx.lineTo(px + 21, py + 24);
    ctx.stroke();
    ctx.fillStyle = '#fff1b8';
    ctx.fillRect(px + 15, py + 8, 2, 8);

    // A small pumpkin-orange lantern cue keeps the October theme visible
    // without changing the crate's gameplay meaning.
    ctx.fillStyle = 'rgba(255, 190, 70, 0.45)';
    ctx.beginPath();
    ctx.arc(px + 16, py + 10, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Rusty Iron Anchor Spike Hazard
   */
  private renderAnchorSpike(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // Low-profile deck hazard: a consistent red signal marker rather than
    // repeated bright triangles that read as placeholder geometry.
    ctx.fillStyle = '#263746';
    ctx.fillRect(px + 4, py + 25, 24, 4);
    ctx.fillStyle = '#c4573c';
    ctx.beginPath();
    ctx.moveTo(px + 6, py + 25);
    ctx.lineTo(px + 10, py + 8);
    ctx.lineTo(px + 16, py + 18);
    ctx.lineTo(px + 22, py + 8);
    ctx.lineTo(px + 26, py + 25);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f6d88c';
    ctx.fillRect(px + 8, py + 20, 16, 3);
  }

  /**
   * Rotting river driftwood block that shakes and splinters
   */
  private renderDriftwoodBlock(ctx: CanvasRenderingContext2D, px: number, py: number, key: string) {
    const state = this.dynamicState.get(key);
    const isShaking = state?.crumbleTimer !== undefined && !state?.crumbled;

    const shakeX = isShaking ? (Math.random() - 0.5) * 5 : 0;
    const shakeY = isShaking ? (Math.random() - 0.5) * 3 : 0;

    // Waterlogged deck plank, kept in the same brown/teal material language
    // as the surrounding boat instead of an unexplained gray box.
    ctx.fillStyle = isShaking ? '#a9794a' : '#765238';
    ctx.fillRect(px + shakeX, py + shakeY, TILE_SIZE, TILE_SIZE);

    ctx.fillStyle = '#c79a5b';
    ctx.fillRect(px + shakeX + 2, py + shakeY + 3, TILE_SIZE - 4, 4);
    ctx.strokeStyle = '#3b2a25';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px + shakeX + 3, py + shakeY + 5);
    ctx.lineTo(px + shakeX + 15, py + shakeY + 18);
    ctx.lineTo(px + shakeX + 29, py + shakeY + 9);
    ctx.stroke();
    ctx.fillStyle = '#d5a85d';
    ctx.fillRect(px + shakeX + 5, py + shakeY + 24, 4, 3);
    ctx.fillRect(px + shakeX + 23, py + shakeY + 24, 4, 3);

    if (isShaking) {
      // Danger exclamation
      ctx.fillStyle = '#f6d88c';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('SPLIT!', px + 16, py - 4);
    }
  }

  /**
   * Nautical Lifebuoy Springboard (Red & White Life Ring on brass coil)
   */
  private renderLifebuoySpring(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // Brass spring coil
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(px + 8, py + 26);
    ctx.lineTo(px + 14, py + 18);
    ctx.lineTo(px + 18, py + 26);
    ctx.lineTo(px + 24, py + 18);
    ctx.stroke();

    // Red & White Life Ring Buoy
    ctx.fillStyle = '#ef4444';
    ctx.beginPath();
    ctx.arc(px + 16, py + 12, 11, 0, Math.PI * 2);
    ctx.fill();

    // White segments
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px + 16, py + 12, 11, -Math.PI / 4, Math.PI / 4);
    ctx.lineTo(px + 16, py + 12);
    ctx.fill();

    ctx.beginPath();
    ctx.arc(px + 16, py + 12, 11, 3 * Math.PI / 4, 5 * Math.PI / 4);
    ctx.lineTo(px + 16, py + 12);
    ctx.fill();

    // Inner hole
    ctx.fillStyle = '#0f172a';
    ctx.beginPath();
    ctx.arc(px + 16, py + 12, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Polished Brass Ship Bell (Checkpoint)
   */
  private renderShipBell(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // Bell bracket
    ctx.fillStyle = '#78350f';
    ctx.fillRect(px + 14, py, 4, 8);

    // Golden Bell body
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath();
    ctx.moveTo(px + 10, py + 8);
    ctx.quadraticCurveTo(px + 16, py + 6, px + 22, py + 8);
    ctx.lineTo(px + 26, py + 22);
    ctx.lineTo(px + 6, py + 22);
    ctx.closePath();
    ctx.fill();

    // Clapper
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    ctx.arc(px + 16, py + 24, 3, 0, Math.PI * 2);
    ctx.fill();

    // Bell chime ring waves
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(px + 16, py + 16, 12, -0.6, 0.6);
    ctx.arc(px + 16, py + 16, 12, Math.PI - 0.6, Math.PI + 0.6);
    ctx.stroke();
  }

  /**
   * Steamboat Smoke Funnel Mast with Riverboat Flag (Goal)
   */
  private renderSteamMast(ctx: CanvasRenderingContext2D, px: number, py: number) {
    // One continuous iron mast. The old per-tile finials made this render as
    // a stack of disconnected poles and flags.
    ctx.fillStyle = '#263746';
    ctx.fillRect(px + 14, py, 4, TILE_SIZE);
    ctx.fillStyle = 'rgba(239, 216, 154, 0.22)';
    ctx.fillRect(px + 10, py + 4, 3, 20);
    ctx.fillStyle = '#a98552';
    ctx.fillRect(px + 12, py + 1, 8, 2);

    // Only the top tile owns the pennant and finial.
    if (py === 3 * TILE_SIZE) {
      ctx.fillStyle = '#c99b52';
      ctx.beginPath();
      ctx.arc(px + 16, py - 2, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#d8b06a';
      ctx.beginPath();
      ctx.moveTo(px + 18, py + 3);
      ctx.lineTo(px + 43, py + 10);
      ctx.lineTo(px + 18, py + 17);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#314f58';
      ctx.fillRect(px + 20, py + 8, 15, 3);
    }
  }

  /**
   * Phantom 1928 Film Reel Kaizo Block
   */
  private renderRevealedFilmKaizo(ctx: CanvasRenderingContext2D, px: number, py: number) {
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(px, py, TILE_SIZE, TILE_SIZE);

    // Film strip sprockets
    ctx.fillStyle = '#f5f0e8';
    ctx.fillRect(px + 2, py + 2, 4, 4);
    ctx.fillRect(px + 2, py + 14, 4, 4);
    ctx.fillRect(px + 2, py + 26, 4, 4);
    ctx.fillRect(px + 26, py + 2, 4, 4);
    ctx.fillRect(px + 26, py + 14, 4, 4);
    ctx.fillRect(px + 26, py + 26, 4, 4);

    // Purple glitch neon border
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 2;
    ctx.strokeRect(px + 1, py + 1, TILE_SIZE - 2, TILE_SIZE - 2);

    ctx.fillStyle = '#e9d5ff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('KAIZO', px + 16, py + 19);
  }

  /**
   * Churning Mississippi River Water in Pits
   */
  private renderRiverWater(
    ctx: CanvasRenderingContext2D,
    cameraX: number,
    viewportWidth: number,
    viewportHeight: number
  ) {
    const waterY = 12 * TILE_SIZE + 8;
    const pits = [[22, 24], [45, 48], [71, 74]];

    ctx.save();
    for (const [startTile, endTile] of pits) {
      const startX = startTile * TILE_SIZE - cameraX;
      const width = (endTile - startTile + 1) * TILE_SIZE;
      if (startX > viewportWidth || startX + width < 0) continue;
      ctx.fillStyle = '#0284c7';
      ctx.fillRect(startX, waterY, width, viewportHeight - waterY);
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 3;
      ctx.beginPath();
      const firstX = Math.max(0, startX - 16);
      const lastX = Math.min(viewportWidth, startX + width + 16);
      for (let x = firstX; x <= lastX; x += 16) {
        const wy = waterY + Math.sin((x + cameraX) * 0.1 + this.waterAnimTimer * 5) * 3;
        if (x === firstX) ctx.moveTo(x, wy);
        else ctx.lineTo(x, wy);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  /**
   * Brass riverboat route token
   */
  private renderMusicNoteCoin(ctx: CanvasRenderingContext2D, cx: number, cy: number) {
    ctx.save();
    ctx.fillStyle = 'rgba(255, 190, 70, 0.22)';
    ctx.beginPath();
    ctx.arc(cx, cy, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f6d88c';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, 7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#f59e0b';
    ctx.fillRect(cx - 4, cy - 5, 8, 10);
    ctx.fillStyle = '#fff1b8';
    ctx.fillRect(cx - 2, cy - 3, 4, 6);
    ctx.fillStyle = '#6b3f1e';
    ctx.fillRect(cx - 5, cy - 9, 10, 2);
    ctx.fillRect(cx - 5, cy + 7, 10, 2);
    ctx.restore();
  }
}
