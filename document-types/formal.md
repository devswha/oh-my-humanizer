---
document-type: formal
name: 정형 문서
version: 3.0.0
scope: 이력서, 자기소개서, 사업 제안서, 공식 보고서, 커버레터
purpose: "Present qualifications, proposals, or official findings in a structured, reviewable document."
audience:
  - "Recruiters, evaluators, decision-makers, or official stakeholders"
structure:
  - "Use stable sections, labels, evidence-bearing bullets, and document-specific metadata"
  - "Keep parallel structure where it supports scanning and comparison"
style:
  - "Use precise role, outcome, scope, and evidence language"
  - "Prefer verifiable statements over broad self-description"
avoid:
  - "Using this Document Type as a formality control; Register owns casual/professional delivery"
  - "Inventing achievements, metrics, responsibilities, endorsements, or institutional claims"
pattern-overrides:
  ko:
    25: suppress               # 구조적 반복 — 정형 문서는 반복 구조가 정상 (경력 항목, 불릿 리스트)
    15: reduce                 # 인라인 헤더 — 이력서 불릿은 볼드 레이블이 관례
    14: reduce                 # 볼드체 — 이력서의 직함/회사명 볼드는 관례
    18: reduce                 # 한자어/공식어 — 정형 문서에서는 격식체가 적절
    8: reduce                  # ~적 접미사 — 정형 문서에서 일부 허용 (과도한 경우만 교정)
  en:
    25: suppress               # Structural repetition — formal docs have intentionally uniform structure
    15: reduce                 # Inline-header lists — bold labels are standard in resumes
    14: reduce                 # Boldface — job titles, company names in bold is convention
    16: suppress               # Title Case — formal document headings conventionally use title case
  zh:
    25: suppress               # 结构性重复 — 简历/报告条目可有统一结构
    15: reduce                 # 内联标题 — “职责/成果”标签是正式文档惯例
    14: reduce                 # 加粗 — 职位/公司名加粗可接受
    18: reduce                 # 书面/公文体 — 正式文档允许适度正式
    8: reduce                  # 四字格 — 正式文档中少量四字格可接受
  ja:
    25: suppress               # 構造的繰り返し — 職務経歴や提案書では統一構造が自然
    15: reduce                 # インラインヘッダー — 役割/成果ラベルは正式文書の慣例
    14: reduce                 # 太字 — 役職名・会社名の強調は許容
    18: reduce                 # 硬質文体 — 正式文書では適度な硬さを許容
    8: reduce                  # 〜的 — 正式文書では一部許容
---

# 정형 문서

이력서, 자기소개서, 사업 제안서처럼 정해진 섹션과 비교 가능한 항목이 필요한 문서에 사용한다.
`formal`은 기존 CLI 식별자일 뿐 formality 축이 아니다. casual/professional 전달 방식은 `--register`가 정한다.

## 범위

이 문서 유형은 **정형 구조와 검토 가능한 근거를 요구하는 문서**에 한정된다:
- 이력서 / CV
- 자기소개서 / 커버레터
- 사업 제안서
- 공식 보고서
- 기업 소개서

개인 블로그, 에세이, SNS 글은 이 문서 유형의 범위가 아니다.

## 핵심 원칙

정형 문서의 항목 구조, 레이블, 증거 배치, 병렬성은 Document Type이 정한다.
문장 종결과 casual/professional 전달 방식은 Register가 정하고, 고유한 어휘·리듬은
명시적 Persona가 정한다. Document Type만으로 전문적인 화자나 격식을 새로 만들지
않는다.

## 패턴 처리 (한국어)

- **구조적 반복(ko #25):** 이력서의 경력 항목, 프로젝트 불릿은 동일 구조가 정상이다. 교정하지 않는다.
- **인라인 헤더(ko #15), 볼드체(ko #14):** "**역할:** 백엔드 리드" 같은 포맷은 이력서 관례다. 과도한 경우만 교정.
- **한자어/공식어(ko #18), ~적 접미사(ko #8):** 정형 문서에서 "혁신적", "체계적"은 맥락에 따라 적절하다. 과도한 경우만 교정.
- **번역체(ko #26):** 정형 문서에서도 번역체는 부자연스럽다. 기본 강도로 교정.
- **중요도 과장(ko #1):** "획기적인", "혁명적인" 같은 과장은 정형 문서에서도 제거한다. 기본 강도 유지.

## Pattern Handling (English)

- **Structural repetition (en #25):** Resume bullet points follow uniform structure by design. Do not correct.
- **Inline-header lists (en #15), Boldface (en #14):** "**Role:** Backend Lead" is standard resume formatting. Only correct excessive use.
- **Title Case (en #16):** Formal document headings conventionally use title case. Do not correct.
- **Importance inflation (en #1):** "Groundbreaking", "revolutionary" are still AI patterns in formal docs. Correct normally.
- **AI vocabulary (en #7):** "Delve", "leverage", "spearhead" — correct these even in formal contexts. Use plain professional language.
