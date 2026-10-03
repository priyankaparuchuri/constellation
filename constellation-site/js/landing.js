/* Landing page: an animated sample sky built with the same renderer as the app. */
(function () {
'use strict';
var CS = window.CS, $ = function (s) { return document.querySelector(s); };
var PATTERN = [1, 1, 1, 0, 1, 1, 1, 1, 0, 1, 1, 0, 1, 1];
var L = 14, SEED = 'landing|0';
CS.mountDefs();

function days(upTo, pendingAt) {
  var out = [];
  for (var i = 0; i < L; i++) {
    var st = i < upTo ? (PATTERN[i] ? 'done' : 'missed') : (i === pendingAt ? 'today' : 'future');
    out.push({i: i, status: st});
  }
  return out;
}
function paint(el, d, label, lit) { el.innerHTML = CS.skySVG(d, L, SEED, label, lit) + CS.legend(); }

var hero = $('#hero-sky');
var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
var heroLabel = 'A sample constellation: fourteen days, eleven stars lit and three gaps.';
if (reduce) paint(hero, days(L, -1), heroLabel, null);
else {
  var step = 0, timer;
  var tick = function () {
    if (step > L) { step = 0; }
    if (step === 0) paint(hero, days(0, 0), heroLabel, null);
    else paint(hero, days(step, step < L ? step : -1), heroLabel, PATTERN[step - 1] ? step - 1 : null);
    var hold = step === L ? 4200 : 520;
    step++;
    timer = setTimeout(tick, hold);
  };
  tick();
  document.addEventListener('visibilitychange', function () { if (document.hidden) clearTimeout(timer); else { clearTimeout(timer); timer = setTimeout(tick, 300); } });
}

/* comparison: same twelve days, shown both ways */
var upTo = 12, pd = {done: 0, past: 12, best: 0, run: 0};
for (var i = 0, run = 0; i < upTo; i++) {
  if (PATTERN[i]) { pd.done++; run++; pd.best = Math.max(pd.best, run); } else run = 0;
  pd.run = run;
}
$('#cmp-counter').innerHTML = CS.counterHTML(pd);
paint($('#cmp-sky'), days(upTo, upTo), 'The same twelve days as a constellation, with three gaps and tonight\'s star waiting.', null);

var cfg = CS.cfg, foot = $('#foot-who');
if (foot && (cfg.institution || cfg.contactEmail)) {
  foot.textContent = 'Constellation, a design research project' + (cfg.institution ? ' at ' + cfg.institution : '') + (cfg.contactEmail ? '. Contact: ' + cfg.contactEmail : '') + '.';
}
CS.registerSW();
})();
