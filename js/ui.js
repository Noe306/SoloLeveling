/* ==========================================================================
   ui.js: header/profile, tabs, floating toasts, modals, master renderAll().
   ========================================================================== */

function $(id) { return document.getElementById(id); }

// Escape user text before putting it into an innerHTML template.
function esc(s) {
  return String(s).replace(/[&<>"']/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
  });
}

/* ---------- Floating text (+Gold, -Gold, +XP) ---------- */
function floatText(text, kind) {
  var el = document.createElement('div');
  el.className = 'float-text ' + (kind || 'gold');
  el.textContent = text;
  el.style.right = (24 + Math.floor(Math.random() * 60)) + 'px';
  $('floatLayer').appendChild(el);
  setTimeout(function () { el.remove(); }, 1700);
}

/* ---------- Modals ---------- */
// opts: { title, html (trusted markup), buttons: [{label, primary, danger, onClick}] }
function showModal(opts) {
  var root = $('modalRoot');
  var overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  var box = document.createElement('div');
  box.className = 'modal' + (opts.className ? ' ' + opts.className : '');
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.innerHTML = '<h2>' + esc(opts.title) + '</h2><div class="modal-body">' + (opts.html || '') + '</div>';
  var actions = document.createElement('div');
  actions.className = 'modal-actions';
  function close() { overlay.remove(); }
  (opts.buttons || [{ label: 'OK', primary: true }]).forEach(function (b) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'btn' + (b.primary ? ' primary' : '') + (b.danger ? ' danger' : '');
    btn.textContent = b.label;
    btn.addEventListener('click', function () { close(); if (b.onClick) b.onClick(); });
    actions.appendChild(btn);
  });
  box.appendChild(actions);
  overlay.appendChild(box);
  root.appendChild(overlay);
  var first = actions.querySelector('.primary') || actions.querySelector('button');
  if (first) first.focus();
  return close;
}

function confirmDialog(title, message, yesLabel, onYes) {
  showModal({
    title: title,
    html: '<p>' + esc(message) + '</p>',
    buttons: [{ label: 'Cancel' }, { label: yesLabel, danger: true, onClick: onYes }]
  });
}

/* ---------- [ SYSTEM ] notification toast ----------
   systemNotify({ title, lines: [html strings, trusted], bad: true for red }) */
function systemNotify(opts) {
  var el = document.createElement('div');
  el.className = 'notify' + (opts.bad ? ' bad' : '');
  el.innerHTML = '<div class="notify-tag">[ SYSTEM ]</div><div class="notify-title">' + esc(opts.title) + '</div>' +
    (opts.lines || []).map(function (l) { return '<div class="notify-line">' + l + '</div>'; }).join('');
  $('notifyLayer').appendChild(el);
  setTimeout(function () { el.classList.add('out'); setTimeout(function () { el.remove(); }, 380); }, opts.ms || 4200);
}

/* ---------- Level Up window ----------
   oldLevel is optional (defaults to level - 1); it can differ by more than 1. */
function showLevelUp(level, oldLevel) {
  oldLevel = oldLevel || level - 1;
  var levels = level - oldLevel;
  playSound('system');
  setTimeout(function () { playSound('fanfare'); }, 350);
  var html = '<div class="sys-tag">[ SYSTEM ]</div>' +
    '<div class="levelup-title">LEVEL UP</div>' +
    '<div class="levelup-nums">LV ' + oldLevel + '<span>▶</span>' + level + '</div>' +
    '<div class="sys-divider"></div>' +
    '<div class="levelup-line">You have leveled up.</div>';
  if (rankForLevel(level) !== rankForLevel(oldLevel)) {
    html += '<div class="levelup-line">RANK UP: <b>' + rankForLevel(oldLevel) + '</b> ▶ <b>' + rankForLevel(level) + '</b></div>';
  }
  if (titleForLevel(level) !== titleForLevel(oldLevel)) {
    html += '<div class="levelup-line">TITLE ACQUIRED: <b>' + esc(titleForLevel(level)) + '</b></div>';
  }
  html += '<div class="levelup-line">REWARD: <span class="gold-text">+' + (LEVEL_UP_BONUS_GOLD * levels) + ' G</span></div>';
  showModal({ title: 'Notification', className: 'system', html: html, buttons: [{ label: 'Confirm', primary: true }] });
}

/* ---------- Header / profile ---------- */
function avatarFrameColor(level) {
  if (level >= 20) return '#e879f9';
  if (level >= 10) return '#f59e0b';
  if (level >= 5) return '#38bdf8';
  return '#94a3b8';
}

function renderAvatar(level) {
  var c = avatarFrameColor(level);
  return '<svg viewBox="0 0 64 64" width="56" height="56">' +
    '<path d="M32 3 L58 12 V32 C58 47 46 58 32 62 C18 58 6 47 6 32 V12 Z" fill="#1e293b" stroke="' + c + '" stroke-width="4"/>' +
    '<circle cx="32" cy="26" r="9" fill="' + c + '"/>' +
    '<path d="M16 50 C18 38 46 38 48 50 C42 56 22 56 16 50 Z" fill="' + c + '"/>' +
    '</svg>';
}

var lastAvatarLevel = -1;
function renderHeader() {
  var p = gameState.player;
  if (lastAvatarLevel !== p.level) { $('avatar').innerHTML = renderAvatar(p.level); lastAvatarLevel = p.level; }
  var nameEl = $('playerName');
  if (document.activeElement !== nameEl) nameEl.value = p.name;
  $('playerTitle').textContent = p.avatarTitle;
  $('playerLevel').textContent = 'LV ' + p.level;
  var pen = gameState.daily.rankPenalty > 0;
  $('playerRank').textContent = 'RANK ' + displayRank() + (pen ? ' ▼' : '');
  $('playerRank').classList.toggle('penalty', pen);
  $('playerRank').title = pen ? 'Rank lowered by the daily-quest penalty' : '';
  $('xpFill').style.width = Math.min(100, (p.currentXP / p.xpToNextLevel) * 100) + '%';
  $('xpText').textContent = p.currentXP + ' / ' + p.xpToNextLevel + ' XP';
  $('goldValue').textContent = p.gold;
  $('muteBtn').textContent = gameState.settings.muted ? '🔇' : '🔊';
}

/* ---------- Tabs ---------- */
function setTab(name) {
  document.querySelectorAll('.tab').forEach(function (b) { b.classList.toggle('active', b.dataset.tab === name); });
  document.querySelectorAll('.panel').forEach(function (p) { p.classList.toggle('active', p.id === 'tab-' + name); });
}

/* ---------- Master render ---------- */
function renderAll() {
  renderHeader();
  renderStatus();
  renderDaily();
  renderTasks();
  renderSanctuary();
  renderShop();
  renderHall();
}

function initUI() {
  document.querySelectorAll('.tab').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.dataset.tab); });
  });

  function saveName() {
    var v = $('playerName').value.trim().slice(0, 20);
    gameState.player.name = v || 'Hero';
    commit();
  }
  $('playerName').addEventListener('change', saveName);
  $('playerName').addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.blur(); });

  $('muteBtn').addEventListener('click', function () {
    gameState.settings.muted = !gameState.settings.muted;
    commit();
    playSound('coin');
  });

  $('resetBtn').addEventListener('click', function () {
    confirmDialog('Reset Save Data', 'This permanently deletes your level, gold, tasks, dragons and Hall of Fame. Continue?', 'Delete Everything', function () {
      resetState();
    });
  });
}
