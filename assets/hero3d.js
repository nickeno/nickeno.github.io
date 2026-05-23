(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isMobile = window.innerWidth < 768;
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
            var canvas = document.createElement('canvas');
            return !!(window.WebGLRenderingContext &&
                (canvas.getContext('webgl') || canvas.getContext('experimental-webgl')));
        } catch (error) {
            return false;
        }
    }

    if (!webglAvailable()) return;

    function loadThree(callback) {
        if (window.THREE) {
            callback();
            return;
        }

        if (window.nickenoThreePromise) {
            window.nickenoThreePromise.then(callback).catch(function () {});
            return;
        }

        var script = document.createElement('script');
        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
        window.nickenoThreePromise = new Promise(function (resolve, reject) {
            script.onload = function () {
                resolve(window.THREE);
                callback();
            };
            script.onerror = reject;
        });
        document.head.appendChild(script);
    }

    loadThree(function () {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', boot);
        } else {
            boot();
        }
    });

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

        var style = canvas.style;
        style.position = 'fixed';
        style.inset = '0';
        style.width = '100%';
        style.height = '100%';
        style.pointerEvents = 'none';
        style.zIndex = '-2';

        var renderer = new THREE.WebGLRenderer({
            canvas: canvas,
            alpha: true,
            antialias: !weakDevice,
            powerPreference: 'high-performance'
        });

        if (THREE.sRGBEncoding) renderer.outputEncoding = THREE.sRGBEncoding;
        if (THREE.ACESFilmicToneMapping) renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.08;

        var dprCap = weakDevice ? 1.15 : 1.55;
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, dprCap));
        renderer.setSize(window.innerWidth, window.innerHeight);
        renderer.setClearColor(0x000000, 0);

        var scene = new THREE.Scene();
        var camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 80);
        camera.position.set(0, isMobile ? 0.18 : 0.28, isMobile ? 9.4 : 8.1);

        var rig = new THREE.Group();
        var packageRig = new THREE.Group();
        var recordRig = new THREE.Group();
        var accentRig = new THREE.Group();
        scene.add(rig);
        rig.add(packageRig);
        rig.add(recordRig);
        rig.add(accentRig);

        var ambient = new THREE.AmbientLight(0xf6f0e2, 0.42);
        var key = new THREE.DirectionalLight(0xfff1d0, 1.45);
        var mint = new THREE.PointLight(0x8fe0c5, 1.7, 11);
        var blue = new THREE.PointLight(0x82a8ff, 1.35, 12);
        var rose = new THREE.PointLight(0xf49a91, 1.2, 12);
        key.position.set(-2.8, 3.4, 4.2);
        mint.position.set(3.5, 1.2, 2.4);
        blue.position.set(-3.2, -1.6, 3);
        rose.position.set(0.8, 2.7, -2.6);
        scene.add(ambient, key, mint, blue, rose);

        function material(options) {
            var base = {
                color: options.color,
                roughness: options.roughness || 0.24,
                metalness: options.metalness || 0.06,
                transparent: true,
                opacity: options.opacity,
                side: THREE.DoubleSide
            };

            if (THREE.MeshPhysicalMaterial) {
                base.clearcoat = 0.75;
                base.clearcoatRoughness = 0.28;
                base.reflectivity = 0.45;
                return new THREE.MeshPhysicalMaterial(base);
            }

            return new THREE.MeshStandardMaterial(base);
        }

        var tierNames = ['basic', 'pro', 'unlimited', 'exclusive'];
        var colors = [0x8fe0c5, 0x82a8ff, 0xd8a75f, 0xf49a91];
        var slabGeo = new THREE.BoxGeometry(3.15, 0.055, 1.72, 1, 1, 1);
        var edgeGeo = new THREE.EdgesGeometry(slabGeo);
        var foilGeo = new THREE.BoxGeometry(0.038, 0.07, 1.78, 1, 1, 1);
        var lineGeo = new THREE.BoxGeometry(0.58, 0.012, 0.035, 1, 1, 1);
        var tinyGeo = new THREE.BoxGeometry(0.18, 0.014, 0.036, 1, 1, 1);
        var grooveGeo = new THREE.BoxGeometry(2.15, 0.009, 0.026, 1, 1, 1);
        var slabs = [];
        var focusHalos = [];

        colors.forEach(function (color, index) {
            var colorObj = new THREE.Color(color);
            var slabMat = material({
                color: color,
                opacity: 0.24 + index * 0.045,
                metalness: 0.02
            });
            var slab = new THREE.Mesh(slabGeo, slabMat);
            slab.position.set((index - 1.5) * 0.11, (index - 1.5) * 0.06, (index - 1.5) * 0.15);
            slab.rotation.set(-0.18, 0.08, -0.11 + index * 0.035);
            slab.userData.base = {
                x: slab.position.x,
                y: slab.position.y,
                z: slab.position.z,
                rz: slab.rotation.z
            };
            packageRig.add(slab);
            slabs.push(slab);

            var edge = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({
                color: 0xfff3dc,
                transparent: true,
                opacity: 0.28
            }));
            slab.add(edge);

            [-1, 1].forEach(function (side) {
                var foil = new THREE.Mesh(foilGeo, new THREE.MeshBasicMaterial({
                    color: color,
                    transparent: true,
                    opacity: 0.36
                }));
                foil.position.x = side * 1.58;
                foil.position.y = 0.016;
                slab.add(foil);
            });

            var lineMat = new THREE.MeshBasicMaterial({
                color: 0xfff3dc,
                transparent: true,
                opacity: 0.38
            });

            for (var i = 0; i < 7; i += 1) {
                var lineMaterial = lineMat.clone();
                lineMaterial.opacity = i < 4 ? 0.38 : 0.16;
                var line = new THREE.Mesh(i === 0 ? tinyGeo : (i < 4 ? lineGeo : grooveGeo), lineMaterial);
                line.position.set(-1.18 + i * 0.23, 0.037, -0.54 + i * 0.15);
                line.rotation.x = -Math.PI / 2;
                slab.add(line);
            }

            var labelRing = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.008, 8, 52), new THREE.MeshBasicMaterial({
                color: colorObj.lerp(new THREE.Color(0xfff3dc), 0.35),
                transparent: true,
                opacity: 0.52
            }));
            labelRing.position.set(1.02, 0.039, 0.42);
            labelRing.rotation.x = Math.PI / 2;
            slab.add(labelRing);

            var halo = new THREE.Mesh(new THREE.TorusGeometry(1.68, 0.014, 8, weakDevice ? 80 : 132), new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: 0,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            }));
            halo.position.y = 0.044;
            halo.rotation.x = Math.PI / 2;
            halo.scale.z = 0.54;
            slab.add(halo);
            focusHalos.push(halo);
        });

        packageRig.rotation.set(0.72, -0.16, -0.1);
        packageRig.position.set(0, -0.02, 0);

        var discMat = new THREE.MeshStandardMaterial({
            color: 0x0b0c0d,
            roughness: 0.36,
            metalness: 0.5,
            transparent: true,
            opacity: 0.72
        });
        var ringMat = new THREE.MeshBasicMaterial({
            color: 0xfff0d2,
            transparent: true,
            opacity: 0.16
        });
        var accentMat = new THREE.MeshBasicMaterial({
            color: 0x8fe0c5,
            transparent: true,
            opacity: 0.34
        });

        var disc = new THREE.Mesh(new THREE.CylinderGeometry(1.38, 1.38, 0.035, weakDevice ? 96 : 160), discMat);
        disc.rotation.x = Math.PI / 2;
        disc.position.z = -0.16;
        recordRig.add(disc);

        var labelDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.04, weakDevice ? 48 : 96), new THREE.MeshBasicMaterial({
            color: 0xfff0d2,
            transparent: true,
            opacity: 0.18
        }));
        labelDisc.rotation.x = Math.PI / 2;
        labelDisc.position.z = -0.11;
        recordRig.add(labelDisc);

        [0.42, 0.58, 0.76, 0.94, 1.12, 1.34, 1.52, 1.68].forEach(function (radius, index) {
            var torus = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.006 + index * 0.002, 8, weakDevice ? 96 : 180), index === 1 ? accentMat : ringMat);
            torus.rotation.x = Math.PI / 2;
            torus.position.z = -0.13 - index * 0.006;
            recordRig.add(torus);
        });

        recordRig.rotation.set(0.7, -0.28, 0.08);
        recordRig.position.set(0.2, -0.2, -0.65);

        var particleCount = weakDevice ? 120 : 320;
        var particleGeo = new THREE.BufferGeometry();
        var particlePos = new Float32Array(particleCount * 3);
        var particleColor = new Float32Array(particleCount * 3);
        var particlePhase = new Float32Array(particleCount);
        var palette = [
            new THREE.Color(0xfff0d2),
            new THREE.Color(0x8fe0c5),
            new THREE.Color(0x82a8ff),
            new THREE.Color(0xf49a91)
        ];

        for (var p = 0; p < particleCount; p += 1) {
            var angle = Math.random() * Math.PI * 2;
            var radius = 2.1 + Math.random() * 3.2;
            var height = (Math.random() - 0.5) * 2.2;
            particlePos[p * 3] = Math.cos(angle) * radius;
            particlePos[p * 3 + 1] = height;
            particlePos[p * 3 + 2] = Math.sin(angle) * radius * 0.62;
            var c = palette[Math.floor(Math.random() * palette.length)];
            particleColor[p * 3] = c.r;
            particleColor[p * 3 + 1] = c.g;
            particleColor[p * 3 + 2] = c.b;
            particlePhase[p] = Math.random() * Math.PI * 2;
        }

        particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
        particleGeo.setAttribute('color', new THREE.BufferAttribute(particleColor, 3));

        var particleMat = new THREE.PointsMaterial({
            size: weakDevice ? 0.016 : 0.021,
            vertexColors: true,
            transparent: true,
            opacity: 0.54,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        var particles = new THREE.Points(particleGeo, particleMat);
        accentRig.add(particles);

        var ribbonCount = weakDevice ? 90 : 150;
        var ribbonGeo = new THREE.BufferGeometry();
        var ribbonPos = new Float32Array(ribbonCount * 3);
        ribbonGeo.setAttribute('position', new THREE.BufferAttribute(ribbonPos, 3));
        var ribbon = new THREE.Line(ribbonGeo, new THREE.LineBasicMaterial({
            color: 0xfff0d2,
            transparent: true,
            opacity: 0.2
        }));
        accentRig.add(ribbon);

        var causticLines = [];
        var causticCount = weakDevice ? 4 : 8;
        var causticPoints = weakDevice ? 70 : 120;
        for (var cLine = 0; cLine < causticCount; cLine += 1) {
            var causticGeo = new THREE.BufferGeometry();
            causticGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(causticPoints * 3), 3));
            var causticMat = new THREE.LineBasicMaterial({
                color: colors[cLine % colors.length],
                transparent: true,
                opacity: 0.08,
                blending: THREE.AdditiveBlending,
                depthWrite: false
            });
            var caustic = new THREE.Line(causticGeo, causticMat);
            caustic.rotation.z = (cLine - causticCount / 2) * 0.035;
            accentRig.add(caustic);
            causticLines.push({ line: caustic, geo: causticGeo, phase: cLine * 0.7 });
        }

        var shardCount = weakDevice ? 10 : 24;
        var shards = [];
        var shardGeo = new THREE.TetrahedronGeometry(0.045, 0);
        for (var sh = 0; sh < shardCount; sh += 1) {
            var shardMat = new THREE.MeshBasicMaterial({
                color: colors[sh % colors.length],
                transparent: true,
                opacity: 0.18,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            var shard = new THREE.Mesh(shardGeo, shardMat);
            shard.userData = {
                angle: Math.random() * Math.PI * 2,
                radius: 1.5 + Math.random() * 2.7,
                y: -0.9 + Math.random() * 1.8,
                spin: 0.4 + Math.random() * 1.2,
                tier: tierNames[sh % tierNames.length]
            };
            accentRig.add(shard);
            shards.push(shard);
        }

        var cursorOrb = new THREE.Mesh(new THREE.SphereGeometry(0.055, weakDevice ? 16 : 24, weakDevice ? 8 : 12), new THREE.MeshBasicMaterial({
            color: 0xfff0d2,
            transparent: true,
            opacity: 0.34,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        }));
        var cursorLight = new THREE.PointLight(0x8fe0c5, 0.55, 4.8);
        accentRig.add(cursorOrb);
        scene.add(cursorLight);

        var tierBeacons = [];
        tierNames.forEach(function (tier, index) {
            var beacon = new THREE.Mesh(new THREE.RingGeometry(0.16, 0.19, weakDevice ? 32 : 48), new THREE.MeshBasicMaterial({
                color: colors[index],
                transparent: true,
                opacity: 0,
                side: THREE.DoubleSide,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            }));
            beacon.rotation.x = Math.PI / 2;
            beacon.position.set((index - 1.5) * 0.62, -0.82, 0.62);
            accentRig.add(beacon);
            tierBeacons.push(beacon);
        });

        var mouse = { x: 0, y: 0, sx: 0, sy: 0 };
        var scroll = { hero: 0, pricing: 0 };
        var activeTier = '';
        var openingTier = '';
        var openingStarted = 0;
        var openingProgress = 0;
        var clock = 0;
        var last = 0;
        var paused = false;

        function clamp(value, min, max) {
            return Math.min(max, Math.max(min, value));
        }

        function updateScroll() {
            var y = window.scrollY || window.pageYOffset || 0;
            scroll.hero = clamp(y / Math.max(window.innerHeight * 1.15, 1), 0, 1);

            var pricing = document.getElementById('pricing');
            if (pricing) {
                var rect = pricing.getBoundingClientRect();
                scroll.pricing = clamp(1 - rect.top / Math.max(window.innerHeight * 0.92, 1), 0, 1);
            }
        }

        function updateRibbon(t) {
            var pos = ribbonGeo.attributes.position.array;
            for (var i = 0; i < ribbonCount; i += 1) {
                var pct = i / (ribbonCount - 1);
                var a = pct * Math.PI * 2;
                var radius = 2.35 + Math.sin(a * 3 + t * 0.7) * 0.08;
                pos[i * 3] = Math.cos(a) * radius;
                pos[i * 3 + 1] = Math.sin(a * 2 + t * 0.55) * 0.2;
                pos[i * 3 + 2] = Math.sin(a) * radius * 0.48;
            }
            ribbonGeo.attributes.position.needsUpdate = true;
        }

        function updateCaustics(t, activeBoost) {
            for (var c = 0; c < causticLines.length; c += 1) {
                var item = causticLines[c];
                var pos = item.geo.attributes.position.array;
                var half = 3.2;
                for (var i = 0; i < causticPoints; i += 1) {
                    var pct = i / (causticPoints - 1);
                    var x = -half + pct * half * 2;
                    var wave = Math.sin(x * 1.9 + t * 0.7 + item.phase) * 0.08;
                    wave += Math.sin(x * 4.1 - t * 0.42 + item.phase) * 0.025;
                    pos[i * 3] = x;
                    pos[i * 3 + 1] = -0.15 + (c - causticLines.length / 2) * 0.055 + wave;
                    pos[i * 3 + 2] = -0.65 + Math.sin(pct * Math.PI) * 0.4;
                }
                item.geo.attributes.position.needsUpdate = true;
                item.line.material.opacity = 0.045 + activeBoost * 0.08 + scroll.pricing * 0.035;
            }
        }

        function renderFrame(timestamp) {
            if (paused) return;
            if (!last) last = timestamp;
            var dt = Math.min((timestamp - last) / 1000, 0.08);
            last = timestamp;
            clock += dt;

            updateScroll();

            mouse.sx += (mouse.x - mouse.sx) * 0.045;
            mouse.sy += (mouse.y - mouse.sy) * 0.045;

            var heroOut = scroll.hero;
            var pricingIn = scroll.pricing;
            var mobileScale = isMobile ? 0.78 : 1;
            var activeIndex = tierNames.indexOf(activeTier);
            if (openingTier) {
                openingProgress = clamp((timestamp - openingStarted) / 720, 0, 1);
            } else {
                openingProgress += (0 - openingProgress) * 0.08;
            }
            var openEase = 1 - Math.pow(1 - openingProgress, 3);
            if (openingProgress >= 1 && openingTier) {
                openingTier = '';
            }

            rig.scale.setScalar(mobileScale * (1 - heroOut * 0.06 + pricingIn * 0.04));
            rig.position.y = 0.05 + heroOut * 0.72 - pricingIn * 0.48;
            rig.position.x = mouse.sx * (isMobile ? 0.03 : 0.12);
            rig.rotation.y = mouse.sx * 0.16 + Math.sin(clock * 0.18) * 0.07 + pricingIn * 0.18;
            rig.rotation.x = -mouse.sy * 0.08 + pricingIn * 0.04;

            packageRig.rotation.x = 0.72 + Math.sin(clock * 0.34) * 0.025 - pricingIn * 0.12;
            packageRig.rotation.y = -0.16 + mouse.sx * 0.06 + pricingIn * 0.22;
            packageRig.rotation.z = -0.1 + Math.sin(clock * 0.27) * 0.025;
            packageRig.position.y = -0.02 + Math.sin(clock * 0.42) * 0.035;

            slabs.forEach(function (slab, index) {
                var base = slab.userData.base;
                var fan = (index - 1.5);
                var tier = tierNames[index];
                var isActive = tier === activeTier ? 1 : 0;
                var isOpening = tier === openingTier ? openEase : 0;
                var otherFade = openingTier && tier !== openingTier ? openEase : 0;

                slab.position.x = base.x + fan * pricingIn * 0.88 + fan * isOpening * 0.16;
                slab.position.y = base.y + Math.sin(clock * 0.8 + index) * 0.018 + Math.abs(fan) * pricingIn * 0.075 + isActive * 0.16 + isOpening * 0.28;
                slab.position.z = base.z + fan * pricingIn * 0.22 + isActive * 0.24 + isOpening * 3.15;
                slab.rotation.x = -0.18 - isOpening * 0.1;
                slab.rotation.y = 0.08 + isActive * 0.08 + isOpening * 0.34;
                slab.rotation.z = base.rz + fan * pricingIn * 0.13 + Math.sin(clock * 0.38 + index) * 0.012 + isActive * 0.035 - isOpening * 0.16;
                slab.scale.setScalar(1 + isActive * 0.055 + isOpening * 0.42);
                slab.material.opacity = Math.max(0.08, 0.25 + index * 0.045 + pricingIn * 0.11 + isActive * 0.12 + isOpening * 0.24 - otherFade * 0.22);
                if (focusHalos[index]) {
                    focusHalos[index].material.opacity = 0.05 + isActive * 0.34 + isOpening * 0.42;
                    focusHalos[index].scale.x = 1.02 + isActive * 0.08 + isOpening * 0.22;
                    focusHalos[index].scale.y = 1.02 + isActive * 0.08 + isOpening * 0.22;
                }
            });

            recordRig.rotation.z += dt * 0.1;
            recordRig.position.x = 0.2 - pricingIn * 0.34;
            recordRig.position.y = -0.2 - pricingIn * 0.22;
            recordRig.scale.setScalar(1 - pricingIn * 0.08);

            var positions = particleGeo.attributes.position.array;
            for (var p = 0; p < particleCount; p += 1) {
                var phase = particlePhase[p];
                positions[p * 3 + 1] += Math.sin(clock * 0.6 + phase) * 0.0009;
            }
            particleGeo.attributes.position.needsUpdate = true;
            particles.rotation.y = clock * 0.035 - mouse.sx * 0.05;
            particles.rotation.x = mouse.sy * 0.03;
            particleMat.opacity = weakDevice ? 0.34 : 0.48;

            updateRibbon(clock);
            ribbon.rotation.y = -clock * 0.05;
            ribbon.material.opacity = 0.12 + pricingIn * 0.16;
            updateCaustics(clock, activeIndex >= 0 ? 1 : 0);

            shards.forEach(function (shard, index) {
                var data = shard.userData;
                var shardActive = data.tier === activeTier ? 1 : 0;
                var shardOpening = data.tier === openingTier ? openEase : 0;
                var orbit = data.angle + clock * (0.08 + index * 0.001);
                var radius = data.radius + shardActive * 0.28 + shardOpening * 1.1;
                shard.position.x = Math.cos(orbit) * radius;
                shard.position.y = data.y + Math.sin(clock * 0.75 + index) * 0.08 + shardOpening * 0.42;
                shard.position.z = Math.sin(orbit) * radius * 0.45 + shardOpening * 1.35;
                shard.rotation.x += dt * data.spin;
                shard.rotation.y += dt * data.spin * 0.7;
                shard.material.opacity = 0.12 + shardActive * 0.18 + shardOpening * 0.42 + pricingIn * 0.04;
                shard.scale.setScalar(1 + shardActive * 0.7 + shardOpening * 2.2);
            });

            tierBeacons.forEach(function (beacon, index) {
                var isActive = index === activeIndex ? 1 : 0;
                beacon.material.opacity = 0.04 + pricingIn * 0.08 + isActive * 0.42;
                beacon.scale.setScalar(1 + Math.sin(clock * 1.6 + index) * 0.04 + isActive * 0.55);
                beacon.rotation.z -= dt * (0.22 + index * 0.05);
            });

            cursorOrb.position.x += (mouse.sx * 2.8 - cursorOrb.position.x) * 0.07;
            cursorOrb.position.y += (-mouse.sy * 1.55 - cursorOrb.position.y) * 0.07;
            cursorOrb.position.z = 1.12 + Math.sin(clock * 0.8) * 0.08;
            cursorOrb.material.opacity = isMobile ? 0.12 : 0.28 + (activeIndex >= 0 ? 0.18 : 0);
            cursorOrb.scale.setScalar(1 + (activeIndex >= 0 ? 0.5 : 0));
            cursorLight.position.set(cursorOrb.position.x, cursorOrb.position.y, 3.2);
            cursorLight.intensity = isMobile ? 0.18 : 0.45 + (activeIndex >= 0 ? 0.45 : 0);
            cursorLight.color.set(activeIndex >= 0 ? colors[activeIndex] : 0x8fe0c5);

            camera.position.x = mouse.sx * (isMobile ? 0.1 : 0.24);
            camera.position.y = (isMobile ? 0.18 : 0.28) - mouse.sy * 0.12 + heroOut * 0.12;
            camera.lookAt(0, 0, 0);

            canvas.style.opacity = String(0.82 - heroOut * 0.24 + pricingIn * 0.08);
            renderer.render(scene, camera);

            if (!reduceMotion) requestAnimationFrame(renderFrame);
        }

        function onPointerMove(event) {
            mouse.x = (event.clientX / Math.max(window.innerWidth, 1)) * 2 - 1;
            mouse.y = (event.clientY / Math.max(window.innerHeight, 1)) * 2 - 1;
        }

        function resize() {
            isMobile = window.innerWidth < 768;
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.position.z = isMobile ? 9.4 : 8.1;
            camera.updateProjectionMatrix();
            renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, weakDevice ? 1.15 : 1.55));
            renderer.setSize(window.innerWidth, window.innerHeight);
            updateScroll();
        }

        window.addEventListener('pointermove', onPointerMove, { passive: true });
        window.addEventListener('scroll', updateScroll, { passive: true });
        window.addEventListener('resize', resize, { passive: true });
        document.addEventListener('visibilitychange', function () {
            paused = document.hidden;
            if (!paused && !reduceMotion) {
                last = 0;
                requestAnimationFrame(renderFrame);
            }
        });

        window.nickeno3D = {
            setActiveTier: function (tier) {
                activeTier = tier || '';
            },
            clearActiveTier: function () {
                activeTier = '';
            },
            openTier: function (tier) {
                activeTier = tier || '';
                openingTier = tier || '';
                openingStarted = performance.now();
                openingProgress = 0;
            }
        };

        resize();
        requestAnimationFrame(renderFrame);
    }
})();
