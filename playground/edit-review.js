// Browser-only edit review. The parent owns requests, verification results,
// and copy availability. Text and selection state stay in memory.
import { applyTextEdits, isWellFormedText } from '../src/edit-controls.js';

const MAX_TEXT_LENGTH = 20_000;
const PAGE_SIZE = 50;
let nextId = 0;

function invalid(code) {
  return Object.assign(new TypeError(code), { code });
}

async function textHash(text, crypto) {
  if (typeof crypto?.subtle?.digest !== 'function') {
    throw invalid('edit_review_crypto_unavailable');
  }
  try {
    const digest = await crypto.subtle.digest('SHA-256', new globalThis.TextEncoder().encode(text));
    return `sha256:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
  } catch {
    throw invalid('edit_review_hash_failed');
  }
}

/**
 * Validate and snapshot the envelope before exposing any choices. `crypto` is
 * a WebCrypto test seam; production uses the browser's crypto implementation.
 * `isAccepted` means exact equality with the supplied full rewrite, never a
 * meaning-verification pass. No scores or receipts are carried into selections.
 *
 * @param {{original: string, rewrite: string, editReview: object, initialSelection?: boolean[], crypto?: Crypto}} options
 */
export async function createEditReviewState({ original, rewrite, editReview, initialSelection, crypto = globalThis.crypto }) {
  if (typeof original !== 'string' || typeof rewrite !== 'string'
    || !isWellFormedText(original) || !isWellFormedText(rewrite)
    || original.length > MAX_TEXT_LENGTH || rewrite.length > MAX_TEXT_LENGTH) {
    throw invalid('edit_review_invalid_text');
  }
  if (!editReview || editReview.schemaVersion !== 1 || editReview.offsetEncoding !== 'utf-16'
    || !/^sha256:[0-9a-f]{64}$/.test(editReview.baseHash)
    || !/^sha256:[0-9a-f]{64}$/.test(editReview.outputHash)
    || !Array.isArray(editReview.edits) || editReview.edits.length > original.length + 1) {
    throw invalid('edit_review_invalid_envelope');
  }
  const { baseHash, outputHash } = editReview;
  // Copy before awaiting crypto so caller mutations cannot change reviewed text.
  const edits = Object.freeze(editReview.edits.map(edit => {
    if (!edit || typeof edit !== 'object' || Array.isArray(edit)) throw invalid('edit_review_invalid_edit');
    return Object.freeze({ start: edit.start, end: edit.end, replacement: edit.replacement });
  }));
  if (applyTextEdits(original, edits) !== rewrite) throw invalid('edit_review_output_mismatch');
  const [actualBase, actualOutput] = await Promise.all([textHash(original, crypto), textHash(rewrite, crypto)]);
  if (actualBase !== baseHash || actualOutput !== outputHash) throw invalid('edit_review_hash_mismatch');

  let accepted = edits.map(() => true);
  let candidate = rewrite;
  if (initialSelection !== undefined) {
    if (!Array.isArray(initialSelection) || initialSelection.length !== edits.length || initialSelection.some((value) => typeof value !== 'boolean')) throw invalid('edit_review_invalid_selection');
    accepted = [...initialSelection];
    candidate = applyTextEdits(original, edits.filter((_, index) => accepted[index]));
  }
  const getSelection = () => Object.freeze({
    candidate,
    isAccepted: candidate === rewrite,
    isOriginal: candidate === original,
    baseHash,
  });
  const select = next => {
    // Some subsets can exceed the limit even when the full rewrite fits.
    // Applying first makes a failed selection atomic.
    const nextCandidate = applyTextEdits(original, edits.filter((_, index) => next[index]));
    accepted = next;
    candidate = nextCandidate;
    return getSelection();
  };
  return Object.freeze({
    edits,
    getSelection,
    getAccepted: () => Object.freeze([...accepted]),
    isChecked: index => accepted[index] === true,
    getAcceptedCount: () => accepted.reduce((count, checked) => count + Number(checked), 0),
    setAccepted(index, checked) {
      if (!Number.isInteger(index) || index < 0 || index >= edits.length || typeof checked !== 'boolean') {
        throw invalid('edit_review_invalid_selection');
      }
      const next = [...accepted];
      next[index] = checked;
      return select(next);
    },
    selectAll(checked) {
      if (typeof checked !== 'boolean') throw invalid('edit_review_invalid_selection');
      return select(edits.map(() => checked));
    },
  });
}

const LABELS = {
  en: {
    title: 'Review changes',
    note: 'A partial selection needs a new meaning check. The full rewrite’s scores and verification do not apply to changed selections. Each verification counts as one request.',
    before: 'Before', after: 'After', empty: '(empty)',
    change: n => `Apply change ${n}`,
    count: (n, total) => `${n} of ${total} changes selected.`,
    page: (first, last, total) => `Changes ${first}–${last} of ${total}`,
    restore: 'Restore full rewrite', original: 'Use original', verify: 'Verify selected text',
    previous: 'Previous changes', next: 'Next changes',
    noChanges: 'No changes to review.',
    full: 'Full rewrite selected.',
    partial: 'Selected text needs a new meaning check.',
    originalSelected: 'Original text selected.',
    busy: 'Please wait.', verifying: 'Checking the meaning of the selected text…',
    returned: 'Verification request finished. See the verification result.',
    unavailable: 'Meaning verification is unavailable.',
    verifyError: 'Verification could not be completed. Try again; this selection has no new verification result.',
    selectionError: 'The selected text could not be updated. Choose again or restore the full rewrite.',
    tooLong: 'This selection exceeds the text limit. The previous selection has been kept.',
  },
  ko: {
    title: '변경 사항 검토',
    note: '일부 변경만 선택하면 의미 보존을 다시 검증해야 합니다. 전체 수정문의 점수와 검증 결과는 선택을 바꾼 글에 적용되지 않습니다. 검증마다 요청 1회가 사용됩니다.',
    before: '변경 전', after: '변경 후', empty: '(없음)',
    change: n => `변경 ${n} 적용`,
    count: (n, total) => `전체 ${total}개 중 ${n}개 변경 선택.`,
    page: (first, last, total) => `전체 ${total}개 중 변경 ${first}–${last}`,
    restore: '전체 수정문 복원', original: '원문 사용', verify: '선택한 글 검증',
    previous: '이전 변경 사항', next: '다음 변경 사항',
    noChanges: '검토할 변경 사항이 없습니다.',
    full: '전체 수정문을 선택했습니다.',
    partial: '선택한 글의 의미 보존을 다시 검증해야 합니다.',
    originalSelected: '원문을 선택했습니다.',
    busy: '잠시 기다려 주세요.', verifying: '선택한 글의 의미 보존을 검증하고 있습니다…',
    returned: '검증 요청이 끝났습니다. 검증 결과를 확인해 주세요.',
    unavailable: '의미 보존 검증을 사용할 수 없습니다.',
    verifyError: '검증을 완료하지 못했습니다. 다시 시도해 주세요. 이 선택에 대한 새 검증 결과는 없습니다.',
    selectionError: '선택한 글을 반영하지 못했습니다. 다시 선택하거나 전체 수정문을 복원해 주세요.',
    tooLong: '선택한 글이 길이 제한을 초과합니다. 이전 선택을 유지했습니다.',
  },
  zh: {
    title: '审阅修改',
    note: '仅选择部分修改时，需要重新验证语义。完整改写的评分和验证结果不适用于更改后的选择。每次验证计为一次请求。',
    before: '修改前', after: '修改后', empty: '（空）',
    change: n => `采用第 ${n} 处修改`,
    count: (n, total) => `已选择 ${n} 处修改，共 ${total} 处。`,
    page: (first, last, total) => `第 ${first}–${last} 处修改，共 ${total} 处`,
    restore: '恢复完整改写', original: '使用原文', verify: '验证所选文本',
    previous: '上一页修改', next: '下一页修改',
    noChanges: '没有需要审阅的修改。',
    full: '已选择完整改写。',
    partial: '所选文本需要重新验证语义。',
    originalSelected: '已选择原文。',
    busy: '请稍候。', verifying: '正在验证所选文本的语义…',
    returned: '验证请求已结束，请查看验证结果。',
    unavailable: '语义验证暂不可用。',
    verifyError: '未能完成验证，请重试。当前选择没有新的验证结果。',
    selectionError: '未能更新所选文本。请重新选择或恢复完整改写。',
    tooLong: '所选文本超出长度限制，已保留之前的选择。',
  },
  ja: {
    title: '変更を確認',
    note: '一部の変更だけを選ぶ場合は、意味の保持を再検証する必要があります。書き換え全体のスコアと検証結果は、選択を変えた文章には適用されません。検証ごとに1リクエストを使用します。',
    before: '変更前', after: '変更後', empty: '（空）',
    change: n => `変更 ${n} を適用`,
    count: (n, total) => `${total} 件中 ${n} 件の変更を選択。`,
    page: (first, last, total) => `${total} 件中 ${first}–${last} 件目の変更`,
    restore: '書き換え全体を復元', original: '原文を使用', verify: '選択した文章を検証',
    previous: '前の変更', next: '次の変更',
    noChanges: '確認する変更はありません。',
    full: '書き換え全体を選択しました。',
    partial: '選択した文章の意味の保持を再検証する必要があります。',
    originalSelected: '原文を選択しました。',
    busy: 'しばらくお待ちください。', verifying: '選択した文章の意味の保持を検証しています…',
    returned: '検証リクエストが終了しました。検証結果を確認してください。',
    unavailable: '意味の保持の検証を利用できません。',
    verifyError: '検証を完了できませんでした。再試行してください。この選択に対する新しい検証結果はありません。',
    selectionError: '選択した文章を反映できませんでした。選び直すか、書き換え全体を復元してください。',
    tooLong: '選択した文章が文字数制限を超えています。前の選択を維持しました。',
  },
};

/**
 * Build a detached component after envelope validation. Selection callbacks
 * receive {candidate, isAccepted, isOriginal, baseHash}, initially and after
 * each change. The parent must invalidate stale scores/receipts and update copy
 * availability in onSelectionChange. Restore checks all edits, then calls
 * onSelectionChange and onRestore with the full-rewrite selection.
 *
 * onVerify(candidate, baseHash) is awaited; the parent sends mode:'verify' with
 * the existing auth/quota contract and displays the actual result. Resolution
 * never means approval here. Reject (or return false / {ok:false}) for request
 * failures. Busy state locks choices until callbacks finish. dispose detaches
 * listeners and ignores pending completions; the parent owns request abortion.
 */
export async function createEditReview({
  original, rewrite, editReview, initialSelection = undefined, lang = 'en', onSelectionChange = undefined, onVerify = undefined, onRestore = undefined,
  document = globalThis.document,
}) {
  if (!document || typeof document.createElement !== 'function') throw invalid('edit_review_document_unavailable');
  for (const callback of [onSelectionChange, onVerify, onRestore]) {
    if (callback !== undefined && typeof callback !== 'function') throw invalid('edit_review_invalid_callback');
  }
  const state = await createEditReviewState({
    original, rewrite, editReview, initialSelection, crypto: document.defaultView?.crypto ?? globalThis.crypto,
  });
  const language = typeof lang === 'string' ? lang.toLowerCase().split('-')[0] : 'en';
  const locale = Object.hasOwn(LABELS, language) ? language : 'en';
  const labels = LABELS[locale];
  const id = `edit-review-${++nextId}`;
  const make = (tag, className, text) => {
    const node = document.createElement(tag);
    node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const element = make('section', 'edit-review');
  element.lang = locale;
  element.setAttribute('aria-label', labels.title);
  const title = make('h3', 'edit-review__title', labels.title);
  const note = make('p', 'edit-review__note', labels.note);
  note.id = `${id}-note`;
  element.setAttribute('aria-describedby', note.id);
  const count = make('p', 'edit-review__count');
  const list = make('ol', 'edit-review__list');
  const empty = make('p', 'edit-review__empty', labels.noChanges);
  empty.hidden = state.edits.length !== 0;
  const pager = make('div', 'edit-review__pager');
  pager.hidden = state.edits.length <= PAGE_SIZE;
  const button = (action, label) => {
    const node = make('button', 'edit-review__button', label);
    node.type = 'button';
    node.setAttribute('data-action', action);
    return node;
  };
  const previous = button('previous', labels.previous);
  const pageLabel = make('span', 'edit-review__page');
  const next = button('next', labels.next);
  pager.append(previous, pageLabel, next);
  const actions = make('div', 'edit-review__actions');
  const restore = button('restore', labels.restore);
  const useOriginal = button('original', labels.original);
  const verify = button('verify', labels.verify);
  actions.append(restore, useOriginal, verify);
  const status = make('p', 'edit-review__status');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  element.append(title, note, count, list, empty, pager, actions, status);

  let page = 0;
  let externalBusy = false;
  let verifying = false;
  let notifying = false;
  let selectionReady = false;
  let disposed = false;
  let phase = 'ready';
  const rows = new Map();
  const listeners = [];
  const busy = () => externalBusy || verifying || notifying;
  const listen = (node, event, handler) => {
    node.addEventListener(event, handler);
    listeners.push(() => node.removeEventListener(event, handler));
  };
  const render = () => {
    if (disposed) return;
    const selection = state.getSelection();
    const selected = state.getAcceptedCount();
    const locked = busy();
    element.setAttribute('aria-busy', String(locked));
    count.textContent = labels.count(selected, state.edits.length);
    for (const [checkbox, index] of rows) {
      checkbox.checked = state.isChecked(index);
      checkbox.disabled = locked;
    }
    restore.disabled = locked || (selected === state.edits.length && selectionReady);
    useOriginal.disabled = locked || selected === 0;
    verify.disabled = locked || selection.isOriginal || !onVerify || !selectionReady;
    previous.disabled = locked || page === 0;
    next.disabled = locked || (page + 1) * PAGE_SIZE >= state.edits.length;
    verify.textContent = verifying ? labels.verifying : labels.verify;
    let message = labels[phase];
    if (phase === 'ready') {
      message = selection.isOriginal ? labels.originalSelected : selection.isAccepted ? labels.full : labels.partial;
      if (!onVerify && !selection.isOriginal) message += ` ${labels.unavailable}`;
    }
    if (locked) message = verifying ? labels.verifying : labels.busy;
    status.textContent = `${message}${pager.hidden ? '' : ` ${pageLabel.textContent}`}`;
  };
  const renderPage = () => {
    rows.clear();
    list.replaceChildren();
    const start = page * PAGE_SIZE;
    const end = Math.min(start + PAGE_SIZE, state.edits.length);
    list.start = start + 1;
    pageLabel.textContent = labels.page(start + 1, end, state.edits.length);
    for (let index = start; index < end; index++) {
      const edit = state.edits[index];
      const row = make('li', 'edit-review__edit');
      const label = make('label', 'edit-review__choice');
      const checkbox = make('input', 'edit-review__checkbox');
      checkbox.type = 'checkbox';
      label.append(checkbox, make('span', 'edit-review__change', labels.change(index + 1)));
      const fragments = make('div', 'edit-review__fragments');
      const descriptions = [];
      for (const [kind, text] of [['before', original.slice(edit.start, edit.end)], ['after', edit.replacement]]) {
        const fragment = make('div', `edit-review__fragment edit-review__fragment--${kind}`);
        const heading = make('span', 'edit-review__fragment-label', labels[kind]);
        heading.id = `${id}-${index}-${kind}-label`;
        const content = make('pre', 'edit-review__text', text === '' ? labels.empty : text);
        content.id = `${id}-${index}-${kind}`;
        content.dir = 'auto';
        content.tabIndex = 0;
        content.setAttribute('aria-labelledby', heading.id);
        descriptions.push(heading.id, content.id);
        fragment.append(heading, content);
        fragments.append(fragment);
      }
      checkbox.setAttribute('aria-describedby', descriptions.join(' '));
      rows.set(checkbox, index);
      row.append(label, fragments);
      list.append(row);
    }
    render();
  };

  const publishSelection = async (selection, restored = false) => {
    phase = 'ready';
    notifying = true;
    selectionReady = false;
    render();
    try {
      await onSelectionChange?.(selection, state.getAccepted());
      if (restored && !disposed) await onRestore?.(selection);
      selectionReady = true;
    } catch {
      phase = 'selectionError';
    } finally {
      notifying = false;
      render();
    }
  };
  listen(list, 'change', async event => {
    const index = rows.get(event.target);
    if (disposed || index === undefined) return;
    if (busy()) { render(); return; }
    let selection;
    try {
      selection = state.setAccepted(index, event.target.checked);
    } catch {
      phase = 'tooLong';
      render();
      return;
    }
    await publishSelection(selection);
  });
  listen(restore, 'click', async () => {
    if (!disposed && !restore.disabled) await publishSelection(state.selectAll(true), true);
  });
  listen(useOriginal, 'click', async () => {
    if (!disposed && !useOriginal.disabled) await publishSelection(state.selectAll(false));
  });
  for (const [control, delta] of [[previous, -1], [next, 1]]) {
    listen(control, 'click', () => {
      if (disposed || control.disabled) return;
      page += delta;
      renderPage();
      rows.keys().next().value?.focus();
    });
  }
  listen(verify, 'click', async () => {
    if (disposed || verify.disabled) return;
    const { candidate, baseHash } = state.getSelection();
    verifying = true;
    render();
    try {
      const result = await onVerify(candidate, baseHash);
      if (disposed) return;
      phase = result === false || result?.ok === false ? 'verifyError' : 'returned';
    } catch {
      if (!disposed) phase = 'verifyError';
    } finally {
      verifying = false;
      render();
    }
  });
  renderPage();
  await publishSelection(state.getSelection());
  return {
    element,
    setBusy(value) {
      if (disposed) return;
      externalBusy = Boolean(value);
      render();
    },
    dispose() {
      if (disposed) return;
      externalBusy = true;
      render();
      disposed = true;
      for (const remove of listeners) remove();
      rows.clear();
      listeners.length = 0;
    },
  };
}
