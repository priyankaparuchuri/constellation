/* Researcher page: load participant exports, run the paired comparison, download results. */
(function () {
'use strict';
var CS = window.CS, esc = CS.esc, $ = function (s) { return document.querySelector(s); };
var loaded = [];   // {name, text}
var last = null;

function setFiles() {
  $('#filelist').textContent = loaded.length ? loaded.length + ' file' + (loaded.length === 1 ? '' : 's') + ' loaded: ' + loaded.map(function (f) { return f.name; }).join(', ') : 'No files loaded.';
}
function readFiles(list) {
  Array.prototype.forEach.call(list, function (f) {
    var fr = new FileReader();
    fr.onload = function () { loaded.push({name: f.name, text: String(fr.result)}); setFiles(); };
    fr.readAsText(f);
  });
}
function gather() {
  var exps = [], bad = 0;
  loaded.forEach(function (f) { var r = CS.parseExports(f.text); exps = exps.concat(r.exps); bad += r.bad; });
  var p = $('#paste').value.trim();
  if (p) { var r2 = CS.parseExports(p); exps = exps.concat(r2.exps); bad += r2.bad; }
  return {exps: exps, bad: bad};
}
function resultsCSV(a) {
  var rows = ['pid,order,rate_constellation,rate_counter,difference'];
  a.rows.forEach(function (r) { rows.push([r.pid, r.order, r.rC.toFixed(2), r.rN.toFixed(2), (r.rC - r.rN).toFixed(2)].join(',')); });
  return rows.join('\n');
}
function show(a, bad) {
  var out = $('#out'), f = a.fmt;
  if (!a.rows.length) {
    out.hidden = false;
    out.innerHTML = '<p class="err">No usable study exports found.' + (bad || a.flags.bad ? ' ' + (bad + a.flags.bad) + ' could not be read.' : '') + (a.flags.pilot ? ' ' + a.flags.pilot + ' pilot export(s) skipped.' : '') + (a.flags.short ? ' ' + a.flags.short + ' had too few days.' : '') + '</p>';
    return;
  }
  var T = a.T, h = '';
  if (a.flags.synthetic) h += '<div class="banner">Synthetic demo data. Random numbers with no built-in difference between versions. These are not results.</div>';
  h += '<h3>Completion rate by participant</h3><div class="tbl"><table><thead><tr><th>ID</th><th>Order</th><th class="num">Constellation %</th><th class="num">Counter %</th><th class="num">Difference</th></tr></thead><tbody>' +
    a.rows.map(function (r) { var d = r.rC - r.rN; return '<tr><td>' + esc(r.pid) + '</td><td>' + esc(r.order) + '</td><td class="num">' + f.f1(r.rC) + '</td><td class="num">' + f.f1(r.rN) + '</td><td class="num">' + (d >= 0 ? '+' : '') + f.f1(d) + '</td></tr>'; }).join('') + '</tbody></table></div>';
  h += '<h3>Paired comparison</h3><div class="tbl"><table><tbody>' +
    '<tr><td>Participants</td><td class="num">' + T.n + '</td></tr>' +
    '<tr><td>Mean rate, constellation</td><td class="num">' + f.f1(a.mC) + '%</td></tr>' +
    '<tr><td>Mean rate, counter</td><td class="num">' + f.f1(a.mN) + '%</td></tr>' +
    '<tr><td>Mean difference (points)</td><td class="num">' + f.f1(T.mean) + '</td></tr>' +
    '<tr><td>SD of differences</td><td class="num">' + f.f1(T.sd) + '</td></tr>' +
    '<tr><td>Paired t</td><td class="num">t(' + T.df + ') = ' + f.f2(T.t) + '</td></tr>' +
    '<tr><td>p, two-sided</td><td class="num">' + f.fp(T.p) + '</td></tr>' +
    '<tr><td>Effect size dz</td><td class="num">' + f.f2(T.dz) + '</td></tr></tbody></table></div>';
  h += '<p class="note">Order check, mean difference by starting version: constellation first n=' + a.byOrder[0].n + ' (' + f.f1(a.byOrder[0].m) + '), counter first n=' + a.byOrder[1].n + ' (' + f.f1(a.byOrder[1].m) + '). A large gap between these suggests a carry-over or order effect.</p>';
  h += '<h3>Survey items (1 to 7) and behaviour</h3><div class="tbl"><table><thead><tr><th>Item</th><th class="num">Constellation</th><th class="num">Counter</th><th class="num">Mean diff</th><th class="num">p</th><th class="num">n</th></tr></thead><tbody>' +
    a.survey.map(function (s) { return '<tr><td>' + s.label + '</td><td class="num">' + f.f2(s.mC) + '</td><td class="num">' + f.f2(s.mN) + '</td><td class="num">' + f.f2(s.diff) + '</td><td class="num">' + f.fp(s.p) + '</td><td class="num">' + s.n + '</td></tr>'; }).join('') +
    '<tr><td>Check-in hour (mean)</td><td class="num">' + f.f1(a.other.hC) + '</td><td class="num">' + f.f1(a.other.hN) + '</td><td class="num">n/a</td><td class="num">n/a</td><td class="num">' + a.rows.length + '</td></tr>' +
    '<tr><td>Page visits per day</td><td class="num">' + f.f2(a.other.oC) + '</td><td class="num">' + f.f2(a.other.oN) + '</td><td class="num">n/a</td><td class="num">n/a</td><td class="num">' + a.rows.length + '</td></tr></tbody></table></div>';
  h += '<p class="note">Stated preference at the end: constellation ' + a.prefs.C + ', counter ' + a.prefs.N + ', no difference ' + a.prefs.S + '.</p>';
  var left = [a.flags.pilot ? a.flags.pilot + ' pilot' : '', a.flags.short ? a.flags.short + ' with too few days' : '', (bad + a.flags.bad) ? (bad + a.flags.bad) + ' unreadable' : ''].filter(Boolean);
  h += '<p class="note">With 10 to 15 participants these tests are exploratory. Five survey items are tested alongside the main comparison, so treat single p values near .05 with caution.' + (left.length ? ' Left out: ' + left.join(', ') + '.' : '') + '</p>';
  h += '<h3>Sentence for the report</h3><textarea class="codebox" id="sum" readonly>' + esc(a.summary) + '</textarea>' +
    '<div class="row"><button class="btn" id="copysum">Copy sentence</button><button class="btn" id="dlres">Download results CSV</button></div>';
  out.hidden = false; out.innerHTML = h;
  $('#copysum').addEventListener('click', function () {
    var b = $('#copysum'); CS.copy(a.summary).then(function () { b.textContent = 'Copied'; }, function () { $('#sum').select(); b.textContent = 'Selected, press copy'; });
  });
  $('#dlres').addEventListener('click', function () { CS.download('constellation-results.csv', resultsCSV(a), 'text/csv'); });
}
function run() {
  var g = gather(); $('#err').textContent = '';
  if (!g.exps.length) { $('#err').textContent = 'Load at least one export file, or paste one.'; $('#out').hidden = true; return; }
  last = CS.analyse(g.exps); show(last, g.bad);
}

$('#files').addEventListener('change', function (e) { readFiles(e.target.files); e.target.value = ''; });
var drop = $('#drop');
['dragenter', 'dragover'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
['dragleave', 'drop'].forEach(function (n) { drop.addEventListener(n, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
drop.addEventListener('drop', function (e) { if (e.dataTransfer && e.dataTransfer.files) readFiles(e.dataTransfer.files); });
$('#go').addEventListener('click', function () { setTimeout(run, 50); });
$('#demo').addEventListener('click', function () { loaded = []; setFiles(); $('#paste').value = CS.synth(12).map(JSON.stringify).join('\n'); run(); });
$('#clear').addEventListener('click', function () { loaded = []; setFiles(); $('#paste').value = ''; $('#out').hidden = true; $('#err').textContent = ''; });
})();
