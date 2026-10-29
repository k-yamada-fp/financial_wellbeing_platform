/* =============================================================
   report.js — FP相談用データ（Markdown / JSON）と印刷シート
   -------------------------------------------------------------
   保存機能はなし。ダウンロードはブラウザ内で生成して終わり。
   自動送信・自動アップロードは一切行いません。
   ============================================================= */
(function (global) {
  'use strict';

  var C = global.HCS_CALC, D = global.HCS_DATA;

  function man(v) { return Math.round(v / 10000); }
  function n(v) { return Math.round(v).toLocaleString('ja-JP'); }
  function manStr(v) { return n(Math.round(v / 10000)) + '万円'; }
  function pad2(v) { return (v < 10 ? '0' : '') + v; }

  function stamp() {
    var d = new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate())
      + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function fileStamp() {
    var d = new Date();
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + '-'
      + pad2(d.getHours()) + pad2(d.getMinutes());
  }

  function courseLabel(c) { return c === 'B' ? 'B：90歳までの家計と老後資金' : 'A：65歳までの家計と資産形成'; }

  /* =========================================================
     Markdown
     ========================================================= */
  function buildMarkdown(result, memo) {
    var inp = result.input, plan = result.plan;
    var before = result.baseline, after = result.planResult;
    var L = [];
    var push = function (s) { L.push(s == null ? '' : s); };

    push('# 家計シミュレーション結果（FP相談用）');
    push('');
    push('- 作成日時：' + stamp());
    push('- コース：' + courseLabel(inp.course));
    push('- ツール：かんたん家計シミュレーター（提案用デモ）');
    push('- 参考資料版：' + D.meta.label);
    push('- 位置づけ：入力条件による**概算**です。将来の資産額・収益を保証するものではありません。');
    push('');
    push('---');
    push('');
    push('## 1. 家族・家計（入力値）');
    push('');
    push('| 項目 | 内容 |');
    push('| --- | --- |');
    push('| 本人年齢 | ' + inp.headAge + '歳 |');
    push('| 配偶者 | ' + (inp.hasSpouse ? inp.spouseAge + '歳' : 'なし') + ' |');
    push('| 子どもの人数 | ' + (inp.children.length ? inp.children.length + '人' : 'なし') + ' |');
    inp.children.forEach(function (c, i) {
      push('| 第' + (i + 1) + '子 | ' + (c.age < 0 ? '誕生予定（' + c.age + '歳）' : c.age + '歳')
        + '／' + (C.TRACKS[c.track] || {}).label
        + '／大学：' + (C.UNI[c.university] || {}).label
        + (c.university !== 'none' ? '（' + (c.living === 'away' ? '下宿' : '自宅通学') + '）' : '') + ' |');
    });
    push('| 本人 手取り月収 | ' + inp.headMonthlyNet + '万円／月 |');
    push('| 本人 ボーナス等 | ' + inp.headBonus + '万円／年 |');
    if (inp.hasSpouse) {
      push('| 配偶者 手取り月収 | ' + inp.spouseMonthlyNet + '万円／月 |');
      push('| 配偶者 ボーナス等 | ' + inp.spouseBonus + '万円／年 |');
    }
    push('| 毎月の生活費 | ' + inp.livingMonthly + '万円／月 |');
    if (inp.course === 'B') push('| 退職後の生活費 | ' + inp.postRetireLiving + '万円／月 |');
    push('| 年間の特別支出 | ' + inp.annualSpecial + '万円／年 |');
    push('| 塾・習い事 | ' + ({ none: '含めない', standard: '標準', high: '高額' })[inp.activityLevel] + ' |');
    push('| 教育費の扱い | ' + (inp.educationInLiving ? '毎月の生活費に含まれている（二重計上なし）' : '生活費とは別に計上') + ' |');
    push('');
    push('### 保有資産');
    push('');
    push('| 区分 | 金額 |');
    push('| --- | ---: |');
    push('| 預貯金 | ' + inp.cash + '万円 |');
    push('| NISA等の運用資産 | ' + inp.invest + '万円 |');
    push('| 企業型DC（既存分） | ' + inp.dcExisting + '万円 |');
    push('| 現在のDC掛金 | ' + inp.existingDCMonthly + '万円／月 |');
    push('| 現在のNISA等の積立額 | ' + inp.currentNisaMonthly + '万円／月 |');
    push('');
    push('## 2. 試算条件');
    push('');
    push('| 項目 | 現状のまま | 積立を実行した場合 |');
    push('| --- | ---: | ---: |');
    push('| 企業型DC 掛金 | ' + inp.existingDCMonthly + '万円/月 | ' + plan.dcMonthly + '万円/月 |');
    push('| NISA等の積立 | ' + inp.currentNisaMonthly + '万円/月 | ' + plan.nisaMonthly + '万円/月 |');
    push('| 運用利回り（仮定） | ' + plan.returnRate + '%／年 | ' + plan.returnRate + '%／年 |');
    push('');
    push('## 3. 主要な試算結果');
    push('');
    var b65 = before.summary.at65, a65 = after.summary.at65;
    push('### 65歳時点の金融資産（企業型DCを含む）');
    push('');
    push('| 区分 | 現状のまま | 積立を実行 | 差額 |');
    push('| --- | ---: | ---: | ---: |');
    push('| 預貯金 | ' + manStr(b65.cash) + ' | ' + manStr(a65.cash) + ' | ' + signed(a65.cash - b65.cash) + ' |');
    push('| NISA等の運用資産 | ' + manStr(b65.invest) + ' | ' + manStr(a65.invest) + ' | ' + signed(a65.invest - b65.invest) + ' |');
    push('| 企業型DC | ' + manStr(b65.dc) + ' | ' + manStr(a65.dc) + ' | ' + signed(a65.dc - b65.dc) + ' |');
    push('| **合計** | **' + manStr(b65.total) + '** | **' + manStr(a65.total) + '** | **' + signed(a65.total - b65.total) + '** |');
    push('');
    if (inp.course === 'B' && after.summary.at90) {
      var b90 = before.summary.at90, a90 = after.summary.at90;
      push('### 90歳時点の金融資産');
      push('');
      push('| 区分 | 現状のまま | 積立を実行 | 差額 |');
      push('| --- | ---: | ---: | ---: |');
      push('| 預貯金 | ' + manStr(b90.cash) + ' | ' + manStr(a90.cash) + ' | ' + signed(a90.cash - b90.cash) + ' |');
      push('| NISA等の運用資産 | ' + manStr(b90.invest) + ' | ' + manStr(a90.invest) + ' | ' + signed(a90.invest - b90.invest) + ' |');
      push('| 企業型DC | ' + manStr(b90.dc) + ' | ' + manStr(a90.dc) + ' | ' + signed(a90.dc - b90.dc) + ' |');
      push('| **合計** | **' + manStr(b90.total) + '** | **' + manStr(a90.total) + '** | **' + signed(a90.total - b90.total) + '** |');
      push('');
      push('### 公的年金の参考推計（仮の加入歴による参考モデル）');
      push('');
      var ph = after.pension.head, ps = after.pension.spouse;
      push('| 区分 | 年額（額面） | 内訳 |');
      push('| --- | ---: | --- |');
      if (ph) push('| 本人 | ' + manStr(ph.annual) + ' | 基礎 ' + manStr(ph.basic) + ' ＋ 報酬比例 ' + manStr(ph.earnings) + ' |');
      if (ps) push('| 配偶者 | ' + manStr(ps.annual) + ' | 基礎 ' + manStr(ps.basic) + ' ＋ 報酬比例 ' + manStr(ps.earnings) + ' |');
      push('');
      push('- 世帯の年金（額面）年額：' + manStr((ph ? ph.annual : 0) + (ps ? ps.annual : 0)));
      push('- 天引き（税・社会保険）の仮定：' + inp.pension.deductionRate + '% → 手取り年額 約'
        + manStr(((ph ? ph.annual : 0) + (ps ? ps.annual : 0)) * (1 - inp.pension.deductionRate / 100)));
      if (ph && ph.overridden) push('- 本人の年金は確認済み概算額（' + manStr(ph.annual) + '／年）を入力値として使用。');
      push('- ※ 加入歴・報酬歴を仮置きした参考推計です。実際の受給見込額ではありません。');
      push('');
    }
    push('### 教育費');
    push('');
    push('- 試算期間中の教育費合計（塾・習い事を含む）：**' + manStr(after.summary.educationTotal) + '**');
    if (inp.educationInLiving) push('- ※ 生活費に含まれている設定のため、家計収支では重複計上していません。');
    push('');
    push('| 第 | 進路（幼〜高） | 大学 | 通学 | 学校教育費の目安 |');
    push('| --- | --- | --- | --- | ---: |');
    inp.children.forEach(function (c, i) {
      var life = C.childLifetimeCost(c, { activityLevel: 'none', includeHomeLiving: false });
      push('| 第' + (i + 1) + '子 | ' + (C.TRACKS[c.track] || {}).label + ' | '
        + (C.UNI[c.university] || {}).label + ' | '
        + (c.university === 'none' ? '—' : (c.living === 'away' ? '下宿' : '自宅')) + ' | '
        + manStr(life) + ' |');
    });
    push('');
    if (after.summary.shortfallTotal > 0) {
      push('### 資金不足の発生');
      push('');
      push('- 試算期間中の不足額合計：**' + manStr(after.summary.shortfallTotal) + '**（資産が尽きた後に発生した不足）');
      var sf = after.rows.filter(function (r) { return r.shortfall > 0; });
      if (sf.length) push('- 発生時期：' + sf[0].age + '歳〜' + sf[sf.length - 1].age + '歳');
      push('');
    }
    push('## 4. 年次推移（積立を実行した場合）');
    push('');
    push('| 年齢 | 年 | 収入 | 支出 | 収支 | 教育費 | 預貯金 | 運用資産 | 企業型DC | 合計 |');
    push('| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |');
    after.rows.forEach(function (r) {
      push('| ' + r.age + ' | ' + r.calendarYear + ' | ' + man(r.income) + ' | ' + man(r.outflow) + ' | '
        + (r.flow < 0 ? '△' : '') + n(Math.abs(man(r.flow))) + ' | ' + man(r.education) + ' | '
        + man(r.closeBal.cash) + ' | ' + man(r.closeBal.invest) + ' | ' + man(r.closeBal.dc) + ' | '
        + man(r.total) + ' |');
    });
    push('');
    push('（単位：万円。「△」は赤字。年齢は各年の到達年齢、年は西暦の目安）');
    push('');
    push('## 5. 計算上の前提・未反映事項');
    push('');
    push('- 金額はすべて概算（万円単位）。税・社会保険料の個別計算は行っていません。');
    push('- 給与減額型DCの掛金は、現在の手取りが既存掛金控除後であることを前提に、**増額分のみ**を手取り減少として扱っています。');
    push('- DC掛金に伴う所得税・住民税・社会保険料の軽減効果は**概算に反映していません**（節税額は表示しません）。');
    push('- 企業型DCは原則として原則60歳（制度により異なる）まで引き出せません。65歳時点の金額は受給前の残高です。');
    push('- 運用利回りは仮定のシナリオ（0／2／5／7%）で、実際の運用成果ではありません。');
    push('- 物価上昇・生活費上昇は0%としています（2026-v22の初期値）。');
    push('- 教育費は2026-v22収録の費用モデルによる概算で、学校ごとの実額ではありません。');
    push('- 住宅ローン・保険・介護費・相続・退職金課税・児童手当等は計算に含めていません。');
    push('- 2026-v22の高校支援制度には旧年収基準（590万円）が残るため、2026年度制度としては使用していません。');
    push('- 企業型DCの月62,000円は2026年12月以降の制度上限であり、現行（2026年10月）の上限ではありません。実際の上限は企業の制度によります。');
    push('');
    if (memo && memo.trim()) {
      push('## 6. FPに相談したいこと（本人記入）');
      push('');
      push('> ' + memo.trim().replace(/\n/g, '\n> '));
      push('');
    }
    push('---');
    push('');
    push('**取扱い注意**：本ファイルには家計情報が含まれます。送付先を確認し、適切な方法で共有してください。');
    push('本ツールは提案用デモであり、FPによる個別助言ではありません。');
    push('');
    return L.join('\n');
  }

  function signed(v) {
    var m = Math.round(v / 10000);
    if (m === 0) return '±0万円';
    return (m > 0 ? '＋' : '−') + n(Math.abs(m)) + '万円';
  }

  /* =========================================================
     JSON
     ========================================================= */
  function buildJson(result, memo) {
    var inp = result.input, plan = result.plan;
    var before = result.baseline, after = result.planResult;
    return {
      tool: 'かんたん家計シミュレーター',
      kind: 'proposal-demo',
      createdAt: new Date().toISOString(),
      course: inp.course,
      courseLabel: courseLabel(inp.course),
      referenceData: { id: D.meta.id, label: D.meta.label, source: D.meta.source },
      input: {
        headAge: inp.headAge, hasSpouse: inp.hasSpouse, spouseAge: inp.spouseAge,
        children: inp.children,
        income: {
          headMonthlyNet: inp.headMonthlyNet, headBonus: inp.headBonus,
          spouseMonthlyNet: inp.spouseMonthlyNet, spouseBonus: inp.spouseBonus
        },
        spending: { livingMonthly: inp.livingMonthly, postRetireLiving: inp.postRetireLiving, annualSpecial: inp.annualSpecial },
        assets: { cash: inp.cash, invest: inp.invest, dcExisting: inp.dcExisting },
        contributions: { existingDCMonthly: inp.existingDCMonthly, currentNisaMonthly: inp.currentNisaMonthly },
        education: { activityLevel: inp.activityLevel, includedInLiving: inp.educationInLiving },
        pension: inp.pension
      },
      plan: plan,
      result: {
        baseline: summarize(before),
        withPlan: summarize(after)
      },
      memo: (memo || '').trim(),
      cautions: [
        '入力条件による概算。将来の資産額・運用収益を保証しない。',
        '税・社会保険料の個別計算、DCの節税効果は未反映。',
        '年金は仮の加入歴による参考推計。'
      ]
    };
  }

  function summarize(res) {
    function blk(b) { return { cash: man(b.cash), invest: man(b.invest), dc: man(b.dc), total: man(b.total) }; }
    return {
      unit: '万円',
      at65: blk(res.summary.at65),
      at90: res.summary.at90 ? blk(res.summary.at90) : null,
      educationTotal: man(res.summary.educationTotal),
      shortfallTotal: man(res.summary.shortfallTotal),
      minTotal: man(res.summary.minTotal),
      minTotalAge: res.summary.minTotalAge,
      returnRatePct: res.plan.returnRate,
      pension: res.pension.head ? {
        headAnnual: man(res.pension.head.annual),
        spouseAnnual: res.pension.spouse ? man(res.pension.spouse.annual) : 0,
        deductionRatePct: res.pension.deductionRate * 100
      } : null,
      yearly: res.rows.map(function (r) {
        return {
          age: r.age, year: r.calendarYear,
          income: man(r.income), outflow: man(r.outflow), flow: man(r.flow),
          education: man(r.education),
          cash: man(r.closeBal.cash), invest: man(r.closeBal.invest), dc: man(r.closeBal.dc),
          total: man(r.total)
        };
      })
    };
  }

  /* =========================================================
     ダウンロード
     ========================================================= */
  function download(filename, text, mime) {
    var blob = new Blob(['\ufeff' + text], { type: (mime || 'text/plain') + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1500);
  }

  function downloadMarkdown(result, memo) {
    download('家計シミュレーション_' + result.input.course + '_' + fileStamp() + '.md',
      buildMarkdown(result, memo), 'text/markdown');
  }
  function downloadJson(result, memo) {
    download('家計シミュレーション_' + result.input.course + '_' + fileStamp() + '.json',
      JSON.stringify(buildJson(result, memo), null, 2), 'application/json');
  }

  /* =========================================================
     印刷シート
     ========================================================= */
  function buildPrintHtml(result, memo) {
    var inp = result.input, plan = result.plan;
    var before = result.baseline, after = result.planResult;
    var b65 = before.summary.at65, a65 = after.summary.at65;
    var h = [];
    var esc = function (s) { return String(s).replace(/[&<>]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]; }); };

    h.push('<div class="p-doc">');
    h.push('<header class="p-head"><div><h1>家計シミュレーション結果</h1>'
      + '<p class="p-sub">' + esc(courseLabel(inp.course)) + '　／　参考資料版 ' + D.meta.id + '</p></div>'
      + '<div class="p-meta"><span>作成日時 ' + stamp() + '</span><span>概算・保証ではありません</span></div></header>');

    h.push('<section class="p-kpi"><div class="p-hero"><span>65歳時点の金融資産（DC込み）</span>'
      + '<strong>' + n(Math.round(a65.total / 10000)) + '<small>万円</small></strong>'
      + '<em>現状のまま ' + n(Math.round(b65.total / 10000)) + '万円</em></div>');
    if (after.summary.at90) {
      h.push('<div class="p-hero p-hero-sub"><span>90歳時点の金融資産</span>'
        + '<strong>' + n(Math.round(after.summary.at90.total / 10000)) + '<small>万円</small></strong>'
        + '<em>現状のまま ' + n(Math.round(before.summary.at90.total / 10000)) + '万円</em></div>');
    }
    h.push('<div class="p-kpi-s"><span>積立合計（DC＋NISA等）</span><b>' + plan.dcMonthly + '万円/月 ＋ ' + plan.nisaMonthly + '万円/月</b></div>');
    h.push('<div class="p-kpi-s"><span>想定利回り</span><b>' + plan.returnRate + '%／年（仮定）</b></div>');
    h.push('</section>');

    h.push('<section class="p-sec"><h2>資産の内訳（65歳時点）</h2><table class="p-table"><thead><tr>'
      + '<th>区分</th><th>現状のまま</th><th>積立を実行</th><th>差額</th></tr></thead><tbody>');
    [['預貯金', 'cash'], ['NISA等の運用資産', 'invest'], ['企業型DC', 'dc']].forEach(function (r) {
      h.push('<tr><td>' + r[0] + '</td><td>' + n(Math.round(b65[r[1]] / 10000)) + '万円</td><td>'
        + n(Math.round(a65[r[1]] / 10000)) + '万円</td><td>' + signed(a65[r[1]] - b65[r[1]]) + '</td></tr>');
    });
    h.push('<tr class="p-total"><td>合計</td><td>' + n(Math.round(b65.total / 10000)) + '万円</td><td>'
      + n(Math.round(a65.total / 10000)) + '万円</td><td>' + signed(a65.total - b65.total) + '</td></tr>');
    h.push('</tbody></table></section>');

    h.push('<section class="p-sec"><h2>主な前提条件</h2><dl class="p-dl">');
    var rows = [
      ['コース', courseLabel(inp.course)],
      ['本人年齢', inp.headAge + '歳'],
      ['配偶者', inp.hasSpouse ? inp.spouseAge + '歳' : 'なし'],
      ['子ども', inp.children.length ? inp.children.length + '人（' + inp.children.map(function (c) { return c.age + '歳'; }).join('・') + '）' : 'なし'],
      ['手取り月収（世帯）', (inp.headMonthlyNet + (inp.hasSpouse ? inp.spouseMonthlyNet : 0)) + '万円'],
      ['ボーナス等（世帯）', (inp.headBonus + (inp.hasSpouse ? inp.spouseBonus : 0)) + '万円／年'],
      ['毎月の生活費', inp.livingMonthly + '万円' + (inp.course === 'B' ? '（退職後 ' + inp.postRetireLiving + '万円）' : '')],
      ['年間の特別支出', inp.annualSpecial + '万円'],
      ['保有資産', '預貯金' + inp.cash + '万円／運用' + inp.invest + '万円／DC' + inp.dcExisting + '万円'],
      ['教育費', '生活費に' + (inp.educationInLiving ? '含む' : '含まない') + '／塾・習い事：' + ({ none: '含めない', standard: '標準', high: '高額' })[inp.activityLevel]],
      ['教育費合計（試算期間）', manStr(after.summary.educationTotal)]
    ];
    rows.forEach(function (r) { h.push('<div><dt>' + esc(r[0]) + '</dt><dd>' + esc(r[1]) + '</dd></div>'); });
    h.push('</dl></section>');

    h.push('<section class="p-sec"><h2>年次の収支と資産（積立を実行した場合）</h2>'
      + '<table class="p-table p-table-sm"><thead><tr><th>年齢</th><th>収入</th><th>支出</th><th>収支</th>'
      + '<th>預貯金</th><th>運用資産</th><th>DC</th><th>合計</th></tr></thead><tbody>');
    after.rows.forEach(function (r) {
      if (r.age % 5 !== 0 && r.age !== 65 && r.age !== 90 && r.age !== inp.headAge) return;
      h.push('<tr><td>' + r.age + '歳</td><td>' + man(r.income) + '</td><td>' + man(r.outflow) + '</td><td'
        + (r.flow < 0 ? ' class="neg"' : '') + '>' + (r.flow < 0 ? '△' : '') + n(Math.abs(man(r.flow))) + '</td><td>'
        + man(r.closeBal.cash) + '</td><td>' + man(r.closeBal.invest) + '</td><td>' + man(r.closeBal.dc)
        + '</td><td>' + man(r.total) + '</td></tr>');
    });
    h.push('</tbody></table><p class="p-unit">単位：万円。「△」は赤字。</p></section>');

    h.push('<section class="p-sec p-notes"><h2>計算上の前提</h2><ul>'
      + '<li>本結果は入力条件による概算です。将来の資産額・運用収益を保証するものではありません。</li>'
      + '<li>税・社会保険料の個別計算は行っていません。給与減額型DCの節税・社会保険料軽減効果は概算に未反映です。</li>'
      + '<li>DC掛金は増額分のみを手取り減少として扱い、現在の手取りは既存掛金控除後とみなしています。</li>'
      + '<li>運用利回り' + plan.returnRate + '%は仮定のシナリオで、実際の成果ではありません。</li>'
      + (inp.course === 'B' ? '<li>公的年金は仮の加入歴・年収を置いた参考推計で、実際の受給見込額ではありません。</li>' : '')
      + '<li>教育費は2026-v22収録の費用モデルによる概算で、実際の学校費用とは異なります。</li>'
      + '<li>住宅ローン・保険・介護・相続・退職金課税等は含めていません。</li>'
      + '</ul></section>');

    if (memo && memo.trim()) {
      h.push('<section class="p-sec"><h2>FPに相談したいこと</h2><p class="p-memo">' + esc(memo.trim()).replace(/\n/g, '<br>') + '</p></section>');
    }
    h.push('<footer class="p-foot">かんたん家計シミュレーター（提案用デモ）｜参考資料版 ' + D.meta.id + '｜家計情報を含みます。取扱いにご注意ください。</footer>');
    h.push('</div>');
    return h.join('');
  }

  global.HCS_REPORT = {
    buildMarkdown: buildMarkdown,
    buildJson: buildJson,
    buildPrintHtml: buildPrintHtml,
    downloadMarkdown: downloadMarkdown,
    downloadJson: downloadJson
  };
})(window);
