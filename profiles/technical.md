---
profile: technical
name: 기술 문서 프로필
version: 1.0.0
scope: API 문서, README, 개발자 가이드, 아키텍처 문서, 기술 블로그 포스트, 변경 로그
voice-overrides:
  first-person: suppress        # 기술 문서는 비인칭 서술이 기본
  opinions: suppress            # 사실과 절차 서술, 주관적 평가 배제
  rhythm-variation: allow       # 약간의 변화는 허용하되 일관성 우선
  humor: suppress               # 기술 문서에서 유머는 부적절
  messiness: suppress           # 구조적 명확성이 필수
  concrete-emotions: suppress   # 감정 서술 대신 기술적 사실 기술
  formality: allow              # 격식과 비격식 사이 — 명확하되 접근 가능한 어조
pattern-overrides:
  ko:
    4: amplify                  # 홍보성 표현 — 기술 문서는 사실 기반이어야 하므로 적극 교정
    5: amplify                  # 모호한 출처 — 기술 문서는 구체적 출처(버전, RFC, 공식 문서) 필수
    7: suppress                 # AI 어휘 남발 — "체계적인", "종합적인" 등은 기술 용어로 사용 시 허용
    8: reduce                   # ~적 접미사 — "효과적", "구조적" 등 기술 맥락에서 일부 허용
    14: suppress                # 볼드체 — 기술 문서에서 키워드 강조는 표준 관행
    15: suppress                # 인라인 헤더 — 단계별 가이드, FAQ 등에서 필수
    18: suppress                # 한자어/공식어 — "구현하다", "설정하다" 등은 기술 한국어 표준
    23: reduce                  # 과도한 헤징 — "~할 수 있다", "일반적으로"는 정밀한 기술 표현; 3개 이상 중첩 시만 교정
    25: reduce                  # 구조적 반복 — 단계별 가이드는 의도적으로 병렬 구조를 사용
    27: suppress                # 수동태 — "설치된다", "실행된다" 등 기술 문서에서 관례적
  en:
    4: amplify                  # Promotional language — tech docs should state facts, not sell
    5: amplify                  # Vague attributions — must cite specific versions, RFCs, or docs
    7: suppress                 # AI vocabulary — "robust", "comprehensive", "leverage" are standard technical terms
    8: suppress                 # Copula avoidance — "serves as", "functions as" describe actual technical roles
    14: suppress                # Boldface — keyword emphasis is standard in docs
    15: suppress                # Inline-header lists — essential for step-by-step guides, API references
    22: reduce                  # Filler phrases — "note that" is conventional in technical docs; only correct clusters
    23: reduce                  # Excessive hedging — "may", "typically", "in most cases" are precision qualifiers in docs
    25: suppress                # Metronomic paragraphs — uniform structure is intentional in reference docs
    26: suppress                # Passive voice — "is returned", "is configured", "was deprecated" are standard technical passive
    27: reduce                  # Zombie nouns — "perform a backup", "conduct a migration" sometimes used; excessive nominalization still corrected
---

# 기술 문서 프로필

API 문서, README, 개발자 가이드, 아키텍처 문서에 맞는 교정을 수행한다. 기술적 정확성과 명확성을 유지하면서 AI 패턴을 제거한다.

## 범위

이 프로필은 **API 문서, README, 개발자 가이드, 아키텍처 문서, 기술 블로그 포스트, 변경 로그**에 한정된다. 마케팅 문서, 제품 랜딩 페이지, 일반 블로그는 이 프로필의 범위가 아니다.

## 어조 지침

- **명확하고 직접적으로 쓴다.** 기술 문서의 목적은 독자가 작업을 완료하는 것이다. 모호하거나 장황한 서술은 방해물이다.
- **사실 기반으로 서술한다.** "강력한 기능"이 아니라 "최대 10,000 req/s를 처리한다." 측정 가능한 사양과 동작을 기술한다.
- **정밀한 헤징은 허용한다.** "일반적으로 5초 이내에 완료된다"는 정확한 표현이다 — 100%를 보장할 수 없으면 "일반적으로"가 올바른 한정어다. 단, "다소 어느 정도 개선될 수 있을 것으로 보인다"처럼 중첩하면 교정한다.
- **코드 예시와 구체적 값을 우선한다.** 설명보다 예시가 명확하다. "설정 파일을 수정하면 된다" 대신 실제 설정 스니펫을 보여준다.
- **독자를 2인칭으로 부른다.** "사용자는"보다 "다음 명령을 실행하세요" 또는 "Run the following command"가 기술 문서의 표준이다.
- **1인칭은 사용하지 않는다.** 기술 문서는 제품/시스템이 주어다. "우리는 이 기능을 제공합니다" 대신 "이 기능은 v2.3에서 추가되었다."

## 패턴 처리 (한국어)

- **홍보성 표현(ko #4):** 기술 문서에서 "혁신적인 솔루션", "업계 최고의" 같은 표현은 적극 교정한다. 사양과 벤치마크로 대체.
- **모호한 출처(ko #5):** "공식 문서에 따르면"은 불충분하다. 구체적 문서명, 버전, URL을 명시하도록 교정.
- **AI 어휘(ko #7), 한자어(ko #18):** "구현하다", "설정하다", "체계적인"은 기술 한국어의 표준 어휘다. 교정하지 않는다.
- **~적 접미사(ko #8):** "효과적", "구조적"은 기술 맥락에서 허용. "혁신적", "선도적"은 교정 대상.
- **볼드체(ko #14), 인라인 헤더(ko #15):** 기술 문서의 핵심 포매팅이다. 교정하지 않는다.
- **헤징(ko #23):** 단일 한정어("일반적으로", "~할 수 있다")는 기술적 정밀성. 3개 이상 중첩 시만 교정.
- **구조적 반복(ko #25):** 단계별 가이드의 병렬 구조("1. ~합니다. 2. ~합니다.")는 의도적이다. 모든 문단이 동일 패턴이면 교정.
- **수동태(ko #27):** "설치된다", "실행된다"는 기술 문서 관례. 이중 피동("~되어지다")만 교정.

## Pattern Handling (English)

- **Promotional language (en #4):** "Cutting-edge solution", "industry-leading" have no place in technical docs. Replace with specifications and benchmarks. Aggressively correct.
- **Vague attributions (en #5):** "According to best practices" is insufficient. Cite the specific RFC, version, or documentation page. Aggressively correct.
- **AI vocabulary (en #7), Copula avoidance (en #8):** "Robust", "comprehensive", "serves as", "functions as" are standard in technical writing when describing actual system behavior. Do not correct.
- **Boldface (en #14), Inline-header lists (en #15):** Core formatting in docs. Do not correct.
- **Filler phrases (en #22):** "Note that" and "keep in mind" are conventional in technical docs for caveats. Only correct when 3+ cluster in one section.
- **Hedging (en #23):** "May", "typically", "in most cases" are precision qualifiers — they prevent false guarantees. Only correct when qualifiers stack to say nothing.
- **Metronomic paragraphs (en #25):** Reference docs and API descriptions are intentionally uniform. Do not correct.
- **Passive voice (en #26):** "Is returned", "is configured", "was deprecated" are standard technical passive. Do not correct.
- **Zombie nouns (en #27):** "Perform a backup", "conduct a migration" appear in some tech docs. Correct only when a simpler verb form exists with no loss of precision (e.g., "make a modification to" → "modify").

## voice.md 오버라이드

이 프로필은 `core/voice.md`의 지침을 다음과 같이 조절한다:

| voice.md 지침 | 기술 문서 프로필에서 |
|--------------|-------------------|
| "의견을 가져라" | **억제** — 기술 문서는 사실과 절차를 서술, 주관적 평가 배제 |
| "리듬을 바꿔라" | **허용** — 약간의 변화는 자연스러우나 일관성이 우선 |
| "나를 써라" | **억제** — 제품/시스템이 주어, 1인칭 불필요 |
| "좀 지저분해도 괜찮다" | **억제** — 구조적 명확성이 기술 문서의 핵심 |
| "감정을 구체적으로" | **억제** — 기술적 사실 기술이 기본 |
| "유머를 써라" | **억제** — 기술 문서에서 유머는 혼란을 줄 수 있음 |
| "Use contractions" (en) | **허용** — 개발자 가이드에서 "don't", "isn't" 등 자연스러운 축약 허용 |
| "Break register" (en) | **억제** — 일관된 기술적 어조 유지 |
| "Let a sentence fragment stand" (en) | **억제** — 기술 문서에서 불완전 문장은 모호함을 유발 |
