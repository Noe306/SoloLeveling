/* ==========================================================================
   main.js: bootstrap. Scripts sit at the end of <body>, so the DOM is ready.
   ========================================================================== */

initUI();
initTasks();
initTimer();
initShop();
initDaily();
renderAll();
runDailyCheck();       // new day? judge yesterday, apply any penalty, create today's 3 daily quests

// Another browser tab changed the save: adopt it so tabs never overwrite each other.
window.addEventListener('storage', function (e) {
  if (e.key === STORAGE_KEY) { gameState = loadState(); lastDragonKey = ''; renderAll(); }
});

/* ---- Optional dev helper (safe to delete) ----
   Open the browser console and try:  debug.gold(500)  debug.growth(600)  debug.xp(200)  */
window.debug = {
  gold: function (n) { changeGold(n); commit(); },
  xp: function (n) { var o = gameState.player.level, l = gainXP(n); commit(); if (l) showLevelUp(gameState.player.level, o); },
  growth: function (n) { var s = addGrowth(n); commit(); if (s) showEvolution(s); }
};
