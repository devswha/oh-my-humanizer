// @ts-check
import test from 'node:test';
import assert from 'node:assert/strict';
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import yaml from 'js-yaml';
import { loadWebConfig, resolveBundleRoot } from '../../src/web-config.js';

function readBaseline(root = resolveBundleRoot()) {
  const baseline = yaml.load(readFileSync(resolve(root, '.patina.default.yaml'), 'utf8'));
  baseline.documentType = baseline['document-type'] || 'default';
  delete baseline['document-type'];
  return baseline;
}

test('loadWebConfig returns the baseline config mapping', () => {
  const config = loadWebConfig();
  assert.equal(config.language, 'ko');
  assert.equal(config.documentType, 'default');
  assert.ok(config.lexicon && typeof config.lexicon === 'object');
  assert.deepEqual(config, readBaseline());
});

test('loadWebConfig ignores ambient project .patina.yaml overrides', () => {
  const root = mkdtempSync(resolve(tmpdir(), 'patina-web-config-'));
  copyFileSync(resolve(resolveBundleRoot(), '.patina.default.yaml'), resolve(root, '.patina.default.yaml'));
  const ambientPath = resolve(root, '.patina.yaml');

  try {
    writeFileSync(ambientPath, 'language: en\ndocument-type: poisoned\nlexicon:\n  enabled: false\n', 'utf8');
    const config = loadWebConfig({ repoRoot: root });
    assert.deepEqual(config, readBaseline(root));
    assert.equal(config.language, 'ko');
    assert.equal(config.documentType, 'default');
    assert.equal(config.lexicon.enabled, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('resolveBundleRoot points at bundled assets', () => {
  const root = resolveBundleRoot();
  assert.ok(existsSync(resolve(root, '.patina.default.yaml')));
  assert.ok(existsSync(resolve(root, 'patterns')));
});
