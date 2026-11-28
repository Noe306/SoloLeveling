/* ==========================================================================
   kit3d.js: reusable toolkit for detailed stylized 3D (Three.js r128, classic script).

   Load after: vendor/three/three.min.js, OrbitControls.js (optional), and the
   add-ons in vendor/three/extras/ (see KIT3D_SCRIPTS below for the exact list).

   PARTS
     K3.createRenderer()   renderer + soft shadows + sky environment light +
                           post-processing (ambient occlusion, bloom, gamma, FXAA)
     K3.tex(kind)          procedural, seamless textures with bump (normal) maps:
                           stone, snow, ice, grass, wood, bark, metal, lava, sand, dirt
     K3.mat(kind, opts)    ready-made PBR materials built on those textures
     K3.rock(), K3.crystal(), K3.crystalCluster(), K3.roundedBox(), K3.tube(),
     K3.chain()            detailed shapes
     K3.scatter(), K3.grass()  instanced detail (thousands of objects cheaply)
     K3.col(hex)           sRGB hex -> linear colour (renderer outputs sRGB)
     K3.rng(seed)          seeded random numbers (same scene every load)
     K3.anims              list of fn(time, dt) to call every frame

   Design guide with recipes and rules: docs/3d-design-guide.md (local file).
   ========================================================================== */

var KIT3D_SCRIPTS = [   // add-on files this toolkit needs (relative to vendor/three/)
  'extras/math/SimplexNoise.js', 'extras/utils/BufferGeometryUtils.js', 'extras/geometries/RoundedBoxGeometry.js',
  'extras/environments/RoomEnvironment.js', 'extras/shaders/CopyShader.js', 'extras/shaders/LuminosityHighPassShader.js',
  'extras/shaders/SSAOShader.js', 'extras/shaders/GammaCorrectionShader.js', 'extras/shaders/FXAAShader.js',
  'extras/postprocessing/EffectComposer.js', 'extras/postprocessing/RenderPass.js', 'extras/postprocessing/ShaderPass.js',
  'extras/postprocessing/MaskPass.js', 'extras/postprocessing/UnrealBloomPass.js', 'extras/postprocessing/SSAOPass.js'
];

var K3 = (function () {
  'use strict';

  /* ======================= Basics ======================= */
  function col(hex) { return new THREE.Color(hex).convertSRGBToLinear(); }

  // Mulberry32: fast, seedable random numbers in [0, 1).
  function rng(seed) {
    var s = seed >>> 0;
    return function () { s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  }
  var simplex = new THREE.SimplexNoise({ random: rng(1234) });

  // Fractal noise (several octaves of simplex) in 3D, roughly in [-1, 1].
  function fbm3(x, y, z, octaves) {
    var sum = 0, amp = 0.5, f = 1, norm = 0;
    for (var i = 0; i < (octaves || 4); i++) { sum += amp * simplex.noise3d(x * f, y * f, z * f); norm += amp; amp *= 0.5; f *= 2; }
    return sum / norm;
  }
  // Seamless 2D fractal noise: (u, v) in [0,1] mapped onto a 4D torus so textures tile without seams.
  function tile4(u, v, scale, octaves, ridged) {
    var a = u * Math.PI * 2, b = v * Math.PI * 2, sum = 0, amp = 0.5, norm = 0, f = scale;
    for (var i = 0; i < (octaves || 4); i++) {
      var n = simplex.noise4d(Math.cos(a) * f, Math.sin(a) * f, Math.cos(b) * f, Math.sin(b) * f);
      if (ridged) n = 1 - Math.abs(n) * 2;          // sharp ridges: cracks, veins
      sum += amp * n; norm += amp; amp *= 0.5; f *= 2;
    }
    return sum / norm;
  }

  var anims = [];

  /* ======================= Renderer + post-processing ======================= */
  // opts: { ao: true, bloom: 0.35, exposure: 1.0, shadows: true, envIntensity: 1, pixelRatio }
  function createRenderer(scene, camera, opts) {
    opts = opts || {};
    var renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    var pr = Math.min(opts.pixelRatio || window.devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(innerWidth, innerHeight);
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;           // film-like highlights, no harsh clipping
    renderer.toneMappingExposure = opts.exposure || 1.0;
    renderer.physicallyCorrectLights = false;
    renderer.shadowMap.enabled = opts.shadows !== false;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // Image-based lighting: a soft studio "sky" that every PBR material reflects.
    var pmrem = new THREE.PMREMGenerator(renderer);
    scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // Post-processing chain: scene -> ambient occlusion -> bloom -> gamma -> anti-aliasing.
    var size = new THREE.Vector2(innerWidth, innerHeight);
    var target = renderer.capabilities.isWebGL2
      ? new THREE.WebGLMultisampleRenderTarget(innerWidth * pr, innerHeight * pr, { format: THREE.RGBAFormat })
      : undefined;
    var composer = new THREE.EffectComposer(renderer, target);
    composer.setPixelRatio(pr);
    composer.addPass(new THREE.RenderPass(scene, camera));
    var ao = null;
    if (opts.ao !== false) {
      ao = new THREE.SSAOPass(scene, camera, innerWidth, innerHeight);
      ao.kernelRadius = opts.aoRadius || 0.6;        // world units: how far creases darken
      ao.minDistance = 0.0005; ao.maxDistance = opts.aoMax || 0.02;
      // Sprites (flames, smoke) and particles are see-through: drawn as solid quads in the AO
      // normal/depth pass they leave grey rectangles. Hide them for that pass only.
      var baseOverride = ao.renderOverride.bind(ao);
      ao.renderOverride = function (r, mat, target, clearColor, clearAlpha) {
        var hidden = [];
        scene.traverse(function (o) { if (o.visible && (o.isSprite || o.isPoints || (o.userData && o.userData.noAO))) { o.visible = false; hidden.push(o); } });
        baseOverride(r, mat, target, clearColor, clearAlpha);
        hidden.forEach(function (o) { o.visible = true; });
      };
      composer.addPass(ao);
    }
    var bloom = null;
    if (opts.bloom !== 0) {
      bloom = new THREE.UnrealBloomPass(size, opts.bloom === undefined ? 0.35 : opts.bloom, 0.55, opts.bloomThreshold || 0.82);
      composer.addPass(bloom);
    }
    composer.addPass(new THREE.ShaderPass(THREE.GammaCorrectionShader));
    var fxaa = new THREE.ShaderPass(THREE.FXAAShader);
    fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    composer.addPass(fxaa);

    function resize() {
      camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
      renderer.setSize(innerWidth, innerHeight); composer.setSize(innerWidth, innerHeight);
      fxaa.material.uniforms.resolution.value.set(1 / (innerWidth * pr), 1 / (innerHeight * pr));
    }
    addEventListener('resize', resize);
    return { renderer: renderer, composer: composer, ao: ao, bloom: bloom, resize: resize,
             render: function () { composer.render(); } };
  }

  // Warm sun with a soft, high-resolution shadow + sky/ground fill light.
  // area: half-size of the region that receives sharp shadows.
  function lights(scene, area) {
    area = area || 8;
    var hemi = new THREE.HemisphereLight(col('#cfe6ff'), col('#5d6a4a'), 0.45);
    scene.add(hemi);
    var sun = new THREE.DirectionalLight(col('#fff0d8'), 1.7);
    sun.position.set(-area * 0.9, area * 1.8, area * 0.7);
    sun.castShadow = true;
    sun.shadow.mapSize.set(4096, 4096);
    Object.assign(sun.shadow.camera, { left: -area, right: area, top: area, bottom: -area, near: 0.5, far: area * 6 });
    sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.025;
    scene.add(sun);
    return { sun: sun, hemi: hemi };
  }

  /* ======================= Procedural textures ======================= */
  var TEX_CACHE = {};
  // Each kind paints a height field (0..1) and a colour per pixel; a normal map is derived from the height.
  var KINDS = {
    stone: function (u, v) { var h = 0.55 + 0.45 * tile4(u, v, 2.2, 5); var crack = Math.max(0, tile4(u, v, 3.0, 3, true) - 0.82) * 4; h -= crack * 0.5;
      var g = 0.52 + 0.22 * tile4(u + 0.3, v, 1.2, 3); return { h: h, c: [g * 0.95, g * 0.95, g * 1.02], r: 0.85 }; },
    snow: function (u, v) { var h = 0.5 + 0.5 * tile4(u, v, 1.6, 4); var s = 0.9 + 0.08 * h; var sparkle = tile4(u, v, 14, 1) > 0.78 ? 0.08 : 0;
      return { h: h * 0.6, c: [s - 0.03 + sparkle, s + sparkle, s + 0.04 + sparkle], r: 0.75 }; },
    ice: function (u, v) { var cr = Math.max(0, tile4(u, v, 2.6, 4, true) - 0.7) * 3.3; var d = 0.5 + 0.5 * tile4(u, v, 1.1, 3);
      return { h: 0.5 + d * 0.3 - cr * 0.4, c: [0.55 + d * 0.15 + cr * 0.4, 0.82 + d * 0.1 + cr * 0.15, 0.95 + cr * 0.05], r: 0.12 + cr * 0.3 }; },
    grass: function (u, v) { var n = tile4(u, v, 3, 4), fine = tile4(u, v, 18, 2); var g = 0.5 + 0.5 * n;
      return { h: 0.5 + 0.3 * fine + 0.2 * n, c: [0.22 + 0.12 * g + fine * 0.04, 0.46 + 0.18 * g + fine * 0.06, 0.16 + 0.06 * g], r: 0.9 }; },
    dirt: function (u, v) { var n = 0.5 + 0.5 * tile4(u, v, 2.5, 5), p = tile4(u, v, 16, 1) > 0.7 ? 0.08 : 0;
      return { h: n + p, c: [0.42 + 0.14 * n + p, 0.3 + 0.1 * n + p, 0.2 + 0.06 * n + p], r: 0.95 }; },
    sand: function (u, v) { var n = 0.5 + 0.5 * tile4(u, v, 3.5, 3), ripple = 0.5 + 0.5 * Math.sin((v * 10 + tile4(u, v, 1.5, 2) * 2) * Math.PI * 2);
      return { h: ripple * 0.4 + n * 0.3, c: [0.86 + 0.06 * n, 0.74 + 0.06 * n, 0.5 + 0.05 * n], r: 0.95 }; },
    wood: function (u, v) { var w = tile4(u * 0.15, v, 3, 3) * 6; var ring = 0.5 + 0.5 * Math.sin((u * 18 + w) * Math.PI);
      return { h: 0.4 + ring * 0.4, c: [0.45 + ring * 0.12, 0.29 + ring * 0.08, 0.16 + ring * 0.04], r: 0.8 }; },
    bark: function (u, v) { var r = tile4(u, v * 0.25, 4, 4, true); var n = 0.5 + 0.5 * tile4(u, v, 2, 3);
      return { h: r * 0.8 + 0.2 * n, c: [0.3 + r * 0.12, 0.2 + r * 0.08, 0.13 + r * 0.05], r: 0.95 }; },
    metal: function (u, v) { var brush = tile4(u * 0.02, v, 40, 2) * 0.5 + 0.5, n = 0.5 + 0.5 * tile4(u, v, 2, 3);
      return { h: brush * 0.2, c: [0.62 + n * 0.1, 0.64 + n * 0.1, 0.68 + n * 0.1], r: 0.25 + brush * 0.2 }; },
    lava: function (u, v) { var c = tile4(u, v, 2.4, 4, true), glow = Math.max(0, c - 0.72) * 3.6;
      return { h: 1 - glow, c: [0.12 + glow * 1.0, 0.07 + glow * 0.35, 0.06 + glow * 0.05], r: 0.9 - glow * 0.5, e: glow }; }
  };

  // Returns { map, normalMap, roughnessMap, emissiveMap? } for a kind. size: 256 (default) or 512.
  function tex(kind, size, repeat) {
    size = size || 256;
    var key = kind + size;
    if (!TEX_CACHE[key]) {
      var paint = KINDS[kind], n = size * size;
      var H = new Float32Array(n), C = document.createElement('canvas'), R = document.createElement('canvas'), N = document.createElement('canvas');
      C.width = C.height = R.width = R.height = N.width = N.height = size;
      var cc = C.getContext('2d'), rc = R.getContext('2d'), nc = N.getContext('2d');
      var ci = cc.createImageData(size, size), ri = rc.createImageData(size, size), ni = nc.createImageData(size, size);
      var E = null, ei = null, EC = null;
      for (var y = 0; y < size; y++) for (var x = 0; x < size; x++) {
        var p = paint(x / size, y / size), i = y * size + x, o = i * 4;
        H[i] = p.h;
        ci.data[o] = Math.min(255, p.c[0] * 255); ci.data[o + 1] = Math.min(255, p.c[1] * 255); ci.data[o + 2] = Math.min(255, p.c[2] * 255); ci.data[o + 3] = 255;
        var rv = Math.max(0, Math.min(1, p.r)) * 255; ri.data[o] = ri.data[o + 1] = ri.data[o + 2] = rv; ri.data[o + 3] = 255;
        if (p.e !== undefined) {
          if (!E) { EC = document.createElement('canvas'); EC.width = EC.height = size; E = EC.getContext('2d'); ei = E.createImageData(size, size); }
          var ev = Math.min(255, p.e * 255); ei.data[o] = ev; ei.data[o + 1] = ev * 0.45; ei.data[o + 2] = ev * 0.1; ei.data[o + 3] = 255;
        }
      }
      // Normal map from the height field (central differences, wrapping so it tiles).
      var strength = 3.0;
      for (var yy = 0; yy < size; yy++) for (var xx = 0; xx < size; xx++) {
        var l = H[yy * size + (xx - 1 + size) % size], r = H[yy * size + (xx + 1) % size];
        var t = H[((yy - 1 + size) % size) * size + xx], b = H[((yy + 1) % size) * size + xx];
        var dx = (l - r) * strength, dy = (t - b) * strength, len = Math.sqrt(dx * dx + dy * dy + 1), q = (yy * size + xx) * 4;
        ni.data[q] = (dx / len * 0.5 + 0.5) * 255; ni.data[q + 1] = (dy / len * 0.5 + 0.5) * 255; ni.data[q + 2] = (1 / len * 0.5 + 0.5) * 255; ni.data[q + 3] = 255;
      }
      cc.putImageData(ci, 0, 0); rc.putImageData(ri, 0, 0); nc.putImageData(ni, 0, 0);
      var map = new THREE.CanvasTexture(C); map.encoding = THREE.sRGBEncoding;
      var out = { map: map, normalMap: new THREE.CanvasTexture(N), roughnessMap: new THREE.CanvasTexture(R) };
      if (E) { E.putImageData(ei, 0, 0); out.emissiveMap = new THREE.CanvasTexture(EC); out.emissiveMap.encoding = THREE.sRGBEncoding; }
      Object.keys(out).forEach(function (k) { out[k].wrapS = out[k].wrapT = THREE.RepeatWrapping; out[k].anisotropy = 8; });
      TEX_CACHE[key] = out;
    }
    var src = TEX_CACHE[key], res = {};
    Object.keys(src).forEach(function (k) { var t2 = src[k].clone(); t2.needsUpdate = true; t2.repeat.set(repeat || 1, repeat || 1); res[k] = t2; });
    return res;
  }

  /* ======================= Materials ======================= */
  // kind: stone | snow | ice | grass | dirt | sand | wood | bark | metal | lava | crystal | glow
  // opts: { color (tint), repeat, emissive, intensity, normalScale, roughness, metalness, opacity }
  function mat(kind, opts) {
    opts = opts || {};
    if (kind === 'crystal') {                       // glassy gem: clear-coat shine + inner glow, no texture needed
      return new THREE.MeshPhysicalMaterial({
        color: col(opts.color || '#6fc8f2'), emissive: col(opts.emissive || '#1f8fd0'), emissiveIntensity: opts.intensity || 0.3,
        roughness: 0.12, metalness: 0.0, clearcoat: 1.0, clearcoatRoughness: 0.08, transparent: true, opacity: opts.opacity || 0.78,
        flatShading: true, envMapIntensity: 0.9
      });
    }
    if (kind === 'glow') {
      return new THREE.MeshStandardMaterial({ color: col(opts.color || '#9ff0ff'), emissive: col(opts.color || '#6be6ff'), emissiveIntensity: opts.intensity || 2.2, roughness: 0.3 });
    }
    var t = tex(kind, opts.size, opts.repeat);
    var base = {
      map: t.map, normalMap: t.normalMap, roughnessMap: t.roughnessMap,
      normalScale: new THREE.Vector2(opts.normalScale || 1, opts.normalScale || 1),
      roughness: opts.roughness !== undefined ? opts.roughness : 1, metalness: opts.metalness || (kind === 'metal' ? 0.85 : 0),
      color: col(opts.color || '#ffffff'), flatShading: !!opts.flat, vertexColors: !!opts.vertexColors
    };
    if (kind === 'ice') { base.metalness = 0.05; base.envMapIntensity = 1.4; base.transparent = !!opts.opacity; base.opacity = opts.opacity || 1; }
    if (kind === 'snow') base.envMapIntensity = 0.35;
    if (t.emissiveMap) { base.emissiveMap = t.emissiveMap; base.emissive = col(opts.emissive || '#ff7a2a'); base.emissiveIntensity = opts.intensity || 2.5; }
    var m = new THREE.MeshStandardMaterial(base);
    return m;
  }

  /* ======================= Shapes ======================= */
  // Organic rock: subdivided icosahedron pushed in/out by fractal noise, with baked shading in vertex
  // colours (darker underneath and in hollows) and optional moss/snow on upward faces.
  // opts: { radius, detail (2-4), seed, squash (y scale), lumpy (0..1), top: '#color' (moss/snow), topAmount }
  function rock(opts) {
    opts = opts || {};
    var r = opts.radius || 1, seed = (opts.seed || 1) * 7.31, lumpy = opts.lumpy === undefined ? 0.35 : opts.lumpy;
    var g = new THREE.IcosahedronGeometry(r, opts.detail || 3);
    g.deleteAttribute('normal'); g.deleteAttribute('uv');
    g = THREE.BufferGeometryUtils.mergeVertices(g);              // shared vertices -> no cracks when displaced
    var pos = g.attributes.position, v = new THREE.Vector3(), cols = new Float32Array(pos.count * 3);
    var topC = opts.top ? col(opts.top) : null, baseC = col(opts.color || '#ffffff');
    for (var i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i);
      var nx = v.x / r, ny = v.y / r, nz = v.z / r;
      var d = 1 + lumpy * fbm3(nx * 1.6 + seed, ny * 1.6, nz * 1.6, 4) + 0.08 * fbm3(nx * 6 + seed, ny * 6, nz * 6, 2);
      v.multiplyScalar(d); v.y *= opts.squash || 0.75;
      pos.setXYZ(i, v.x, v.y, v.z);
      var ao = 0.55 + 0.45 * Math.min(1, Math.max(0, (ny + 1) / 1.6));   // darker towards the bottom
      var c = baseC.clone().multiplyScalar(ao * (0.85 + 0.3 * (d - 1 + 0.5)));
      if (topC && ny > (1 - (opts.topAmount || 0.45))) c.lerp(topC, Math.min(1, (ny - (1 - (opts.topAmount || 0.45))) * 3.5));
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    g.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    g.computeVertexNormals();
    // Planar UVs so stone textures still show detail
    var uv = new Float32Array(pos.count * 2);
    for (var j = 0; j < pos.count; j++) { uv[j * 2] = pos.getX(j) * 0.5 + pos.getZ(j) * 0.25; uv[j * 2 + 1] = pos.getY(j) * 0.5 + pos.getZ(j) * 0.25; }
    g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    var m = new THREE.Mesh(g, opts.material || mat(opts.texture || 'stone', { vertexColors: true, flat: opts.flat !== false, repeat: 1 }));
    m.castShadow = m.receiveShadow = true;
    return m;
  }

  // Faceted crystal: bevelled hexagonal prism + pointed tip + glowing inner core.
  // opts: { height, radius, sides (6), color, emissive, tip (tip height factor), core: true }
  function crystal(opts) {
    opts = opts || {};
    var h = opts.height || 1.5, r = opts.radius || 0.25, s = opts.sides || 6, g = new THREE.Group();
    var body = new THREE.CylinderGeometry(r * 0.92, r, h, s, 1, false);
    body.translate(0, h / 2, 0);
    var tip = new THREE.ConeGeometry(r * 0.92, r * (opts.tip || 1.8), s, 1, false);
    tip.translate(0, h + r * (opts.tip || 1.8) / 2, 0);
    var m = mat('crystal', { color: opts.color, emissive: opts.emissive, intensity: opts.intensity });
    var mesh = new THREE.Mesh(THREE.BufferGeometryUtils.mergeBufferGeometries([body.toNonIndexed(), tip.toNonIndexed()]), m);
    mesh.castShadow = true; mesh.receiveShadow = true; g.add(mesh);
    if (opts.core !== false) {
      var core = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.35, r * 0.35, h * 0.85, s), mat('glow', { color: opts.coreColor || '#dffaff', intensity: opts.coreIntensity || 1.6 }));
      core.position.y = h * 0.45; g.add(core);
    }
    return g;
  }
  // A natural cluster: one tall crystal surrounded by smaller tilted ones.
  // opts: { count, height, radius, seed, color, emissive, spread }
  function crystalCluster(opts) {
    opts = opts || {};
    var R = rng(opts.seed || 3), g = new THREE.Group(), n = opts.count || 6, H = opts.height || 2;
    for (var i = 0; i < n; i++) {
      var k = i === 0 ? 1 : 0.35 + R() * 0.5, a = R() * Math.PI * 2, d = i === 0 ? 0 : (opts.spread || 0.35) * (0.5 + R());
      var c = crystal({ height: H * k, radius: (opts.radius || 0.22) * (0.6 + k * 0.5), color: opts.color, emissive: opts.emissive, intensity: opts.intensity });
      c.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
      c.rotation.set((R() - 0.5) * 0.5 + (i ? Math.cos(a) * 0.35 : 0), R() * Math.PI, (R() - 0.5) * 0.5 - (i ? Math.sin(a) * 0.35 : 0));
      g.add(c);
    }
    return g;
  }

  function roundedBox(w, h, d, radius, material) {
    var m = new THREE.Mesh(new THREE.RoundedBoxGeometry(w, h, d, 4, radius || Math.min(w, h, d) * 0.12), material);
    m.castShadow = m.receiveShadow = true; return m;
  }

  // Tube along a smooth curve through points (vines, roots, pipes). radius can taper: [start, end].
  function tube(points, radius, material, segments) {
    var curve = new THREE.CatmullRomCurve3(points.map(function (p) { return new THREE.Vector3(p[0], p[1], p[2]); }));
    var r0 = Array.isArray(radius) ? radius[0] : radius, r1 = Array.isArray(radius) ? radius[1] : radius;
    var geo = new THREE.TubeGeometry(curve, segments || 48, 1, 8, false), pos = geo.attributes.position, c = new THREE.Vector3(), p = new THREE.Vector3();
    // taper: scale each ring around the curve point
    var rings = (segments || 48) + 1, perRing = pos.count / rings;
    for (var i = 0; i < pos.count; i++) {
      var t = Math.floor(i / perRing) / (rings - 1), rr = r0 + (r1 - r0) * t;
      curve.getPointAt(Math.min(1, t), c); p.fromBufferAttribute(pos, i).sub(c).multiplyScalar(rr).add(c); pos.setXYZ(i, p.x, p.y, p.z);
    }
    geo.computeVertexNormals();
    var m = new THREE.Mesh(geo, material); m.castShadow = m.receiveShadow = true; return m;
  }

  // Metal chain hanging between two points with a sag.
  function chain(a, b, sag, linkSize, material) {
    var g = new THREE.Group(), L = linkSize || 0.12, geo = new THREE.TorusGeometry(L, L * 0.28, 8, 16);
    var m = material || mat('metal', { color: '#8a9099', roughness: 0.5 });
    var A = new THREE.Vector3().fromArray(a), B = new THREE.Vector3().fromArray(b), n = Math.max(2, Math.ceil(A.distanceTo(B) / (L * 1.55)));
    var prev = A.clone();
    for (var i = 1; i <= n; i++) {
      var t = i / n, p = A.clone().lerp(B, t); p.y -= Math.sin(t * Math.PI) * sag;
      var link = new THREE.Mesh(geo, m); link.position.copy(p); link.lookAt(prev); if (i % 2) link.rotateZ(Math.PI / 2);
      link.castShadow = true; g.add(link); prev = p;
    }
    return g;
  }

  /* ======================= Instanced detail ======================= */
  // Scatter many copies of one geometry cheaply. place(i, rand) must return
  // { x, y, z, s (scale), ry (y rotation), color? } or null to skip.
  function scatter(geometry, material, count, place, seed) {
    var R = rng(seed || 9), mesh = new THREE.InstancedMesh(geometry, material, count), m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    var used = 0;
    for (var i = 0; i < count; i++) {
      var p = place(i, R); if (!p) continue;
      e.set(p.rx || 0, p.ry || 0, p.rz || 0); q.setFromEuler(e);
      m4.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(p.s || 1, p.sy || p.s || 1, p.s || 1));
      mesh.setMatrixAt(used, m4);
      if (p.color) mesh.setColorAt(used, col(p.color));
      used++;
    }
    mesh.count = used; mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // Lush grass: thousands of tapered blades, dark at the base (fake shadow), lighter tips, swaying in the wind.
  // area(x, z) -> true where grass may grow. opts: { count, height, colors: [base, tip], seed, width, depth, cx, cz }
  function grass(opts) {
    opts = opts || {};
    var H = opts.height || 0.35, W = 0.035;
    var blade = new THREE.PlaneGeometry(W, H, 1, 3);
    blade.translate(0, H / 2, 0);
    var pos = blade.attributes.position, colors = new Float32Array(pos.count * 3), base = col((opts.colors || [])[0] || '#24461c'), tipC = col((opts.colors || [])[1] || '#9ad35a');
    for (var i = 0; i < pos.count; i++) {
      var y = pos.getY(i) / H;
      pos.setX(i, pos.getX(i) * (1 - y * 0.85));                    // taper to a point
      pos.setZ(i, y * y * 0.06);                                     // slight curve
      var c = base.clone().lerp(tipC, Math.pow(y, 0.8));
      colors[i * 3] = c.r; colors[i * 3 + 1] = c.g; colors[i * 3 + 2] = c.b;
    }
    blade.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    blade.computeVertexNormals();
    var m = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 });
    var time = { value: 0 };
    m.onBeforeCompile = function (shader) {                          // wind: bend blades more towards the tip
      shader.uniforms.uTime = time;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n' +
        'vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);\n' +
        'float bend = smoothstep(0.0, 1.0, position.y / ' + H.toFixed(3) + ');\n' +
        'transformed.x += sin(uTime * 1.7 + wp.x * 0.9 + wp.z * 0.6) * 0.05 * bend;\n' +
        'transformed.z += cos(uTime * 1.3 + wp.z * 0.8) * 0.03 * bend;');
    };
    anims.push(function (t) { time.value = t; });
    var w = opts.width || 4, d = opts.depth || 4, cx = opts.cx || 0, cz = opts.cz || 0, area = opts.area || function () { return true; };
    var mesh = scatter(blade, m, opts.count || 4000, function (i, R) {
      var x = cx + (R() - 0.5) * w, z = cz + (R() - 0.5) * d;
      if (!area(x, z)) return null;
      return { x: x, y: opts.y || 0, z: z, s: 0.7 + R() * 0.7, ry: R() * Math.PI, rx: (R() - 0.5) * 0.3 };
    }, opts.seed || 21);
    mesh.castShadow = false;                                         // thousands of blades: receive only
    return mesh;
  }

  /* ======================= Blender models (GLB) ======================= */
  // Blender exports vertex colours as normalized 16-bit RGBA, which Three.js r128 renders as white.
  // Convert them to float RGB, and give every mesh shadows + a non-metallic finish.
  function prepareModel(root) {
    root.traverse(function (o) {
      if (!o.isMesh) return;
      o.castShadow = o.receiveShadow = true;
      var ca = o.geometry.attributes.color;
      if (ca && !(ca.array instanceof Float32Array && ca.itemSize === 3)) {
        // r128's getX() returns the RAW integers (e.g. 17456), so rescale them to 0..1 ourselves.
        var n = ca.count, out = new Float32Array(n * 3), a = ca.array, s = ca.itemSize;
        var scale = !ca.normalized ? 1 : a instanceof Uint16Array ? 1 / 65535 : a instanceof Uint8Array ? 1 / 255 : 1;
        for (var i = 0; i < n; i++) { out[i * 3] = a[i * s] * scale; out[i * 3 + 1] = a[i * s + 1] * scale; out[i * 3 + 2] = a[i * s + 2] * scale; }
        o.geometry.setAttribute('color', new THREE.BufferAttribute(out, 3));
      }
      if (o.geometry.attributes.color) { o.material.vertexColors = true; o.material.needsUpdate = true; }
      if (o.material.metalness === undefined || o.material.metalness === 1) o.material.metalness = 0;
    });
    return root;
  }

  return { col: col, rng: rng, fbm3: fbm3, tile4: tile4, anims: anims, prepareModel: prepareModel, createRenderer: createRenderer, lights: lights,
           tex: tex, mat: mat, rock: rock, crystal: crystal, crystalCluster: crystalCluster, roundedBox: roundedBox,
           tube: tube, chain: chain, scatter: scatter, grass: grass };
})();
