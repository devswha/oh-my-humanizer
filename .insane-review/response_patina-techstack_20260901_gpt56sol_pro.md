# harvest — GPT 응답 (구독 ChatGPT)

- 패킹: (없음 / 프롬프트-only)
- 프롬프트: (harvest) https://chatgpt.com/c/6a9686d8-3878-83ee-b28b-85e1546672ef...

---

총평

첨부 코드 기준으로는 기술 스택은 승인, 현재 유료 출시 경로는 수정 후 승인입니다.

Pure ESM·빌드 없는 CLI·js-yaml 단일 런타임 의존성·node:test·서버리스·vanilla JS를 지금 갈아엎을 이유는 없습니다. 1MB라는 소스 크기보다 실제 위험은 결제 경로의 timeout/쿼터/락 불일치와, 제품 정책이 여러 표면에 중복된 데 있습니다.

먼저 사실관계가 하나 다릅니다. 첨부본은 v7.0.0이 아니라 package.json:3과 SKILL.md:3 모두 8.1.0입니다. 아래 평가는 첨부된 v8.1.0을 기준으로 합니다. 또한 팩의 Notes가 포함 대상을 제한하고 있어 tests/unit/**, tests/e2e/**, 대부분의 스크립트 본문은 빠져 있습니다. 따라서 테스트 “실행 구성”은 평가할 수 있지만 실제 분기 커버리지는 확인할 수 없습니다.

영역	판정
Pure ESM	유지
빌드 없는 Node CLI	유지
js-yaml 단일 런타임 의존성	유지
Node 18 지원 정책	종료 필요
전면 TypeScript 전환	출시 후로 연기
CLI 번들링	도입하지 않음
모노레포 도구	아직 불필요
서버리스	초기 유료 단계에서는 유지
Vanilla JS	유지하되 모듈 분리
node:test	유지하고 커버리지·릴리스 게이트 보강
1. Pure ESM·빌드 없음·Node 18
Pure ESM과 무의존 정책은 여전히 정당합니다

소스 1MB는 번들러 도입 기준이 아닙니다. 디스크에 있는 파일 크기와 실제 시작 시 import되는 코드량은 다르며, Patina는 정적 애플리케이션보다 “코드+편집 자산” 패키지에 가깝습니다.

런타임 의존성은 실제로 js-yaml 하나뿐입니다. package.json:58-60

기본 설정과 저장소 루트를 소스 위치에서 찾습니다. src/config.js:8-9,26-28,120-128

언어 패턴과 사용자 커스텀 팩을 런타임에 디렉터리에서 발견합니다. src/loader.js:41-84

npm 배포물도 src/, patterns/, document-types/, lexicon/, personas/를 함께 싣습니다. package.json:96-125

따라서 CLI 번들링은 REPO_ROOT 추론, 자산 복사, custom/ 오버라이드, 읽기 쉬운 스택트레이스를 복잡하게 만듭니다. 현재 코드와 직접 충돌하는 변경입니다. 먼저 node bin/patina.js --help의 cold-start p95와 import 프로파일을 측정하고, 모듈 로딩이 시작 시간의 30% 이상이거나 사용자 체감 startup SLO를 넘을 때만 CLI 번들링을 재검토하십시오.

Node 18 바닥 정책은 정당하지 않습니다

engines는 >=18.1.0인데 CI는 오히려 지원 범위 밖인 18.0.0을 사용하고, 그 버전에서는 전체 테스트도 실행하지 않습니다. package.json:61-63, .github/workflows/test.yml:17-20,31-57

2026년 9월 기준 Node 18은 2025-03-27, Node 20도 2026-03-24에 EOL입니다. 공식 권고도 프로덕션에는 Active/Maintenance LTS만 쓰라는 것입니다. Node.js 릴리스 현황
 Vercel이 현재 제공하는 런타임도 24.x, 22.x, 20.x이며 18은 없습니다. Vercel 지원 Node 버전

권장안은 다음과 같습니다.

웹 서버리스: 지금 Node 24로 명시적으로 고정하고 CI에 24를 추가합니다.

CLI: 이미 공개된 8.x의 호환성을 조용히 깨지 말고, 8.x에서 Node 18/20 종료를 공지한 뒤 **다음 major에서 >=22**로 올립니다.

릴리스 작업도 Node 20에서 24로 올립니다. 현재 릴리스는 Node 20입니다. .github/workflows/release.yml:27-30,82-86

TypeScript·번들러·모노레포 도입 기준

팩 기준 src/**/*.js 78개 중 @ts-check는 25개뿐이고, 53개 약 13.5K행은 체크되지 않습니다. tsconfig.json도 allowJs: true지만 checkJs: false, noEmit: true입니다. tsconfig.json:3-5

변경	지금	도입 시점	대략적 비용·현재 충돌
JSDoc 타입검사 확대	도입	결제 경로부터 별도 tsconfig로 검사	낮음. 기존 no-build 정책과 호환
전면 TypeScript	연기	3명 이상이 핵심 코드를 병렬 수정하거나, 스키마/옵션 불일치 장애가 반복되거나, 공개 JS API 타입이 필요할 때	1인 기준 대략 수 주. noEmit, 자산 배치, npm 배포 경로를 모두 바꿔야 함
CLI 번들러	도입하지 않음	실제 startup/import 프로파일이 병목일 때	런타임 자산 탐색과 충돌. src/config.js:8-9, src/loader.js:41-84
웹 번들러	아직 불필요	해시 자산·코드 분할·공유 브라우저 모듈이 필요할 때	CLI와 별도 결정이어야 함
npm workspace/모노레포	연기	독립 버전·독립 릴리스되는 내부 패키지가 3개 이상일 때	현재 alias는 정확히 patina-cli@8.1.0만 전달합니다. packages/patina-humanizer/package.json:3-10

지금은 tsconfig.revenue.json 같은 좁은 설정으로 api/**, rewrite-handler, entitlement*, rate-limit, web-rewrite*, streaming-api, scoring부터 checkJs를 강제하는 것이 비용 대비 가장 좋습니다.

2. 결정론 계층과 LLM 오케스트레이션
방향은 좋고 의도도 명확합니다

src/features/index.js는 스스로 Lane A·LLM-free임을 선언하고, import도 segmentation·stylometry·lexicon·classifier 같은 결정론 모듈로 한정합니다. src/features/index.js:1-5,7-54

웹 LLM 경로도 Lane B로 명시되어 있고 transport, prompt, asset loading을 담당합니다. src/web-rewrite.js:1-15 특히 runWebRewriteStream은 transport, scorer, emit, signal을 주입받으므로 테스트 가능한 오케스트레이터 형태입니다. src/web-rewrite-stream.js:203-215

이 경계는 유지해야 합니다. 문제는 경계의 “이름”이 아니라 몇몇 정책이 양쪽에 걸쳐 있다는 점입니다.

개선점 1: scoring.js를 세 책임으로 분해해야 합니다

scoring.js는 동시에 다음을 소유합니다.

LLM transport 호출과 strict JSON 재시도: src/scoring.js:2,133-210

결정론 feature 호출: src/scoring.js:4-6

LLM/결정론 점수 조정 정책: src/scoring.js:618-728

prompt-builder 의존: src/scoring.js:7

반대로 prompt-builder.js가 SCORE_INTERPRETATION_BANDS를 다시 scoring.js에서 import하며 순환 의존성을 “benign”이라고 설명합니다. src/prompt-builder.js:2-5 여기에 api.js → anthropic-native.js → prompt-builder.js가 이어져 실제 SCC는 다음과 같습니다.

scoring → api → anthropic-native → prompt-builder → scoring

근거는 src/api.js:2-4, src/anthropic-native.js:18, src/prompt-builder.js:5, src/scoring.js:2,7입니다.

권장 분리는 다음과 같습니다.

domain/scoring-policy.js: 점수 band, floor, severity, reconciliation

domain/number-safety.js: 숫자·날짜·단위 불변식

application/rewrite-pipeline.js: rewrite → deterministic gate → MPS/fidelity → floor

infra/llm/*: API, Anthropic native, retry, prompt-cache split

CLI/Web/Skill은 얇은 adapter와 서로 다른 실패 표시 정책만 소유

이는 현재 prompt-builder가 scoring constant를 소유 모듈에서 역으로 가져오는 구조와 충돌하지만, 동작 변경 없이 cycle부터 제거할 수 있습니다.

개선점 2: 결정론 숫자 정책을 하나로 합쳐야 합니다

src/verify.js:8-64와 src/features/meaning-proxy.js:16-20,425-447가 NUMBER_RE, grouping normalization, droppedNumbers를 각각 구현합니다. 후자는 더 강한 numeric-safety-v2 정책까지 갖고 있으므로 별도 복사본은 시간이 지나면 반드시 달라집니다.

Lane A 순수성을 유지하려면 공용 구현을 features/number-safety.js로 옮기고 Lane B가 그것을 import해야 합니다. LLM-free 모듈이 Lane B를 import하는 방향만 피하면 됩니다.

개선점 3: 세 출시 형태의 보증이 이미 다릅니다

README는 “every rewrite”가 MPS/fidelity gate를 통과하고 실패 시 retry/rollback한다고 주장합니다. README.md:37-42

하지만 CLI는 --verify가 있을 때만 MPS/fidelity를 수행합니다. src/cli/run.js:247-296, src/cli/args.js:788-790 기본 경로는 숫자 누락 경고와 exit 4만 설정합니다. src/cli/run.js:298-304 더구나 verify가 두 번 실패해도 가장 fidelity가 높은 텍스트를 출력합니다. src/verify.js:174-185 반면 웹은 항상 두 scorer를 실행하고 floor 미달 결과를 거부합니다. src/web-rewrite-stream.js:355-405

즉 현재 충돌은 다음입니다.

Skill: “MPS verified” 보증. SKILL.md:2-4

웹: 항상 검증하고 거부

CLI 기본: 검증하지 않음

CLI --verify: 미달 결과도 출력하되 exit 4

출시 전에는 비용·latency를 바꾸는 CLI 기본검증 도입보다 문서의 “every surface” 주장을 실제 의미에 맞게 고치는 것이 안전합니다. 장기적으로는 한 pipeline result를 공유하고, 각 adapter가 reject, emit-with-exit-code, retry 중 무엇을 할지만 결정하게 해야 합니다.

3. 서버리스 확장성·비용·보안

서버리스 자체는 초기 유료 단계에 적합합니다. 상태를 KV에 두고, 주요 latency와 비용이 LLM에 있으며, warm instance에는 asset cache도 있습니다. src/web-rewrite.js:17-18,37-70 지금 컨테이너나 큐로 옮겨도 최대 병목인 provider latency와 3~4회 LLM 호출은 사라지지 않습니다.

다만 아래 네 건은 유료 출시 전 P0입니다.

우선순위	문제와 근거	수정안 및 현재 코드와의 충돌
P0	180초가 전체 deadline이 아닙니다. api/rewrite.js:236-240,276-280은 “one stream budget”이라고 하지만 runner에는 같은 timeout만 전달합니다. api/rewrite.js:401-412 rewrite는 최대 두 번 순차 실행되고 src/web-rewrite-stream.js:295-353, 이후 scorer 두 개가 각 timeout으로 실행됩니다. src/web-rewrite-stream.js:355-375 scorer 내부도 schema retry와 transport retry를 중첩합니다. src/scoring.js:133-210, src/api.js:414-439	요청 시작 시 하나의 절대 deadline과 outer AbortController를 만들고 모든 rewrite/scorer/transport에 남은 시간을 전달하십시오. api/rewrite.js에도 명시적 maxDuration을 두십시오. 현재 vercel.json:9-15는 monitor에만 60초가 있습니다. Vercel maxDuration

P0	BYOK concurrency 계약이 실행되지 않습니다. 계약과 문서는 2를 선언합니다. src/web-rewrite-contract.js:59-66, docs/HTTP-API.md:46-50 그러나 limiter는 “BYOK is unmetered”라며 check와 concurrency 모두 no-op입니다. src/rate-limit.js:184-191,221-224 비어 있지 않은 가짜 key도 검증을 통과합니다. src/web-rewrite-contract.js:510-517	BYOK도 IP 기준 동시 2개와 적당한 burst cap을 적용하십시오. provider quota는 사용자 비용만 막을 뿐 Patina의 함수·연결·egress 남용을 막지 못합니다.
P0	유효한 CJK refine 요청이 413이 됩니다. handler body cap은 65,536 bytes입니다. src/rewrite-handler.js:27,83-90,326-339 그러나 BYOK/Pro는 text와 original 각각 20K characters, history 12KiB를 허용합니다. src/web-rewrite-contract.js:66,121,481-493 CJK 두 필드만 약 120KB가 될 수 있습니다.	전체 envelope를 256KiB 정도로 올리고 각 필드별 cap은 그대로 유지하십시오. KO/ZH/JA 20K + refine + history 경계 테스트가 필요합니다. 현재 byte cap과 공개 계약이 직접 충돌합니다.
P0	Polar single-flight lock의 TTL self-heal이 지속 요청에서 깨집니다. lock을 incr(...ttlMs)로 잡고 follower도 increment합니다. src/entitlement.js:246-286 REST KV의 increment는 매번 PEXPIRE를 다시 겁니다. api/rewrite.js:151-153 따라서 winner가 죽은 동안 follower가 계속 오면 TTL이 계속 연장될 수 있습니다. 이는 “TTL self-heals”라는 주석과 충돌합니다. src/entitlement.js:289-303	owner token을 가진 SET NX PX로 획득하고 follower는 lock을 건드리지 않은 채 cache만 polling하십시오. release는 compare-and-delete로 구현해야 합니다.

그다음 P1은 다음과 같습니다.

비용 관측: 계약 주석은 Pro 요청을 3 LLM 호출, $0.035–0.075, 약 47% margin으로 계산합니다. src/web-rewrite-contract.js:67-84 그러나 number-safety retry로 rewrite가 두 번 실행될 수 있어 최악에는 rewrite 2 + scorer 2 = 4회입니다. src/web-rewrite-stream.js:295-353 시도별 usage는 이미 수집하지만 return-only입니다. src/web-rewrite-stream.js:269-303 현재 patina.web.v1 운영 스키마에는 token/cost가 없습니다. src/web-observability.js:15-33 기존 개인정보 최소화 스키마는 유지하고, 별도의 집계 전용 stage/provider/model/token/cost bucket을 추가해야 합니다.

log-query idempotency: 유효한 delivery마다 무조건 incrAll합니다. services/log-query/api/ingest.js:67-87 Redis script는 atomic하지만 delivery dedupe는 없습니다. services/log-query/lib/rest-kv.js:8-17,47-52 commit 후 HTTP 응답 유실로 재전송되면 이중 집계됩니다. Polar webhook이 이미 쓰는 dedupe 패턴(api/polar-webhook.js:11,82-101)처럼 delivery ID 또는 body digest를 SET NX하고 increment를 한 Lua transaction으로 묶으십시오.

스트림 결과의 권위: 첫 attempt의 delta는 숫자/MPS/fidelity 검증 전에 전송됩니다. src/web-rewrite-stream.js:295-303,320-353 브라우저는 delta를 화면에 보여주고 done에서만 승인합니다. playground/chatgpt.js:1144-1181 UI는 안전하지만 외부 API 소비자가 delta를 확정 결과로 취급할 수 있습니다. docs/HTTP-API.md:56-76에 “delta는 provisional, done만 authoritative”를 명시하고, 유료 API 공개 전에 /api/v1/rewrite 또는 protocol version을 넣는 편이 좋습니다. 현재 문서는 경로가 unversioned라고 명시합니다. docs/HTTP-API.md:172-174

보안의 기본 자세는 좋은 편입니다. BYOK base URL과 model을 고정 allowlist로 제한해 SSRF·키 유출을 막고(src/web-rewrite-contract.js:162-217), secret redaction을 중앙화했으며(src/web-rewrite-contract.js:260-320), Pro Authorization은 runner 전에 제거합니다(src/rewrite-handler.js:156-161). Polar도 status·organization·benefit·expiry를 다시 검증합니다. src/entitlement-polar.js:99-129 이 설계를 유지하고 BYOK admission hole만 닫으면 됩니다.

서버리스에서 컨테이너/비동기 job으로 넘어갈 조건은 다음 셋입니다.

전체 deadline 안에 완료하지 못하는 비율이 지속적으로 높아질 때

동시 요청이 함수/연결 한도를 꾸준히 점유할 때

클라이언트 연결과 무관하게 재개 가능한 장문 job이 제품 요구가 될 때

현재는 해당 전환보다 stage별 deadline과 비용계측이 먼저입니다.

4. Vanilla JS 프런트엔드

프레임워크 교체는 지금 하지 않는 것이 맞습니다.

playground/chatgpt.js는 약 69KB·1,407행으로 크지만 브라우저 전송량 자체는 작습니다. 보안상 중요한 출력도 textContent를 사용합니다. playground/chatgpt.js:355-359 문제는 크기가 아니라 한 파일이 동시에 다음을 소유한다는 점입니다.

대화·라이선스 상태: playground/chatgpt.js:342-350

checkout/UTM: 362-462

preflight·submit: 988-1077

streaming·취소·검증 UI: 1080-1231

i18n과 샘플 데이터: 107-340

출시 전에는 결제·스트리밍 흐름을 프레임워크로 다시 쓰지 마십시오. 대략 1–2주 이상의 재작성과 취소·접근성·인증 회귀 비용이 생깁니다. 대신 출시 직후 vanilla ESM 모듈로 다음만 분리하면 됩니다.

i18n-content.js

checkout-session.js

conversation-store.js

rewrite-controller.js

stream-presenter.js

또한 src/web-rewrite-contract.js와 playground/src/web-rewrite-contract.js는 :1-13부터 동일한 파일인데 둘 다 스스로 “one source of truth”라고 주장합니다. 이는 이미 유지보수 결함입니다. 현재 Vercel build가 launch-config:generate를 실행하므로(vercel.json:4-5), 그 단계에서 정본을 playground로 복사하고 diff가 있으면 CI를 실패시키면 됩니다. 번들러나 프레임워크는 필요하지 않습니다.

프레임워크 도입 조건은 계정/청구 dashboard, 다중 route, 영속 대화, 재사용 컴포넌트, 여러 프런트엔드 기여자가 동시에 생기는 시점입니다. 그때도 작은 Preact/Lit/Svelte 계열부터 검토하는 편이 현재 코드 규모에 맞습니다.

5. 테스트·품질 인프라

판정은 “빠르기는 충분하지만, 유료 경계의 안전성까지 증명하지는 못한다”입니다.

좋은 점은 명확합니다.

node:test로 unit/e2e를 실행해 도구 복잡도가 낮습니다. package.json:13-16

결정론 benchmark는 LLM 없이 전체 fixture를 실행합니다. tests/quality/benchmark.mjs:1-21

accuracy·precision·recall·F1과 Wilson CI를 계산합니다. tests/quality/benchmark.mjs:78-93

fixture별 pinned range를 검증하고(:261-270), 단 한 건의 오분류도 non-zero exit로 막습니다. :343-384

CI는 여러 Node 버전과 benchmark/docs dogfood를 분리합니다. .github/workflows/test.yml:29-105

보완점은 세 가지입니다.

커버리지: 전역 80% 같은 숫자를 즉시 강제하지 말고 우선 리포트를 수집한 뒤 rewrite-handler, rate-limit, entitlement*, web-rewrite-stream, Polar webhook, log ingest의 branch coverage만 gate로 삼으십시오. Node 자체가 --experimental-test-coverage와 lcov reporter를 제공하므로 의존성을 추가하지 않아도 됩니다. 다만 아직 experimental이므로 Node 24에 고정해 사용해야 합니다. Node test coverage 문서

코퍼스 과적합: 현재 gate는 훌륭한 회귀 corpus이지만, 모든 fixture를 통과해야 하는 구조는 threshold를 알려진 샘플에 맞추도록 유도합니다. tests/quality/benchmark.mjs:261-270,343-384 체크인된 소형 exact-regression corpus와, 변경자가 쉽게 재기준화할 수 없는 held-out corpus를 분리하십시오. 후자는 언어별 recall/FPR/F1 하락만 gate로 삼는 것이 좋습니다.

릴리스 게이트: 일반 CI에서는 npm run lint를 실행하지만 릴리스 workflow에는 lint/typecheck가 없습니다. .github/workflows/test.yml:23-27, .github/workflows/release.yml:33-67 prepublishOnly도 test/benchmark는 실행하지만 lint는 빠집니다. package.json:33-43 릴리스 verify와 prepublishOnly에 npm run lint를 추가해야 합니다. benchmark:report가 실제 classifier fail gate까지 실행하는지는 해당 script 본문이 팩에서 제외되어 확인할 수 없으므로, 릴리스에서는 npm run benchmark도 명시적으로 호출하는 편이 안전합니다.

6. 유지보수성 TOP 3와 우선순위
순위	리스크	근거	우선 리팩터
1	scoring/prompt/transport가 순환하고 책임이 혼재	src/scoring.js:2-8,133-210,618-728, src/prompt-builder.js:2-5	scoring-policy, LLM evaluator, deterministic reconciliation 분리
2	CLI/Web/Skill의 안전 보증과 숫자 정책이 서로 다름	README.md:37-42, src/cli/run.js:247-304, src/verify.js:174-185, src/web-rewrite-stream.js:355-405	공유 pipeline/result와 단일 number-safety 도메인 모듈
3	부분 타입검사·중복 contract·프런트 컨트롤러 단일 파일	tsconfig.json:3-5, 두 contract의 :1-13, playground/chatgpt.js:342-462,934-1231	결제 경로 checkJs, contract 생성, vanilla 모듈화
첫 유료 매출 전에 바꿀 것

절대 deadline과 maxDuration

BYOK 동시성·burst admission

256KiB body envelope와 다국어 refine 경계 테스트

Polar lock을 owner-token SET NX PX로 교체

stage별 token/cost 집계와 budget alert

릴리스 lint/typecheck gate

delta의 provisional 성격과 API version 명시

서버 런타임 Node 24 고정

README의 “every rewrite verified” 표현을 표면별 실제 동작에 맞게 수정

유지할 것

Pure ESM

빌드 없는 CLI

js-yaml 단일 런타임 의존성

결정론 feature 계층

초기 서버리스 배포

node:test

vanilla JS UI

출시 후로 미룰 것

전면 TypeScript/dist 전환

CLI 번들링

workspace 기반 모노레포 재편

React류 프런트엔드 재작성

서버리스에서 컨테이너·queue로의 이전

최종적으로, Patina의 문제는 기술 스택이 낡아서가 아니라 계약·정책·운영 budget이 여러 계층에 흩어져 있다는 것입니다. 첫 매출 직전에는 스택 교체가 아니라 위 P0 네 건과 비용 관측을 막아야 합니다. 그 상태라면 현재 구조로도 초기 유료 트래픽을 충분히 감당할 수 있습니다.

유료 출시 후에는 비용·timeout·422/5xx를 주간 단위로 점검하는 자동화가 유용합니다.

유료 출시 지표 주간 점검
