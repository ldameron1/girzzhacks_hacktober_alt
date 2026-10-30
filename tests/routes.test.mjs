import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { test } from 'node:test';

const port = 3311;
const baseUrl = `http://127.0.0.1:${port}`;

async function waitForHealth(child) {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) return;
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  child.kill('SIGTERM');
  throw new Error('server did not become ready');
}

test('presentation and SPA routes are served by the Express app', async () => {
  const child = spawn(process.execPath, ['--import', 'tsx/esm', 'server/server.ts'], {
    cwd: new URL('..', import.meta.url),
    env: { ...process.env, NODE_ENV: 'production', PORT: String(port) },
    stdio: 'ignore'
  });

  try {
    await waitForHealth(child);

    for (const route of ['/present', '/presentation.html']) {
      const response = await fetch(`${baseUrl}${route}`);
      const body = await response.text();
      assert.equal(response.status, 200, `${route} should load directly`);
      assert.match(response.headers.get('content-type') ?? '', /text\/html/);
      assert.match(body, /GemmaKaizo/);
      assert.match(body, /API Exchange|How it works/);
    }

    const spaResponse = await fetch(`${baseUrl}/a/client-side-route`);
    assert.equal(spaResponse.status, 200);
    assert.match(await spaResponse.text(), /id="game-canvas"/);
  } finally {
    child.kill('SIGTERM');
    await once(child, 'close').catch(() => {});
  }
});
