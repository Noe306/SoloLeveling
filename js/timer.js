/* ==========================================================================
   timer.js: Focus Timer + dragon growth (Module C).
   The countdown is TIMESTAMP based (not tick counting), so background-tab
   throttling or a page reload never skews the result.
   gameState.session = { durationMs, elapsedMs, startedAt, running }
   ========================================================================== */

var selectedMinutes = 25;
var lastDragonKey = '';
var timerInterval = null;

/* ---------- Growth math ---------- */
function gearBonus(key) {
  var tier = gameState.inventory[key] || 0;
  return tier > 0 ? GEAR[key].tiers[tier - 1].value : 0;
}

// speed = (1 + coat + room + berry) * sleepyModifier ; flat = feeding-station points/min.
// points per minute = 10 * speed + flat
function computeGrowth() {
  var berry = gameState.inventory.premiumFood > 0 ? BERRY_BONUS : 0;
  var speed = (1 + gearBonus('warmCoat') + gearBonus('insulatedRoom') + berry) *
              (gameState.activeDragon.isSleepy ? SLEEPY_MODIFIER : 1);
  var flat = gearBonus('arcaneIncubator');
  return { speed: speed, flat: flat, perMinute: BASE_POINTS_PER_MINUTE * speed + flat, usesBerry: berry > 0 };
}

// Adds growth points (clamped at MAX). Returns the new stage name if it evolved, else null.
function addGrowth(points) {
  var d = gameState.activeDragon, before = d.stage;
  d.currentGrowthPoints = Math.min(MAX_GROWTH, d.currentGrowthPoints + points);
  d.stage = stageForPoints(d.currentGrowthPoints);
  if (d.stage !== before) {
    if (before === 'Egg' && !d.hatchedDate) d.hatchedDate = new Date().toISOString();
    return d.stage;
  }
  return null;
}

function showEvolution(stage, extraHtml) {
  playSound('fanfare');
  var d = gameState.activeDragon;
  var html = '<div class="modal-dragon">' + renderDragon(d.element, stage) + '</div>' +
    '<p class="big"><strong>' + esc(d.name) + '</strong> evolved into a <strong>' + esc(stage) + '</strong>!</p>';
  if (stage === 'Adult') {
    html += '<p>Your dragon is fully grown! You can now archive it to the Hall of Fame and purchase a New Egg in the Dragon Market.</p>';
  }
  showModal({ title: '✨ Evolution! ✨', html: html + (extraHtml || '') });
}

/* ---------- Session control ---------- */
function sessionElapsedMs() {
  var s = gameState.session;
  if (!s) return 0;
  return s.elapsedMs + (s.running ? Date.now() - s.startedAt : 0);
}
function sessionRemainingMs() {
  var s = gameState.session;
  return s ? Math.max(0, s.durationMs - sessionElapsedMs()) : 0;
}

function startSession() {
  var s = gameState.session;
  if (gameState.activeDragon.stage === 'Adult') return;
  if (s) {                                   // resume a paused session
    if (!s.running) { s.running = true; s.startedAt = Date.now(); }
  } else {
    gameState.session = { durationMs: selectedMinutes * 60000, elapsedMs: 0, startedAt: Date.now(), running: true };
  }
  commit();
}

function pauseSession() {
  var s = gameState.session;
  if (!s || !s.running) return;
  s.elapsedMs += Date.now() - s.startedAt;
  s.running = false;
  commit();
}

function abandonSession() {
  var s = gameState.session;
  if (!s) return;
  if (sessionElapsedMs() < 60000) {           // under 1 minute: free reset, no penalty
    gameState.session = null;
    commit();
    return;
  }
  confirmDialog('Abandon session?',
    'Your dragon will earn 0 growth points and become Sleepy (-25% growth speed next session). Are you sure?',
    'Abandon', function () {
      gameState.session = null;
      gameState.activeDragon.isSleepy = true;
      gameState.stats.sessionsAbandoned++;                                    // lowers PATIENCE
      commit();
    });
}

function completeSession() {
  var s = gameState.session;
  if (!s) return;
  var minutes = s.durationMs / 60000;
  var g = computeGrowth();
  var points = Math.round(minutes * g.perMinute);
  if (g.usesBerry) gameState.inventory.premiumFood--;      // berry is consumed by a completed session
  gameState.activeDragon.isSleepy = false;                 // a full session cures Sleepy
  gameState.activeDragon.focusMinutes += minutes;
  gameState.stats.totalFocusMinutes += minutes;
  if (minutes >= PATIENCE_SESSION_MIN) gameState.stats.longSessions++;       // feeds PATIENCE
  gameState.stats.longestSession = Math.max(gameState.stats.longestSession, minutes);
  gameState.session = null;
  var evolved = addGrowth(points);
  commit();
  var summary = '<p class="gold-text">+' + points + ' Growth Points (' + minutes + ' min focus)</p>';
  if (evolved) { showEvolution(evolved, summary); }
  else {
    playSound('bell');
    showModal({ title: '🔔 Session complete!', html: '<p class="big">Great focus!</p>' + summary });
  }
}

function tick() {
  var s = gameState.session;
  if (s && s.running && sessionRemainingMs() <= 0) { completeSession(); return; }
  updateClock();
}

/* ---------- Rendering ---------- */
function fmtClock(ms) {
  var total = Math.ceil(ms / 1000);
  var m = Math.floor(total / 60), sec = total % 60;
  return (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec;
}

function updateClock() {
  var s = gameState.session;
  var text = s ? fmtClock(sessionRemainingMs()) : fmtClock(selectedMinutes * 60000);
  $('clock').textContent = text;
  document.title = s ? (s.running ? '⏳ ' : '⏸ ') + text + ' · Dragon Quest' : 'Dragon Quest: Tasks & Focus';
}

function renderSanctuary() {
  var d = gameState.activeDragon, s = gameState.session;
  var running = !!(s && s.running), adult = d.stage === 'Adult';

  var key = d.element + '|' + d.stage + '|' + running;
  if (key !== lastDragonKey) {
    $('dragonStage').innerHTML = renderDragon(d.element, d.stage, { wobble: running });
    lastDragonKey = key;
  }
  if (document.activeElement !== $('dragonName')) $('dragonName').value = d.name;
  $('dragonMeta').innerHTML = '<span class="badge el-' + d.element + '">' + d.element + '</span>' +
    '<span class="badge stage">' + d.stage + '</span>' +
    (d.isSleepy ? '<span class="badge sleepy">💤 Sleepy (-25%)</span>' : '');

  var g = computeGrowth();
  $('growthFill').style.width = (d.currentGrowthPoints / MAX_GROWTH * 100) + '%';
  $('growthText').textContent = adult ? 'MAX (Adult)' : Math.floor(d.currentGrowthPoints) + ' / ' + MAX_GROWTH;
  $('speedText').textContent = g.speed.toFixed(2) + 'x Growth Speed' + (g.flat ? ' · +' + g.flat + '/min' : '');
  $('adultBanner').classList.toggle('hidden', !adult);

  $('startBtn').textContent = running ? 'Focusing…' : (s ? 'Resume' : 'Start Focus');
  $('startBtn').disabled = adult || running;
  $('pauseBtn').disabled = !running;
  $('abandonBtn').disabled = !s;
  document.querySelectorAll('#presets .chip').forEach(function (b) {
    b.disabled = !!s;
    b.classList.toggle('active', !$('customMin').value && Number(b.dataset.min) === selectedMinutes);
  });
  $('customMin').disabled = !!s;
  $('sessionNote').textContent = adult ? 'Fully grown. Visit the Dragon Market for a new egg.'
    : s ? (running ? 'Stay focused! Leaving early makes your dragon Sleepy.' : 'Paused.')
    : 'Expected reward: ' + Math.round(selectedMinutes * g.perMinute) + ' growth points.';

  $('itemBerry').textContent = '🍓 Berries: ' + gameState.inventory.premiumFood + (g.usesBerry ? ' (active next session)' : '');
  $('usePotionBtn').textContent = '🧪 Use Energy Potion (' + gameState.inventory.energyPotion + ')';
  $('usePotionBtn').disabled = gameState.inventory.energyPotion < 1 || adult;
  updateClock();
}

function initTimer() {
  document.querySelectorAll('#presets .chip').forEach(function (b) {
    b.addEventListener('click', function () {
      selectedMinutes = Number(b.dataset.min);
      $('customMin').value = '';
      renderSanctuary();
    });
  });
  $('customMin').addEventListener('input', function () {
    var v = Math.floor(Number($('customMin').value));
    if (v >= 1 && v <= 180) selectedMinutes = v;
    renderSanctuary();
  });
  $('customMin').addEventListener('change', function () {   // clamp invalid entries on blur
    var v = Math.floor(Number($('customMin').value));
    if ($('customMin').value === '') return;
    v = Math.min(180, Math.max(1, v || 25));
    $('customMin').value = v;
    selectedMinutes = v;
    renderSanctuary();
  });
  $('startBtn').addEventListener('click', startSession);
  $('pauseBtn').addEventListener('click', pauseSession);
  $('abandonBtn').addEventListener('click', abandonSession);
  $('dragonName').addEventListener('change', function () {
    gameState.activeDragon.name = $('dragonName').value.trim().slice(0, 20) || 'Mystery Egg';
    commit();
  });
  $('dragonName').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });
  $('usePotionBtn').addEventListener('click', useEnergyPotion);

  // 4 ticks/second keeps the clock crisp; correctness comes from timestamps.
  timerInterval = setInterval(tick, 250);
}
