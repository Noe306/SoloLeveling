/* ==========================================================================
   shop.js: Dragon Market (Module D): permanent gear, consumables, egg gate.
   ========================================================================== */

function gearBonusLabel(key, tierIdx) {
  var t = GEAR[key].tiers[tierIdx];
  return GEAR[key].kind === 'percent' ? '+' + Math.round(t.value * 100) + '% Growth Speed'
                                       : '+' + t.value + ' Flat Growth Points per focus minute';
}

function spend(cost) {
  if (gameState.player.gold < cost) return false;
  changeGold(-cost);
  playSound('kaching');
  return true;
}

function buyGear(key) {
  var tier = gameState.inventory[key];
  if (!GEAR[key] || tier >= 3) return;
  if (!spend(GEAR[key].tiers[tier].cost)) return;
  gameState.inventory[key] = tier + 1;
  commit();
}

function buyConsumable(kind) {
  var cost = kind === 'premiumFood' ? BERRY_COST : POTION_COST;
  if (!spend(cost)) return;
  gameState.inventory[kind]++;
  commit();
}

function useEnergyPotion() {
  var d = gameState.activeDragon;
  if (gameState.inventory.energyPotion < 1 || d.stage === 'Adult') return;
  gameState.inventory.energyPotion--;
  d.isSleepy = false;
  var evolved = addGrowth(POTION_POINTS);
  commit();
  floatText('+' + POTION_POINTS + ' Growth', 'xp');
  if (evolved) showEvolution(evolved);
}

// The gate is enforced HERE (not only by the disabled button).
function buyEgg() {
  var d = gameState.activeDragon;
  if (d.stage !== 'Adult') return;
  if (!spend(EGG_COST)) return;
  gameState.hallOfFame.push({
    name: d.name, element: d.element,
    totalFocusMinutes: Math.round(d.focusMinutes),
    dateCompleted: new Date().toISOString()
  });
  gameState.activeDragon = createDragon(pickNewElement());
  gameState.session = null;
  lastDragonKey = '';
  commit();
  showModal({ title: '🥚 A new egg!', html: '<p>Your Adult dragon was archived in the Hall of Fame. A new <strong>' +
    esc(gameState.activeDragon.element) + '</strong> egg awaits in the Sanctuary.</p>' });
}

// Weighted random: elements you have not collected yet are 3x more likely.
function pickNewElement() {
  var owned = {};
  gameState.hallOfFame.forEach(function (h) { owned[h.element] = true; });
  var weights = ELEMENTS.map(function (el) { return owned[el] ? 1 : 3; });
  var roll = Math.random() * weights.reduce(function (a, b) { return a + b; }, 0);
  for (var i = 0; i < ELEMENTS.length; i++) { roll -= weights[i]; if (roll < 0) return ELEMENTS[i]; }
  return ELEMENTS[0];
}

function renderShop() {
  var gold = gameState.player.gold, inv = gameState.inventory;
  var html = '<h2 class="section-title">Permanent Sanctuary Gear</h2><div class="shop-grid">';
  Object.keys(GEAR).forEach(function (key) {
    var g = GEAR[key], tier = inv[key], maxed = tier >= 3, next = maxed ? null : g.tiers[tier];
    html += '<div class="card shop-item"><div class="shop-icon">' + g.icon + '</div><h3>' + esc(g.name) + '</h3>' +
      '<p class="muted">' + esc(g.desc) + '</p><div class="tier-pips">' +
      [0, 1, 2].map(function (i) { return '<span class="pip' + (i < tier ? ' on' : '') + '"></span>'; }).join('') + '</div>' +
      '<p>' + (tier ? 'Current: ' + esc(gearBonusLabel(key, tier - 1)) : 'Not owned') + '</p>' +
      (maxed ? '<button class="btn" disabled>MAX TIER</button>'
             : '<button class="btn primary" data-buy="gear:' + key + '"' + (gold < next.cost ? ' disabled' : '') + '>Tier ' + (tier + 1) +
               ': ' + next.cost + 'g<br><small>' + esc(gearBonusLabel(key, tier)) + '</small></button>') + '</div>';
  });
  html += '</div><h2 class="section-title">Consumable Care Items</h2><div class="shop-grid">' +
    '<div class="card shop-item"><div class="shop-icon">🍓</div><h3>Spiced Dragon Berry</h3>' +
    '<p class="muted">Consumed automatically on your next completed focus session for +50% Growth Points.</p>' +
    '<p>Owned: <strong>' + inv.premiumFood + '</strong></p>' +
    '<button class="btn primary" data-buy="berry"' + (gold < BERRY_COST ? ' disabled' : '') + '>Buy: ' + BERRY_COST + 'g</button></div>' +
    '<div class="card shop-item"><div class="shop-icon">🧪</div><h3>Starlight Energy Potion</h3>' +
    '<p class="muted">Instantly removes Sleepy and grants +25 Growth Points. Use it from the Sanctuary.</p>' +
    '<p>Owned: <strong>' + inv.energyPotion + '</strong></p>' +
    '<button class="btn primary" data-buy="potion"' + (gold < POTION_COST ? ' disabled' : '') + '>Buy: ' + POTION_COST + 'g</button></div>' +
    '</div><h2 class="section-title">The Egg Hatchery</h2>';

  var adult = gameState.activeDragon.stage === 'Adult';
  html += '<div class="card shop-item egg-item"><div class="shop-icon">🥚</div><h3>Mystery Dragon Egg</h3>' +
    '<p class="muted">Archives your Adult dragon in the Hall of Fame and starts a new egg of a random element.</p>' +
    (adult ? '' : '<div class="banner lock">🔒 Locked: Raise your current dragon to Adult stage first!</div>') +
    '<button class="btn primary" data-buy="egg"' + (!adult || gold < EGG_COST ? ' disabled' : '') + '>Buy New Egg: ' + EGG_COST + 'g</button></div>';
  $('marketRoot').innerHTML = html;
}

function initShop() {
  $('marketRoot').addEventListener('click', function (e) {
    var btn = e.target.closest('[data-buy]');
    if (!btn || btn.disabled) return;
    var what = btn.dataset.buy;
    if (what.indexOf('gear:') === 0) buyGear(what.slice(5));
    else if (what === 'berry') buyConsumable('premiumFood');
    else if (what === 'potion') buyConsumable('energyPotion');
    else if (what === 'egg') buyEgg();
  });
}
