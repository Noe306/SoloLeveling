/* ==========================================================================
   hall.js: Hall of Fame (Module E): archived Adult dragons + element tracker.
   ========================================================================== */

function renderHall() {
  var hall = gameState.hallOfFame;
  var unlocked = {};
  hall.forEach(function (h) { unlocked[h.element] = true; });
  var current = gameState.activeDragon.element;

  var html = '<h2 class="section-title">Elemental Collection</h2><div class="collection">' +
    ELEMENTS.map(function (el) {
      var state = unlocked[el] ? 'unlocked' : (el === current ? 'progress' : 'locked');
      var label = unlocked[el] ? 'Unlocked' : (el === current ? 'In progress' : 'Undiscovered');
      return '<div class="el-slot ' + state + '"><span class="badge el-' + el + '">' + el + '</span><small>' + label + '</small></div>';
    }).join('') + '</div>' +
    '<p class="muted">' + Object.keys(unlocked).length + ' / ' + ELEMENTS.length + ' elements collected</p>' +
    '<h2 class="section-title">Dragons Raised</h2>';

  if (!hall.length) {
    html += '<div class="empty card">No graduated dragons yet. Raise your dragon to Adult and buy a new egg to archive it here.</div>';
  } else {
    html += '<div class="hall-grid">' + hall.slice().reverse().map(function (h) {
      return '<div class="card hall-card"><div class="hall-portrait">' + renderDragon(h.element, 'Adult') + '</div>' +
        '<h3>' + esc(h.name) + '</h3><span class="badge el-' + esc(h.element) + '">' + esc(h.element) + '</span>' +
        '<p>⏱ ' + h.totalFocusMinutes + ' focus min</p>' +
        '<p class="muted">Graduated ' + esc(new Date(h.dateCompleted).toLocaleDateString()) + '</p></div>';
    }).join('') + '</div>';
  }
  $('hallRoot').innerHTML = html;
}
