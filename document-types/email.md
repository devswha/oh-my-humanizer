---
document-type: email
name: 비즈니스 이메일
version: 3.0.0
scope: 비즈니스 이메일, 공식 서신, 사내 커뮤니케이션
purpose: "Move a specific request, decision, update, or response through email."
audience:
  - "The source message’s recipients and copied stakeholders"
structure:
  - "Surface the purpose early, then the minimum context, action, owner, and deadline present in the source"
  - "Preserve necessary greeting, sign-off, quoted context, and thread references"
style:
  - "Use clear requests and explicit ownership"
  - "Keep etiquette proportional to the existing relationship"
avoid:
  - "Adding urgency, commitments, deadlines, recipients, or friendliness not present in the source"
  - "Letting politeness obscure the requested action"
pattern-overrides:
  ko:
    18: reduce                  # 한자어/공식어 — 이메일에서 중간 수준 격식 허용
    21: reduce                  # 아첨 — 약간의 공손함은 이메일 관례
    27: reduce                  # 수동태 — 이메일에서 적당한 수동태 허용
  en:
    18: suppress                # Curly quotes — 이메일에서 비해당
    21: reduce                  # Sycophantic — some politeness is email convention
    8: reduce                   # Copula avoidance — some conventional email phrasing is acceptable
  zh:
    18: reduce                  # 公文体 — 이메일에서 중간 수준 허용
    21: reduce                  # 谄媚 — 약간의 공손함 허용
  ja:
    16: reduce                  # 敬語 — 비즈니스 이메일에서 적절한 경어 허용
    18: reduce                  # である調 — 이메일에서 적당한 격식 허용
    21: reduce                  # お世辞 — 약간의 공손함 허용
---

# 비즈니스 이메일

비즈니스 이메일의 수신자 관계, 요청 구조, 인사·서명 관습을 유지하면서 AI 패턴을 제거한다. casual/professional 전달 방식은 Register 또는 원문의 지배 어투를 따른다.

## 범위

비즈니스 이메일, 공식 서신, 사내 커뮤니케이션. 마케팅 이메일이나 뉴스레터는 `default` 또는 `blog` 문서 유형 사용.

## 적극 교정 대상

- **챗봇 표현 (#19):** "궁금한 점이 있으시면 말씀해 주세요"는 이메일에서도 교정. "회신 부탁드립니다"로 충분.
- **과도한 중요성 부여 (#1):** 이메일에서 "획기적인 성과"는 부적절. 구체적 결과로 대체.
- **채움 표현 (#22):** "주목할 만한 점은 ~라는 것이다" → 바로 핵심을 말한다.
- **과도한 헤징 (#23):** "어쩌면 ~일 수도 있을 것으로 사료됩니다" → "~일 수 있습니다".
- **AI 고빈도 어휘 (#7):** "시너지를 극대화하고 레버리지하여" → 구체적으로 뭘 하자는 건지 쓴다.
