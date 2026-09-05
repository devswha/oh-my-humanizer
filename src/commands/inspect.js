import { resolve } from 'node:path';
import { inspectText } from '../inspection.js';
import { loadConfig } from '../config.js';
import { loadInputs } from '../cli/input.js';
import { inputError } from '../errors.js';

export async function runInspect(args, { output = (value) => console.log(value) } = {}) {
  const parsed = { files: [], noInteractive: true, batch: false, language: 'auto', config: null };
  let stdinCount = 0;
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--help' || arg === '-h') { output('patina inspect [--lang auto|en|ko|zh|ja] [--config FILE] [FILE]\nEmits offline editing diagnostics as JSON. Pipe text through stdin when FILE is omitted.'); return; }
    if (arg === '--lang' || arg === '--config') {
      if (!args[i + 1] || args[i + 1].startsWith('-')) throw inputError('missing inspection option value', arg);
      parsed[arg === '--lang' ? 'language' : 'config'] = args[++i];
    } else if (arg === '--format' && args[i + 1] === 'json') i++;
    else if (arg === '--json') { /* JSON is the only inspection format. */ }
    else if (arg === '--') {
      for (const value of args.slice(i + 1)) { if (value === '-') stdinCount++; else parsed.files.push(value); }
      break;
    }
    else if (arg.startsWith('-') && arg !== '-') throw inputError('unsupported inspection option', arg, 'Inspection is offline and accepts no provider/backend options.');
    else if (arg === '-') stdinCount++;
    else parsed.files.push(arg);
  }
  if (parsed.files.length + stdinCount > 1) throw inputError('inspection accepts one document', 'Pass one file or pipe one buffer through stdin.');
  if (!['auto', 'en', 'ko', 'zh', 'ja'].includes(parsed.language)) throw inputError('unsupported inspection language', parsed.language);
  const config = loadConfig(undefined, parsed.config ? { overridePath: resolve(parsed.config) } : {});
  const [input] = await loadInputs(parsed);
  output(JSON.stringify(inspectText(input.text, { language: parsed.language, file: input.path, config })));
}
