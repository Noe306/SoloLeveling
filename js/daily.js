/* ==========================================================================
   daily.js: Daily Quests (Solo Leveling style).

   RULES
   - Every day: 3 automatic quests "Learn your <class> lesson", Medium difficulty
     (+50 XP, +35 Gold each), category Homework. They give NO stat points one by
     one: completing ALL of them gives +1 INT (Knowledge) once for the day.
   - Classes come from the editable "My classes" list; each day takes the next 3
     different classes in rotation.
   - A day is INACTIVE unless all of that day's daily quests were completed
     (days the app was not opened count as inactive).
   - 4 inactive days in a row: the SHOWN rank drops by one (level is kept).
     Already at rank E: no effect. The counter then restarts.
   - Completing all 3 daily quests in a day removes the rank penalty.
   - A completed daily quest is locked (cannot be unchecked), so the penalty
     can't be cleared and then the rewards taken back.
   - At a new day, unfinished daily quests disappear and 3 new ones appear.
   ========================================================================== */

var DAILY_COUNT = 3;
var DAILY_DIFFICULTY = 'Medium';
var INACTIVE_DAYS_FOR_PENALTY = 4;
var DAILY_STAT_POINTS = 1;         // INT gained for completing ALL of a day's daily quests (none per single quest)
var DAILY_HISTORY_DAYS = 7;        // completed daily quests older than this are pruned from the save
var classEditorOpen = false;

/* ---------- Dates (local time, as "YYYY-MM-DD" keys that sort correctly) ---------- */
// window.__testNow lets the automated tests pretend it is another day.
function nowDate() { return window.__testNow ? new Date(window.__testNow) : new Date(); }
function dayKey(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function addDays(key, n) {
  var p = key.split('-');
  return dayKey(new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]) + n, 12));   // noon: safe across DST changes
}

/* ---------- Queries ---------- */
function dailyQuestsFor(key) { return gameState.tasks.filter(function (t) { return t.daily && t.dailyDate === key; }); }
function todaysDailies() { return dailyQuestsFor(gameState.daily.dayKey); }
function dayWasComplete(key) {
  var q = dailyQuestsFor(key);
  return q.length > 0 && q.every(function (t) { return t.completed; });
}

/* ---------- Generation ---------- */
function generateDaily(key) {
  var d = gameState.daily, classes = d.classes;
  d.dayStartRotation = d.rotation;
  if (!classes.length) return;
  var n = Math.min(DAILY_COUNT, classes.length);
  for (var i = n - 1; i >= 0; i--) {                       // unshift in reverse so they display in list order
    var name = classes[(d.rotation + i) % classes.length];
    gameState.tasks.unshift({
      id: 'd' + key.replace(/-/g, '') + '_' + i + '_' + Math.floor(Math.random() * 1e6),
      title: 'Learn your ' + name + ' lesson',
      category: 'Homework',
      difficulty: DAILY_DIFFICULTY,
      completed: false,
      createdAt: Date.now(),
      daily: true,
      dailyDate: key,
      className: name
    });
  }
  d.rotation = (d.rotation + n) % classes.length;
}

/* ---------- New-day processing ----------
   Called on load, every 30 s and when the tab becomes visible.
   Returns null if it is still the same day, otherwise a summary of what happened. */
function checkDailyRollover() {
  var d = gameState.daily, today = dayKey(nowDate());
  if (d.dayKey === today) return null;
  var result = { penalties: 0, streak: 0 };
  if (d.dayKey !== null && d.dayKey < today) {
    // Judge every finished day, from the last generated day up to yesterday (max one year).
    var guard = 0;
    for (var k = d.dayKey; k < today && guard < 366; k = addDays(k, 1), guard++) {
      if (dayWasComplete(k)) { d.inactiveStreak = 0; continue; }
      if (!d.classes.length) continue;                         // no classes set: nothing to judge
      d.inactiveStreak++;
      if (d.inactiveStreak >= INACTIVE_DAYS_FOR_PENALTY) {
        d.inactiveStreak = 0;
        if (displayRank() !== 'E') { d.rankPenalty++; result.penalties++; }   // rank E: no impact
      }
    }
    // Unfinished daily quests expire; completed ones are kept a few days as history.
    var oldest = addDays(today, -DAILY_HISTORY_DAYS);
    gameState.tasks = gameState.tasks.filter(function (t) {
      if (!t.daily || t.dailyDate === today) return true;
      return t.completed && t.dailyDate >= oldest;
    });
  }
  d.dayKey = today;
  generateDaily(today);
  result.streak = d.inactiveStreak;
  return result;
}

// Runs the rollover, saves, and tells the player what changed.
function runDailyCheck() {
  var r = checkDailyRollover();
  if (!r) return;
  commit();
  if (r.penalties > 0) {
    playSound('system');
    systemNotify({ title: 'Penalty: Rank Down', bad: true, ms: 7000, lines: [
      INACTIVE_DAYS_FOR_PENALTY + ' days without completing your daily quests.',
      'Your rank is now <b>' + displayRank() + '</b>. Complete all daily quests in one day to restore it.'] });
  } else {
    systemNotify({ title: 'New Daily Quests', lines: ['Today: ' + todaysDailies().map(function (t) { return esc(t.className); }).join(', ')] });
  }
}

// After a daily quest is completed (called from toggleTask).
function onDailyCompleted() {
  var d = gameState.daily, today = todaysDailies();
  if (!today.length || !today.every(function (t) { return t.completed; })) return;
  d.inactiveStreak = 0;
  var restored = d.rankPenalty > 0;
  d.rankPenalty = 0;
  // The whole daily set is worth ONE Knowledge (INT) point, given once per day.
  if (d.statAwardedDay !== d.dayKey) {
    gameState.stats.questPoints.Homework += DAILY_STAT_POINTS;
    d.statAwardedDay = d.dayKey;
  }
  systemNotify({ title: 'Daily Quests Complete', ms: 6000, lines: [
    'All daily quests done: <b>+' + DAILY_STAT_POINTS + ' INT</b> (Knowledge).',
    restored ? '<b>Rank restored to ' + displayRank() + '.</b>' : 'Your rank is safe.'] });
}

/* ---------- My classes ---------- */
// Editing classes regenerates TODAY's quests only if none of them is completed yet;
// otherwise the change applies from tomorrow.
function regenerateTodayIfUntouched() {
  var d = gameState.daily, today = todaysDailies();
  if (today.some(function (t) { return t.completed; })) return false;
  gameState.tasks = gameState.tasks.filter(function (t) { return !(t.daily && t.dailyDate === d.dayKey); });
  d.rotation = d.classes.length ? d.dayStartRotation % d.classes.length : 0;
  generateDaily(d.dayKey);
  return true;
}
function addClass(name) {
  var d = gameState.daily;
  name = String(name || '').trim().slice(0, 30);
  if (!name || d.classes.length >= 20) return;
  if (d.classes.some(function (c) { return c.toLowerCase() === name.toLowerCase(); })) return;
  d.classes.push(name);
  regenerateTodayIfUntouched();
  commit();
}
function removeClass(index) {
  var d = gameState.daily;
  d.classes.splice(index, 1);
  if (d.rotation >= d.classes.length) d.rotation = 0;
  if (d.dayStartRotation >= d.classes.length) d.dayStartRotation = 0;
  regenerateTodayIfUntouched();
  commit();
}

/* ---------- Rendering ---------- */
function renderDaily() {
  var d = gameState.daily, list = todaysDailies(), done = list.filter(function (t) { return t.completed; }).length;
  var r = DIFFICULTY[DAILY_DIFFICULTY];
  var html = '<h2>Daily Quest</h2>' +
    '<div class="daily-head"><span>[ LESSONS ] ' + esc(d.dayKey || '') + ' · ALL DONE: +' + DAILY_STAT_POINTS + ' INT' +
      (d.statAwardedDay === d.dayKey ? ' ✓' : '') + '</span><span class="daily-count">' + done + ' / ' + list.length + '</span></div>' +
    '<div class="bar"><div class="bar-fill" style="width:' + (list.length ? done / list.length * 100 : 0) + '%"></div></div>';

  if (!list.length) {
    html += '<p class="empty">[ Add at least one class below to receive daily quests. ]</p>';
  } else {
    html += '<ul class="task-list daily-list">' + list.map(function (t) {
      return '<li class="task daily ' + (t.completed ? 'done' : '') + '" data-id="' + esc(t.id) + '">' +
        '<input type="checkbox" class="task-check" aria-label="Complete ' + esc(t.title) + '"' + (t.completed ? ' checked disabled' : '') + '>' +
        '<div class="task-main"><div class="task-title">' + esc(t.title) + '</div>' +
        '<div class="task-meta"><span class="goal">GOAL [' + (t.completed ? 1 : 0) + '/1]</span>' +
        '<span class="badge diff-Medium">' + DIFFICULTY_RANK[DAILY_DIFFICULTY] + '-RANK · Medium</span>' +
        '<span class="reward">REWARD +' + r.xp + ' XP · +' + r.gold + ' G</span>' +
        (t.completed ? '<span class="badge locked">LOCKED</span>' : '') + '</div></div></li>';
    }).join('') + '</ul>';
  }

  if (d.rankPenalty > 0) {
    html += '<div class="daily-warn bad">⚠ PENALTY ACTIVE: your shown rank is lowered (now <b>RANK ' + displayRank() + '</b>). ' +
            'Complete all daily quests today to restore it.</div>';
  } else if (d.inactiveStreak > 0) {
    html += '<div class="daily-warn">Inactive days in a row: <b>' + d.inactiveStreak + ' / ' + INACTIVE_DAYS_FOR_PENALTY + '</b>. ' +
            'At ' + INACTIVE_DAYS_FOR_PENALTY + ', your shown rank drops by one. Complete all daily quests today to reset it.</div>';
  }

  html += '<div class="daily-foot"><span class="muted">Resets at midnight · unfinished quests expire · completed ones lock</span>' +
          '<button class="btn small" type="button" id="classToggle">' + (classEditorOpen ? 'Close' : 'My classes') + ' (' + d.classes.length + ')</button></div>';
  if (classEditorOpen) {
    html += '<div class="class-editor"><div class="class-chips">' + (d.classes.length ? d.classes.map(function (c, i) {
        return '<span class="class-chip">' + esc(c) + '<button type="button" class="class-del" data-i="' + i + '" aria-label="Remove ' + esc(c) + '">✕</button></span>';
      }).join('') : '<span class="muted">No classes yet.</span>') + '</div>' +
      '<form id="classForm" class="class-form" autocomplete="off"><input id="classInput" type="text" maxlength="30" placeholder="Add a class (e.g. Chemistry)" aria-label="Class name">' +
      '<button class="btn primary small" type="submit">Add</button></form>' +
      '<p class="muted">Each day takes the next ' + DAILY_COUNT + ' classes in this list. Changes apply today if no daily quest is completed yet, otherwise from tomorrow.</p></div>';
  }
  $('dailyWindow').innerHTML = html;
}

function initDaily() {
  var w = $('dailyWindow');
  w.addEventListener('click', function (e) {
    if (e.target.classList.contains('task-check')) {
      var li = e.target.closest('.task');
      if (li) toggleTask(li.dataset.id);
    } else if (e.target.id === 'classToggle') {
      classEditorOpen = !classEditorOpen; renderDaily();
      if (classEditorOpen) $('classInput').focus();
    } else if (e.target.classList.contains('class-del')) {
      removeClass(Number(e.target.dataset.i));
    }
  });
  w.addEventListener('submit', function (e) {
    if (e.target.id !== 'classForm') return;
    e.preventDefault();
    addClass($('classInput').value);
    if (classEditorOpen) $('classInput').focus();
  });
  setInterval(runDailyCheck, 30000);                                       // catches midnight while open
  document.addEventListener('visibilitychange', function () { if (!document.hidden) runDailyCheck(); });
}
