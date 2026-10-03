/* Shared logic: storage, dates, study phases, sky and counter drawing, export, statistics. */
(function () {
'use strict';
var CFG = Object.assign({studyName:'Constellation habit study',institution:'',contactEmail:'',submitUrl:'',phaseDays:14}, window.CS_CONFIG || {});
var DAY = 864e5, KEY = 'constellation.v2';
var CS = {cfg: CFG, DAY: DAY, storageOK: true, ui: {viewPhase: null, pilotMode: 'C', justLit: null}};
var pad = function (n) { return String(n).padStart(2, '0'); };
var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); };
CS.pad = pad; CS.esc = esc;

/* ---------- storage ---------- */
function fresh() { return {profile:null,consent:null,checkins:{},events:[],surveys:[],pilotFeedback:[],diary:[],friends:[],offset:0}; }
function load() {
  try {
    var r = localStorage.getItem(KEY);
    if (r) { var o = JSON.parse(r), f = fresh(); for (var k in f) if (o[k] === undefined) o[k] = f[k]; return o; }
  } catch (e) { CS.storageOK = false; }
  return fresh();
}
var S = load();
CS.S = S;
CS.save = function () { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { CS.storageOK = false; } };
CS.replaceState = function (n) {
  Object.keys(S).forEach(function (k) { delete S[k]; });
  Object.assign(S, fresh(), n || {});
  CS.save();
};
CS.clearAll = function () { CS.replaceState(fresh()); try { localStorage.removeItem(KEY); } catch (e) {} };

/* ---------- dates ---------- */
function nowDate() { var off = (S.profile && S.profile.mode === 'pilot') ? (S.offset || 0) : 0; return new Date(Date.now() + off * DAY); }
function keyOf(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
function utc(k) { var a = k.split('-').map(Number); return Date.UTC(a[0], a[1] - 1, a[2]); }
function dayDiff(a, b) { return Math.round((utc(a) - utc(b)) / DAY); }
function addDays(k, n) { var t = new Date(utc(k) + n * DAY); return t.getUTCFullYear() + '-' + pad(t.getUTCMonth() + 1) + '-' + pad(t.getUTCDate()); }
function hhmm(d) { return pad(d.getHours()) + ':' + pad(d.getMinutes()); }
CS.nowDate = nowDate; CS.keyOf = keyOf; CS.dayDiff = dayDiff; CS.addDays = addDays; CS.hhmm = hhmm;

/* ---------- seeded randomness ---------- */
function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { var a = seed >>> 0; return function () { a = (a + 0x6D2B79F5) >>> 0; var t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
CS.hashStr = hashStr; CS.rng = rng;

/* ---------- study phases ---------- */
function condOf(ph) {
  var p = S.profile; if (p.mode === 'pilot') return CS.ui.pilotMode;
  var first = p.order === 'CN' ? 'C' : 'N', second = first === 'C' ? 'N' : 'C';
  return ph % 2 === 0 ? first : second;
}
function ctx() {
  var p = S.profile, today = keyOf(nowDate()), L = p.phaseDays;
  var idx = Math.max(0, dayDiff(today, p.startDate));
  var studyDone = p.mode === 'study' && idx >= 2 * L;
  var cur = Math.floor(idx / L); if (p.mode === 'study') cur = Math.min(cur, 1);
  var vp = CS.ui.viewPhase;
  var ph = (vp !== null && vp <= cur) ? vp : cur;
  return {p: p, today: today, idx: idx, L: L, studyDone: studyDone, cur: cur, ph: ph, cond: condOf(ph), dayNo: studyDone ? L : (idx - ph * L) + 1};
}
function phaseData(ph) {
  var p = S.profile, L = p.phaseDays, today = keyOf(nowDate()), start = addDays(p.startDate, ph * L);
  var days = [], run = 0, best = 0, done = 0, past = 0;
  for (var i = 0; i < L; i++) {
    var date = addDays(start, i), rel = dayDiff(date, today), rec = S.checkins[date];
    var status = rec ? 'done' : (rel < 0 ? 'missed' : (rel === 0 ? 'today' : 'future'));
    if (rec) { run++; best = Math.max(best, run); done++; } else if (rel < 0) { run = 0; }
    if (rel < 0 || (rel === 0 && rec)) past++;
    days.push({i: i, date: date, status: status, rec: rec});
  }
  var missed = days.filter(function (d) { return d.status === 'missed'; }).length;
  return {days: days, run: run, best: best, done: done, past: past, missed: missed, start: start};
}
CS.condOf = condOf; CS.ctx = ctx; CS.phaseData = phaseData;

/* ---------- drawing ---------- */
var SPARK = 'M0,-12 L2.4,-2.4 L12,0 L2.4,2.4 L0,12 L-2.4,2.4 L-12,0 L-2.4,-2.4Z';
CS.mountDefs = function () {
  if (document.getElementById('cs-defs')) return;
  var d = document.createElement('div');
  d.id = 'cs-defs';
  d.innerHTML = '<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs><radialGradient id="glow"><stop offset="0" style="stop-color:var(--star);stop-opacity:.85"/><stop offset=".35" style="stop-color:var(--star);stop-opacity:.22"/><stop offset="1" style="stop-color:var(--star);stop-opacity:0"/></radialGradient></defs></svg>';
  document.body.appendChild(d);
};
function layout(L, seed) {
  var r = rng(seed), pts = [], p0 = r() * 6.28, amp = 70 + r() * 40;
  for (var i = 0; i < L; i++) {
    var t = L > 1 ? i / (L - 1) : .5;
    var x = 44 + t * 512 + (r() - .5) * 28;
    var y = 210 + Math.sin(t * 5.2 + p0) * amp + (r() - .5) * 60;
    y = Math.max(46, Math.min(374, y));
    pts.push([Math.round(x), Math.round(y)]);
  }
  return pts;
}
CS.skySVG = function (days, L, seedStr, label, justLit) {
  var pts = layout(L, hashStr(seedStr)), W = 600, H = 420, out = '', r = rng(777);
  for (var s = 0; s < 90; s++) {
    var x = r() * W, y = r() * H, rad = .4 + r() * 1, o = .2 + r() * .5, tw = r() < .3;
    out += '<circle cx="' + x.toFixed(1) + '" cy="' + y.toFixed(1) + '" r="' + rad.toFixed(2) + '" fill="var(--ink)" opacity="' + o.toFixed(2) + '"' + (tw ? ' class="tw" style="animation-delay:' + (r() * 4).toFixed(1) + 's"' : '') + '/>';
  }
  for (var i = 1; i < L; i++) {
    var a = days[i - 1], b = days[i];
    if (b.status === 'future') continue;
    var both = a.status === 'done' && b.status === 'done';
    out += '<line x1="' + pts[i - 1][0] + '" y1="' + pts[i - 1][1] + '" x2="' + pts[i][0] + '" y2="' + pts[i][1] + '" stroke="var(--thread)" stroke-width="' + (both ? 1.5 : 1.2) + '" ' + (both ? 'opacity=".9"' : 'stroke-dasharray="3 6" opacity=".5"') + '/>';
  }
  for (var j = 0; j < L; j++) {
    var d = days[j], px = pts[j][0], py = pts[j][1], week = (j % 7 === 6);
    if (d.status === 'future') out += '<circle cx="' + px + '" cy="' + py + '" r="1.8" fill="var(--thread)" opacity=".28"/>';
    else if (d.status === 'missed') out += '<circle cx="' + px + '" cy="' + py + '" r="6.5" fill="none" stroke="var(--ink-dim)" stroke-width="1.2" stroke-dasharray="2 3" opacity=".8"/>';
    else if (d.status === 'today') out += '<circle class="pulse" cx="' + px + '" cy="' + py + '" r="7" fill="none" stroke="var(--star)" stroke-width="1.4" stroke-dasharray="2 3"/>';
    else {
      out += '<g' + (justLit === j ? ' class="pop"' : '') + '><circle cx="' + px + '" cy="' + py + '" r="' + (week ? 30 : 19) + '" fill="url(#glow)"/>';
      out += week ? '<path d="' + SPARK + '" transform="translate(' + px + ' ' + py + ') scale(1.25)" fill="var(--star)"/>' : '<circle cx="' + px + '" cy="' + py + '" r="3.3" fill="var(--star)"/>';
      out += '</g>';
    }
  }
  return '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(label) + '">' + out + '</svg>';
};
CS.legend = function () {
  var dot = function (inner) { return '<svg width="22" height="22" viewBox="-11 -11 22 22" aria-hidden="true">' + inner + '</svg>'; };
  return '<div class="legend">' +
    '<span>' + dot('<circle r="9" fill="url(#glow)"/><circle r="3.3" fill="var(--star)"/>') + 'Lit day</span>' +
    '<span>' + dot('<circle r="6" fill="none" stroke="var(--ink-dim)" stroke-width="1.2" stroke-dasharray="2 3"/>') + 'Missed day</span>' +
    '<span>' + dot('<path d="' + SPARK + '" transform="scale(.8)" fill="var(--star)"/>') + 'End of a week</span>' +
    '<span>' + dot('<circle r="6" fill="none" stroke="var(--star)" stroke-width="1.3" stroke-dasharray="2 3"/>') + 'Today</span></div>';
};
CS.counterHTML = function (pd) {
  var pct = pd.past ? Math.round(100 * pd.done / pd.past) + '%' : 'n/a';
  return '<div class="counter"><div class="big"><span class="n">' + pd.run + '</span><span class="u">' + (pd.run === 1 ? 'day' : 'days') + ' in a row</span></div>' +
    '<dl class="stats"><div><dt>Best streak</dt><dd>' + pd.best + '</dd></div><div><dt>Completed</dt><dd>' + pd.done + ' of ' + pd.past + '</dd></div><div><dt>Rate</dt><dd>' + pct + '</dd></div></dl></div>';
};

/* ---------- export ---------- */
CS.buildExport = function () {
  var p = S.profile, today = keyOf(nowDate()), L = p.phaseDays, daily = [];
  var nPh = p.mode === 'study' ? 2 : Math.floor(Math.max(0, dayDiff(today, p.startDate)) / L) + 1;
  for (var ph = 0; ph < nPh; ph++) {
    for (var i = 0; i < L; i++) {
      var date = addDays(p.startDate, ph * L + i), rel = dayDiff(date, today), rec = S.checkins[date];
      if (rel > 0 || (rel === 0 && !rec)) continue;
      daily.push({pid: p.pid, date: date, day: ph * L + i + 1, phase: ph + 1, condition: condOf(ph), done: rec ? 1 : 0, time: rec ? rec.time : ''});
    }
  }
  var opens = {C: 0, N: 0};
  S.events.forEach(function (e) { if (e.t === 'open' && opens[e.cond] !== undefined) opens[e.cond]++; });
  return {v: 1, pid: p.pid, mode: p.mode, order: p.order, habit: p.habit, phaseDays: L, startDate: p.startDate, exportedOn: today, consent: S.consent ? S.consent.ts : null, daily: daily, surveys: S.surveys, opens: opens};
};
CS.csvOf = function (ex) {
  var rows = ['pid,date,day,phase,condition,done,time'];
  ex.daily.forEach(function (d) { rows.push([d.pid, d.date, d.day, d.phase, d.condition, d.done, d.time].join(',')); });
  return rows.join('\n');
};
CS.download = function (name, text, type) {
  var b = new Blob([text], {type: type || 'text/plain'}), u = URL.createObjectURL(b), a = document.createElement('a');
  a.href = u; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(function () { URL.revokeObjectURL(u); a.remove(); }, 600);
};
CS.copy = function (text) {
  if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(text);
  return Promise.reject(new Error('no clipboard'));
};

/* ---------- statistics ---------- */
function lgamma(x) {
  var c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; var a = c[0], t = x + 7.5; for (var i = 1; i < 9; i++) a += c[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function betacf(a, b, x) {
  var FP = 1e-300, qab = a + b, qap = a + 1, qam = a - 1, c = 1, d = 1 - qab * x / qap;
  if (Math.abs(d) < FP) d = FP; d = 1 / d; var h = d;
  for (var m = 1; m <= 200; m++) {
    var m2 = 2 * m, aa = m * (b - m) * x / ((qam + m2) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d; h *= d * c;
    aa = -(a + m) * (qab + m) * x / ((a + m2) * (qap + m2));
    d = 1 + aa * d; if (Math.abs(d) < FP) d = FP; c = 1 + aa / c; if (Math.abs(c) < FP) c = FP; d = 1 / d;
    var del = d * c; h *= del; if (Math.abs(del - 1) < 3e-12) break;
  }
  return h;
}
function ibeta(x, a, b) {
  if (x <= 0) return 0; if (x >= 1) return 1;
  var bt = Math.exp(lgamma(a + b) - lgamma(a) - lgamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}
var mean = function (a) { return a.length ? a.reduce(function (x, y) { return x + y; }, 0) / a.length : null; };
function pairedT(d) {
  var n = d.length; if (n < 2) return null;
  var m = mean(d), v = d.reduce(function (a, b) { return a + (b - m) * (b - m); }, 0) / (n - 1), sd = Math.sqrt(v);
  if (sd === 0) return {n: n, mean: m, sd: 0, t: m === 0 ? 0 : Infinity, df: n - 1, p: m === 0 ? 1 : 0, dz: m === 0 ? 0 : Infinity};
  var t = m / (sd / Math.sqrt(n)), df = n - 1;
  return {n: n, mean: m, sd: sd, t: t, df: df, p: ibeta(df / (df + t * t), df / 2, 0.5), dz: m / sd};
}
CS.mean = mean; CS.pairedT = pairedT;

CS.ITEMS = [['motivation', 'The way my progress was shown made me want to keep going.'],
  ['enjoyment', 'I enjoyed looking at my progress.'],
  ['competence', 'I felt capable of keeping this habit up.'],
  ['autonomy', 'Keeping this habit felt like my own choice.'],
  ['discouraged', 'When I missed a day, seeing it discouraged me.']];
CS.LABELS = {motivation: 'Motivation', enjoyment: 'Enjoyment', competence: 'Competence', autonomy: 'Autonomy', discouraged: 'Discouraged by a miss'};

/* Takes an array of participant export objects. */
CS.analyse = function (exps) {
  var KEYS = CS.ITEMS.map(function (i) { return i[0]; }), rows = [], flags = {pilot: 0, short: 0, bad: 0, synthetic: false};
  exps.forEach(function (e) {
    if (!e || !e.daily) { flags.bad++; return; }
    if (e.synthetic) flags.synthetic = true;
    if (e.mode !== 'study') { flags.pilot++; return; }
    var by = {C: [], N: []};
    e.daily.forEach(function (d) { if (by[d.condition]) by[d.condition].push(d); });
    if (by.C.length < 5 || by.N.length < 5) { flags.short++; return; }
    var rate = function (a) { return 100 * a.reduce(function (s, d) { return s + d.done; }, 0) / a.length; };
    var hour = function (a) { return mean(a.filter(function (d) { return d.time; }).map(function (d) { return +d.time.slice(0, 2) + (+d.time.slice(3, 5)) / 60; })); };
    var sv = {C: {}, N: {}};
    ['C', 'N'].forEach(function (cd) {
      KEYS.forEach(function (k) {
        var v = (e.surveys || []).filter(function (s) { return s.condition === cd && typeof s[k] === 'number'; }).map(function (s) { return s[k]; });
        sv[cd][k] = mean(v);
      });
    });
    var prefs = {C: 0, N: 0, S: 0};
    (e.surveys || []).forEach(function (s) { if (s.preference && prefs[s.preference] !== undefined) prefs[s.preference]++; });
    rows.push({pid: e.pid, order: e.order, rC: rate(by.C), rN: rate(by.N), hC: hour(by.C), hN: hour(by.N),
      oC: e.opens ? e.opens.C / by.C.length : null, oN: e.opens ? e.opens.N / by.N.length : null, sv: sv, prefs: prefs});
  });
  if (!rows.length) return {rows: [], flags: flags};
  var diffs = rows.map(function (r) { return r.rC - r.rN; }), T = pairedT(diffs);
  var mC = mean(rows.map(function (r) { return r.rC; })), mN = mean(rows.map(function (r) { return r.rN; }));
  var byOrder = ['CN', 'NC'].map(function (o) { var d = rows.filter(function (r) { return r.order === o; }).map(function (r) { return r.rC - r.rN; }); return {o: o, n: d.length, m: mean(d)}; });
  var survey = KEYS.map(function (k) {
    var pairs = rows.filter(function (r) { return r.sv.C[k] != null && r.sv.N[k] != null; });
    var t = pairedT(pairs.map(function (r) { return r.sv.C[k] - r.sv.N[k]; }));
    return {key: k, label: CS.LABELS[k], mC: mean(pairs.map(function (r) { return r.sv.C[k]; })), mN: mean(pairs.map(function (r) { return r.sv.N[k]; })), diff: t ? t.mean : null, p: t ? t.p : null, n: pairs.length};
  });
  var nz = function (f) { return mean(rows.map(f).filter(function (x) { return x != null; })); };
  var prefTotals = {C: 0, N: 0, S: 0}; rows.forEach(function (r) { for (var k in prefTotals) prefTotals[k] += r.prefs[k]; });
  var other = {hC: nz(function (r) { return r.hC; }), hN: nz(function (r) { return r.hN; }), oC: nz(function (r) { return r.oC; }), oN: nz(function (r) { return r.oN; })};
  var f1 = function (x) { return x == null || !isFinite(x) ? 'n/a' : x.toFixed(1); }, f2 = function (x) { return x == null || !isFinite(x) ? 'n/a' : x.toFixed(2); };
  var fp = function (p) { return p == null ? 'n/a' : (p < 0.001 ? '< .001' : p.toFixed(3)); };
  var summary = 'Across ' + T.n + ' participants, the mean daily completion rate was ' + f1(mC) + '% with the constellation and ' + f1(mN) + '% with the counter (mean paired difference ' + f1(T.mean) + ' percentage points, SD ' + f1(T.sd) + ', t(' + T.df + ') = ' + f2(T.t) + ', p = ' + fp(T.p) + ', dz = ' + f2(T.dz) + ').';
  return {rows: rows, T: T, mC: mC, mN: mN, byOrder: byOrder, survey: survey, other: other, prefs: prefTotals, flags: flags, summary: summary, fmt: {f1: f1, f2: f2, fp: fp}};
};
CS.parseExports = function (text) {
  var exps = [], bad = 0;
  try { var whole = JSON.parse(text); exps = Array.isArray(whole) ? whole : [whole]; }
  catch (e) {
    text.split(/\n+/).map(function (s) { return s.trim(); }).filter(Boolean).forEach(function (ln) {
      try { var o = JSON.parse(ln); if (Array.isArray(o)) exps = exps.concat(o); else exps.push(o); } catch (er) { bad++; }
    });
  }
  return {exps: exps, bad: bad};
};
CS.synth = function (n) {
  var r = rng(2026), out = [];
  for (var k = 1; k <= n; k++) {
    var order = k % 2 ? 'CN' : 'NC', base = .55 + r() * .35, daily = [], surveys = [], opens = {C: 0, N: 0};
    for (var ph = 0; ph < 2; ph++) {
      var cond = order[ph];
      for (var i = 0; i < 14; i++) {
        var done = r() < Math.min(.97, Math.max(.2, base + (r() - .5) * .12));
        daily.push({pid: 'P' + pad(k), date: '', day: ph * 14 + i + 1, phase: ph + 1, condition: cond, done: done ? 1 : 0, time: done ? pad(19 + Math.floor(r() * 5)) + ':' + pad(Math.floor(r() * 60)) : ''});
      }
      opens[cond] = Math.round(10 + r() * 20);
      for (var w = 1; w <= 2; w++) surveys.push({week: ph * 2 + w, condition: cond, motivation: 3 + Math.floor(r() * 4), enjoyment: 3 + Math.floor(r() * 4), competence: 3 + Math.floor(r() * 4), autonomy: 3 + Math.floor(r() * 4), discouraged: 2 + Math.floor(r() * 4)});
    }
    out.push({v: 1, synthetic: true, pid: 'P' + pad(k), mode: 'study', order: order, phaseDays: 14, daily: daily, surveys: surveys, opens: opens});
  }
  return out;
};

/* ---------- service worker ---------- */
CS.registerSW = function () {
  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('/sw.js').catch(function () {}); });
  }
};

window.CS = CS;
})();
