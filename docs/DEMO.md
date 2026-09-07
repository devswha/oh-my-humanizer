# Examples in four languages

These are prepared editorial examples, not transcripts or promises of a particular model output. The same source pairs appear in the playground. Numbers and names stay with their original claims; model-based checks and editorial review do not guarantee that every future rewrite will pass.

Run a rewrite on your own text to inspect its actual approval status and meaning scores. For CLI verification, use `patina --verify --lang <ko|en|zh|ja> input.txt`; the source checkout is required for changes awaiting npm publication.

## 한국어

딱딱한 초안을 읽기 편하게 다듬습니다. 아래는 원문의 사실과 수치를 유지한 설명용 예시이며 실시간 실행 결과가 아닙니다.

### 이메일 · 회의 일정 변경

Example: `ko-email-meeting`

**다듬기 전**

> 안녕하세요, 김민서 매니저님. 회의 일정과 관련하여 안내드리고자 합니다. 9월 10일 오전 10시로 예정되어 있던 회의를 회의실 공사 때문에 9월 11일 같은 시간으로 변경하게 되었습니다.
>
> 회의 안건과 참석자에는 변동사항이 없습니다. 변경된 일정에 참석이 어려우신 경우, 9월 9일 오후 5시까지 회신해 주시면 감사하겠습니다.

**다듬은 예시**

> 안녕하세요, 김민서 매니저님. 회의실 공사로 9월 10일 오전 10시 회의를 9월 11일 같은 시간으로 옮겼습니다.
>
> 안건과 참석자는 그대로입니다. 바뀐 일정에 참석하기 어려우시면 9월 9일 오후 5시까지 답장 부탁드립니다.

일정·사유·회신 조건을 그대로 두고 안내 문구를 줄인 가상 예시입니다. 실제 실행 결과는 아닙니다.

### 보고서 · 고객 문의 처리

Example: `ko-report-support`

**다듬기 전**

> 이번 주 고객 문의 처리 현황에 대해 종합적으로 정리하면 다음과 같습니다. 접수된 문의는 총 48건이며, 이 가운데 42건에 대한 처리가 완료되었습니다. 나머지 6건은 개발팀의 확인을 기다리고 있는 상황입니다.
>
> 이와 관련하여, 미처리된 문의 6건 중 2건이 로그인 오류에 관한 문의라는 점은 주목할 만합니다. 다음 주 화요일까지 답변하는 것을 목표로 하고 있으나, 오류 재현이 지연될 경우 답변 일정이 늦어질 수 있습니다.

**다듬은 예시**

> 이번 주 접수한 고객 문의 48건 중 42건을 처리했습니다. 남은 6건은 개발팀 확인을 기다리고 있습니다.
>
> 미처리 문의 6건 중 2건은 로그인 오류에 관한 내용입니다. 다음 주 화요일까지 답변하는 것이 목표지만, 오류 재현이 늦어지면 답변 일정도 늦어질 수 있습니다.

문의 건수와 대기 상태, 답변 목표와 지연 가능성을 보존한 가상 예시입니다. 실제 처리 실적은 아닙니다.

### 제품 소개 · 회의록 템플릿

Example: `ko-product-notes`

**다듬기 전**

> 새롭게 출시된 회의록 템플릿 모음은 체계적인 기록 작성을 지원하기 위한 도구입니다. 주간 회의, 고객 미팅, 회고에 사용할 수 있는 템플릿 12개를 제공하며, 각 템플릿에는 결정 사항과 담당자를 적는 칸이 마련되어 있습니다.
>
> 이 모음은 개인 용도와 팀 업무 모두에 활용할 수 있습니다. 또한 문서 파일을 내려받은 뒤에는 인터넷 연결 없이도 편집이 가능합니다. 다만 일정 알림 기능은 포함되어 있지 않다는 점을 참고해 주시기 바랍니다.

**다듬은 예시**

> 새로 출시한 회의록 템플릿 모음은 기록을 체계적으로 남기는 데 쓰는 도구입니다. 주간 회의·고객 미팅·회고용 템플릿 12개에 결정 사항과 담당자를 적는 칸을 넣었습니다.
>
> 개인 용도와 팀 업무에 모두 쓸 수 있습니다. 문서 파일을 내려받으면 인터넷 없이 편집할 수 있고, 일정 알림 기능은 없습니다.

템플릿 수·용도·오프라인 편집 조건과 없는 기능까지 유지한 가상 예시입니다. 실제 제품의 기능표는 아닙니다.

[내 글로 확인하기](https://patina.vibetip.help/?lang=ko&utm_source=github&utm_campaign=multilingual-20260907) · [Share card](../assets/social/patina-before-after-ko.svg)

## English

Turn a stiff draft into clearer writing. This illustrative pair keeps the source facts and numbers; it is not a live model result.

### Email: review deadline

Example: `en-email-review`

**Before**

> Hi Maya,
>
> I'm writing to let you know that the launch review is scheduled for Friday at 2 p.m. The draft is 6 pages long, and two questions about pricing are still open. It would be greatly appreciated if you could add your comments by Thursday at noon. If that timing doesn't work, please reply with a time that does.
>
> Thanks,
> Alex

**Prepared example**

> Hi Maya,
>
> The launch review is Friday at 2 p.m. The draft has 6 pages and two open pricing questions. Please add your comments by Thursday at noon, or reply with a time that works if you can't meet that deadline.
>
> Thanks,
> Alex

Illustrative email edit. The review time, draft length, open questions and reply request stay the same.

### Report: support results

Example: `en-report-support`

**Before**

> It is important to note that the support team handled 240 tickets in July. In terms of response times, the median first reply fell from 6 hours to 4 hours. This change coincided with a new triage rota, though we cannot yet say that the rota caused the improvement. At the end of the day, 18 tickets remained open at month-end, and the team will review those tickets next Monday.

**Prepared example**

> The support team handled 240 tickets in July. The median first reply fell from 6 hours to 4 hours alongside the introduction of a new triage rota, but we cannot yet say the rota caused the improvement. At month-end, 18 tickets were still open. The team will review them next Monday.

Illustrative report edit. Ticket counts and reply times stay intact, along with the uncertainty about cause.

### Product: notes update

Example: `en-product-notes`

**Before**

> We are pleased to announce that Maple Notes now includes 12 meeting templates. In order to use a template, choose it from the New note menu. It is worth mentioning that existing notes will not change. The templates work offline, but shared editing still requires an internet connection. Looking ahead, we plan to add Spanish templates in October; that date may change.

**Prepared example**

> Maple Notes now includes 12 meeting templates, which you can choose from the New note menu. Existing notes will not change.
>
> The templates work offline; shared editing still requires an internet connection. We plan to add Spanish templates in October, though that date may change.

Illustrative product update. The count, menu name, offline limits and tentative October plan are preserved.

[Try your own draft](https://patina.vibetip.help/?lang=en&utm_source=github&utm_campaign=multilingual-20260907) · [Share card](../assets/social/patina-before-after-en.svg)

## 中文

把生硬的草稿改得清楚好读。下面的说明性示例保留原文事实和数字，并非实时生成结果。

### 邮件：确认包装样稿

Example: `zh-email-sample-confirmation`

**改写前**

> 林女士，您好：
>
> 关于上周讨论的包装方案，现将相关情况说明如下。样稿已随邮件附上，共2版。请您在9月10日17:00前回复选定版本。如需修改，请直接在文件中批注。
>
> 需要说明的是，样品预计在收到确认后3个工作日内寄出。若确认时间推迟，寄出日期也将相应顺延。感谢您的配合。

**改写示例**

> 林女士，您好：
>
> 上周讨论的包装方案已附上2版样稿。请您在9月10日17:00前回复选定版本；如需修改，请直接在文件中批注。
>
> 样品预计在收到确认后3个工作日内寄出。确认若有推迟，寄出日期也会顺延。感谢您的配合。

删去公文式铺垫，保留林女士、2版样稿、回复截止时间，以及预计寄出和顺延条件。虚构示例，非实测输出。

### 报告：搜索问题周报

Example: `zh-report-search-feedback`

**改写前**

> 本周，青禾项目组共收到48条反馈，其中31条涉及搜索功能。与上周相比，搜索相关反馈增加了7条。
>
> 与此同时，团队已修复2个搜索错误，另有1个问题仍在排查。目前还不能确定它是否与缓存有关。
>
> 综上所述，我们计划在周五前完成排查。如果届时仍无法复现，将先继续收集日志，不承诺当周修复。

**改写示例**

> 青禾项目组本周收到48条反馈，其中31条涉及搜索功能，比上周多7条。
>
> 团队已修复2个搜索错误，还有1个问题在排查，目前不能确定是否与缓存有关。
>
> 我们计划在周五前完成排查。如果届时仍无法复现，将先继续收集日志，不承诺当周修复。

合并重复表述，保留反馈数量、修复进展、缓存原因尚未确定，以及无法复现时的处理条件。虚构示例，非实测输出。

### 产品说明：离线编辑

Example: `zh-product-offline-notes`

**改写前**

> 值得一提的是，纸舟笔记的新版本新增了离线编辑功能，支持在没有网络时修改已经下载的笔记。与此同时，恢复联网后，修改会自动同步。
>
> 需要强调的是，离线模式目前不支持图片上传。这一限制也意味着，图片仍需在联网时添加。
>
> 关于使用条件，有必要指出的是，离线编辑适用于免费版和团队版，不需要额外付费。

**改写示例**

> 纸舟笔记的新版本加入了离线编辑功能：没有网络时，也能修改已下载的笔记，恢复联网后会自动同步。
>
> 离线模式目前不支持图片上传，图片仍需联网添加。
>
> 免费版和团队版都可使用离线编辑，无需额外付费。

直接说明功能，保留已下载笔记的范围、自动同步、图片上传限制和版本费用条件。纸舟笔记为虚构产品，非实测输出。

[用自己的草稿试试](https://patina.vibetip.help/?lang=zh&utm_source=github&utm_campaign=multilingual-20260907) · [Share card](../assets/social/patina-before-after-zh.svg)

## 日本語

堅い下書きを読みやすい文章に整えます。以下は原文の事実や数字を保った説明用の例で、実行結果ではありません。

### メール：見積書の確認依頼

Example: `ja-email-review`

**整える前**

> 資料確認についてご連絡させていただきます。添付の見積書は2ページでございます。可能であれば、9月10日17時までにご確認いただけますと幸いです。修正が必要な場合は、このメールへの返信でお知らせいただければと存じます。

**整えた例**

> 資料確認のお願いです。添付の見積書は2ページです。可能であれば、9月10日17時までにご確認ください。修正が必要な場合は、このメールに返信してお知らせください。

説明用の作例です。2ページ、確認期限、「可能であれば」という条件、修正時の返信先を保ち、敬語を短くしました。

### 報告：画面移行の進捗

Example: `ja-report-migration`

**整える前**

> 今週の進捗について、以下の通りご報告させていただきます。移行対象の12画面のうち、8画面の確認が完了している状況です。残り4画面につきましては、9月12日までに確認を終える予定となっております。ただし、不具合が見つかった場合は、公開を延期する可能性がございます。

**整えた例**

> 今週の移行状況を報告します。対象は12画面で、そのうち8画面は確認済みです。残る4画面は9月12日までに確認を終える予定ですが、不具合が見つかれば公開を延期する可能性があります。

説明用の作例です。確認済みと未確認の画面数、期限、完了の予定、延期の可能性を残して報告を簡潔にしました。

### 製品案内：ノートの固定

Example: `ja-product-notes`

**整える前**

> メモアプリ「こよみ」の新機能についてご紹介させていただきます。今回の更新では、ノートを3件まで固定することが可能となりました。これにより、固定したノートは一覧の先頭に表示されるようになっております。なお、共有機能につきましては、現時点では対応しておりません。

**整えた例**

> メモアプリ「こよみ」の今回の更新で、ノートを3件まで固定できるようになりました。固定したノートは一覧の先頭へ。共有機能にはまだ対応していません。

説明用に作成した架空の製品案内です。製品名、3件までという上限、表示位置、共有機能は未対応という条件を残しました。

[自分の下書きで試す](https://patina.vibetip.help/?lang=ja&utm_source=github&utm_campaign=multilingual-20260907) · [Share card](../assets/social/patina-before-after-ja.svg)

## Recorded demonstrations

Older GIFs remain available in [the recording archive](../assets/demo/README.md). Their pixels and score labels describe those captures only; they do not verify the examples above.

To refresh these pages and SVG cards after editing the shared examples, run `node scripts/public-showcase.mjs --write`. Use `--check` to detect stale artifacts without rewriting them.
