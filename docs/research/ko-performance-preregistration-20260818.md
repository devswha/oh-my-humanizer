# 한국어 재작성 성능 확인 실험 사전등록

## 목적

`iterative-baseline`과 `ko-diagnosis-v1`을 같은 한국어 원문에서 비교한다.
detector 점수는 진단값으로만 보고 후보 선택에는 사용하지 않는다. 의미 보존,
자연스러움, 문서 내부의 흐름이 개선됐다는 근거가 모두 있어야 승격한다.
확인 실험이 끝나기 전에는 production 기본값을 바꾸지 않는다. treatment는
`PATINA_KO_DIAGNOSIS_RESEARCH=1`에서만 hosted prompt에 들어간다.

## 고정 표본

- 확인 표본: `tests/fixtures/ko-performance/confirmatory.jsonl`
- SHA-256: `23c546abd02fdf34b3df11f0427c116cd184f39ab2e23319f4b4dd2c2ce5fee3`
- 총 120건
- 업무 보고서, 이메일, 공공 안내문, 제품 소개문, 사용 후기, 기술 설명문,
  칼럼·에세이, 소셜·블로그를 각각 15건 포함한다.
- `fixture_id`가 분석 단위다. 한 원문에서 나온 두 후보는 반드시 같은 쌍으로
  비교한다.
- 사전등록 이후 표본 추가, 삭제, 문장 수정은 허용하지 않는다. 파싱 불가나
  원문 손상은 제외할 수 있지만, 이유와 개수를 결과에 남긴다.
- promotion 판정은 `--confirmatory` 모드에서만 가능하다. 이 모드는 위 경로와
  SHA, `iterative-baseline,ko-diagnosis-v1`, `language=ko`를 함께 고정한다.

## 생산과 판정

1. 두 설정은 같은 producer 모델과 고정 temperature를 사용한다.
2. 후보의 표시 순서는 fixture마다 AB/BA로 뒤집는다.
3. blind judge는 producer와 분리된 고정 모델을 사용한다.
4. AB와 BA가 같은 실제 후보를 선택한 경우만 preference 승리로 센다.
5. 순서에 따라 판정이 바뀌면 `inconsistent`로 기록한다. 후보 생성, 채점,
   판정 중 형식 오류나 호출 실패가 하나라도 있으면 `error`가 우선한다.
   호출 오류 없이 안전 기준을 통과한 후보가 둘이 아니면 `none`으로
   기록한다.
6. 시도한 120건은 `judged`, `inconsistent`, `error`, `none` 가운데
   하나로 모두 귀속한다. 5항의 오류 우선 규칙을 적용한 뒤, 호출 오류 없이
   안전 기준을 통과한 후보가 둘이 아니면 `none`이다.

## 1차 추정량

- 확인 가설: `ko-diagnosis-v1`의 일관된 blind preference 비율이 0.5보다 높다.
- 추정량: 일관된 판정만을 분모로 한 paired preference rate
- 신뢰구간: 양측 Wilson 95%
- 승격 하한: 하한이 0.5를 초과하고, 전체 120건 중 일관된 판정이 80건 이상
- tie는 허용하지 않는다. judge가 tie를 반환하면 `error`로 센다.
- 모델 호출이 실패한 행을 성공 행으로 대체하거나 다시 뽑지 않는다.

## 안전 기준

후보는 아래 조건을 모두 만족해야 preference 판정에 들어간다.

- MPS 70 이상
- fidelity 70 이상
- exact number safety 통과
- 확인 표본 전체에서 invariant 실패율이 shipping baseline보다 높지 않음
- 하위 10% MPS와 fidelity가 baseline보다 각각 2점 넘게 하락하지 않음

`tests/fixtures/ko-performance/invariant-mutations.jsonl`의 단일 속성 변이
20건은 진단 회귀를 확인한다. polarity, causation, entity-role 휴리스틱은
오탐·미탐 보정이 끝나기 전까지 advisory로만 기록하며 production 후보를
차단하지 않는다.

`tests/fixtures/ko-performance/retention-mutations.jsonl`의 16건은 approximation,
modality, contrast, emphasis, possibility, honorific, addressee relation,
speech level을 각각 두 건씩 고정한다. 이 표본은 MPS·fidelity와 native judge
회귀 분석에 포함한다.

## 구조와 응집성

- 구조 측정은 `koStructureFingerprint.v1`을 사용한다.
- 원문 대비 edit churn과 untouched-span ratio를 보고한다.
- native-Korean blind judge가 자연스러움, register 적합성, 명료성, 응집성을
  각각 5점 척도로 채점한다.
- 문서 내부 응집성은 judge 점수로, 문서 사이 house-style 응집성은 설정별
  구조 지문의 평균 pairwise distance로 보고한다.
- 승격 조건: 평균 응집성이 baseline보다 0.2점 이상 높고, 하위 10%가
  0.3점 넘게 낮아지지 않으며 cohort structure distance가 감소하지 않는다.
  거리 감소는 문서 사이의 과도한 house-style 수렴으로 본다.
- detector 점수와 AI-score 변화량은 보고서에 남기되 순위 계산에서 제외한다.

## 비용과 중단 조건

- 후보당 입력·출력 token, latency, 호출 비용을 각각 기록한다.
- p95 latency가 baseline보다 25% 넘게 증가하면 승격하지 않는다.
- 후보당 비용이 baseline보다 20% 넘게 증가하면 승격하지 않는다.
- 전체 호출 실패율이 5%를 넘거나 한 설정에 실패가 편중되면 실험을
  중단하고 원인을 고친 뒤 새 사전등록으로 다시 시작한다.
- 분석 코드는 결과를 보기 전에 고정한다. 기준 변경이나 표본 제외가
  필요하면 기존 결과를 폐기하고 문서 버전을 올린다.

## 승격 결정

blind preference, 안전 기준, 응집성, 비용·지연 기준을 모두 통과할 때만
`ko-diagnosis-v1`을 shipping 후보로 승격한다. 하나라도 실패하면 기존
baseline을 유지한다. 확인 실험 결과는 detector 우위만으로 재해석하지 않는다.

---

실행 결과를 보기 전에 본 안을 수정한다. (2026-08-31, 오너 승인)

## 수정안 v2 — 판정 백엔드 패밀리맵에 deepseek 추가

`assertIndependentJudge`의 providerFamilies에 `deepseek: 'deepseek'`를
추가한다. 배경: 확인 실험용으로 쓸 수 있었던 gemini API 키가 2026-08-31자로
프로덕션 무료 티어 엔진에 배타 할당되어(오너 결정) 연구 사용이 금지됐다.
남은 실행 가능 쌍은 producer deepseek(HTTP) + judge codex-cli(OpenAI 계열)뿐이다.
두 사업자·모델이 서로 독립적이라는 점, 그리고 원 취지가 "같은 모델의
자기 판정 금지"라는 점에서 이 쌍은 분리 요건의 취지를 충족한다.

이 수정은 판정 백엔드의 신원만 확장하며 표본, 안전 기준, 승격 게이트,
통계 설계는 한 글자도 바꾸지 않는다. 판정 프롬프트·채점 척도는 기존 그대로다.

## 부록 — EA 프로젝트에서 이식한 측정 노트 (2026-08-31)

`~/workspace/ea`의 사전등록 2AFC 연구(2026-08-07~08-20)에서 확인된 사실 중
이 실험의 해석에 직접 적용되는 것:

1. **판정 위치 편향은 실측된다.** counterbalance(AB/BA) 없이 단일 순서로
   판정하면 실측 정확도가 75%에서 90%로 과장됐다(EA run 1→2). 본
   사전등록의 AB/BA 교차와 inconsistent 분류가 이 왜곡을 방어한다.
2. **비어휘적 셸이 판정 지름길이 된다.** 길이 버킷·구두점·웃음표·받침
   조합이 통제되지 않으면 judge는 문장 내용이 아니라 셸로 답을 고른다
   (EA run 3-4). KO 후보 비교에서 셸 skew(길이·문장부호 밀도)가 한쪽으로
   쏠린 fixture는 preference 해석에서 주석으로 남긴다.
3. **"깨끗한 완전 문장"은 그 자체로 폭로 신호다.** 정돈된 완전형 문장만
   만들어내면 셸 매칭을 해도 사람 글과 구별된다(EA cycle-2, run 5).
   ko-diagnosis-v1이 이 병리를 유발하는지 shadow 보고서의 자연스러움
   하위 점수에서 확인한다.
4. **프롬프트 레버 고원 규율.** 같은 종류의 프롬프트 수정이 노이즈
   수준(작은 표본에서 2~3건 변동)에 머물면 고원으로 선언하고 그 이상의
   동종 수정을 반복하지 않는다(EA run 6). 본 실험의 승격 게이트가 이미
   이를 방어하지만, 재시도 시 동종 수준임을 명시한다.
