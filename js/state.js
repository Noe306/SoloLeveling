/* ==========================================================================
   state.js: constants, the central gameState, persistence and player math.
   RULE: UI renders FROM gameState. Every change goes through a function
   that ends with commit(), which saves to localStorage and re-renders.
   ========================================================================== */

var STORAGE_KEY = 'dragonQuestSave_v1';

/* ---------- Game constants (tweak balance here) ---------- */
var ELEMENTS = ['Fire', 'Ice', 'Forest', 'Storm', 'Cosmic'];
var MAX_GROWTH = 600;                 // growth points needed for Adult
var BASE_POINTS_PER_MINUTE = 10;
var SLEEPY_MODIFIER = 0.75;           // -25% speed while Sleepy
var BERRY_BONUS = 0.5;                // +50% for one session
var POTION_POINTS = 25;
var EGG_COST = 250;
var LEVEL_UP_BONUS_GOLD = 50;

var DIFFICULTY = {
  Easy:   { xp: 25,  gold: 15 },
  Medium: { xp: 50,  gold: 35 },
  Hard:   { xp: 100, gold: 75 }
};

// Stored category values differ from the form labels (see CLAUDE.md).
var CATEGORY_LABELS = { Homework: 'School / Homework', Work: 'Work', Personal: 'Chores / Life' };

// Stage thresholds in growth points.
var STAGES = [
  { name: 'Egg',       min: 0 },
  { name: 'Hatchling', min: 100 },
  { name: 'Juvenile',  min: 300 },
  { name: 'Adult',     min: 600 }
];

// Permanent gear. State keys stay as in the spec; names are display names.
var GEAR = {
  warmCoat: {
    name: 'Insulated Dragon Coat', icon: '🧥', kind: 'percent',
    desc: 'Keeps the dragon warm so it focuses energy on growing.',
    tiers: [{ cost: 100, value: 0.10 }, { cost: 250, value: 0.20 }, { cost: 500, value: 0.35 }]
  },
  insulatedRoom: {
    name: 'Thermal Isolation Room', icon: '🏠', kind: 'percent',
    desc: "Upgrades the dragon's habitat temperature and comfort.",
    tiers: [{ cost: 150, value: 0.15 }, { cost: 350, value: 0.30 }, { cost: 700, value: 0.50 }]
  },
  arcaneIncubator: {
    name: 'Arcane Feeding Station', icon: '🔮', kind: 'flat',
    desc: 'Automatically supplies nutrient-rich minerals.',
    tiers: [{ cost: 200, value: 2 }, { cost: 450, value: 5 }, { cost: 900, value: 10 }]
  }
};
var BERRY_COST = 40;
var POTION_COST = 30;

/* ---------- Pure helpers ---------- */
function xpToNext(level) { return Math.floor(100 * Math.pow(1.25, level - 1)); }

function titleForLevel(level) {
  if (level >= 20) return 'Grand Archmage';
  if (level >= 10) return 'Dragon Keeper';
  if (level >= 5) return 'Apprentice Mage';
  return 'Novice Scholar';
}

// Hunter-style rank shown next to the level (E lowest, S highest).
function rankForLevel(level) {
  if (level >= 30) return 'S';
  if (level >= 20) return 'A';
  if (level >= 15) return 'B';
  if (level >= 10) return 'C';
  if (level >= 5) return 'D';
  return 'E';
}

// Rank order, lowest to highest. The SHOWN rank can be lowered by the daily-quest
// penalty (see js/daily.js); the level itself never changes because of it.
var RANKS = ['E', 'D', 'C', 'B', 'A', 'S'];
function displayRank() {
  var base = RANKS.indexOf(rankForLevel(gameState.player.level));
  return RANKS[Math.max(0, base - gameState.daily.rankPenalty)];
}

// Quest difficulty shown as a rank letter in the quest log.
var DIFFICULTY_RANK = { Easy: 'E', Medium: 'C', Hard: 'A' };

// Stat progress from your own quests (cumulative over time, per category):
//   5 Easy quests = +1 point, 3 Medium = +1 point, 1 Hard = +1 point.
// Kept as whole "units" to avoid rounding: 15 units = 1 point; Easy 3, Medium 5, Hard 15.
// Mixed difficulties add up (e.g. 2 Easy + 2 Medium = 16 units = +1 point, 1 unit carried over).
var UNITS_PER_POINT = 15;
var QUEST_STAT_UNITS = { Easy: 3, Medium: 5, Hard: 15 };
var QUEST_STAT_LABEL = { Easy: '1/5 stat point', Medium: '1/3 stat point', Hard: '+1 stat point' };
// Legacy weights, only used to migrate very old saves (made before stat points were stored).
var QUEST_STAT_WEIGHT = { Easy: 1, Medium: 2, Hard: 3 };
var PATIENCE_SESSION_MIN = 25;   // a focus session must last this long to count toward Patience

// Status-window stats. Every stat starts at 10 and each is fed by ONE real activity:
//   INT      (Study)    Homework quests       5 Easy / 3 Medium / 1 Hard = +1 (+1 per full daily set)
//   STR      (Work)     Work quests           5 Easy / 3 Medium / 1 Hard = +1
//   VIT      (Life)     Chores/Life quests    5 Easy / 3 Medium / 1 Hard = +1
//   FOCUS    (Focus)    total focus minutes / 10
//   PATIENCE (Patience) +2 per completed focus session of 25+ min, +1 per 15 min of
//                       your longest session, -1 per abandoned session (never below 10)
// Quest points are stored in stats.questPoints (added on complete, removed on
// un-complete), so deleting a finished quest does not lose its stat gain.
// key = id used in code/saves, tag = anime-style short code shown on screen,
// name = what the stat means, source = what trains it (shown under the stat).
var STAT_INFO = [
  { key: 'INT',      tag: 'INT', name: 'Knowledge',  source: 'School / Homework quests' },
  { key: 'STR',      tag: 'ETH', name: 'Work Ethic', source: 'Work quests' },
  { key: 'VIT',      tag: 'DIS', name: 'Discipline', source: 'Chores / Life quests' },
  { key: 'FOCUS',    tag: 'FOC', name: 'Focus',      source: 'Focus timer minutes (÷ 10)' },
  { key: 'PATIENCE', tag: 'PAT', name: 'Patience',   source: 'Focus sessions of 25+ min (quitting costs points)' }
];
// Which stat each quest category trains (used by the quest form).
var CATEGORY_STAT = { Homework: 'Knowledge', Work: 'Work Ethic', Personal: 'Discipline' };

function computeStats() {
  var st = gameState.stats, q = st.questPoints;
  var patience = 10 + st.longSessions * 2 + Math.floor(st.longestSession / 15) - st.sessionsAbandoned;
  return {
    INT: 10 + q.Homework,
    STR: 10 + q.Work,
    VIT: 10 + q.Personal,
    FOCUS: 10 + Math.floor(st.totalFocusMinutes / 10),
    PATIENCE: Math.max(10, patience)
  };
}

function stageForPoints(points) {
  var stage = STAGES[0].name;
  STAGES.forEach(function (s) { if (points >= s.min) stage = s.name; });
  return stage;
}

function createDragon(element, name) {
  return {
    name: name || 'Mystery Egg',
    element: element,
    stage: 'Egg',
    currentGrowthPoints: 0,
    maxGrowthPoints: MAX_GROWTH,
    isSleepy: false,
    hatchedDate: null,
    focusMinutes: 0            // extra field: minutes invested in this dragon
  };
}

function defaultState() {
  return {
    player: { name: 'Hero', level: 1, currentXP: 0, xpToNextLevel: xpToNext(1), gold: 50, avatarTitle: titleForLevel(1) },
    tasks: [],
    activeDragon: createDragon('Fire'),
    inventory: { warmCoat: 0, insulatedRoom: 0, arcaneIncubator: 0, premiumFood: 0, energyPotion: 0 },
    hallOfFame: [],
    stats: {
      totalTasksCompleted: 0, totalFocusMinutes: 0,
      questPoints: { Homework: 0, Work: 0, Personal: 0 },  // whole stat points earned: feeds INT / STR / VIT
      questUnits: { Homework: 0, Work: 0, Personal: 0 },   // progress toward the next point (0-14 of 15)
      longSessions: 0,        // completed focus sessions of 25+ minutes
      longestSession: 0,      // minutes of the longest completed session
      sessionsAbandoned: 0
    },
    settings: { muted: false },
    // Daily quests (js/daily.js): 3 automatic "Learn your <class> lesson" quests per day.
    daily: {
      classes: [],           // the player adds their own classes in the app ("My classes")
      dayKey: null,          // last day (YYYY-MM-DD) the daily quests were generated for
      rotation: 0,           // where the next day's class rotation starts
      dayStartRotation: 0,   // rotation used for today's set (lets us regenerate today after editing classes)
      inactiveStreak: 0,     // days in a row without all daily quests completed
      statAwardedDay: '',    // day the "+1 INT for the full set" was already given (once per day)
      rankPenalty: 0         // how many ranks the SHOWN rank is lowered by
    },
    // In-progress focus session (null when idle). Persisted so a reload resumes it.
    session: null
  };
}

/* ---------- Persistence ---------- */
// Merge a loaded save over defaults so saves from older versions never break.
function deepMerge(base, over) {
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    if (over === undefined || over === null) return base;
    if (Array.isArray(base)) return Array.isArray(over) ? over : base;
    return typeof over === typeof base ? over : base;
  }
  var out = {};
  Object.keys(base).forEach(function (k) {
    var b = base[k], o = over && typeof over === 'object' ? over[k] : undefined;
    if (b === null) out[k] = o === undefined ? null : o;   // nullable fields (e.g. session)
    else out[k] = deepMerge(b, o);
  });
  return out;
}

function sanitizeState(s) {
  var p = s.player;
  p.level = Math.max(1, Math.floor(p.level) || 1);
  p.xpToNextLevel = xpToNext(p.level);
  p.currentXP = Math.max(0, p.currentXP);
  p.gold = Math.max(0, p.gold);
  p.avatarTitle = titleForLevel(p.level);
  var d = s.activeDragon;
  if (ELEMENTS.indexOf(d.element) < 0) d.element = 'Fire';
  d.currentGrowthPoints = Math.min(MAX_GROWTH, Math.max(0, d.currentGrowthPoints));
  d.stage = stageForPoints(d.currentGrowthPoints);
  s.tasks = s.tasks.filter(function (t) { return t && typeof t.title === 'string'; });
  return s;
}

function loadState() {
  try {
    var raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      var parsed = JSON.parse(raw);
      var merged = deepMerge(defaultState(), parsed);
      // Saves made before quest stat points existed: rebuild them once from finished quests (current rules).
      if (!(parsed && parsed.stats && parsed.stats.questPoints) && Array.isArray(merged.tasks)) {
        merged.tasks.forEach(function (t) {
          if (!t || !t.completed || t.daily || merged.stats.questPoints[t.category] === undefined) return;
          var u = merged.stats.questUnits[t.category] + (QUEST_STAT_UNITS[t.difficulty] || QUEST_STAT_UNITS.Easy);
          merged.stats.questPoints[t.category] += Math.floor(u / UNITS_PER_POINT);
          merged.stats.questUnits[t.category] = u % UNITS_PER_POINT;
        });
      }
      return sanitizeState(merged);
    }
  } catch (e) { /* corrupt or blocked storage: fall back to a fresh game */ }
  return defaultState();
}

function saveState() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(gameState)); } catch (e) { /* storage full/blocked */ }
  if (typeof onLocalSaved === 'function') onLocalSaved();   // auth.js: mark changed + push to the cloud when logged in
}

var gameState = loadState();

// Save + re-render. Call after EVERY state mutation.
function commit() {
  saveState();
  if (typeof renderAll === 'function') renderAll();
}

function resetState() {
  gameState = defaultState();
  if (typeof checkDailyRollover === 'function') checkDailyRollover();   // fresh daily quests right away
  commit();
}

/* ---------- Player economy ---------- */
function changeGold(delta) {
  var before = gameState.player.gold;
  gameState.player.gold = Math.max(0, before + delta);
  var applied = gameState.player.gold - before;
  if (applied !== 0 && typeof floatText === 'function') {
    floatText((applied > 0 ? '+' : '') + applied + ' Gold', applied > 0 ? 'gold' : 'loss');
  }
}

// Adds XP, handles multiple level-ups, returns the number of levels gained.
function gainXP(amount) {
  var p = gameState.player, gained = 0;
  p.currentXP += amount;
  while (p.currentXP >= p.xpToNextLevel) {
    p.currentXP -= p.xpToNextLevel;
    p.level++;
    p.xpToNextLevel = xpToNext(p.level);
    p.gold += LEVEL_UP_BONUS_GOLD;
    gained++;
  }
  p.avatarTitle = titleForLevel(p.level);
  return gained;
}

// Reverses XP (used when un-completing a task). De-levelling also takes back
// the level-up bonus gold so check/uncheck loops can't be farmed.
function loseXP(amount) {
  var p = gameState.player;
  p.currentXP -= amount;
  while (p.currentXP < 0 && p.level > 1) {
    p.level--;
    p.xpToNextLevel = xpToNext(p.level);
    p.currentXP += p.xpToNextLevel;
    p.gold = Math.max(0, p.gold - LEVEL_UP_BONUS_GOLD);
  }
  if (p.currentXP < 0) p.currentXP = 0;
  p.avatarTitle = titleForLevel(p.level);
}
