/* ==========================================================================
   tasks.js: Quest Board (Module B). Completing tasks awards XP + Gold;
   un-completing reverses exactly what was awarded (no farming).
   ========================================================================== */

var taskFilter = 'all';

function addTask(title, category, difficulty) {
  title = title.trim();
  if (!title || !CATEGORY_LABELS[category] || !DIFFICULTY[difficulty]) return;   // a category must be chosen
  gameState.tasks.unshift({
    id: 't' + Date.now() + Math.floor(Math.random() * 1000),
    title: title.slice(0, 100),
    category: category,
    difficulty: difficulty,
    completed: false,
    createdAt: Date.now()
  });
  commit();
}

// Adds (sign +1) or removes (sign -1) a quest's share of a stat point (INT/STR/VIT by category).
// 5 Easy / 3 Medium / 1 Hard = +1 point; progress carries over (see QUEST_STAT_UNITS in state.js).
// Returns the change in whole points (e.g. +1 when this quest completed a point).
function addQuestStat(task, sign) {
  if (task.daily) return 0;             // daily quests give +1 INT only once ALL of the day's set is done (js/daily.js)
  var st = gameState.stats, cat = task.category, before;
  if (st.questPoints[cat] === undefined) return 0;
  before = st.questPoints[cat];
  st.questUnits[cat] += sign * (QUEST_STAT_UNITS[task.difficulty] || QUEST_STAT_UNITS.Easy);
  while (st.questUnits[cat] >= UNITS_PER_POINT) { st.questUnits[cat] -= UNITS_PER_POINT; st.questPoints[cat]++; }
  while (st.questUnits[cat] < 0) {      // un-completing can take a point back
    if (st.questPoints[cat] > 0) { st.questPoints[cat]--; st.questUnits[cat] += UNITS_PER_POINT; }
    else st.questUnits[cat] = 0;
  }
  return st.questPoints[cat] - before;
}
// Which on-screen stat tag a category trains (INT / ETH / DIS).
function statTagFor(category) {
  var key = { Homework: 'INT', Work: 'STR', Personal: 'VIT' }[category];
  var info = STAT_INFO.filter(function (s) { return s.key === key; })[0];
  return info ? info.tag : '';
}

function toggleTask(id) {
  var t = gameState.tasks.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  if (t.daily && t.completed) return;   // completed daily quests are locked (see js/daily.js)
  var reward = DIFFICULTY[t.difficulty] || DIFFICULTY.Easy;

  if (!t.completed) {
    // --- Claim reward ---
    t.completed = true;
    t.completedAt = Date.now();
    t.awardedXP = reward.xp;          // remembered so un-checking can reverse it exactly
    t.awardedGold = reward.gold;
    gameState.stats.totalTasksCompleted++;
    var statGain = addQuestStat(t, +1);
    var oldLevel = gameState.player.level;
    var levels = gainXP(reward.xp);
    changeGold(reward.gold);
    floatText('+' + reward.xp + ' XP', 'xp');
    var lines = [esc(t.title), 'REWARD: <b>+' + reward.xp + ' XP</b> &nbsp; <b>+' + reward.gold + ' G</b>'];
    if (statGain > 0) lines.push('STAT UP: <b>+' + statGain + ' ' + statTagFor(t.category) + '</b>');
    systemNotify({ title: 'Quest Complete', lines: lines });
    playSound('system');
    setTimeout(function () { playSound('coin'); }, 250);
    if (t.daily) onDailyCompleted();      // all 3 done: reset the inactive counter, lift any rank penalty
    commit();
    if (levels > 0) showLevelUp(gameState.player.level, oldLevel);
  } else {
    // --- Reverse reward ---
    var xp = t.awardedXP || reward.xp, gold = t.awardedGold || reward.gold;
    t.completed = false;
    delete t.completedAt; delete t.awardedXP; delete t.awardedGold;
    gameState.stats.totalTasksCompleted = Math.max(0, gameState.stats.totalTasksCompleted - 1);
    addQuestStat(t, -1);
    loseXP(xp);
    changeGold(-gold);
    floatText('-' + xp + ' XP', 'loss');
    systemNotify({ title: 'Quest Revoked', bad: true, lines: [esc(t.title), 'Reward returned: <b>-' + xp + ' XP</b> &nbsp; <b>-' + gold + ' G</b>'] });
    commit();
  }
}

function deleteTask(id) {
  // Deleting a completed task keeps the rewards already earned (it is just history).
  gameState.tasks = gameState.tasks.filter(function (x) { return x.id !== id; });
  commit();
}

function renderTasks() {
  var list = $('taskList');
  var own = gameState.tasks.filter(function (t) { return !t.daily; });   // daily quests live in their own window
  var shown = own.filter(function (t) {
    return taskFilter === 'all' || (taskFilter === 'active' ? !t.completed : t.completed);
  });
  if (!shown.length) {
    list.innerHTML = '<li class="empty">' + (own.length ? '[ No quests match this filter ]' : '[ No active quests. Accept a new quest above. ]') + '</li>';
    return;
  }
  list.innerHTML = shown.map(function (t) {
    var r = DIFFICULTY[t.difficulty] || DIFFICULTY.Easy;
    return '<li class="task ' + (t.completed ? 'done' : '') + '" data-id="' + esc(t.id) + '">' +
      '<input type="checkbox" class="task-check" aria-label="Complete ' + esc(t.title) + '"' + (t.completed ? ' checked' : '') + '>' +
      '<div class="task-main"><div class="task-title">' + esc(t.title) + '</div>' +
      '<div class="task-meta"><span class="goal">GOAL [' + (t.completed ? 1 : 0) + '/1]</span>' +
      '<span class="badge cat">' + esc(CATEGORY_LABELS[t.category] || t.category) + '</span>' +
      '<span class="badge diff-' + esc(t.difficulty) + '">' + esc(DIFFICULTY_RANK[t.difficulty] || '?') + '-RANK · ' + esc(t.difficulty) + '</span>' +
      '<span class="reward">REWARD +' + r.xp + ' XP · +' + r.gold + ' G</span></div></div>' +
      '<button class="icon-btn del" type="button" aria-label="Delete quest" title="Delete">✕</button></li>';
  }).join('');
}

// Status window: identity on the left, derived stats on the right.
function renderStatus() {
  var p = gameState.player, stats = computeStats();
  var cap = Math.max(50, Math.max.apply(null, Object.keys(stats).map(function (k) { return stats[k]; })));
  $('statusWindow').innerHTML =
    '<h2>Status</h2><div class="status-grid">' +
    '<div class="status-id"><div class="status-name">' + esc(p.name) + '</div>' +
    '<div class="status-level"><small>LEVEL</small>' + p.level + '</div>' +
    '<span class="title-badge">' + esc(p.avatarTitle) + '</span> <span class="rank-badge' + (gameState.daily.rankPenalty ? ' penalty' : '') + '">RANK ' + displayRank() + (gameState.daily.rankPenalty ? ' ▼' : '') + '</span></div>' +
    '<div class="stat-list">' + STAT_INFO.map(function (info) {
      var v = stats[info.key];
      // Quest stats also show progress toward their next point.
      var cat = { INT: 'Homework', STR: 'Work', VIT: 'Personal' }[info.key];
      var next = cat ? ' · next point ' + Math.round(gameState.stats.questUnits[cat] / UNITS_PER_POINT * 100) + '%' : '';
      return '<div class="stat-row"><span class="stat-name">' + esc(info.tag) + '</span><span class="stat-val">' + v +
             '</span><span class="stat-bar"><i style="width:' + Math.min(100, v / cap * 100) + '%"></i></span>' +
             '<span class="stat-hint">' + esc(info.name) + '<small>' + esc(info.source) + next + '</small></span></div>';
    }).join('') + '</div></div>';
}

function initTasks() {
  $('taskForm').addEventListener('submit', function (e) {
    e.preventDefault();
    addTask($('taskTitle').value, $('taskCategory').value, $('taskDifficulty').value);
    $('taskTitle').value = '';
    $('taskCategory').value = '';       // force a fresh category choice for every quest
    $('taskTitle').focus();
  });
  $('taskList').addEventListener('click', function (e) {
    var li = e.target.closest('.task');
    if (!li) return;
    if (e.target.classList.contains('task-check')) toggleTask(li.dataset.id);
    else if (e.target.classList.contains('del')) deleteTask(li.dataset.id);
  });
  document.querySelectorAll('.filters .chip').forEach(function (b) {
    b.addEventListener('click', function () {
      taskFilter = b.dataset.filter;
      document.querySelectorAll('.filters .chip').forEach(function (c) { c.classList.toggle('active', c === b); });
      renderTasks();
    });
  });
}
