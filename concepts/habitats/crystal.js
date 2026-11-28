/* ==========================================================================
   habitats/crystal.js: Crystal Habitat (element 12). Inspiration: dark crystal
   with purple cracks and a floating orb (own design, mood-board image used as
   inspiration only).

   Layout (camera looks from +x,+z): dark crystal monolith at the BACK-left with
   the floating orb above it, the dragon rests in the prism nest at the
   FRONT-right. Palette: dark indigo rock, amethyst, teal + magenta accents.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  dark rock island with glowing purple cracks, small amethyst clusters,
          two cracked-open geodes full of crystals
     2  + giant dark crystal monolith (focal point) with glowing violet veins,
          amethyst crystals at its foot
     3  + floating orb above the monolith (swirling glow), two tilted rings and
          shards orbiting it
     4  + prism nest: hexagonal crystal tiles (teal / magenta) on the dragon spot,
          six crystal pillars around it
     5  + refraction: beams of light from the orb to the nest pillars, a ring of
          orbiting shards, sparkles
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var MONO = { x: -0.55, z: -0.55 };
  var ORB_Y = TOP + 2.05;

  var M = null;
  function mats() {
    if (M) return M;
    var st = K3.tex('stone'), lv = K3.tex('lava'), dot = dotTexture();
    M = {
      // Dark rock with violet glowing cracks (stone colour + lava crack pattern as glow only)
      cracked: new THREE.MeshStandardMaterial({ map: st.map, normalMap: lv.normalMap, normalScale: new THREE.Vector2(1, 1), color: col('#4a4060'), roughness: 0.8,
        emissiveMap: lv.emissiveMap, emissive: col('#c040ff'), emissiveIntensity: 2.6 }),
      ground: K3.mat('stone', { repeat: 2, color: '#5a5070' }),
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#9a90b0' }),
      orb: new THREE.MeshPhysicalMaterial({ color: col('#f0b8ff'), emissive: col('#b040ff'), emissiveIntensity: 0.9, roughness: 0.05, clearcoat: 1, transparent: true, opacity: 0.85, envMapIntensity: 1 }),
      core: K3.mat('glow', { color: '#ffd0ff', intensity: 2.6 }),
      teal: K3.mat('glow', { color: '#4ff0e0', intensity: 1.8 }),
      magenta: K3.mat('glow', { color: '#ff5ad8', intensity: 1.8 }),
      beam: new THREE.MeshBasicMaterial({ color: col('#ffc8ff'), transparent: true, opacity: 0.45, blending: THREE.AdditiveBlending, depthWrite: false }),
      spark: new THREE.PointsMaterial({ map: dot, color: col('#f0c8ff'), size: 0.05, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  }

  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }
  function Y(x, z) { return domeY(Math.hypot(x, z)); }
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  // Crystal cluster in a colour; low env reflection so it keeps its colour.
  function gem(opts, color, emissive) {
    var c = K3.crystalCluster(Object.assign({ color: color, emissive: emissive, intensity: 0.5 }, opts));
    c.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.45; o.material.opacity = 0.92; } });
    return c;
  }
  function amethyst(opts) { return gem(opts, '#8a4ae0', '#a040ff'); }

  function island() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 151, squash: 0.42, lumpy: 0.24, material: M.cracked });
    under.scale.set(1, 0.85, 1); under.position.y = 0.0; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 19, squash: 0.08, lumpy: 0.05, flat: false, material: M.ground });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Geode: rock cracked open with crystals growing out of the gap.
  function geode(r, seed) {
    var g = new THREE.Group();
    [-1, 1].forEach(function (s) {
      var half = K3.rock({ radius: r, detail: 3, seed: seed + s, squash: 0.7, color: '#5a5070', top: '#7a7090', topAmount: 0.3, material: M.rock });
      half.position.set(s * r * 0.55, r * 0.35, 0); half.rotation.z = s * 0.5; g.add(half);
    });
    var cr = amethyst({ count: 4, height: r * 1.6, radius: r * 0.22, seed: seed, spread: r * 0.25 }); cr.position.y = r * 0.1; g.add(cr);
    return g;
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(53), g = new THREE.Group();
    g.add(island());

    /* ===== Level 1 ===== */
    [[0.95, -0.45, 0.34, 1], [-1.02, 0.42, 0.3, 2], [0.12, 1.05, 0.26, 3], [-0.3, -1.05, 0.32, 4], [1.1, 0.35, 0.22, 5]].forEach(function (c) {
      var cl = amethyst({ count: 3, height: c[2], radius: 0.05, seed: 30 + c[3], spread: 0.06 }); cl.position.set(c[0], Y(c[0], c[1]) - 0.02, c[1]); g.add(cl);
    });
    [[0.72, -0.92, 0.17, 60], [-0.92, 0.85, 0.14, 70]].forEach(function (p) { var gd = geode(p[2], p[3]); gd.position.set(p[0], Y(p[0], p[1]) - 0.03, p[1]); gd.rotation.y = R() * 3; g.add(gd); });
    var purple = new THREE.PointLight(col('#b060ff'), 0.6, 3, 2); purple.position.set(0.2, TOP + 0.6, 0.2); g.add(purple);

    /* ===== Level 2: the dark crystal monolith ===== */
    if (level >= 2) {
      var base = K3.rock({ radius: 0.4, detail: 3, seed: 160, squash: 0.45, lumpy: 0.3, material: M.cracked }); base.position.set(MONO.x, TOP, MONO.z); g.add(base);
      var mono = gem({ count: 6, height: 1.75, radius: 0.2, seed: 81, spread: 0.26 }, '#2a1a40', '#9a30ff');
      mono.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.emissiveIntensity = 0.55; o.material.opacity = 0.96; } });
      mono.position.set(MONO.x, TOP + 0.12, MONO.z); g.add(mono);
      [[0.35, 0.12], [-0.05, 0.38], [0.3, -0.25]].forEach(function (p, i) {
        var a = amethyst({ count: 3, height: 0.32, radius: 0.05, seed: 90 + i, spread: 0.05 }); a.position.set(MONO.x + p[0], TOP, MONO.z + p[1]); g.add(a);
      });
      var monoL = new THREE.PointLight(col('#a040ff'), 1.4, 3, 2); monoL.position.set(MONO.x + 0.3, TOP + 1.0, MONO.z + 0.3); g.add(monoL);
    }

    /* ===== Level 3: floating orb ===== */
    var orbPos = new V(MONO.x, ORB_Y, MONO.z);
    if (level >= 3) {
      var orbG = new THREE.Group(); orbG.position.copy(orbPos); g.add(orbG);
      orbG.add(new THREE.Mesh(new THREE.SphereGeometry(0.2, 32, 24), M.orb));
      var core = new THREE.Mesh(new THREE.IcosahedronGeometry(0.09, 1), M.core); orbG.add(core);
      var r1 = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.012, 6, 48), M.teal), r2 = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.01, 6, 48), M.magenta);
      orbG.add(r1); orbG.add(r2);
      var shards = new THREE.Group(); orbG.add(shards);
      for (var s = 0; s < 5; s++) {
        var sh = K3.crystal({ height: 0.12, radius: 0.03, core: false, intensity: 0.6, color: s % 2 ? '#7ff0e8' : '#ff8ae0', emissive: s % 2 ? '#2fd0c0' : '#e040b0' });
        var a = s / 5 * Math.PI * 2; sh.position.set(Math.cos(a) * 0.46, Math.sin(s * 2) * 0.08, Math.sin(a) * 0.46); shards.add(sh);
      }
      ctx.anim(function (t) {
        orbG.position.y = ORB_Y + Math.sin(t * 0.9) * 0.06;
        core.rotation.set(t * 0.7, t, 0); r1.rotation.set(t * 0.5 + 1, t * 0.3, 0); r2.rotation.set(0.4, t * -0.6, t * 0.4); shards.rotation.y = t * 0.6;
      });
      var orbL = new THREE.PointLight(col('#e080ff'), 1.6, 3.5, 2); orbG.add(orbL);
    }

    /* ===== Level 4: prism nest ===== */
    var pillarTops = [];
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z), hexR = 0.15;
      var cells = [[0, 0]];
      for (var i = 0; i < 6; i++) { var a2 = i * Math.PI / 3 + Math.PI / 6; cells.push([Math.cos(a2) * hexR * 1.76, Math.sin(a2) * hexR * 1.76]); }
      cells.forEach(function (c, i) {
        var tile = new THREE.Mesh(new THREE.CylinderGeometry(hexR * 0.95, hexR, 0.04, 6), i === 0 ? M.core : (i % 2 ? M.teal : M.magenta));
        tile.position.set(SPOT.x + c[0], y0 + 0.01, SPOT.z + c[1]); tile.rotation.y = Math.PI / 6; g.add(tile);
      });
      var dark = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.03, 0.03, 6), M.cracked); dark.position.set(SPOT.x, y0 - 0.005, SPOT.z); dark.rotation.y = Math.PI / 6; g.add(dark);
      for (var p = 0; p < 6; p++) {
        var pa = p / 6 * Math.PI * 2, px = SPOT.x + Math.cos(pa) * (SPOT.r + 0.14), pz = SPOT.z + Math.sin(pa) * (SPOT.r + 0.14);
        var pc = p % 2 ? gem({ count: 2, height: 0.36, radius: 0.05, seed: 120 + p, spread: 0.03 }, '#7ff0e8', '#2fd0c0') : gem({ count: 2, height: 0.36, radius: 0.05, seed: 120 + p, spread: 0.03 }, '#ff8ae0', '#e040b0');
        pc.position.set(px, Y(px, pz) - 0.02, pz); g.add(pc);
        pillarTops.push(new V(px, Y(px, pz) + 0.36, pz));
      }
      ctx.anim(function (t) { M.teal.emissiveIntensity = 1.8 + Math.sin(t * 1.6) * 0.4; M.magenta.emissiveIntensity = 1.8 + Math.sin(t * 1.6 + 2) * 0.4; });
    }

    /* ===== Level 5: refraction beams + shard ring + sparkles ===== */
    if (level >= 5) {
      var up = new V(0, 1, 0);
      pillarTops.forEach(function (tp, i) {
        if (i % 2) return;                                                  // three beams
        var dir = tp.clone().sub(orbPos), len = dir.length();
        var beam = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, len, 6, 1, true), M.beam.clone());
        beam.position.copy(orbPos).addScaledVector(dir, 0.5); beam.quaternion.setFromUnitVectors(up, dir.normalize()); g.add(beam);
        ctx.anim(function (t) { beam.material.opacity = 0.3 + Math.sin(t * 3 + i) * 0.15; });
      });
      var ring = new THREE.Group(); ring.position.set(MONO.x, TOP + 1.1, MONO.z); g.add(ring);
      for (var k = 0; k < 10; k++) {
        var ka = k / 10 * Math.PI * 2, sh2 = K3.crystal({ height: 0.14, radius: 0.03, core: false, intensity: 0.6, color: '#c89aff', emissive: '#9a40ff' });
        sh2.position.set(Math.cos(ka) * 0.75, Math.sin(k * 1.3) * 0.1, Math.sin(ka) * 0.75); sh2.rotation.z = 0.5; ring.add(sh2);
      }
      ctx.anim(function (t) { ring.rotation.y = -t * 0.35; });
      var n = 40, pos = new Float32Array(n * 3), seed = [];
      for (var q = 0; q < n; q++) seed.push(R() * 6.28);
      var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      ctx.anim(function (t) {                                                // twinkling sparkles hopping around
        for (var j = 0; j < n; j++) {
          var kk = Math.floor(t * 2 + seed[j] * 3), r1 = Math.sin(kk * 12.9898 + j * 78.233) * 43758.5453, r2 = Math.sin(kk * 39.346 + j * 11.135) * 24634.6345, r3 = Math.sin(kk * 7.1 + j * 3.3) * 9632.1;
          r1 -= Math.floor(r1); r2 -= Math.floor(r2); r3 -= Math.floor(r3);
          pos[j * 3] = (r1 - 0.5) * 2.4; pos[j * 3 + 1] = TOP + 0.1 + r3 * 2.0; pos[j * 3 + 2] = (r2 - 0.5) * 2.4;
        }
        sg.attributes.position.needsUpdate = true;
      });
      g.add(new THREE.Points(sg, M.spark));
    }
    return g;
  }

  HABITATS.register({ id: 'crystal', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.03, z: SPOT.z, r: SPOT.r }, build: build });
})();
