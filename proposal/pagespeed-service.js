const ENDPOINT = 'https://pagespeedonline.googleapis.com/pagespeedonline/v5/runPagespeed';
const CATEGORIES = ['performance', 'seo', 'accessibility'];
const REQUEST_TIMEOUT_MS = 65000;

function clampScore(value) {
  return typeof value === 'number' ? Math.round(Math.max(0, Math.min(1, value)) * 100) : null;
}

function categoryScore(result, category) {
  return clampScore(result?.lighthouseResult?.categories?.[category]?.score);
}

function audit(result, id) {
  const item = result?.lighthouseResult?.audits?.[id];
  if (!item) return { id, status: '未取得', displayValue: '' };
  if (item.scoreDisplayMode === 'notApplicable') return { id, status: '対象外', displayValue: item.displayValue || '' };
  if (item.score === 1) return { id, status: '問題なし', displayValue: item.displayValue || '' };
  if (typeof item.score === 'number') return { id, status: item.score >= 0.5 ? '改善候補' : '要確認', displayValue: item.displayValue || '' };
  return { id, status: item.displayValue || '確認候補', displayValue: item.displayValue || '' };
}

function metric(result, id) {
  const item = result?.lighthouseResult?.audits?.[id];
  return item?.displayValue || '未取得';
}

function scoreText(value) {
  return value == null ? '未取得' : `${value}点`;
}

function auditText(label, item) {
  return `${label}: ${item.status}${item.displayValue && item.displayValue !== item.status ? `（${item.displayValue}）` : ''}`;
}

function priorityForScore(score, fallback = 'medium') {
  if (score == null) return fallback;
  if (score < 50) return 'high';
  if (score < 80) return 'medium';
  return 'low';
}

function strictestPriority(...priorities) {
  const rank = { low: 1, medium: 2, high: 3 };
  return priorities.reduce((selected, value) => rank[value] > rank[selected] ? value : selected, 'low');
}

function buildSuggestions(mobile, desktop) {
  const m = mobile.scores;
  const d = desktop.scores;
  const mobileChecks = [
    auditText('viewport', mobile.audits.viewport),
    auditText('文字サイズ', mobile.audits['font-size']),
    auditText('タップ領域', mobile.audits['tap-targets']),
  ].join('、');
  const seoChecks = [
    auditText('title', mobile.audits['document-title']),
    auditText('meta description', mobile.audits['meta-description']),
    auditText('クロール', mobile.audits['is-crawlable']),
    auditText('robots.txt', mobile.audits['robots-txt']),
    auditText('canonical', mobile.audits.canonical),
  ].join('、');
  const structureChecks = [
    auditText('構造化データ', mobile.audits['structured-data']),
    auditText('リンク文言', mobile.audits['link-text']),
    auditText('クロール可能なリンク', mobile.audits['crawlable-anchors']),
  ].join('、');
  const trustChecks = [
    auditText('HTTP応答', mobile.audits['http-status-code']),
    auditText('リンク名', mobile.audits['link-name']),
    auditText('文字のコントラスト', mobile.audits['color-contrast']),
  ].join('、');

  return [
    {
      key: 'mobile',
      priority: strictestPriority(priorityForScore(m.performance), priorityForScore(m.accessibility)),
      current: `PageSpeed Insightsのモバイル計測では、表示速度 ${scoreText(m.performance)}、アクセシビリティ ${scoreText(m.accessibility)}でした。${mobileChecks}。`,
      proposal: 'スマートフォンでの読みやすさと操作しやすさを実機でも確認し、viewport、文字サイズ、ボタン間隔を必要に応じて調整することをご提案します。',
      effect: 'スマートフォン利用時の迷いや押し間違いを減らし、閲覧継続や問い合わせにつながりやすい状態を目指せます。',
      customerComment: '自動計測の結果を参考に、実際の画面を確認しながら優先箇所を整理します。',
    },
    {
      key: 'performance',
      priority: strictestPriority(priorityForScore(m.performance), priorityForScore(d.performance)),
      current: `表示速度はモバイル ${scoreText(m.performance)}、デスクトップ ${scoreText(d.performance)}でした。モバイル: LCP ${mobile.metrics.lcp}、CLS ${mobile.metrics.cls}、TBT ${mobile.metrics.tbt}。デスクトップ: LCP ${desktop.metrics.lcp}、CLS ${desktop.metrics.cls}。`,
      proposal: '画像サイズ、表示を妨げるCSS・JavaScript、サーバー応答など、Lighthouseで指摘された項目から効果の大きい順に改善候補を精査します。',
      effect: 'ページの待ち時間を抑え、内容を見てもらえる機会やフォーム到達率の改善が期待できます。',
      customerComment: '通信環境で数値が変動するため、複数回の計測と実際の閲覧感を合わせて判断します。',
    },
    {
      key: 'seo',
      priority: priorityForScore(m.seo),
      current: `基本SEOスコアはモバイル ${scoreText(m.seo)}、デスクトップ ${scoreText(d.seo)}でした。${seoChecks}。`,
      proposal: 'ページタイトル、説明文、クロール設定、正規URLなどを確認し、検索エンジンへ内容が伝わりやすい基本構造へ整えることをご提案します。',
      effect: '検索結果でページ内容を適切に理解・表示してもらうための土台づくりにつながります。',
      customerComment: '公開ページから確認できる基本項目をもとにした結果です。検索順位を保証するものではありません。',
    },
    {
      key: 'ai-search',
      priority: priorityForScore(m.seo),
      current: `AI検索への直接的な掲載可否は自動判定できません。確認・改善候補として、基本SEO ${scoreText(m.seo)}、${structureChecks}を確認しました。`,
      proposal: '会社・サービス・実績などの事実情報を明確な見出しと文章で整理し、必要に応じて構造化データや根拠ページを整備することをご提案します。',
      effect: '検索エンジンや回答エンジンがサイトの内容を理解しやすくなる可能性があります。',
      customerComment: 'AI検索の回答や引用を保証するものではなく、公開情報の整理状況を確認するための候補としてご案内します。',
    },
    {
      key: 'local',
      priority: 'medium',
      current: `地域・店舗集客の実態はPageSpeed Insightsだけでは判定できません。確認・改善候補として、${structureChecks}を確認しました。所在地、営業時間、対応地域、Googleビジネスプロフィールとの整合は別途確認が必要です。`,
      proposal: '店舗・拠点情報、対応エリア、アクセス、営業時間をわかりやすく掲載し、構造化データやGoogleビジネスプロフィールとの表記統一を確認することをご提案します。',
      effect: '地域名や店舗情報を探す利用者が必要な情報へ到達しやすくなり、来店・問い合わせの後押しが期待できます。',
      customerComment: '公開ページの機械計測に加え、店舗情報や地図、外部プロフィールを営業担当が目視確認します。',
    },
    {
      key: 'trust',
      priority: priorityForScore(m.accessibility),
      current: `信頼性や問い合わせ導線の十分さは自動計測だけでは断定できません。確認・改善候補として、アクセシビリティ ${scoreText(m.accessibility)}、${trustChecks}を確認しました。会社情報、実績、フォーム到達性は別途目視確認が必要です。`,
      proposal: '会社情報・実績・プライバシー情報を確認しやすくし、問い合わせボタンの見つけやすさとフォームの使いやすさを目視で点検することをご提案します。',
      effect: '検討時の不安を減らし、安心して相談・問い合わせへ進める導線づくりにつながります。',
      customerComment: '機械計測で確認できない実績内容やフォーム送信可否は、営業担当が確認したうえで提案内容を調整します。',
    },
  ];
}

async function requestPageSpeed(url, strategy, onProgress) {
  const params = new URLSearchParams({ url, strategy, locale: 'ja' });
  for (const category of CATEGORIES) params.append('category', category);
  onProgress?.(`${strategy === 'mobile' ? 'モバイル' : 'デスクトップ'}を計測しています…`);

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${ENDPOINT}?${params}`, { signal: controller.signal, cache: 'no-store' });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = body?.error?.message || `HTTP ${response.status}`;
      if ([403, 429].includes(response.status) && /quota|limit|key|rate/i.test(message)) {
        throw new Error('APIキーなしの無料共有枠が現在利用上限に達しています。時間をおいて再実行するか、Google PageSpeed Insightsを直接ご利用ください。');
      }
      throw new Error(`PageSpeed Insightsで計測できませんでした（${message}）。`);
    }
    return body;
  } catch (error) {
    if (error?.name === 'AbortError') throw new Error('計測がタイムアウトしました。時間をおいて再実行してください。');
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

function summarize(result, strategy) {
  const auditIds = [
    'viewport', 'font-size', 'tap-targets', 'document-title', 'meta-description',
    'is-crawlable', 'robots-txt', 'canonical', 'structured-data', 'link-text',
    'crawlable-anchors', 'http-status-code', 'link-name', 'color-contrast',
  ];
  return {
    strategy,
    fetchedUrl: result?.lighthouseResult?.finalDisplayedUrl || result?.id || '',
    scores: {
      performance: categoryScore(result, 'performance'),
      seo: categoryScore(result, 'seo'),
      accessibility: categoryScore(result, 'accessibility'),
    },
    metrics: {
      fcp: metric(result, 'first-contentful-paint'),
      lcp: metric(result, 'largest-contentful-paint'),
      cls: metric(result, 'cumulative-layout-shift'),
      tbt: metric(result, 'total-blocking-time'),
      speedIndex: metric(result, 'speed-index'),
    },
    audits: Object.fromEntries(auditIds.map(id => [id, audit(result, id)])),
  };
}

export function normalizePublicUrl(input) {
  const raw = String(input || '').trim();
  if (!raw) throw new Error('診断する現行サイトURLを入力してください。');
  let parsed;
  try { parsed = new URL(raw); } catch { throw new Error('https:// または http:// から始まるURLを入力してください。'); }
  if (!['https:', 'http:'].includes(parsed.protocol)) throw new Error('公開されているWebページのURLを入力してください。');
  if (parsed.username || parsed.password) throw new Error('認証情報を含むURLは診断できません。');
  parsed.hash = '';
  return parsed.toString();
}

export function createDiagnosisFromPageSpeedResults(url, mobileRaw, desktopRaw) {
  const normalizedUrl = normalizePublicUrl(url);
  const mobile = summarize(mobileRaw, 'mobile');
  const desktop = summarize(desktopRaw, 'desktop');
  return {
    source: 'Google PageSpeed Insights / Lighthouse',
    url: normalizedUrl,
    generatedAt: new Date().toISOString(),
    appliedAt: null,
    mobile,
    desktop,
    suggestions: buildSuggestions(mobile, desktop),
  };
}

export async function diagnoseUrl(input, { onProgress } = {}) {
  const url = normalizePublicUrl(input);
  const mobileRaw = await requestPageSpeed(url, 'mobile', onProgress);
  const desktopRaw = await requestPageSpeed(url, 'desktop', onProgress);
  onProgress?.('診断結果を整理しています…');
  return createDiagnosisFromPageSpeedResults(url, mobileRaw, desktopRaw);
}
