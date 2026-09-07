---
pattern: 36
type: failure
name: 가짜 통찰 셋업
pack: ko-filler
language: ko
---

# Pattern 36: 가짜 통찰 셋업 — Failure (False Positive)

## Input Text

> 대부분이 잘못 알고 있는 사실인데, 1976년 저작권법 개정으로 이 사안은 이미 규율된다. 시중 개론서 다섯 권 중 세 권이 반복하는 통념은 1978년 이전 음반이 연방 보호 밖이라는 것이다. 그러나 제301조 (c)항은 다르게 말한다. 주법 보호는 2067년까지 이어지고, 2018년 CLASSICS 법이 디지털 실연권을 그 위에 더했다.

## Expected Output

> (수정 없음 — 이 텍스트는 Pattern 36을 발화시키지 않아야 한다)

## Applied Pattern

- Pattern 36 (가짜 통찰 셋업): "대부분이 잘못 알고 있는"이 문단을 연다.

## Judgment

**Failure (false positive)** — 통념을 구체적으로 적고 조문을 들어 반박하는 논증 형식의 대조군이다. 다만 개론서 다섯 권의 제목과 인용 위치는 입력에 없다. 이 파일은 법률 내용이나 통념의 실제 분포를 검증한 자료가 아니며, 출처가 완비됐다고 보아서는 안 된다.
