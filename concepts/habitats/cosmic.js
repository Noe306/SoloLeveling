/* ==========================================================================
   habitats/cosmic.js: Cosmic Habitat (element 16). Inspiration: impossible-
   triangle sculpture in the desert (own design, mood-board image used as
   inspiration only).

   Layout (camera looks from +x,+z): the impossible triangle stands at the BACK,
   the dragon rests on the constellation disc at the FRONT-right.
   Palette: violet desert sand, starfield (deep blue + pink/blue nebula), gold.

   THE IMPOSSIBLE TRIANGLE: three straight beams along x, then y, then z. Their
   lengths are chosen so the whole path adds up to a vector parallel to the game
   camera's view direction (1, 1.35, 1): seen from the village camera, the end of
   the last beam lands exactly on the start of the first, and the open 3D zig-zag
   reads as a closed, impossible triangle. (From the free camera it opens up.)

   Levels designed: 1-5 (each level = previous level + new layer)
     1  violet desert island with dunes, meteorite rocks glowing with star specks,
          floating pebbles, sparkling star sand
     2  + the impossible triangle (focal point): starfield beams with gold edges
     3  + small ringed planets orbiting the triangle, meteor crater with glowing
          crystals
     4  + constellation disc on the dragon spot: stars linked by glowing lines,
          ring of moonstones
     5  + spiral galaxy turning in the sky, shooting stars
   ========================================================================== */
(function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3;
  var TOP = 0.55;
  var SPOT = { x: 0.35, z: 0.35, r: 0.5 };
  var TRI = { x: -0.95, z: -0.95, L: 0.88 };        // start corner of the triangle path (back)
  var VIEW = new V(1, 1.35, 1);                      // village camera direction (same as the gallery)
  var CRATER = { x: 0.95, z: -0.55 };

  var M = null;
  function mats() {
    if (M) return M;
    var dot = dotTexture();
    M = {
      rock: K3.mat('stone', { vertexColors: true, flat: true, repeat: 1, color: '#b8a8d0' }),
      sand: K3.mat('stone', { repeat: 2, color: '#9a86c8' }),                 // violet star-dust ground (the sand texture is yellow and turned peach)
      gold: K3.mat('metal', { color: '#f0c050', roughness: 0.2 }),
      moon: new THREE.MeshStandardMaterial({ color: col('#e8eaf4'), emissive: col('#8a9ad8'), emissiveIntensity: 0.25, roughness: 0.4 }),
      line: K3.mat('glow', { color: '#bfd4ff', intensity: 2.0 }),
      starDot: K3.mat('glow', { color: '#ffffff', intensity: 2.6 }),
      crystal: null,
      planetA: new THREE.MeshStandardMaterial({ color: col('#e8906a'), roughness: 0.7 }),
      planetB: new THREE.MeshStandardMaterial({ color: col('#6ab4e8'), roughness: 0.6 }),
      planetC: new THREE.MeshStandardMaterial({ color: col('#c88ae8'), roughness: 0.6 }),
      ringM: new THREE.MeshStandardMaterial({ color: col('#f0e0c0'), roughness: 0.6, side: THREE.DoubleSide, transparent: true, opacity: 0.85 }),
      sparkle: new THREE.PointsMaterial({ map: dot, color: col('#e8e0ff'), size: 0.04, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      galaxy: new THREE.PointsMaterial({ map: dot, vertexColors: true, size: 0.045, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }),
      streak: new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
      brass: K3.mat('metal', { color: '#d4a04a', roughness: 0.3 }),
      nebula: new THREE.SpriteMaterial({ map: dot, color: col('#ffffff'), transparent: true, opacity: 0.25, blending: THREE.AdditiveBlending, depthWrite: false })
    };
    M.space = starfield('#0a0820', '#5a2a8a', '#1a3a9a', 55);
    M.rockStars = starfield('#2a2040', '#4a2a6a', '#2a3a7a', 90);
    return M;
  }

  function dotTexture() {
    var c = document.createElement('canvas'); c.width = c.height = 32;
    var x = c.getContext('2d'), g = x.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.45, 'rgba(255,255,255,0.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g; x.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(c);
  }

  // Night-sky material: dark base + nebula bands + twinkling stars, from world position.
  function starfield(base, neb1, neb2, density) {
    var m = new THREE.ShaderMaterial({
      uniforms: { t: { value: 0 }, c0: { value: col(base) }, c1: { value: col(neb1) }, c2: { value: col(neb2) }, dens: { value: density } },
      vertexShader: 'varying vec3 vP; varying vec3 vN; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xyz; vN = normalize(mat3(modelMatrix) * normal); gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: 'varying vec3 vP; varying vec3 vN; uniform float t; uniform vec3 c0, c1, c2; uniform float dens;\n' +
        'float h(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }\n' +
        'void main(){\n' +
        '  float n1 = 0.5 + 0.5 * sin(vP.x * 3.1 + sin(vP.z * 2.3 + t * 0.15) * 2.0) * sin(vP.y * 4.0 + vP.z * 2.7);\n' +
        '  float n2 = 0.5 + 0.5 * sin(vP.z * 2.6 - vP.x * 1.7 + vP.y * 1.3 + t * 0.1);\n' +
        '  vec3 c = c0 + c1 * n1 * 0.6 + c2 * n2 * 0.45;\n' +
        '  c *= 0.75 + 0.25 * max(0.0, dot(vN, normalize(vec3(-0.4, 0.8, 0.4))));\n' +   // a little shading so shapes read
        '  vec3 cell = floor(vP * dens); float s = h(cell);\n' +
        '  float d = length(fract(vP * dens) - 0.5);\n' +
        '  float star = step(0.97, s) * smoothstep(0.45, 0.1, d) * (0.55 + 0.45 * sin(t * 3.0 + s * 60.0));\n' +
        '  gl_FragColor = vec4(c + vec3(1.0, 0.95, 0.9) * star * 1.4, 1.0); }'
    });
    m.userData.tick = function (t) { m.uniforms.t.value = t; };
    return m;
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
    var under = K3.rock({ radius: 1.38, detail: 4, seed: 201, squash: 0.42, lumpy: 0.22, material: M.rockStars });
    under.scale.set(1, 0.9, 1); under.position.y = 0.05; g.add(under);
    var cap = K3.rock({ radius: 1.408, detail: 4, seed: 23, squash: 0.09, lumpy: 0.09, flat: false, material: M.sand });   // a little lumpier: dunes
    topUV(cap, 0.45); cap.position.y = 0.44; g.add(cap);
    return g;
  }

  // Square beam between two points (starfield body + thin gold edge strips on the four corners).
  function beam(a, b, w) {
    var g = new THREE.Group(), d = b.clone().sub(a), len = d.length();
    var body = new THREE.Mesh(new THREE.BoxGeometry(w, len + w, w), M.space); g.add(body);
    [[1, 1], [1, -1], [-1, 1], [-1, -1]].forEach(function (c) {
      var e = new THREE.Mesh(new THREE.BoxGeometry(w * 0.12, len + w * 1.02, w * 0.12), M.gold); e.position.set(c[0] * w / 2, 0, c[1] * w / 2); g.add(e);
    });
    g.position.copy(a).addScaledVector(d, 0.5);
    g.quaternion.setFromUnitVectors(new V(0, 1, 0), d.normalize());
    return g;
  }

  // Crystal cluster in cosmic blue (kind 0) or pink (kind 1).
  function gemCluster(kind, opts) {
    var c = K3.crystalCluster(Object.assign(kind ? { color: '#ff9ae0', emissive: '#d040b0' } : { color: '#8ac8ff', emissive: '#3a7aff' }, { intensity: 0.55 }, opts));
    c.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) { o.material.envMapIntensity = 0.4; o.material.opacity = 0.92; } });
    return c;
  }

  // Four-point star: two flat diamonds crossed, glowing.
  function starShape(s) {
    var g = new THREE.Group(), shape = new THREE.Shape();
    shape.moveTo(0, s); shape.lineTo(s * 0.22, 0); shape.lineTo(0, -s); shape.lineTo(-s * 0.22, 0); shape.lineTo(0, s);
    var geo = new THREE.ShapeGeometry(shape);
    var a = new THREE.Mesh(geo, M.starDot), b = new THREE.Mesh(geo, M.starDot); b.rotation.z = Math.PI / 2; g.add(a); g.add(b);
    a.material.side = THREE.DoubleSide;
    return g;
  }

  function planet(r, mat, ring) {
    var g = new THREE.Group(), p = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), mat); p.castShadow = true; g.add(p);
    if (ring) { var rg = new THREE.Mesh(new THREE.RingGeometry(r * 1.35, r * 1.8, 40), M.ringM); rg.rotation.x = Math.PI / 2 - 0.4; g.add(rg); }
    return g;
  }

  function build(level, ctx) {
    mats();
    var R = ctx.rng(71), g = new THREE.Group();
    ctx.anim(M.space.userData.tick); ctx.anim(M.rockStars.userData.tick);
    g.add(island());

    /* ===== Level 1 ===== */
    [[1.05, 0.2, 0.17, 1], [-0.25, 1.05, 0.15, 2], [-1.08, 0.3, 0.19, 3], [0.55, 1.0, 0.11, 4]].forEach(function (p) {   // meteorites with star specks
      var m = K3.rock({ radius: p[2], detail: 3, seed: 40 + p[3], squash: 0.75, lumpy: 0.35, material: M.rockStars }); m.position.set(p[0], Y(p[0], p[1]) + 0.02, p[1]); g.add(m);
    });
    var pebbles = new THREE.Group(); g.add(pebbles);
    for (var i = 0; i < 7; i++) {
      var pb = K3.rock({ radius: 0.035 + R() * 0.03, detail: 2, seed: 60 + i, squash: 0.8, material: M.rockStars }), a = R() * Math.PI * 2, r = 0.5 + R() * 0.6;
      pb.position.set(Math.cos(a) * r, TOP + 0.25 + R() * 0.4, Math.sin(a) * r); pebbles.add(pb);
      (function (o, y0, ph) { ctx.anim(function (t) { o.position.y = y0 + Math.sin(t * 0.9 + ph) * 0.05; o.rotation.y = t * 0.3 + ph; }); })(pb, pb.position.y, i);
    }
    var n = 60, pos = new Float32Array(n * 3);                              // sparkling star sand
    for (var s = 0; s < n; s++) { var sa = R() * 6.28, sr = Math.sqrt(R()) * 1.2; pos[s * 3] = Math.cos(sa) * sr; pos[s * 3 + 1] = Y(Math.cos(sa) * sr, Math.sin(sa) * sr) + 0.01; pos[s * 3 + 2] = Math.sin(sa) * sr; }
    var sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    var sand = new THREE.Points(sg, M.sparkle); g.add(sand);
    ctx.anim(function (t) { M.sparkle.opacity = 0.6 + Math.sin(t * 4) * 0.3; });
    var violet = new THREE.PointLight(col('#a080ff'), 0.6, 3, 2); violet.position.set(0, TOP + 1, 0); g.add(violet);
    // Cosmic crystal clusters (blue / pink) around the rim
    [[0.5, -1.0, 0.3, 0], [-0.62, 0.92, 0.26, 1], [1.15, 0.55, 0.22, 0], [-1.15, -0.2, 0.28, 1], [0.15, -1.12, 0.24, 0]].forEach(function (c, i) {
      var cc = gemCluster(c[3], { count: 3, height: c[2], radius: 0.045, seed: 150 + i, spread: 0.05 });
      cc.position.set(c[0], Y(c[0], c[1]) - 0.02, c[1]); g.add(cc);
    });
    // Small craters: a raised rim with a patch of starry sky inside
    [[0.62, -0.15, 0.1], [-0.55, 0.35, 0.08], [0.0, 0.85, 0.07]].forEach(function (c) {
      var cy2 = Y(c[0], c[1]);
      var cr = new THREE.Mesh(new THREE.TorusGeometry(c[2], c[2] * 0.3, 6, 20), M.sand); cr.rotation.x = Math.PI / 2; cr.scale.z = 0.5; cr.position.set(c[0], cy2 + 0.005, c[1]); g.add(cr);
      var hole = new THREE.Mesh(new THREE.CircleGeometry(c[2] * 0.85, 20), M.space); hole.rotation.x = -Math.PI / 2; hole.position.set(c[0], cy2 + 0.008, c[1]); g.add(hole);
    });
    // Stardust trails: thin glowing swirls drawn on the ground
    [[-0.2, -0.1, 0.32, 2.6, 0.3], [0.85, 0.85, 0.22, 2.2, 2.0]].forEach(function (s3) {
      var pts = [];
      for (var q = 0; q <= 24; q++) { var u = q / 24, a2 = s3[4] + u * s3[3], rr2 = s3[2] * (0.35 + u * 0.65), x2 = s3[0] + Math.cos(a2) * rr2, z2 = s3[1] + Math.sin(a2) * rr2; pts.push([x2, Y(x2, z2) + 0.012, z2]); }
      g.add(K3.tube(pts, [0.004, 0.008], M.line, 48));
    });
    // Little four-point stars floating and twinkling
    for (var fs = 0; fs < 6; fs++) {
      var st4 = starShape(0.05), fa = fs / 6 * Math.PI * 2 + 0.3, fr = 0.75 + (fs % 2) * 0.35;
      st4.position.set(Math.cos(fa) * fr, TOP + 0.55 + (fs % 3) * 0.2, Math.sin(fa) * fr); g.add(st4);
      (function (o, y0, ph) { ctx.anim(function (t) { o.position.y = y0 + Math.sin(t * 1.1 + ph) * 0.05; o.rotation.z = t * 0.6 + ph; o.scale.setScalar(0.8 + 0.3 * Math.sin(t * 3 + ph)); }); })(st4, st4.position.y, fs);
    }

    /* ===== Level 2: the impossible triangle ===== */
    var triCentre = null;
    if (level >= 2) {
      // Path x -> y -> z with lengths L, 1.35 L, L: the sum is parallel to VIEW, so from the game camera
      // the last corner sits right on top of the first one.
      var L = TRI.L, k = L / VIEW.x, w = 0.16;
      var A = new V(TRI.x, Y(TRI.x, TRI.z) + 0.12, TRI.z);
      var B = A.clone().add(new V(VIEW.x * k, 0, 0)), C = B.clone().add(new V(0, VIEW.y * k, 0)), D = C.clone().add(new V(0, 0, VIEW.z * k));
      [[A, B], [B, C], [C, D]].forEach(function (s2) { g.add(beam(s2[0], s2[1], w)); });
      var foot = K3.rock({ radius: 0.2, detail: 3, seed: 90, squash: 0.45, material: M.rockStars }); foot.position.set(A.x + 0.1, Y(A.x, A.z), A.z); g.add(foot);
      var foot2 = K3.rock({ radius: 0.16, detail: 3, seed: 91, squash: 0.45, material: M.rockStars }); foot2.position.set(B.x, Y(B.x, B.z), B.z); g.add(foot2);
      triCentre = A.clone().add(B).add(C).add(D).multiplyScalar(0.25);
      // Two-step starfield plinth with gold trim under the first corner
      [[0.42, 0.06, 0], [0.3, 0.06, 0.06]].forEach(function (s4) {
        var step = new THREE.Mesh(new THREE.BoxGeometry(s4[0], s4[1], s4[0]), M.space); step.position.set(A.x + 0.05, Y(A.x, A.z) + 0.03 + s4[2], A.z); g.add(step);
        var trim = new THREE.Mesh(new THREE.BoxGeometry(s4[0] + 0.01, 0.012, s4[0] + 0.01), M.gold); trim.position.set(A.x + 0.05, Y(A.x, A.z) + 0.06 + s4[2], A.z); g.add(trim);
      });
      // Glowing gems on the two bends of the triangle
      [B, C].forEach(function (p2, i) {
        var gm = new THREE.Mesh(new THREE.OctahedronGeometry(0.06, 0), M.starDot); gm.position.copy(p2).add(new V(0.1, 0.1, 0.1)); g.add(gm);
        ctx.anim(function (t) { gm.rotation.y = t * 1.2 + i; gm.position.y = p2.y + 0.1 + Math.sin(t * 1.5 + i) * 0.03; });
      });
      var tl = new THREE.PointLight(col('#c8a0ff'), 1.2, 3, 2); tl.position.copy(triCentre).add(new V(0.3, 0.2, 0.3)); g.add(tl);
    }

    /* ===== Level 3: orbiting planets + meteor crater ===== */
    if (level >= 3) {
      var orbit = new THREE.Group(); orbit.position.copy(triCentre || new V(-0.5, TOP + 0.8, -0.5)); g.add(orbit);
      [[0.08, M.planetA, true, 0], [0.06, M.planetB, false, 2.1], [0.07, M.planetC, true, 4.2]].forEach(function (p) {
        var pl = planet(p[0], p[1], p[2]); pl.position.set(Math.cos(p[3]) * 0.85, Math.sin(p[3] * 2) * 0.15, Math.sin(p[3]) * 0.85); orbit.add(pl);
        (function (o) { ctx.anim(function (t) { o.rotation.y = t * 0.8; }); })(pl);
      });
      ctx.anim(function (t) { orbit.rotation.y = t * 0.25; });
      var cy = Y(CRATER.x, CRATER.z);
      var rim = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.06, 8, 24), M.sand); rim.rotation.x = Math.PI / 2; rim.position.set(CRATER.x, cy + 0.01, CRATER.z); rim.scale.z = 0.6; g.add(rim);
      var meteor = K3.rock({ radius: 0.1, detail: 3, seed: 95, squash: 0.8, lumpy: 0.35, material: M.rockStars }); meteor.position.set(CRATER.x, cy + 0.04, CRATER.z); g.add(meteor);
      var cc = K3.crystalCluster({ count: 4, height: 0.3, radius: 0.04, seed: 97, spread: 0.1, color: '#bfa8ff', emissive: '#8a5aff', intensity: 0.6 });
      cc.traverse(function (o) { if (o.material && o.material.clearcoat !== undefined) o.material.envMapIntensity = 0.4; });
      cc.position.set(CRATER.x, cy, CRATER.z); g.add(cc);
      var cl = new THREE.PointLight(col('#a080ff'), 0.7, 1.5, 2); cl.position.set(CRATER.x, cy + 0.3, CRATER.z); g.add(cl);
      // Asteroid belt: small rocks circling the whole island just below the rim
      var belt = new THREE.Group(); belt.position.y = TOP - 0.05; belt.rotation.z = 0.08; g.add(belt);
      for (var b = 0; b < 26; b++) {
        var ba = b / 26 * Math.PI * 2 + R() * 0.15, br = 1.52 + R() * 0.12;
        var ast = K3.rock({ radius: 0.025 + R() * 0.03, detail: 1, seed: 300 + b, squash: 0.8, lumpy: 0.4, material: M.rockStars });
        ast.position.set(Math.cos(ba) * br, (R() - 0.5) * 0.1, Math.sin(ba) * br); belt.add(ast);
      }
      ctx.anim(function (t) { belt.rotation.y = t * 0.08; });
    }

    /* ===== Level 4: constellation disc + moonstones ===== */
    if (level >= 4) {
      var y0 = Y(SPOT.x, SPOT.z);
      var disc = new THREE.Mesh(new THREE.CylinderGeometry(SPOT.r, SPOT.r + 0.04, 0.06, 48), M.space); disc.position.set(SPOT.x, y0 + 0.02, SPOT.z); g.add(disc);
      var grim = new THREE.Mesh(new THREE.TorusGeometry(SPOT.r + 0.01, 0.016, 8, 64), M.gold); grim.rotation.x = Math.PI / 2; grim.position.set(SPOT.x, y0 + 0.05, SPOT.z); g.add(grim);
      // A dragon-like constellation: stars linked by glowing lines
      var stars = [[-0.3, -0.1], [-0.15, 0.05], [0.0, 0.0], [0.15, 0.12], [0.3, 0.05], [0.1, -0.2], [-0.05, -0.28], [0.32, 0.25]];
      var links = [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5], [5, 6], [3, 7]];
      stars.forEach(function (s3) { var st = new THREE.Mesh(new THREE.SphereGeometry(0.018, 8, 6), M.starDot); st.position.set(SPOT.x + s3[0], y0 + 0.06, SPOT.z + s3[1]); g.add(st); });
      links.forEach(function (lk) {
        var a2 = new V(SPOT.x + stars[lk[0]][0], y0 + 0.056, SPOT.z + stars[lk[0]][1]), b2 = new V(SPOT.x + stars[lk[1]][0], y0 + 0.056, SPOT.z + stars[lk[1]][1]), d = b2.clone().sub(a2);
        var ln = new THREE.Mesh(new THREE.BoxGeometry(d.length(), 0.004, 0.008), M.line); ln.position.copy(a2).addScaledVector(d, 0.5); ln.rotation.y = -Math.atan2(d.z, d.x); g.add(ln);
      });
      ctx.anim(function (t) { M.line.emissiveIntensity = 2 + Math.sin(t * 1.5) * 0.6; });
      for (var m2 = 0; m2 < 6; m2++) {                                       // moonstones (each a crescent of glow)
        var ma = m2 / 6 * Math.PI * 2 + 0.5, mx = SPOT.x + Math.cos(ma) * (SPOT.r + 0.15), mz = SPOT.z + Math.sin(ma) * (SPOT.r + 0.15);
        var ms = K3.rock({ radius: 0.06, detail: 2, seed: 120 + m2, squash: 1.2, flat: false, material: M.moon }); ms.position.set(mx, Y(mx, mz) + 0.05, mz); g.add(ms);
      }
      // Brass telescope on a tripod, pointing at the sky (where the galaxy appears at level 5)
      var tx = 1.08, tz = -0.08, ty = Y(tx, tz), scope = new THREE.Group(); scope.position.set(tx, ty, tz); g.add(scope);
      [0, 2.1, 4.2].forEach(function (a3) {
        scope.add(K3.tube([[0, 0.3, 0], [Math.cos(a3) * 0.12, 0.0, Math.sin(a3) * 0.12]], 0.009, M.brass, 3));
      });
      var tubeG = new THREE.Group(); tubeG.position.y = 0.3; scope.add(tubeG);
      var body = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.045, 0.36, 14), M.brass); body.position.y = 0.12; tubeG.add(body);
      var lens = new THREE.Mesh(new THREE.CircleGeometry(0.03, 14), M.line); lens.rotation.x = -Math.PI / 2; lens.position.y = 0.301; tubeG.add(lens);
      var band = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.008, 6, 16), M.gold); band.rotation.x = Math.PI / 2; band.position.y = 0.05; tubeG.add(band);
      tubeG.rotation.set(-0.5, 0, 0.75);                                     // tilted up towards the back-left sky
      ctx.anim(function (t) { tubeG.rotation.y = Math.sin(t * 0.3) * 0.15; });
    }

    /* ===== Level 5: spiral galaxy + shooting stars ===== */
    if (level >= 5) {
      var gal = new THREE.Group(); gal.position.set(0.1, TOP + 2.3, -0.2); gal.rotation.x = 0.55; gal.rotation.z = -0.2; g.add(gal);
      var N = 700, gp = new Float32Array(N * 3), gc = new Float32Array(N * 3), cIn = col('#ffe8c8'), cOut = col('#8a7aff'), cPink = col('#ff8ad8'), c = new THREE.Color();
      for (var q = 0; q < N; q++) {
        var arm = q % 2, u = Math.pow(R(), 0.7), ang = u * 7 + arm * Math.PI + (R() - 0.5) * 0.5, rad = u * 0.75;
        gp[q * 3] = Math.cos(ang) * rad; gp[q * 3 + 1] = (R() - 0.5) * 0.04 * (1 - u); gp[q * 3 + 2] = Math.sin(ang) * rad;
        c.copy(cIn).lerp(u > 0.5 && q % 3 === 0 ? cPink : cOut, u); gc[q * 3] = c.r; gc[q * 3 + 1] = c.g; gc[q * 3 + 2] = c.b;
      }
      var gg = new THREE.BufferGeometry(); gg.setAttribute('position', new THREE.BufferAttribute(gp, 3)); gg.setAttribute('color', new THREE.BufferAttribute(gc, 3));
      gal.add(new THREE.Points(gg, M.galaxy));
      var coreG = new THREE.Mesh(new THREE.SphereGeometry(0.06, 12, 8), M.starDot); gal.add(coreG);
      ctx.anim(function (t) { gal.rotation.y = t * 0.15; });
      // Shooting stars: a bright streak crossing the sky every couple of seconds
      var shoot = [];
      for (var k2 = 0; k2 < 2; k2++) { var sm = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.012, 0.45, 6), M.streak); g.add(sm); shoot.push(sm); }
      ctx.anim(function (t) {
        shoot.forEach(function (sm, i) {
          var k3 = ((t * 0.35 + i * 0.5) % 1), on = k3 < 0.3; sm.visible = on; if (!on) return;
          var u2 = k3 / 0.3, from = new V(-1.4 + i * 0.6, TOP + 2.6, 0.6 - i * 1.2), to = from.clone().add(new V(1.8, -0.9, 0.4));
          sm.position.copy(from).lerp(to, u2); sm.quaternion.setFromUnitVectors(new V(0, -1, 0), to.clone().sub(from).normalize());
        });
      });
      // Nebula clouds: big soft pink / blue glows behind the galaxy
      [['#ff7ad0', -0.5, 0.15, 1.3], ['#6a8aff', 0.6, -0.1, 1.1], ['#b07aff', 0.1, 0.35, 0.9]].forEach(function (nb, i) {
        var sp = new THREE.Sprite(M.nebula.clone()); sp.material.color = col(nb[0]); sp.scale.setScalar(nb[3]);
        sp.position.set(gal.position.x + nb[1], gal.position.y + nb[2], gal.position.z - 0.3); g.add(sp);
        ctx.anim(function (t) { sp.material.opacity = 0.22 + Math.sin(t * 0.5 + i * 2) * 0.06; });
      });
      // Comet circling the island with a fading tail
      var comet = new THREE.Group(); g.add(comet);
      var head = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), M.starDot); comet.add(head);
      var tail = [];
      for (var tq = 0; tq < 10; tq++) { var ts = new THREE.Sprite(M.nebula.clone()); ts.material.color = col('#cfe0ff'); g.add(ts); tail.push(ts); }
      ctx.anim(function (t) {
        tail.forEach(function (ts, i) {
          var a4 = t * 0.5 - i * 0.05, p4 = new V(Math.cos(a4) * 1.75, TOP + 1.3 + Math.sin(a4 * 2) * 0.2, Math.sin(a4) * 1.75);
          if (i === 0) head.position.copy(p4);
          ts.position.copy(p4); ts.scale.setScalar(0.12 * (1 - i / 12)); ts.material.opacity = 0.55 * (1 - i / 10);
        });
      });
    }
    return g;
  }

  HABITATS.register({ id: 'cosmic', levels: 5, footprint: 1.3, dragonSpot: { x: SPOT.x, y: TOP + 0.05, z: SPOT.z, r: SPOT.r }, build: build });
})();
