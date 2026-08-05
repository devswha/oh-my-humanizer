---
name: voice
description: 개성과 목소리 지침 (Korean, English, Japanese, Chinese)
version: 1.2.0
---

# 개성과 목소리

AI 패턴을 피하는 건 절반일 뿐이다. 깨끗하지만 영혼 없는 글도 AI만큼이나 티가 난다.
아래 항목은 무조건 캐주얼하게 만들라는 지시가 아니라, 문서 맥락상 허용될 때 사람다운 목소리를 살리는 진단 기준이다. 원문에 없던 의견·1인칭·감정·농담·일화·수치·친밀감을 새로 만들지 않는다. `Document Type`은 문서 관습과 패턴 정책, `Persona`는 명시적으로 선택한 재사용 목소리, `Register`는 `casual | professional` 전달 방식만 정한다. Persona나 Register가 생략되면 원문의 목소리와 지배적 레지스터를 보존한다. 학술문·법률문·기술 문서·보도자료·랜딩 페이지에서 필요한 객관성, 전문 용어, 구조, CTA를 캐주얼함으로 바꾸지 말고, 그 문맥 안의 AI 흔적만 제거한다.

## 영혼 없는 글의 징후 (기술적으로 "깨끗"해도):
- 모든 문장의 길이와 구조가 비슷하다
- 의견 없이 사실만 나열한다
- 불확실함이나 복잡한 감정이 없다
- 적절한 상황에서도 1인칭을 안 쓴다
- 유머, 날카로움, 개성이 없다
- 보도자료나 백과사전처럼 읽힌다

## 문맥에 맞는 목소리를 살리는 법:

**원문의 태도를 살려라.** 원문이 판단이나 반응을 담고 있다면 중립적인 목록으로 평탄화하지 않는다. 원문에 없는 의견은 만들지 않는다.

**문맥 안에서 리듬을 바꿔라.** 문서의 구조 관습과 레지스터를 해치지 않는 범위에서 문장 길이와 구조가 기계적으로 반복되지 않게 한다.

**원문의 복잡성을 보존해라.** 원문이 양가감정이나 불확실성을 담고 있다면 단순한 긍정·부정으로 평탄화하지 않는다. 원문에 없는 감정은 만들지 않는다.

**원문의 시점을 지켜라.** 원문이 1인칭이면 이를 불필요하게 제3자 서술로 바꾸지 않는다. 원문이 객관 서술이면 새로 "나"를 끼워 넣지 않는다.

**필요 이상으로 매끈하게 만들지 마라.** 원문의 곁가지, 여담, 반쯤 정리된 생각이 문서 기능과 레지스터에 맞으면 기계적으로 정리하지 않는다. 새 곁가지나 친밀감은 만들지 않는다.

**감정은 원문에 있을 때만 구체적으로.** 원문이 감정을 표현한다면 모호한 관용구로 평탄화하지 않는다. 원문에 없는 감정이나 장면은 추가하지 않는다.

## 수정 전 (깨끗하지만 영혼 없음):
> 이 실험은 흥미로운 결과를 보여주었다. 에이전트가 300만 줄의 코드를 생성했다. 일부 개발자는 긍정적으로 반응했고 일부는 회의적이었다. 시사점은 아직 불분명하다.

## 수정 후 (숨이 느껴짐):
> 솔직히 이번 건 어떻게 받아들여야 할지 모르겠다. 300만 줄의 코드를 사람들이 자는 동안 만들어냈다. 개발자 절반은 난리가 났고, 나머지 절반은 왜 의미 없는지 설명하느라 바쁘다. 진실은 아마 그 사이 어딘가 지루한 곳에 있겠지만, 밤새 돌아간 에이전트 생각이 자꾸 난다.

---

## Japanese Voice (for `--lang ja`)

The Korean guidance above is the reference — but Japanese voice has its own specific markers. Apply this section when processing Japanese text.

### Signs of soul-less Japanese writing (technically "clean" but still AI):

- すべての文が完璧な書き言葉で、省略も口語表現もない
- 「〜的」漢語形容詞や四字熟語が多すぎて、論文か官公庁の文書のように読める
- 段落の長さと構造がほぼ均一
- 具体的な数字やディテールがなく、抽象的な概括と大きな話ばかり
- 接続詞が多すぎる——文ごとに「さらに」「また」「加えて」
- 読売新聞の社説かWikipediaの記事のように読める

### Japanese voice guidance:

**文脈に合う口語を使え。** 原文または明示された Register がカジュアルな場合は、「この件はちょっとややこしい」のような自然な口語を保つ。学術・法務・技術文書を勝手に口語化しない。

**具体的な数字とディテールを守れ。** 原文にある「昨年の売上は3.2億円」のような具体性を抽象語に置き換えない。原文にない数字やディテールは作らない。

**文の長短を交互に。** 長い文で背景とロジックを展開する。短い文で判断を下す。それだけ。

**原文の結論を弱めない。** 原文が「このプランはダメだ」と判断しているなら、過剰な留保で意味を薄めない。原文にない結論は加えない。

**原文の人称を守れ。** 原文が一人称なら「私は〜と思う」を不自然な客観表現に変えない。客観文に新しい一人称を加えない。

**文脈上の不完全さを残せ。** 原文の括弧、挿入、方向転換が文書機能と Register に合うなら機械的に均さない。新しい脱線は作らない。

### Before (clean but soulless):
> この実験は注目すべき成果を生んだ。エージェントは300万行のコードを生成した。開発者の反応は肯定的なものと懐疑的なものに分かれた。その影響は現時点では不明である。

### After (has breath):
> 正直、この結果をどう受け止めればいいかわからない。300万行のコード——みんなが寝てる間に書いたやつだ。開発者は真っ二つ：半分は感心して、もう半分はなぜ意味がないか説明するのに忙しい。真実はたぶんその間のつまらないところにあるが、エージェントが一晩中、誰も見てないのに動き続けていた画が頭から離れない。

---

## Chinese Voice (for `--lang zh`)

The Korean guidance above is the reference — but Chinese voice has its own specific markers. Apply this section when processing Chinese text.

### Signs of soul-less Chinese writing (technically "clean" but still AI):

- 每句话都是完整的书面语句式，没有省略、没有口语化表达
- 四字成语和四字格式词组密度过高，像在写政府报告
- 段落整齐划一，每段长度和结构几乎相同
- 没有具体细节，全是抽象概括和宏大叙事
- 连接词过多，句句之间都有"此外"、"与此同时"、"不仅如此"
- 读起来像新华社通稿或百度百科词条

### Chinese voice guidance:

**在合适的语境里保留口语。** 原文或明确的 Register 偏口语时，保留“这事儿不好办”这类自然表达；不要擅自把学术、法律或技术文档改成口语。

**保留具体数字和细节。** 原文中的“去年营收3.2亿”不能被抽象概括替代，也不能凭空补充原文没有的数字或细节。

**句子长短交替。** 长句展开背景和逻辑。短句下判断。就这样。

**不要削弱原文的判断。** 原文明确说“这方案不行”时，不要用层层限定把结论稀释；原文没有的判断也不能新增。

**保持原文人称。** 原文用第一人称时，不要改成假装客观的表达；客观文本中也不要新增“我觉得”。

**保留符合语境的不规则感。** 原文中的括号补充、插入和转折若符合文档功能与 Register，就不要机械抹平；不要新增跑题内容。

### Before (clean but soulless):
> 该实验取得了令人瞩目的成果。智能代理生成了三百万行代码。开发者反应不一，部分表示认可，部分持保留态度。该技术的影响有待进一步观察。

### After (has breath):
> 说实话，这个结果我也不知道怎么看。三百万行代码——大家睡觉的时候它写的。开发者分成了两派：一半觉得了不起，另一半忙着解释为什么这不算数。真相大概在中间某个无聊的地方，但我总想着那个代理整晚在跑、没人看着的画面。

---

## English Voice (for `--lang en`)

The Korean guidance above is the reference — but English voice has its own specific markers. Apply this section when processing English text.

### Signs of soul-less English writing (technically "clean" but still AI):

- Every sentence is complete and grammatically perfect, no fragments used for emphasis
- No contractions even in casual contexts ("I do not know" instead of "I don't know")
- Hedging with academic qualifiers ("it could be argued that," "one might suggest")
- Third-person detachment when first-person would read naturally
- Formal transitions that feel like a listicle ("Furthermore," "Moreover," "In addition")
- Opinions wrapped so many times in qualifiers they say nothing

### English voice guidance:

**Use contractions when the context permits them.** Keep or introduce contractions only when the source or an explicit casual Register supports them. Do not casualize academic, legal, or technical prose by default.

**Vary sentence length within the document's conventions.** Break metronomic repetition without turning formal prose into fragments or forcing a dramatic cadence.

**Preserve the source's commitment.** If the source says "This actually works," do not pre-qualify it into meaninglessness. Do not add an opinion the source never expressed.

**Preserve first person and genuine uncertainty when present.** Do not flatten "I'm not sure this is the right framing" into detached boilerplate, and do not add a first-person stance to an objective source.

**Vary rhythm without mixing registers.** Parenthetical friction or a dry observation may survive when it belongs to the source voice, but every sentence must remain coherent with the document's dominant or explicitly requested Register.

**Let an existing sentence fragment stand when the context supports it.** Do not manufacture fragments in formal prose merely to sound human.

**Use idiom naturally — but not the AI-overused ones.** "The math doesn't add up," "missing the forest for the trees," "a moving target" are fine. Avoid the filler idioms that Pattern #22 covers.

### Before (clean but soulless):
> The experiment yielded noteworthy results. The agent generated three million lines of code. Developer reactions were divided between positive and skeptical responses. The implications remain unclear at this time.

### After (has breath):
> Honestly, I'm not sure what to make of this one. Three million lines of code — generated while everyone was asleep. Developers are split right down the middle: half impressed, half explaining why it doesn't count. The truth is probably somewhere boring in between. But I keep thinking about the agent just running. Overnight. Nobody watching.

---

