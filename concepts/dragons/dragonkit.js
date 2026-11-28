/* ==========================================================================
   dragons/dragonkit.js: procedural stylised dragon builder (DK.*), shared by
   every element. An element file only gives a palette + proportions per stage.

   PARTS (model faces +z, y up, feet on y = 0)
     torso + neck   one smooth loft along a spine curve: belly plates underneath,
                    darker chevron stripes on the back, optional glowing veins
                    (lava cracks) and glowing plate seams, scale normal map
     tail           second loft, pivots at the hips (sways), spikes on top
     head           angular loft (flat snout top, flared nostrils), eyes with slit
                    pupils, lids or cute highlights, blinking, brow ridges, ringed
                    horns, cheek spikes, optional open jaw with teeth + glowing mouth
     legs           smooth tapered legs with three toes and curved claws
     wings          dark arm + finger bones with claws, membrane shaded from dark
                    (body) to a glowing edge, billowing; tilted so both read
     spikes         two-tone dorsal spikes (dark base, glowing tip)

   GLOW: materials get a per-vertex "glow" attribute (0..1) that scales the
   emissive colour, so veins/seams/edges can glow while the rest stays matte.

   DK.dragon(spec, ctx) -> THREE.Group  (userData: height, parts)
   DK.egg(spec, ctx)    -> THREE.Group
   See dragons/fire.js for a complete spec.
   ========================================================================== */
var DK = (function () {
  'use strict';
  var col = K3.col, V = THREE.Vector3, UP = new V(0, 1, 0);

  /* ------------------------- scale texture (shared) ------------------------- */
  var SCALES = null;
  // Overlapping dome-shaped scales in staggered rows -> normal map (tiles in both directions).
  function scaleNormal() {
    if (SCALES) return SCALES;
    var S = 256, cols = 8, rows = 8, cw = S / cols, rh = S / rows, H = new Float32Array(S * S);
    for (var y = 0; y < S; y++) for (var x = 0; x < S; x++) {
      var r0 = Math.floor(y / rh), h = 0;
      for (var r = r0 - 1; r <= r0 + 1; r++) {                      // later rows overlap earlier ones
        var off = (((r % 2) + 2) % 2) * cw / 2, cx = Math.round((x - off) / cw) * cw + off, cy = r * rh;
        var d = Math.hypot(x - cx, (y - cy) * 1.25) / (cw * 0.62);
        if (d < 1) h = Math.sqrt(1 - d * d);
      }
      H[y * S + x] = h;
    }
    var c = document.createElement('canvas'); c.width = c.height = S;
    var cx2 = c.getContext('2d'), img = cx2.createImageData(S, S), k = 1.6;
    for (var yy = 0; yy < S; yy++) for (var xx = 0; xx < S; xx++) {
      var l = H[yy * S + (xx - 1 + S) % S], rr = H[yy * S + (xx + 1) % S], t = H[((yy - 1 + S) % S) * S + xx], b = H[((yy + 1) % S) * S + xx];
      var dx = (l - rr) * k, dy = (t - b) * k, len = Math.sqrt(dx * dx + dy * dy + 1), o = (yy * S + xx) * 4;
      img.data[o] = (dx / len * 0.5 + 0.5) * 255; img.data[o + 1] = (dy / len * 0.5 + 0.5) * 255; img.data[o + 2] = (1 / len * 0.5 + 0.5) * 255; img.data[o + 3] = 255;
    }
    cx2.putImageData(img, 0, 0);
    SCALES = new THREE.CanvasTexture(c); SCALES.wrapS = SCALES.wrapT = THREE.RepeatWrapping;
    return SCALES;
  }

  /* ------------------------- materials (one set per palette) ------------------------- */
  // Emissive light is multiplied by the per-vertex "glow" attribute (missing attribute = 0).
  function glowing(m) {
    m.onBeforeCompile = function (sh) {
      sh.vertexShader = 'attribute float glow;\nvarying float vGlow;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;');
      sh.fragmentShader = 'varying float vGlow;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\ntotalEmissiveRadiance *= vGlow;');
    };
    return m;
  }
  function materials(pal) {
    var n = scaleNormal();
    return {
      skin: glowing(new THREE.MeshStandardMaterial({ vertexColors: true, normalMap: n, normalScale: new THREE.Vector2(0.6, 0.6), roughness: 0.48, metalness: 0.05,
        emissive: col(pal.glow || '#000000'), emissiveIntensity: pal.glowI || 1.8 })),
      dark: new THREE.MeshStandardMaterial({ color: col(pal.top), normalMap: n, normalScale: new THREE.Vector2(0.4, 0.4), roughness: 0.55 }),
      bone: new THREE.MeshStandardMaterial({ color: col(pal.bone || pal.top), roughness: 0.5 }),
      horn: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.05 }),
      claw: new THREE.MeshStandardMaterial({ color: col(pal.claw), roughness: 0.3 }),
      spike: glowing(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.4, flatShading: true, emissive: col(pal.spikeTip || pal.spike), emissiveIntensity: 1.2 })),
      membrane: glowing(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.62, emissive: col(pal.membraneEdge || pal.membrane), emissiveIntensity: 0.9 })),
      eyeWhite: new THREE.MeshStandardMaterial({ color: col('#1a0e0a'), roughness: 0.2 }),
      iris: new THREE.MeshStandardMaterial({ color: col(pal.eye), emissive: col(pal.eye), emissiveIntensity: 1.1, roughness: 0.2 }),
      pupil: new THREE.MeshStandardMaterial({ color: col('#080406'), roughness: 0.3 }),
      shine: new THREE.MeshBasicMaterial({ color: col('#ffffff') }),
      tooth: new THREE.MeshStandardMaterial({ color: col('#f4ead8'), roughness: 0.4 }),
      mouth: new THREE.MeshStandardMaterial({ color: col('#2a0c08'), roughness: 0.8 }),
      mouthGlow: new THREE.MeshStandardMaterial({ color: col('#2a0a06'), emissive: col(pal.mouth || '#000000'), emissiveIntensity: 1.0, roughness: 0.6 })
    };
  }

  /* ------------------------- loft: a tube with an elliptical, varying section ------------------------- */
  // pts: spine points. prof(t) -> [rx, ryUp, ryDown]. colour(t, s, out, pos) fills out (THREE.Color),
  // s = sin(angle) (-1 underside .. +1 top). o: { seg, radial, scale (texture tile size), glow(t, s, pos) -> 0..1 }
  function loft(pts, prof, colour, material, o) {
    o = o || {};
    var curve = new THREE.CatmullRomCurve3(pts), seg = o.seg || 48, rad = o.radial || 20, L = curve.getLength(), ts = o.scale || 0.1;
    var pos = [], uv = [], cols = [], glow = [], idx = [], c = new THREE.Color(), lastB = new V(-1, 0, 0);
    for (var i = 0; i <= seg; i++) {
      var t = i / seg, P = curve.getPointAt(t), T = curve.getTangentAt(t);
      var B = new V().crossVectors(T, UP);
      if (B.lengthSq() < 1e-5) B.copy(lastB); else B.normalize();
      lastB.copy(B);
      var N = new V().crossVectors(B, T).normalize(), r = prof(t), circ = Math.PI * (r[0] + (r[1] + r[2]) / 2);
      for (var j = 0; j <= rad; j++) {
        var a = j / rad * Math.PI * 2, s = Math.sin(a), ry = s >= 0 ? r[1] : r[2];
        var q = P.clone().addScaledVector(B, Math.cos(a) * r[0]).addScaledVector(N, s * ry);
        pos.push(q.x, q.y, q.z);
        uv.push(j / rad * Math.max(1, circ / ts), t * L / ts);
        colour(t, s, c, q); cols.push(c.r, c.g, c.b);
        glow.push(o.glow ? o.glow(t, s, q) : 0);
        if (i < seg && j < rad) { var a0 = i * (rad + 1) + j, b0 = a0 + rad + 1; idx.push(a0, a0 + 1, b0, b0, a0 + 1, b0 + 1); }
      }
    }
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
    geo.setIndex(idx); geo.computeVertexNormals();
    // Make sure normals point outwards (check one vertex of the middle ring against the spine).
    var mid = Math.floor(seg / 2) * (rad + 1) + Math.floor(rad / 4), nrm = geo.attributes.normal;
    var out = new V(pos[mid * 3], pos[mid * 3 + 1], pos[mid * 3 + 2]).sub(curve.getPointAt(0.5));
    if (out.dot(new V(nrm.getX(mid), nrm.getY(mid), nrm.getZ(mid))) < 0) { geo.index.array.reverse(); geo.computeVertexNormals(); }
    var m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true;
    m.userData.curve = curve;
    return m;
  }

  // Skin colouring: belly plates underneath (with grooves), darker chevron stripes along the back.
  function skinColour(pal, bands, stripes) {
    var body = col(pal.body), top = col(pal.top), belly = col(pal.belly), groove = col(pal.belly).multiplyScalar(0.55), stripe = col(pal.top).multiplyScalar(0.75);
    return function (t, s, c) {
      c.copy(body);
      if (s > 0.2) c.lerp(top, Math.min(1, (s - 0.2) * 1.5));
      if (stripes && s > 0.05) {                                         // chevrons: bands bent forward on the flanks
        var k = (t * stripes + (1 - s) * 0.35) % 1;
        if (k < 0.32) c.lerp(stripe, Math.min(1, (s - 0.05) * 2.5) * 0.85);
      }
      if (s < -0.3) {
        var b = Math.min(1, (-s - 0.3) * 3.5);
        var g = bands ? Math.abs(Math.sin(t * bands * Math.PI)) : 1;     // plate grooves
        c.lerp(g < 0.22 ? groove : belly, b);
      }
    };
  }
  // Glow pattern: ridged noise veins on the back/flanks + glowing seams between belly plates.
  function veinGlow(veins, bands) {
    if (!veins || !veins.amount) return null;
    var f = veins.freq || 4;
    return function (t, s, q) {
      var g = 0;
      if (s > -0.35) {
        var n = Math.abs(K3.fbm3(q.x * f + 3.1, q.y * f, q.z * f, 3));
        g = Math.max(0, 1 - n / (veins.width || 0.07)) * Math.min(1, (s + 0.35) * 2);
      }
      if (bands && s < -0.4 && Math.abs(Math.sin(t * bands * Math.PI)) < 0.2) g = Math.max(g, 0.75);
      return g * veins.amount;
    };
  }

  // Piecewise-linear interpolation of keyframes (ks = sorted t values, vs = values).
  function keys(ks, vs, t) {
    for (var i = 1; i < ks.length; i++) if (t <= ks[i]) { var u = (t - ks[i - 1]) / (ks[i] - ks[i - 1]); return vs[i - 1] + (vs[i] - vs[i - 1]) * u; }
    return vs[vs.length - 1];
  }
  function smooth(u) { u = Math.max(0, Math.min(1, u)); return u * u * (3 - 2 * u); }

  // Two-tone cone (dark base -> bright tip) for spikes; tip part glows a little.
  function spikeMesh(r, h, pal, M) {
    var geo = new THREE.ConeGeometry(r, h, 5).toNonIndexed(), p = geo.attributes.position, cols = [], glow = [];
    var base = col(pal.spike), tip = col(pal.spikeTip || pal.spike), c = new THREE.Color();
    for (var i = 0; i < p.count; i++) {
      var u = (p.getY(i) + h / 2) / h; c.copy(base).lerp(tip, smooth((u - 0.45) / 0.55));
      cols.push(c.r, c.g, c.b); glow.push(smooth((u - 0.6) / 0.4) * (pal.spikeGlow || 0));
    }
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, M.spike); m.castShadow = true; return m;
  }

  // Ringed horn: tapering loft along pts, dark base -> pale tip.
  function horn(pts, r, pal, M) {
    var base = col(pal.hornBase || pal.horn), tip = col(pal.horn);
    return loft(pts, function (t) { var k = r * Math.pow(1 - t, 0.9) * (1 + 0.09 * Math.sin(t * 38)) + 0.002; return [k, k, k]; },
      function (t, s, c) { c.copy(base).lerp(tip, smooth(t * 1.4)); }, M.horn, { seg: 30, radial: 10, scale: 1 });
  }

  /* ------------------------- body parts ------------------------- */
  // One smooth leg (thigh -> knee -> ankle) + foot with three toes and curved claws.
  function leg(pts, r0, r1, M, pal) {
    var g = new THREE.Group(), body = col(pal.body), low = col(pal.body).multiplyScalar(0.72);
    var KT = [0, 0.12, 0.4, 0.72, 1], KR = [r0 * 1.25, r0 * 1.55, r0 * 0.95, r1 * 1.05, r1];
    g.add(loft(pts, function (t) { var r = keys(KT, KR, t); return [r, r, r]; },
      function (t, s, c) { c.copy(body).lerp(low, smooth((t - 0.45) / 0.5)); }, M.skin, { seg: 28, radial: 14, scale: 0.08 }));
    var f = pts[pts.length - 1], foot = new THREE.Mesh(new THREE.SphereGeometry(r1 * 1.35, 14, 10), M.dark);
    foot.scale.set(1.15, 0.6, 1.1); foot.position.set(f.x, r1 * 0.7, f.z); foot.castShadow = true; g.add(foot);
    for (var k = -1; k <= 1; k++) {
      var a = k * 0.38, dx = Math.sin(a), dz = Math.cos(a), tl = r1 * (k === 0 ? 1.9 : 1.55);
      var x0 = f.x + dx * r1 * 0.6, z0 = f.z + dz * r1 * 0.6, x1 = f.x + dx * (r1 * 0.6 + tl), z1 = f.z + dz * (r1 * 0.6 + tl);
      g.add(K3.tube([[x0, r1 * 0.75, z0], [(x0 + x1) / 2, r1 * 0.6, (z0 + z1) / 2], [x1, r1 * 0.35, z1]], [r1 * 0.5, r1 * 0.34], M.dark, 8));
      var cl = new THREE.Mesh(new THREE.ConeGeometry(r1 * 0.32, r1 * 1.0, 6), M.claw);
      cl.position.set(x1 + dx * r1 * 0.35, r1 * 0.2, z1 + dz * r1 * 0.35); cl.rotation.set(Math.PI / 2 + 0.6, a, 0); cl.castShadow = true; g.add(cl);
    }
    return g;
  }

  // Wing (right side, +x). w = { len, fold 0..1, bone }. Membrane shaded dark (root) -> membrane -> glowing edge.
  function wing(w, bodyLen, M, pal) {
    var L = w.len, f = w.fold || 0, g = new THREE.Group();
    var S = new V(0, 0, 0);
    var elbow = new V(0.3, 0.22, -0.1).multiplyScalar(L).lerp(new V(0.2, 0.22, -0.02).multiplyScalar(L), f);
    var wrist = new V(0.58, 0.55, -0.12).multiplyScalar(L).lerp(new V(0.26, 0.55, -0.32).multiplyScalar(L), f);
    var dirs = [[0.62, 0.62, -0.12, 0.5], [0.8, 0.05, -0.28, 0.6], [0.55, -0.5, -0.4, 0.62], [0.15, -0.75, -0.55, 0.6]];
    var tips = dirs.map(function (d) {
      var dir = new V(d[0], d[1], d[2]).normalize().multiplyScalar(L * d[3] * (1 - 0.45 * f));
      return wrist.clone().add(dir).add(new V(0, -0.15 * f * L, -0.2 * f * L));
    });
    var attach = new V(-0.02, -0.08 * L, -bodyLen * 0.7);
    var boneR = (w.bone || 0.035) * L;
    g.add(K3.tube([[0, 0, 0], [elbow.x, elbow.y, elbow.z], [wrist.x, wrist.y, wrist.z]], [boneR * 1.4, boneR], M.bone, 16));
    var knuckle = new THREE.Mesh(new THREE.SphereGeometry(boneR * 1.3, 10, 8), M.bone); knuckle.position.copy(wrist); g.add(knuckle);
    tips.forEach(function (tp) {
      g.add(K3.tube([[wrist.x, wrist.y, wrist.z], [tp.x, tp.y, tp.z]], [boneR * 0.85, boneR * 0.3], M.bone, 8));
      var tc = new THREE.Mesh(new THREE.ConeGeometry(boneR * 0.45, boneR * 2.2, 5), M.claw);   // claw on each finger tip
      tc.position.copy(tp); tc.lookAt(tp.clone().add(tp.clone().sub(wrist))); tc.rotateX(Math.PI / 2); g.add(tc);
    });
    var thumb = new THREE.Mesh(new THREE.ConeGeometry(boneR * 0.9, boneR * 3.4, 6), M.claw);
    thumb.position.copy(wrist).add(new V(0.02, 0.06, 0.04).multiplyScalar(L)); thumb.rotation.x = -0.6; g.add(thumb);

    var root = col(pal.vein), mem = col(pal.membrane), edgeC = col(pal.membraneEdge || pal.membrane);
    var pos = [], cols = [], glow = [], idx = [], NU = 8, NV = 6, c = new THREE.Color();
    function patch(root0, root1, edge0, edge1, sag) {
      var base = pos.length / 3;
      for (var iu = 0; iu <= NU; iu++) for (var iv = 0; iv <= NV; iv++) {
        var u = iu / NU, v = iv / NV, bell = Math.sin(v * Math.PI);
        var rt = root0.clone().lerp(root1, v), edge = edge0.clone().lerp(edge1, v).lerp(rt, sag * bell);
        var p = rt.clone().lerp(edge, u);
        p.y -= bell * Math.sin(u * Math.PI) * 0.05 * L;                  // billow (sags down a little)
        pos.push(p.x, p.y, p.z);
        c.copy(root).lerp(mem, smooth(u * 1.7)).lerp(edgeC, smooth((u - 0.7) / 0.3));
        c.lerp(root, Math.max(0, 1 - Math.min(v, 1 - v) * 9) * 0.6);   // darker along the bones (veins)
        cols.push(c.r, c.g, c.b); glow.push(smooth((u - 0.82) / 0.18) * (pal.edgeGlow || 0));
        if (iu < NU && iv < NV) { var a = base + iu * (NV + 1) + iv, b = a + NV + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
      }
    }
    for (var k = 0; k < tips.length - 1; k++) patch(wrist, wrist, tips[k], tips[k + 1], 0.3);
    patch(wrist, S, tips[tips.length - 1], attach, 0.22);
    patch(S, wrist, S.clone().lerp(elbow, 0.3), elbow, 0.0);               // small leading-edge web
    var geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3));
    geo.setAttribute('glow', new THREE.Float32BufferAttribute(glow, 1));
    geo.setIndex(idx); geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, M.membrane); m.castShadow = true; g.add(m);
    return g;
  }

  // Head: angular loft from the back of the skull to the snout, plus eyes, brows, nostrils,
  // mouth (closed line, or an open jaw with teeth and a glowing throat), horns, cheek spikes.
  function head(h, pal, M, ctx) {
    var g = new THREE.Group(), L = h.len, W = h.w, H = h.h, snout = h.snout === undefined ? 1 : h.snout, jaw = h.jaw || 0;
    // Width / top / bottom keyframes along the head (0 = back of skull, 1 = nose tip).
    // Snout: flat on top, flared at the nostrils; thinner underneath when the jaw is separate.
    var KT = [0, 0.1, 0.28, 0.45, 0.62, 0.8, 0.92, 1];
    var RX = [0.05, 0.8, 1, 0.84, 0.62 - 0.1 * (1 - snout), 0.5, 0.56, 0.05];
    var RU = [0.05, 0.82, 1, 0.72, 0.42, 0.34, 0.36, 0.05];
    var RD = [0.05, 0.72, 0.86, 0.62, 0.4, 0.32, 0.3, 0.05].map(function (v, i) { return jaw && KT[i] > 0.4 ? v * 0.55 : v; });
    var z0 = -0.22 * L, z1 = 0.78 * L;
    var pts = [new V(0, 0.02 * H, z0), new V(0, 0.05 * H, z0 + 0.3 * (z1 - z0)), new V(0, 0, z0 + 0.6 * (z1 - z0)), new V(0, -0.08 * H, z1)];
    function prof(t) { return [keys(KT, RX, t) * W, keys(KT, RU, t) * H, keys(KT, RD, t) * H]; }
    var skin = loft(pts, prof, skinColour(pal, 0, 0), M.skin, { seg: 40, radial: 26, scale: 0.07 * L / 0.5 });
    g.add(skin);
    var curve = skin.userData.curve;
    function at(t) { return curve.getPointAt(t); }

    // Eyes (with blink): dark socket ball, glowing iris, slit pupil; upper lid (fierce) or highlight (cute)
    var eyes = [];
    [-1, 1].forEach(function (s) {
      var te = 0.36, p = at(te), r = prof(te), e = new THREE.Group();
      e.position.set(s * r[0] * 0.78, p.y + r[1] * 0.4, p.z + 0.02 * L);
      var ball = new THREE.Mesh(new THREE.SphereGeometry(h.eye, 16, 12), M.eyeWhite); e.add(ball);
      var iris = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 0.82, 16, 12), M.iris); iris.position.set(s * h.eye * 0.3, 0, h.eye * 0.25); e.add(iris);
      var pupil = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 0.5, 12, 8), M.pupil);
      pupil.scale.set(h.cute ? 0.75 : 0.3, 1.1, 0.5); pupil.position.set(s * h.eye * 0.62, 0, h.eye * 0.5); e.add(pupil);
      if (h.cute) {                                                       // two shiny highlights = big cute eyes
        var sh = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 0.2, 8, 6), M.shine); sh.position.set(s * h.eye * 0.78, h.eye * 0.35, h.eye * 0.5); e.add(sh);
        var sh2 = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 0.1, 8, 6), M.shine); sh2.position.set(s * h.eye * 0.82, -h.eye * 0.2, h.eye * 0.62); e.add(sh2);
      } else {                                                            // heavy upper lid = fierce look
        var lid = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 1.08, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.dark);
        lid.rotation.set(0.25, 0, -s * (h.angry || 0.3)); e.add(lid);
      }
      e.rotation.y = s * 0.55;                                            // look out + forward
      g.add(e); eyes.push(e);
      // Brow ridge above the eye (fierce dragons only: on a baby it reads as a frown)
      if (h.cute) return;
      var brow = new THREE.Mesh(new THREE.SphereGeometry(h.eye * 1.15, 12, 8), M.dark);
      brow.scale.set(1.0, 0.4, 1.25); brow.position.set(s * r[0] * 0.72, p.y + r[1] * 0.4 + h.eye * 0.85, p.z + 0.01 * L);
      brow.rotation.z = s * (h.angry || 0.25); g.add(brow);
    });
    ctx.anim(function (t) {                                               // blink every few seconds
      var k = (t + (h.blinkPhase || 0)) % 4.2, sy = k < 0.12 ? Math.abs(Math.cos(k / 0.12 * Math.PI)) * 0.9 + 0.1 : 1;
      eyes.forEach(function (e) { e.scale.y = sy; });
    });

    // Nostrils on top of the flared snout end (not at the front: that reads as a pig nose)
    [-1, 1].forEach(function (s) {
      var p = at(0.9), r = prof(0.9), n = new THREE.Mesh(new THREE.SphereGeometry(r[0] * 0.17, 8, 6), M.mouth);
      n.scale.set(1.3, 0.45, 0.8); n.position.set(s * r[0] * 0.5, p.y + r[1] * 0.85, p.z); n.rotation.y = s * 0.5; g.add(n);
    });

    if (!jaw) {
      // Closed mouth: a line along both sides of the snout (+ two fangs when asked)
      [-1, 1].forEach(function (s) {
        var line = [0.48, 0.68, 0.88, 0.985].map(function (t) { var p = at(t), r = prof(t); return [s * r[0] * 0.92, p.y - r[2] * 0.3, p.z]; });
        g.add(K3.tube(line, [W * 0.025, W * 0.02], M.mouth, 12));
        if (h.fangs) {
          var fp = at(0.84), fr = prof(0.84), fang = new THREE.Mesh(new THREE.ConeGeometry(W * 0.045, W * 0.16, 6), M.tooth);
          fang.position.set(s * fr[0] * 0.75, fp.y - fr[2] * 0.42, fp.z); fang.rotation.x = Math.PI; g.add(fang);
        }
      });
    } else {
      // Open jaw hinged under the skull, teeth on both jaws, glowing throat in between
      var hinge = at(0.3).add(new V(0, -prof(0.3)[2] * 0.55, 0)), tipZ = at(0.97).z - hinge.z;
      var jawG = new THREE.Group(); jawG.position.copy(hinge); jawG.rotation.x = jaw; g.add(jawG);
      var jw = loft([new V(0, 0, -0.02 * L), new V(0, -0.04 * H, tipZ * 0.35), new V(0, -0.06 * H, tipZ * 0.7), new V(0, -0.02 * H, tipZ)],
        function (t) { var e = 1 - smooth((t - 0.82) / 0.18) * 0.92; return [W * (0.62 - 0.2 * t) * e, H * 0.12 * e, H * (0.24 - 0.1 * t) * e]; },
        skinColour(pal, 10, 0), M.skin, { seg: 24, radial: 18, scale: 0.05 });
      jawG.add(jw);
      var throat = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), M.mouthGlow);
      throat.scale.set(W * 0.42, H * 0.1, tipZ * 0.42); throat.position.set(0, H * 0.02, tipZ * 0.45); jawG.add(throat);
      [-1, 1].forEach(function (s) {
        [0.5, 0.62, 0.74, 0.86, 0.95].forEach(function (t, i) {           // upper teeth
          var p = at(t), r = prof(t), tt = new THREE.Mesh(new THREE.ConeGeometry(W * (i === 2 ? 0.05 : 0.035), W * (i === 2 ? 0.2 : 0.11), 5), M.tooth);
          tt.position.set(s * r[0] * 0.8, p.y - r[2] * 0.95, p.z); tt.rotation.x = Math.PI; g.add(tt);
        });
        [0.4, 0.58, 0.76, 0.9].forEach(function (u, i) {                  // lower teeth
          var lt = new THREE.Mesh(new THREE.ConeGeometry(W * 0.032, W * (i === 1 ? 0.15 : 0.09), 5), M.tooth);
          lt.position.set(s * W * (0.62 - 0.2 * u) * 0.75, H * 0.1, tipZ * u); jawG.add(lt);
        });
      });
      g.userData.jaw = jawG;
    }

    // Horns: ringed, curving back and up from the top of the skull
    (h.horns || []).forEach(function (hn) {
      [-1, 1].forEach(function (s) {
        var p = at(hn.t), r = prof(hn.t), b = new V(s * r[0] * hn.x, p.y + r[1] * 0.7, p.z), l = hn.len;
        g.add(horn([b, new V(b.x + s * l * 0.12, b.y + l * 0.42, b.z - l * 0.32), new V(b.x + s * l * 0.2, b.y + l * (0.55 + hn.up), b.z - l * 0.85)], hn.r, pal, M));
      });
    });
    // Cheek spikes fanning backwards from the jaw
    for (var k = 0; k < (h.cheek || 0); k++) {
      [-1, 1].forEach(function (s) {
        var p = at(0.12 + k * 0.08), r = prof(0.12 + k * 0.08), sp = spikeMesh(W * 0.07, W * (0.38 - k * 0.07), pal, M);
        sp.position.set(s * r[0] * 0.95, p.y - r[2] * (0.1 + k * 0.25), p.z - 0.02 * L);
        sp.rotation.set(-Math.PI / 2 - 0.3, 0, s * (0.9 + k * 0.15)); g.add(sp);
      });
    }
    g.userData.nose = at(0.95).clone().add(new V(0, prof(0.95)[1], 0));
    g.userData.mouth = at(0.85).clone().add(new V(0, -H * 0.25, 0));
    return g;
  }

  /* ------------------------- the whole dragon ------------------------- */
  // spec: see dragons/fire.js (palette, body, neck, legs, tail, head, wings, spikes, veins).
  function dragon(spec, ctx) {
    var M = materials(spec.palette), P = spec, root = new THREE.Group(), body = new THREE.Group();
    root.add(body);
    var bR = P.bodyR, bL = P.bodyLen, legH = P.legLen, sit = P.sit || 0;
    var yb = legH + bR;
    var hipsY = yb + (bR * 0.95 - yb) * sit, chestY = yb + (P.chestRise || 0) + sit * bR * 0.55;
    var Hp = new V(0, hipsY, -bL / 2), Cp = new V(0, chestY, bL / 2);
    var nL = P.neckLen, NE = Cp.clone().add(new V(0, nL * 0.88, nL * 0.36 + bR * 0.35));
    var N1 = Cp.clone().lerp(NE, 0.42).add(new V(0, -nL * 0.04, nL * 0.16));      // gentle S-curve

    // Torso + neck: deep chest, slimmer waist, rounded rump
    var rump = Hp.clone().add(new V(0, bR * 0.05, -bR * 0.75));
    var mid = Hp.clone().lerp(Cp, 0.5).add(new V(0, bR * 0.06, 0));
    var torsoPts = [rump, Hp, mid, Cp, N1, NE];
    var tc = (bL + bR * 0.75) / (bL + bR * 0.75 + nL * 1.1);
    function torsoProf(t) {
      if (t < tc) {
        var s = t / tc, r = bR * Math.sin(Math.min(1, s / 0.2) * Math.PI / 2) * (0.9 + 0.12 * Math.sin(Math.PI * s));
        var chest = 1 + 0.1 * smooth((s - 0.55) / 0.3) - 0.06 * Math.sin(Math.PI * Math.min(1, Math.max(0, (s - 0.25) / 0.4)));
        return [r * 0.9 * chest, r * 0.92 * chest, r * 1.08 * chest];
      }
      var u = (t - tc) / (1 - tc), rn = bR * 0.95 + (P.neckR - bR * 0.95) * Math.pow(smooth(u * 1.3), 0.7);
      return [rn, rn, rn * 1.08];
    }
    var res = P.detail || 1;
    var torso = loft(torsoPts, torsoProf, skinColour(P.palette, 16, P.stripes || 0), M.skin,
      { seg: Math.round(90 * res), radial: Math.round(36 * res), scale: P.scaleSize || 0.1, glow: veinGlow(P.veins, 16) });
    body.add(torso);

    // Tail (own group so it can sway around the hips)
    var tail = new THREE.Group(); tail.position.copy(Hp); body.add(tail);
    var tl = P.tailLen, curl = P.tailCurl || 0.4;
    var tailPts = [new V(0, 0, bR * 0.2), new V(0, -hipsY * 0.08, -bR * 0.9),
      new V(curl * tl * 0.12, Math.max(0.1, hipsY * 0.4) - hipsY, -tl * 0.45), new V(curl * tl * 0.38, 0.09 - hipsY, -tl * 0.74), new V(curl * tl * 0.68, 0.1 - hipsY, -tl * 0.9)];
    var tailMesh = loft(tailPts, function (t) { var r = P.tailR * Math.pow(1 - t, 0.85) + 0.01; return [r, r, r * 1.05]; },
      skinColour(P.palette, 22, (P.stripes || 0) * 1.3), M.skin, { seg: Math.round(64 * res), radial: Math.round(22 * res), scale: P.scaleSize || 0.1, glow: veinGlow(P.veins, 22) });
    tail.add(tailMesh);
    var tailTip = tailPts[tailPts.length - 1].clone();                  // in tail-group space

    // Dorsal spikes (back + tail): two-tone, tallest over the shoulders
    if (P.spikes && P.spikes.count) {
      var sc = torso.userData.curve, n = P.spikes.count;
      for (var i = 0; i < n; i++) {
        var t = 0.12 + i / (n - 1) * (tc + (1 - tc) * 0.6 - 0.12), p = sc.getPointAt(t), r = torsoProf(t), tg = sc.getTangentAt(t);
        var hgt = P.spikes.h * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, t / (tc * 1.15))));
        var sp = spikeMesh(hgt * 0.33, hgt, P.palette, M);
        sp.position.copy(p).add(new V(0, r[1] * 0.9, 0)); sp.lookAt(sp.position.clone().add(UP).addScaledVector(tg, -0.55)); sp.rotateX(Math.PI / 2);
        body.add(sp);
      }
      var tc2 = tailMesh.userData.curve, nt = Math.round(n * 0.7);
      for (var k2 = 0; k2 < nt; k2++) {
        var t2 = 0.06 + k2 / nt * 0.8, p2 = tc2.getPointAt(t2), tg2 = tc2.getTangentAt(t2), r2 = P.tailR * Math.pow(1 - t2, 0.85) + 0.01;
        var s2 = spikeMesh(P.spikes.h * 0.24 * (1 - t2 * 0.75), P.spikes.h * 0.75 * (1 - t2 * 0.75), P.palette, M);
        s2.position.copy(p2).add(new V(0, r2 * 0.9, 0)); s2.lookAt(s2.position.clone().add(UP).addScaledVector(tg2, -0.55)); s2.rotateX(Math.PI / 2);
        tail.add(s2);
      }
    }

    // Legs
    var lR = P.legR;
    [-1, 1].forEach(function (s) {
      var hip = new V(s * bR * 0.68, hipsY - bR * 0.15, Hp.z + bR * 0.25), hind;
      if (sit > 0.5) hind = [hip, new V(s * bR * 1.0, bR * 0.95, hip.z + bR * 0.85), new V(s * bR * 0.92, lR * 1.1, hip.z + bR * 0.75), new V(s * bR * 0.85, 0.03, hip.z + bR * 1.05)];
      else hind = [hip, new V(s * bR * 0.95, hip.y * 0.55, hip.z + legH * 0.35), new V(s * bR * 0.92, legH * 0.32, hip.z - legH * 0.12), new V(s * bR * 0.9, 0.03, hip.z)];
      body.add(leg(hind, lR, lR * 0.55, M, P.palette));
      var sh = new V(s * bR * 0.66, chestY - bR * 0.25, Cp.z - bR * 0.1);
      var front = [sh, new V(s * bR * 0.9, sh.y * 0.52, sh.z - legH * 0.18), new V(s * bR * 0.86, legH * 0.2, sh.z + legH * 0.08), new V(s * bR * 0.84, 0.03, sh.z + legH * 0.16)];
      body.add(leg(front, lR * 0.85, lR * 0.48, M, P.palette));
    });

    // Head on the end of the neck
    var hd = head(P.head, P.palette, M, ctx);
    var headPivot = new THREE.Group(); headPivot.position.copy(NE); body.add(headPivot);
    hd.position.set(0, P.head.h * 0.15, P.head.len * 0.05); headPivot.add(hd);
    headPivot.rotation.x = P.head.pitch || 0;

    // Wings: pivot (mirror + sweep back) > flap (raise) > tilt (turn the membrane towards the viewer)
    var wings = [];
    if (P.wings) {
      [-1, 1].forEach(function (s) {
        var pivot = new THREE.Group(), flap = new THREE.Group(), tilt = new THREE.Group();
        pivot.position.set(s * bR * 0.45, chestY + bR * 0.62, Cp.z - bR * 0.35);
        pivot.scale.x = s; pivot.rotation.y = s * (P.wings.sweep || 0.25);
        tilt.rotation.x = P.wings.tilt || 0;
        pivot.add(flap); flap.add(tilt); tilt.add(wing(P.wings, bL, M, P.palette));
        body.add(pivot); wings.push(flap);
      });
    }

    // Idle animation: breathing, head looking around, jaw, tail sway, slow wing flaps
    var raise = P.wings ? (P.wings.raise || 0) : 0, flapA = P.wings ? (P.wings.flap || 0.12) : 0, ph = P.phase || 0;
    ctx.anim(function (t) {
      body.scale.y = 1 + Math.sin(t * 2.0 + ph) * 0.012;
      headPivot.rotation.x = (P.head.pitch || 0) + Math.sin(t * 1.1 + ph) * 0.05;
      headPivot.rotation.y = Math.sin(t * 0.45 + ph) * 0.22;
      if (hd.userData.jaw) hd.userData.jaw.rotation.x = P.head.jaw + Math.sin(t * 1.3 + ph) * 0.06;
      tail.rotation.y = Math.sin(t * 0.8 + ph) * 0.12;
      wings.forEach(function (w) { w.rotation.z = raise + Math.sin(t * 1.5 + ph) * flapA; });
    });

    var height = Math.max(NE.y + P.head.h * 1.3, P.wings ? chestY + P.wings.len * 0.8 : 0);
    root.userData = { height: height, parts: { body: body, tail: tail, tailTip: tailTip, head: hd, headPivot: headPivot, neckEnd: NE, chest: Cp, materials: M } };
    return root;
  }

  /* ------------------------- egg ------------------------- */
  // spec: { h (height), w (radius), shell, shellTop, scale, glow, veins (count), seed }
  function egg(spec, ctx) {
    var S = 256, c = document.createElement('canvas'), e = document.createElement('canvas'); c.width = c.height = e.width = e.height = S;
    var x = c.getContext('2d'), ex = e.getContext('2d'), R = K3.rng(spec.seed || 3);
    var gr = x.createLinearGradient(0, 0, 0, S); gr.addColorStop(0, spec.shellTop || spec.shell); gr.addColorStop(1, spec.shell);
    x.fillStyle = gr; x.fillRect(0, 0, S, S);
    ex.fillStyle = '#000'; ex.fillRect(0, 0, S, S);
    // Scale rows (lighter arcs)
    x.strokeStyle = spec.scale; x.lineWidth = 3;
    for (var row = 0; row < 12; row++) for (var k = 0; k < 10; k++) {
      var cx = (k + (row % 2) * 0.5) * S / 10, cy = row * S / 12;
      x.beginPath(); x.arc(cx, cy, S / 20, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke();
      if (cx < S / 20) { x.beginPath(); x.arc(cx + S, cy, S / 20, 0.15 * Math.PI, 0.85 * Math.PI); x.stroke(); }
    }
    // Glowing veins (zigzag cracks) drawn on both the colour and the glow map
    for (var v = 0; v < (spec.veins || 5); v++) {
      var px = R() * S, py = S * (0.2 + R() * 0.6);
      [x, ex].forEach(function (ctx2) { ctx2.strokeStyle = spec.glow; ctx2.lineWidth = 2.5; ctx2.beginPath(); ctx2.moveTo(px, py); });
      for (var s = 0; s < 6; s++) {
        px += (R() - 0.5) * 30; py += (R() - 0.3) * 22;
        [x, ex].forEach(function (ctx2) { ctx2.lineTo(px, py); });
      }
      [x, ex].forEach(function (ctx2) { ctx2.stroke(); });
    }
    var map = new THREE.CanvasTexture(c); map.encoding = THREE.sRGBEncoding;
    var em = new THREE.CanvasTexture(e); em.encoding = THREE.sRGBEncoding;
    var n = scaleNormal().clone(); n.needsUpdate = true; n.repeat.set(3, 2.5);
    // Egg profile: two half-ellipses meeting at the widest point (low, 42% up): round bottom,
    // longer and gently narrower top.
    var prof = [], yc = spec.h * 0.42;
    for (var i = 0; i <= 28; i++) {
      var y = i / 28 * spec.h, a = y < yc ? yc : spec.h - yc, d = (y - yc) / a;
      prof.push(new THREE.Vector2(Math.max(0.0005, spec.w * Math.sqrt(Math.max(0, 1 - d * d))), y));
    }
    var mat = new THREE.MeshStandardMaterial({ map: map, normalMap: n, normalScale: new THREE.Vector2(0.5, 0.5), emissiveMap: em, emissive: col('#ffffff'), emissiveIntensity: 1.0, roughness: 0.35, metalness: 0.05 });
    var shell = new THREE.Mesh(new THREE.LatheGeometry(prof, 40), mat); shell.castShadow = shell.receiveShadow = true;
    var g = new THREE.Group(), wob = new THREE.Group(); wob.add(shell); g.add(wob);
    ctx.anim(function (t) {                                               // wobbles now and then (something inside!)
      var k2 = (t % 5) / 5, w = k2 > 0.8 ? Math.sin((k2 - 0.8) * 5 * Math.PI * 4) * 0.08 * (1 - (k2 - 0.8) * 5) : 0;
      wob.rotation.z = w; mat.emissiveIntensity = 0.85 + Math.sin(t * 2.2) * 0.25;
    });
    g.userData = { height: spec.h, parts: { shell: shell, material: mat } };
    return g;
  }

  return { dragon: dragon, egg: egg, loft: loft, scaleNormal: scaleNormal };
})();
