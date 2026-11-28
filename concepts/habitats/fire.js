/* ==========================================================================
   habitats/fire.js: Fire Habitat (element 1). Inspiration: lava cauldron on
   chains, fire around (own design, mood-board image used as inspiration only).

   Layout (camera looks from +x,+z): lava pool + focal piece at the BACK,
   the dragon's resting spot stays free at the FRONT centre.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  dark basalt plateau with glowing lava cracks, swirling lava pool at the
          back with small flames, a cluster of basalt columns, a fire vent,
          basalt rocks and pebbles, crack flames, rising embers, flickering light
     2  + two basalt-column pillars with an iron beam; an iron cauldron hangs on
          three chains above the pool and pours a lava stream into it (focal
          point), flames under the cauldron, two iron braziers, red fire
          crystals, lava drips under the rim, more embers
     3  + lava river from the pool to the front-left rim with basalt banks,
          spilling over the edge as a lavafall onto the grass
     4  + the dragon's fire nest: polished obsidian floor on the resting spot,
          glowing rune circle and 8 rune stones with pulsing glyphs
     5  + crown of fire: flames burning on the pillar columns, a big fire
          crystal behind the pool, fire motes orbiting the cauldron
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col;
  var TOP = 0.55;                                   // height of the plateau surface
  var POOL = { x: -0.45, z: -0.45, r: 0.45 };       // lava pool at the back
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };          // dragon resting spot (kept free)
  // Level-3 lava river: from inside the pool to the front-left rim (x, z), between the
  // left pillar and the dragon spot.
  var RIVER = [[-0.42, -0.12], [-0.42, 0.25], [-0.45, 0.6], [-0.47, 0.95], [-0.46, 1.26]];

  /* ------------------------- textures + materials (first build only) ------------------------- */
  var M = null;

  // Molten lava: bright orange/yellow with dark floating crust islands. Used as colour AND glow.
  function moltenTexture() {
    var S = 256, c = document.createElement('canvas'); c.width = c.height = S;
    var x = c.getContext('2d'), img = x.createImageData(S, S);
    for (var j = 0; j < S; j++) for (var i = 0; i < S; i++) {
      var u = i / S, v = j / S;
      var n = K3.fbm3(u * 4.2, v * 4.2, 0.37, 4), hot = K3.fbm3(u * 9 + 5, v * 9, 1.7, 2);
      var crust = Math.min(1, Math.max(0, (n - 0.12) / 0.22));                  // 0 molten .. 1 crust
      var heat = 0.65 + 0.35 * Math.max(0, -hot);                                // yellow-hot streaks
      // Deep orange (not yellow): tone mapping pushes bright orange towards white, so keep green low.
      var r = 255 * (1 - crust * 0.86), g = (45 + 105 * heat * heat) * (1 - crust * 0.92), b = (8 + 25 * heat * heat) * (1 - crust);
      var o = (j * S + i) * 4; img.data[o] = r; img.data[o + 1] = g; img.data[o + 2] = b; img.data[o + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.center.set(0.5, 0.5);
    return t;
  }

  // Soft flame (teardrop gradient) and ember dot, drawn once on canvases.
  function flameTexture() {
    var c = document.createElement('canvas'); c.width = 64; c.height = 128;
    var x = c.getContext('2d');
    x.translate(32, 100); x.scale(1, 2.2);                                       // stretch a round glow upwards
    var g = x.createRadialGradient(0, 0, 0, 0, -6, 30);
    g.addColorStop(0, 'rgba(255,248,220,1)'); g.addColorStop(0.22, 'rgba(255,214,90,0.95)');
    g.addColorStop(0.5, 'rgba(255,110,25,0.6)'); g.addColorStop(1, 'rgba(255,40,0,0)');
    x.fillStyle = g; x.beginPath(); x.arc(0, -10, 32, 0, Math.PI * 2); x.fill();
    var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; return t;
  }
  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32);
    return new THREE.CanvasTexture(c);
  }

  function mats() {
    if (M) return M;
    var molten = moltenTexture(), flow = molten.clone(), riverTex = molten.clone();
    flow.needsUpdate = true; flow.wrapS = flow.wrapT = THREE.RepeatWrapping; flow.repeat.set(1, 3);
    riverTex.needsUpdate = true; riverTex.wrapS = riverTex.wrapT = THREE.RepeatWrapping; riverTex.center.set(0, 0); riverTex.repeat.set(0.5, 0.5);
    M = {
      basaltRock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#8a7f80' }),   // tinted by rock vertex colours
      // Basalt columns: grey faceted sides, lighter flat tops (CylinderGeometry groups: side, top, bottom)
      column: K3.mat('stone', { flat: true, repeat: 1, color: '#6a6568' }),
      columnTop: K3.mat('stone', { flat: true, repeat: 1, color: '#9a9294' }),
      crust: K3.mat('lava', { repeat: 1, intensity: 0.9, normalScale: 1.2, color: '#c9bcb8' }),       // plateau top: crust + glowing cracks
      // Molten lava: almost no lit colour (dark tint) so sunlight can't wash it pale; the glow does the work.
      stream: new THREE.MeshStandardMaterial({ map: flow, color: col('#3a1608'), emissiveMap: flow, emissive: col('#ffffff'), emissiveIntensity: 1.1, roughness: 0.9, envMapIntensity: 0.2 }),
      molten: new THREE.MeshStandardMaterial({ map: molten, color: col('#3a1608'), emissiveMap: molten, emissive: col('#ffffff'), emissiveIntensity: 1.0, roughness: 0.9, envMapIntensity: 0.2 }),
      river: new THREE.MeshStandardMaterial({ map: riverTex, color: col('#3a1608'), emissiveMap: riverTex, emissive: col('#ffffff'), emissiveIntensity: 1.0, roughness: 0.9, envMapIntensity: 0.2 }),
      obsidian: new THREE.MeshPhysicalMaterial({ color: col('#1e1517'), roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 0.6 }),
      rune: K3.mat('glow', { color: '#ff8a2a', intensity: 2.2 }),
      drip: K3.mat('glow', { color: '#ff7a2a', intensity: 2.4 }),
      iron: K3.mat('metal', { color: '#5a5660', roughness: 0.55, normalScale: 0.6 }),
      darkIron: K3.mat('metal', { color: '#3a3740', roughness: 0.7 }),
      coal: K3.mat('glow', { color: '#ff5a1a', intensity: 2.0 }),
      flame: new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }),
      ember: new THREE.PointsMaterial({ map: dotTexture(), color: col('#ffa040'), size: 0.05, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })
    };
    return M;
  }

  /* ------------------------- building blocks ------------------------- */
  // Re-map UVs from above (x, z) so textures on flat-ish rocks are not stretched.
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  // Floating basalt plateau: dark rocky underside + crust top with glowing cracks.
  function basaltPlateau(radius) {
    var g = new THREE.Group();
    var under = K3.rock({ radius: radius, detail: 4, seed: 21, squash: 0.42, lumpy: 0.24, color: '#5a4642', top: '#3a2e2c', topAmount: 0.3, material: M.basaltRock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: radius * 1.02, detail: 4, seed: 8, squash: 0.08, lumpy: 0.08, flat: false, material: M.crust });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Position of column i inside a basaltColumns cluster (0 = centre, 1-6 = ring around it).
  function columnOffset(i, r) {
    if (i % 7 === 0) return { x: 0, z: 0 };
    var a = ((i % 7) - 1) * Math.PI / 3 + Math.PI / 6;
    return { x: Math.cos(a) * r * 1.75, z: Math.sin(a) * r * 1.75 };
  }

  // Tight cluster of hexagonal basalt columns (volcanic rock that cracks into prisms).
  // heights: array of column heights; r: column radius.
  function basaltColumns(heights, r, R) {
    var g = new THREE.Group();
    heights.forEach(function (h, i) {
      var o = columnOffset(i, r), p = [o.x, o.z], rr = r * (0.92 + R() * 0.1);
      var c = new THREE.Mesh(new THREE.CylinderGeometry(rr * 0.96, rr, h, 6), [M.column, M.columnTop, M.column]);
      c.position.set(p[0], h / 2, p[1]); c.rotation.set((R() - 0.5) * 0.06, 0, (R() - 0.5) * 0.06);
      c.castShadow = c.receiveShadow = true; g.add(c);
    });
    return g;
  }

  // Flat ribbon along a smooth path (the lava river). UV v runs along the length so the texture can flow.
  function ribbon(points, width, material, segments) {
    var curve = new THREE.CatmullRomCurve3(points), len = curve.getLength(), pos = [], uv = [], idx = [];
    for (var i = 0; i <= segments; i++) {
      var t = i / segments, p = curve.getPointAt(t), tg = curve.getTangentAt(t);
      var s = new THREE.Vector3(-tg.z, 0, tg.x).normalize().multiplyScalar(width / 2);
      pos.push(p.x + s.x, p.y, p.z + s.z, p.x - s.x, p.y, p.z - s.z);
      uv.push(0, t * len * 1.2, 1, t * len * 1.2);
      if (i < segments) { var a = i * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx); geo.computeVertexNormals();
    if (geo.attributes.normal.getY(0) < 0) geo.index.array.reverse();            // make sure it faces up
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, material); m.receiveShadow = true; return m;
  }

  // Flickering flame sprite with its base at (x, y, z). Two noisy sine waves per flame.
  function flame(ctx, x, y, z, w, h, phase) {
    var s = new THREE.Sprite(M.flame);
    s.center.set(0.5, 0.08); s.position.set(x, y, z); s.scale.set(w, h, 1);
    ctx.anim(function (t) {
      var f = 1 + 0.16 * Math.sin(t * 13 + phase) + 0.09 * Math.sin(t * 7.3 + phase * 2.1);
      s.scale.set(w * (1.08 - (f - 1) * 0.6), h * f, 1);
    });
    return s;
  }

  // Swirling lava pool with a ring of basalt rocks; optional small surface flames.
  function lavaPool(ctx, R) {
    var g = new THREE.Group();
    var bed = new THREE.Mesh(new THREE.CylinderGeometry(POOL.r * 1.05, POOL.r * 0.9, 0.08, 40), M.darkIron); bed.position.y = -0.02; g.add(bed);
    var lava = new THREE.Mesh(new THREE.CircleGeometry(POOL.r, 48), M.molten); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.035; g.add(lava);
    ctx.anim(function (t) { M.molten.map.rotation = t * 0.05; });               // slow swirl (map + emissiveMap share it)
    for (var i = 0; i < 13; i++) {                                              // rim of basalt rocks
      var a = i / 13 * Math.PI * 2 + R() * 0.2, rr = 0.08 + R() * 0.07;
      var rk = K3.rock({ radius: rr, detail: 2, seed: 90 + i, squash: 0.6, color: '#4d3d3a', top: '#2e2523', topAmount: 0.4, material: M.basaltRock });
      rk.position.set(Math.cos(a) * POOL.r * 1.08, 0.03, Math.sin(a) * POOL.r * 1.08); g.add(rk);
    }
    return g;
  }

  // Rising embers in a column above (cx, cz); n particles up to `height`.
  function embers(ctx, R, cx, cz, spread, n, height) {
    var pos = new Float32Array(n * 3), seed = [];
    for (var i = 0; i < n; i++) {
      pos[i * 3] = cx + (R() - 0.5) * spread; pos[i * 3 + 1] = TOP + R() * height; pos[i * 3 + 2] = cz + (R() - 0.5) * spread;
      seed.push(R() * 6.28);
    }
    var geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var pts = new THREE.Points(geo, M.ember);
    ctx.anim(function (t, dt) {
      for (var q = 0; q < n; q++) {
        pos[q * 3 + 1] += dt * (0.3 + (q % 5) * 0.05);
        pos[q * 3] += Math.sin(t * 2 + seed[q]) * dt * 0.08;                    // sway sideways
        if (pos[q * 3 + 1] > TOP + height) { pos[q * 3 + 1] = TOP + 0.05; pos[q * 3] = cx + (Math.sin(seed[q] * 13 + t) * 0.5) * spread; }
      }
      geo.attributes.position.needsUpdate = true;
    });
    return pts;
  }

  // Iron cauldron (lathe profile) with molten lava inside and three handles for the chains.
  function cauldron() {
    var g = new THREE.Group();
    var prof = [[0, 0], [0.16, 0.01], [0.3, 0.07], [0.39, 0.18], [0.42, 0.3], [0.4, 0.4], [0.37, 0.45], [0.41, 0.48], [0.43, 0.51], [0.38, 0.52], [0.34, 0.47]]
      .map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 28), M.iron); bowl.material.side = THREE.DoubleSide;
    bowl.castShadow = bowl.receiveShadow = true; g.add(bowl);
    var band = new THREE.Mesh(new THREE.TorusGeometry(0.415, 0.02, 6, 32), M.darkIron); band.rotation.x = Math.PI / 2; band.position.y = 0.3; g.add(band);
    // Lava filled almost to the brim (touches the inner wall) so the pour can start from it.
    var lava = new THREE.Mesh(new THREE.CircleGeometry(0.375, 32), M.molten); lava.rotation.x = -Math.PI / 2; lava.position.y = 0.485; g.add(lava);
    g.userData.handles = [];
    for (var i = 0; i < 3; i++) {
      var a = i / 3 * Math.PI * 2 + Math.PI / 4, hd = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.014, 6, 12), M.darkIron);
      hd.position.set(Math.cos(a) * 0.44, 0.53, Math.sin(a) * 0.44); hd.rotation.y = -a; g.add(hd);
      g.userData.handles.push(hd.position.clone().add(new THREE.Vector3(0, 0.04, 0)));
    }
    return g;
  }

  // Iron brazier on a short basalt stub, with glowing coals and a flame.
  function brazier(ctx, phase) {
    var g = new THREE.Group();
    var stub = basaltColumns([0.32], 0.11, K3.rng(phase * 10)); g.add(stub);
    var prof = [[0, 0], [0.08, 0], [0.15, 0.05], [0.18, 0.12], [0.16, 0.13], [0.12, 0.08], [0, 0.08]].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
    var bowl = new THREE.Mesh(new THREE.LatheGeometry(prof, 16), M.darkIron); bowl.position.y = 0.32; bowl.castShadow = true; g.add(bowl);
    var coals = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), M.coal); coals.scale.y = 0.35; coals.position.y = 0.4; g.add(coals);
    g.add(flame(ctx, 0, 0.42, 0, 0.32, 0.6, phase));
    return g;
  }

  /* ------------------------- the habitat ------------------------- */
  function build(level, ctx) {
    mats();
    var R = ctx.rng(11), g = new THREE.Group();
    g.add(basaltPlateau(1.38));

    /* ===== Level 1 ===== */
    var pool = lavaPool(ctx, R); pool.position.set(POOL.x, TOP, POOL.z); g.add(pool);
    g.add(flame(ctx, POOL.x - 0.12, TOP + 0.03, POOL.z + 0.05, 0.22, 0.38, 0.3));   // small flames dancing on the lava
    g.add(flame(ctx, POOL.x + 0.15, TOP + 0.03, POOL.z - 0.1, 0.18, 0.3, 2.1));

    // (left of the lava river that level 3 adds, and clear of the level-2 pillar)
    var cols = basaltColumns([0.62, 0.45, 0.38, 0.3, 0.52], 0.1, R); cols.position.set(-1.0, TOP - 0.03, 0.62); g.add(cols);

    // Fire vent: a cracked rock with a flame bursting out of it
    var vent = K3.rock({ radius: 0.2, detail: 3, seed: 33, squash: 0.65, color: '#5a4642', top: '#2e2523', topAmount: 0.4, material: M.basaltRock });
    vent.position.set(0.72, TOP + 0.04, -0.85); g.add(vent);
    g.add(flame(ctx, 0.72, TOP + 0.14, -0.85, 0.26, 0.5, 4.2));

    var rock = K3.rock({ radius: 0.2, detail: 3, seed: 44, squash: 0.7, color: '#5e4a45', top: '#3a2e2c', topAmount: 0.45, material: M.basaltRock });
    rock.position.set(1.05, TOP + 0.02, 0.05); g.add(rock);
    // Scattered basalt pebbles (density)
    [[-0.3, -1.12], [1.15, 0.45], [0.25, 1.15], [-1.18, 0.2], [0.45, -0.98], [-0.75, 1.05]].forEach(function (p, i) {
      var pb = K3.rock({ radius: 0.06 + R() * 0.05, detail: 2, seed: 120 + i, squash: 0.6, color: '#4d3d3a', top: '#2e2523', topAmount: 0.4, material: M.basaltRock });
      pb.position.set(p[0], TOP + 0.01, p[1]); g.add(pb);
    });
    // Small flames escaping from cracks
    g.add(flame(ctx, 0.62, TOP + 0.02, -0.42, 0.16, 0.3, 6.1));
    g.add(flame(ctx, -1.05, TOP + 0.02, 0.92, 0.13, 0.24, 2.7));

    g.add(embers(ctx, R, POOL.x, POOL.z, 0.6, [40, 90, 110, 130, 150][level - 1], level >= 2 ? 2.4 : 1.6));

    var glow = new THREE.PointLight(col('#ff7a30'), 1.6, 3.5, 2); glow.position.set(POOL.x, TOP + 0.5, POOL.z); g.add(glow);
    ctx.anim(function (t) { glow.intensity = 1.6 + Math.sin(t * 9) * 0.15 + Math.sin(t * 23) * 0.1; });

    /* ===== Level 2 ===== */
    if (level >= 2) {
      // Two basalt-column pillars either side of the pool (left/right as seen from the camera)
      var side = new THREE.Vector3(1, 0, -1).normalize().multiplyScalar(0.78), PH = 1.95;
      var pA = new THREE.Vector3(POOL.x, 0, POOL.z).add(side), pB = new THREE.Vector3(POOL.x, 0, POOL.z).sub(side);
      [pA, pB].forEach(function (p, i) {
        var pil = basaltColumns([PH, PH * 0.78, PH * 0.62, PH * 0.45, PH * 0.7, PH * 0.35, PH * 0.25], 0.13, K3.rng(70 + i));
        pil.position.set(p.x, TOP - 0.03, p.z); g.add(pil);
        for (var b = 0; b < 3; b++) {                                         // rubble at the pillar's foot
          var a = b * 2.1 + i, rb = K3.rock({ radius: 0.09 + b * 0.02, detail: 2, seed: 140 + i * 3 + b, squash: 0.6, color: '#4d3d3a', top: '#2e2523', topAmount: 0.4, material: M.basaltRock });
          rb.position.set(p.x + Math.cos(a) * 0.36, TOP + 0.01, p.z + Math.sin(a) * 0.36); g.add(rb);
        }
      });
      // Iron beam across the pillar tops, end caps, and the hook ring in the middle
      var beamY = TOP + PH - 0.02, len = pA.distanceTo(pB) + 0.2;
      var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.065, len, 12), M.iron);
      beam.position.set(POOL.x, beamY, POOL.z); beam.rotation.z = Math.PI / 2; beam.rotation.y = Math.PI / 4; beam.castShadow = true; g.add(beam);
      [pA, pB].forEach(function (p) {
        var cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), M.darkIron);
        cap.position.set(p.x, beamY, p.z); cap.rotation.copy(beam.rotation); g.add(cap);
      });
      var hookY = beamY - 0.16;
      var hook = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.018, 8, 16), M.darkIron); hook.position.set(POOL.x, hookY + 0.08, POOL.z); g.add(hook);

      // The cauldron, tipped towards the front so lava pours over its lip, hanging on three
      // chains that meet at the hook (chain ends computed from the tipped handle positions).
      var fwd = new THREE.Vector3(1, 0, 1).normalize(), tiltAxis = new THREE.Vector3(1, 0, -1).normalize();
      var cd = cauldron(), cdY = TOP + 0.78;
      cd.position.set(POOL.x, cdY, POOL.z); cd.quaternion.setFromAxisAngle(tiltAxis, 0.22); g.add(cd);
      cd.updateMatrixWorld(true);
      cd.userData.handles.forEach(function (hp) {
        var w = cd.localToWorld(hp.clone());                                    // g sits at the origin here, so world = habitat space
        g.add(K3.chain([w.x, w.y, w.z], [POOL.x, hookY, POOL.z], 0.02, 0.035, M.darkIron));
      });
      // Lava pouring out of the cauldron: the stream starts INSIDE, on the lava surface, rolls over
      // the front lip (lowest point after tipping) and falls into the pool, so it reads as one flow.
      function inCd(r, y) { return cd.localToWorld(new THREE.Vector3(fwd.x * r, y, fwd.z * r)); }
      var src = inCd(0.2, 0.47), over = inCd(0.42, 0.545), out = inCd(0.5, 0.5);
      var land = new THREE.Vector3(POOL.x, TOP + 0.04, POOL.z).add(fwd.clone().multiplyScalar(0.34));
      var drop = out.clone().add(fwd.clone().multiplyScalar(0.03)); drop.y = (out.y + land.y) / 2;
      var stream = K3.tube([[src.x, src.y, src.z], [over.x, over.y, over.z], [out.x, out.y - 0.04, out.z], [drop.x, drop.y, drop.z], [land.x, land.y, land.z]], [0.085, 0.045], M.stream, 40);
      stream.castShadow = false; g.add(stream);
      ctx.anim(function (t) { M.stream.map.offset.y = -t * 0.5; });             // flowing downwards
      g.add(flame(ctx, land.x, TOP + 0.03, land.z, 0.3, 0.42, 1.2));            // splash where it lands
      g.add(flame(ctx, POOL.x - 0.05, TOP + 0.03, POOL.z - 0.05, 0.36, 0.62, 5.5)); // fire licking the cauldron

      // Iron braziers flanking the front of the habitat
      var b1 = brazier(ctx, 0.7); b1.position.set(1.08, TOP - 0.03, -0.42); g.add(b1);
      var b2 = brazier(ctx, 3.3); b2.position.set(0.02, TOP - 0.03, 1.2); g.add(b2);

      // Red fire crystals (kept on the rim, away from the dragon spot and the level-3 river;
      // low env reflection so they stay deep red, not pink)
      [[1.2, 0.2, 0.42, 1], [0.66, 1.08, 0.36, 2], [-1.08, -0.62, 0.5, 3]].forEach(function (c) {
        var oc = K3.crystalCluster({ count: 3, height: c[2], radius: 0.065, seed: 50 + c[3], spread: 0.07, color: '#1c1012', emissive: '#ff3010', intensity: 0.35 });
        oc.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.35; o.material.opacity = 0.95; } });
        oc.position.set(c[0], TOP - 0.02, c[1]); g.add(oc);
      });

      // Glowing lava drips hanging under the rim (front half)
      for (var k = 0; k < 14; k++) {
        var ka = -0.4 + k / 13 * 2.2, ln = 0.1 + R() * 0.26;
        var d = new THREE.Mesh(new THREE.ConeGeometry(0.035, ln, 6), M.drip);
        d.position.set(Math.cos(ka) * 1.31, 0.22 - ln / 2, Math.sin(ka) * 1.31); d.rotation.x = Math.PI; g.add(d);
      }

      var hot = new THREE.PointLight(col('#ff8a3a'), 1.8, 4, 2); hot.position.set(POOL.x + 0.3, TOP + 1.2, POOL.z + 0.3); g.add(hot);
      ctx.anim(function (t) { hot.intensity = 1.8 + Math.sin(t * 11 + 1) * 0.2; });
    }

    /* ===== Level 3: lava river + lavafall ===== */
    if (level >= 3) {
      // River from the pool to the front-left rim, between the left pillar and the dragon spot
      var path = RIVER.map(function (p) { return new THREE.Vector3(p[0], TOP + 0.045, p[1]); });
      g.add(ribbon(path, 0.17, M.river, 48));
      ctx.anim(function (t) { M.river.map.offset.y = -t * 0.18; });             // slow flow towards the edge
      // Basalt banks on both sides of the river
      var curve = new THREE.CatmullRomCurve3(path);
      for (var bk = 1; bk < 12; bk++) {
        var bt = bk / 12, bp = curve.getPointAt(bt), tg = curve.getTangentAt(bt), sd = new THREE.Vector3(-tg.z, 0, tg.x).normalize();
        [-1, 1].forEach(function (s, si) {
          var br = K3.rock({ radius: 0.05 + R() * 0.04, detail: 2, seed: 200 + bk * 2 + si, squash: 0.55, color: '#4d3d3a', top: '#2e2523', topAmount: 0.4, material: M.basaltRock });
          br.position.copy(bp).addScaledVector(sd, s * (0.12 + R() * 0.03)); br.position.y = TOP + 0.01; g.add(br);
        });
      }
      // Lavafall: the river spills over the rim and drops onto the grass below
      var e = path[path.length - 1];
      var fall = K3.tube([[e.x, e.y, e.z], [e.x - 0.01, TOP - 0.02, e.z + 0.14], [e.x - 0.02, 0.3, e.z + 0.24], [e.x - 0.02, 0.04, e.z + 0.26]], [0.08, 0.06], M.stream, 32);
      fall.castShadow = false; g.add(fall);
      var splash = new THREE.Mesh(new THREE.CircleGeometry(0.15, 28), M.molten);
      splash.rotation.x = -Math.PI / 2; splash.scale.set(1.5, 0.75, 1); splash.position.set(e.x - 0.02, 0.03, e.z + 0.25); g.add(splash);
      g.add(flame(ctx, e.x - 0.02, 0.04, e.z + 0.25, 0.26, 0.4, 3.9));
      var fallLight = new THREE.PointLight(col('#ff7a30'), 1.2, 2, 2); fallLight.position.set(e.x, 0.4, e.z + 0.3); g.add(fallLight);
      g.add(embers(ctx, R, e.x, e.z + 0.2, 0.3, 25, 1.0));
    }

    /* ===== Level 4: the dragon's fire nest (dais + rune circle around the resting spot) ===== */
    if (level >= 4) {
      // Raised round basalt dais (light top, dark sides) with an obsidian inlay ring: reads as a
      // platform for the dragon, not a hole.
      var dais = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.09, 40), [M.column, M.columnTop, M.column]);
      dais.position.set(SPOT.x, TOP + 0.02, SPOT.z); dais.castShadow = dais.receiveShadow = true; g.add(dais);
      var inlay = new THREE.Mesh(new THREE.RingGeometry(SPOT.r * 0.62, SPOT.r * 0.7, 48), M.obsidian);
      inlay.rotation.x = -Math.PI / 2; inlay.position.set(SPOT.x, TOP + 0.068, SPOT.z); g.add(inlay);
      var circle = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.05, 0.012, 6, 64), M.rune);
      circle.rotation.x = Math.PI / 2; circle.position.set(SPOT.x, TOP + 0.03, SPOT.z); g.add(circle);
      for (var rs = 0; rs < 8; rs++) {                                         // 8 rune stones with glowing glyphs
        var ra = rs / 8 * Math.PI * 2 + Math.PI / 8, rx = SPOT.x + Math.cos(ra) * (SPOT.r + 0.14), rz = SPOT.z + Math.sin(ra) * (SPOT.r + 0.14);
        var stone = K3.roundedBox(0.11, 0.1, 0.11, 0.02, M.column); stone.position.set(rx, TOP + 0.04, rz); stone.rotation.y = -ra; g.add(stone);
        var glyph = new THREE.Mesh(new THREE.TorusGeometry(0.028, 0.008, 4, rs % 2 ? 3 : 4), M.rune);
        glyph.rotation.x = Math.PI / 2; glyph.position.set(rx, TOP + 0.093, rz); g.add(glyph);
      }
      var runeGlow = new THREE.PointLight(col('#ff6a20'), 0.8, 1.6, 2); runeGlow.position.set(SPOT.x, TOP + 0.4, SPOT.z); g.add(runeGlow);
      ctx.anim(function (t) { M.rune.emissiveIntensity = 2.2 + Math.sin(t * 2.2) * 0.6; });   // runes slowly pulse
    }

    /* ===== Level 5: crown of fire ===== */
    if (level >= 5) {
      // Flames burning on top of two columns of each pillar
      [pA, pB].forEach(function (p, i) {
        [[1, 0.78], [4, 0.7]].forEach(function (c, j) {
          var off = columnOffset(c[0], 0.13), h = TOP - 0.03 + PH * c[1];
          var coal = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.11, 0.03, 6), M.coal); coal.position.set(p.x + off.x, h + 0.015, p.z + off.z); g.add(coal);
          g.add(flame(ctx, p.x + off.x, h + 0.02, p.z + off.z, 0.3, 0.6, i * 2 + j + 0.5));
        });
      });
      // Big fire crystal behind the pool, between the pillars
      var big = K3.crystalCluster({ count: 6, height: 1.05, radius: 0.12, seed: 77, spread: 0.18, color: '#1c1012', emissive: '#ff3010', intensity: 0.45 });
      big.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.35; o.material.opacity = 0.95; } });
      big.position.set(-0.95, TOP - 0.02, -0.95); g.add(big);
      // Fire motes orbiting the cauldron
      var motes = new THREE.Group(); motes.position.set(POOL.x, TOP + 1.5, POOL.z); g.add(motes);
      for (var m = 0; m < 7; m++) {
        var ma = m / 7 * Math.PI * 2, mx = Math.cos(ma) * 0.62, mz = Math.sin(ma) * 0.62;
        var core = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.coal); core.position.set(mx, Math.sin(m * 1.7) * 0.06, mz); motes.add(core);
        motes.add(flame(ctx, mx, core.position.y - 0.03, mz, 0.12, 0.2, m));
      }
      ctx.anim(function (t) { motes.rotation.y = t * 0.45; motes.position.y = TOP + 1.5 + Math.sin(t * 1.1) * 0.05; });
      var crown = new THREE.PointLight(col('#ff8a3a'), 1.4, 4, 2); crown.position.set(POOL.x, TOP + 2.2, POOL.z); g.add(crown);
    }
    return g;
  }

  HABITATS.register({
    id: 'fire',
    levels: 5,
    footprint: 1.3,
    dragonSpot: { x: SPOT.x, y: TOP + 0.05, z: SPOT.z, r: SPOT.r },
    build: build
  });
})();
