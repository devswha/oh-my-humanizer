import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getRepoRoot } from '../config.js';
import { inputError } from '../errors.js';
import { installCommunityPack, listCommunityPacks, removeCommunityPack } from '../community-patterns.js';

export async function runPattern(args, { repoRoot = getRepoRoot(), fetchImpl = globalThis.fetch, out = console.log } = {}) {
  const json = args.includes('--json');
  const positional = args.filter((arg) => arg !== '--json');
  const [command, name, ...extra] = positional;
  if (!command || command === 'help' || command === '--help') {
    out('patina pattern — community pattern packs\n\n  patina pattern install <name|GitHub-tree-URL> [--json]\n  patina pattern list [--json]\n  patina pattern remove <name> [--json]\n\nInstalls into this CLI installation\'s custom/community-packs/. Packs are unsigned prompt content. Only install sources you trust.');
    return;
  }
  if (!['install', 'list', 'remove'].includes(command) || extra.length || (command === 'list' ? name : !name) || positional.some((arg) => arg.startsWith('-'))) {
    throw inputError('invalid pattern command', 'Supported: install <name|URL>, list, remove <name>; optional --json.', 'Run `patina pattern help`.');
  }
  const version = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')).version;
  let result;
  if (command === 'list') result = { packs: listCommunityPacks(repoRoot) };
  else if (command === 'remove') result = removeCommunityPack(name, { repoRoot });
  else result = await installCommunityPack(name, { repoRoot, version, fetchImpl });
  if (json) out(JSON.stringify(result, null, 2));
  else if (command === 'list') out(result.packs.length ? result.packs.map((pack) => `${pack.name}\t${pack.version || '?'}\t${pack.status}${pack.error ? `: ${pack.error}` : ''}`).join('\n') : 'No community pattern packs installed.');
  else if (command === 'remove') out(`Removed ${result.removed}.`);
  else out(`Installed ${result.name}@${result.version} from commit ${result.source.commit}.`);
}
