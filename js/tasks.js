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

// Adds (sign +1) or removes (sign -1) a quest's stat points: INT/STR/VIT by category.
function addQuestStat(task, sign) {
  var q = gameState.stats.questPoints;
  if (q[task.category] === undefined) return;
  q[task.category] = Math.max(0, q[task.category] + sign * (QUEST_STAT_WEIGHT[task.difficulty] || 1));
}

function toggleTask(id) {
  var t = gameState.tasks.filter(function (x) { return x.id === id; })[0];
  if (!t) return;
  var reward = DIFFICULTY[t.difficulty] || DIFFICULTY.Easy;

  if (!t.completed) {
    // --- Claim reward ---
    t.completed = true;
    t.completedAt = Date.now();
    t.awardedXP = reward.xp;          // remembered so un-checking can reverse it exactly
    t.awardedGold = reward.gold;
    gameState.stats.totalTasksCompleted++;
    addQuestStat(t, +1);
    var oldLevel = gameState.player.level;
    var levels = gainXP(reward.xp);
    changeGold(reward.gold);
    floatText('+' + reward.xp + ' XP', 'xp');
    systemNotify({
      title: 'Quest Complete',
      lines: [esc(t.title), 'REWARD: <b>+' + reward.xp + ' XP</b> &nbsp; <b>+' + reward.gold + ' G</b>']
    });
    playSound('system');
    setTimeout(function () { playSound('coin'); }, 250);
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
  var shown = gameState.tasks.filter(function (t) {
    return taskFilter === 'all' || (taskFilter === 'active' ? !t.completed : t.completed);
  });
  if (!shown.length) {
    list.innerHTML = '<li class="empty">' + (gameState.tasks.length ? '[ No quests match this filter ]' : '[ No active quests. Accept a new quest above. ]') + '</li>';
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
    '<span class="title-badge">' + esc(p.avatarTitle) + '</span> <span class="rank-badge">RANK ' + rankForLevel(p.level) + '</span></div>' +
    '<div class="stat-list">' + STAT_INFO.map(function (info) {
      var v = stats[info.key];
      return '<div class="stat-row"><span class="stat-name">' + esc(info.tag) + '</span><span class="stat-val">' + v +
             '</span><span class="stat-bar"><i style="width:' + Math.min(100, v / cap * 100) + '%"></i></span>' +
             '<span class="stat-hint">' + esc(info.name) + '<small>' + esc(info.source) + '</small></span></div>';
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
