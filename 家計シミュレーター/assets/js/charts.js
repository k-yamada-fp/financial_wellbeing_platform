/* =============================================================
   charts.js — 依存ライブラリなしの軽量SVGチャート
   -------------------------------------------------------------
   オフライン（index.html ダブルクリック）で動作させるため、
   外部ライブラリは使用せず SVG を直接描画します。
   ============================================================= */
(function (global) {
  'use strict';

  var NS = 'http://www.w3.org/2000/svg';

  var COLOR = {
    cash: '#A8BECE',
    invest: '#1B7BB5',
    dc: '#D97A32',
    line: '#0B2C42',
    grid: '#E8F0F7',
    axis: '#93A7B8',
    band: '#F0F6FB'
  };

  function el(tag, attrs, parent) {
    var n = document.createElementNS(NS, tag);
    if (attrs) for (var k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }

  /* 万円 → 表示ラベル */
  function fmtMan(v) {
    var a = Math.abs(v);
    if (a >= 10000) return (v / 10000).toFixed(v % 10000 === 0 ? 0 : 1) + '億';
    return Math.round(v).toLocaleString('ja-JP');
  }

  /* 目盛りのキリの良い刻み */
  function niceTicks(max, count) {
    if (max <= 0) return [0, 1];
    var raw = max / count;
    var mag = Math.pow(10, Math.floor(Math.log10(raw)));
    var norm = raw / mag;
    var step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    var ticks = [];
    for (var v = 0; v <= max + step * 0.001; v += step) ticks.push(v);
    if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
    return ticks;
  }

  /* -------------------------------------------------------------
     メインチャート：資産推移（積上げ面＋現状のままの破線）
     series: [{key,label,color,values:[...]}]  values は万円
     ------------------------------------------------------------- */
  function renderStacked(host, opts) {
    host.innerHTML = '';
    var W = host.clientWidth || 720;
    var H = host.clientHeight || 330;
    var M = { t: 14, r: 58, b: 30, l: 8 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' }, host);

    var ages = opts.ages;
    var n = ages.length;
    if (!n) return;

    var stacks = opts.series; // [{key,label,color,values}]
    var visible = opts.visible || {};
    var totals = ages.map(function (_, i) {
      var s = 0;
      stacks.forEach(function (sr) { if (visible[sr.key] !== false) s += sr.values[i]; });
      return s;
    });
    var baseline = opts.baseline || null;

    var maxV = Math.max.apply(null, totals.concat(baseline ? baseline : [0]));
    maxV = Math.max(maxV, 1);
    var ticks = niceTicks(maxV, 4);
    var top = ticks[ticks.length - 1];

    var x = function (i) { return M.l + (W - M.l - M.r) * (n === 1 ? 0 : i / (n - 1)); };
    var y = function (v) { return M.t + (H - M.t - M.b) * (1 - v / top); };

    /* グリッド */
    var gGrid = el('g', null, svg);
    ticks.forEach(function (t) {
      el('line', { x1: M.l, y1: y(t), x2: W - M.r, y2: y(t), stroke: COLOR.grid, 'stroke-width': 1 }, gGrid);
      var lb = el('text', {
        x: W - M.r + 8, y: y(t) + 4, fill: COLOR.axis, 'font-size': 10.5,
        'font-family': 'inherit', 'font-variant-numeric': 'tabular-nums'
      }, gGrid);
      lb.textContent = fmtMan(t);
    });

    /* 65歳ライン */
    var idx65 = ages.indexOf(65);
    if (idx65 >= 0) {
      el('line', {
        x1: x(idx65), y1: M.t, x2: x(idx65), y2: H - M.b,
        stroke: '#C4D4E2', 'stroke-width': 1, 'stroke-dasharray': '4 4'
      }, svg);
      var t65 = el('text', {
        x: x(idx65) + 5, y: M.t + 11, fill: '#6B8299', 'font-size': 10, 'font-family': 'inherit'
      }, svg);
      t65.textContent = '65歳';
    }

    /* 積上げエリア（下から cash → invest → dc） */
    var cum = ages.map(function () { return 0; });
    stacks.forEach(function (sr) {
      if (visible[sr.key] === false) return;
      var up = [], dn = [];
      for (var i = 0; i < n; i++) {
        var base = cum[i];
        cum[i] += sr.values[i];
        up.push([x(i), y(base + sr.values[i])]);
        dn.unshift([x(i), y(base)]);
      }
      var d = 'M' + up.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L')
        + 'L' + dn.map(function (p) { return p[0].toFixed(1) + ',' + p[1].toFixed(1); }).join('L') + 'Z';
      el('path', { d: d, fill: sr.color, 'fill-opacity': sr.key === 'cash' ? 0.85 : 0.92 }, svg);
    });

    /* 総額ライン */
    var totalPath = ages.map(function (_, i) {
      return (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(totals[i]).toFixed(1);
    }).join('');
    el('path', { d: totalPath, fill: 'none', stroke: COLOR.line, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);

    /* 現状のまま（破線） */
    if (baseline && opts.showBaseline) {
      var bp = baseline.map(function (v, i) {
        return (i === 0 ? 'M' : 'L') + x(i).toFixed(1) + ',' + y(v).toFixed(1);
      }).join('');
      el('path', { d: bp, fill: 'none', stroke: '#6B8299', 'stroke-width': 1.8, 'stroke-dasharray': '5 4', 'stroke-linecap': 'round' }, svg);
    }

    /* X軸ラベル */
    var labelEvery = Math.max(1, Math.round(n / 9));
    ages.forEach(function (a, i) {
      if (i % labelEvery !== 0 && i !== n - 1) return;
      var t = el('text', {
        x: x(i), y: H - 8, fill: COLOR.axis, 'font-size': 10.5,
        'text-anchor': i === n - 1 ? 'end' : 'middle', 'font-family': 'inherit'
      }, svg);
      t.textContent = a + '歳';
    });

    /* ホバー */
    var hover = el('g', { opacity: 0 }, svg);
    var hoverLine = el('line', { y1: M.t, y2: H - M.b, stroke: '#0B2C42', 'stroke-width': 1, 'stroke-opacity': .35 }, hover);
    var hoverDot = el('circle', { r: 4, fill: '#fff', stroke: COLOR.line, 'stroke-width': 2 }, hover);

    var hit = el('rect', {
      x: M.l, y: M.t, width: W - M.l - M.r, height: H - M.t - M.b,
      fill: 'transparent', style: 'cursor:crosshair'
    }, svg);

    var tip = document.getElementById('chartTooltip');
    function onMove(ev) {
      var rect = svg.getBoundingClientRect();
      var px = (ev.clientX - rect.left) / rect.width * W;
      var ratio = (px - M.l) / (W - M.l - M.r);
      var i = Math.round(ratio * (n - 1));
      i = Math.max(0, Math.min(n - 1, i));
      hover.setAttribute('opacity', 1);
      hoverLine.setAttribute('x1', x(i));
      hoverLine.setAttribute('x2', x(i));
      hoverDot.setAttribute('cx', x(i));
      hoverDot.setAttribute('cy', y(totals[i]));
      if (opts.onHover) opts.onHover(i, ev);
      if (tip) {
        tip.hidden = false;
        tip.style.left = (x(i) / W * 100) + '%';
        tip.style.top = (y(totals[i]) / H * 100) + '%';
        tip.style.marginLeft = '-10px';
      }
    }
    hit.addEventListener('mousemove', onMove);
    hit.addEventListener('mouseleave', function () {
      hover.setAttribute('opacity', 0);
      if (tip) tip.hidden = true;
      if (opts.onHover) opts.onHover(-1);
    });
    hit.addEventListener('touchmove', function (e) {
      if (e.touches[0]) onMove(e.touches[0]);
    }, { passive: true });
    hit.addEventListener('touchend', function () {
      hover.setAttribute('opacity', 0);
      if (tip) tip.hidden = true;
      if (opts.onHover) opts.onHover(-1);
    });
  }

  /* -------------------------------------------------------------
     教育費バー
     ------------------------------------------------------------- */
  function renderBars(host, opts) {
    host.innerHTML = '';
    var W = host.clientWidth || 720, H = host.clientHeight || 150;
    var M = { t: 10, r: 8, b: 22, l: 8 };
    var svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, preserveAspectRatio: 'none' }, host);
    var vals = opts.values, ages = opts.ages;
    var n = vals.length;
    if (!n) return;
    var max = Math.max.apply(null, vals.concat([1]));
    var bw = Math.max(2, (W - M.l - M.r) / n - 2);

    vals.forEach(function (v, i) {
      if (v <= 0) return;
      var h = (H - M.t - M.b) * (v / max);
      var bx = M.l + (W - M.l - M.r) * (i / n);
      el('rect', {
        x: bx, y: H - M.b - h, width: bw, height: Math.max(1, h),
        fill: opts.color || '#1B7BB5', rx: Math.min(2, bw / 2), opacity: .85
      }, svg);
    });

    /* max注記 */
    var maxIdx = vals.indexOf(max);
    if (maxIdx >= 0 && max > 0) {
      el('line', { x1: M.l, y1: M.t + 2, x2: W - M.r, y2: M.t + 2, stroke: '#E8F0F7', 'stroke-width': 1 }, svg);
      var lb = el('text', { x: W - M.r, y: M.t + 2, fill: '#93A7B8', 'font-size': 10, 'text-anchor': 'end', 'font-family': 'inherit' }, svg);
      lb.textContent = 'ピーク ' + Math.round(max).toLocaleString('ja-JP') + '万円／年';
    }

    var every = Math.max(1, Math.round(n / 8));
    ages.forEach(function (a, i) {
      if (i % every !== 0 && i !== n - 1) return;
      var t = el('text', {
        x: M.l + (W - M.l - M.r) * (i / n) + bw / 2, y: H - 6,
        fill: '#93A7B8', 'font-size': 10, 'text-anchor': 'middle', 'font-family': 'inherit'
      }, svg);
      t.textContent = a + '歳';
    });
  }

  global.HCS_CHART = {
    renderStacked: renderStacked,
    renderBars: renderBars,
    fmtMan: fmtMan,
    COLOR: COLOR
  };
})(window);
