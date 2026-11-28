/* ==========================================================================
   habitats/registry.js: the list of the 16 elements + the habitat registry.

   Every habitat lives in its own file (habitats/<id>.js) and registers itself:

     HABITATS.register({
       id: 'ice',                 // must match an id in HABITAT_ELEMENTS
       levels: 2,                 // how many levels are designed so far (1-5)
       footprint: 1.3,            // radius the habitat covers (no grass inside it)
       dragonSpot: { x, y, z, r },// where the grown dragon will rest (kept free)
       build: function (level, ctx) { return THREE.Group }
     });

   build(level) must return the WHOLE habitat at that level. The rule
   "level N = level N-1 + new parts" is kept by writing the build as a chain of
   `if (level >= n) { ...add layer n... }` blocks.

   ctx (given by the viewer):
     ctx.rng(seed)  seeded random numbers (same result on every build)
     ctx.anim(fn)   register fn(time, dt) to run every frame; it is removed
                    automatically when the viewer rebuilds the scene

   Load order: three + add-ons -> lib/kit3d.js -> this file -> habitat files.
   ========================================================================== */

/* The 16 elements, in unlock order (rule 10 in PLAN.md).
   lv = player level that unlocks the element, th = Town Hall level needed to build its habitat,
   color = accent used by the gallery UI only. */
var HABITAT_ELEMENTS = [
  { id: 'fire',     name: 'Fire',     lv: 1,  th: 1, color: '#ff7a3d', idea: 'lava cauldron on chains, fire around' },
  { id: 'water',    name: 'Water',    lv: 2,  th: 1, color: '#4aa8ff', idea: 'willow tree on a pond island' },
  { id: 'earth',    name: 'Earth',    lv: 3,  th: 2, color: '#c9a46a', idea: 'cactus desert' },
  { id: 'forest',   name: 'Forest',   lv: 4,  th: 2, color: '#5fcf6a', idea: 'big jungle tree' },
  { id: 'ice',      name: 'Ice',      lv: 5,  th: 3, color: '#8fe3ff', idea: 'ice crystals around a frozen pool' },
  { id: 'electric', name: 'Electric', lv: 6,  th: 3, color: '#ffe14a', idea: 'yellow crystal spikes on sand' },
  { id: 'wind',     name: 'Wind',     lv: 7,  th: 4, color: '#bfeee0', idea: 'crystal windmill on clouds' },
  { id: 'metal',    name: 'Metal',    lv: 8,  th: 4, color: '#a9b4c2', idea: 'metal pillars on stone tiles' },
  { id: 'light',    name: 'Light',    lv: 9,  th: 5, color: '#fff3c4', idea: 'white marble arches on clouds' },
  { id: 'dark',     name: 'Dark',     lv: 10, th: 5, color: '#8a6bd1', idea: 'dead twisted tree in a misty swamp' },
  { id: 'poison',   name: 'Poison',   lv: 11, th: 6, color: '#9be04a', idea: 'dark rock with vines and bones' },
  { id: 'crystal',  name: 'Crystal',  lv: 12, th: 6, color: '#c77dff', idea: 'dark crystal with purple cracks and a floating orb' },
  { id: 'storm',    name: 'Storm',    lv: 13, th: 7, color: '#7f93b8', idea: 'grey rocks with mist' },
  { id: 'spirit',   name: 'Spirit',   lv: 14, th: 7, color: '#e6f0ff', idea: 'white marble garden with arches' },
  { id: 'time',     name: 'Time',     lv: 15, th: 8, color: '#e8c36a', idea: 'floating rock on chains over a starry pool' },
  { id: 'cosmic',   name: 'Cosmic',   lv: 16, th: 8, color: '#6f7dff', idea: 'impossible-triangle sculpture in the desert' }
];

/* Max level of every habitat (rule 3: level N holds N dragons). */
var HABITAT_MAX_LEVEL = 5;

var HABITATS = (function () {
  'use strict';
  var list = {};

  function register(def) {
    if (!def || !def.id || typeof def.build !== 'function') throw new Error('HABITATS.register: needs { id, build }');
    if (!HABITAT_ELEMENTS.some(function (e) { return e.id === def.id; })) throw new Error('HABITATS.register: unknown element "' + def.id + '"');
    def.levels = Math.max(1, Math.min(HABITAT_MAX_LEVEL, def.levels || 1));
    def.footprint = def.footprint || 1.3;
    list[def.id] = def;
  }

  return {
    register: register,
    get: function (id) { return list[id] || null; },
    has: function (id) { return !!list[id]; }
  };
})();
