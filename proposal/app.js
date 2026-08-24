import { authService, proposalRepository } from './firebase-repository.js';
import { diagnoseUrl, normalizePublicUrl } from './pagespeed-service.js?v=20260824-2';

const app = document.querySelector('#app');
const CATEGORY_TEMPLATES = [
  ['mobile', 'スマホ対応', 'スマートフォンでの見やすさ・操作性を確認します。'],
  ['performance', '表示速度', '読み込み時間や画像・コードの最適化状況を確認します。'],
  ['seo', 'SEO', '検索エンジンに内容が正しく伝わる構造を確認します。'],
  ['ai-search', 'AI検索対応', '生成AIや回答エンジンに引用されやすい情報設計を確認します。'],
  ['local', '地域・店舗集客', '地域検索、店舗情報、来店につながる情報を確認します。'],
  ['trust', '信頼性・問い合わせ導線', '実績・会社情報・問い合わせまでの流れを確認します。'],
];
const PRIORITIES = { high: '高', medium: '中', low: '低' };
const state = { user: null, projects: [], currentId: null, route: '', saving: false, diagnosing: false, diagnosisProgress: '', diagnosisError: '', lastDiagnosis: null };

function escapeHtml(value = '') { return String(value).replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[char]); }
function nl(value = '') { return escapeHtml(value).replace(/\n/g, '<br>'); }
function id() { return globalThis.crypto?.randomUUID?.() || `proposal-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function yen(value) { return Number(value || 0).toLocaleString('ja-JP'); }
function emptyFinding([key, title, guide]) { return { key, title, guide, current: '', proposal: '', effect: '', priority: 'medium', customerComment: '', adopted: true, estimatedAmount: 0, internalMemo: '' }; }
function newProject(data = {}) {
  return { id: id(), title: data.title || 'Webサイト改善のご提案', clientName: data.clientName || '', caseType: data.caseType || 'renewal', currentUrl: data.currentUrl || '', hearing: { goals: '', audience: '', requiredFeatures: '', referenceSites: '' }, findings: CATEGORY_TEMPLATES.map(emptyFinding), diagnosis: null, createdAt: new Date().toISOString(), ...data };
}
function normalize(project) {
  const byKey = new Map((project.findings || []).map(item => [item.key, item]));
  return { ...newProject(), ...project, hearing: { goals: '', audience: '', requiredFeatures: '', referenceSites: '', ...(project.hearing || {}) }, findings: CATEGORY_TEMPLATES.map(template => ({ ...emptyFinding(template), ...(byKey.get(template[0]) || {}) })) };
}
function current() { return state.projects.find(project => project.id === state.currentId); }
function setRoute(route) { location.hash = route; }
function topbar(sync = '') { return `<header class="topbar"><div class="brand"><span class="brand-mark">提</span><span>Web提案作成</span></div><div class="top-actions"><span class="sync">${escapeHtml(sync)}</span><button class="btn btn-dark" data-action="home">案件一覧</button><button class="btn btn-dark" data-action="logout">ログアウト</button></div></header>`; }

function renderLogin(message = '') {
  app.innerHTML = `<main class="auth-shell"><section class="login-card"><p class="kicker">INTERNAL TOOL</p><h1>Web提案作成</h1><p class="muted">許可された社内スタッフのみ利用できます。</p><form id="login-form" class="login-form"><label class="field"><span>メールアドレス</span><input name="email" type="email" autocomplete="username" required></label><label class="field"><span>パスワード</span><input name="password" type="password" autocomplete="current-password" required></label><p class="auth-error" role="alert">${escapeHtml(message)}</p><button class="btn btn-primary" type="submit">ログイン</button></form></section></main>`;
  document.querySelector('#login-form').onsubmit = async event => { event.preventDefault(); const button = event.target.querySelector('button'); const data = new FormData(event.target); button.disabled = true; button.textContent = 'ログイン中…'; try { await authService.signIn(String(data.get('email')).trim(), String(data.get('password'))); } catch { renderLogin('メールアドレスまたはパスワードを確認してください。'); } };
}
function renderLoading(message = 'ログイン状態を確認しています…') { app.innerHTML = `<main class="auth-shell"><section class="login-card"><p class="kicker">INTERNAL TOOL</p><h1>Web提案作成</h1><p class="muted">${escapeHtml(message)}</p></section></main>`; }

function renderList() {
  const rows = state.projects.map(project => `<article class="project-row"><div><span class="badge">${project.caseType === 'new' ? '新規制作' : 'リニューアル'}</span><h2 class="project-title">${escapeHtml(project.title)}</h2><div class="project-meta"><span>${escapeHtml(project.clientName || '顧客名未入力')}</span><span>${escapeHtml(project.currentUrl || 'URL未入力')}</span><span>更新 ${new Date(project.updatedAt || project.createdAt).toLocaleString('ja-JP')}</span></div></div><div class="actions"><button class="btn" data-action="preview" data-id="${project.id}">プレビュー</button><button class="btn btn-primary" data-action="edit" data-id="${project.id}">編集</button></div></article>`).join('');
  app.innerHTML = `${topbar()}<main class="page"><div class="page-head"><div><div class="eyebrow">PROPOSALS</div><h1>提案案件</h1><p>サイト改善の検討内容と顧客向け提案書を管理します。</p></div><button class="btn btn-primary" data-action="new">＋ 新しい提案を作成</button></div><section class="project-list">${rows || '<div class="empty">提案案件がありません。最初の案件を作成してください。</div>'}</section></main>${newModal()}`;
}
function newModal() { return `<div class="modal-backdrop hidden" id="new-modal" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" data-modal-panel><div class="modal-head"><div><span class="eyebrow">NEW PROPOSAL</span><h2>提案案件を作成</h2></div><button class="icon-btn" data-action="close-modal" aria-label="閉じる">×</button></div><form id="new-form"><div class="basic-grid"><label class="field"><span>案件種別</span><select name="caseType"><option value="renewal">リニューアル</option><option value="new">新規制作</option></select></label><label class="field"><span>顧客名</span><input name="clientName" maxlength="120"></label><label class="field span-2"><span>提案書タイトル</span><input name="title" value="Webサイト改善のご提案" maxlength="120" required></label><label class="field span-2"><span>現行サイトURL（リニューアル）</span><input name="currentUrl" type="url" placeholder="https://example.jp"></label></div><p class="form-error"></p><div class="modal-actions"><button class="btn" type="button" data-action="close-modal">キャンセル</button><button class="btn btn-primary" type="submit">作成して編集</button></div></form></section></div>`; }

function inputField(label, name, value, options = {}) { const tag = options.textarea ? `<textarea name="${name}" ${options.required ? 'required' : ''}>${escapeHtml(value)}</textarea>` : `<input name="${name}" value="${escapeHtml(value)}" ${options.type ? `type="${options.type}"` : ''} ${options.required ? 'required' : ''}>`; return `<label class="field ${options.className || ''}"><span>${label}</span>${tag}</label>`; }
function scoreBadge(label, score) {
  const tone = score == null ? 'unknown' : score >= 90 ? 'good' : score >= 50 ? 'warning' : 'poor';
  return `<div class="score-card ${tone}"><span>${escapeHtml(label)}</span><strong>${score == null ? '—' : score}</strong><small>/ 100</small></div>`;
}
function diagnosisPanel(project) {
  const diagnosis = project.diagnosis;
  const hidden = project.caseType === 'new' ? 'hidden' : '';
  const result = diagnosis ? `<div class="diagnosis-result"><div class="diagnosis-result-head"><div><strong>${escapeHtml(diagnosis.source || 'PageSpeed Insights')}</strong><span>${new Date(diagnosis.generatedAt).toLocaleString('ja-JP')}</span></div><a href="https://pagespeed.web.dev/analysis?url=${encodeURIComponent(diagnosis.url)}" target="_blank" rel="noopener noreferrer">PageSpeed Insightsで確認</a></div><div class="score-section"><h3>モバイル</h3><div class="score-grid">${scoreBadge('速度', diagnosis.mobile?.scores?.performance)}${scoreBadge('SEO', diagnosis.mobile?.scores?.seo)}${scoreBadge('アクセシビリティ', diagnosis.mobile?.scores?.accessibility)}</div></div><div class="score-section"><h3>デスクトップ</h3><div class="score-grid">${scoreBadge('速度', diagnosis.desktop?.scores?.performance)}${scoreBadge('SEO', diagnosis.desktop?.scores?.seo)}${scoreBadge('アクセシビリティ', diagnosis.desktop?.scores?.accessibility)}</div></div><p class="diagnosis-evidence">モバイル指標: LCP ${escapeHtml(diagnosis.mobile?.metrics?.lcp || '未取得')} / CLS ${escapeHtml(diagnosis.mobile?.metrics?.cls || '未取得')} / TBT ${escapeHtml(diagnosis.mobile?.metrics?.tbt || '未取得')}</p><button class="btn btn-primary" data-action="apply-diagnosis" ${diagnosis.appliedAt ? 'disabled' : ''}>${diagnosis.appliedAt ? '6観点へ反映済み' : '診断結果を6観点へ反映'}</button><p class="save-note">反映後も、営業担当が文章・採用可否・優先度・概算金額を編集できます。内容を確認してから「保存」してください。</p></div>` : '';
  const status = state.diagnosing ? state.diagnosisProgress : state.diagnosisError;
  return `<section class="panel diagnosis-panel ${hidden}" id="diagnosis"><div class="diagnosis-head"><div><div class="eyebrow">FREE URL CHECK</div><h2>URLから課題候補を自動診断</h2><p class="muted">Google PageSpeed Insights / Lighthouseでモバイルとデスクトップを計測し、6つの提案観点の下書きを作ります。</p></div><button class="btn btn-primary" data-action="diagnose" ${state.diagnosing ? 'disabled' : ''}>${state.diagnosing ? '計測中…' : diagnosis ? 'もう一度計測' : '無料で自動診断'}</button></div><div class="diagnosis-notice"><strong>実行前にご確認ください</strong><ul><li>入力したURLは計測のためGoogle PageSpeed Insightsへ送信されます。</li><li>モバイル・デスクトップの計測には1〜2分ほどかかる場合があります。</li><li>公開ページから確認できない内容、ログイン後の画面、検索順位、AI検索への掲載、店舗情報や問い合わせ送信の成否は自動判定の対象外です。</li><li>APIキーなしの無料共有枠を利用するため、混雑時は時間をおいて再実行してください。</li></ul><a href="https://pagespeed.web.dev/" target="_blank" rel="noopener noreferrer">Google PageSpeed Insightsを直接開く</a></div><p class="diagnosis-status ${state.diagnosisError ? 'error' : ''}" role="status">${escapeHtml(status)}</p>${result}</section>`;
}
function mergeDiagnosisText(existing, generated) {
  const text = String(generated || '').trim();
  if (!text || String(existing || '').includes(text)) return String(existing || '');
  return String(existing || '').trim() ? `${String(existing).trim()}\n\n【URL自動診断】\n${text}` : text;
}
function applyDiagnosis(project) {
  if (!project?.diagnosis?.suggestions?.length || project.diagnosis.appliedAt) return;
  const byKey = new Map(project.findings.map(item => [item.key, item]));
  for (const suggestion of project.diagnosis.suggestions) {
    const item = byKey.get(suggestion.key); if (!item) continue;
    item.current = mergeDiagnosisText(item.current, suggestion.current);
    item.proposal = mergeDiagnosisText(item.proposal, suggestion.proposal);
    item.effect = mergeDiagnosisText(item.effect, suggestion.effect);
    item.customerComment = mergeDiagnosisText(item.customerComment, suggestion.customerComment);
    if ({ low: 1, medium: 2, high: 3 }[suggestion.priority] > { low: 1, medium: 2, high: 3 }[item.priority]) item.priority = suggestion.priority;
  }
  project.diagnosis.appliedAt = new Date().toISOString();
}
async function runDiagnosis() {
  const project = collectForm(current());
  if (project.caseType !== 'renewal') { state.diagnosisError = 'URL自動診断はリニューアル案件で利用できます。'; renderEditor(project); return; }
  let url;
  try { url = normalizePublicUrl(project.currentUrl); } catch (error) { state.diagnosisError = error.message; renderEditor(project); return; }
  const now = Date.now();
  if (state.lastDiagnosis?.url === url && now - state.lastDiagnosis.at < 15000) { state.diagnosisError = '同じURLの再計測は15秒ほど待ってから実行してください。'; renderEditor(project); return; }
  state.lastDiagnosis = { url, at: now }; state.diagnosing = true; state.diagnosisError = ''; state.diagnosisProgress = '計測を開始しています…'; renderEditor(project);
  try {
    project.diagnosis = await diagnoseUrl(url, { onProgress(message) { state.diagnosisProgress = message; const status = document.querySelector('.diagnosis-status'); if (status) status.textContent = message; } });
  } catch (error) {
    state.diagnosisError = error?.message || '自動診断に失敗しました。時間をおいて再実行してください。';
  } finally {
    state.diagnosing = false; state.diagnosisProgress = ''; renderEditor(project);
  }
}
function findingEditor(item, index) {
  return `<section class="panel finding" id="finding-${item.key}" data-finding="${index}"><div class="finding-head"><div><div class="finding-number">POINT ${String(index + 1).padStart(2, '0')}</div><h2>${escapeHtml(item.title)}</h2><p class="muted">${escapeHtml(item.guide)}</p></div><label class="field priority"><span>優先度</span><select name="priority">${Object.entries(PRIORITIES).map(([value, label]) => `<option value="${value}" ${item.priority === value ? 'selected' : ''}>${label}</option>`).join('')}</select></label></div><div class="content-grid">${inputField('現状', 'current', item.current, { textarea: true })}${inputField('改善提案', 'proposal', item.proposal, { textarea: true })}${inputField('期待効果', 'effect', item.effect, { textarea: true })}${inputField('顧客向けコメント', 'customerComment', item.customerComment, { textarea: true })}</div><div class="sales-box"><div class="sales-grid"><label class="check-row"><input name="adopted" type="checkbox" ${item.adopted ? 'checked' : ''}> 提案書に採用する</label>${inputField('概算金額（円・税別）', 'estimatedAmount', item.estimatedAmount, { type: 'number' })}</div>${inputField('社内メモ（PDFには出力しません）', 'internalMemo', item.internalMemo, { textarea: true })}</div></section>`;
}
function renderEditor(project) {
  const hearingHidden = project.caseType === 'new' ? '' : 'hidden';
  app.innerHTML = `${topbar(state.saving ? '保存中…' : '')}<main class="page"><div class="page-head"><div><div class="eyebrow">PROPOSAL EDITOR</div><h1>${escapeHtml(project.title)}</h1><p>${project.caseType === 'new' ? '新規制作' : 'リニューアル'}の提案内容を編集します。</p></div></div><div class="editor-grid"><form id="editor-form"><section class="panel"><h2>案件基本情報</h2><div class="basic-grid"><label class="field"><span>案件種別</span><select name="caseType"><option value="renewal" ${project.caseType === 'renewal' ? 'selected' : ''}>リニューアル</option><option value="new" ${project.caseType === 'new' ? 'selected' : ''}>新規制作</option></select></label>${inputField('顧客名', 'clientName', project.clientName)}${inputField('提案書タイトル', 'title', project.title, { required: true, className: 'span-2' })}${inputField('現行サイトURL', 'currentUrl', project.currentUrl, { type: 'url', className: 'span-2' })}</div></section>${diagnosisPanel(project)}<section class="panel section-stack ${hearingHidden}" id="hearing"><div><div class="eyebrow">HEARING</div><h2>新規制作ヒアリング</h2><p class="muted">ヒアリング内容を整理した後、共通の6つの提案観点へ進みます。</p></div><div class="content-grid">${inputField('サイトの目的・達成したいこと', 'hearing.goals', project.hearing.goals, { textarea: true })}${inputField('想定する利用者・顧客', 'hearing.audience', project.hearing.audience, { textarea: true })}${inputField('必要な機能・コンテンツ', 'hearing.requiredFeatures', project.hearing.requiredFeatures, { textarea: true })}${inputField('参考サイト・デザインの方向性', 'hearing.referenceSites', project.hearing.referenceSites, { textarea: true })}</div></section><div class="section-stack">${project.findings.map(findingEditor).join('')}</div></form><aside class="sidebar"><section class="panel"><div class="actions"><button class="btn btn-primary" data-action="save">保存</button><button class="btn" data-action="preview">プレビュー</button></div><p class="save-note">保存先はFirebaseの提案アプリ専用コレクションです。</p><nav class="toc"><a href="#diagnosis" class="${project.caseType === 'new' ? 'hidden' : ''}">URL自動診断</a><a href="#hearing" class="${hearingHidden}">新規制作ヒアリング</a>${project.findings.map(item => `<a href="#finding-${item.key}">${escapeHtml(item.title)}</a>`).join('')}</nav><hr><button class="btn btn-danger" data-action="delete">この案件を削除</button></section></aside></div></main>`;
  const typeSelect = document.querySelector('[name="caseType"]'); typeSelect.onchange = () => { const isNew = typeSelect.value === 'new'; document.querySelector('#hearing').classList.toggle('hidden', !isNew); document.querySelector('#diagnosis').classList.toggle('hidden', isNew); };
}

function collectForm(project) {
  const form = document.querySelector('#editor-form');
  const get = name => String(form.elements.namedItem(name)?.value || '').trim();
  project.caseType = get('caseType'); project.clientName = get('clientName'); project.title = get('title'); project.currentUrl = get('currentUrl');
  for (const key of Object.keys(project.hearing)) project.hearing[key] = get(`hearing.${key}`);
  document.querySelectorAll('[data-finding]').forEach(section => { const item = project.findings[Number(section.dataset.finding)]; item.current = String(section.querySelector('[name="current"]').value).trim(); item.proposal = String(section.querySelector('[name="proposal"]').value).trim(); item.effect = String(section.querySelector('[name="effect"]').value).trim(); item.priority = section.querySelector('[name="priority"]').value; item.customerComment = String(section.querySelector('[name="customerComment"]').value).trim(); item.adopted = section.querySelector('[name="adopted"]').checked; item.estimatedAmount = Math.max(0, Number(section.querySelector('[name="estimatedAmount"]').value || 0)); item.internalMemo = String(section.querySelector('[name="internalMemo"]').value).trim(); });
  return project;
}
async function saveCurrent() { const project = collectForm(current()); if (!project.title) { alert('提案書タイトルを入力してください。'); return false; } state.saving = true; renderEditor(project); try { await proposalRepository.save(project, state.user.uid); const index = state.projects.findIndex(item => item.id === project.id); state.projects[index] = { ...project, updatedAt: new Date().toISOString() }; state.saving = false; renderEditor(project); return true; } catch { state.saving = false; renderEditor(project); alert('保存できませんでした。Firestoreルールと接続状態を確認してください。'); return false; } }

function proposalPage(item, index, total) { return `<article class="proposal-page"><div class="doc-kicker">IMPROVEMENT POINT ${String(index + 1).padStart(2, '0')}</div><h2>${escapeHtml(item.title)}</h2><section class="proposal-block"><h3>現状</h3><p>${nl(item.current || '現状を確認のうえ記載します。')}</p></section><section class="proposal-block"><h3>改善提案</h3><p>${nl(item.proposal || '改善内容を検討します。')}</p></section><section class="proposal-block effect-box"><h3>期待できる効果</h3><p>${nl(item.effect || '期待効果を整理します。')}</p></section>${item.customerComment ? `<section class="proposal-block"><h3>担当者コメント</h3><p>${nl(item.customerComment)}</p></section>` : ''}<section class="proposal-block"><h3>優先度 / 概算</h3><p><span class="priority-label">優先度 ${PRIORITIES[item.priority]}</span>　<span class="amount">${yen(item.estimatedAmount)}円〜</span> <small>（税別）</small></p></section>${item.internalMemo ? `<aside class="internal-only"><h3>社内メモ</h3><p>${nl(item.internalMemo)}</p></aside>` : ''}<span class="page-no">${index + 3} / ${total}</span></article>`; }
function renderPreview(project) {
  const adopted = project.findings.filter(item => item.adopted); const total = adopted.length + 2; const totalAmount = adopted.reduce((sum, item) => sum + Number(item.estimatedAmount || 0), 0);
  const summary = adopted.map(item => `<div class="summary-item"><h3>${escapeHtml(item.title)}</h3><p>${nl(item.proposal || item.guide)}</p><span class="priority-label">優先度 ${PRIORITIES[item.priority]}</span></div>`).join('');
  app.innerHTML = `<main class="preview-shell"><div class="preview-toolbar"><button class="btn btn-dark" data-action="back">← 編集に戻る</button><button class="btn btn-primary" data-action="print">PDF出力 / 印刷</button></div><article class="proposal-page cover"><div><div class="cover-rule"></div><p class="doc-kicker">WEB SITE PROPOSAL</p><h1>${escapeHtml(project.title)}</h1><h2>${escapeHtml(project.clientName || 'お客様')} 御中</h2>${project.currentUrl ? `<p class="cover-url">${escapeHtml(project.currentUrl)}</p>` : ''}</div><div class="cover-bottom"><div><p>${project.caseType === 'new' ? '新規Webサイト制作' : 'Webサイトリニューアル'}</p><p>${new Date().toLocaleDateString('ja-JP')}</p></div><strong>Web Proposal</strong></div><span class="page-no">1 / ${total}</span></article><article class="proposal-page"><div class="doc-kicker">EXECUTIVE SUMMARY</div><h2>ご提案の全体像</h2><p class="muted">現状と事業目標を踏まえ、優先度の高い項目から段階的な改善をご提案します。</p><div class="summary-grid">${summary || '<p>採用された提案項目がありません。</p>'}</div><section class="proposal-block effect-box" style="margin-top:9mm"><h3>概算合計</h3><p class="amount">${yen(totalAmount)}円〜 <small>（税別）</small></p><p>内容確定後に正式なお見積りをご提示します。</p></section><span class="page-no">2 / ${total}</span></article>${adopted.map((item, index) => proposalPage(item, index, total)).join('')}</main>`;
}

function render() {
  const route = location.hash.slice(1); state.route = route;
  if (!state.user) return;
  if (!route) return renderList();
  const [page, projectId] = route.split('/'); const previousId = state.currentId; state.currentId = projectId; if (previousId !== projectId) { state.diagnosisError = ''; state.diagnosisProgress = ''; } const project = current();
  if (!project) { setRoute(''); return; }
  if (page === 'edit') renderEditor(project); else if (page === 'preview') renderPreview(project); else setRoute('');
}

app.addEventListener('click', async event => {
  const button = event.target.closest('[data-action]'); if (!button) return; const action = button.dataset.action;
  if (action === 'home') setRoute(''); else if (action === 'logout') authService.signOut(); else if (action === 'new') document.querySelector('#new-modal').classList.remove('hidden'); else if (action === 'close-modal' && (event.target === button || !event.target.closest('[data-modal-panel]'))) document.querySelector('#new-modal')?.classList.add('hidden'); else if (action === 'edit') setRoute(`edit/${button.dataset.id}`); else if (action === 'preview') { if (state.route.startsWith('edit/')) { collectForm(current()); } setRoute(`preview/${button.dataset.id || state.currentId}`); } else if (action === 'back') setRoute(`edit/${state.currentId}`); else if (action === 'print') window.print(); else if (action === 'save') { event.preventDefault(); await saveCurrent(); } else if (action === 'diagnose') { event.preventDefault(); await runDiagnosis(); } else if (action === 'apply-diagnosis') { event.preventDefault(); const project = collectForm(current()); applyDiagnosis(project); renderEditor(project); } else if (action === 'delete') { event.preventDefault(); if (!confirm('この提案案件を削除しますか？')) return; try { await proposalRepository.remove(state.currentId); state.projects = state.projects.filter(item => item.id !== state.currentId); setRoute(''); } catch { alert('削除できませんでした。'); } }
});
app.addEventListener('submit', async event => {
  if (event.target.id !== 'new-form') return; event.preventDefault(); const data = new FormData(event.target); const project = newProject({ caseType: data.get('caseType'), clientName: String(data.get('clientName')).trim(), title: String(data.get('title')).trim(), currentUrl: String(data.get('currentUrl')).trim(), createdBy: state.user.uid }); const button = event.target.querySelector('[type="submit"]'); button.disabled = true; try { await proposalRepository.save(project, state.user.uid); state.projects.unshift(project); setRoute(`edit/${project.id}`); } catch { button.disabled = false; event.target.querySelector('.form-error').textContent = '作成できませんでした。Firestoreルールと接続状態を確認してください。'; }
});
window.addEventListener('hashchange', render);
renderLoading();
authService.observe(async user => {
  if (!user) { state.user = null; state.projects = []; renderLogin(); return; }
  renderLoading('利用権限と提案データを確認しています…');
  try { if (!await proposalRepository.isStaff(user.uid)) { await authService.signOut(); renderLogin('このアカウントは利用を許可されていません。'); return; } state.user = user; state.projects = (await proposalRepository.loadAll()).map(normalize); render(); } catch { await authService.signOut(); renderLogin('共有データへ接続できません。Firestoreの設定を確認してください。'); }
});
