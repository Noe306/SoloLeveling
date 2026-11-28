/* ==========================================================================
   dragons/registry.js: evolution stages + the dragon registry.

   Every element's dragon lives in its own file (dragons/<id>.js) and registers:

     DRAGONS.register({
       id: 'fire',                 // must match an id in HABITAT_ELEMENTS (habitats/registry.js)
       stages: ['egg', 'hatchling', 'juvenile', 'adult'],   // stages designed so far
       build: function (stage, ctx) { return THREE.Group }  // group.userData.height = model height
     });

   Models face +z, stand on y = 0 and are centred on x = 0 (the viewer turns them).
   ctx is the same as for habitats: ctx.rng(seed), ctx.anim(fn(time, dt)).

   Load order: three + add-ons -> lib/kit3d.js -> habitats/registry.js ->
               dragons/registry.js -> dragons/dragonkit.js -> dragon files.
   ========================================================================== */

/* Evolution chain (rule 9 in PLAN.md). */
var DRAGON_STAGES = [
  { id: 'egg',       name: 'Egg',       when: 'Hatchery · hatches after 30 focus minutes', slots: 0 },
  { id: 'hatchling', name: 'Hatchling', when: 'Dragon level 1-9',                          slots: 1 },
  { id: 'juvenile',  name: 'Juvenile',  when: 'Dragon level 10-19',                        slots: 2 },
  { id: 'adult',     name: 'Adult',     when: 'Dragon level 20+ (max = 3 x Town Hall)',    slots: 3 }
];

var DRAGONS = (function () {
  'use strict';
  var list = {};
  function register(def) {
    if (!def || !def.id || typeof def.build !== 'function') throw new Error('DRAGONS.register: needs { id, build }');
    def.stages = def.stages || ['egg'];
    list[def.id] = def;
  }
  return {
    register: register,
    get: function (id) { return list[id] || null; },
    has: function (id) { return !!list[id]; }
  };
})();
