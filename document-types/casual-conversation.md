---
document-type: casual-conversation
name: 대화/메시지
version: 3.0.0
scope: 메신저 대화, 댓글, 채팅형 답변, 짧은 SNS 상호작용
purpose: "Preserve the intent of a short message, reply, comment, or conversational turn."
audience:
  - "The named or implied participants in the source conversation"
structure:
  - "Keep turns and paragraphs short enough for the channel"
  - "Preserve questions, replies, references, and turn-taking context"
style:
  - "Use interaction-shaped wording rather than article or report scaffolding"
  - "Keep the source’s degree of directness"
avoid:
  - "Adding familiarity, honorific distance, first-person identity, jokes, or emotion absent from the source"
  - "Using this Document Type to choose casual/professional delivery; Register owns that choice"
pattern-overrides:
  ko:
    8: amplify                  # ~적 접미사 — 짧은 대화에서는 특히 부자연스러움
    18: amplify                 # 한자어/공식어 — 한자어 대신 순한 단어 우선
    14: suppress                # 볼드체 — SNS/댓글에서는 사용 안 함
    19: reduce                  # 챗봇 표현 — 실제 응대 문맥의 공손 표현은 일부 허용
  en:
    8: amplify                  # Copula avoidance
    7: amplify                  # AI vocabulary
    14: suppress                # Boldface
  zh:
    7: amplify                  # AI高频词 — 亲密对话里“赋能/生态”特别不像人话
    18: amplify                 # 书面/公文体 — 朋友语气中应换成口语
    14: suppress                # 加粗 — 聊天/SNS语气中不作为AI痕迹处理
    19: reduce                  # 聊天机器人痕迹 — 亲切服务语可少量保留
  ja:
    7: amplify                  # AI語彙 — 親しい会話では特に不自然
    18: amplify                 # 硬質文体 — 友人向けなら口語へ寄せる
    16: amplify                 # 過剰敬語 — 親密な会話では距離が出るため強めに直す
    14: suppress                # 太字 — 会話調ではAI判定の主因にしない
    19: reduce                  # チャットボット痕跡 — 親切な一言は一部許容
---

# 대화/메시지 (`casual-conversation`)

`casual-conversation`은 기존 CLI 식별자를 유지하지만, 이 정책이 정하는 것은
**대화형 문서의 관습**이다. casual/professional 전달 방식은 `--register`가
정한다. 이 Document Type만으로 반말, 존댓말, 친밀감, 1인칭 성격을 만들지 않는다.

## 적용 예시

### Input
> 배포를 진행하기에 앞서 환경 변수 설정이 올바른지 확인하는 것이 필요합니다. 설정이 누락된 경우 인증 오류가 발생할 수 있습니다.

### Document Type만 적용
> 배포 전에 환경 변수가 올바른지 확인해야 합니다. 누락되면 인증 오류가 날 수 있습니다.

원문의 professional 전달 방식은 그대로 두고, 메시지에 맞게 앞부분과 문장 길이만
정리한다.

### `--register casual`도 명시
> 배포 전에 환경 변수부터 확인해. 빠지면 인증 오류가 날 수 있어.

두 번째 변화는 Document Type이 아니라 Register가 소유한다. 어떤 경우에도 새 화자,
농담, 감정, 친밀한 관계를 덧붙이지 않는다.

## `blog`와의 차이

| 관습 | `blog` | `casual-conversation` |
|---|---|---|
| 기본 단위 | 완결된 글/포스트 | 한 메시지·댓글·응답 턴 |
| 구조 | 도입·본문 섹션·마무리 가능 | 짧은 턴, 질문·답변 맥락 우선 |
| 참조 | 글 내부 문맥 | 앞선 메시지·상대 발화 참조 |
| Register | 별도 축 | 별도 축 |
| Persona | 별도 축 | 별도 축 |

## 사용

```bash
patina --document-type casual-conversation --lang ko input.txt
patina --document-type casual-conversation --register casual --lang ko input.txt
```

또는 `.patina.yaml`에:

```yaml
document-type: casual-conversation
register: professional
```

## 한계

- 원문에 없는 답변 맥락이나 상대 의도를 추측하지 않는다.
- 기술·법률·의학 문서의 전문 용어와 의미 하한은 메시지 길이에 맞추려고 낮추지 않는다.
- 번역 결과의 사실·주장 오류는 이 Document Type이 교정하지 않는다.
