---
title: patina X 콘텐츠 백로그
category: Social
created: 2026-07-23
notes:
  - 모든 게시 카피는 게시 전 `node scripts/precommit-score.mjs <file>` 통과(게이트 30) + X 가중 길이(CJK=2, URL=23, 한도 280) 확인 + em dash 0개(en-style.md #13).
  - 벤치마크·연구 수치는 원문 문서의 표현 범위를 넘는 일반화 주장 금지.
  - Pro 가격 CTA는 LS 심사 통과 전까지 금지.
---

# 게시 일정 (런치 주간, 2026-07-23 기준)

| 시점 | 콘텐츠 | 상태 |
|---|---|---|
| D0 지금 | EN 리플 (petergyang) | **게시됨** |
| D0 저녁 19-21시 | KO 롱폼 (patina-launch-korean-first.md) | 카피 검증 완료 |
| D0 밤 22-24시 | EN QT (patina-launch-copy.md) | 카피 검증 완료 |
| D+1 | 후일담 셀프 답글 (66.7%→0% + 스크린샷) | 카피 검증 완료 |
| D+2 | 연구 스레드 EN (아래 §1, 검증 완료) | 게시 대기 |
| D+3~ | 패턴 오브 더 데이 시리즈 시작 (§2) | 소재만 확정 |

# §1. 연구 스레드 EN — "자기 도구의 실패를 공개한 연구" (검증: 0.0%, 게이트 30)

근거: docs/research/2026-rewrite-efficacy-study1.md (사전등록 2026-07-10, 교차 패밀리 3심사 2/3 쿼럼). 수치 그대로만 쓸 것: EN Δ−23.4, KO Δ−6.0, KO AI-call 95%→93%, human EN +3.3 (CI 0 접촉), 게이트 통과 95.8%.

**전략 노트 — 게시 순서 충돌**: 이 스레드의 헤드라인("한국어 리라이트는 아직 마진널")은 KO 런치 웻지("한국어는 patina뿐")와 같은 주에 띄우면 상충한다. D+2 이후 EN으로만 먼저 게시. KO 버전은 "그래서 지금 한국어 구조 패턴을 파는 중" 로드맵 프레임으로 별도 작성 후 게시(런치 반응 소화 뒤).

1/ (251, +URL 275/280 — 연구 문서 링크 첨부)
I ran a pre-registered study on my own humanizer, judged by three LLMs from other model families. English documents: rewrites cut perceived AI-likeness by 23 points. Korean: six. Both numbers are published, because the failure is the interesting part.
https://github.com/devswha/patina/blob/main/docs/research/2026-rewrite-efficacy-study1.md

2/ (267/280)
The takeaway: words are not the tell, architecture is. Judges still called 93% of rewritten Korean AI docs "AI" because the shape survives word-level cleanup. Uniform paragraphs. Checklist coverage. The tidy problem-lesson arc. So detection has to target both layers.

3/ (249, +URL 273/280 — 레포 링크)
One more flag: rewriting human-written English nudged it toward AI, +3.3 with the CI touching zero. Over-editing is real. Run everything through a cleanup tool and you can sound more like a machine. Decision rules were fixed before any data arrived.
https://github.com/devswha/patina

# §2. 패턴 오브 더 데이 시리즈 (지속 시리즈, 주 2-3회)

포맷: 패턴 1개 = 트윗 1개. 이름 + before/after 1쌍 + 한 줄 원리. 소재는 patterns/*.md에서 그대로 (before/after 예시가 이미 문서에 있음). KO/EN 교차 게시. 시작 후보 (X에서 공감대 큰 순):
1. Em Dash Overuse (en-style #13) — 이미 밈이 된 패턴, 우리 홍보 카피에서도 뺀 실화 곁들이기
2. 이분법 대립 "단순한 X가 아니라 Y" (ko/en-language)
3. 문단마다 불릿 3개 (en-language rule-of-three)
4. 번역투 한국어 (translationese — ko 전용 진단, 경쟁 도구 없음)
5. 잠언형 펀치라인 낙하 (ko-viral-hook #, score-only인 이유까지)
6. 가짜 통계 인용 / 숫자 충격 훅 (ko-viral-hook #1)

# §3. 후순위 소재 (근거 확보됨, 카피 미작성)

- **바이럴 훅 패턴팩의 아이러니**: "바이럴 마케팅 하려고 보니 바이럴 훅 공식 자체가 우리 탐지 패턴이더라" — patterns/ko-viral-hook.md가 score-only인 이유(의도적 수사 존중)까지 풀면 도구 철학 글이 됨. 이 백로그로 X 운영하는 것 자체가 소재.
- **벤치마크 정직성 포스트**: 49 fixtures 100% + "일반화 주장 아님" 명시 — 정직한 에러바 어필. docs/benchmarks/latest.md 수치 고정 인용.
- **floor_failed 라이브 데모 영상**: 플레이그라운드에 마케팅 뻥튀기 문장 입력 → 출력 거부 화면 녹화. 2026-07-23 라이브 스모크로 재현 확인됨. 데모 GIF 파이프라인(scripts/render-demo-gif.py) 재활용 가능.
- **30% 사건 풀스토리**: 리플 한 줄로 쓴 사건의 확장판. fidelity rationale 원문 인용 포함. HN 게시 시점과 묶으면 효율적.
- **Pro 출시 공지**: LS 심사 통과 후에만. 그때 "첫 유료 고객" 빌드 인 퍼블릭 스레드로.

# §4. 대응 자산

- EN FAQ 6종: patina-launch-copy.md §reply-tree FAQ kit (전부 검증 완료)
- 후일담 스크린샷 재현: `cd /tmp/patina-x && node ~/workspace/patina/scripts/precommit-score.mjs x-ko.md x-en.md; node ~/workspace/patina/scripts/precommit-score.mjs x-ko-v2.md x-en-v4.md` (tmp 소실 시 문서 기록 수치로 재구성: 66.7% fail → 0.0% pass)
- 전환 측정: GitHub Insights referrer(t.co) + 서버 rewrite 카운트. 플레이그라운드는 무텔레메트리 설계라 UTM 무의미.
