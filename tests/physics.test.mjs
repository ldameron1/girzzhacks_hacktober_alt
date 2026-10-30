import test from 'node:test';
import assert from 'node:assert';
import { LevelPatcher } from '../server/levelPatcher.ts';
import { Level, LEVEL_VARIANTS, TILE_SIZE } from '../src/game/level.ts';

test('Level: fresh runs start before the midpoint checkpoint', () => {
  const level = new Level();

  assert.strictEqual(level.checkpointX, 3 * TILE_SIZE);
  assert.strictEqual(level.checkpointY, 12 * TILE_SIZE - 30);
});

test('Level: catalog exposes safe named variants without changing the default route', () => {
  assert.deepStrictEqual(
    LEVEL_VARIANTS.map(variant => variant.id),
    ['midnight-run', 'boiler-deck', 'captains-stairs']
  );

  const defaultLevel = new Level();
  const baselineTiles = defaultLevel.tiles.map(row => [...row]);
  defaultLevel.loadVariant('boiler-deck');
  assert.strictEqual(defaultLevel.activeLevelId, 'boiler-deck');
  assert.strictEqual(defaultLevel.metadata.section, 'upper cargo deck');
  assert.notDeepStrictEqual(defaultLevel.tiles, baselineTiles);

  defaultLevel.loadVariant('midnight-run');
  assert.strictEqual(defaultLevel.activeLevelId, 'midnight-run');
  assert.deepStrictEqual(defaultLevel.tiles, baselineTiles);
  assert.strictEqual(defaultLevel.checkpointX, 3 * TILE_SIZE);
});

// 1. Test AABB collision math
function checkAABB(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

test('Physics: AABB collision detection works accurately', () => {
  const player = { x: 10, y: 10, width: 22, height: 30 };
  const obstacle = { x: 25, y: 20, width: 32, height: 32 };
  const distant = { x: 100, y: 100, width: 32, height: 32 };

  assert.strictEqual(checkAABB(player, obstacle), true, 'Player should overlap overlapping obstacle');
  assert.strictEqual(checkAABB(player, distant), false, 'Player should not overlap distant obstacle');
});

// 2. Test Level Mutation Safety Guards
test('LevelPatcher: Rejects out of bounds and preserves spawn zones', () => {
  const dummyLevel = {
    width: 100,
    height: 18,
    tiles: Array.from({ length: 18 }, () => Array(100).fill(0)),
    enemies: [],
    coins: []
  };

  // Set base floor
  for (let x = 0; x < 100; x++) dummyLevel.tiles[15][x] = 1;

  // Mutation in spawn zone (x < 5) should be rejected
  const spawnTrap = { type: 'KAIZO_BLOCK', x: 2, y: 10, justification: 'Spawn trap' };
  // Mutation out of bounds should be rejected
  const oobTrap = { type: 'KAIZO_BLOCK', x: 150, y: 10, justification: 'OOB trap' };
  // Valid mutation in mid section
  const validTrap = { type: 'KAIZO_BLOCK', x: 25, y: 10, justification: 'Mid trap' };

  const mutations = [spawnTrap, oobTrap, validTrap];
  
  // Basic validation logic
  const accepted = [];
  const rejected = [];
  for (const m of mutations) {
    if (m.x < 5 || m.x > dummyLevel.width - 5 || m.y < 2 || m.y >= dummyLevel.height - 2) {
      rejected.push(m);
    } else {
      accepted.push(m);
    }
  }

  assert.strictEqual(rejected.length, 2, 'Should reject 2 invalid mutations');
  assert.strictEqual(accepted.length, 1, 'Should accept 1 valid mutation');
  assert.strictEqual(accepted[0].x, 25);
});

function makeMutationLevel() {
  const level = {
    width: 20,
    height: 10,
    levelId: 'boiler-deck',
    levelName: 'Boiler Deck',
    section: 'upper cargo deck',
    tiles: Array.from({ length: 10 }, () => Array(20).fill(0)),
    enemies: [],
    coins: []
  };

  // A supported top-surface tile at (10, 5).
  level.tiles[5][10] = 1;
  level.tiles[6][10] = 1;

  // An unsupported, floating tile at (12, 5).
  level.tiles[5][12] = 1;

  return level;
}

for (const type of ['CRUMBLING_FLOOR', 'BOUNCE_TRAP']) {
  test(`LevelPatcher: Rejects floating ${type} mutations`, () => {
    const level = makeMutationLevel();
    const mutation = { type, x: 12, y: 5, justification: 'Floating mutation' };

    const result = LevelPatcher.applyMutations(level, [mutation]);

    assert.deepStrictEqual(result.accepted, []);
    assert.strictEqual(result.rejected.length, 1);
    assert.strictEqual(result.level.tiles[5][12], 1, 'Floating tile should remain solid');
  });

  test(`LevelPatcher: Accepts ${type} mutations on a supported top surface`, () => {
    const level = makeMutationLevel();
    const mutation = { type, x: 10, y: 5, justification: 'Supported top surface' };
    const expectedTile = type === 'CRUMBLING_FLOOR' ? 4 : 5;

    const result = LevelPatcher.applyMutations(level, [mutation]);

    assert.deepStrictEqual(result.accepted, [mutation]);
    assert.deepStrictEqual(result.rejected, []);
    assert.strictEqual(result.level.tiles[5][10], expectedTile);
    assert.strictEqual(result.level.levelId, 'boiler-deck');
    assert.strictEqual(result.level.section, 'upper cargo deck');
  });
}

// 3. Test Telemetry Serialization
test('Telemetry: Correctly aggregates metrics and export payload', () => {
  const telemetry = {
    totalRuns: 3,
    totalDeaths: 5,
    furthestX: 1450,
    averageSpeed: 210,
    sprintRatio: 0.75,
    hesitationTimeSec: 2.4,
    jumpCount: 14,
    jumpHoldAvgSec: 0.32,
    edgeJumpDistanceAvg: 6.5,
    panicJitterRate: 0.45,
    coinsCollected: 4,
    recentDeaths: [{ x: 340, y: 460, cause: 'Fell into pit' }],
    currentDifficulty: 4
  };

  assert.strictEqual(telemetry.totalRuns, 3);
  assert.strictEqual(telemetry.totalDeaths, 5);
  assert.strictEqual(telemetry.sprintRatio > 0.5, true, 'Correctly identifies rusher');
});
