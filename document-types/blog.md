---
document-type: blog
name: 블로그/에세이
version: 3.0.0
scope: 개인 블로그, 에세이, 개인 뉴스레터
purpose: "Publish a readable post or essay with a clear through-line and scannable organization."
audience:
  - "Readers who chose the topic but may not share the author’s full context"
structure:
  - "Use a useful opening, coherent sections, and an ending earned by the source"
  - "Keep headings only when they improve navigation"
style:
  - "Prefer concrete examples and natural transitions over generic summary scaffolding"
  - "Preserve the source’s level of technical detail"
avoid:
  - "Adding a personal anecdote, opinion, first-person stance, or intimacy absent from the source"
  - "Turning the post into marketing copy or a rigid listicle"
pattern-overrides:
  ko:
    14: suppress                # 볼드체 — 블로그에서는 흔하게 사용, 교정 불필요
    15: reduce                  # 인라인 헤더 — 블로그에서 일부 허용
    17: reduce                  # 이모지 — 블로그에서 가끔 허용 (과도한 경우만 교정)
    18: amplify                 # 한자어/공식어 — 블로그에서는 특히 부자연스러우므로 적극 교정
    8: amplify                  # ~적 접미사 — 블로그에서는 특히 딱딱하게 느껴지므로 적극 교정
  en:
    14: suppress                # Boldface — blogs use bold for readability, no correction needed
    15: reduce                  # Inline-header lists — partially allowed in blog posts
    17: reduce                  # Emojis — occasional use tolerated in personal blogs
    7: amplify                  # AI vocabulary words — especially jarring in casual blog prose
    8: amplify                  # Copula avoidance — blog prose should use simple "is", not "serves as"
  zh:
    14: suppress                # 加粗 — 博客常用于提高可读性，不默认纠正
    15: reduce                  # 内联标题 — 博客小节可部分保留
    17: reduce                  # 表情符号 — 个人博客中少量使用可接受
    18: amplify                 # 书面/公文体 — 博客里特别生硬，积极纠正
    7: amplify                  # AI高频词 — 个人语气中“赋能/生态”更刺眼
  ja:
    14: suppress                # 太字 — ブログでは読みやすさのために使われるため既定では直さない
    15: reduce                  # インラインヘッダー — ブログの小見出しとして一部許容
    17: reduce                  # 絵文字 — 個人ブログでの少量使用は許容
    18: amplify                 # 硬質文体 — ブログでは不自然なので積極的に直す
    7: amplify                  # AI語彙 — 個人文では特に浮くため強めに検出
---

# 블로그/에세이

개인 블로그와 에세이의 읽기 흐름과 탐색 구조를 적용하되, 원문의 목소리는 보존한다. 대화체, 1인칭, 개인적 의견은 Persona나 원문이 제공할 때만 사용한다.

## 범위

이 문서 유형은 **개인 블로그와 에세이**에 한정된다. 기업 블로그, 공식 뉴스레터, 보도자료는 범위가 아니다.

## 패턴 처리 (한국어)

- **볼드체(ko #14), 인라인 헤더(ko #15):** 블로그에서는 가독성을 위해 흔히 사용하므로 관대하게 처리한다. 기계적으로 모든 키워드를 볼드 처리한 경우만 교정.
- **이모지(ko #17):** 1-2개 자연스러운 사용은 허용. 모든 항목에 이모지를 붙인 경우만 교정.
- **한자어/공식어(ko #18), ~적 접미사(ko #8):** 블로그에서 "도모하다", "혁신적인" 같은 표현은 특히 부자연스럽다. 적극 교정.
- **구조적 반복(ko #25):** 블로그에서도 모든 단락이 동일 구조면 AI 티가 난다. 적극 교정.
- **번역체(ko #26):** 블로그의 독자 지향적 흐름을 방해하는 직역 표현을 교정한다. 문장 종결과 격식은 Register 또는 원문의 지배 어투를 따른다.

## Pattern Handling (English)

- **Boldface (en #14), Inline-header lists (en #15):** Blogs legitimately use bold and headers for readability. Only correct mechanical over-use across every bullet.
- **Emojis (en #17):** 1–2 natural uses are tolerated. Correct only when every item gets an emoji.
- **AI vocabulary (en #7):** Words like "delve", "tapestry", "leverage", and "multifaceted" are especially jarring in reader-facing blog prose. Aggressively correct them without inventing a personal voice.
- **Copula avoidance (en #8):** "Serves as", "functions as" read stiffly in blog writing. Replace with simple "is/are" constructions.
