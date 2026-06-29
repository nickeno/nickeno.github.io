
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
    var weakDevice = isMobile ||
        (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) ||
        (navigator.deviceMemory && navigator.deviceMemory <= 4);

    window.nickeno3D = window.nickeno3D || {
        setActiveTier: function () {},
        clearActiveTier: function () {},
        openTier: function () {}
    };
    document.documentElement.classList.add('has-nickeno-3d-api');

    function webglAvailable() {
        try {
            var c = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl')));
        } catch (e) { return false; }
    }
    if (!webglAvailable()) return;

    function loadThree(cb) {
        if (window.THREE) { cb(); return; }
        if (window.nickenoThreePromise) { window.nickenoThreePromise.then(cb).catch(function () {}); return; }
        var s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        window.nickenoThreePromise = new Promise(function (res, rej) {
            s.onload = function () { res(window.THREE); cb(); };
            s.onerror = rej;
        });
        document.head.appendChild(s);
    }

    loadThree(function () {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    });

    var HALO_VERT = [
        'uniform float uTime;',
        'uniform float uDisplace;',
        'uniform float uActive;',
        'uniform float uIndex;',
        'varying vec3 vN;',
        'varying vec3 vV;',
        'varying vec3 vWorldPos;',
        'varying float vDisp;',
        '',
        'float noise3(vec3 p) {',
        '  vec3 i = floor(p); vec3 f = fract(p);',
        '  f = f*f*(3.0-2.0*f);',
        '  float n = dot(i, vec3(1.0,57.0,113.0));',
        '  return mix(',
        '    mix(mix(fract(sin(n+0.0)*43758.5),fract(sin(n+1.0)*43758.5),f.x),',
        '        mix(fract(sin(n+57.0)*43758.5),fract(sin(n+58.0)*43758.5),f.x),f.y),',
        '    mix(mix(fract(sin(n+113.0)*43758.5),fract(sin(n+114.0)*43758.5),f.x),',
        '        mix(fract(sin(n+170.0)*43758.5),fract(sin(n+171.0)*43758.5),f.x),f.y),',
        '  f.z);',
        '}',
        '',
        'void main() {',
        '  vec3 pos = position;',
        '  float phase = uIndex * 1.27 + uTime * 1.9;',
        '  float disp = sin(phase + normal.x * 4.8) * 0.036',
        '             + sin(phase * 0.71 + normal.y * 6.2) * 0.022',
        '             + noise3(pos * 2.4 + uTime * 0.35) * 0.016;',
        '  disp *= uDisplace * (1.0 + uActive * 0.9);',
        '  vDisp = disp;',
        '  pos += normal * disp;',
        '  vWorldPos = (modelMatrix * vec4(pos, 1.0)).xyz;',
        '  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vV = -mvPos.xyz;',
        '  gl_Position = projectionMatrix * mvPos;',
        '}'
    ].join('\n');

    var HALO_FRAG = [
        'uniform float uTime;',
        'uniform vec3  uColor;',
        'uniform float uOpacity;',
        'uniform float uActive;',
        'varying vec3 vN;',
        'varying vec3 vV;',
        'varying vec3 vWorldPos;',
        'varying float vDisp;',
        '',
        'vec3 hue2rgb(float h) {',
        '  h = mod(h, 1.0);',
        '  return clamp(vec3(',
        '    abs(h*6.0-3.0)-1.0,',
        '    2.0-abs(h*6.0-2.0),',
        '    2.0-abs(h*6.0-4.0)',
        '  ), 0.0, 1.0);',
        '}',
        '',
        'void main() {',
        '  vec3 N = normalize(vN);',
        '  vec3 V = normalize(vV);',
        '  float fr = 1.0 - max(0.0, dot(N, V));',
        '  float f2 = fr * fr;',
        '  float f5 = f2 * f2 * fr;',
        '',
        '  float hue = mod(fr * 0.72 + uTime * 0.038 + vDisp * 4.0, 1.0);',
        '  vec3 irid = hue2rgb(hue) * 0.55;',
        '',
        '  float pulse = sin(uTime * 2.1 + vWorldPos.y * 3.8) * 0.5 + 0.5;',
        '  float activePulse = uActive * pulse * 0.22;',
        '',
        '  vec3 L = normalize(vec3(-2.0, 3.0, 5.0) - vWorldPos);',
        '  vec3 H = normalize(L + V);',
        '  float spec = pow(max(0.0, dot(N, H)), 48.0) * 0.5;',
        '',
        '  vec3 col = mix(uColor, irid, clamp(f2 * 0.82 + uActive * 0.18, 0.0, 1.0));',
        '  col += uColor * f5 * (0.8 + uActive * 1.2);',
        '  col += vec3(spec * (0.5 + uActive * 0.5));',
        '  col += uColor * activePulse;',
        '',
        '  float alpha = uOpacity * (0.12 + f2 * 0.68 + f5 * 0.18 + uActive * 0.12 + activePulse * 0.08);',
        '  alpha = clamp(alpha, 0.0, 1.0);',
        '  gl_FragColor = vec4(col, alpha);',
        '}'
    ].join('\n');

    var TIER_VERT = [
        'uniform float uTime;',
        'uniform float uActive;',
        'varying vec3 vN;',
        'varying vec3 vV;',
        'void main() {',
        '  vec4 mvPos = modelViewMatrix * vec4(position, 1.0);',
        '  vN = normalize(normalMatrix * normal);',
        '  vV = -mvPos.xyz;',
        '  gl_Position = projectionMatrix * mvPos;',
        '}'
    ].join('\n');

    var TIER_FRAG = [
        'uniform float uTime;',
        'uniform vec3  uColor;',
        'uniform float uOpacity;',
        'uniform float uActive;',
        'varying vec3 vN;',
        'varying vec3 vV;',
        'void main() {',
        '  vec3 N = normalize(vN);',
        '  vec3 V = normalize(vV);',
        '  float fr = 1.0 - max(0.0, dot(N, V));',
        '  float pulse = sin(uTime * 3.2) * 0.5 + 0.5;',
        '  float a = uOpacity * (0.18 + fr * fr * 0.72 + uActive * (0.30 + pulse * 0.18));',
        '  vec3 col = uColor + uColor * fr * (0.5 + uActive * 0.8);',
        '  gl_FragColor = vec4(col, clamp(a, 0.0, 1.0));',
        '}'
    ].join('\n');

    var PART_VERT = [
        'attribute float aPhase;',
        'attribute float aSize;',
        'uniform float uTime;',
        'varying vec3 vCol;',
        'varying float vA;',
        'void main() {',
        '  vCol = color;',
        '  vec3 pos = position;',
        '  pos.y += sin(uTime * 0.48 + aPhase) * 0.028;',
        '  pos.x += cos(uTime * 0.33 + aPhase * 1.3) * 0.016;',
        '  vec4 mvPos = modelViewMatrix * vec4(pos, 1.0);',
        '  float dist = length(mvPos.xyz);',
        '  gl_PointSize = aSize * 3.2 * (260.0 / max(dist, 0.5));',
        '  gl_PointSize = clamp(gl_PointSize, 1.0, 9.0);',
        '  vA = clamp(0.62 - dist * 0.012, 0.0, 1.0);',
        '  gl_Position = projectionMatrix * mvPos;',
        '}'
    ].join('\n');

    var PART_FRAG = [
        'varying vec3 vCol;',
        'varying float vA;',
        'void main() {',
        '  vec2 uv = gl_PointCoord - 0.5;',
        '  float r = length(uv);',
        '  if (r > 0.5) discard;',
        '  float a = pow(1.0 - r * 2.0, 3.0);',
        '  gl_FragColor = vec4(vCol, a * vA * 0.72);',
        '}'
    ].join('\n');

    function boot() {
        var THREE = window.THREE;
        if (!THREE) return;
        document.documentElement.classList.add('has-nickeno-webgl');

        var canvas = document.getElementById('hero-3d-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'hero-3d-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            document.body.insertBefore(canvas, document.body.firstChild);
        }
        canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-2;mix-blend-mode:screen;';

        var bloomCanvas = null, bloomCtx = null, bloomOpacity = 0;
        if (!weakDevice) {
            bloomCanvas = document.createElement('canvas');
            bloomCanvas.id = 'hero-bloom-canvas';
            bloomCanvas.setAttribute('aria-hidden', 'true');
            bloomCanvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:-1;mix-blend-mode:screen;opacity:0;will-change:opacity;';
            document.body.insertBefore(bloomCanvas, canvas.nextSibling);
            bloomCtx = bloomCanvas.getContext('2d');
            bloomCanvas.width  = window.innerWidth;
            bloomCanvas.height = window.innerHeight;
        }

        var renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: !weakDevice,
            powerPreference: 'high-performance',
            preserveDrawingBuffer: !weakDevice
        });
        if (THREE.sRGBEncoding)          renderer.outputEncoding      = THREE.sRGBEncoding;
        if (THREE.ACESFilmicToneMapping) renderer.toneMapping          = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.18;
        var dprCap = weakDevice ? 1.0 : Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2.0);
        renderer.setPixelRatio(dprCap);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);

        var scene  = new THREE.Scene();
        var camZ   = isMobile ? 10.5 : 8.5;
        var camera = new THREE.PerspectiveCamera(40, window.innerWidth / window.innerHeight, 0.1, 100);
        camera.position.set(0, 0, camZ);

        var rig        = new THREE.Group();
        var haloRig    = new THREE.Group();
        var tierRig    = new THREE.Group();
        var particleRig= new THREE.Group();
        scene.add(rig);
        rig.add(haloRig, tierRig, particleRig);

        scene.add(new THREE.AmbientLight(0xf6f0e2, 0.28));
        var key = new THREE.DirectionalLight(0xfff1d0, 1.4);
        key.position.set(-2.0, 3.5, 5.0);
        scene.add(key);
        var mintL = new THREE.PointLight(0x8fe0c5, 2.8, 16);
        mintL.position.set(4.0, 1.5, 2.0);
        scene.add(mintL);
        var blueL = new THREE.PointLight(0x82a8ff, 2.2, 16);
        blueL.position.set(-3.8, -1.2, 3.0);
        scene.add(blueL);
        var roseL = new THREE.PointLight(0xf49a91, 1.8, 14);
        roseL.position.set(0.5, 3.2, -2.0);
        scene.add(roseL);
        var goldL = new THREE.PointLight(0xd8a75f, 1.4, 12);
        goldL.position.set(1.8, -1.2, 3.5);
        scene.add(goldL);

        var cursorLight = new THREE.PointLight(0x8fe0c5, 0.7, 7);
        scene.add(cursorLight);

        var tierNames  = ['basic', 'pro', 'unlimited', 'exclusive'];
        var tierColors = [0x8fe0c5, 0x82a8ff, 0xd8a75f, 0xf49a91];
        var tierColObjs = tierColors.map(function (c) { return new THREE.Color(c); });

        var haloData = [
            { radius: 2.8,  tube: 0.022, segs: weakDevice ? 120 : 220, color: 0x8fe0c5, opacity: 0.72, index: 0 },
            { radius: 2.0,  tube: 0.017, segs: weakDevice ? 90  : 170, color: 0x82a8ff, opacity: 0.62, index: 1 },
            { radius: 1.35, tube: 0.013, segs: weakDevice ? 70  : 130, color: 0xd8a75f, opacity: 0.54, index: 2 }
        ];

        var halos = [];
        var haloUniforms = [];

        haloData.forEach(function (h) {
            var uni = {
                uTime:     { value: 0 },
                uColor:    { value: new THREE.Color(h.color) },
                uOpacity:  { value: h.opacity },
                uActive:   { value: 0 },
                uDisplace: { value: weakDevice ? 0.0 : 1.0 },
                uIndex:    { value: h.index }
            };
            haloUniforms.push(uni);

            var mat = new THREE.ShaderMaterial({
                uniforms: uni,
                vertexShader: HALO_VERT,
                fragmentShader: HALO_FRAG,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            var geo = new THREE.TorusGeometry(h.radius, h.tube, 4, h.segs);
            var mesh = new THREE.Mesh(geo, mat);
            haloRig.add(mesh);
            halos.push(mesh);
        });

        halos[0].rotation.set(0.38, 0.12, 0.0);
        halos[1].rotation.set(-0.22, 0.34, 0.18);
        halos[2].rotation.set(0.14, -0.28, 0.42);

        var coreGeo  = new THREE.SphereGeometry(0.22, 24, 16);
        var coreMat  = new THREE.MeshBasicMaterial({
            color: 0xfff0d2, transparent: true, opacity: 0.08,
            blending: THREE.AdditiveBlending, depthWrite: false
        });
        var core = new THREE.Mesh(coreGeo, coreMat);
        haloRig.add(core);

        var tierRings = [];
        var tierUniforms = [];

        tierNames.forEach(function (tier, ti) {
            var uni = {
                uTime:    { value: 0 },
                uColor:   { value: tierColObjs[ti].clone() },
                uOpacity: { value: 0.55 },
                uActive:  { value: 0 }
            };
            tierUniforms.push(uni);

            var mat = new THREE.ShaderMaterial({
                uniforms: uni,
                vertexShader: TIER_VERT,
                fragmentShader: TIER_FRAG,
                transparent: true,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });

            var ringGeo = new THREE.TorusGeometry(0.68, 0.011, 4, weakDevice ? 80 : 140);
            var ring    = new THREE.Mesh(ringGeo, mat);

            var glowMat = new THREE.MeshBasicMaterial({
                color: tierColors[ti], transparent: true, opacity: 0.0,
                blending: THREE.AdditiveBlending, depthWrite: false
            });
            var glowRing = new THREE.Mesh(
                new THREE.TorusGeometry(0.72, 0.030, 3, weakDevice ? 60 : 100),
                glowMat
            );
            ring.add(glowRing);
            ring.userData = { glowMat: glowMat, baseAngle: (ti / 4) * Math.PI * 2 };
            tierRig.add(ring);
            tierRings.push(ring);
        });

        var particleCount = weakDevice ? 120 : 350;
        var pGeo   = new THREE.BufferGeometry();
        var pPos   = new Float32Array(particleCount * 3);
        var pColor = new Float32Array(particleCount * 3);
        var pPhase = new Float32Array(particleCount);
        var pSize  = new Float32Array(particleCount);
        var palette = [
            new THREE.Color(0xfff0d2), new THREE.Color(0x8fe0c5),
            new THREE.Color(0x82a8ff), new THREE.Color(0xf49a91),
            new THREE.Color(0xd8a75f)
        ];

        for (var pi = 0; pi < particleCount; pi++) {
            var ang = Math.random() * Math.PI * 2;
            var rad = 2.8 + Math.random() * 3.5;
            var ht  = (Math.random() - 0.5) * 2.5;
            pPos[pi * 3]     = Math.cos(ang) * rad;
            pPos[pi * 3 + 1] = ht;
            pPos[pi * 3 + 2] = Math.sin(ang) * rad * 0.58;
            var pc = palette[Math.floor(Math.random() * palette.length)];
            pColor[pi * 3]     = pc.r;
            pColor[pi * 3 + 1] = pc.g;
            pColor[pi * 3 + 2] = pc.b;
            pPhase[pi] = Math.random() * Math.PI * 2;
            pSize[pi]  = 0.4 + Math.random() * 1.4;
        }

        pGeo.setAttribute('position', new THREE.BufferAttribute(pPos,   3));
        pGeo.setAttribute('color',    new THREE.BufferAttribute(pColor, 3));
        pGeo.setAttribute('aPhase',   new THREE.BufferAttribute(pPhase, 1));
        pGeo.setAttribute('aSize',    new THREE.BufferAttribute(pSize,  1));

        var pUniforms = { uTime: { value: 0 } };
        var pMat = new THREE.ShaderMaterial({
            uniforms: pUniforms,
            vertexShader: PART_VERT,
            fragmentShader: PART_FRAG,
            transparent: true,
            vertexColors: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        particleRig.add(new THREE.Points(pGeo, pMat));

        var mouse      = { x: 0, y: 0, sx: 0, sy: 0 };
        var scroll     = { hero: 0, pricing: 0 };
        var activeTier = '';
        var openingTier= '';
        var openingStart = 0;
        var openProg   = 0;
        var clock = 0, last = 0, paused = false;

        var mobileInterval = 1 / 30;
        var mobileAccum    = 0;

        function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, v)); }
        function lerp(a, b, t)    { return a + (b - a) * t; }
        function easeOut3(t)      { return 1 - Math.pow(1 - t, 3); }

        function updateScroll() {
            var y  = window.scrollY || 0;
            scroll.hero = clamp(y / Math.max(window.innerHeight * 1.1, 1), 0, 1);
            var el = document.getElementById('pricing');
            if (el) {
                var top = el.getBoundingClientRect().top;
                scroll.pricing = clamp(1 - top / Math.max(window.innerHeight * 0.85, 1), 0, 1);
            }
        }

        function updateBloom() {
            if (!bloomCanvas || !bloomCtx || !canvas) return;
            var target = (activeTier ? 0.75 : 0.32) + scroll.pricing * 0.20;
            bloomOpacity = lerp(bloomOpacity, target, 0.06);
            bloomCanvas.style.opacity = String(Math.round(bloomOpacity * 1000) / 1000);
            bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
            bloomCtx.filter = 'blur(22px) brightness(1.65)';
            try { bloomCtx.drawImage(canvas, 0, 0, bloomCanvas.width, bloomCanvas.height); } catch (e) {}
            bloomCtx.filter = 'none';
        }

        function renderFrame(ts) {
            if (paused) return;
            if (!last) last = ts;
            var rawDt = Math.min((ts - last) / 1000, 0.1);
            last = ts;

            if (isMobile) {
                mobileAccum += rawDt;
                if (mobileAccum < mobileInterval) {
                    requestAnimationFrame(renderFrame);
                    return;
                }
                mobileAccum = 0;
            }

            var dt = Math.min(rawDt, 0.05);
            clock += dt;

            updateScroll();

            var mouseLerp = isMobile ? 0.028 : 0.038;
            mouse.sx += (mouse.x - mouse.sx) * mouseLerp;
            mouse.sy += (mouse.y - mouse.sy) * mouseLerp;

            var heroOut   = scroll.hero;
            var pricingIn = scroll.pricing;
            var mS        = isMobile ? 0.72 : 1.0;
            var activeIdx = tierNames.indexOf(activeTier);

            if (openingTier) {
                openProg = clamp((ts - openingStart) / 800, 0, 1);
            } else {
                openProg += (0 - openProg) * 0.07;
            }
            var openEase = easeOut3(openProg);
            if (openProg >= 1 && openingTier) openingTier = '';

            var rotSpeeds = [0.11, -0.08, 0.065];
            var tiltAxes  = [
                [1, 0, 0], [0, 1, 0], [1, 1, 0]
            ];
            haloUniforms.forEach(function (u, idx) {
                u.uTime.value  = clock;
                var isAct = activeTier ? (idx === 0 ? 0.4 : idx === 1 ? 0.3 : 0.2) : 0;
                u.uActive.value = lerp(u.uActive.value, isAct, 0.06);
            });

            halos[0].rotation.x += dt * 0.055;
            halos[0].rotation.y += dt * 0.072;
            halos[1].rotation.y -= dt * 0.045;
            halos[1].rotation.z += dt * 0.038;
            halos[2].rotation.x -= dt * 0.062;
            halos[2].rotation.z += dt * 0.058;

            var corePulse = Math.sin(clock * 1.8) * 0.5 + 0.5;
            coreMat.opacity = 0.06 + corePulse * 0.04 + (activeTier ? 0.06 : 0);

            pUniforms.uTime.value = clock;
            tierRings.forEach(function (ring, ti) {
                var uni     = tierUniforms[ti];
                uni.uTime.value = clock;
                var isAct   = tierNames[ti] === activeTier   ? 1 : 0;
                var isOp    = tierNames[ti] === openingTier  ? openEase : 0;
                var fade    = openingTier && tierNames[ti] !== openingTier ? openEase * 0.6 : 0;
                uni.uActive.value = lerp(uni.uActive.value, Math.max(isAct, isOp * 0.8), 0.09);

                var fan = ti - 1.5;
                var orbitRadius = 2.8 + (isAct * 0.3);

                var orbitAngle = ring.userData.baseAngle + clock * (0.12 + ti * 0.018);

                var restX = Math.cos(orbitAngle) * orbitRadius;
                var restY = Math.sin(orbitAngle * 0.5) * 0.4 + ti * 0.12 - 0.22;
                var restZ = Math.sin(orbitAngle) * orbitRadius * 0.45;

                var fanX = fan * (isMobile ? 1.4 : 1.85);
                var fanY = -3.5 - heroOut * 0.5;
                var fanZ = 0;

                ring.position.x = lerp(restX, fanX, pricingIn);
                ring.position.y = lerp(restY, fanY, pricingIn) + isAct * 0.35 + isOp * 0.5;
                ring.position.z = lerp(restZ, fanZ, pricingIn) + isAct * 0.6  + isOp * 2.8;

                var restRx = 0.55 + ti * 0.18;
                var restRz = orbitAngle * 0.2;
                ring.rotation.x = lerp(restRx, 0.12, pricingIn) + isOp * 0.08;
                ring.rotation.y = lerp(orbitAngle * 0.3, 0, pricingIn);
                ring.rotation.z = lerp(restRz, 0, pricingIn);

                ring.scale.setScalar(mS * (1 + isAct * 0.18 + isOp * 0.52));

                ring.userData.glowMat.opacity = 0.0 + isAct * 0.22 + isOp * 0.38 + pricingIn * 0.08;

                uni.uOpacity.value = Math.max(0.08,
                    (pricingIn > 0.1 ? 0.55 : 0.38) + isAct * 0.18 + isOp * 0.22 - fade * 0.30);
            });

            rig.scale.setScalar(mS * (1.0 - heroOut * 0.06 + pricingIn * 0.02));
            rig.position.y = heroOut * 0.8 - pricingIn * 0.6;
            rig.position.x = mouse.sx * (isMobile ? 0.05 : 0.18);

            var targetRotY = mouse.sx * (isMobile ? 0.28 : 0.55) + Math.sin(clock * 0.14) * 0.06;
            var targetRotX = -mouse.sy * (isMobile ? 0.14 : 0.30) + Math.sin(clock * 0.09) * 0.04;
            rig.rotation.y += (targetRotY - rig.rotation.y) * 0.038;
            rig.rotation.x += (targetRotX - rig.rotation.x) * 0.038;

            particleRig.rotation.y += dt * 0.022;
            particleRig.rotation.x  = Math.sin(clock * 0.08) * 0.05;

            var camTargetX = mouse.sx * (isMobile ? 0.12 : 0.32);
            var camTargetY = (isMobile ? 0 : 0.0) - mouse.sy * (isMobile ? 0.08 : 0.18) + heroOut * 0.15;
            var camTargetZ = camZ + pricingIn * (isMobile ? 1.5 : 2.0) - (activeTier ? 0.8 : 0);
            camera.position.x += (camTargetX - camera.position.x) * 0.042;
            camera.position.y += (camTargetY - camera.position.y) * 0.042;
            camera.position.z += (camTargetZ - camera.position.z) * 0.042;
            camera.lookAt(0, -pricingIn * 0.8, 0);

            cursorLight.position.set(
                mouse.sx * 3.5,
                -mouse.sy * 2.2,
                3.5
            );
            cursorLight.intensity = isMobile ? 0.2 : 0.6 + (activeIdx >= 0 ? 0.55 : 0);
            cursorLight.color.set(activeIdx >= 0 ? tierColors[activeIdx] : 0x8fe0c5);

            canvas.style.opacity = String(clamp(0.88 - heroOut * 0.18 + pricingIn * 0.06, 0, 1));

            renderer.render(scene, camera);
            if (!weakDevice) updateBloom();
            if (!reduceMotion) requestAnimationFrame(renderFrame);
        }

        window.addEventListener('pointermove', function (e) {
            mouse.x = (e.clientX / Math.max(window.innerWidth,  1)) * 2 - 1;
            mouse.y = (e.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
        }, { passive: true });

        window.addEventListener('touchmove', function (e) {
            if (!e.touches[0]) return;
            mouse.x = (e.touches[0].clientX / Math.max(window.innerWidth,  1)) * 2 - 1;
            mouse.y = (e.touches[0].clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
        }, { passive: true });

        window.addEventListener('scroll', updateScroll, { passive: true });

        window.addEventListener('resize', function () {
            isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768;
            camZ = isMobile ? 10.5 : 8.5;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.position.z = camZ;
            camera.updateProjectionMatrix();
            var newDpr = Math.min(window.devicePixelRatio || 1, weakDevice ? 1.0 : (isMobile ? 1.5 : 2.0));
            renderer.setPixelRatio(newDpr);
            renderer.setSize(window.innerWidth, window.innerHeight);
            if (bloomCanvas) {
                bloomCanvas.width  = window.innerWidth;
                bloomCanvas.height = window.innerHeight;
            }
            updateScroll();
        }, { passive: true });

        document.addEventListener('visibilitychange', function () {
            paused = document.hidden;
            if (!paused && !reduceMotion) { last = 0; requestAnimationFrame(renderFrame); }
        });

        window.nickeno3D = {
            setActiveTier: function (t) { activeTier = t || ''; },
            clearActiveTier: function ()  { activeTier = ''; },
            openTier: function (t) {
                activeTier   = t || '';
                openingTier  = t || '';
                openingStart = performance.now();
                openProg     = 0;
            }
        };

        updateScroll();
        requestAnimationFrame(renderFrame);
    }
})();
