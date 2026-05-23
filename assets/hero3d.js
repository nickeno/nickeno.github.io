/* ──────────────────────────────────────────────────────────────
   hero3d.js — Three.js 3D hero centerpiece for nickeno
   Floating frequency sculpture · particle field · signal lines
   ────────────────────────────────────────────────────────────── */
(function () {
    'use strict';

    // ── Preflight checks ────────────────────────────────────────
    var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = window.innerWidth < 768;

    // WebGL support test
    function webglAvailable() {
        try {
            var c = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (c.getContext('webgl') || c.getContext('experimental-webgl')));
        } catch (e) { return false; }
    }
    if (!webglAvailable()) return; // graceful no-op

    // ── Constants ───────────────────────────────────────────────
    var CREAM  = { r: 244 / 255, g: 234 / 255, b: 216 / 255 }; // #f4ead8
    var GOLD   = { r: 210 / 255, g: 164 / 255, b: 95  / 255 }; // #d2a45f

    var RING_POINTS        = isMobile ? 1200 : 2400;
    var RING_MAJOR_RADIUS  = 2.8;
    var RING_TUBE_RADIUS   = 0.35;
    var RING_ROWS          = isMobile ? 12 : 20;
    var RING_COLS          = Math.floor(RING_POINTS / RING_ROWS);

    var PARTICLE_COUNT     = isMobile ? 200 : 500;
    var PARTICLE_SPREAD    = 5.5;

    var SIGNAL_LINE_COUNT  = 4;
    var SIGNAL_LINE_POINTS = isMobile ? 80 : 160;
    var SIGNAL_LINE_SPAN   = 7.0;

    var LERP_FACTOR        = 0.05;
    var MAX_TILT_RAD       = (8 * Math.PI) / 180;
    var SCROLL_FADE_VH     = 1.5;
    var DPR_CAP            = 1.5;

    // ── State ───────────────────────────────────────────────────
    var mouse   = { x: 0, y: 0, sx: 0, sy: 0, vx: 0, vy: 0 }; // normalised –1…1 + smoothed
    var energy  = 0;
    var paused  = false;
    var clock   = 0;
    var lastTime = 0;

    // ── Dynamically load Three.js, then boot ────────────────────
    function loadThree(callback) {
        if (window.THREE) { callback(); return; }
        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        script.onload  = callback;
        script.onerror = function () {}; // silent fail
        document.head.appendChild(script);
    }

    loadThree(function () { document.readyState === 'loading'
        ? document.addEventListener('DOMContentLoaded', boot)
        : boot();
    });

    // ── Boot ────────────────────────────────────────────────────
    function boot() {
        var THREE = window.THREE;
        if (!THREE) return;

        // Canvas
        var canvas = document.getElementById('hero-3d-canvas');
        if (!canvas) {
            canvas = document.createElement('canvas');
            canvas.id = 'hero-3d-canvas';
            canvas.setAttribute('aria-hidden', 'true');
            var s = canvas.style;
            s.position   = 'fixed';
            s.top        = '0';
            s.left       = '0';
            s.width      = '100%';
            s.height     = '100%';
            s.zIndex     = '-1';
            s.pointerEvents = 'none';
            document.body.insertBefore(canvas, document.body.firstChild);
        }

        // Renderer
        var renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: !isMobile,
            powerPreference: 'high-performance'
        });
        var dpr = Math.min(window.devicePixelRatio || 1, DPR_CAP);
        renderer.setPixelRatio(dpr);
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);

        // Scene / Camera
        var scene  = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 50);
        camera.position.set(0, 0.4, 8);
        camera.lookAt(0, 0, 0);

        // ── Group for the whole sculpture ─────────────────────
        var sculpture = new THREE.Group();
        // Tilt ring like a vinyl record — slight angle
        sculpture.rotation.x = 0.35;
        sculpture.rotation.z = 0.08;
        scene.add(sculpture);

        // ────────────────────────────────────────────────────────
        // 1.  FREQUENCY RING
        // ────────────────────────────────────────────────────────
        var ringGeo = new THREE.BufferGeometry();
        var ringPositions = new Float32Array(RING_POINTS * 3);
        var ringBasePositions = new Float32Array(RING_POINTS * 3); // undisplaced
        var ringColors  = new Float32Array(RING_POINTS * 3);
        var ringSizes   = new Float32Array(RING_POINTS);
        var ringAlphas  = new Float32Array(RING_POINTS);

        var idx = 0;
        for (var row = 0; row < RING_ROWS; row++) {
            var v = row / (RING_ROWS - 1); // 0…1 along tube
            var tubeAngle = v * Math.PI * 2;
            for (var col = 0; col < RING_COLS; col++) {
                var u = col / RING_COLS; // 0…1 around ring
                var theta = u * Math.PI * 2;

                var cx = Math.cos(theta) * RING_MAJOR_RADIUS;
                var cz = Math.sin(theta) * RING_MAJOR_RADIUS;

                // Tube displacement direction
                var nx = Math.cos(theta) * Math.cos(tubeAngle);
                var ny = Math.sin(tubeAngle);
                var nz = Math.sin(theta) * Math.cos(tubeAngle);

                var px = cx + nx * RING_TUBE_RADIUS;
                var py = ny * RING_TUBE_RADIUS;
                var pz = cz + nz * RING_TUBE_RADIUS;

                ringBasePositions[idx * 3]     = px;
                ringBasePositions[idx * 3 + 1] = py;
                ringBasePositions[idx * 3 + 2] = pz;
                ringPositions[idx * 3]     = px;
                ringPositions[idx * 3 + 1] = py;
                ringPositions[idx * 3 + 2] = pz;

                // Color — blend cream to gold based on tube angle
                var blend = Math.sin(tubeAngle) * 0.5 + 0.5;
                ringColors[idx * 3]     = CREAM.r + (GOLD.r - CREAM.r) * blend;
                ringColors[idx * 3 + 1] = CREAM.g + (GOLD.g - CREAM.g) * blend;
                ringColors[idx * 3 + 2] = CREAM.b + (GOLD.b - CREAM.b) * blend;

                ringSizes[idx]  = isMobile ? 1.8 : 2.4;
                ringAlphas[idx] = 0.3 + blend * 0.5;

                idx++;
            }
        }

        ringGeo.setAttribute('position', new THREE.BufferAttribute(ringPositions, 3));
        ringGeo.setAttribute('color',    new THREE.BufferAttribute(ringColors, 3));
        ringGeo.setAttribute('size',     new THREE.BufferAttribute(ringSizes, 1));
        ringGeo.setAttribute('alpha',    new THREE.BufferAttribute(ringAlphas, 1));

        // Point material — circle with soft edge via ShaderMaterial
        var ringMat = new THREE.ShaderMaterial({
            vertexShader: [
                'attribute float size;',
                'attribute float alpha;',
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'void main() {',
                '  vColor = color;',
                '  vAlpha = alpha;',
                '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
                '  gl_PointSize = size * (300.0 / -mv.z);',
                '  gl_Position = projectionMatrix * mv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'void main() {',
                '  float d = length(gl_PointCoord - vec2(0.5));',
                '  if (d > 0.5) discard;',
                '  float a = smoothstep(0.5, 0.15, d) * vAlpha;',
                '  gl_FragColor = vec4(vColor, a);',
                '}'
            ].join('\n'),
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        var ringPoints = new THREE.Points(ringGeo, ringMat);
        sculpture.add(ringPoints);

        // ────────────────────────────────────────────────────────
        // 2.  PARTICLE FIELD
        // ────────────────────────────────────────────────────────
        var partGeo = new THREE.BufferGeometry();
        var partPositions    = new Float32Array(PARTICLE_COUNT * 3);
        var partBasePos      = new Float32Array(PARTICLE_COUNT * 3); // reference
        var partColors       = new Float32Array(PARTICLE_COUNT * 3);
        var partSizes        = new Float32Array(PARTICLE_COUNT);
        var partAlphas       = new Float32Array(PARTICLE_COUNT);
        var partPhases       = new Float32Array(PARTICLE_COUNT); // random phase offset

        for (var i = 0; i < PARTICLE_COUNT; i++) {
            // Distribute in a sphere around ring
            var phi   = Math.acos(2 * Math.random() - 1);
            var theta2 = Math.random() * Math.PI * 2;
            var rad   = PARTICLE_SPREAD * (0.45 + Math.random() * 0.55);

            var px2 = Math.sin(phi) * Math.cos(theta2) * rad;
            var py2 = Math.sin(phi) * Math.sin(theta2) * rad * 0.5; // flatten Y
            var pz2 = Math.cos(phi) * rad;

            partBasePos[i * 3]     = px2;
            partBasePos[i * 3 + 1] = py2;
            partBasePos[i * 3 + 2] = pz2;
            partPositions[i * 3]     = px2;
            partPositions[i * 3 + 1] = py2;
            partPositions[i * 3 + 2] = pz2;

            var b2 = Math.random();
            partColors[i * 3]     = CREAM.r + (GOLD.r - CREAM.r) * b2;
            partColors[i * 3 + 1] = CREAM.g + (GOLD.g - CREAM.g) * b2;
            partColors[i * 3 + 2] = CREAM.b + (GOLD.b - CREAM.b) * b2;

            partSizes[i]  = 0.8 + Math.random() * 1.2;
            partAlphas[i] = 0.08 + Math.random() * 0.12;
            partPhases[i] = Math.random() * Math.PI * 2;
        }

        partGeo.setAttribute('position', new THREE.BufferAttribute(partPositions, 3));
        partGeo.setAttribute('color',    new THREE.BufferAttribute(partColors, 3));
        partGeo.setAttribute('size',     new THREE.BufferAttribute(partSizes, 1));
        partGeo.setAttribute('alpha',    new THREE.BufferAttribute(partAlphas, 1));

        var partMat = new THREE.ShaderMaterial({
            vertexShader: [
                'attribute float size;',
                'attribute float alpha;',
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'void main() {',
                '  vColor = color;',
                '  vAlpha = alpha;',
                '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
                '  gl_PointSize = size * (200.0 / -mv.z);',
                '  gl_Position = projectionMatrix * mv;',
                '}'
            ].join('\n'),
            fragmentShader: [
                'varying vec3 vColor;',
                'varying float vAlpha;',
                'void main() {',
                '  float d = length(gl_PointCoord - vec2(0.5));',
                '  if (d > 0.5) discard;',
                '  float a = smoothstep(0.5, 0.2, d) * vAlpha;',
                '  gl_FragColor = vec4(vColor, a);',
                '}'
            ].join('\n'),
            vertexColors: true,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });

        var particles = new THREE.Points(partGeo, partMat);
        scene.add(particles);

        // ────────────────────────────────────────────────────────
        // 3.  SIGNAL LINES
        // ────────────────────────────────────────────────────────
        var signalLines = [];

        for (var sl = 0; sl < SIGNAL_LINE_COUNT; sl++) {
            var slGeo = new THREE.BufferGeometry();
            var slPos = new Float32Array(SIGNAL_LINE_POINTS * 3);
            slGeo.setAttribute('position', new THREE.BufferAttribute(slPos, 3));

            var yOff = (sl - (SIGNAL_LINE_COUNT - 1) / 2) * 0.22;
            var lineAlpha = 0.06 + sl * 0.018;

            var slMat = new THREE.LineBasicMaterial({
                color: new THREE.Color(CREAM.r, CREAM.g, CREAM.b),
                transparent: true,
                opacity: lineAlpha,
                depthWrite: false,
                blending: THREE.NormalBlending
            });

            var line = new THREE.Line(slGeo, slMat);
            sculpture.add(line);
            signalLines.push({ line: line, geo: slGeo, yOff: yOff, baseAlpha: lineAlpha, phaseOff: sl * 1.3 });
        }

        // ────────────────────────────────────────────────────────
        // REDUCED MOTION — show static snapshot, skip anim loop
        // ────────────────────────────────────────────────────────
        if (reducedMotion) {
            // Just render one frame — no animation
            updateRing(0);
            updateParticles(0);
            updateSignalLines(0);
            renderer.render(scene, camera);
            return; // no animation loop
        }

        // ────────────────────────────────────────────────────────
        // Event listeners
        // ────────────────────────────────────────────────────────

        // Mouse / touch
        function onPointerMove(e) {
            var prevX = mouse.x;
            var prevY = mouse.y;
            mouse.x = (e.clientX / window.innerWidth)  * 2 - 1; // –1…1
            mouse.y = (e.clientY / window.innerHeight) * 2 - 1;
            mouse.vx = mouse.x - prevX;
            mouse.vy = mouse.y - prevY;
            energy = Math.min(1.0, energy + 0.18);
        }
        window.addEventListener('pointermove', onPointerMove, { passive: true });

        // Touch — map first touch to mouse
        window.addEventListener('touchmove', function (e) {
            if (e.touches.length) {
                onPointerMove({ clientX: e.touches[0].clientX, clientY: e.touches[0].clientY });
            }
        }, { passive: true });

        // Resize (throttled)
        var resizeTimer = 0;
        window.addEventListener('resize', function () {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(function () {
                var w = window.innerWidth;
                var h = window.innerHeight;
                camera.aspect = w / h;
                camera.updateProjectionMatrix();
                renderer.setSize(w, h);
                isMobile = w < 768;
            }, 150);
        }, { passive: true });

        // Visibility
        document.addEventListener('visibilitychange', function () {
            paused = document.hidden;
            if (!paused) {
                lastTime = 0;
                requestAnimationFrame(animate);
            }
        });

        // ────────────────────────────────────────────────────────
        // Update functions
        // ────────────────────────────────────────────────────────

        function updateRing(t) {
            var pos  = ringGeo.attributes.position.array;
            var base = ringBasePositions;

            for (var i = 0; i < RING_POINTS; i++) {
                var bx = base[i * 3];
                var by = base[i * 3 + 1];
                var bz = base[i * 3 + 2];

                // Direction from ring center to this point (for radial displacement)
                var dx = bx;
                var dz = bz;
                var len = Math.sqrt(dx * dx + dz * dz) || 1;
                var nx2 = dx / len;
                var nz2 = dz / len;

                // Compute theta from position on ring for wave
                var theta3 = Math.atan2(bz, bx);

                // Oscillation — several sine waves stacked
                var wave  = Math.sin(theta3 * 3 + t * 1.2) * 0.07;
                wave     += Math.sin(theta3 * 7 - t * 0.8) * 0.035;
                wave     += Math.sin(theta3 * 11 + t * 2.0) * 0.018;

                // Energy burst — amplify when cursor moves fast
                var energyMul = 1.0 + energy * 2.5;

                // Breathing — slow pulse
                var breath = Math.sin(t * 0.4) * 0.02;

                var displacement = (wave * energyMul + breath);

                pos[i * 3]     = bx + nx2 * displacement;
                pos[i * 3 + 1] = by + Math.sin(theta3 * 5 + t * 1.5) * 0.025 * energyMul;
                pos[i * 3 + 2] = bz + nz2 * displacement;
            }
            ringGeo.attributes.position.needsUpdate = true;
        }

        function updateParticles(t) {
            var pos  = partGeo.attributes.position.array;
            var base = partBasePos;
            var sizes = partGeo.attributes.size.array;
            var alphas = partGeo.attributes.alpha.array;

            // Breathing factor
            var breathScale = 1.0 + Math.sin(t * 0.3) * 0.06;

            // Cursor world-space estimate (simple projection)
            var cursorWorldX = mouse.sx * 4.5;
            var cursorWorldY = -mouse.sy * 3.0;

            for (var i = 0; i < PARTICLE_COUNT; i++) {
                var bx = base[i * 3];
                var by = base[i * 3 + 1];
                var bz = base[i * 3 + 2];

                // Breathing radial drift
                var phase = partPhases[i];
                var drift = breathScale + Math.sin(t * 0.5 + phase) * 0.04;

                var px3 = bx * drift;
                var py3 = by * drift;
                var pz3 = bz * drift;

                // Cursor repulsion (only X/Y, in screen-space approx)
                if (!isMobile) {
                    var ddx = px3 - cursorWorldX;
                    var ddy = py3 - cursorWorldY;
                    var dist2 = ddx * ddx + ddy * ddy;
                    if (dist2 < 9.0) { // repulsion radius ~3 units
                        var force = (1.0 - dist2 / 9.0) * 0.35;
                        var dd = Math.sqrt(dist2) || 0.001;
                        px3 += (ddx / dd) * force;
                        py3 += (ddy / dd) * force;
                    }
                }

                pos[i * 3]     = px3;
                pos[i * 3 + 1] = py3;
                pos[i * 3 + 2] = pz3;

                // Subtle twinkle
                alphas[i] = (0.08 + Math.random() * 0.02) + Math.sin(t * 2.0 + phase) * 0.04;
            }
            partGeo.attributes.position.needsUpdate = true;
            partGeo.attributes.alpha.needsUpdate = true;
        }

        function updateSignalLines(t) {
            for (var s = 0; s < signalLines.length; s++) {
                var sl = signalLines[s];
                var pos = sl.geo.attributes.position.array;
                var halfSpan = SIGNAL_LINE_SPAN / 2;

                for (var p = 0; p < SIGNAL_LINE_POINTS; p++) {
                    var frac = p / (SIGNAL_LINE_POINTS - 1); // 0…1
                    var x = -halfSpan + frac * SIGNAL_LINE_SPAN;

                    // Proximity to center → higher amplitude
                    var centerDist = Math.abs(frac - 0.5) * 2; // 0 at center, 1 at edge
                    var envelope = 1.0 - centerDist * centerDist;

                    // Cursor X proximity boost
                    var cursorProx = 1.0 - Math.min(1.0, Math.abs(frac - (mouse.sx * 0.5 + 0.5)) * 2.5);
                    cursorProx = Math.max(0, cursorProx);

                    var amp = envelope * (0.08 + energy * 0.12 + cursorProx * 0.06);

                    var y = sl.yOff + Math.sin(x * 2.0 + t * 1.8 + sl.phaseOff) * amp
                                    + Math.sin(x * 4.5 - t * 1.2 + sl.phaseOff * 0.7) * amp * 0.3;

                    pos[p * 3]     = x;
                    pos[p * 3 + 1] = y;
                    pos[p * 3 + 2] = 0;
                }

                sl.geo.attributes.position.needsUpdate = true;

                // Modulate opacity slightly with energy
                sl.line.material.opacity = sl.baseAlpha + energy * 0.04;
            }
        }

        // ────────────────────────────────────────────────────────
        // Animation loop
        // ────────────────────────────────────────────────────────

        function animate(timestamp) {
            if (paused) return;
            requestAnimationFrame(animate);

            // Delta time (capped to avoid jumps)
            if (!lastTime) lastTime = timestamp;
            var dt = Math.min((timestamp - lastTime) / 1000, 0.1);
            lastTime = timestamp;
            clock += dt;

            // Smooth mouse
            mouse.sx += (mouse.x - mouse.sx) * LERP_FACTOR;
            mouse.sy += (mouse.y - mouse.sy) * LERP_FACTOR;

            // Decay energy
            energy *= 0.94;

            // ── Cursor tilt on sculpture ─────────────────────
            if (!isMobile) {
                var targetRotX = 0.35 + mouse.sy * MAX_TILT_RAD;
                var targetRotY = mouse.sx * MAX_TILT_RAD;
                sculpture.rotation.x += (targetRotX - sculpture.rotation.x) * 0.04;
                sculpture.rotation.y += (targetRotY - sculpture.rotation.y) * 0.04;
            }

            // ── Slow Y rotation on ring ──────────────────────
            ringPoints.rotation.y += 0.15 * dt;

            // ── Parallax particle field (opposite to cursor) ─
            if (!isMobile) {
                particles.position.x += (-mouse.sx * 0.3 - particles.position.x) * 0.03;
                particles.position.y += (mouse.sy * 0.2 - particles.position.y) * 0.03;
            }

            // ── Update geometries ────────────────────────────
            updateRing(clock);
            updateParticles(clock);
            updateSignalLines(clock);

            // ── Scroll fade / scale ──────────────────────────
            var scrollY = window.scrollY || window.pageYOffset || 0;
            var fadeEnd = window.innerHeight * SCROLL_FADE_VH;
            var scrollFrac = Math.min(1.0, scrollY / fadeEnd);
            var scrollAlpha = 1.0 - scrollFrac;
            var scrollScale = 1.0 - scrollFrac * 0.15;

            canvas.style.opacity = scrollAlpha;
            scene.scale.setScalar(scrollScale);
            scene.position.y = scrollFrac * 1.5; // shift up as scroll

            // ── Render ───────────────────────────────────────
            renderer.render(scene, camera);
        }

        requestAnimationFrame(animate);
    }

})();
