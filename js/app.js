/* =========================================================
   従業員向け 金融サポートサイト（体験用デモ）
   - 素のJavaScriptのみ / 外部通信なし / ブラウザストレージ不使用
   - 入力値・選択状態はページ表示中のメモリ内だけで保持
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. 計算ロジック（画面イベントから分離）
     --------------------------------------------------------- */

  /** 毎月末に同額を積み立て、年率/12 の月利で複利運用する純粋なモデル */
  function calculateMonthlyAccumulation(monthlyYen, years, annualRatePercent) {
    var n = years * 12;
    var monthlyRate = annualRatePercent / 100 / 12;
    var principal = monthlyYen * n;
    var futureValue = monthlyRate === 0
      ? principal
      : monthlyYen * (Math.pow(1 + monthlyRate, n) - 1) / monthlyRate;
    if (!isFinite(futureValue) || isNaN(futureValue)) futureValue = principal;
    var principalR = Math.round(principal);
    var fvR = Math.round(futureValue);
    return { principal: principalR, futureValue: fvR, gain: fvR - principalR };
  }

  /** 教育資金：目標額を残り月数で割る（利回り0%固定） */
  function calculateEducationMonthlyTarget(targetYen, currentAge, targetAge, existingSavingsYen) {
    var months = (targetAge - currentAge) * 12;
    if (!(months > 0)) return null;
    var remainingYen = Math.max(0, targetYen - existingSavingsYen);
    var monthlyNeededYen = Math.ceil(remainingYen / months);
    return { years: targetAge - currentAge, months: months, remaining: remainingYen, monthly: monthlyNeededYen };
  }

  var nf = new Intl.NumberFormat('ja-JP');
  function yen(v) { return nf.format(Math.round(v)); }
  function manYen(v) {
    if (v >= 100000000) return (Math.round(v / 1000000) / 100) + '億円';
    if (v >= 10000) return nf.format(Math.round(v / 10000)) + '万円';
    return nf.format(Math.round(v)) + '円';
  }

  /* ---------------------------------------------------------
     2. 状態（メモリのみ・保存しない）
     --------------------------------------------------------- */
  var DEFAULTS = {
    dc: { monthly: 10000, years: 20, rate: 3 },
    savings: { monthly: 10000, years: 20, rate: 3 },
    education: { target: 3000000, currentAge: 6, targetAge: 18, existing: 0 }
  };
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  var state = {
    dc: clone(DEFAULTS.dc),
    savings: clone(DEFAULTS.savings),
    education: clone(DEFAULTS.education)
  };
  var demoBookingSelection = null; // 通信・保存なし

  /* ---------------------------------------------------------
     3. 小さなヘルパー
     --------------------------------------------------------- */
  var view = document.getElementById('view');
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var ICON = {
    chev: '<svg class="chev" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    chevS: '<svg class="chev-s" viewBox="0 0 20 20" aria-hidden="true"><path d="M7.5 4.5l5.5 5.5-5.5 5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    down: '<svg class="acc-arrow" viewBox="0 0 20 20" aria-hidden="true"><path d="M4.5 7.5L10 13l5.5-5.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    book: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5.4c2.6-1 5.2-.6 8 1.1v13c-2.8-1.7-5.4-2.1-8-1.1zM20 5.4c-2.6-1-5.2-.6-8 1.1v13c2.8-1.7 5.4-2.1 8-1.1z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    chart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20V11M9.4 20V7M14.8 20v-6.5M20.2 20V4" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    chat: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.5 12.2c0 3.6-3.8 6.5-8.5 6.5-1 0-2-.1-2.9-.4L4.5 20l.9-3.1C4 15.7 3.5 14.2 3.5 12.2c0-3.6 3.8-6.5 8.5-6.5s8.5 2.9 8.5 6.5z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
    user: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.9" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M4.6 20.4a7.6 7.6 0 0 1 14.8 0" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>'
  };

  var IMG = {
    hero: 'assets/01_ヒーロー人物写真.png',
    dc: 'assets/02_企業型DCカード画像.png',
    savings: 'assets/03_資産形成カード画像.png',
    education: 'assets/04_教育費カード画像.png',
    consult: 'assets/05_FP個別相談カード画像.png',
    event: 'assets/06_イベント案内画像.png'
  };

  function crumbs(label, parent) {
    var mid = parent ? '<span aria-hidden="true">›</span><a href="#' + parent[0] + '">' + parent[1] + '</a>' : '';
    return '<nav class="crumbs" aria-label="パンくず"><a href="#home">ホーム</a>' + mid +
      '<span aria-hidden="true">›</span><span aria-current="page">' + label + '</span></nav>';
  }
  function backHome() {
    return '<div class="cta-row"><a class="btn btn-ghost" href="#home">← ホームに戻る</a></div>';
  }

  /* toast */
  var toastTimer = null;
  function toast(msg) {
    var t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3200);
  }

  /* ---------------------------------------------------------
     4. モーダル（フォーカス移動・Escape・トリガーへ戻す）
     --------------------------------------------------------- */
  var modalRoot = document.getElementById('modalRoot');
  var modalEl = $('.modal', modalRoot);
  var modalReturnFocus = null;
  var modalOnClose = null;

  function openModal(opts) {
    modalReturnFocus = opts.returnFocus || document.activeElement;
    modalOnClose = opts.onClose || null;
    document.getElementById('modalTitle').textContent = opts.title;
    document.getElementById('modalBody').innerHTML = opts.body; // 固定コンテンツのみ
    var actions = document.getElementById('modalActions');
    actions.innerHTML = '';
    (opts.actions || [{ label: '閉じる', cls: 'btn-blue' }]).forEach(function (a) {
      var b;
      if (a.href) {
        b = document.createElement('a'); b.href = a.href;
      } else {
        b = document.createElement('button'); b.type = 'button';
      }
      b.className = 'btn ' + (a.cls || 'btn-blue');
      b.textContent = a.label;
      b.addEventListener('click', function () {
        var keep = a.onClick ? a.onClick() : false;
        if (keep !== true) closeModal(a.noReturn);
      });
      actions.appendChild(b);
    });
    if (opts.fill) opts.fill(document.getElementById('modalBody'));
    modalRoot.hidden = false;
    var first = actions.querySelector('.btn');
    (first || modalEl).focus();
  }
  function closeModal(noReturn) {
    if (modalRoot.hidden) return;
    modalRoot.hidden = true;
    var cb = modalOnClose; modalOnClose = null;
    if (cb) cb();
    if (!noReturn && modalReturnFocus && document.contains(modalReturnFocus)) {
      try { modalReturnFocus.focus(); } catch (e) { /* noop */ }
    }
  }
  modalRoot.addEventListener('click', function (e) {
    if (e.target.closest('[data-close]')) closeModal();
  });
  modalRoot.addEventListener('keydown', function (e) {
    if (e.key !== 'Tab') return;
    var f = $$('button, a[href], input, [tabindex="0"]', modalEl).filter(function (el) { return el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  /* ---------------------------------------------------------
     5. 各ページ描画
     --------------------------------------------------------- */

  var NEWS = [
    {
      id: 1, tag: 'ご案内', tagCls: 'tag-guide', title: '金融サポートサイトの使い方',
      body: '<p>このサイトは、会社の福利厚生として用意された「学ぶ・試す・相談する」ための入口です（提案用のサンプル画面）。</p>' +
        '<ol><li><strong>ホーム</strong>で、使えるサポートの全体像を確認します。</li>' +
        '<li><strong>学ぶ</strong>で、企業型DCや資産形成の基本を読みます。</li>' +
        '<li><strong>シミュレーション</strong>で、積立や教育資金の目安を自分で試します。</li>' +
        '<li>さらに整理したいときは、<strong>相談する</strong>からFP個別相談の流れを確認します。</li></ol>' +
        '<p>入力した内容はブラウザ内だけで計算され、保存・送信はされません。</p>'
    },
    {
      id: 2, tag: '更新情報', tagCls: 'tag-update', title: '積立シミュレーションのご紹介',
      body: '<p>毎月の積立額・積立期間・仮の年率（0％／1％／3％／5％）を変えて、将来額の概算を試せるツールです。</p>' +
        '<p>年率はあくまで計算上の仮定で、運用結果を保証するものではありません。投資には価格変動があり、元本割れの可能性があります。税・手数料・制度固有の条件は反映していません。</p>' +
        '<p><a href="#dc">企業型DCの積立イメージを開く ›</a>　<a href="#savings">一般的な資産形成の試算を開く ›</a></p>'
    },
    {
      id: 3, tag: 'ご案内', tagCls: 'tag-guide', title: 'FP個別相談の流れについて',
      body: '<p>FP個別相談は、ご本人の希望で申し込む予約制のサポートです。会社全体で共有する年間利用枠の範囲で実施する想定です。</p>' +
        '<p>相談者の氏名・予約日時・相談内容・家計や資産の情報を、勤務先へ報告する仕組みにはしません。</p>' +
        '<p>このサイトの予約画面は<strong>操作デモ</strong>です。予約は成立せず、外部への送信・通知もありません。</p>' +
        '<p><a href="#consult">相談の流れを見る ›</a></p>'
    }
  ];

  var FAQ = [
    { q: '企業型DCとはどんな制度ですか？', a: '勤務先が用意する確定拠出年金制度の一つです。実際の加入対象者や掛金の扱いは、各企業の規約・説明資料で異なります。' },
    { q: '積立シミュレーションは将来の受取額を保証しますか？', a: 'いいえ。掛金・期間・仮の年率を使う概算モデルで、手数料や実際の運用結果は異なります。元本割れの可能性もあります。' },
    { q: '個別FP相談の内容は会社に伝わりますか？', a: '本サービスでは、相談者名や相談内容を勤務先へ報告しない設計を想定しています。社用端末などのアクセス記録は別の問題です。' },
    { q: 'FP相談は誰でも何回でもできますか？', a: '利用資格を満たす対象社員が申し込めますが、面談は企業全体の年間契約枠内での予約制です。全員が毎年利用できる保証はありません。' },
    { q: '金融商品や保険への加入が必要ですか？', a: 'いいえ。金融商品の購入・保険加入は、学習・試算・FP相談の利用条件ではありません。' },
    { q: '教育資金ツールで大学費用がわかりますか？', a: 'この体験版は、準備したい目標額から月々の積立目安を逆算するツールです。実際の大学の学費総額は計算していません。' }
  ];

  /* ---------- Home（2026-10-28 トップページ改訂版） ---------- */
  var HOUSEHOLD_URL = '#household';

  function renderHome() {
    /* テーマ別ミニシミュレーション（メインの家計シミュレーターとは別枠） */
    var minis = [
      {
        cls: 'm-orange', img: IMG.education, alt: '本と学帽、家の模型のイメージ',
        title: '教育費を知る',
        desc: '子どもの教育費を考えるためのミニツールです。現在は準備額の試算を体験できます。',
        note: '進路別の教育費総額を調べる機能は今後追加予定',
        cta: '現在の準備額試算を試す', href: '#education'
      },
      {
        cls: 'm-green', img: IMG.savings, alt: '右肩上がりの棒グラフのイメージ',
        title: '資産形成を試す',
        desc: '毎月の積立額を変えながら、将来の資産の増え方を試算できます。',
        note: '',
        cta: '積立額を試算する', href: '#savings'
      },
      {
        cls: 'm-blue', img: IMG.dc, alt: '木のブロックと芽、成長をイメージした写真',
        title: '企業型DCを試す',
        desc: '毎月の掛金や運用条件を変えて、将来の退職資産を試算できます。',
        note: '',
        cta: '掛金を試算する', href: '#dc'
      }
    ];
    var minisHtml = minis.map(function (m) {
      return '<article class="hm-mini ' + m.cls + '">' +
        '<h3>' + m.title + '</h3>' +
        '<p class="hm-mini-desc">' + m.desc + '</p>' +
        '<div class="hm-mini-thumb"><img src="' + m.img + '" alt="' + m.alt + '" width="292" height="126"></div>' +
        (m.note ? '<p class="hm-mini-note">※ ' + m.note + '</p>' : '') +
        '<a class="hm-mini-btn" href="' + m.href + '">' + m.cta + ' <span aria-hidden="true">›</span></a>' +
      '</article>';
    }).join('');

    /* 学ぶ：実装済みの記事のみリンク。未掲載は「今後追加予定」と明示 */
    var learnItems =
      '<li><a href="#learn"><span class="hm-li-ico" aria-hidden="true">' + ICON.book + '</span>' +
        '<span class="hm-li-body"><span class="hm-li-t">企業型DCの基本</span><span class="hm-li-s">掲載中</span></span>' + ICON.chevS + '</a></li>' +
      '<li class="is-soon"><span class="hm-li-ico" aria-hidden="true">' + ICON.book + '</span>' +
        '<span class="hm-li-body"><span class="hm-li-t">NISA・資産形成の基礎知識</span><span class="hm-li-s">今後追加予定</span></span></li>' +
      '<li class="is-soon"><span class="hm-li-ico" aria-hidden="true">' + ICON.book + '</span>' +
        '<span class="hm-li-body"><span class="hm-li-t">教育費・家計の基礎知識</span><span class="hm-li-s">今後追加予定</span></span></li>';

    var eventItems = [
      ['金融教育セミナー（年1回）', '家計・積立・教育資金など ｜ 開催日 調整中（デモ）', '#events'],
      ['企業型DC 新規加入募集説明会（年1回）', '制度と加入手続の全体像 ｜ 開催日 調整中（デモ）', '#events'],
      ['運営からのご案内', 'サイトの使い方など ｜ デモ用のお知らせ', '#news']
    ].map(function (t) {
      return '<li><a href="' + t[2] + '"><span class="hm-li-ico hm-li-plan" aria-hidden="true">' + ICON.chat + '</span>' +
        '<span class="hm-li-body"><span class="hm-li-t">' + t[0] + '</span><span class="hm-li-s">' + t[1] + '</span></span>' + ICON.chevS + '</a></li>';
    }).join('');

    view.innerHTML =
      /* 1. ヒーロー */
      '<section class="hero hm-hero" aria-labelledby="heroTitle">' +
        '<div class="hero-text">' +
          '<h1 id="heroTitle">これからのお金のこと、<br>一緒に考えてみませんか？</h1>' +
          '<p class="hm-hero-lead">正しく学べる・自分で試せる・必要なときに相談できる</p>' +
          '<ul class="hm-hero-feats">' +
            '<li><span class="hf-icon hf-yellow">' + ICON.book + '</span><span class="hf-title">正しく学べる</span></li>' +
            '<li><span class="hf-icon hf-green">' + ICON.chart + '</span><span class="hf-title">自分で試せる</span></li>' +
            '<li><span class="hf-icon hf-blue">' + ICON.chat + '</span><span class="hf-title">必要なときに相談できる</span></li>' +
          '</ul>' +
        '</div>' +
        '<div class="hero-visual">' +
          '<img class="hero-photo" src="' + IMG.hero + '" alt="マグカップを手に、明るい表情で前を見る女性" width="385" height="327">' +
          '<p class="hero-bubble">将来の安心は<br>今の一歩から</p>' +
        '</div>' +
      '</section>' +

      /* 2. メインバナー：わが家の未来シミュレーション */
      '<section class="hm-banner" aria-labelledby="hmBannerTitle">' +
        '<div class="hm-banner-body">' +
          '<p class="hm-banner-tag">まずはこれから</p>' +
          '<h2 id="hmBannerTitle"><a href="' + HOUSEHOLD_URL + '">わが家の未来シミュレーション <span class="hm-arrow" aria-hidden="true">›</span></a></h2>' +
          '<p class="hm-banner-desc">家族・収入・支出・資産形成をもとに、65歳まで／90歳までの家計の未来をざっくり見える化。</p>' +
          '<div class="hm-courses">' +
            '<a class="hm-course" href="' + HOUSEHOLD_URL + '"><span class="hm-course-badge" aria-hidden="true">A</span>' +
              '<span class="hm-course-txt"><strong>65歳まで</strong><small>現役期の家計と資産形成を確認</small></span></a>' +
            '<a class="hm-course" href="' + HOUSEHOLD_URL + '"><span class="hm-course-badge" aria-hidden="true">B</span>' +
              '<span class="hm-course-txt"><strong>90歳まで</strong><small>老後までの見通しも確認</small></span></a>' +
          '</div>' +
          '<div class="hm-banner-actions">' +
            '<a class="btn btn-blue hm-start" href="' + HOUSEHOLD_URL + '">シミュレーションを始める <span class="arw" aria-hidden="true">›</span></a>' +
            '<p class="hm-banner-note">コースの選択は、シミュレーターの開始画面で行います。</p>' +
          '</div>' +
        '</div>' +
        '<div class="hm-banner-visual" aria-hidden="true">' +
          '<div class="hm-sky"></div>' +
          '<div class="hm-hill hm-hill-1"></div>' +
          '<div class="hm-hill hm-hill-2"></div>' +
          '<div class="hm-chart">' +
            '<div class="hm-chart-head"><span>資産の見通し（イメージ）</span><span class="hm-chart-legend"><i></i>積立あり</span></div>' +
            '<div class="hm-chart-bars">' +
              [34, 46, 57, 70, 86, 100].map(function (h) { return '<span style="height:' + h + '%"></span>'; }).join('') +
            '</div>' +
            '<div class="hm-chart-axis"><span>いま</span><span>65歳</span><span>90歳</span></div>' +
          '</div>' +
        '</div>' +
      '</section>' +

      /* 3. テーマ別ミニシミュレーション */
      '<section class="hm-sec" aria-labelledby="hmMiniTitle">' +
        '<div class="hm-sec-head"><div><h2 id="hmMiniTitle">テーマ別ミニシミュレーション</h2>' +
          '<p class="hm-sec-sub">気になるテーマだけ、かんたんに試せます。</p></div>' +
          '<a class="hm-sec-more" href="#simulation">すべてのミニシミュレーションを見る ›</a></div>' +
        '<div class="hm-minis">' + minisHtml + '</div>' +
      '</section>' +

      /* 4. 下段3カード */
      '<section class="hm-sec" aria-labelledby="hmLowTitle"><h2 class="sr-only" id="hmLowTitle">学ぶ・イベント・お知らせ・相談する</h2>' +
        '<div class="hm-low">' +
          '<article class="hm-low-card"><div class="hm-low-head"><span class="hm-low-ico hf-blue">' + ICON.book + '</span><h3>学ぶ</h3></div>' +
            '<p class="hm-low-desc">お金の基礎知識や制度について、わかりやすく解説しています。</p>' +
            '<ul class="hm-list">' + learnItems + '</ul>' +
            '<p class="hm-low-note">※ 掲載中の記事は一部です。テーマは順次追加予定です。</p>' +
            '<a class="hm-low-more" href="#learn">学ぶページを見る ›</a></article>' +
          '<article class="hm-low-card"><div class="hm-low-head"><span class="hm-low-ico hf-yellow">' + ICON.chat + '</span><h3>イベント・お知らせ</h3>' +
              '<a class="hm-low-more-inline" href="#events">一覧 ›</a></div>' +
            '<p class="hm-low-desc">金融教育と加入説明会は、それぞれ年1回の別々の行事です。</p>' +
            '<ul class="hm-list">' + eventItems + '</ul>' +
            '<p class="hm-low-note">※ 開催日は調整中（デモ）。実際の日程は決定後にご案内します。</p></article>' +

          '<article class="hm-low-card hm-low-consult"><div class="hm-low-head"><span class="hm-low-ico hf-purple">' + ICON.chat + '</span><h3>相談する</h3></div>' +
            '<p class="hm-low-desc">必要なときに、専門家（FP）へ個別に相談できます。</p>' +
            '<div class="hm-mini-thumb"><img src="' + IMG.consult + '" alt="オンラインで相談に応じるFPのイメージ" width="288" height="126"></div>' +
            '<p class="hm-low-note">希望者向けの予約制で、企業全体の年間面談枠の範囲で実施します。この画面は操作デモで、予約は成立しません。</p>' +
            '<div class="hm-low-cta"><a class="btn btn-ghost-purple btn-pill" href="#consult">相談について詳しく見る ›</a></div></article>' +
        '</div>' +
      '</section>';
  }

  /* ---------- Learn ---------- */
  function renderLearning() {
    view.innerHTML =
      '<div class="page">' + crumbs('学ぶ') +
      '<div class="learn-hero">' +
        '<div><span class="eyebrow blue">学ぶ｜企業型DC</span>' +
          '<h1 style="font-size:clamp(24px,2.2vw,32px);font-weight:800;margin-top:4px">企業型DCの基本を知る</h1>' +
          '<p class="page-lead">企業型DC（企業型確定拠出年金）について、はじめての方にもわかるように基本をまとめています。具体的な対象者や掛金の扱いは、所属企業の制度資料をご確認ください。</p>' +
        '</div>' +
        '<img src="' + IMG.dc + '" alt="木のブロックと芽、成長をイメージした写真" width="292" height="126">' +
      '</div>' +

      '<section class="section"><h2 class="section-title">3つのポイント</h2><div class="grid3">' +
        '<div class="card"><div class="num">1</div><h3>制度を知る</h3><p>会社が用意する資産形成・年金の制度の一つです。具体的な対象者・拠出方法は、会社の制度資料で確認しましょう。</p></div>' +
        '<div class="card"><div class="num">2</div><h3>積立と運用を知る</h3><p>将来の金額は、積立期間・掛金・運用結果によって変わります。運用には価格変動があり、元本割れの可能性があります。</p></div>' +
        '<div class="card"><div class="num">3</div><h3>自分に合わせて考える</h3><p>長い期間で考えること、掛金と毎月の生活費の両立、運用商品の内容やリスクを確認することが大切です。</p></div>' +
      '</div></section>' +

      '<section class="section"><h2 class="section-title">会社の制度で確認したいこと</h2>' +
        '<ul class="check-list"><li>加入対象</li><li>事業主掛金・本人の負担</li><li>運用商品の選択</li><li>加入・退職時の案内</li><li>問い合わせ先</li></ul>' +
        '<p class="notice">※ このページは一般的な説明です。掛金の上限額・税制・社会保険料への影響など、制度条件を伴う数値はこのデモでは扱っていません。</p>' +
        '<div class="cta-row"><a class="btn btn-blue" href="#dc">積立を試してみる <span class="arw" aria-hidden="true">›</span></a></div>' +
      '</section>' +

      '<section class="section"><h2 class="section-title">講座のご案内（年1回ずつ・別々の講座）</h2><div class="grid2">' +
        '<div class="card"><span class="ev-label ev-green">金融教育（年1回）</span><h3 style="margin-top:10px">お金の基礎を学ぶ金融教育</h3>' +
          '<p>家計・資産形成・教育費などをテーマに、FPがオンラインで講師を務める想定です。</p>' +
          '<p><strong>開催日：</strong>調整中（デモ）</p></div>' +
        '<div class="card"><span class="ev-label ev-blue">新規加入募集説明会（年1回）</span><h3 style="margin-top:10px">企業型DCへの加入の流れを知る説明会</h3>' +
          '<p>企業型DCの仕組みと加入の流れを理解する機会です。FPがオンラインで講師を務める想定です。</p>' +
          '<p><strong>開催日：</strong>調整中（デモ）</p></div>' +
      '</div>' +
      '<p class="notice">実際の加入・制度適用の条件は、所属企業の制度資料・案内で別途ご確認ください。</p>' +
      '<div class="cta-row"><a class="btn btn-ghost" href="#events">イベント一覧を見る ›</a><a class="btn btn-ghost" href="#home">← ホームに戻る</a></div>' +
      '</section></div>';
  }

  /* ---------- Simulation menu ---------- */
  function renderSimulationMenu() {
    var tools = [
      { href: '#dc', img: IMG.dc, color: 'blue', btn: 'btn-blue', title: '企業型DCの積立イメージ', desc: '毎月の積立額・期間・仮の年率から、積立終了時の概算額を試します。', alt: '木のブロックと芽のイメージ' },
      { href: '#savings', img: IMG.savings, color: 'green', btn: 'btn-green', title: '一般的な資産形成の積立試算', desc: '毎月の積立で、将来どれくらいになるかの目安を試します。', alt: '棒グラフのイメージ' },
      { href: '#education', img: IMG.education, color: 'orange', btn: 'btn-orange', title: '教育資金の目標額から逆算', desc: '準備したい目標額から、毎月の準備額の目安を計算します。', alt: '本と学帽のイメージ' }
    ];
    view.innerHTML =
      '<div class="page">' + crumbs('シミュレーション') +
      '<div class="page-head"><h1><span><span class="eyebrow blue">シミュレーション</span>3つの簡易試算</span></h1></div>' +
      '<p class="page-lead">すべてブラウザ内だけで計算する概算ツールです。入力内容・計算結果は外部に送信・保存されません。</p>' +
      '<div class="grid3" style="margin-top:18px">' +
      tools.map(function (t) {
        return '<a class="card tool-card" href="' + t.href + '">' +
          '<div class="thumb"><img src="' + t.img + '" alt="' + t.alt + '" width="292" height="126"></div>' +
          '<h3><span class="ttl">' + t.title + '</span>' + ICON.chev + '</h3><p style="margin-top:0">' + t.desc + '</p>' +
          '<span class="btn block ' + t.btn + '">試算をはじめる <span class="arw" aria-hidden="true">›</span></span></a>';
      }).join('') +
      '</div>' +
      '<p class="notice">試算は将来の成果や給付額を保証しません。</p>' +
      backHome() + '</div>';
  }

  /* ---------- 積立シミュレーター（DC・一般で共通） ---------- */
  function renderAccumulationSimulator(key) {
    var isDc = key === 'dc';
    var theme = isDc ? 'theme-blue' : 'theme-green';
    var title = isDc ? '企業型DCの積立イメージ' : '毎月の積立で、どれくらいになる？';
    var eyebrow = isDc ? '<span class="eyebrow blue">シミュレーション｜企業型DC</span>' : '<span class="eyebrow green">シミュレーション｜資産形成</span>';
    var lead = isDc
      ? '毎月の積立額・積立期間・仮の運用利回りを変えて、将来額を試してみましょう。これは制度の適用資格や実際の掛金上限を判定するものではありません。'
      : '毎月の積立額・積立期間・仮の年率を変えて、将来の資産額の目安を試してみましょう。制度上の非課税枠・NISA口座の可否・控除額は判定しません。';
    var caution = isDc
      ? '※ 年率は運用結果を保証するものではありません。運用商品によって元本割れの可能性があり、税・手数料・制度固有の拠出条件・受取時の取扱いは反映していません。実際の企業型DC条件は所属企業の案内をご確認ください。'
      : '※ 年率は運用結果を保証するものではありません。投資には価格変動があり、元本割れの可能性があります。税・手数料は反映していません。制度上の非課税枠・NISA口座の可否・控除額は判定しません。';
    var monthlyLabel = isDc ? '毎月の積立額（モデル）' : '毎月の積立額';
    var monthlyHint = isDc ? '計算用のモデル額です。会社の実際の掛金・本人負担とは別のものです。' : '0〜100,000円（1,000円刻み）';

    view.innerHTML =
      '<div class="page ' + theme + '">' + crumbs(title, ['simulation', 'シミュレーション']) +
      '<div class="page-head"><h1><span>' + eyebrow + title + '</span></h1>' +
        '<span class="tag tag-demo">体験用デモ｜試算は概算です</span></div>' +
      '<p class="page-lead">' + lead + '</p>' +
      '<div class="sim">' +
        '<section class="card sim-form" aria-labelledby="formTitle"><h2 class="sr-only" id="formTitle">入力</h2>' +
          '<div class="field"><label for="in-monthly">' + monthlyLabel + '</label><p class="hint">' + monthlyHint + '</p>' +
            '<div class="num-row"><input type="number" id="in-monthly" inputmode="numeric" min="0" max="100000" step="1000"><span class="unit">円</span></div>' +
            '<input class="range" type="range" id="rg-monthly" min="0" max="100000" step="1000" aria-label="毎月の積立額スライダー">' +
            '<div class="range-scale" aria-hidden="true"><span>0円</span><span>5万円</span><span>10万円</span></div>' +
            '<p class="field-error" id="err-monthly"></p></div>' +
          '<div class="field"><label for="in-years">積立期間</label><p class="hint">1〜40年（1年刻み）</p>' +
            '<div class="num-row"><input type="number" id="in-years" inputmode="numeric" min="1" max="40" step="1"><span class="unit">年</span></div>' +
            '<input class="range" type="range" id="rg-years" min="1" max="40" step="1" aria-label="積立期間スライダー">' +
            '<div class="range-scale" aria-hidden="true"><span>1年</span><span>20年</span><span>40年</span></div>' +
            '<p class="field-error" id="err-years"></p></div>' +
          '<div class="field"><span class="label" id="rateLabel">仮の年率</span><p class="hint">運用の保証はない、計算上の仮定です</p>' +
            '<div class="seg" role="group" aria-labelledby="rateLabel">' +
              [0, 1, 3, 5].map(function (r) { return '<button type="button" data-rate="' + r + '" aria-pressed="false">' + r + '％</button>'; }).join('') +
            '</div></div>' +
          '<div class="sim-tools"><button type="button" class="btn btn-ghost" id="resetBtn">初期値に戻す（リセット）</button></div>' +
        '</section>' +
        '<section class="card" aria-labelledby="resTitle">' +
          '<h2 class="sr-only" id="resTitle">試算結果</h2>' +
          '<div class="result-main" aria-live="polite">' +
            '<div class="label">積立終了時の概算額 <span class="approx">（金額は概算）</span></div>' +
            '<div class="big"><span id="out-fv">-</span><small>円</small></div>' +
            '<div class="approx" id="out-cond"></div>' +
          '</div>' +
          '<div class="result-sub">' +
            '<div><div class="k">積立元本</div><div class="v"><span id="out-principal">-</span><small>円</small></div></div>' +
            '<div><div class="k">運用増減（仮定による）</div><div class="v"><span id="out-gain">-</span><small>円</small></div></div>' +
          '</div>' +
          '<div class="chart"><div class="chart-title"><span>経過年数ごとの概算額</span>' +
            '<span class="legend"><span><i style="background:' + (isDc ? '#a9c3d3' : '#a8c8bd') + '"></i>積立元本</span><span><i style="background:' + (isDc ? 'var(--blue)' : 'var(--green)') + '"></i>運用増減</span></span></div>' +
            '<div class="bars" id="bars" role="img" aria-label="経過年数ごとの概算額の棒グラフ"></div><div class="bar-labels" id="barLabels" aria-hidden="true"></div>' +
          '</div>' +
          '<p class="sim-caution">' + caution + '<br>試算は将来の成果や給付額を保証しません。</p>' +
          '<div class="sim-next"><p>さらに整理したい方へ</p><a class="btn btn-purple" href="#consult">FP個別相談の流れを見る <span class="arw" aria-hidden="true">›</span></a></div>' +
        '</section>' +
      '</div>' +
      '<div class="cta-row">' + (isDc ? '<a class="btn btn-ghost" href="#learn">← 企業型DCの基本に戻る</a>' : '<a class="btn btn-ghost" href="#simulation">← シミュレーション一覧</a>') +
        '<a class="btn btn-ghost" href="#home">ホームに戻る</a></div>' +
      '</div>';

    var s = state[key];
    var fields = {
      monthly: { min: 0, max: 100000, step: 1000, label: '0〜100,000円' },
      years: { min: 1, max: 40, step: 1, label: '1〜40年' }
    };

    function syncInputs() {
      ['monthly', 'years'].forEach(function (f) {
        $('#in-' + f).value = s[f];
        $('#in-' + f).setAttribute('value', s[f]);
        $('#rg-' + f).value = s[f];
        $('#in-' + f).classList.remove('invalid');
        $('#err-' + f).textContent = '';
      });
      $$('.seg button').forEach(function (b) { b.setAttribute('aria-pressed', String(Number(b.dataset.rate) === s.rate)); });
    }

    function update() {
      var r = calculateMonthlyAccumulation(s.monthly, s.years, s.rate);
      $('#out-fv').textContent = yen(r.futureValue);
      $('#out-principal').textContent = yen(r.principal);
      $('#out-gain').textContent = (r.gain > 0 ? '+' : '') + yen(r.gain);
      $('#out-cond').textContent = '条件：毎月' + yen(s.monthly) + '円 × ' + s.years + '年、仮の年率' + s.rate + '％、毎月末積立・月複利';
      drawBars(r);
    }

    function pickYears(Y) {
      var steps = [1, 2, 5, 10];
      var step = 10;
      for (var i = 0; i < steps.length; i++) { if (Y / steps[i] <= 5) { step = steps[i]; break; } }
      var list = [];
      for (var y = step; y < Y; y += step) list.push(y);
      list.push(Y);
      return list.slice(-6);
    }

    function drawBars(final) {
      var yearsList = pickYears(s.years);
      var data = yearsList.map(function (y) { var c = calculateMonthlyAccumulation(s.monthly, y, s.rate); c.y = y; return c; });
      var max = Math.max.apply(null, data.map(function (d) { return d.futureValue; })) || 1;
      var bars = $('#bars'), labels = $('#barLabels');
      // 既存の棒を再利用して高さだけ変える（滑らかに変化）
      while (bars.children.length > data.length) bars.removeChild(bars.lastChild);
      while (bars.children.length < data.length) {
        var b = document.createElement('div'); b.className = 'bar';
        b.innerHTML = '<span class="val"></span><div class="stack"><div class="p"></div><div class="g"></div></div>';
        bars.appendChild(b);
      }
      labels.innerHTML = '';
      data.forEach(function (d, i) {
        var bar = bars.children[i];
        var total = d.futureValue / max * 88; // 上部に金額ラベル分の余白
        var stack = $('.stack', bar);
        stack.style.height = (s.monthly === 0 ? 0 : Math.max(total, 0.8)) + '%';
        var pShare = d.futureValue > 0 ? d.principal / d.futureValue * 100 : 100;
        $('.p', bar).style.height = pShare + '%';
        $('.g', bar).style.height = (100 - pShare) + '%';
        $('.val', bar).textContent = manYen(d.futureValue);
        var sp = document.createElement('span'); sp.textContent = d.y + '年目'; labels.appendChild(sp);
      });
      bars.setAttribute('aria-label', '経過年数ごとの概算額：' + data.map(function (d) { return d.y + '年目 ' + manYen(d.futureValue); }).join('、'));
    }

    function onNumInput(f, raw, commit) {
      var cfg = fields[f];
      var input = $('#in-' + f), err = $('#err-' + f);
      var v = Number(raw);
      var valid = raw !== '' && isFinite(v) && v >= cfg.min && v <= cfg.max;
      if (!valid && !commit) {
        input.classList.add('invalid');
        err.textContent = raw === '' ? '数値を入力してください（' + cfg.label + '）' : cfg.label + 'の範囲で入力してください';
        return;
      }
      if (!valid) v = raw === '' || !isFinite(v) ? s[f] : Math.min(cfg.max, Math.max(cfg.min, v));
      if (commit) v = Math.round(v / cfg.step) * cfg.step;
      v = Math.min(cfg.max, Math.max(cfg.min, Math.round(v)));
      s[f] = v;
      input.classList.remove('invalid'); err.textContent = '';
      $('#rg-' + f).value = v;
      if (commit) input.value = v;
      update();
    }

    ['monthly', 'years'].forEach(function (f) {
      $('#in-' + f).addEventListener('input', function (e) { onNumInput(f, e.target.value, false); });
      $('#in-' + f).addEventListener('change', function (e) { onNumInput(f, e.target.value, true); });
      $('#rg-' + f).addEventListener('input', function (e) {
        s[f] = Number(e.target.value); $('#in-' + f).value = s[f];
        $('#in-' + f).classList.remove('invalid'); $('#err-' + f).textContent = '';
        update();
      });
    });
    $$('.seg button').forEach(function (b) {
      b.addEventListener('click', function () { s.rate = Number(b.dataset.rate); syncInputs(); update(); });
    });
    $('#resetBtn').addEventListener('click', function () {
      state[key] = clone(DEFAULTS[key]); s = state[key];
      syncInputs(); update(); toast('入力を初期値に戻しました');
    });

    syncInputs();
    update();
  }
  function renderDcSimulator() { renderAccumulationSimulator('dc'); }
  function renderSavingsSimulator() { renderAccumulationSimulator('savings'); }

  /* ---------- 教育資金 ---------- */
  function renderEducationSimulator() {
    view.innerHTML =
      '<div class="page theme-orange">' + crumbs('教育資金の目標額から考える', ['simulation', 'シミュレーション']) +
      '<div class="page-head"><h1><span><span class="eyebrow orange">シミュレーション｜教育費</span>教育資金の目標額から考える</span></h1>' +
        '<span class="tag tag-demo">体験用デモ｜試算は概算です</span></div>' +
      '<p class="page-lead">ご自身で決めた「準備目標額」を、残りの期間で月々に割り振ると、毎月どれくらい準備すればよいかの目安がわかります。実際の学費を推計するツールではありません。</p>' +
      '<div class="sim">' +
        '<section class="card sim-form" aria-labelledby="eFormTitle"><h2 class="sr-only" id="eFormTitle">入力</h2>' +
          '<div class="field"><label for="in-target">準備したい目標額</label><p class="hint">100,000〜20,000,000円（10万円刻み）</p>' +
            '<div class="num-row"><input type="number" id="in-target" inputmode="numeric" min="100000" max="20000000" step="100000"><span class="unit">円</span></div>' +
            '<input class="range" type="range" id="rg-target" min="100000" max="20000000" step="100000" aria-label="準備したい目標額スライダー">' +
            '<div class="range-scale" aria-hidden="true"><span>10万円</span><span>1,000万円</span><span>2,000万円</span></div>' +
            '<p class="field-error" id="err-target"></p></div>' +
          '<div class="field"><label for="in-currentAge">お子さまの現在年齢</label><p class="hint">0〜17歳</p>' +
            '<div class="num-row"><input type="number" id="in-currentAge" inputmode="numeric" min="0" max="17" step="1"><span class="unit">歳</span></div>' +
            '<input class="range" type="range" id="rg-currentAge" min="0" max="17" step="1" aria-label="お子さまの現在年齢スライダー">' +
            '<p class="field-error" id="err-currentAge"></p></div>' +
          '<div class="field"><label for="in-targetAge">準備完了を目指す年齢</label><p class="hint">現在年齢＋1〜22歳</p>' +
            '<div class="num-row"><input type="number" id="in-targetAge" inputmode="numeric" min="1" max="22" step="1"><span class="unit">歳</span></div>' +
            '<input class="range" type="range" id="rg-targetAge" min="1" max="22" step="1" aria-label="準備完了を目指す年齢スライダー">' +
            '<p class="field-error" id="err-targetAge"></p></div>' +
          '<div class="field"><label for="in-existing">現在の準備済み資金</label><p class="hint">0円〜目標額</p>' +
            '<div class="num-row"><input type="number" id="in-existing" inputmode="numeric" min="0" max="20000000" step="10000"><span class="unit">円</span></div>' +
            '<input class="range" type="range" id="rg-existing" min="0" max="3000000" step="10000" aria-label="現在の準備済み資金スライダー">' +
            '<p class="field-error" id="err-existing"></p></div>' +
          '<div class="sim-tools"><button type="button" class="btn btn-ghost" id="resetBtn">初期値に戻す（リセット）</button></div>' +
        '</section>' +
        '<section class="card" aria-labelledby="eResTitle"><h2 class="sr-only" id="eResTitle">試算結果</h2>' +
          '<div class="result-main" aria-live="polite">' +
            '<div class="label">毎月の準備額の目安 <span class="approx">（金額は概算・利回り0％）</span></div>' +
            '<div class="big">月あたり 約<span id="out-monthly">-</span><small>円</small></div>' +
            '<div class="approx" id="out-econd"></div>' +
          '</div>' +
          '<p class="error-box" id="eError" role="alert"></p>' +
          '<div class="result-sub three">' +
            '<div><div class="k">準備目標額</div><div class="v"><span id="out-target">-</span><small>円</small></div></div>' +
            '<div><div class="k">目標まで</div><div class="v">あと<span id="out-years">-</span><small>年</small></div></div>' +
            '<div><div class="k">今から準備したい額</div><div class="v"><span id="out-remaining">-</span><small>円</small></div></div>' +
          '</div>' +
          '<div class="progress"><div class="chart-title"><span>準備目標に対する準備済みの割合</span><span id="out-pct"></span></div>' +
            '<div class="progress-track" style="margin-top:8px" role="img" id="progTrack" aria-label=""><div class="progress-done" id="progDone" style="width:0%"></div></div>' +
            '<div class="progress-legend"><span>準備済み <span id="out-existing2">0</span>円</span><span>準備目標 <span id="out-target2">0</span>円</span></div>' +
          '</div>' +
          '<p class="sim-caution">※ このツールは目標額を月々に割り振る算術例で、実際の学費・進学費用の推計ではありません。物価上昇・利息・運用・税等を反映していません。<br>初期値の300万円は「準備目標を300万円とした例」であり、教育費の総額を示すものではありません。試算は将来の成果や給付額を保証しません。</p>' +
          '<div class="sim-next"><p>さらに整理したい方へ</p><a class="btn btn-purple" href="#consult">FP個別相談の流れを見る <span class="arw" aria-hidden="true">›</span></a></div>' +
        '</section>' +
      '</div>' +
      '<div class="cta-row"><a class="btn btn-ghost" href="#simulation">← シミュレーション一覧</a><a class="btn btn-ghost" href="#home">ホームに戻る</a></div>' +
      '</div>';

    var s = state.education;
    var cfg = {
      target: { min: 100000, max: 20000000, step: 100000, label: '100,000〜20,000,000円' },
      currentAge: { min: 0, max: 17, step: 1, label: '0〜17歳' },
      targetAge: { min: 1, max: 22, step: 1, label: '1〜22歳' },
      existing: { min: 0, max: 20000000, step: 1, label: '0〜20,000,000円' }
    };
    var keys = ['target', 'currentAge', 'targetAge', 'existing'];

    function syncRanges() {
      var rgE = $('#rg-existing');
      rgE.max = s.target;
      rgE.value = Math.min(s.existing, s.target);
      $('#rg-target').value = s.target;
      $('#rg-currentAge').value = s.currentAge;
      $('#rg-targetAge').min = Math.min(22, s.currentAge + 1);
      $('#rg-targetAge').value = s.targetAge;
      $('#in-targetAge').min = Math.min(22, s.currentAge + 1);
    }
    function syncInputs() {
      keys.forEach(function (k) {
        $('#in-' + k).value = s[k];
        $('#in-' + k).setAttribute('value', s[k]);
        $('#in-' + k).classList.remove('invalid');
        $('#err-' + k).textContent = '';
      });
      syncRanges();
    }
    function setBlank() {
      ['out-monthly', 'out-years', 'out-remaining'].forEach(function (id) { $('#' + id).textContent = '—'; });
    }
    function update() {
      var errBox = $('#eError');
      $('#out-target').textContent = yen(s.target);
      $('#out-target2').textContent = yen(s.target);
      $('#out-existing2').textContent = yen(s.existing);
      var pct = s.target > 0 ? Math.min(100, s.existing / s.target * 100) : 0;
      $('#progDone').style.width = pct + '%';
      $('#out-pct').textContent = Math.floor(pct) + '％';
      $('#progTrack').setAttribute('aria-label', '準備済みの割合 ' + Math.floor(pct) + '％');

      if (s.targetAge <= s.currentAge) {
        errBox.textContent = '準備完了を目指す年齢は、お子さまの現在年齢より大きい年齢（' + (s.currentAge + 1) + '〜22歳）にしてください。';
        $('#in-targetAge').classList.add('invalid');
        setBlank();
        $('#out-econd').textContent = '';
        return;
      }
      $('#in-targetAge').classList.remove('invalid');
      var r = calculateEducationMonthlyTarget(s.target, s.currentAge, s.targetAge, s.existing);
      if (!r) { setBlank(); return; }
      errBox.textContent = s.existing >= s.target
        ? ''
        : '';
      $('#out-monthly').textContent = yen(r.monthly);
      $('#out-years').textContent = r.years;
      $('#out-remaining').textContent = yen(r.remaining);
      $('#out-econd').textContent = s.existing >= s.target
        ? '準備済み資金が準備目標額に達しているため、追加で必要な月額は0円です。'
        : '条件：準備目標' + yen(s.target) + '円、' + s.currentAge + '歳→' + s.targetAge + '歳（' + r.months + 'か月）、準備済み' + yen(s.existing) + '円、利回り0％、1円未満切上げ';
    }

    function handle(k, raw, commit) {
      var c = cfg[k], input = $('#in-' + k), err = $('#err-' + k);
      var v = Number(raw);
      var valid = raw !== '' && isFinite(v) && v >= c.min && v <= c.max;
      if (!valid && !commit) {
        input.classList.add('invalid');
        err.textContent = raw === '' ? '数値を入力してください（' + c.label + '）' : c.label + 'の範囲で入力してください';
        return;
      }
      if (!valid) v = (raw === '' || !isFinite(v)) ? s[k] : Math.min(c.max, Math.max(c.min, v));
      if (commit && c.step > 1) v = Math.round(v / c.step) * c.step;
      v = Math.min(c.max, Math.max(c.min, Math.round(v)));
      s[k] = v;
      input.classList.remove('invalid'); err.textContent = '';
      if (k === 'existing' && v > s.target) {
        err.textContent = '準備済み資金が目標額を上回っています（必要月額は0円として表示）';
      }
      if (commit) {
        if (k === 'currentAge' && s.targetAge <= s.currentAge) { s.targetAge = Math.min(22, s.currentAge + 1); $('#in-targetAge').value = s.targetAge; }
        if (k === 'existing' && s.existing > s.target) { s.existing = s.target; err.textContent = ''; }
        if (k === 'target' && s.existing > s.target) { s.existing = s.target; $('#in-existing').value = s.existing; }
        input.value = s[k];
      }
      syncRanges();
      update();
    }

    keys.forEach(function (k) {
      $('#in-' + k).addEventListener('input', function (e) { handle(k, e.target.value, false); });
      $('#in-' + k).addEventListener('change', function (e) { handle(k, e.target.value, true); });
      $('#rg-' + k).addEventListener('input', function (e) {
        var v = Number(e.target.value);
        s[k] = v; $('#in-' + k).value = v;
        $('#in-' + k).classList.remove('invalid'); $('#err-' + k).textContent = '';
        if (k === 'currentAge' && s.targetAge <= s.currentAge) { s.targetAge = Math.min(22, s.currentAge + 1); $('#in-targetAge').value = s.targetAge; }
        if (k === 'target' && s.existing > s.target) { s.existing = s.target; $('#in-existing').value = s.existing; }
        syncRanges(); update();
      });
    });
    $('#resetBtn').addEventListener('click', function () {
      state.education = clone(DEFAULTS.education); s = state.education;
      syncInputs(); update(); toast('入力を初期値に戻しました');
    });
    syncInputs();
    update();
  }

  /* ---------- FP相談デモ ---------- */
  var SLOTS = [
    { id: 'am', t: '平日 午前', s: '例：10:00〜12:00 ごろ' },
    { id: 'pm', t: '平日 午後', s: '例：13:00〜17:00 ごろ' },
    { id: 'ev', t: '平日 夕方', s: '例：17:00〜19:00 ごろ' }
  ];
  function renderConsultationDemo() {
    view.innerHTML =
      '<div class="page">' + crumbs('相談する') +
      '<div class="consult-hero">' +
        '<div><span class="eyebrow purple">相談する｜FP個別相談</span>' +
          '<h1 style="margin-top:4px">ひとりで悩まず、FPに相談するという選択肢</h1>' +
          '<p class="page-lead">資産形成、家計、教育資金、住宅、保険、老後資金など、お金に関することを本人の希望で相談できるサポートです。</p></div>' +
        '<img src="' + IMG.consult + '" alt="オンラインで相談に応じるFPのイメージ" width="288" height="126">' +
      '</div>' +

      '<div class="notice notice-purple" style="margin-top:16px"><strong>ご本人向けの大切なお知らせ</strong><br>FP相談は希望者向けの予約制で、会社全体で共有する年間利用枠に限りがあります。相談者の氏名・個別予約日時・相談内容・家計や資産情報を勤務先へ報告する仕組みにはしません。なお、社用端末・社内ネットワーク等の利用記録まで完全に秘匿できるとは限りません。</div>' +

      '<section class="section"><h2 class="section-title st-purple">相談までの流れ</h2><div class="steps">' +
        '<div class="card step"><span class="step-no">STEP 1</span><h3>相談の概要を確認</h3><p>利用条件と、個別相談の守秘について読みます。</p></div>' +
        '<div class="card step"><span class="step-no">STEP 2</span><h3>希望する時間帯を選ぶ</h3><p>仮の時間帯を選択します（下の操作デモで体験できます）。</p></div>' +
        '<div class="card step"><span class="step-no">STEP 3</span><h3>FPが案内する流れを知る</h3><p>本番では利用資格の確認・空き状況の確認・ご本人への連絡を経て確定します。<strong>このデモでは予約しません。</strong></p></div>' +
      '</div></section>' +

      '<section class="section" aria-labelledby="slotTitle"><h2 class="section-title st-purple" id="slotTitle">相談日時の選択イメージ（デモ用）</h2>' +
        '<div class="card">' +
          '<p style="margin-top:0;font-weight:700">ご希望の時間帯を1つ選んでください。<span class="tag tag-demo" style="margin-left:6px">予約は成立しません。個人情報は取得しません。</span></p>' +
          '<div class="slot-grid" role="group" aria-label="希望時間帯の選択（デモ）">' +
            SLOTS.map(function (sl) {
              return '<button type="button" class="slot" data-slot="' + sl.id + '" aria-pressed="false"><span class="t">' + sl.t + '</span><span class="s">' + sl.s + '（空き状況の表示ではありません）</span></button>';
            }).join('') +
          '</div>' +
          '<div class="cta-row"><button type="button" class="btn btn-purple" id="confirmBtn" disabled>選択内容を確認（デモ）</button><span id="selNote" style="font-weight:700;color:var(--muted)">時間帯を選ぶとボタンが押せます</span></div>' +
        '</div>' +
      '</section>' +

      '<section class="section"><h2 class="section-title st-purple">本番運用に向けて（構想）</h2>' +
        '<p class="notice">実際の運用では、利用資格の確認、会社共通の年間枠、FPの空き時間確認、委託先の個人情報保護、取消・再予約の規定、ご本人への通知などを整えたうえで開始します。このデモは外部の予約サービスには接続していません。</p>' +
      '</section>' +
      backHome() + '</div>';

    var confirmBtn = $('#confirmBtn');
    function paint() {
      $$('.slot').forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.slot === demoBookingSelection)); });
      confirmBtn.disabled = !demoBookingSelection;
      var sel = SLOTS.filter(function (x) { return x.id === demoBookingSelection; })[0];
      $('#selNote').textContent = sel ? '選択中：' + sel.t : '時間帯を選ぶとボタンが押せます';
    }
    $$('.slot').forEach(function (b) {
      b.addEventListener('click', function () { demoBookingSelection = b.dataset.slot; paint(); });
    });
    confirmBtn.addEventListener('click', function () {
      var sel = SLOTS.filter(function (x) { return x.id === demoBookingSelection; })[0];
      if (!sel) return;
      openModal({
        title: '選択内容の確認（デモ）',
        body: '<p>選択した時間帯：<strong id="mSel"></strong></p>' +
          '<p class="notice notice-demo" style="font-weight:800">これは操作デモです。予約は成立せず、外部への送信・通知もありません。</p>' +
          '<p style="font-size:13.5px;color:var(--muted)">デモ上で選択しただけで、予約は成立していません。本番では、利用資格の確認やFPの空き状況確認を経て、ご本人へご案内する流れを想定しています。</p>',
        fill: function (root) { $('#mSel', root).textContent = sel.t; },
        returnFocus: confirmBtn,
        actions: [
          { label: '選び直す', cls: 'btn-ghost-purple', noReturn: true, onClick: function () {
            demoBookingSelection = null; paint();
            setTimeout(function () { var f = $('.slot'); if (f) f.focus(); }, 0);
          } },
          { label: '閉じる', cls: 'btn-purple' }
        ]
      });
    });
    paint();
  }

  /* ---------- お知らせ ---------- */
  function renderNews(openId) {
    view.innerHTML =
      '<div class="page">' + crumbs('お知らせ') +
      '<div class="page-head"><h1><span><span class="eyebrow blue">お知らせ（デモ）</span>お知らせ一覧</span></h1></div>' +
      '<p class="page-lead">提案用のサンプル案内です。実際の公表日・投稿者は設定していません。タイトルを押すと本文が開きます。</p>' +
      '<div class="news-cards" style="margin-top:16px">' +
      NEWS.map(function (n) {
        return '<article class="card news-item" id="news-item-' + n.id + '">' +
          '<button type="button" aria-expanded="false" aria-controls="news-body-' + n.id + '">' +
            '<span class="tag ' + n.tagCls + '">' + n.tag + '</span><span class="ttl">' + n.title + '</span>' + ICON.down + '</button>' +
          '<div class="body" id="news-body-' + n.id + '" hidden>' + n.body + '</div></article>';
      }).join('') +
      '</div>' + backHome() + '</div>';
    bindAccordion('.news-item', openId);
  }

  function bindAccordion(itemSel, openId) {
    $$(itemSel).forEach(function (item, i) {
      var btn = $('button[aria-expanded]', item);
      var body = document.getElementById(btn.getAttribute('aria-controls'));
      function set(open) {
        btn.setAttribute('aria-expanded', String(open));
        body.hidden = !open;
        item.classList.toggle('open', open);
      }
      btn.addEventListener('click', function () { set(btn.getAttribute('aria-expanded') !== 'true'); });
      if (openId && openId === i + 1) set(true);
    });
    if (openId) {
      var target = $$(itemSel)[openId - 1];
      if (target) {
        setTimeout(function () {
          var y = target.getBoundingClientRect().top + window.pageYOffset - 80;
          window.scrollTo(0, Math.max(0, y));
          var b = $('button', target); if (b) b.focus({ preventScroll: true });
        }, 30);
      }
    }
  }

  /* ---------- イベント ---------- */
  function renderEvents() {
    view.innerHTML =
      '<div class="page">' + crumbs('今後のイベント') +
      '<div class="page-head"><h1><span><span class="eyebrow blue">イベント（デモ）</span>今後のイベント</span></h1></div>' +
      '<p class="page-lead">金融教育と新規加入募集説明会は、<strong>それぞれ年1回ずつ開催する別々の行事</strong>です。どちらもFP本人がオンラインで講師を務める想定です。</p>' +
      '<div class="grid2" style="margin-top:18px">' +
        '<article class="card event-card"><span class="ev-label ev-blue">年1回｜オンライン</span>' +
          '<h3 style="margin-top:10px">新規加入募集説明会（年1回）</h3><p style="margin-top:2px;color:var(--muted);font-weight:700">企業型DCオンライン説明会</p>' +
          '<dl class="meta"><dt>内容</dt><dd>企業型DCと加入手続の全体像を説明</dd><dt>対象</dt><dd>加入を検討する従業員</dd><dt>開催日</dt><dd>調整中（デモ）</dd><dt>形式</dt><dd>オンライン（FP本人が講師を務める想定）</dd></dl>' +
          '<div class="foot"><button type="button" class="btn btn-blue js-join">参加方法を確認</button></div></article>' +
        '<article class="card event-card"><span class="ev-label ev-green">年1回｜オンライン</span>' +
          '<h3 style="margin-top:10px">金融教育セミナー（年1回）</h3><p style="margin-top:2px;color:var(--muted);font-weight:700">お金の基礎を学ぶ講座</p>' +
          '<dl class="meta"><dt>内容</dt><dd>家計・積立・教育資金など</dd><dt>対象</dt><dd>会社が定める対象社員</dd><dt>開催日</dt><dd>調整中（デモ）</dd><dt>形式</dt><dd>オンライン（FP本人が講師を務める想定）</dd></dl>' +
          '<div class="foot"><button type="button" class="btn btn-green js-join">参加方法を確認</button></div></article>' +
      '</div>' +
      '<p class="notice">このページには申込フォームはありません。実際の募集・申込み開始後に、企業からお知らせします。</p>' +
      backHome() + '</div>';
    $$('.js-join').forEach(function (b) {
      b.addEventListener('click', function () {
        openModal({
          title: '参加方法について',
          body: '<p>このサイトはデモです。実際の募集・申込み開始後に、企業からお知らせします。</p><p style="font-size:13.5px;color:var(--muted)">このデモでは申込みの受付・情報の送信は行いません。</p>',
          returnFocus: b
        });
      });
    });
  }

  /* ---------- FAQ ---------- */
  function renderFaq(openId) {
    view.innerHTML =
      '<div class="page">' + crumbs('よくある質問') +
      '<div class="page-head"><h1><span><span class="eyebrow blue">よくある質問</span>よくある質問</span></h1></div>' +
      '<p class="page-lead">質問を押すと回答が開きます。制度の具体的な条件は、所属企業の規約・説明資料をご確認ください。</p>' +
      '<div class="faq-list" style="margin-top:16px">' +
      FAQ.map(function (f, i) {
        var id = i + 1;
        return '<div class="faq-item" id="faq-item-' + id + '"><h2><button type="button" aria-expanded="false" aria-controls="faq-a-' + id + '">' +
          '<span class="q-badge" aria-hidden="true">Q</span><span class="q">' + f.q + '</span>' + ICON.down + '</button></h2>' +
          '<div class="a" id="faq-a-' + id + '" hidden><span class="a-badge" aria-hidden="true">A</span><p>' + f.a + '</p></div></div>';
      }).join('') +
      '</div>' +
      '<div class="cta-row"><a class="btn btn-purple" href="#consult">FP個別相談の流れを見る ›</a><a class="btn btn-ghost" href="#home">← ホームに戻る</a></div></div>';
    bindAccordion('.faq-item', openId);
  }

  /* ---------- わが家の未来シミュレーション（ポータル内ルート） ----------
     家計シミュレーター本体（計算・グラフ・帳票）は js/household/ の既存モジュールを再利用し、
     画面は <template id="tplHousehold"> を複製してポータルの共通シェル内に表示する。 */
  var householdMounted = false;

  function renderHousehold() {
    var tpl = document.getElementById('tplHousehold');
    if (!tpl) {
      view.innerHTML = '<div class="page">' + crumbs('わが家の未来シミュレーション') +
        '<p class="notice">シミュレーターを読み込めませんでした。ページを再読み込みしてください。</p></div>';
      return;
    }
    view.innerHTML = '';
    view.appendChild(tpl.content.cloneNode(true));
    var root = document.getElementById('householdApp');
    if (window.HCS_UI && typeof window.HCS_UI.mount === 'function') {
      window.HCS_UI.mount(root);
      householdMounted = true;
    }
  }

  function unmountHousehold() {
    if (householdMounted && window.HCS_UI && typeof window.HCS_UI.unmount === 'function') {
      window.HCS_UI.unmount();
    }
    householdMounted = false;
  }

  /* ---------------------------------------------------------
     6. ルーティング（location.hash / file:// 対応）
     --------------------------------------------------------- */
  var ROUTES = {
    home: { render: renderHome, nav: 'home', title: 'ホーム' },
    household: { render: renderHousehold, nav: 'household', title: 'わが家の未来シミュレーション' },
    news: { render: renderNews, nav: 'news', title: 'お知らせ' },
    learn: { render: renderLearning, nav: 'learn', title: '企業型DCの基本を知る' },
    simulation: { render: renderSimulationMenu, nav: 'simulation', title: 'シミュレーション' },
    dc: { render: renderDcSimulator, nav: 'simulation', title: '企業型DCの積立イメージ' },
    savings: { render: renderSavingsSimulator, nav: 'simulation', title: '資産形成の積立試算' },
    education: { render: renderEducationSimulator, nav: 'simulation', title: '教育資金の目標額から考える' },
    consult: { render: renderConsultationDemo, nav: 'consult', title: 'FP個別相談' },
    faq: { render: renderFaq, nav: 'faq', title: 'よくある質問' },
    events: { render: renderEvents, nav: 'home', title: '今後のイベント' }
  };
  var currentRoute = null;

  function navigateFromHash() {
    var raw = (location.hash || '#home').replace(/^#/, '');
    var m = raw.match(/^([a-z]+)(?:-(\d+))?$/);
    var name = m && ROUTES[m[1]] ? m[1] : 'home';
    var sub = m && m[2] ? Number(m[2]) : null;
    var r = ROUTES[name];
    currentRoute = name;
    closeModal(true);
    closeMenu(false);
    if (name !== 'household') unmountHousehold();
    r.render(sub);
    $$('.sidebar a').forEach(function (a) {
      var on = a.dataset.nav === r.nav;
      a.classList.toggle('active', on);
      if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    document.title = r.title + '｜サンプル株式会社 従業員向け 金融サポートサイト（体験用デモ）';
    if (!sub) {
      window.scrollTo(0, 0);
      try { view.focus({ preventScroll: true }); } catch (e) { /* noop */ }
    }
  }
  window.addEventListener('hashchange', navigateFromHash);

  /* ---------------------------------------------------------
     7. 共通シェル（通知・デモ終了・モバイルメニュー）
     --------------------------------------------------------- */
  var sidebar = document.getElementById('sidebar');
  var overlay = document.getElementById('navOverlay');
  var menuToggle = document.getElementById('menuToggle');
  function isMobile() { return window.matchMedia('(max-width: 899px)').matches; }
  function openMenu() {
    sidebar.classList.add('open'); overlay.hidden = false;
    menuToggle.setAttribute('aria-expanded', 'true'); menuToggle.setAttribute('aria-label', 'メニューを閉じる');
    var a = $('a', sidebar); if (a) a.focus();
  }
  function closeMenu(returnFocus) {
    if (!sidebar.classList.contains('open')) return;
    sidebar.classList.remove('open'); overlay.hidden = true;
    menuToggle.setAttribute('aria-expanded', 'false'); menuToggle.setAttribute('aria-label', 'メニューを開く');
    if (returnFocus) menuToggle.focus();
  }
  menuToggle.addEventListener('click', function () {
    if (sidebar.classList.contains('open')) closeMenu(true); else openMenu();
  });
  overlay.addEventListener('click', function () { closeMenu(true); });
  sidebar.addEventListener('click', function (e) {
    var a = e.target.closest('a');
    if (!a) return;
    // 同じページを再クリックしても先頭へ戻す
    var href = a.getAttribute('href');
    if (href === '#household' && currentRoute === 'household') { if (isMobile()) closeMenu(false); return; }
    if (href === location.hash || (href === '#home' && !location.hash)) navigateFromHash();
    if (isMobile()) closeMenu(false);
  });
  window.addEventListener('resize', function () { if (!isMobile()) closeMenu(false); });

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') {
      if (!modalRoot.hidden) { closeModal(); return; }
      if (sidebar.classList.contains('open')) closeMenu(true);
    }
  });

  document.getElementById('bellBtn').addEventListener('click', function () {
    var bell = this;
    openModal({
      title: 'お知らせが1件あります',
      body: '<div class="notify-item"><span class="tag tag-guide">ご案内</span><div><strong>FP個別相談の流れについて</strong>' +
        '<p style="font-size:14px;margin-top:4px">希望者向けの予約制サポートの流れと、相談内容の取扱いについてご案内します。</p></div></div>' +
        '<p style="font-size:12.5px;color:var(--muted);margin-top:10px">※ デモ用の架空のお知らせです。</p>',
      returnFocus: bell,
      actions: [
        { label: '閉じる', cls: 'btn-ghost' },
        { label: 'お知らせを読む', cls: 'btn-blue', href: '#news-3', noReturn: true }
      ]
    });
  });

  document.getElementById('endDemoBtn').addEventListener('click', function () {
    var b = this;
    openModal({
      title: 'デモを終了しますか？',
      body: '<p>入力した試算や選択した時間帯をすべて初期状態に戻し、ホーム画面に戻ります。</p><p style="font-size:13.5px;color:var(--muted)">このデモにはログイン機能がないため、ログアウト処理ではありません。</p>',
      returnFocus: b,
      actions: [
        { label: 'キャンセル', cls: 'btn-ghost' },
        { label: '初期状態に戻す', cls: 'btn-blue', noReturn: true, onClick: resetDemo }
      ]
    });
  });

  function resetDemo() {
    state.dc = clone(DEFAULTS.dc);
    state.savings = clone(DEFAULTS.savings);
    state.education = clone(DEFAULTS.education);
    demoBookingSelection = null;
    if (location.hash === '#home' || location.hash === '') navigateFromHash();
    else location.hash = '#home';
    toast('デモを開始時の状態に戻しました');
  }

  /* 起動 */
  navigateFromHash();
})();
