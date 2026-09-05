import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

test('Kimi setup and synchronous spawn failures clean the owned directory', () => {
  for (const stage of ['profile', 'spawn']) {
    const script = `
      import fs from 'node:fs';
      import child from 'node:child_process';
      import { syncBuiltinESMExports } from 'node:module';
      let directory;
      const create = fs.mkdtempSync;
      fs.mkdtempSync = (...args) => (directory = create(...args));
      if (${JSON.stringify(stage)} === 'profile') fs.writeFileSync = () => { throw new Error('simulated ENOSPC'); };
      else child.spawn = () => { throw new Error('simulated spawn failure'); };
      syncBuiltinESMExports();
      const { invoke } = await import(${JSON.stringify(new URL('../../src/backends/kimi-cli.js', import.meta.url).href)});
      let rejected = false;
      try { await invoke({ prompt: 'Test setup failure' }); } catch { rejected = true; }
      console.log(JSON.stringify({ rejected, created: Boolean(directory), removed: directory && !fs.existsSync(directory) }));
    `;
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], { encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(JSON.parse(result.stdout), { rejected: true, created: true, removed: true });
  }
});
