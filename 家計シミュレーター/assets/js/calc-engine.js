/* =============================================================
   calc-engine.js — 計算エンジン（表示から独立）
   -------------------------------------------------------------
   ■ 関数の出所について（重要）
   本ファイルの計算関数は、本格版家計CFシミュレーターの
   JavaScriptソースが今回の制作環境に提供されていないため、
   「デモ用に新規実装した独立関数」です。
   本格版の関数を流用したものではありません（README に明記）。
   本格版と共通化しやすいよう、以下を意識して分割しています。
     - 教育費：年次・学年進行・入学時費用・重複計上防止
     - 資産：預貯金／運用資産／DC の3区分＋資金移動
     - 公的年金：基礎年金＋報酬比例の参考推計
     - 年間CFの積上げ
   数値は HCS_DATA（2026-v22 採用数値のデモ専用コピー）のみを参照。
   ============================================================= */
(function (global) {
  'use strict';

  var D = global.HCS_DATA;
  var YEN = 10000; // 万円 → 円

  /* ---------- 小物 ---------- */
  function pct(v) { return (Number(v) || 0) / 100; }
  function manToYen(v) { return (Number(v) || 0) * YEN; }
  function yenToMan(v) { return (Number(v) || 0) / YEN; }
  function clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

  /* =========================================================
     1. 教育費モデル
     ========================================================= */

  /* 幼稚園〜高校の5進路パターン → preUniversity 区分のマッピング */
  var TRACKS = {
    allPublic: {
      label: 'ずっと公立',
      short: '全公立',
      stages: { kg: 'kindergarten_public', el: 'elementary_public', jh: 'junior_high_public', hs: 'high_public' }
    },
    kgPrivate: {
      label: '幼稚園から私立',
      short: '幼から私',
      stages: { kg: 'kindergarten_private', el: 'elementary_private', jh: 'junior_high_private', hs: 'high_private' }
    },
    elPrivate: {
      label: '小学校から私立',
      short: '小から私',
      stages: { kg: 'kindergarten_public', el: 'elementary_private', jh: 'junior_high_private', hs: 'high_private' }
    },
    jhPrivate: {
      label: '中学校から私立',
      short: '中から私',
      stages: { kg: 'kindergarten_public', el: 'elementary_public', jh: 'junior_high_private', hs: 'high_private' }
    },
    hsPrivate: {
      label: '高校から私立',
      short: '高から私',
      stages: { kg: 'kindergarten_public', el: 'elementary_public', jh: 'junior_high_public', hs: 'high_private' }
    }
  };

  /* 大学の選択肢（未定＝国立を仮置き／進学なし＝0円） */
  var UNI = {
    none:        { label: '大学進学なし', key: null },
    undecided:   { label: '未定（国立を仮置き）', key: 'national' },
    national:    { label: '国立大学', key: 'national' },
    humanities:  { label: '私立大学（文系）', key: 'private_humanities' },
    science:     { label: '私立大学（理系）', key: 'private_science' },
    medicine:    { label: '私立医学部', key: 'medicine' },
    dentistry:   { label: '私立歯学部', key: 'dentistry' },
    pharmacy:    { label: '私立薬学部', key: 'pharmacy' }
  };

  var ACTIVITY_STAGE = { kg: 'kindergarten', el: 'elementary', jh: 'junior_high', hs: 'high' };
  var STAGE_LABEL = { kg: '幼稚園', el: '小学校', jh: '中学校', hs: '高校', uni: '大学', none: '未就学' };

  /* 年齢 → 学校段階（4月始まりの年度で判定） */
  function stageOfAge(age) {
    if (age < 3) return 'none';
    if (age < 6) return 'kg';
    if (age < 12) return 'el';
    if (age < 15) return 'jh';
    if (age < 18) return 'hs';
    return 'uni';
  }

  /* その年齢が段階の最終学年か */
  function isFinalYearOfStage(age) {
    return age === 5 || age === 11 || age === 14 || age === 17;
  }

  /* 1人・1年分の教育費を分解して返す（円） */
  function childYearCost(child, age, opts) {
    var track = TRACKS[child.track] || TRACKS.allPublic;
    var st = stageOfAge(age);
    var out = {
      stageKey: st,
      stageLabel: STAGE_LABEL[st],
      admission: 0, tuition: 0, nonTuition: 0, exam: 0,
      activity: 0, living: 0, livingInitial: 0,
      total: 0,
      note: ''
    };
    if (st === 'none') { out.note = '未就学（保育料等は生活費に含むと仮定）'; return out; }

    var activityLevel = opts && opts.activityLevel ? opts.activityLevel : 'standard';
    var actStage = ACTIVITY_STAGE[st];
    if (st !== 'uni' && activityLevel !== 'none') {
      var tbl = D.education.activity[actStage];
      out.activity = ((tbl && tbl[activityLevel]) || 0) * 12;
    }

    if (st === 'uni') {
      var uniKey = (UNI[child.university] || UNI.none).key;
      if (!uniKey) { out.note = '大学進学なし'; return out; }
      var u = D.education.university[uniKey];
      var uniStartAge = 18;
      /* 在学年数を超えたら計上しない（4年制=4年、6年制=6年。1年余分に足さない） */
      if (age >= uniStartAge + u.years) { out.note = u.label + '（卒業後）'; return out; }
      out.tuition = u.tuition;
      out.nonTuition = u.nonTuition;
      if (age === uniStartAge) out.admission = u.admission;
      /* 大学生活費：下宿は月額＋初期費用、自宅は任意（世帯生活費との二重計上を避けるため既定0） */
      if (child.living === 'away') {
        out.living = D.education.studentLiving.away.monthly * 12;
        if (age === uniStartAge) out.livingInitial = D.education.studentLiving.away.initial;
      } else if (opts && opts.includeHomeLiving) {
        out.living = D.education.studentLiving.home.monthly * 12;
      }
      out.note = u.label + (child.living === 'away' ? '／下宿' : '／自宅');
    } else {
      var key = track.stages[st];
      var p = D.education.preUniversity[key];
      var startAge = { kg: 3, el: 6, jh: 12, hs: 15 }[st];
      out.tuition = p.tuition;
      out.nonTuition = p.nonTuition;
      if (age === startAge) out.admission = p.admission;
      out.note = p.label;

      /* 受験費：次段階が私立、または大学受験（進学あり）の場合のみ最終学年に1回 */
      if (isFinalYearOfStage(age)) {
        var nextPrivate = false;
        if (st === 'kg') nextPrivate = track.stages.el.indexOf('_private') > -1;
        if (st === 'el') nextPrivate = track.stages.jh.indexOf('_private') > -1;
        if (st === 'jh') nextPrivate = track.stages.hs.indexOf('_private') > -1;
        if (st === 'hs') nextPrivate = !!((UNI[child.university] || UNI.none).key);
        if (nextPrivate) out.exam = p.exam;
      }
    }

    out.total = out.admission + out.tuition + out.nonTuition + out.exam + out.activity + out.living + out.livingInitial;
    return out;
  }

  /* 子どもの生涯（現在年齢〜大学卒業）の教育費合計（円） */
  function childLifetimeCost(child, opts) {
    var total = 0, from = child.age;
    for (var a = from; a <= 23; a++) total += childYearCost(child, a, opts).total;
    return total;
  }

  /* 世帯の年次教育費：headAge 起点の年index → 金額（円） */
  function buildEducationTimeline(input, opts) {
    var kids = input.children || [];
    var span = 95 - input.headAge + 1;
    var arr = [];
    for (var i = 0; i < span; i++) {
      var age = input.headAge + i;
      var sum = 0, detail = [];
      for (var k = 0; k < kids.length; k++) {
        var c = kids[k];
        var childAge = (c.age || 0) + i;
        if (childAge > 23) continue;
        var r = childYearCost(c, childAge, opts);
        if (r.total > 0) {
          sum += r.total;
          detail.push({ childIndex: k, childAge: childAge, cost: r });
        }
      }
      arr.push({ age: age, amount: sum, detail: detail });
    }
    return arr;
  }

  /* 大学費用の選択肢別比較（未定の場合の提示用） */
  function universityComparison(children, opts) {
    var opts2 = { activityLevel: 'none', includeHomeLiving: false };
    var keys = ['national', 'humanities', 'science'];
    var res = {};
    keys.forEach(function (u) {
      var total = 0;
      (children || []).forEach(function (c) {
        var cc = { age: c.age, track: c.track, university: u, living: c.living };
        for (var a = 18; a <= 23; a++) total += childYearCost(cc, a, { activityLevel: 'none', includeHomeLiving: opts2.includeHomeLiving }).total;
      });
      res[u] = total;
    });
    return res;
  }

  /* =========================================================
     2. 公的年金の参考推計
     ========================================================= */

  var WORK_STYLE = {
    full:    { label: '会社員（フルタイム）', basicMonths: 480, earningsMonths: 480 },
    part:    { label: '会社員（パート・短時間）', basicMonths: 480, earningsMonths: 240 },
    self:    { label: '自営業・フリーランス', basicMonths: 480, earningsMonths: 0 },
    none:    { label: '専業・収入なし', basicMonths: 480, earningsMonths: 0 }
  };

  /* 額面年収（円）から参考年金年額（円）を推計。
     あくまで「仮の加入歴」を置いた参考モデル。本人の確定見込額ではない。 */
  function pensionEstimate(grossAnnualYen, workStyleKey, birthYear) {
    var ws = WORK_STYLE[workStyleKey] || WORK_STYLE.none;
    var basicFull = (birthYear && birthYear <= 1956) ? D.pension.basicAnnualOld : D.pension.basicAnnual;
    var basicMonths = ws.basicMonths;
    var basic = basicFull * Math.min(1, basicMonths / D.pension.basicFullMonths);

    var avgStandardMonthly = grossAnnualYen / 12;
    /* 報酬比例：平均標準報酬額 × 0.005481 × 2003年4月以降の被保険者月数 */
    var earnings = ws.earningsMonths > 0
      ? avgStandardMonthly * D.pension.earningsCoefficient * ws.earningsMonths
      : 0;

    return {
      basic: Math.round(basic),
      earnings: Math.round(earnings),
      annual: Math.round(basic + earnings),
      workStyle: ws,
      avgStandardMonthly: Math.round(avgStandardMonthly),
      months: ws.earningsMonths
    };
  }

  /* 手取り年収から額面年収を粗く推定（デモ用の単純係数） */
  function grossFromNet(netAnnualYen) {
    return netAnnualYen / 0.79;
  }

  /* =========================================================
     3. 投影本体（年間CF＋資産3区分）
     ========================================================= */

  /**
   * @param {Object} input   入力（金額は「万円」）
   * @param {Object} plan    {dcMonthly, nisaMonthly, returnRate}（万円・%）
   * @param {Object} baseline true なら「現状のまま」を計算
   */
  function project(input, plan, isBaseline) {
    var startAge = Number(input.headAge) || 38;
    var endAge = input.course === 'B' ? Math.max(90, startAge) : Math.max(65, startAge);
    var retireAge = D.defaults.retirementAge; // 65

    var rates = {
      cash: pct(D.defaults.rates.cash),
      invest: pct(plan && plan.returnRate != null ? plan.returnRate : D.defaults.rates.expected)
    };

    /* --- 資産（円） --- */
    var bal = {
      cash: manToYen(input.cash),
      invest: manToYen(input.invest),
      dc: manToYen(input.dcExisting)
    };

    /* --- 積立設定（円） --- */
    var existDcMonthly = manToYen(input.existingDCMonthly);
    var dcMonthlyYen = isBaseline ? existDcMonthly : manToYen(plan.dcMonthly);
    var nisaMonthlyYen = isBaseline ? manToYen(input.currentNisaMonthly) : manToYen(plan.nisaMonthly);

    /* 給与減額型DC：現在の手取りは既存掛金控除後とみなすため、差分だけ手取りに影響 */
    var dcCashOutMonthly = Math.max(0, dcMonthlyYen - existDcMonthly);

    var eduTimeline = buildEducationTimeline(input, {
      activityLevel: input.activityLevel,
      includeHomeLiving: input.includeHomeLiving
    });

    /* --- 年金モデル --- */
    var pensionInfo = {
      head: null,
      spouse: null,
      deductionRate: pct(input.pension && input.pension.deductionRate != null ? input.pension.deductionRate : 10)
    };
    var headGross = manToYen(input.headGross || 0);
    pensionInfo.head = pensionEstimate(headGross, input.headWork, D.meta.baseYear - startAge);
    if (input.hasSpouse) {
      pensionInfo.spouse = pensionEstimate(manToYen(input.spouseGross || 0), input.spouseWork, D.meta.baseYear - (Number(input.spouseAge) || 0));
    }
    if (input.pension && input.pension.headOverride > 0) {
      var ov = manToYen(input.pension.headOverride);
      pensionInfo.head.annual = ov;
      pensionInfo.head.overridden = true;
    }

    var rows = [];
    var shortfallTotal = 0;
    var eduTotal = 0;

    for (var age = startAge; age <= endAge; age++) {
      var idx = age - startAge;
      var headWorking = age < retireAge;
      var spouseAge = input.hasSpouse ? (Number(input.spouseAge) || 0) + idx : null;
      var spouseWorking = input.hasSpouse && spouseAge < retireAge;

      /* 収入 */
      var headIncome = headWorking ? (manToYen(input.headMonthlyNet) * 12 + manToYen(input.headBonus)) : 0;
      var spouseIncome = spouseWorking ? (manToYen(input.spouseMonthlyNet) * 12 + manToYen(input.spouseBonus)) : 0;
      var workIncome = headIncome + spouseIncome;

      /* 公的年金（Bコースのみ・65歳以降） */
      var pensionGross = 0;
      if (input.course === 'B') {
        if (age >= D.pension.standardClaimAge) pensionGross += pensionInfo.head.annual;
        if (input.hasSpouse && spouseAge >= D.pension.standardClaimAge) pensionGross += pensionInfo.spouse.annual;
      }
      var pensionNet = pensionGross * (1 - pensionInfo.deductionRate);

      /* 支出 */
      var eduRow = eduTimeline[idx] || { amount: 0 };
      var edu = (input.educationInLiving ? 0 : eduRow.amount);
      eduTotal += edu;

      var livingMonthly = age < retireAge
        ? manToYen(input.livingMonthly)
        : manToYen(input.postRetireLiving != null ? input.postRetireLiving : D.defaults.postRetireLiving);
      var living = livingMonthly * 12;
      var special = manToYen(input.annualSpecial);

      var dcOut = headWorking ? dcCashOutMonthly * 12 : 0;
      var nisaOut = headWorking ? nisaMonthlyYen * 12 : 0;

      var outflow = living + special + edu + dcOut + nisaOut;
      var income = workIncome + pensionNet;
      var flow = income - outflow;

      /* 年の始まり残高（＝年齢到達時点の残高） */
      var openBal = { cash: bal.cash, invest: bal.invest, dc: bal.dc };

      /* 運用収益（年初残高に対して計算：保守的） */
      var growth = {
        cash: bal.cash * rates.cash,
        invest: bal.invest * rates.invest,
        dc: bal.dc * rates.invest
      };
      bal.cash += growth.cash;
      bal.invest += growth.invest;
      bal.dc += growth.dc;

      /* 積立の積上げ（資金移動：支出で減らした分を当該資産へ） */
      var dcAccrual = headWorking ? dcMonthlyYen * 12 : 0;
      bal.dc += dcAccrual;
      bal.invest += nisaOut;

      /* 余剰／不足の処理 */
      var shortfall = 0;
      if (flow >= 0) {
        bal.cash += flow;
      } else {
        var need = -flow;
        var fromCash = Math.min(bal.cash, need); bal.cash -= fromCash; need -= fromCash;
        var fromInvest = Math.min(bal.invest, need); bal.invest -= fromInvest; need -= fromInvest;
        if (age >= retireAge) { /* 65歳以降はDCも取り崩し対象 */
          var fromDc = Math.min(bal.dc, need); bal.dc -= fromDc; need -= fromDc;
        }
        if (need > 0.5) { shortfall = need; shortfallTotal += need; }
      }

      rows.push({
        age: age,
        year: idx,
        calendarYear: D.meta.baseYear + idx,
        working: headWorking,
        workIncome: workIncome,
        pensionGross: pensionGross,
        pensionNet: pensionNet,
        living: living,
        special: special,
        education: edu,
        educationDetail: eduRow.detail,
        dcOut: dcOut,
        nisaOut: nisaOut,
        outflow: outflow,
        income: income,
        flow: flow,
        growth: growth,
        dcAccrual: dcAccrual,
        shortfall: shortfall,
        openBal: openBal,
        closeBal: { cash: bal.cash, invest: bal.invest, dc: bal.dc },
        total: bal.cash + bal.invest + bal.dc
      });
    }

    /* --- 集計 --- */
    function balAtAge(a) {
      for (var i = 0; i < rows.length; i++) if (rows[i].age === a) return rows[i].openBal;
      var last = rows[rows.length - 1];
      return last.closeBal;
    }
    function closeAtAge(a) {
      for (var i = 0; i < rows.length; i++) if (rows[i].age === a) return rows[i].closeBal;
      return rows[rows.length - 1].closeBal;
    }

    var b65 = balAtAge(65);
    var summary = {
      at65: { cash: b65.cash, invest: b65.invest, dc: b65.dc, total: b65.cash + b65.invest + b65.dc },
      at90: null,
      educationTotal: eduTotal,
      shortfallTotal: shortfallTotal,
      minTotal: Infinity,
      minTotalAge: null,
      totalContribution: {
        dc: dcMonthlyYen * 12 * Math.max(0, Math.min(endAge, retireAge - 1) - startAge + 1),
        nisa: nisaMonthlyYen * 12 * Math.max(0, Math.min(endAge, retireAge - 1) - startAge + 1)
      }
    };
    if (input.course === 'B') {
      var b90 = closeAtAge(90);
      summary.at90 = { cash: b90.cash, invest: b90.invest, dc: b90.dc, total: b90.cash + b90.invest + b90.dc };
    }
    rows.forEach(function (r) {
      if (r.total < summary.minTotal) { summary.minTotal = r.total; summary.minTotalAge = r.age; }
    });
    if (!isFinite(summary.minTotal)) summary.minTotal = 0;

    return {
      input: input,
      plan: plan,
      isBaseline: !!isBaseline,
      rows: rows,
      endAge: endAge,
      rates: rates,
      pension: pensionInfo,
      educationTimeline: eduTimeline,
      summary: summary,
      assumptions: {
        dcMonthlyYen: dcMonthlyYen,
        dcCashOutMonthly: dcCashOutMonthly,
        nisaMonthlyYen: nisaMonthlyYen,
        retireAge: retireAge
      }
    };
  }

  /* 現状／プランの両方をまとめて計算 */
  function run(input, plan) {
    var base = project(input, plan, true);
    var after = project(input, plan, false);
    return {
      input: input,
      plan: plan,
      baseline: base,
      planResult: after,
      eduComparison: universityComparison(input.children, {}),
      meta: D.meta
    };
  }

  /* =========================================================
     4. 自己検算（代表例）— 数値の整合性チェック用
     ========================================================= */
  function selfTest() {
    var out = [];
    var opts = { activityLevel: 'none', includeHomeLiving: false };

    /* 例1：全公立（幼・小・中・高）＋国立大学4年の学校教育費のみ */
    var c = { age: 0, track: 'allPublic', university: 'national', living: 'home' };
    var t = 0;
    for (var a = 3; a <= 21; a++) t += childYearCost(c, a, opts).total;
    var expect = 50000 + 165000 * 3            // 幼稚園
      + 120000 + 110000 * 6                    // 小学校（公立中へ → 受験費0）
      + 200000 + 140000 * 3                    // 中学校（公立高へ → 受験費0）
      + 300000 + (118800 + 390000) * 3 + 600000 // 高校（大学受験費600,000）
      + 282000 + (535800 + 100000) * 4;        // 国立大学
    out.push({ name: '全公立＋国立大学（学校教育費）', actual: t, expected: expect, ok: t === expect });

    /* 例2：幼稚園から私立＋私立文系（6年制でないこと／4年分のみ） */
    var c2 = { age: 0, track: 'kgPrivate', university: 'humanities', living: 'home' };
    var uniOnly = 0;
    for (var a2 = 18; a2 <= 21; a2++) uniOnly += childYearCost(c2, a2, opts).total;
    var uniExpect = 250000 + (700000 + 300000) * 4;
    out.push({ name: '私立文系：大学4年分のみ', actual: uniOnly, expected: uniExpect, ok: uniOnly === uniExpect });

    /* 例3：医学部6年（6年分のみ・7年計上しない） */
    var c3 = { age: 0, track: 'allPublic', university: 'medicine', living: 'home' };
    var med = 0, years = 0;
    for (var a3 = 18; a3 <= 25; a3++) {
      var r = childYearCost(c3, a3, opts).total;
      if (r > 0) { med += r; years++; }
    }
    var medExpect = 1000000 + (4000000 + 500000) * 6;
    out.push({ name: '私立医学部：6年分のみ', actual: med, expected: medExpect, ok: med === medExpect && years === 6 });

    /* 例4：年金参考推計（年収600万円・会社員フルタイム） */
    var p = pensionEstimate(6000000, 'full', 1988);
    var pExpect = Math.round(847300 + (6000000 / 12) * 0.005481 * 480);
    out.push({ name: '年金参考推計（年収600万・会社員）', actual: p.annual, expected: pExpect, ok: p.annual === pExpect });

    /* 例5：資産の資金移動（DC積立がDC資産に、NISA積立が運用資産に計上され二重計上しない） */
    var inp = {
      course: 'A', headAge: 40, hasSpouse: false, children: [],
      headMonthlyNet: 40, headBonus: 0, headGross: 600, headWork: 'full',
      livingMonthly: 20, postRetireLiving: 18, annualSpecial: 0,
      educationInLiving: false, activityLevel: 'none', includeHomeLiving: false,
      cash: 1000, invest: 0, dcExisting: 0,
      existingDCMonthly: 0, currentNisaMonthly: 0,
      pension: { deductionRate: 10 }
    };
    var pr = project(inp, { dcMonthly: 2, nisaMonthly: 3, returnRate: 0 }, false);
    var at65 = pr.summary.at65;
    /* 期待値を独立に手計算（預貯金のみ年0.1%の利息、運用利回り0%） */
    var flowPerYear = (40 - 20 - 2 - 3) * 12; // 180万/年
    var cash = 1000, invest = 0, dc = 0;
    for (var y = 0; y < 25; y++) {
      cash += cash * 0.001;
      cash += flowPerYear;              // 収支差は預貯金へ
      dc += 2 * 12;                     // DC掛金はDCへ
      invest += 3 * 12;                 // NISAは運用資産へ
    }
    out.push({
      name: '資金移動：25年間の残高合計（運用利回り0%）',
      actual: Math.round(yenToMan(at65.total)),
      expected: Math.round(cash + invest + dc),
      ok: Math.abs(yenToMan(at65.total) - (cash + invest + dc)) < 1
    });
    out.push({ name: '　二重計上なし（預貯金＝期待値）', actual: Math.round(yenToMan(at65.cash)), expected: Math.round(cash), ok: Math.abs(yenToMan(at65.cash) - cash) < 1 });
    out.push({ name: '　内訳 DC（2万×12×25年=600万）', actual: Math.round(yenToMan(at65.dc)), expected: 600, ok: Math.abs(yenToMan(at65.dc) - 600) < 1 });
    out.push({ name: '　内訳 NISA等（3万×12×25年=900万）', actual: Math.round(yenToMan(at65.invest)), expected: 900, ok: Math.abs(yenToMan(at65.invest) - 900) < 1 });

    return out;
  }

  /* ---------- export ---------- */
  global.HCS_CALC = {
    TRACKS: TRACKS,
    UNI: UNI,
    WORK_STYLE: WORK_STYLE,
    STAGE_LABEL: STAGE_LABEL,
    stageOfAge: stageOfAge,
    childYearCost: childYearCost,
    childLifetimeCost: childLifetimeCost,
    buildEducationTimeline: buildEducationTimeline,
    universityComparison: universityComparison,
    pensionEstimate: pensionEstimate,
    grossFromNet: grossFromNet,
    project: project,
    run: run,
    selfTest: selfTest,
    util: { pct: pct, manToYen: manToYen, yenToMan: yenToMan, clamp: clamp }
  };

  /* 子スクリプトから参照しやすいよう、データも再公開 */
  global.HCS = global.HCS || {};
  global.HCS.data = D;
  global.HCS.calc = global.HCS_CALC;
})(window);
