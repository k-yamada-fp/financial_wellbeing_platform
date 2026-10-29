/* =============================================================
   ui.js — 画面制御（表示と計算の分離：計算は calc-engine.js）
   ============================================================= */
(function (global) {
  'use strict';

  var C = global.HCS_CALC, D = global.HCS_DATA, CH = global.HCS_CHART, R = global.HCS_REPORT;

  var state = {
    course: null,
    kids: [{ age: 6, track: 'allPublic', university: 'undecided', living: 'home' }],
    input: null,
    plan: { dcMonthly: 0, nisaMonthly: 0, returnRate: 5 },
    result: null,
    chartVisible: { cash: true, invest: true, dc: true },
    showAllRows: false,
    hoverRow: -1
  };

  /* ---------------- ユーティリティ ---------------- */
  function $(id) { return document.getElementById(id); }
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function n(v) { return Math.round(v).toLocaleString('ja-JP'); }
  function man(v) { return Math.round(v / 10000); }          /* 円 → 万円(数値) */
  function yen(v) { return Math.round(v / 1000) * 1000; }
  function num(id) { var v = parseFloat($(id).value); return isFinite(v) ? v : 0; }
  function clampNum(v, a, b) { return Math.min(b, Math.max(a, v)); }
  function signedMan(v) {
    var m = Math.round(v / 10000);
    if (m === 0) return '±0';
    return (m > 0 ? '＋' : '−') + n(Math.abs(m));
  }

  function show(screenId) {
    qsa('.screen').forEach(function (s) { s.classList.remove('is-active'); s.hidden = true; });
    var el = $(screenId);
    el.hidden = false;
    /* 強制的に再フローさせてアニメーションを再生 */
    void el.offsetWidth;
    el.classList.add('is-active');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* =========================================================
     画面1：コース選択
     ========================================================= */
  function initStart() {
    qsa('.course-card').forEach(function (card) {
      card.addEventListener('click', function () {
        qsa('.course-card').forEach(function (c) { c.classList.remove('is-selected'); });
        card.classList.add('is-selected');
        state.course = card.dataset.course;
        $('btnStart').disabled = false;
        var input = qs('input', card);
        if (input) input.checked = true;
      });
    });

    $('btnStart').addEventListener('click', function () {
      if (!state.course) return;
      enterInput();
      if (state.course === 'B') {
        state.plan.dcMonthly = 0;
      }
    });

    $('brandHome').addEventListener('click', function (e) {
      e.preventDefault();
      if (state.result) { show('screenResult'); }
      else if (state.course) { show('screenInput'); }
      else { show('screenStart'); }
    });

    $('btnRestart').addEventListener('click', function () {
      state.result = null;
      state.course = null;
      qsa('.course-card').forEach(function (c) { c.classList.remove('is-selected'); });
      $('btnStart').disabled = true;
      $('btnRestart').hidden = true;
      show('screenStart');
    });
  }

  function enterInput() {
    $('btnRestart').hidden = false;
    $('resEyebrow').textContent = state.course === 'B' ? 'コースB｜90歳まで' : 'コースA｜65歳まで';
    $('pensionSection').hidden = state.course !== 'B';
    $('pensionCard').hidden = state.course !== 'B';
    show('screenInput');
    syncSpouseFields();
    renderKids();
    renderEduKids();
    updateRail();
  }

  /* =========================================================
     画面2：入力
     ========================================================= */
  function initInput() {
    /* 配偶者 有無 */
    qsa('#segSpouse .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('#segSpouse .seg-btn').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        syncSpouseFields();
        updateRail();
      });
    });

    /* 塾・習い事 */
    qsa('#segActivity .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('#segActivity .seg-btn').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        renderEduKids();
        updateRail();
      });
    });

    /* 子どもの追加 */
    $('btnAddKid').addEventListener('click', function () {
      if (state.kids.length >= 4) return;
      state.kids.push({ age: 0, track: 'allPublic', university: 'undecided', living: 'home' });
      renderKids(); renderEduKids(); updateRail();
    });

    /* 数値入力の再計算 */
    ['headAge', 'spouseAge', 'headMonthlyNet', 'spouseMonthlyNet', 'headBonus', 'spouseBonus',
      'livingMonthly', 'annualSpecial', 'cash', 'invest', 'dcExisting', 'existingDCMonthly',
      'currentNisaMonthly', 'postRetireLiving', 'pensionDeduction', 'headGross', 'spouseGross',
      'pensionOverride'].forEach(function (id) {
        var el = $(id);
        if (!el) return;
        el.addEventListener('input', updateRail);
        el.addEventListener('change', updateRail);
      });

    $('headWork').addEventListener('change', updateRail);
    $('spouseWork').addEventListener('change', updateRail);
    $('educationInLiving').addEventListener('change', function () { renderEduKids(); updateRail(); });

    $('linkAutoGross').addEventListener('click', function (e) {
      e.preventDefault();
      var net = (num('headMonthlyNet') * 12 + num('headBonus')) * 10000;
      $('headGross').value = Math.round(C.grossFromNet(net) / 10000 / 10) * 10;
      if (hasSpouse()) {
        var snet = (num('spouseMonthlyNet') * 12 + num('spouseBonus')) * 10000;
        $('spouseGross').value = Math.round(C.grossFromNet(snet) / 10000 / 10) * 10;
      }
      updateRail();
    });

    $('btnBackToStart').addEventListener('click', function () { show('screenStart'); });
    $('btnCalc').addEventListener('click', runCalc);
    $('btnCalcRail').addEventListener('click', runCalc);

    /* Enterキーで試算 */
    $('screenInput').addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target.tagName === 'INPUT') { e.preventDefault(); runCalc(); }
    });
  }

  function hasSpouse() {
    var on = qs('#segSpouse .seg-btn.is-on');
    return on && on.dataset.val === '1';
  }
  function activityLevel() {
    var on = qs('#segActivity .seg-btn.is-on');
    return on ? on.dataset.val : 'standard';
  }

  function syncSpouseFields() {
    var on = hasSpouse();
    ['spouseAgeField', 'spouseIncomeField', 'spouseBonusField', 'spouseWorkField', 'spouseGrossField'].forEach(function (id) {
      var el = $(id); if (el) el.style.display = on ? '' : 'none';
    });
  }

  /* --- 子どもの行 --- */
  function renderKids() {
    var host = $('kidList');
    host.innerHTML = '';
    if (!state.kids.length) {
      host.innerHTML = '<div class="kid-empty">お子さまがいない場合は、このままで構いません。</div>';
      return;
    }
    state.kids.forEach(function (k, i) {
      var row = document.createElement('div');
      row.className = 'kid-row';
      row.innerHTML =
        '<span class="kid-name">第' + (i + 1) + '子</span>'
        + '<span class="kid-age"><input type="number" step="1" value="' + k.age + '" data-idx="' + i + '" aria-label="第' + (i + 1) + '子の年齢"><span class="unit">歳</span></span>'
        + '<button type="button" class="kid-del" data-idx="' + i + '" aria-label="第' + (i + 1) + '子を削除">×</button>';
      host.appendChild(row);
    });

    qsa('.kid-age input', host).forEach(function (inp) {
      inp.addEventListener('input', function () {
        var i = +inp.dataset.idx;
        var v = parseInt(inp.value, 10);
        state.kids[i].age = isFinite(v) ? clampNum(v, -2, 30) : 0;
        renderEduKids();
        updateRail();
      });
    });
    qsa('.kid-del', host).forEach(function (b) {
      b.addEventListener('click', function () {
        state.kids.splice(+b.dataset.idx, 1);
        renderKids(); renderEduKids(); updateRail();
      });
    });
  }

  /* --- 教育費の進路 --- */
  function renderEduKids() {
    var host = $('eduKidList');
    host.innerHTML = '';
    if (!state.kids.length) {
      host.innerHTML = '<div class="kid-empty">お子さまを追加すると、進路（幼〜高・大学）を選べます。</div>';
      return;
    }
    var opts = { activityLevel: activityLevel(), includeHomeLiving: false };

    state.kids.forEach(function (k, i) {
      var life = C.childLifetimeCost(k, opts);
      var stage = C.stageOfAge(k.age);
      var box = document.createElement('div');
      box.className = 'edu-kid';

      var trackOpts = Object.keys(C.TRACKS).map(function (key) {
        return '<option value="' + key + '"' + (k.track === key ? ' selected' : '') + '>' + C.TRACKS[key].label + '</option>';
      }).join('');

      var uniOpts = Object.keys(C.UNI).map(function (key) {
        return '<option value="' + key + '"' + (k.university === key ? ' selected' : '') + '>' + C.UNI[key].label + '</option>';
      }).join('');

      box.innerHTML =
        '<div class="edu-kid-head">'
        + '<strong>第' + (i + 1) + '子</strong>'
        + '<span class="chip">' + (k.age < 0 ? '誕生予定' : k.age + '歳／' + C.STAGE_LABEL[stage] + '') + '</span>'
        + '<span class="edu-kid-cost">学校教育費の目安 <b>' + n(man(life)) + '</b> 万円</span>'
        + '</div>'
        + '<div class="edu-kid-body">'
        + '<label class="field"><span class="field-label">幼稚園〜高校の進路</span>'
        + '<select data-kind="track" data-idx="' + i + '">' + trackOpts + '</select></label>'
        + '<label class="field"><span class="field-label">大学</span>'
        + '<select data-kind="university" data-idx="' + i + '">' + uniOpts + '</select></label>'
        + (k.university !== 'none'
          ? '<label class="field"><span class="field-label">大学の通学</span>'
          + '<select data-kind="living" data-idx="' + i + '">'
          + '<option value="home"' + (k.living === 'home' ? ' selected' : '') + '>自宅通学</option>'
          + '<option value="away"' + (k.living === 'away' ? ' selected' : '') + '>下宿・一人暮らし</option>'
          + '</select></label>'
          : '')
        + '</div>';

      host.appendChild(box);
    });

    qsa('select', host).forEach(function (sel) {
      sel.addEventListener('change', function () {
        var i = +sel.dataset.idx, kind = sel.dataset.kind;
        state.kids[i][kind] = sel.value;
        if (kind === 'university') renderEduKids();
        updateRail();
      });
    });
  }

  /* --- 右レール --- */
  function updateRail() {
    var sp = hasSpouse();
    var headNet = num('headMonthlyNet') * 12 + num('headBonus');
    var spouseNet = sp ? (num('spouseMonthlyNet') * 12 + num('spouseBonus')) : 0;
    var income = headNet + spouseNet;
    var living = num('livingMonthly') * 12 + num('annualSpecial');

    /* 教育費：現在年齢のぶんだけ年額換算（目安） */
    var eduNow = 0;
    if (!$('educationInLiving').checked) {
      state.kids.forEach(function (k) {
        eduNow += C.childYearCost(k, Math.max(0, k.age), { activityLevel: activityLevel(), includeHomeLiving: false }).total;
      });
    }
    var flow = income - living - man(eduNow);

    var rows = [
      ['本人', num('headAge') + '歳'],
      ['世帯の手取り年収', n(Math.round(income)) + '万円'],
      ['毎月の生活費', num('livingMonthly') + '万円'],
      ['子ども', state.kids.length ? state.kids.length + '人' : 'なし']
    ];
    if (sp) rows.splice(1, 0, ['配偶者', num('spouseAge') + '歳']);

    $('railSummary').innerHTML = rows.map(function (r) {
      return '<div><dt>' + r[0] + '</dt><dd>' + r[1] + '</dd></div>';
    }).join('');

    $('railFlow').innerHTML =
      '<div class="rf-row"><span>収入（年）</span><span>' + n(Math.round(income)) + '万円</span></div>'
      + '<div class="rf-row"><span>支出（年）</span><span>' + n(Math.round(living)) + '万円</span></div>'
      + (eduNow > 0 ? '<div class="rf-row"><span>教育費（年・目安）</span><span>' + n(man(eduNow)) + '万円</span></div>' : '')
      + '<div class="rf-net' + (flow < 0 ? ' is-neg' : '') + '">'
      + (flow >= 0 ? '＋' : '−') + n(Math.abs(Math.round(flow))) + '<small style="font-size:12px;font-weight:600;"> 万円／年の余剰</small></div>'
      + (flow < 0 ? '<p class="rail-note" style="color:#FFB4A0;">このままだと毎年不足します。結果画面で積立額を調整できます。</p>' : '');
  }

  /* =========================================================
     試算
     ========================================================= */
  function collectInput() {
    var sp = hasSpouse();
    var eduInLiving = $('educationInLiving').checked;
    return {
      course: state.course,
      headAge: Math.round(num('headAge')) || 38,
      hasSpouse: sp,
      spouseAge: Math.round(num('spouseAge')) || 36,
      children: state.kids.map(function (k) {
        return { age: k.age, track: k.track, university: k.university, living: k.living };
      }),
      headMonthlyNet: num('headMonthlyNet'),
      headBonus: num('headBonus'),
      spouseMonthlyNet: sp ? num('spouseMonthlyNet') : 0,
      spouseBonus: sp ? num('spouseBonus') : 0,
      livingMonthly: num('livingMonthly'),
      postRetireLiving: num('postRetireLiving') || D.defaults.postRetireLiving,
      annualSpecial: num('annualSpecial'),
      cash: num('cash'),
      invest: num('invest'),
      dcExisting: num('dcExisting'),
      existingDCMonthly: num('existingDCMonthly'),
      currentNisaMonthly: num('currentNisaMonthly'),
      educationInLiving: eduInLiving,
      activityLevel: activityLevel(),
      includeHomeLiving: false,
      headWork: $('headWork').value,
      headGross: num('headGross'),
      spouseWork: $('spouseWork').value,
      spouseGross: sp ? num('spouseGross') : 0,
      pension: {
        deductionRate: num('pensionDeduction'),
        headOverride: num('pensionOverride')
      }
    };
  }

  function runCalc() {
    state.input = collectInput();

    /* 入力チェック（軽め） */
    var warns = [];
    if (state.input.headAge >= 65) warns.push('本人年齢が65歳以上です。退職後だけの試算になります。');
    if (state.input.livingMonthly <= 0) warns.push('毎月の生活費が0円です。入力内容をご確認ください。');
    if (state.input.headMonthlyNet <= 0 && state.input.spouseMonthlyNet <= 0) warns.push('手取り月収が未入力です。');

    /* プランの初期値を現状に合わせる */
    state.plan.dcMonthly = state.input.existingDCMonthly;
    state.plan.nisaMonthly = state.input.currentNisaMonthly;
    if (state.plan.returnRate == null) state.plan.returnRate = 5;

    state.result = C.run(state.input, state.plan);
    state.noticeWarns = warns;
    state.chartVisible = { cash: true, invest: true, dc: true };
    state.showAllRows = false;
    renderResult();
    show('screenResult');
    $('btnRestart').hidden = false;
  }

  /* =========================================================
     画面3：結果
     ========================================================= */
  function initResult() {
    /* スライダー */
    $('rangeDc').addEventListener('input', function () {
      state.plan.dcMonthly = parseFloat(this.value);
      $('outDc').textContent = this.value + ' 万円';
      recompute();
    });
    $('rangeNisa').addEventListener('input', function () {
      state.plan.nisaMonthly = parseFloat(this.value);
      $('outNisa').textContent = parseFloat(this.value).toFixed(1) + ' 万円';
      recompute();
    });
    qsa('#segReturn .seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        qsa('#segReturn .seg-btn').forEach(function (x) { x.classList.remove('is-on'); });
        b.classList.add('is-on');
        state.plan.returnRate = parseFloat(b.dataset.val);
        recompute();
      });
    });

    $('btnEditInput').addEventListener('click', function () { show('screenInput'); updateRail(); });
    $('btnPrint').addEventListener('click', doPrint);
    $('btnMd').addEventListener('click', function () { R.downloadMarkdown(state.result, $('consultMemo').value); });
    $('btnMd2').addEventListener('click', function () { R.downloadMarkdown(state.result, $('consultMemo').value); });
    $('btnJson').addEventListener('click', function () { R.downloadJson(state.result, $('consultMemo').value); });

    $('btnToggleTable').addEventListener('click', function () {
      state.showAllRows = !state.showAllRows;
      this.textContent = state.showAllRows ? '節目だけ表示' : 'すべて表示';
      renderTable();
    });

    /* グラフの再描画（リサイズ） */
    var t = null;
    window.addEventListener('resize', function () {
      clearTimeout(t);
      t = setTimeout(function () {
        if (state.result && !$('screenResult').hidden) { drawCharts(); }
      }, 180);
    });
  }

  function recompute() {
    state.result = C.run(state.input, state.plan);
    renderResult(true);
  }

  function renderResult(isUpdate) {
    var r = state.result;
    var after = r.planResult, before = r.baseline;

    if (!isUpdate) {
      $('consultMemo').value = '';
      $('rangeDc').value = state.plan.dcMonthly;
      $('outDc').textContent = state.plan.dcMonthly.toFixed(1) + ' 万円';
      $('rangeNisa').value = state.plan.nisaMonthly;
      $('outNisa').textContent = state.plan.nisaMonthly.toFixed(1) + ' 万円';
      qsa('#segReturn .seg-btn').forEach(function (b) {
        b.classList.toggle('is-on', parseFloat(b.dataset.val) === state.plan.returnRate);
      });
      $('resTitle').textContent = state.course === 'B'
        ? 'この条件での家計と老後資金'
        : 'この条件での家計と資産形成';
    }

    renderAlerts();
    renderKpis();
    renderLegend();
    renderBreakdown();
    renderControlNotes();
    renderCompareMini();
    renderEduSummary();
    if (state.course === 'B') renderPension();
    renderTable();
    renderAssumptions();
    drawCharts();
  }

  /* --- アラート --- */
  function renderAlerts() {
    var host = $('alertArea');
    var parts = [];
    var r = state.result, after = r.planResult, inp = r.input;

    if (state.noticeWarns && state.noticeWarns.length) {
      parts.push('<div class="alert alert-info">' + warnIcon() + '<div>' + state.noticeWarns.join('<br>') + '</div></div>');
    }

    if (after.summary.shortfallTotal > 0) {
      var sf = after.rows.filter(function (x) { return x.shortfall > 0; });
      parts.push('<div class="alert alert-warn">' + warnIcon() + '<div><strong>この条件では、'
        + (sf.length ? sf[0].age + '歳〜' + sf[sf.length - 1].age + '歳の期間' : '試算期間中')
        + 'に資金が不足します（不足額 合計 約' + n(man(after.summary.shortfallTotal)) + '万円）。</strong><br>'
        + '生活費の見直し、積立額の調整、退職後の暮らし方などを一緒に確認しましょう。</div></div>');
    }

    if (after.summary.educationTotal > 0 && inp.educationInLiving) {
      parts.push('<div class="alert alert-info">' + infoIcon() + '<div>教育費は「生活費に含まれている」設定のため、家計収支では重複計上していません。教育費の目安は別途表示しています。</div></div>');
    }

    if (state.plan.dcMonthly > 0 && state.plan.dcMonthly > 5.5) {
      parts.push('<div class="alert alert-warn">' + warnIcon() + '<div>企業型DCの掛金が5.5万円/月を超えています。実際の上限は企業の制度（他の退職給付制度の有無など）によって異なります。</div></div>');
    }

    host.innerHTML = parts.join('');
  }

  function warnIcon() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 2.4L14.4 13.4H1.6L8 2.4z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/><path d="M8 6.6v3.1M8 11.6v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }
  function infoIcon() {
    return '<svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="6.4" stroke="currentColor" stroke-width="1.4"/><path d="M8 7.2v4M8 4.9v.1" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>';
  }

  /* --- KPI --- */
  function renderKpis() {
    var r = state.result;
    var after = r.planResult, before = r.baseline;
    var a65 = after.summary.at65, b65 = before.summary.at65;

    var delta = a65.total - b65.total;
    var heroSub = '預貯金 ' + n(man(a65.cash)) + '／運用 ' + n(man(a65.invest)) + '／DC ' + n(man(a65.dc)) + '（万円）';

    var html = '';

    /* ヒーロー：65歳 */
    html += '<div class="kpi is-hero">'
      + '<div class="kpi-label">' + (state.course === 'B' ? '65歳時点' : '65歳時点') + 'の金融資産（企業型DC込み）</div>'
      + '<div class="kpi-value">' + n(man(a65.total)) + '<span class="u">万円</span></div>'
      + '<div class="kpi-sub">' + heroSub + '</div>'
      + '<span class="kpi-delta ' + (Math.abs(delta) < 10000 ? 'flat' : 'up') + '">'
      + (delta === 0 ? '現状と同じ' : '現状のままより ' + signedMan(delta) + '万円')
      + '</span>'
      + '<div class="kpi-split">'
      + '<div><span>現状のまま</span><b>' + n(man(b65.total)) + '万円</b></div>'
      + '<div><span>積立を実行</span><b>' + n(man(a65.total)) + '万円</b></div>'
      + '</div>'
      + '</div>';

    /* 90歳（B） */
    if (after.summary.at90) {
      var a90 = after.summary.at90;
      html += '<div class="kpi">'
        + '<div class="kpi-label">90歳時点の金融資産</div>'
        + '<div class="kpi-value">' + n(man(a90.total)) + '<span class="u">万円</span></div>'
        + '<div class="kpi-sub">' + (a90.total < 0 ? '資産が尽きている想定' : '取り崩し後の残高') + '</div>'
        + '<div class="kpi-split"><div><span>現状のまま</span><b>' + n(man(before.summary.at90.total)) + '万円</b></div></div>'
        + '</div>';
    }

    /* 年間収支 */
    var y0 = after.rows[0];
    var flowNow = y0 ? y0.flow : 0;
    html += '<div class="kpi">'
      + '<div class="kpi-label">今年の収支（概算）</div>'
      + '<div class="kpi-value" style="color:' + (flowNow < 0 ? 'var(--danger)' : 'var(--ink)') + '">'
      + (flowNow < 0 ? '−' : '＋') + n(Math.abs(man(flowNow))) + '<span class="u">万円</span></div>'
      + '<div class="kpi-sub">' + (flowNow < 0 ? '毎年不足しています' : '毎年このペースで貯まります') + '</div>'
      + '</div>';

    /* 教育費 */
    html += '<div class="kpi">'
      + '<div class="kpi-label">教育費の合計（試算期間）</div>'
      + '<div class="kpi-value">' + n(man(after.summary.educationTotal)) + '<span class="u">万円</span></div>'
      + '<div class="kpi-sub">' + eduPeakText(after) + '</div>'
      + '</div>';

    $('kpiRow').innerHTML = html;
    $('kpiRow').style.gridTemplateColumns = after.summary.at90 ? '' : '';
  }

  function eduPeakText(res) {
    var peak = 0, peakAge = null;
    res.rows.forEach(function (row) {
      if (row.education > peak) { peak = row.education; peakAge = row.age; }
    });
    if (!peak) return '教育費の計上なし';
    return 'ピーク：' + peakAge + '歳時に年 ' + n(man(peak)) + '万円';
  }

  /* --- 凡例 --- */
  function renderLegend() {
    var items = [
      { key: 'cash', label: '預貯金', color: CH.COLOR.cash },
      { key: 'invest', label: 'NISA等の運用資産', color: CH.COLOR.invest },
      { key: 'dc', label: '企業型DC', color: CH.COLOR.dc }
    ];
    var html = items.map(function (it) {
      return '<span class="legend-item' + (state.chartVisible[it.key] ? '' : ' is-off') + '" data-key="' + it.key + '">'
        + '<span class="legend-swatch" style="background:' + it.color + '"></span>' + it.label + '</span>';
    }).join('');
    html += '<span class="legend-item"><span class="legend-line"></span>現状のまま（合計）</span>';
    $('chartLegend').innerHTML = html;

    qsa('#chartLegend .legend-item[data-key]').forEach(function (el) {
      el.addEventListener('click', function () {
        var k = el.dataset.key;
        state.chartVisible[k] = !state.chartVisible[k];
        renderLegend();
        drawCharts();
      });
    });
  }

  /* --- 内訳チップ --- */
  function renderBreakdown() {
    var r = state.result, a65 = r.planResult.summary.at65;
    var items = [
      { k: '預貯金（65歳）', v: a65.cash, cls: 'dot-cash' },
      { k: 'NISA等（65歳）', v: a65.invest, cls: 'dot-invest' },
      { k: '企業型DC（65歳）', v: a65.dc, cls: 'dot-dc' }
    ];
    $('breakdownRow').innerHTML = items.map(function (it) {
      return '<div class="bd-chip"><div class="bd-k"><i class="dot ' + it.cls + '"></i>' + it.k + '</div>'
        + '<div class="bd-v">' + n(man(it.v)) + '<small>万円</small></div></div>';
    }).join('');
  }

  /* --- 操作パネルの注記 --- */
  function renderControlNotes() {
    var inp = state.input;
    var notes = [];
    var diff = state.plan.dcMonthly - inp.existingDCMonthly;
    if (state.plan.dcMonthly > 0) {
      notes.push('給与減額型DC：掛金 ' + state.plan.dcMonthly.toFixed(1) + '万円/月 は手取りから差し引かれ、DC資産に積み上がります。'
        + (Math.abs(diff) > 0.001 && inp.existingDCMonthly > 0
          ? '現在の掛金' + inp.existingDCMonthly + '万円との差額 ' + (diff > 0 ? '+' : '') + diff.toFixed(1) + '万円/月 分だけ手取りが変わると仮定。'
          : ''));
      notes.push('税・社会保険料の軽減効果は概算に含めていません。実際の手取り減少はこれより小さい可能性があります。');
    }
    $('dcNote').innerHTML = notes.length ? notes.join('<br>') : '';
  }

  /* --- 比較ミニ --- */
  function renderCompareMini() {
    var r = state.result;
    var a65 = r.planResult.summary.at65, b65 = r.baseline.summary.at65;
    var rows = [
      ['65歳 合計の差', a65.total - b65.total, true],
      ['内 預貯金（手元資金）', a65.cash - b65.cash, true],
      ['内 運用資産', a65.invest - b65.invest, true],
      ['内 企業型DC', a65.dc - b65.dc, true]
    ];
    var html = rows.map(function (x) {
      var v = x[1];
      return '<div class="cm-row"><span>' + x[0] + '</span><b class="' + (v > 0 ? 'pos' : v < 0 ? 'neg' : '') + '">'
        + signedMan(v) + '万円</b></div>';
    }).join('');

    if (r.planResult.summary.at90) {
      html += '<div class="cm-row" style="border-top:1px solid var(--line);margin-top:6px;padding-top:9px;">'
        + '<span>90歳 合計の差</span><b class="' + (r.planResult.summary.at90.total - r.baseline.summary.at90.total > 0 ? 'pos' : 'neg') + '">'
        + signedMan(r.planResult.summary.at90.total - r.baseline.summary.at90.total) + '万円</b></div>';
    }
    $('compareMini').innerHTML = html;
  }

  /* --- 教育費サマリー --- */
  function renderEduSummary() {
    var r = state.result, inp = r.input;
    var host = $('eduSummary');
    $('eduTotalHint').textContent = '試算期間の合計 約' + n(man(r.planResult.summary.educationTotal)) + '万円';

    if (!inp.children.length) {
      host.innerHTML = '<div class="edu-item"><div class="ei-name">お子さまの入力なし</div>'
        + '<div class="ei-val">—</div><div class="ei-meta">教育費は計上していません。</div></div>';
      return;
    }

    var html = inp.children.map(function (k, i) {
      var life = C.childLifetimeCost(k, { activityLevel: inp.activityLevel, includeHomeLiving: false });
      var uniText = (C.UNI[k.university] || {}).label + (k.university !== 'none' ? '／' + (k.living === 'away' ? '下宿' : '自宅') : '');
      return '<div class="edu-item"><div class="ei-name">第' + (i + 1) + '子（' + k.age + '歳）</div>'
        + '<div class="ei-val">' + n(man(life)) + '<small style="font-size:11px;color:var(--ink-3);"> 万円</small></div>'
        + '<div class="ei-meta">' + (C.TRACKS[k.track] || {}).label + '／' + uniText + '</div></div>';
    }).join('');

    /* 未定の場合の比較 */
    var undecided = inp.children.some(function (k) { return k.university === 'undecided'; });
    if (undecided) {
      var cmp = r.eduComparison;
      html += '<div class="edu-item" style="background:var(--blue-050);border-color:var(--blue-100);grid-column:1/-1;">'
        + '<div class="ei-name">大学が未定の場合の目安（第1子の学校教育費・塾なし）</div>'
        + '<div class="ei-meta" style="margin-top:6px;font-size:12px;color:var(--ink-2);">'
        + '国立 <b>' + n(man(cmp.national)) + '万円</b>　／　私立文系 <b>' + n(man(cmp.humanities)) + '万円</b>　／　私立理系 <b>'
        + n(man(cmp.science)) + '万円</b>　（試算では国立を仮置きしています）</div></div>';
    }

    host.innerHTML = html;
  }

  /* --- 年金 --- */
  function renderPension() {
    var r = state.result, inp = r.input;
    var p = r.planResult.pension;
    var html = '';

    function box(title, est, note) {
      if (!est) return '';
      return '<div class="pen-box"><h5>' + title + '</h5>'
        + '<div class="pen-line"><span>老齢基礎年金</span><b>' + n(man(est.basic)) + '万円</b></div>'
        + '<div class="pen-line"><span>報酬比例部分</span><b>' + n(man(est.earnings)) + '万円</b></div>'
        + '<div class="pen-line total"><span>年額（額面）</span><b>' + n(man(est.annual)) + '万円</b></div>'
        + '<div class="pen-line"><span>月額の目安</span><b>約' + (est.annual / 12 / 10000).toFixed(1) + '万円</b></div>'
        + '<div class="ei-meta" style="font-size:10.5px;color:var(--ink-3);margin-top:6px;">' + note + '</div>'
        + '</div>';
    }

    html += '<div class="pen-grid">';
    html += box('本人', p.head,
      (p.head.overridden ? '入力された確認済み概算額を使用。' : '仮の加入歴：' + p.head.workStyle.label + '／平均標準報酬 約' + n(p.head.avgStandardMonthly / 10000) + '万円'));
    if (inp.hasSpouse && p.spouse) {
      html += box('配偶者', p.spouse,
        '仮の加入歴：' + p.spouse.workStyle.label + '／平均標準報酬 約' + n(p.spouse.avgStandardMonthly / 10000) + '万円');
    }
    html += '</div>';

    var grossTotal = (p.head ? p.head.annual : 0) + (p.spouse ? p.spouse.annual : 0);
    html += '<p class="ass-note" style="margin-top:14px;">'
      + '世帯の年金（額面）年額 約<b>' + n(man(grossTotal)) + '万円</b>　→　天引き（税・社会保険）'
      + inp.pension.deductionRate + '%を見込むと、手取り年額 約<b>' + n(man(grossTotal * (1 - inp.pension.deductionRate / 100))) + '万円</b>。<br>'
      + '老齢基礎年金は2026年度額（満額 ' + n(D.pension.basicAnnual) + '円／年）、報酬比例は2003年4月以降の係数 '
      + D.pension.earningsCoefficient + ' を用いた<b>参考推計</b>です。実際の加入歴・免除期間等は反映していないため、'
      + '受給見込額として断定できません。ねんきん定期便等でご確認ください。</p>';

    $('pensionBody').innerHTML = html;
  }

  /* --- 年次テーブル --- */
  function renderTable() {
    var r = state.result, after = r.planResult, rows = after.rows;
    var head = '<thead><tr><th>年齢</th><th>収入</th><th>支出</th><th>収支</th><th>教育費</th>'
      + '<th>預貯金</th><th>運用資産</th><th>企業型DC</th><th>合計</th></tr></thead>';
    var body = rows.map(function (x) {
      var isMilestone = (x.age % 5 === 0) || x.age === 65 || x.age === 90 || x.age === r.input.headAge;
      var hide = !state.showAllRows && !isMilestone;
      var cls = (isMilestone ? 'milestone ' : '') + (hide ? 'is-hidden' : '');
      return '<tr class="' + cls.trim() + '"><td>' + x.age + '歳</td>'
        + '<td>' + n(man(x.income)) + '</td>'
        + '<td>' + n(man(x.outflow)) + '</td>'
        + '<td' + (x.flow < 0 ? ' class="neg"' : '') + '>' + (x.flow < 0 ? '△' : '') + n(Math.abs(man(x.flow))) + '</td>'
        + '<td>' + (x.education > 0 ? n(man(x.education)) : '—') + '</td>'
        + '<td>' + n(man(x.closeBal.cash)) + '</td>'
        + '<td>' + n(man(x.closeBal.invest)) + '</td>'
        + '<td>' + n(man(x.closeBal.dc)) + '</td>'
        + '<td><b>' + n(man(x.total)) + '</b></td></tr>';
    }).join('');
    $('yearTable').innerHTML = head + '<tbody>' + body + '</tbody>';
  }

  /* --- 前提 --- */
  function renderAssumptions() {
    var r = state.result, inp = r.input, after = r.planResult;
    var sp = inp.hasSpouse;
    var rows = [
      ['コース', state.course === 'B' ? 'B：90歳まで' : 'A：65歳まで'],
      ['退職年齢', D.defaults.retirementAge + '歳（モデル初期値）'],
      ['積立（DC）', state.plan.dcMonthly.toFixed(1) + '万円/月（給与減額型）'],
      ['積立（NISA等）', state.plan.nisaMonthly.toFixed(1) + '万円/月'],
      ['運用利回り', state.plan.returnRate + '%／年（仮定）'],
      ['預貯金利率', D.defaults.rates.cash + '%／年'],
      ['生活費上昇率', D.defaults.rates.living + '%／年'],
      ['運用収益の計上', '各年の年初残高に対して計算（保守的）'],
      ['DCの引出し', '65歳以降のみ取崩し対象'],
      ['教育費', '2026-v22 費用モデル／在学年数のみ計上']
    ];
    if (state.course === 'B') {
      rows.push(['年金の受給開始', D.pension.standardClaimAge + '歳']);
      rows.push(['年金の天引き', inp.pension.deductionRate + '%（仮定）']);
      rows.push(['退職後の生活費', inp.postRetireLiving + '万円/月']);
    }

    var html = '<dl class="ass-list">' + rows.map(function (x) {
      return '<div class="ass-row"><dt>' + x[0] + '</dt><dd>' + x[1] + '</dd></div>';
    }).join('') + '</dl>';

    html += '<div class="ass-note"><strong>この試算で反映していないもの</strong><ul>'
      + '<li>税・社会保険料の個別計算（給与減額型DCの節税・社会保険料軽減効果も未反映）</li>'
      + '<li>住宅ローン、保険料の詳細、介護費、相続、退職金・DC受給時の課税</li>'
      + '<li>児童手当・高校支援金・大学減免などの公的支援、こどもNISA</li>'
      + '<li>NISA枠の厳密判定（年間' + n(D.limits.nisaAnnual) + '円）や非課税判定</li>'
      + '</ul>'
      + '<strong style="display:inline-block;margin-top:10px;">データの出所</strong><br>'
      + '教育費・年金・初期値は「' + D.meta.id + '」の収録値のうち簡易版で使用する分を独立コピーしたものです。'
      + '制度の適用可否や法令適合を監査したデータではありません。'
      + '企業型DCの月' + n(D.limits.dcMonthlyFrom202612) + '円は2026年12月以降の制度上限で、現行上限ではありません。'
      + '</div>';

    $('assumptionBody').innerHTML = html;
  }

  /* --- グラフ --- */
  function drawCharts() {
    var r = state.result;
    var after = r.planResult, before = r.baseline;
    var ages = after.rows.map(function (x) { return x.age; });

    var series = [
      { key: 'cash', color: CH.COLOR.cash, values: after.rows.map(function (x) { return man(x.closeBal.cash); }) },
      { key: 'invest', color: CH.COLOR.invest, values: after.rows.map(function (x) { return man(x.closeBal.invest); }) },
      { key: 'dc', color: CH.COLOR.dc, values: after.rows.map(function (x) { return man(x.closeBal.dc); }) }
    ];
    var baseline = before.rows.map(function (x) { return man(x.total); });

    CH.renderStacked($('mainChart'), {
      ages: ages,
      series: series,
      visible: state.chartVisible,
      baseline: baseline,
      showBaseline: true,
      onHover: function (i) {
        var tip = $('chartTooltip');
        if (i < 0) { tip.hidden = true; return; }
        var row = after.rows[i], brow = before.rows[i];
        tip.hidden = false;
        tip.innerHTML = '<div class="tt-age">' + row.age + '歳 <small>' + row.calendarYear + '年</small></div>'
          + (state.chartVisible.cash ? ttRow('預貯金', row.closeBal.cash, CH.COLOR.cash) : '')
          + (state.chartVisible.invest ? ttRow('運用資産', row.closeBal.invest, CH.COLOR.invest) : '')
          + (state.chartVisible.dc ? ttRow('企業型DC', row.closeBal.dc, CH.COLOR.dc) : '')
          + '<div class="tt-sep"></div>'
          + '<div class="tt-row"><span>合計</span><b>' + n(man(row.total)) + '万円</b></div>'
          + '<div class="tt-row"><span>現状のまま</span><b>' + n(man(brow.total)) + '万円</b></div>'
          + (row.education > 0 ? '<div class="tt-sep"></div><div class="tt-row"><span>教育費（年）</span><b>' + n(man(row.education)) + '万円</b></div>' : '');
      }
    });

    /* 教育費バー */
    var eduVals = after.rows.map(function (x) { return man(x.education); });
    CH.renderBars($('eduChart'), { ages: ages, values: eduVals, color: CH.COLOR.invest });
  }

  function ttRow(label, v, color) {
    return '<div class="tt-row"><span><i style="width:7px;height:7px;border-radius:2px;background:' + color + ';display:inline-block"></i>'
      + label + '</span><b>' + n(man(v)) + '万円</b></div>';
  }

  /* =========================================================
     印刷
     ========================================================= */
  function doPrint() {
    var sheet = $('printSheet');
    sheet.innerHTML = R.buildPrintHtml(state.result, $('consultMemo').value);
    document.body.classList.add('is-printing');
    setTimeout(function () {
      window.print();
      setTimeout(function () { document.body.classList.remove('is-printing'); }, 400);
    }, 60);
  }

  /* =========================================================
     起動
     ========================================================= */
  function boot() {
    initStart();
    initInput();
    initResult();
    /* 初期表示 */
    qsa('#segSpouse .seg-btn').forEach(function (b) { b.classList.toggle('is-on', b.dataset.val === '1'); });
  }

  document.addEventListener('DOMContentLoaded', boot);

  global.HCS_UI = { state: state };
})(window);
