---
profile: academic
name: 학술/논문 프로필
version: 1.0.0
scope: 학술 논문, 학회 발표 원고, 연구 보고서, 학술 에세이
voice-overrides:
  first-person: allow           # 분야별 조건부 허용 — 인문·사회과학은 사용, 자연과학·공학은 비인칭 (아래 어조 지침 참조)
  opinions: allow               # 근거 기반 해석은 허용하되 주관적 판단은 자제 (아래 어조 지침 참조)
  rhythm-variation: allow       # 학술문은 일정한 리듬이 자연스러우나 약간의 변화는 허용
  humor: suppress               # 학술 맥락에서 유머는 부적절
  messiness: suppress           # 구조화된 논증이 필수
  concrete-emotions: suppress   # 감정 서술보다 객관적 기술
  hedging: allow                # 학술적 완화 표현은 정당한 관행
  formality: amplify            # 격식체 유지
pattern-overrides:
  ko:
    5: reduce                   # 모호한 출처 — 학술문은 각주/참고문헌이 별도이므로 본문 내 "선행 연구에 따르면"은 허용
    7: reduce                   # AI 어휘 남발 — "체계적인", "종합적인" 등 학술 용어로 정착된 표현 허용
    8: reduce                   # ~적 접미사 — "체계적", "효과적" 등은 학술 한국어의 표준 어휘
    12: reduce                  # 장황한 조사 — "~에 있어서", "~(으)로서"는 학술문에서 관례적 사용
    16: reduce                  # ~고 있다 진행형 — 연구 진행 상황 기술에 자연스러움
    18: suppress                # 한자어/공식어 — 학술문에서는 "수립하다", "이행하다" 등이 표준 어휘
    23: suppress                # 과도한 헤징 — 학술적 완화 표현은 학문적 겸손의 관행
    27: reduce                  # 수동태 — 과학/공학 논문에서 수동태는 관례
  en:
    5: reduce                   # Vague attributions — "prior studies show" acceptable when bibliography exists
    7: reduce                   # AI vocabulary — "comprehensive", "robust", "nuanced" are standard academic register
    8: reduce                   # Copula avoidance — "serves as", "functions as" are normal in scholarly prose
    12: reduce                  # False ranges — "from X to Y" commonly used for scope definition in abstracts
    18: suppress                # Curly quotes — academic writing uses typographically correct curly quotes
    22: reduce                  # Filler phrases — "it should be noted that" is conventional academic hedging
    23: suppress                # Excessive hedging — academic qualifiers ("may suggest", "appears to") are standard
    25: reduce                  # Metronomic paragraphs — academic structure is intentionally uniform (IMRaD)
---

# 학술/논문 프로필

학술 논문, 연구 보고서, 학회 발표 원고에 맞는 교정을 수행한다. 학술적 관행과 격식을 존중하면서 AI 패턴을 제거한다.

## 범위

이 프로필은 **학술 논문, 연구 보고서, 학회 발표 원고, 학술 에세이**에 한정된다. 대학 과제, 교양 에세이, 과학 대중서는 이 프로필의 범위가 아니다 — 그런 글에는 기본 프로필이나 블로그 프로필이 더 적합하다.

## 어조 지침

- **격식체를 유지한다.** 학술문의 권위는 정확한 용어와 일관된 격식에서 온다. "~이다", "~한다" 체를 기본으로 한다.
- **근거 기반으로 서술한다.** 주관적 평가("흥미로운 결과")보다 측정 가능한 사실("p < .05에서 유의미한 차이")을 우선한다.
- **학술적 완화 표현을 존중한다.** "~일 수 있다", "~으로 보인다", "~을 시사한다"는 학문적 겸손의 관행이지 AI 헤징이 아니다. 단, 한 문장에 3개 이상 중첩되면 여전히 교정 대상이다.
- **분야별 전문 용어를 보존한다.** "체계적 문헌 고찰", "효과적 세율", "종속변수" 같은 표현은 교정하지 않는다.
- **1인칭은 분야 관행에 따른다.** 인문학·사회과학("본 연구에서는")은 허용하되, 자연과학·공학에서 불필요한 1인칭은 수동태나 비인칭 구문으로 유지한다.

## 패턴 처리 (한국어)

- **모호한 출처(ko #5):** 학술문 본문의 "선행 연구에 따르면", "기존 문헌에서"는 참고문헌 목록과 함께 사용되므로 허용한다. 다만 각주·참고문헌 없이 "전문가들은"만 반복하면 교정.
- **AI 어휘(ko #7), ~적 접미사(ko #8):** "체계적인", "효과적인", "종합적인"은 학술 한국어의 표준 어휘이다. 한 문장에 3개 이상 과적된 경우만 교정하고, 단독·이중 사용은 허용.
- **장황한 조사(ko #12):** "~에 있어서", "~(으)로서"는 학술문에서 관례적이다. 같은 문단에 3회 이상 반복될 때만 교정.
- **진행형(ko #16):** 연구 진행 상황("현재 수집하고 있다")은 자연스러움. 모든 문장이 진행형으로 끝나는 경우만 교정.
- **한자어/공식어(ko #18):** "수립하다", "이행하다", "강구하다"는 학술·정책 문서에서 표준이다. 교정하지 않는다.
- **헤징(ko #23):** 단일 완화 표현은 학문적 겸손. "~수도 있다"나 "~으로 보인다"를 교정하지 않는다. 한 주장에 3개 이상 중첩("~일 수도 있을 것으로 판단될 수 있다")만 교정.
- **수동태(ko #27):** 과학·공학 논문의 수동태("측정되었다", "관찰되었다")는 관례. 이중 피동("~되어지다")만 교정.

## Pattern Handling (English)

- **Vague attributions (en #5):** "Prior research has shown" and "existing literature suggests" are standard when a bibliography accompanies the text. Only correct when no references exist.
- **AI vocabulary (en #7):** "Comprehensive", "robust", "nuanced", "multifaceted" are standard academic register — not AI fingerprints in this context. Correct only when 4+ cluster in one paragraph without substantive content.
- **Copula avoidance (en #8):** "Serves as", "functions as" are acceptable in scholarly prose for describing institutional or theoretical roles. Correct only decorative instances.
- **False ranges (en #12):** "From X to Y" is commonly used in abstracts and scope definitions. Correct only decorative, non-informative ranges.
- **Curly quotes (en #18):** Academic writing uses typographically correct curly quotes. Do not correct them to straight quotes except inside code blocks.
- **Filler phrases (en #22):** "It should be noted that" and "it is worth mentioning" are conventional in academic prose. Correct only when 3+ fillers cluster in one paragraph.
- **Excessive hedging (en #23):** Single qualifiers ("may suggest", "appears to indicate") are standard academic caution. Only correct when qualifiers stack to the point of saying nothing.
- **Metronomic paragraphs (en #25):** IMRaD structure (Introduction, Methods, Results, Discussion) produces intentionally uniform paragraph patterns. Do not penalize structural consistency within standard academic formats.

## voice.md 오버라이드

이 프로필은 `core/voice.md`의 지침을 다음과 같이 조절한다:

| voice.md 지침 | 학술 프로필에서 |
|--------------|---------------|
| "의견을 가져라" | **허용** — 근거 기반 해석은 허용하되 주관적 판단은 자제 |
| "리듬을 바꿔라" | **허용** — 약간의 변화는 허용하되 학술문의 일정한 리듬 존중 |
| "나를 써라" | **허용 (조건부)** — 인문·사회과학은 사용, 자연과학·공학은 비인칭 유지 |
| "좀 지저분해도 괜찮다" | **억제** — 학술문에서 구조적 엄밀성은 필수 |
| "감정을 구체적으로" | **억제** — 객관적 기술이 기본, 감정 서술은 부적절 |
| "유머를 써라" | **억제** — 학술 맥락에서 유머는 권위를 약화시킴 |
| "Use contractions" (en) | **억제** — 학술 영어에서 축약형은 비격식으로 간주 |
| "Break register" (en) | **억제** — 학술문에서 레지스터 전환은 비전문적으로 인식 |
| "Let a sentence fragment stand" (en) | **억제** — 학술 영어에서 불완전 문장은 허용되지 않음 |
