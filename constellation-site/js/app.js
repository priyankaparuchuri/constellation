/* Participant app: check-in, survey, diary, data. */
(function () {
'use strict';
var CS = window.CS, S = CS.S, ui = CS.ui, esc = CS.esc, pad = CS.pad, CFG = CS.cfg;
var $ = function (s, r) { return (r || document).querySelector(s); };
var state = {tab: 'today', confirmReset: false, flash: '', orderTouched: false};
var TABS = [['today', 'Today'], ['survey', 'Survey'], ['diary', 'Diary'], ['data', 'Data']];
var FEELS = ['Motivated', 'Satisfied', 'Frustrated', 'Tempted to stop', 'Other'];
var CONSENT_VERSION = 'v1';

/* ---------- shell ---------- */
function statusText() {
  if (!S.profile) return 'Set up to begin';
  var c = CS.ctx();
  if (c.p.mode === 'pilot') return 'Pilot · Day ' + c.dayNo + ' of ' + c.L;
  if (c.studyDone && ui.viewPhase === null) return 'Study complete';
  return 'Phase ' + (c.ph + 1) + ' of 2 · Day ' + c.dayNo + ' of ' + c.L;
}
function shell(body) {
  var tabs = TABS.map(function (t) {
    return '<button class="tab" role="tab" data-act="tab" data-tab="' + t[0] + '" aria-selected="' + (state.tab === t[0]) + '">' + t[1] + '</button>';
  }).join('');
  return '<a class="skip" href="#main">Skip to content</a>' +
    '<div class="bar"><div class="bar-in"><a class="brand" href="/">Constellation</a><span class="status" id="status">' + esc(statusText()) + '</span></div>' +
    '<nav class="tabs" role="tablist" aria-label="Sections">' + tabs + '</nav></div>' +
    '<main class="app" id="main" tabindex="-1">' + body + '</main>' +
    '<footer class="foot">A day runs from midnight to midnight, your local time. ' +
    (CS.storageOK ? 'Everything you enter stays in this browser on this device until you send it.' : 'This browser is blocking storage, so entries will be lost when you close the page. Download your data from the Data tab before leaving.') + '</footer>';
}
function render(keepScroll) {
  var views = {today: viewToday, survey: viewSurvey, diary: viewDiary, data: viewData};
  var y = window.scrollY;
  $('#app').innerHTML = shell(views[state.tab]());
  if (keepScroll) window.scrollTo(0, y);
}

/* ---------- setup ---------- */
function setupForm() {
  var q = new URLSearchParams(location.search), pid = q.get('pid') || '', orderDefault = 'CN';
  var m = pid.match(/(\d+)\s*$/); if (m) orderDefault = (+m[1]) % 2 === 1 ? 'CN' : 'NC';
  var who = CFG.institution ? ' at ' + esc(CFG.institution) : '';
  var contact = CFG.contactEmail ? ' Questions: ' + esc(CFG.contactEmail) + '.' : ' Questions: ask the researcher who invited you.';
  return '<section class="sect"><h2>Pick one small habit and begin.</h2><p class="lede">Choose something simple you can do daily, such as less phone time before bed, a short workout or enough water. You check in once a day.</p></section>' +
    '<form class="panel" data-form="setup" id="setup-form" novalidate>' +
    '<fieldset><legend>How are you using this?</legend><div class="row">' +
    '<label class="opt"><input type="radio" name="su-mode" value="study" checked><span>Study participant</span></label>' +
    '<label class="opt"><input type="radio" name="su-mode" value="pilot"><span>Just trying it</span></label></div>' +
    '<p class="note" id="su-modenote">Study: you use one version for ' + CFG.phaseDays + ' days, then the other for ' + CFG.phaseDays + ' days.</p></fieldset>' +
    '<label class="f study-only" id="su-pid-wrap">Participant ID<input type="text" id="su-pid" autocomplete="off" placeholder="P07" value="' + esc(pid) + '"></label>' +
    '<label class="f">Your habit<input type="text" id="su-habit" autocomplete="off" placeholder="Phone away 30 minutes before bed"></label>' +
    '<div class="chips" aria-label="Habit ideas">' + ['Phone away before bed', 'Exercise for 20 minutes', 'Drink 2 litres of water'].map(function (h) { return '<button type="button" class="chip" data-act="habit" data-h="' + esc(h) + '">' + esc(h) + '</button>'; }).join('') + '</div>' +
    '<div class="row study-only" id="su-study"><label class="f" style="flex:1;min-width:180px">Version order<select id="su-order"><option value="CN"' + (orderDefault === 'CN' ? ' selected' : '') + '>Constellation first, then counter</option><option value="NC"' + (orderDefault === 'NC' ? ' selected' : '') + '>Counter first, then constellation</option></select></label>' +
    '<label class="f" style="flex:1;min-width:180px">Days per version<select id="su-len"><option value="14"' + (CFG.phaseDays === 14 ? ' selected' : '') + '>14 days</option><option value="7"' + (CFG.phaseDays === 7 ? ' selected' : '') + '>7 days</option></select></label></div>' +
    '<p class="note study-only">Odd participant numbers start with the constellation and even numbers with the counter, so the two orders stay balanced. Change this only if the researcher tells you to.</p>' +
    '<div class="consent study-only" id="su-consent"><h3>About this study</h3><p>' + esc(CFG.studyName) + who + ' compares two ways of showing daily progress on a habit. You use one version for ' + CFG.phaseDays + ' days and the other for ' + CFG.phaseDays + ' days, check in once a day and answer a short survey each week.</p>' +
    '<p>Your check-ins and answers are stored in this browser. They reach the researcher only when you send or share your export. You can stop at any time and delete everything from the Data tab.' + contact + '</p>' +
    '<label class="agree"><input type="checkbox" id="su-agree"><span>I have read this and agree to take part.</span></label></div>' +
    '<div class="err" id="su-err" role="alert"></div><button class="btn primary" type="submit">Start</button></form>';
}
function pilotBar() {
  return '<div class="panel"><h3>Trying it out</h3><div class="row"><div class="seg" role="group" aria-label="Version">' +
    '<button data-act="pmode" data-m="C" aria-pressed="' + (ui.pilotMode === 'C') + '">Constellation</button>' +
    '<button data-act="pmode" data-m="N" aria-pressed="' + (ui.pilotMode === 'N') + '">Counter</button></div></div>' +
    '<div class="row"><button class="btn" data-act="nextday">Move to the next day</button><button class="btn" data-act="sample">Load a sample fortnight</button><button class="btn link" data-act="pilotreset">Clear</button></div>' +
    '<p class="note">Both versions draw from the same check-ins. Moving to the next day without checking in creates a missed day, so you can see how each version shows it.</p></div>';
}

/* ---------- today ---------- */
function viewToday() {
  if (!S.profile) return setupForm();
  var c = CS.ctx(), pd = CS.phaseData(c.ph), h = '';
  if (c.p.mode === 'pilot') h += pilotBar();
  if (c.studyDone) {
    h += '<div class="banner">The study is finished. Thank you. Download your data from the Data tab and send it to the researcher.</div>' +
      '<div class="row"><span class="note">Look back at</span><div class="seg" role="group" aria-label="Phase"><button data-act="phase" data-p="0" aria-pressed="' + (c.ph === 0) + '">First version</button><button data-act="phase" data-p="1" aria-pressed="' + (c.ph === 1) + '">Second version</button></div></div>';
  } else if (c.ph < c.cur) {
    h += '<div class="row"><span class="note">Looking at an earlier phase.</span><button class="btn link" data-act="phase" data-p="' + c.cur + '">Back to now</button></div>';
  }
  var left = pd.days.filter(function (d) { return d.status === 'future' || d.status === 'today'; }).length;
  var label = 'Constellation for ' + c.p.habit + ': ' + pd.done + ' stars lit, ' + pd.missed + ' gaps, ' + left + ' days still to come.';
  var plate = c.cond === 'C'
    ? '<div class="plate sky">' + CS.skySVG(pd.days, c.L, c.p.pid + '|' + c.ph, label, ui.justLit) + CS.legend() + '</div>'
    : '<div class="plate">' + CS.counterHTML(pd) + '</div>';
  h += '<section class="sect"><h2>' + esc(c.p.habit) + '</h2>' + plate + '</section>';
  if (!c.studyDone && c.ph === c.cur) {
    var rec = S.checkins[c.today];
    h += '<div class="checkin" aria-live="polite">' + (rec
      ? '<div class="row"><span class="ok">Checked in at ' + esc(rec.time) + '. See you tomorrow.</span><button class="btn link" data-act="undo">Undo</button></div>'
      : '<button class="btn primary" data-act="checkin">I did it today</button>') + '</div>';
  }
  return h;
}
function checkin() {
  var c = CS.ctx(), now = CS.nowDate();
  S.checkins[c.today] = {ts: now.toISOString(), time: CS.hhmm(now), cond: CS.condOf(c.cur), phase: c.cur + 1, day: c.idx + 1};
  S.events.push({t: 'checkin', ts: now.toISOString(), cond: CS.condOf(c.cur)});
  ui.justLit = c.idx - c.cur * c.L; ui.viewPhase = null; CS.save(); render(true);
  setTimeout(function () { ui.justLit = null; }, 1200);
}
function logOpen() {
  if (!S.profile) return;
  var c = CS.ctx(), last = S.events.filter(function (e) { return e.t === 'open'; }).pop();
  if (!last || Date.now() - new Date(last.ts).getTime() > 30 * 60 * 1000) {
    S.events.push({t: 'open', ts: new Date().toISOString(), cond: CS.condOf(c.cur)}); CS.save();
  }
}

/* ---------- survey ---------- */
function likert(name, legendText, extra) {
  var b = ''; for (var i = 1; i <= 7; i++) b += '<label class="lk"><input type="radio" name="' + name + '" value="' + i + '"><span>' + i + '</span></label>';
  return '<fieldset><legend>' + esc(legendText) + '</legend><div class="likert">' + b + '</div><div class="ends"><span>Strongly disagree</span><span>Strongly agree</span></div>' + (extra || '') + '</fieldset>';
}
function surveyForm(w, last) {
  var h = '<form class="panel" data-form="survey" data-week="' + w + '"><h3>Week ' + w + ' survey</h3>';
  CS.ITEMS.forEach(function (it) {
    var extra = it[0] === 'discouraged' ? '<label class="opt" style="align-self:flex-start"><input type="checkbox" name="nomiss" value="1"><span>I did not miss a day this week</span></label>' : '';
    h += likert('q_' + it[0], it[1], extra);
  });
  if (last) {
    h += '<fieldset><legend>Which version helped you keep going?</legend><div class="row">' +
      [['C', 'The constellation'], ['N', 'The counter'], ['S', 'No difference']].map(function (o) { return '<label class="opt"><input type="radio" name="pref" value="' + o[0] + '"><span>' + o[1] + '</span></label>'; }).join('') + '</div></fieldset>';
  }
  return h + '<label class="f">Anything you want to add? (optional)<textarea name="comment" id="sv-comment"></textarea></label><div class="err" id="sv-err" role="alert"></div><button class="btn primary" type="submit">Save survey</button></form>';
}
function viewSurvey() {
  if (!S.profile) return '<p class="lede">Set up your habit on the Today tab first. The weekly survey takes about a minute.</p>';
  var c = CS.ctx(), nW = 2 * c.L / 7, rows = [], h = '';
  for (var w = 1; w <= nW; w++) {
    var done = S.surveys.some(function (s) { return s.week === w; });
    rows.push({w: w, done: done, due: c.p.mode === 'pilot' || c.idx >= w * 7 - 1});
  }
  h += '<section class="sect"><h2>Weekly check on how it feels</h2><p class="lede">A few short questions each week. There are no right answers.</p><div class="weeks">' +
    rows.map(function (r) { return '<div class="wk' + (r.done ? ' done' : '') + '"><b>Week ' + r.w + '</b><span>' + (r.done ? 'Saved' : (r.due ? (c.p.mode === 'pilot' ? 'Open to preview' : 'Ready') : 'Opens on day ' + (r.w * 7))) + '</span></div>'; }).join('') + '</div></section>';
  var next = rows.filter(function (r) { return !r.done && r.due; })[0];
  if (state.flash) { h += '<p class="ok" role="status">' + esc(state.flash) + '</p>'; state.flash = ''; }
  if (next) h += surveyForm(next.w, next.w === nW);
  else if (rows.every(function (r) { return r.done; })) h += '<div class="banner">All surveys are saved. Thank you.</div>';
  else h += '<p class="note">No survey is due yet.</p>';
  if (c.p.mode === 'pilot') {
    h += '<form class="panel" data-form="pilotfb"><h3>Feedback on the prototype</h3><label class="f">What was confusing or hard to use?<textarea id="pf-1"></textarea></label>' +
      '<label class="f">Which version was easier to read at a glance, and why?<textarea id="pf-2"></textarea></label>' +
      '<label class="f">What did you feel when a day was missed?<textarea id="pf-3"></textarea></label><button class="btn" type="submit">Save feedback</button>' +
      (S.pilotFeedback.length ? '<p class="note">' + S.pilotFeedback.length + ' saved on this device.</p>' : '') + '</form>';
  }
  return h;
}

/* ---------- diary ---------- */
function viewDiary() {
  var h = '<section class="sect"><h2>Diary</h2><p class="lede">A place for notes about building a habit: moments you felt motivated, satisfied, frustrated or tempted to stop. These stay on your device and are never part of your study export.</p></section>';
  h += '<form class="panel" data-form="diary"><h3>New entry</h3><fieldset><legend>How did the moment feel?</legend><div class="row">' +
    FEELS.map(function (f) { return '<label class="opt"><input type="radio" name="feel" value="' + f + '"><span>' + f + '</span></label>'; }).join('') + '</div></fieldset>' +
    '<label class="f">What was happening?<textarea id="dy-text" placeholder="After a long lecture I skipped the workout and felt guilty."></textarea></label>' +
    '<label class="f">What would have helped? (optional)<input type="text" id="dy-help"></label><div class="err" id="dy-err" role="alert"></div><button class="btn primary" type="submit">Add entry</button></form>';
  var counts = {}; FEELS.forEach(function (f) { counts[f] = 0; }); S.diary.forEach(function (d) { counts[d.feel] = (counts[d.feel] || 0) + 1; });
  var mx = Math.max.apply(null, FEELS.map(function (f) { return counts[f]; }).concat([1]));
  var days = {}; S.diary.forEach(function (d) { days[d.ts.slice(0, 10)] = 1; });
  if (S.diary.length) {
    h += '<section class="sect"><h3>' + S.diary.length + ' entries on ' + Object.keys(days).length + ' days</h3><div class="bars">' +
      FEELS.map(function (f) { return '<div class="bar-row"><span>' + f + '</span><i style="width:' + Math.round(100 * counts[f] / mx) + '%"></i><span class="mono">' + counts[f] + '</span></div>'; }).join('') + '</div>' +
      S.diary.slice().reverse().map(function (d) { var i = S.diary.indexOf(d); return '<div class="entry"><span class="meta">' + esc(d.feel.toUpperCase()) + ' · ' + esc(d.ts.slice(0, 16).replace('T', ' ')) + '</span><p>' + esc(d.text) + '</p>' + (d.help ? '<p class="note">Would have helped: ' + esc(d.help) + '</p>' : '') + '<button class="btn link" style="align-self:flex-start" data-act="diarydel" data-i="' + i + '">Delete</button></div>'; }).join('') + '</section>';
  }
  h += '<details><summary>Questions to ask friends about habits</summary><ul class="plain"><li>What habit have you tried to build recently, and what happened?</li><li>How do you keep track of it now, if at all?</li><li>What does it feel like when you break a streak?</li><li>Did you ever stop using a tracker? What made you stop?</li><li>What would make looking at your progress feel good?</li></ul></details>';
  h += '<form class="panel" data-form="friend"><h3>Conversation notes</h3><label class="f">Who (initials or a label)<input type="text" id="fr-who" autocomplete="off"></label><label class="f">Notes<textarea id="fr-notes"></textarea></label><div class="err" id="fr-err" role="alert"></div><button class="btn" type="submit">Save notes</button></form>';
  if (S.friends.length) h += '<section class="sect"><h3>Conversations (' + S.friends.length + ')</h3>' + S.friends.map(function (f, i) { return '<div class="entry"><span class="meta">' + esc(f.who) + '</span><p>' + esc(f.notes) + '</p><button class="btn link" style="align-self:flex-start" data-act="frienddel" data-i="' + i + '">Delete</button></div>'; }).join('') + '</section>';
  if (S.diary.length || S.friends.length) h += '<div class="row"><button class="btn" data-act="dldiary">Download diary and notes</button></div>';
  return h;
}

/* ---------- data ---------- */
function viewData() {
  var h = '';
  if (S.profile) {
    var ex = CS.buildExport();
    h += '<section class="sect"><h2>Your data</h2><p class="lede">At the end of each phase, send your export to the researcher. It holds your daily log, survey answers and a count of visits. Diary notes are not included.</p>' +
      '<div class="row"><button class="btn primary" data-act="dlcsv">Download CSV</button><button class="btn" data-act="dljson">Download JSON</button><button class="btn" data-act="copyjson" id="copyjson">Copy JSON</button>' +
      (CFG.submitUrl ? '<button class="btn" data-act="send" id="sendbtn">Send to researcher</button>' : '') + '</div><p class="note" id="datamsg" role="status"></p>' +
      '<details><summary>Preview the CSV</summary><textarea class="codebox" readonly id="csvprev">' + esc(CS.csvOf(ex)) + '</textarea></details></section>';
    h += '<section class="sect"><h3>Backup</h3><p class="note">Your data lives in this browser. If you switch device or clear site data it is gone, so keep a backup.</p><div class="row"><button class="btn" data-act="backup">Download backup</button><label class="btn" style="cursor:pointer">Restore from backup<input type="file" id="restore" accept=".json,application/json" hidden></label></div></section>';
  } else {
    h += '<section class="sect"><h2>Your data</h2><p class="lede">Set up your habit on the Today tab to see your export here. If you have a backup file you can restore it now.</p><div class="row"><label class="btn" style="cursor:pointer">Restore from backup<input type="file" id="restore" accept=".json,application/json" hidden></label></div></section>';
  }
  h += '<section class="sect"><h3>Delete everything</h3>';
  if (!state.confirmReset) h += '<div class="row"><button class="btn danger" data-act="resetask">Delete all data stored here</button></div>';
  else h += '<p>This removes your habit, check-ins, surveys and diary from this browser. It cannot be undone. Download a backup first if you might want it.</p><div class="row"><button class="btn danger" data-act="resetgo">Delete everything</button><button class="btn" data-act="resetno">Keep my data</button></div>';
  return h + '</section>';
}
function msg(t) { var el = $('#datamsg'); if (el) el.textContent = t; }
function fname(ext) { var p = S.profile ? S.profile.pid : 'constellation'; return 'constellation-' + p + '-' + CS.keyOf(CS.nowDate()) + '.' + ext; }

/* ---------- actions ---------- */
var actions = {
  tab: function (b) { state.tab = b.dataset.tab; state.confirmReset = false; render(); window.scrollTo(0, 0); },
  habit: function (b) { var el = $('#su-habit'); if (el) { el.value = b.dataset.h; el.focus(); } },
  pmode: function (b) { ui.pilotMode = b.dataset.m; ui.viewPhase = null; render(true); },
  nextday: function () { S.offset = (S.offset || 0) + 1; ui.viewPhase = null; CS.save(); render(true); },
  sample: function () {
    S.checkins = {}; var pat = [1, 1, 1, 0, 1, 1, 1, 1, 0, 0, 1], r = CS.rng(5);
    pat.forEach(function (v, i) {
      if (!v) return; var date = CS.addDays(S.profile.startDate, i), hr = 19 + Math.floor(r() * 5), mn = Math.floor(r() * 60);
      S.checkins[date] = {ts: date + 'T' + pad(hr) + ':' + pad(mn) + ':00.000Z', time: pad(hr) + ':' + pad(mn), cond: ui.pilotMode, phase: 1, day: i + 1};
    });
    S.offset = 11; ui.viewPhase = null; CS.save(); render(true);
  },
  pilotreset: function () { S.checkins = {}; S.offset = 0; S.surveys = []; ui.viewPhase = null; CS.save(); render(true); },
  phase: function (b) { ui.viewPhase = +b.dataset.p; render(true); },
  checkin: checkin,
  undo: function () { var c = CS.ctx(); delete S.checkins[c.today]; S.events.push({t: 'undo', ts: new Date().toISOString()}); CS.save(); render(true); },
  diarydel: function (b) { S.diary.splice(+b.dataset.i, 1); CS.save(); render(true); },
  frienddel: function (b) { S.friends.splice(+b.dataset.i, 1); CS.save(); render(true); },
  dldiary: function () { CS.download('constellation-diary.json', JSON.stringify({diary: S.diary, friends: S.friends}, null, 2), 'application/json'); },
  dlcsv: function () { CS.download(fname('csv'), CS.csvOf(CS.buildExport()), 'text/csv'); msg('CSV downloaded.'); },
  dljson: function () { CS.download(fname('json'), JSON.stringify(CS.buildExport()), 'application/json'); msg('JSON downloaded.'); },
  copyjson: function () { CS.copy(JSON.stringify(CS.buildExport())).then(function () { msg('Copied to the clipboard.'); }, function () { msg('Copying is blocked here. Use Download JSON instead.'); }); },
  send: function () {
    var btn = $('#sendbtn'); btn.disabled = true; msg('Sending…');
    fetch(CFG.submitUrl, {method: 'POST', headers: {'Content-Type': 'application/json', 'Accept': 'application/json'}, body: JSON.stringify(CS.buildExport())})
      .then(function (r) { if (!r.ok) throw new Error(r.status); msg('Sent. Thank you. You can send again at the end of the next phase.'); })
      .catch(function () { msg('Could not send. Download the file and email it to the researcher instead.'); })
      .then(function () { btn.disabled = false; });
  },
  backup: function () { CS.download(fname('backup.json'), JSON.stringify(S), 'application/json'); msg('Backup downloaded.'); },
  resetask: function () { state.confirmReset = true; render(true); },
  resetno: function () { state.confirmReset = false; render(true); },
  resetgo: function () { CS.clearAll(); state.confirmReset = false; ui.viewPhase = null; state.tab = 'today'; render(); window.scrollTo(0, 0); }
};
var forms = {
  setup: function () {
    var mode = document.querySelector('input[name=su-mode]:checked').value, pid = $('#su-pid').value.trim(), habit = $('#su-habit').value.trim(), err = $('#su-err');
    if (mode === 'study' && !pid) { err.textContent = 'Enter the participant ID the researcher gave you.'; return; }
    if (mode === 'study' && !$('#su-agree').checked) { err.textContent = 'Tick the box to confirm you agree to take part, or choose "Just trying it".'; return; }
    if (!habit) { err.textContent = 'Describe the habit you want to build.'; return; }
    CS.replaceState({
      profile: {pid: pid || 'pilot', habit: habit, mode: mode, order: mode === 'study' ? $('#su-order').value : 'CN', phaseDays: mode === 'study' ? +$('#su-len').value : 14, startDate: CS.keyOf(new Date()), created: new Date().toISOString()},
      consent: mode === 'study' ? {ts: new Date().toISOString(), version: CONSENT_VERSION} : null
    });
    logOpen(); ui.viewPhase = null; state.tab = 'today'; render(); window.scrollTo(0, 0);
  },
  survey: function (f) {
    var w = +f.dataset.week, rec = {week: w, ts: new Date().toISOString()}, err = $('#sv-err'), c = CS.ctx();
    rec.phase = Math.floor(((w - 1) * 7) / c.L) + 1; rec.condition = CS.condOf(rec.phase - 1);
    var nomiss = f.querySelector('input[name=nomiss]').checked;
    for (var i = 0; i < CS.ITEMS.length; i++) {
      var k = CS.ITEMS[i][0], el = f.querySelector('input[name=q_' + k + ']:checked');
      if (!el) { if (k === 'discouraged' && nomiss) { rec[k] = null; continue; } err.textContent = 'Answer every question. For the last one you can tick that you did not miss a day.'; return; }
      rec[k] = +el.value;
    }
    rec.noMiss = nomiss;
    if (f.querySelector('input[name=pref]')) { var pe = f.querySelector('input[name=pref]:checked'); if (!pe) { err.textContent = 'Choose which version helped you most.'; return; } rec.preference = pe.value; }
    rec.comment = $('#sv-comment').value.trim();
    S.surveys.push(rec); CS.save(); state.flash = 'Week ' + w + ' survey saved. Thank you.'; render(); window.scrollTo(0, 0);
  },
  pilotfb: function () {
    S.pilotFeedback.push({ts: new Date().toISOString(), confusing: $('#pf-1').value.trim(), glance: $('#pf-2').value.trim(), missed: $('#pf-3').value.trim()});
    CS.save(); state.flash = 'Feedback saved.'; render(true);
  },
  diary: function () {
    var fe = document.querySelector('input[name=feel]:checked'), tx = $('#dy-text').value.trim(), err = $('#dy-err');
    if (!fe || !tx) { err.textContent = 'Choose how it felt and describe what was happening.'; return; }
    var d = new Date(); S.diary.push({ts: CS.keyOf(d) + 'T' + CS.hhmm(d), feel: fe.value, text: tx, help: $('#dy-help').value.trim()});
    CS.save(); render(true);
  },
  friend: function () {
    var who = $('#fr-who').value.trim(), notes = $('#fr-notes').value.trim(), err = $('#fr-err');
    if (!who || !notes) { err.textContent = 'Add a label and some notes.'; return; }
    S.friends.push({who: who, notes: notes}); CS.save(); render(true);
  }
};

document.addEventListener('click', function (e) { var b = e.target.closest('[data-act]'); if (!b) return; var fn = actions[b.dataset.act]; if (fn) fn(b, e); });
document.addEventListener('submit', function (e) { e.preventDefault(); var fn = forms[e.target.dataset.form]; if (fn) fn(e.target); });
document.addEventListener('change', function (e) {
  var t = e.target;
  if (t.name === 'su-mode') {
    var pilot = t.value === 'pilot';
    document.querySelectorAll('.study-only').forEach(function (el) { el.hidden = pilot; });
    $('#su-modenote').textContent = pilot ? 'Try both versions on the same data and move through days quickly. Nothing here counts toward the study.' : 'Study: you use one version for ' + CFG.phaseDays + ' days, then the other for ' + CFG.phaseDays + ' days.';
  }
  if (t.id === 'su-order') state.orderTouched = true;
  if (t.id === 'restore' && t.files && t.files[0]) {
    var fr = new FileReader();
    fr.onload = function () {
      try {
        var o = JSON.parse(fr.result);
        if (!o || typeof o !== 'object' || typeof o.checkins !== 'object') throw new Error('bad');
        CS.replaceState(o); ui.viewPhase = null; state.tab = 'today'; render(); window.scrollTo(0, 0);
      } catch (er) { msg('That file is not a Constellation backup.'); }
    };
    fr.readAsText(t.files[0]);
  }
});
document.addEventListener('input', function (e) {
  if (e.target.id === 'su-pid' && !state.orderTouched) {
    var m = e.target.value.match(/(\d+)\s*$/); if (m) $('#su-order').value = (+m[1]) % 2 === 1 ? 'CN' : 'NC';
  }
});

CS.mountDefs(); CS.registerSW(); logOpen(); render();
})();
