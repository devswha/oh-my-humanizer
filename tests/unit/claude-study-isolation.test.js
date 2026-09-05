import test from 'node:test';
import assert from 'node:assert/strict';
import { claudeStudyArgs } from '../../scripts/research/model-evaluation-transport.mjs';

test('Claude study isolates personal advisors while retaining the OAuth-capable CLI', () => {
  const args = claudeStudyArgs({ model: 'claude-opus-5', effort: 'high' });
  for (const flag of ['--safe-mode', '--strict-mcp-config', '--disable-slash-commands', '--no-session-persistence']) assert.ok(args.includes(flag));
  assert.equal(args[args.indexOf('--setting-sources') + 1], '');
  assert.equal(args[args.indexOf('--tools') + 1], '');
  assert.equal(args[args.indexOf('--effort') + 1], 'high');
  assert.equal(args.includes('--bare'), false);
  assert.equal(claudeStudyArgs({ model: 'claude-haiku-4-5-20251001' }).includes('--effort'), false);
  assert.throws(() => claudeStudyArgs({ model: 'claude-opus-5', effort: 'unrecorded' }), /effort/);
});
