#!/usr/bin/env node
// Does a judge actually grade meaning preservation and fidelity correctly?
//
// The 2026-07-13 calibration measured one thing: can a judge tell AI prose from
// human prose. Nothing ever measured the rubric the product gates on — MPS and
// fidelity — and on 2026-07-27 that gap surfaced as a fidelity rubric that
// charged removal of marketing hype as omitted claims, failing correct rewrites
// in production for months.
//
// This check uses constructed pairs whose correct verdict is known by
// construction: a rewrite that only strips hype MUST pass, a rewrite that
// changes a number or flips polarity MUST fail. A judge that disagrees is
// broken, no human labelling required.
//
// Usage:
//   node scripts/research/judge-rubric-check.mjs --backend codex-cli --model gpt-5.5
//   node scripts/research/judge-rubric-check.mjs --base-url <url> --model <id> --api-key-env OPENAI_API_KEY
import { scoreFidelity, scoreMPS } from '../../src/scoring.js';
import { invokeBackendChain, resolveBackend } from '../../src/backends/index.js';

const FLOOR = 70;

/**
 * expect: 'pass' — a faithful rewrite; both MPS and fidelity must clear the floor.
 * expect: 'fail' — meaning is damaged; MPS must fall below the floor.
 */
const CASES = [
  {
    id: 'ko-hype-only',
    expect: 'pass',
    why: 'hype removed, every claim intact — the product working as designed',
    original: '오늘날 빠르게 변화하는 디지털 환경 속에서, 본 솔루션은 혁신적인 시너지를 활용하여 고객에게 전례 없는 가치를 원활하게 제공합니다.',
    rewritten: '디지털 환경이 빠르게 변하고 있다. 이 솔루션은 고객에게 가치를 제공한다.',
  },
  {
    id: 'ko-number-changed',
    expect: 'fail',
    why: 'the figure changed from 30% to 50%',
    original: '2025년 매출은 전년 대비 30% 성장했으며, 신규 가입자는 12만 명을 기록했다.',
    rewritten: '2025년 매출은 전년 대비 50% 성장했고, 신규 가입자는 12만 명이었다.',
  },
  {
    id: 'ko-polarity-flipped',
    expect: 'fail',
    why: 'the negation was dropped, reversing the claim',
    original: '이 방식은 소규모 팀에는 적합하지 않으며, 도입 시 오히려 비용이 증가한다.',
    rewritten: '이 방식은 소규모 팀에 적합하며, 도입하면 비용이 줄어든다.',
  },
  {
    id: 'ko-causation-dropped',
    expect: 'fail',
    why: 'the causal link between the two facts is gone',
    original: '재고 관리 시스템을 교체했기 때문에 배송 지연이 40% 감소했다.',
    rewritten: '재고 관리 시스템을 교체했다. 배송 지연은 40% 줄었다. 두 변화는 서로 무관하다.',
  },
  {
    id: 'ko-paraphrase',
    expect: 'pass',
    why: 'plain paraphrase, nothing added or lost',
    original: '신규 요금제는 다음 달 1일부터 적용되며, 기존 가입자는 자동으로 전환된다.',
    rewritten: '새 요금제는 다음 달 1일에 시작한다. 기존 가입자는 따로 신청하지 않아도 자동 전환된다.',
  },
  {
    id: 'ko-content-gutted',
    expect: 'fail',
    why: 'two of three claims are simply missing',
    original: '이번 업데이트는 검색 속도를 개선하고, 다크 모드를 추가하며, 로그인 오류를 수정한다.',
    rewritten: '이번 업데이트는 검색이 빨라진다.',
  },
  {
    id: 'en-hype-only',
    expect: 'pass',
    why: 'hype removed, claims intact',
    original: 'In today\'s rapidly evolving landscape, our cutting-edge platform seamlessly empowers teams to unlock unprecedented productivity gains.',
    rewritten: 'Our platform helps teams work more productively.',
  },
  {
    id: 'en-number-changed',
    expect: 'fail',
    why: 'the latency figure changed from 120ms to 12ms',
    original: 'The new index reduced median query latency to 120ms across the three production clusters.',
    rewritten: 'The new index cut median query latency to 12ms across all three production clusters.',
  },
  {
    id: 'en-fabricated',
    expect: 'fail',
    why: 'a causal claim about revenue was invented',
    original: 'We migrated the billing service to the new runtime in March.',
    rewritten: 'We migrated the billing service to the new runtime in March, which doubled revenue that quarter.',
  },
  {
    id: 'en-paraphrase',
    expect: 'pass',
    why: 'plain paraphrase',
    original: 'Support hours change on Monday: the team is available from 9am to 6pm, and weekend coverage ends.',
    rewritten: 'Starting Monday, support runs 9am to 6pm. There is no weekend coverage anymore.',
  },
];

function parseArgs(argv) {
  const options = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--backend') options.backend = argv[++i];
    else if (arg === '--model') options.model = argv[++i];
    else if (arg === '--base-url') options.baseURL = argv[++i];
    else if (arg === '--api-key-env') options.apiKeyEnv = argv[++i];
    else if (arg === '--json') options.json = true;
    else throw new Error(`unknown argument: ${arg}`);
  }
  return options;
}

function backendCallLLM(backendName, model) {
  const backend = resolveBackend(backendName);
  return (args) => invokeBackendChain({
    backends: [backend],
    prompt: args.prompt,
    model: model ?? null,
    modelSource: model ? 'option:model' : 'default',
    timeout: 300_000,
  });
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const common = options.backend
    ? { apiKey: 'seat', baseURL: null, model: options.model ?? null, callLLM: backendCallLLM(options.backend, options.model), timeout: 300_000 }
    : {
      apiKey: process.env[options.apiKeyEnv || 'OPENAI_API_KEY'],
      baseURL: options.baseURL,
      model: options.model,
      timeout: 180_000,
    };

  const rows = [];
  for (const testCase of CASES) {
    let mps = null;
    let fidelity = null;
    let error = null;
    try {
      const mpsResult = await scoreMPS({ original: testCase.original, rewritten: testCase.rewritten, ...common });
      const fidelityResult = await scoreFidelity({ original: testCase.original, rewritten: testCase.rewritten, ...common });
      mps = mpsResult?.mps ?? null;
      fidelity = fidelityResult?.fidelity ?? null;
    } catch (err) {
      error = String(err?.message ?? err).slice(0, 120);
    }
    // A 'pass' case must clear both floors; a 'fail' case must be caught by MPS,
    // which is the gate that owns meaning. Fidelity may or may not also flag it.
    const verdict = error ? null
      : testCase.expect === 'pass'
        ? (mps >= FLOOR && fidelity >= FLOOR ? 'pass' : 'fail')
        : (mps < FLOOR ? 'fail' : 'pass');
    rows.push({ ...testCase, mps, fidelity, verdict, correct: verdict === testCase.expect, error });
    if (!options.json) {
      const mark = error ? 'ERROR' : rows[rows.length - 1].correct ? 'ok' : 'WRONG';
      console.log(`${mark.padEnd(6)} ${testCase.id.padEnd(22)} expect ${testCase.expect.padEnd(4)} got ${String(verdict).padEnd(4)} mps ${String(mps).padEnd(5)} fid ${String(fidelity).padEnd(5)} ${error || testCase.why}`);
    }
  }

  const scored = rows.filter((row) => !row.error);
  const correct = scored.filter((row) => row.correct).length;
  const falsePass = rows.filter((row) => row.expect === 'fail' && row.verdict === 'pass');
  const falseFail = rows.filter((row) => row.expect === 'pass' && row.verdict === 'fail');

  if (options.json) {
    console.log(JSON.stringify({ judge: options.backend ? `${options.backend}/${options.model ?? 'default'}` : options.model, correct, scored: scored.length, rows }, null, 2));
    return;
  }
  console.log(`\n${correct}/${scored.length} correct`);
  if (falsePass.length) console.log(`DANGEROUS — damaged rewrites accepted: ${falsePass.map((row) => row.id).join(', ')}`);
  if (falseFail.length) console.log(`BLOCKING — correct rewrites rejected: ${falseFail.map((row) => row.id).join(', ')}`);
  if (!falsePass.length && !falseFail.length) console.log('judge grades meaning and fidelity as specified');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
