# Rewrite-Axis Categorization — Historical Run Results

Recorded outputs from patina v3.10.0 with `codex-cli` (gpt-5.5), remapped to
the v7 axis names. Reproduce `casual`/`professional` with `--register`; reproduce
`academic`/`narrative`/`marketing`/`instructional` with `--document-type`.

**Date:** 2026-05-06
**Backend:** codex-cli (Codex v0.128.0, gpt-5.5)
**Language:** ko
**Mode:** rewrite

---

## Input (common)

> 이 도구는 개발자들의 생산성 향상에 상당한 기여를 하고 있습니다. 특히 반복적인 코드 작성 작업에서 그 효율성이 두드러지게 나타나고 있으며, 다양한 업무 환경에서 활용 가능성이 높습니다. 아울러 학습 곡선이 비교적 완만한 편이어서 초보 개발자들도 쉽게 접근할 수 있다는 장점이 있습니다.

---

## casual

이 도구를 쓰면 개발 속도는 확실히 빨라진다. 특히 매번 비슷하게 짜는 코드, 예를 들면 CRUD 뼈대나 테스트 초안 같은 작업에서 차이가 난다.

좋은 점은 진입 장벽이 낮다는 거다. 초보 개발자도 오래 붙잡고 배울 필요 없이 바로 써볼 수 있고, 팀마다 일하는 방식이 조금 달라도 꽤 잘 맞는다. 모든 일을 맡길 도구는 아니지만, 반복 작업을 줄이는 용도로는 꽤 쓸 만하다.

---

## professional

이 도구는 개발자의 반복 작업을 줄여 생산성 향상에 도움이 된다. 특히 비슷한 코드를 여러 번 작성해야 할 때 효과가 크고, 업무 환경이 달라도 적용하기 쉽다. 학습 곡선도 가파르지 않아 초보 개발자도 비교적 빠르게 익힐 수 있다.

---

## academic

이 도구는 반복적인 코드 작성과 상용구 코드 생성에서 개발자의 작업 시간을 줄이는 데 활용된다. 특정 업무 환경에만 한정되지 않고 여러 개발 맥락에 적용할 수 있으며, 기본 사용법을 익히는 부담이 크지 않아 초보 개발자도 비교적 쉽게 도입할 수 있다.

---

## narrative

이 도구를 써보고 나서 제일 먼저 느낀 건, 손이 덜 바쁘다는 점이었다. 반복해서 짜야 하는 코드, 이름만 조금 바뀌는 함수, 매번 비슷하게 붙이는 테스트 같은 것들이 확실히 빨리 끝난다.

처음부터 어렵게 느껴지지도 않았다. 초보 개발자라도 몇 번 만져보면 대충 감이 온다. 모든 상황을 대신해 주는 도구는 아니지만, 적어도 지루한 부분을 덜어내는 데는 꽤 쓸 만하다.

---

## marketing

개발자는 반복되는 코드 작성에 시간을 너무 많이 씁니다. 이 도구는 그 시간을 줄여줍니다. 보일러플레이트 작성, 간단한 수정, 익숙한 패턴의 코드 생성에서 특히 빠르게 체감됩니다.

처음 쓰는 개발자도 금방 따라옵니다. 복잡한 설정이나 긴 학습 과정 없이 바로 작업 흐름에 붙일 수 있어, 개인 프로젝트부터 팀 개발 환경까지 부담 없이 도입할 수 있습니다.

---

## instructional

반복해서 쓰는 코드는 이 도구에 맡기세요. 보일러플레이트나 비슷한 함수처럼 손으로 치면 시간만 쓰는 작업에서 효과가 큽니다.

처음 쓰는 개발자라면 작은 작업부터 시작하세요. 익히는 데 오래 걸리지 않고, 팀마다 다른 업무 흐름에도 맞춰 써볼 수 있습니다.

---

## AI-likeness Scores (`--score`, codex-cli backend)

| Variant       | Overall (±10) | Verdict |
|---------------|---------------|---------|
| Input (raw AI draft) | 2.6  | human   |
| casual        | 0.0           | human   |
| professional  | 0.0           | human   |
| academic      | 0.7           | human   |
| narrative     | 0.0           | human   |
| marketing     | 0.0           | human   |
| instructional | 0.0           | human   |

All rewritten outputs score at or near 0/100 on the model's scoring rubric, and every variant is classified as `human`. Two caveats: (1) the raw AI input itself only scores 2.6, so this scorer is lenient — treat absolute values as a relative signal across variants, not a calibrated "AI probability"; (2) `--score` results vary run-to-run by ±10 (the rubric's stated tolerance), so single-run deltas under 10 points are noise.

---

## Observations

- All six explicit variants preserve the core meaning: productivity gain, repetitive task reduction, versatility, low learning curve.
- Delivery and document-policy changes differ: casual/professional use Register; academic/narrative/marketing/instructional use Document Type.
- casual and instructional outputs add concrete examples (CRUD 뼈대, 테스트 초안, 보일러플레이트) that are not in the input. Under the v7 contract, new factual examples are not justified by an axis change and should be rejected by meaning verification.
- `--score` shows all variants in the human band (0–3), but see the caveats above before treating the absolute numbers as a quality measure.
