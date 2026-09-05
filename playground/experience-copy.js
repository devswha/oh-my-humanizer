// @ts-check
// Copy shared by the controller and executable UI recovery tests.
export const EXPERIENCE_COPY = {
  en: {
    license: 'License key', placeholder: 'License key (kept in memory)', signIn: 'Apply key', signOut: 'Clear key and chats',
    missing: 'Enter and apply your Pro license key first.',
    licenseStates: { empty: 'Use the license key from your purchase email. It stays in memory for this session.', pending: 'Key applied locally. Your first rewrite request will validate it.', checking: 'Checking the key with your rewrite request…', validated: 'Key accepted for this request. Each request checks Pro access.', unconfirmed: 'Key validation was not confirmed. Check the request error before trying again.', rejected: 'Key not accepted. Check your purchase email and subscription, then apply the correct key.' },
    already: 'Already purchased? Apply your license key', docs: 'Hosted API docs and limits', portal: 'Manage subscription in Polar',
    authRequired: 'This request needs valid credentials (401). Apply your license key again in Pro mode, or check your provider key in BYOK mode.',
    authDenied: 'Access was denied (403). Check the key and your subscription or provider access. This response does not identify the exact cause.',
    monthlyRequests: 'The monthly rewrite allowance has been reached. Check the plan limits before making another request.',
    monthlyChars: 'This request exceeds the remaining monthly character allowance. Check the plan limits or use a shorter source in a new chat.',
    monthlyProcessing: 'The monthly processing-attempt allowance has been reached, including failed attempts. Repeating this request will not restore access.',
    quotaUnknown: 'A usage limit was reached. Check your tier limits before trying again.',
    quotaDaily: 'The daily request allowance has been reached. Check your tier limits, or switch to another mode with available quota.',
    quotaHourly: 'The hourly request allowance has been reached. Wait before trying again, or switch to another mode with available quota.',
    recover: 'Review key and resubmit', revise: 'Edit request or change mode',
    pricingTitle: 'Simple pricing', pricingLede: 'Free, BYOK, and Pro use the same rewrite pipeline and quality gates. Paid access adds programmatic access and higher limits.',
    byokName: 'BYOK', byokCost: 'Your provider key', byokCta: 'Use BYOK mode',
    byokFeatures: ['Bring your own provider key', 'Up to 20,000 characters', '120 requests/hour · 480/day', 'Provider usage is billed by your provider'],
    proName: 'Pro · Hosted API', proBadge: 'Hosted API access',
    proFeatures: ['Programmatic access · same quality gates', '100 rewrites / month', 'Up to 20,000 characters each', '50,000 characters / month total'],
    pricingNote: 'Your Polar license key also works as the Hosted API key. Apply it in Pro mode; the first rewrite validates it. It is never saved. Monthly request and character allowances are separate; either can limit usage. Deployment limits may vary.',
    labels: ['Language', 'Document type', 'Persona', 'Register', 'Mode'], preserve: 'Preserve source', casual: 'Casual', professional: 'Professional',
    documents: ['Preserve source', 'Blog', 'Academic', 'Technical', 'Formal', 'Social', 'Email', 'Legal', 'Medical', 'Marketing', 'Narrative', 'Instructional', 'Casual conversation', 'Code comment', 'Commit message', 'Release notes', 'Namuwiki'],
    voices: ['Natural', 'Blog / essay', 'Technical explainer', 'Soft professional', 'Pragmatic founder'],
    presets: 'Local presets', presetSelect: 'Saved preset', presetNone: 'Select a preset', presetName: 'Preset name', presetApply: 'Apply preset', presetSave: 'Save / replace', presetDelete: 'Delete preset',
    presetHint: 'Saved only in this browser: language, document type, persona, and register. Do not put keys or private text in the name. Up to 20 names, 40 characters each.',
    presetSaved: 'Preset saved on this browser.', presetApplied: 'Preset applied to this conversation.', presetDeleted: 'Preset deleted.',
    presetNameError: 'Use a short name (1–40 characters), without credentials.', presetLimit: '20 presets are saved. Delete one before adding another.',
    storageUnavailable: 'Browser storage is unavailable. Presets work for this session only.', storageInvalid: 'Saved presets could not be read. Source-preserving defaults are available.', storageVersion: 'Saved presets use an unsupported version. They were not applied.',
    languageLocked: 'This conversation keeps its original language. Start a new chat to use another language.', send: 'Send',
  },
  ko: {
    license: '라이선스 키', placeholder: '라이선스 키 (메모리에만 보관)', signIn: '키 적용', signOut: '키와 대화 지우기',
    missing: 'Pro 라이선스 키를 입력하고 적용해 주세요.',
    licenseStates: { empty: '구매 이메일의 라이선스 키를 입력하세요. 이번 세션의 메모리에만 보관합니다.', pending: '키를 적용했습니다. 첫 리라이트 요청에서 유효성을 확인합니다.', checking: '리라이트 요청과 함께 키를 확인하고 있습니다…', validated: '이번 요청에서 키가 승인됐습니다. 요청마다 Pro 이용 권한을 확인합니다.', unconfirmed: '키 유효성을 확인하지 못했습니다. 요청 오류를 확인한 뒤 다시 시도해 주세요.', rejected: '키가 승인되지 않았습니다. 구매 이메일과 구독 상태를 확인한 뒤 올바른 키를 적용해 주세요.' },
    already: '이미 구매하셨나요? 라이선스 키 적용', docs: 'Hosted API 문서와 사용 한도', portal: 'Polar에서 구독 관리',
    authRequired: '유효한 인증 정보가 필요합니다(401). Pro 모드에서 라이선스 키를 다시 적용하거나 BYOK 모드의 제공업체 키를 확인해 주세요.',
    authDenied: '접근이 거부됐습니다(403). 키와 구독 또는 제공업체 이용 권한을 확인해 주세요. 이 응답만으로 정확한 원인을 알 수는 없습니다.',
    monthlyRequests: '월간 리라이트 횟수 한도에 도달했습니다. 다음 요청 전에 요금제 한도를 확인해 주세요.',
    monthlyChars: '이번 요청이 남은 월간 글자 수 한도를 초과합니다. 요금제 한도를 확인하거나 새 대화에서 더 짧은 원문을 사용해 주세요.',
    monthlyProcessing: '실패한 시도를 포함한 월간 처리 시도 한도에 도달했습니다. 같은 요청을 반복해도 이용 권한이 복구되지 않습니다.',
    quotaUnknown: '사용 한도에 도달했습니다. 다시 시도하기 전에 선택한 모드의 한도를 확인해 주세요.',
    quotaDaily: '일일 요청 한도에 도달했습니다. 선택한 모드의 한도를 확인하거나 사용량이 남은 다른 모드로 전환해 주세요.',
    quotaHourly: '시간당 요청 한도에 도달했습니다. 시간을 두고 다시 시도하거나 사용량이 남은 다른 모드로 전환해 주세요.',
    recover: '키 확인 후 다시 제출', revise: '요청 수정 또는 모드 변경',
    pricingTitle: '요금 안내', pricingLede: 'Free, BYOK, Pro는 같은 리라이트 과정과 품질 검사를 사용합니다. 유료 이용 시 프로그램 연동과 더 높은 한도를 제공합니다.',
    byokName: 'BYOK', byokCost: '본인 제공업체 키', byokCta: 'BYOK 모드 사용',
    byokFeatures: ['본인 제공업체 API 키 사용', '최대 20,000자', '시간당 120회 · 일일 480회', '제공업체 사용료는 해당 업체에서 청구'],
    proName: 'Pro · Hosted API', proBadge: 'Hosted API 이용',
    proFeatures: ['프로그램 연동 · 동일한 품질 검사', '월간 리라이트 100회', '요청당 최대 20,000자', '월간 총 50,000자'],
    pricingNote: 'Polar 라이선스 키가 Hosted API 키로도 쓰입니다. Pro 모드에서 적용하면 첫 리라이트 요청에서 확인합니다. 키는 저장하지 않습니다. 월간 횟수와 글자 수는 별도 한도이며 어느 쪽이든 사용을 제한할 수 있습니다. 배포 설정에 따라 한도가 달라질 수 있습니다.',
    labels: ['언어', '문서 유형', '페르소나', '격식', '모드'], preserve: '원문 유지', casual: '편한 말투', professional: '업무 말투',
    documents: ['원문 유지', '블로그', '학술', '기술', '공식 문서', '소셜', '이메일', '법률', '의료', '마케팅', '서사', '안내문', '일상 대화', '코드 주석', '커밋 메시지', '릴리스 노트', '나무위키'],
    voices: ['자연스러운 문체', '블로그 / 에세이', '기술 해설', '부드러운 업무 문체', '실용적인 창업자'],
    presets: '로컬 프리셋', presetSelect: '저장한 프리셋', presetNone: '프리셋 선택', presetName: '프리셋 이름', presetApply: '프리셋 적용', presetSave: '저장 / 덮어쓰기', presetDelete: '프리셋 삭제',
    presetHint: '언어·문서 유형·페르소나·격식만 이 브라우저에 저장합니다. 이름에 키나 개인 글을 넣지 마세요. 최대 20개, 이름당 40자입니다.',
    presetSaved: '이 브라우저에 프리셋을 저장했습니다.', presetApplied: '이 대화에 프리셋을 적용했습니다.', presetDeleted: '프리셋을 삭제했습니다.',
    presetNameError: '인증 정보가 없는 짧은 이름(1~40자)을 입력해 주세요.', presetLimit: '프리셋이 20개입니다. 하나를 삭제한 뒤 추가해 주세요.',
    storageUnavailable: '브라우저 저장소를 사용할 수 없습니다. 프리셋은 이번 세션에서만 사용할 수 있습니다.', storageInvalid: '저장한 프리셋을 읽지 못했습니다. 원문을 유지하는 기본 설정을 사용할 수 있습니다.', storageVersion: '지원하지 않는 버전의 프리셋이라 적용하지 않았습니다.',
    languageLocked: '이 대화는 원문의 언어를 유지합니다. 다른 언어를 쓰려면 새 대화를 시작해 주세요.', send: '보내기',
  },
  zh: {
    license: '许可证密钥', placeholder: '许可证密钥（仅保存在内存中）', signIn: '应用密钥', signOut: '清除密钥和对话',
    missing: '请先输入并应用 Pro 许可证密钥。',
    licenseStates: { empty: '使用购买邮件中的许可证密钥。它仅保留在本次会话的内存中。', pending: '密钥已在本地应用。首次改写请求将验证密钥。', checking: '正在随改写请求验证密钥…', validated: '本次请求的密钥已获准。每次请求都会检查 Pro 访问权限。', unconfirmed: '未能确认密钥有效性。请先查看请求错误，再重试。', rejected: '密钥未获准。请检查购买邮件和订阅状态，再应用正确的密钥。' },
    already: '已经购买？应用许可证密钥', docs: 'Hosted API 文档和限额', portal: '在 Polar 管理订阅',
    authRequired: '此请求需要有效凭据（401）。请在 Pro 模式重新应用许可证密钥，或检查 BYOK 模式的提供商密钥。',
    authDenied: '访问被拒绝（403）。请检查密钥及订阅或提供商权限。此响应无法说明确切原因。',
    monthlyRequests: '已达到每月改写次数限额。再次请求前请查看套餐限额。',
    monthlyChars: '此请求超出本月剩余字符额度。请查看套餐限额，或在新对话中使用更短的原文。',
    monthlyProcessing: '已达到每月处理尝试限额，其中包括失败的尝试。重复此请求不会恢复访问权限。',
    quotaUnknown: '已达到使用限额。重试前请查看当前模式的限额。',
    quotaDaily: '已达到每日请求限额。请查看当前模式的限额，或切换到仍有额度的模式。',
    quotaHourly: '已达到每小时请求限额。请等待后再试，或切换到仍有额度的模式。',
    recover: '检查密钥后重新提交', revise: '编辑请求或切换模式',
    pricingTitle: '价格方案', pricingLede: 'Free、BYOK 和 Pro 使用相同的改写流程和质量检查。付费提供程序调用权限和更高限额。',
    byokName: 'BYOK', byokCost: '自己的提供商密钥', byokCta: '使用 BYOK 模式',
    byokFeatures: ['使用自己的提供商 API 密钥', '最多 20,000 字符', '每小时 120 次 · 每日 480 次', '提供商使用费由提供商收取'],
    proName: 'Pro · Hosted API', proBadge: 'Hosted API 访问',
    proFeatures: ['程序调用 · 相同的质量检查', '每月 100 次改写', '每次最多 20,000 字符', '每月总计 50,000 字符'],
    pricingNote: 'Polar 许可证密钥同时也是 Hosted API 密钥。在 Pro 模式应用后，首次改写请求将验证它。密钥不会保存。每月请求次数和字符额度分别计算，任一额度均可限制使用。部署设置可能调整限额。',
    labels: ['语言', '文档类型', '写作风格', '语体', '模式'], preserve: '保留原文', casual: '日常', professional: '专业',
    documents: ['保留原文', '博客', '学术', '技术', '正式文档', '社交', '电子邮件', '法律', '医疗', '营销', '叙事', '说明', '日常对话', '代码注释', '提交消息', '发行说明', 'Namuwiki'],
    voices: ['自然', '博客 / 随笔', '技术讲解', '温和专业', '务实创业者'],
    presets: '本地预设', presetSelect: '已保存的预设', presetNone: '选择预设', presetName: '预设名称', presetApply: '应用预设', presetSave: '保存 / 替换', presetDelete: '删除预设',
    presetHint: '仅在此浏览器保存语言、文档类型、写作风格和语体。请勿在名称中输入密钥或私人文本。最多 20 个名称，每个 40 字符。',
    presetSaved: '预设已保存在此浏览器。', presetApplied: '预设已应用于此对话。', presetDeleted: '预设已删除。',
    presetNameError: '请输入不含凭据的简短名称（1–40 字符）。', presetLimit: '已保存 20 个预设。请先删除一个再添加。',
    storageUnavailable: '浏览器存储不可用。预设仅在本次会话有效。', storageInvalid: '无法读取已保存的预设。可使用保留原文的默认设置。', storageVersion: '保存的预设版本不受支持，未应用。',
    languageLocked: '此对话保留原文语言。请新建对话以使用其他语言。', send: '发送',
  },
  ja: {
    license: 'ライセンスキー', placeholder: 'ライセンスキー（メモリ内のみ保持）', signIn: 'キーを適用', signOut: 'キーと会話を消去',
    missing: '先に Pro ライセンスキーを入力して適用してください。',
    licenseStates: { empty: '購入メールのライセンスキーを使用してください。このセッションのメモリにのみ保持します。', pending: 'キーを適用しました。最初の書き換えリクエストで検証します。', checking: '書き換えリクエストとともにキーを確認中です…', validated: '今回のリクエストでキーが承認されました。各リクエストで Pro の利用権限を確認します。', unconfirmed: 'キーの有効性を確認できませんでした。リクエストのエラーを確認してから再試行してください。', rejected: 'キーが承認されませんでした。購入メールと契約状態を確認し、正しいキーを適用してください。' },
    already: '購入済みの方：ライセンスキーを適用', docs: 'Hosted API のドキュメントと上限', portal: 'Polar で契約を管理',
    authRequired: '有効な認証情報が必要です（401）。Pro モードでライセンスキーを再適用するか、BYOK モードのプロバイダーキーを確認してください。',
    authDenied: 'アクセスが拒否されました（403）。キーと契約、またはプロバイダーの利用権限を確認してください。この応答だけでは正確な原因は分かりません。',
    monthlyRequests: '月間書き換え回数の上限に達しました。次のリクエスト前にプランの上限を確認してください。',
    monthlyChars: 'このリクエストは月間の残り文字数を超えています。プランの上限を確認するか、新しい会話で短い原文を使用してください。',
    monthlyProcessing: '失敗した試行を含む月間処理試行数の上限に達しました。同じリクエストを繰り返しても利用権限は回復しません。',
    quotaUnknown: '利用上限に達しました。再試行の前に選択したモードの上限を確認してください。',
    quotaDaily: '1 日のリクエスト上限に達しました。モードの上限を確認するか、利用枠の残っている別のモードに切り替えてください。',
    quotaHourly: '1 時間のリクエスト上限に達しました。時間をおいて再試行するか、利用枠の残っている別のモードに切り替えてください。',
    recover: 'キーを確認して再送信', revise: 'リクエストを編集・モードを変更',
    pricingTitle: '料金プラン', pricingLede: 'Free、BYOK、Pro は同じ書き換え処理と品質チェックを使います。有料ではプログラムからの利用と、より高い上限を提供します。',
    byokName: 'BYOK', byokCost: '自分のプロバイダーキー', byokCta: 'BYOK モードを使う',
    byokFeatures: ['自分のプロバイダー API キーを使用', '最大 20,000 文字', '1 時間 120 回 · 1 日 480 回', 'プロバイダー利用料は提供元が請求'],
    proName: 'Pro · Hosted API', proBadge: 'Hosted API 利用',
    proFeatures: ['プログラム連携 · 同じ品質チェック', '月間 100 回の書き換え', '1 回最大 20,000 文字', '月間合計 50,000 文字'],
    pricingNote: 'Polar ライセンスキーは Hosted API キーとしても使えます。Pro モードで適用すると、最初の書き換えで検証します。キーは保存しません。月間回数と文字数は別々の枠で、どちらも利用を制限します。配備設定によって上限が変わる場合があります。',
    labels: ['言語', '文書の種類', 'ペルソナ', '文体', 'モード'], preserve: '原文を保持', casual: 'カジュアル', professional: '業務向け',
    documents: ['原文を保持', 'ブログ', '学術', '技術', '公式文書', 'ソーシャル', 'メール', '法律', '医療', 'マーケティング', '物語', '説明文', '日常会話', 'コードコメント', 'コミットメッセージ', 'リリースノート', 'Namuwiki'],
    voices: ['自然な文体', 'ブログ / エッセイ', '技術解説', '柔らかな業務文体', '実務的な創業者'],
    presets: 'ローカルプリセット', presetSelect: '保存したプリセット', presetNone: 'プリセットを選択', presetName: 'プリセット名', presetApply: '適用', presetSave: '保存 / 上書き', presetDelete: '削除',
    presetHint: '言語・文書の種類・ペルソナ・文体だけをこのブラウザーに保存します。名前にキーや個人の文章を入れないでください。最大 20 件、名前は各 40 文字です。',
    presetSaved: 'このブラウザーに保存しました。', presetApplied: 'この会話に適用しました。', presetDeleted: 'プリセットを削除しました。',
    presetNameError: '認証情報を含まない短い名前（1～40 文字）を入力してください。', presetLimit: '20 件保存済みです。追加する前に 1 件削除してください。',
    storageUnavailable: 'ブラウザーの保存領域を利用できません。プリセットはこのセッションのみ有効です。', storageInvalid: '保存済みのプリセットを読み込めませんでした。原文を保持する初期設定を利用できます。', storageVersion: '保存済みプリセットのバージョンに対応していないため、適用しませんでした。',
    languageLocked: 'この会話は原文の言語を保持します。別の言語を使うには新しい会話を始めてください。', send: '送信',
  },
};

export function experienceCopy(lang) { return EXPERIENCE_COPY[lang] || EXPERIENCE_COPY.en; }

export function licenseStatusAfter(status, event) {
  if (event === 'apply') return 'pending';
  if (event === 'clear') return 'empty';
  if (event === 'request') return 'checking';
  if (event === 'accepted') return 'validated';
  if (event === 'denied') return 'rejected';
  if (event === 'end' && status === 'checking') return 'unconfirmed';
  return status;
}

// Never derive a customer portal from a checkout organization name.
export function configuredPortalHref(config) {
  try {
    if (typeof config?.portalUrl !== 'string') return '';
    const url = new globalThis.URL(config.portalUrl);
    if (url.protocol !== 'https:' || !['polar.sh', 'sandbox.polar.sh'].includes(url.hostname)
      || url.username || url.password || url.port || url.search || url.hash
      || !/^\/[A-Za-z0-9_-]+\/portal\/?$/.test(url.pathname)) return '';
    return url.href;
  } catch { return ''; }
}
