/* ==========================================================================
   habitats/spirit.js: Spirit Habitat (element 14). Inspiration: white marble
   garden with arches (own design, mood-board image used as inspiration only).
   Made ethereal so it does not repeat the Light habitat: teal spirit glow,
   a round moon gate instead of arches, ghost tree, ghost koi.

   Layout (camera looks from +x,+z): moon gate + ghost tree at the BACK, koi pond
   front-left (level 3), the dragon rests on the spirit shrine at the FRONT-right.

   Levels designed: 1-5 (each level = previous level + new layer)
     1  pale garden island (marble + soft moss), stepping-stone path, two stone
          lanterns with teal spirit flames, faintly glowing flowers, spirit orbs
     2  + moon gate (focal point): round marble ring with a shimmering swirling
          portal, and a translucent ghost tree with glowing leaves
     3  + koi pond with glowing ghost koi swimming in circles
     4  + spirit shrine: round platform with glowing concentric rings, four
          hovering spirit lamps
     5  + ethereal crown: light ribbons spiralling up around the gate, drifting
          glowing petals, soft halo
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var GATE = { x: -0.5, z: -0.62 };                 // moon gate (faces the camera)
  var GTREE = { x: -1.0, z: -0.05 };                // ghost tree (left of the gate)
  var POND = { x: -0.62, z: 0.62, r: 0.3 };

  var M = null;
  function mats() {
    if (M) return M;
    var st = K3.tex('stone'), dot = dotTexture();
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#e4e8ec' }),
      moss: K3.mat('stone', { repeat: 2, color: '#cfe2da' }),                // pale garden ground (bright grass looked too ordinary)
      marble: new THREE.MeshStandardMaterial({ color: col('#e8ece8'), roughness: 0.5, normalMap: st.normalMap, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 0.45 }),
      stepStone: K3.mat('stone', { flat: true, repeat: 1, color: '#d8dcd8' }),
      ghost: new THREE.MeshStandardMaterial({ color: col('#bff8f0'), emissive: col('#3fd8c8'), emissiveIntensity: 0.6, roughness: 0.4, transparent: true, opacity: 0.55, depthWrite: false }),
      ghostLeaf: new THREE.MeshStandardMaterial({ color: col('#5fd8c4'), emissive: col('#2fc8b0'), emissiveIntensity: 0.45, roughness: 0.5, transparent: true, opacity: 0.55, depthWrite: false, flatShading: true }),
      spiritFlame: K3.mat('glow', { color: '#6ff0e0', intensity: 2.4 }),
      flower: new THREE.MeshStandardMaterial({ color: col('#e8fff8'), emissive: col('#7ff0e0'), emissiveIntensity: 0.5, roughness: 0.5, flatShading: true }),
      water: new THREE.MeshStandardMaterial({ color: col('#2a5a66'), roughness: 0.3, envMapIntensity: 0.35, emissive: col('#1f8a8a'), emissiveIntensity: 0.25 }),
      koi: new THREE.MeshStandardMaterial({ color: col('#e8fffa'), emissive: col('#5ff0e0'), emissiveIntensity: 1.0, transparent: true, opacity: 0.85, roughness: 0.4 }),
      rings: K3.mat('glow', { color: '#7ff4e4', intensity: 2.0 }),
      lampPaper: new THREE.MeshStandardMaterial({ color: col('#f4fffc'), emissive: col('#8ff4e4'), emissiveIntensity: 0.9, transparent: true, opacity: 0.85, roughness: 0.6 }),
      orb: new THREE.SpriteMaterial({ map: dot, color: col('#8ff8e8'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      ribbon: new THREE.MeshBasicMaterial({ color: col('#a8fff0'), transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide })
    };
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 64;
    var x = c.getContext('2d'), g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
  }

  function domeY(r) { return 0.44 + 0.11 * Math.sqrt(Math.max(0, 1 - Math.pow(r / 1.408, 2))); }
  function Y(x, z) { return domeY(Math.hypot(x, z)); }
  function topUV(mesh, scale) {
    var p = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv;
    for (var i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) * scale + 0.5, p.getZ(i) * scale + 0.5);
    uv.needsUpdate = true;
  }

  function island() {
    var g = new THREE.Group();
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 171, squash: 0.42, lumpy: 0.2, color: '#c8ccd4', top: '#a8c8b8', topAmount: 0.25, material: M.rock });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 21, squash: 0.08, lumpy: 0.05, flat: false, material: M.moss });
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Swirling portal disc (shader) for inside the moon gate.
  function portal(ctx, r) {
    var mat = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 } }, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: 'varying vec2 vUv; uniform float t;\n' +
        'void main(){ vec2 p = vUv - 0.5; float r = length(p) * 2.0, a = atan(p.y, p.x);\n' +
        '  float sw = 0.5 + 0.5 * sin(a * 3.0 + r * 9.0 - t * 1.6);\n' +
        '  float edge = smoothstep(1.0, 0.55, r);\n' +
        '  vec3 c = mix(vec3(0.15, 0.55, 0.6), vec3(0.6, 1.0, 0.95), sw * (1.0 - r * 0.6));\n' +
        '  gl_FragColor = vec4(c * edge * (0.35 + 0.35 * sw), 1.0); }'
    });
    ctx.anim(function (t) { mat.uniforms.t.value = t; });
    return new THREE.Mesh(new THREE.CircleGeometry(r, 48), mat);
  }

  // Stone lantern with a floating teal flame inside.
  function lantern(ctx, phase) {
    var g = new THREE.Group();
    var base = K3.roundedBox(0.18, 0.06, 0.18, 0.015, M.marble); base.position.y = 0.03; g.add(base);
    var post = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.045, 0.24, 8), M.marble); post.position.y = 0.18; g.add(post);
    var box = K3.roundedBox(0.15, 0.12, 0.15, 0.02, M.marble); box.position.y = 0.36; g.add(box);
    var roof = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.1, 4), M.marble); roof.rotation.y = Math.PI / 4; roof.position.y = 0.47; g.add(roof);
    var fl = new THREE.Mesh(new THREE.OctahedronGeometry(0.035, 0), M.spiritFlame); fl.position.set(0, 0.36, 0.08); g.add(fl);
    var l = new THREE.PointLight(col('#6ff0e0'), 0.5, 1.2, 2); l.position.set(0, 0.36, 0.1); g.add(l);
    ctx.anim(function (t) { fl.position.y = 0.36 + Math.sin(t * 2 + phase) * 0.01; fl.rotation.y = t; });
    return g;
  }

  // Ghost tree: translucent glowing trunk + floating clumps of glowing leaves.
  function ghostTree(ctx, R) {
    var g = new THREE.Group();
    g.add(K3.tube([[0, 0, 0], [0.06, 0.5, 0.02], [-0.05, 0.95, 0.04], [0.04, 1.3, 0]], [0.12, 0.05], M.ghost, 20));
    [[0.4, 1.0, 0.1], [-0.35, 1.1, -0.1], [0.1, 1.25, 0.35], [-0.05, 1.2, -0.35]].forEach(function (b) {
      g.add(K3.tube([[0, 0.9, 0], [b[0] * 0.5, b[1] - 0.05, b[2] * 0.5], [b[0], b[1] + 0.1, b[2]]], [0.04, 0.015], M.ghost, 8));
    });
    var crown = new THREE.Group(); g.add(crown);
    for (var i = 0; i < 9; i++) {
      var a = i / 9 * Math.PI * 2, d = i === 0 ? 0 : 0.3 + R() * 0.12;
      var lump = new THREE.Mesh(new THREE.IcosahedronGeometry(0.17 + R() * 0.06, 1), M.ghostLeaf);
      lump.position.set(Math.cos(a) * d, 1.35 + (i === 0 ? 0.12 : R() * 0.12), Math.sin(a) * d); crown.add(lump);
    }
    ctx.anim(function (t) { crown.rotation.y = Math.sin(t * 0.3) * 0.1; crown.position.y = Math.sin(t * 0.8) * 0.02; });
    return g;
  }

  // Ghost koi: body + tail, swimming around a circle (radius r) in the pond.
  function koi(ctx, r, speed, phase, size) {
    var g = new THREE.Group(), body = new THREE.Mesh(new THREE.SphereGeometry(0.035 * size, 12, 8), M.koi); body.scale.set(0.55, 0.45, 1.6); g.add(body);
    var tail = new THREE.Mesh(new THREE.ConeGeometry(0.03 * size, 0.06 * size, 4), M.koi); tail.rotation.x = -Math.PI / 2; tail.scale.set(1.2, 0.25, 1); tail.position.z = -0.07 * size; g.add(tail);
    ctx.anim(function (t) {
      var a = t * speed + phase; g.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
      g.rotation.y = -a + (speed > 0 ? Math.PI : 0); tail.rotation.y = Math.sin(t * 8 + phase) * 0.4;
    });
    return g;
  }

  function orbs(ctx, R, n, spread, y0, y1) {
    var g = new THREE.Group(), list = [];
    for (var i = 0; i < n; i++) { var s = new THREE.Sprite(M.orb); s.scale.setScalar(0.08 + R() * 0.05); g.add(s); list.push({ s: s, x: (R() - 0.5) * spread, z: (R() - 0.5) * spread, y: y0 + R() * (y1 - y0), ph: R() * 6.28 }); }
    ctx.anim(function (t) { list.forEach(function (o) { o.s.position.set(o.x + Math.sin(t * 0.4 + o.ph) * 0.15, o.y + Math.sin(t * 0.9 + o.ph) * 0.08, o.z + Math.cos(t * 0.35 + o.ph) * 0.15); }); });
    return g;
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(61), g = new THREE.Group();
    g.add(island());

    /* ===== Level 1 ===== */
    [[0.05, 1.15], [0.12, 0.95], [0.2, 0.78], [-0.12, -0.25], [-0.25, -0.38]].forEach(function (p, i) {   // stepping-stone path
      var st = K3.rock({ radius: 0.085, detail: 2, seed: 50 + i, squash: 0.25, color: '#e4e8e4', material: M.rock }); st.position.set(p[0], Y(p[0], p[1]) - 0.005, p[1]); g.add(st);
    });
    [[1.0, -0.42, 0], [0.92, 0.78, 2]].forEach(function (p) { var ln = lantern(ctx, p[2]); ln.position.set(p[0], Y(p[0], p[1]) - 0.01, p[1]); ln.rotation.y = Math.PI / 4; g.add(ln); });
    for (var f = 0; f < 18; f++) {                                           // faintly glowing flowers
      var a = R() * Math.PI * 2, r = 0.6 + R() * 0.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (Math.hypot(x - SPOT.x, z - SPOT.z) < SPOT.r + 0.1 || Math.hypot(x - POND.x, z - POND.z) < POND.r + 0.08) continue;
      var fl = new THREE.Group(); fl.position.set(x, Y(x, z), z); g.add(fl);
      for (var k = 0; k < 5; k++) { var pp = new THREE.Mesh(new THREE.SphereGeometry(0.018, 6, 4), M.flower); pp.scale.set(1, 0.4, 0.6); pp.position.set(Math.cos(k * 1.26) * 0.018, 0.035, Math.sin(k * 1.26) * 0.018); fl.add(pp); }
    }
    g.add(orbs(ctx, R, 8, 2.2, TOP + 0.3, TOP + 1.2));
    var soft = new THREE.PointLight(col('#8ff4e4'), 0.5, 3, 2); soft.position.set(0.2, TOP + 0.9, 0.2); g.add(soft);

    /* ===== Level 2: moon gate + ghost tree ===== */
    var gate = null;
    if (level >= 2) {
      gate = new THREE.Group(); gate.position.set(GATE.x, Y(GATE.x, GATE.z), GATE.z); gate.rotation.y = Math.PI / 4; g.add(gate);
      var Rg = 0.55;
      var ring = new THREE.Mesh(new THREE.TorusGeometry(Rg, 0.09, 12, 48), M.marble); ring.position.y = Rg + 0.08; ring.castShadow = true; gate.add(ring);
      var wall = new THREE.Shape(); wall.moveTo(-0.85, 0); wall.lineTo(0.85, 0); wall.lineTo(0.85, 0.95); wall.quadraticCurveTo(0, 1.4, -0.85, 0.95); wall.lineTo(-0.85, 0);
      var hole = new THREE.Path(); hole.absarc(0, Rg + 0.08, Rg, 0, Math.PI * 2, true); wall.holes.push(hole);
      var wg = new THREE.ExtrudeGeometry(wall, { depth: 0.1, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 1, curveSegments: 24 }); wg.translate(0, 0, -0.05);
      var wallM = new THREE.Mesh(wg, M.marble); wallM.castShadow = wallM.receiveShadow = true; gate.add(wallM);
      var roofG = K3.roundedBox(1.85, 0.05, 0.22, 0.015, M.marble); roofG.position.y = 1.2; gate.add(roofG);
      var pt = portal(ctx, Rg - 0.02); pt.position.y = Rg + 0.08; gate.add(pt);
      var gl = new THREE.PointLight(col('#6ff0e0'), 1.2, 2.5, 2); gl.position.set(0, Rg + 0.1, 0.3); gate.add(gl);
      var tree = ghostTree(ctx, R); tree.position.set(GTREE.x, Y(GTREE.x, GTREE.z) - 0.02, GTREE.z); g.add(tree);
    }

    /* ===== Level 3: koi pond ===== */
    if (level >= 3) {
      var py = Y(POND.x, POND.z);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(POND.r, 0.04, 8, 40), M.marble); rim.rotation.x = Math.PI / 2; rim.position.set(POND.x, py + 0.02, POND.z); g.add(rim);
      var water = new THREE.Mesh(new THREE.CircleGeometry(POND.r, 40), M.water); water.rotation.x = -Math.PI / 2; water.position.set(POND.x, py + 0.022, POND.z); g.add(water);
      var fish = new THREE.Group(); fish.position.set(POND.x, py + 0.03, POND.z); g.add(fish);
      fish.add(koi(ctx, 0.17, 0.7, 0, 1)); fish.add(koi(ctx, 0.12, -0.9, 2, 0.8)); fish.add(koi(ctx, 0.2, 0.5, 4, 0.9));
    }

    /* ===== Level 4: spirit shrine ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var plat = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.07, 48), M.marble); plat.position.set(SPOT.x, y0 + 0.02, SPOT.z); plat.castShadow = plat.receiveShadow = true; g.add(plat);
      [0.92, 0.66, 0.4].forEach(function (k, i) {
        var rg = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r * k, 0.008, 4, 64), M.rings); rg.rotation.x = Math.PI / 2; rg.position.set(SPOT.x, y0 + 0.057, SPOT.z); g.add(rg);
      });
      ctx.anim(function (t) { M.rings.emissiveIntensity = 2.0 + Math.sin(t * 1.5) * 0.5; });
      [45, 135, 225, 315].forEach(function (deg, i) {                         // hovering spirit lamps
        var a2 = deg * Math.PI / 180, lx = SPOT.x + Math.cos(a2) * (SPOT.r + 0.12), lz = SPOT.z + Math.sin(a2) * (SPOT.r + 0.12);
        var lamp = new THREE.Group(); g.add(lamp);
        var paper = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 10), M.lampPaper); paper.scale.y = 1.3; lamp.add(paper);
        var cap1 = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.015, 10), M.marble); cap1.position.y = 0.08; lamp.add(cap1);
        ctx.anim(function (t) { lamp.position.set(lx, Y(lx, lz) + 0.4 + Math.sin(t * 1.2 + i) * 0.05, lz); });
      });
    }

    /* ===== Level 5: ethereal crown ===== */
    if (level >= 5 && gate) {
      // Two ribbons of light spiralling up around the gate
      [0, Math.PI].forEach(function (ph) {
        var pts = [];
        for (var i = 0; i <= 40; i++) { var u = i / 40, a = ph + u * Math.PI * 3.5, r = 0.75 - u * 0.25; pts.push(new V(GATE.x + Math.cos(a) * r, TOP + 0.1 + u * 1.9, GATE.z + Math.sin(a) * r)); }
        var curve = new THREE.CatmullRomCurve3(pts), rib = new THREE.Mesh(new THREE.TubeGeometry(curve, 80, 0.012, 4, false), M.ribbon); g.add(rib);
        var head = new THREE.Sprite(M.orb); head.scale.setScalar(0.18); g.add(head);
        ctx.anim(function (t) { head.position.copy(curve.getPointAt((t * 0.12 + ph / 6.28) % 1)); });
      });
      var halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.015, 8, 64), M.rings); halo.position.set(GATE.x, TOP + 2.05, GATE.z); halo.rotation.x = Math.PI / 2; g.add(halo);
      ctx.anim(function (t) { halo.position.y = TOP + 2.05 + Math.sin(t * 0.7) * 0.04; });
      // Glowing petals drifting down
      var petals = [];
      for (var p = 0; p < 14; p++) { var pe = new THREE.Mesh(new THREE.CircleGeometry(0.025, 6), M.lampPaper); g.add(pe); petals.push({ m: pe, x: (R() - 0.5) * 2.2, z: (R() - 0.5) * 2.2, ph: R() * 10 }); }
      ctx.anim(function (t) {
        petals.forEach(function (P) { var k = (t * 0.1 + P.ph) % 1; P.m.position.set(P.x + Math.sin(t + P.ph) * 0.15, TOP + 1.9 - k * 1.8, P.z + Math.cos(t * 0.8 + P.ph) * 0.12); P.m.rotation.set(t + P.ph, t * 0.7, P.ph); });
      });
      g.add(orbs(ctx, R, 10, 1.6, TOP + 1.0, TOP + 2.0));
    }
    return g;
  }

  HABITATS.register({ id: 'spirit', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.06, z: SPOT.z, r: SPOT.r }, build: build });
})();
