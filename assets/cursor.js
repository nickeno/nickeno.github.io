
(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var isTouch = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    if (reduceMotion || isTouch || window.innerWidth < 768) return;

    var canvas = document.createElement('canvas');
    canvas.id = 'cursor-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999;';

    var ctx = canvas.getContext('2d');
    var dpr = 1, w = 0, h = 0;

    function resize() {
        dpr = Math.min(window.devicePixelRatio || 1, 2);
        w = window.innerWidth;
        h = window.innerHeight;
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    var mx = 0, my = 0;
    var dx = 0, dy = 0;
    var rx = 0, ry = 0;
    var pmx = 0, pmy = 0;
    var vx = 0, vy = 0;
    var speed = 0;
    var ringScale = 1, targetRingScale = 1;
    var dotScale  = 1, targetDotScale  = 1;
    var alpha = 0, targetAlpha = 0;
    var clickPulse = 0, clickRad = 0;
    var hovering = false, hoverColor = null;
    var initialized = false;

    var TIER_COLORS = {
        basic:     [143, 224, 197],
        pro:       [130, 168, 255],
        unlimited: [216, 167, 95],
        exclusive: [244, 154, 145]
    };

    function lerp(a, b, t) { return a + (b - a) * t; }

    function checkHover() {
        var el = document.elementFromPoint(mx, my);
        if (!el) { hovering = false; hoverColor = null; return; }
        var interactive = el.closest('a, button, [data-magnetic], label, .nav-link, .email-link');
        hovering = !!interactive;
        var card = el.closest('[data-tier]');
        hoverColor = card ? (TIER_COLORS[card.getAttribute('data-tier')] || null) : null;
    }

    window.addEventListener('pointermove', function (e) {
        if (!initialized) { dx = rx = pmx = e.clientX; dy = ry = pmy = e.clientY; initialized = true; }
        mx = e.clientX;
        my = e.clientY;
        targetAlpha = 1;
        checkHover();
    }, { passive: true });

    window.addEventListener('pointerleave', function () { targetAlpha = 0; }, { passive: true });

    document.addEventListener('pointerdown', function () {
        clickPulse = 1;
        clickRad = ringScale * 20;
        targetDotScale = 0.45;
    }, { passive: true });

    document.addEventListener('pointerup', function () {
        targetDotScale = hovering ? 0 : 1;
    }, { passive: true });

    function frame() {
        requestAnimationFrame(frame);

        dx = lerp(dx, mx, 0.54);
        dy = lerp(dy, my, 0.54);
        rx = lerp(rx, mx, 0.088);
        ry = lerp(ry, my, 0.088);

        var rawVx = mx - pmx;
        var rawVy = my - pmy;
        pmx = lerp(pmx, mx, 0.28);
        pmy = lerp(pmy, my, 0.28);
        vx = lerp(vx, rawVx, 0.22);
        vy = lerp(vy, rawVy, 0.22);
        speed = lerp(speed, Math.sqrt(rawVx * rawVx + rawVy * rawVy), 0.25);

        targetRingScale = hovering ? 1.85 : 1.0;
        ringScale = lerp(ringScale, targetRingScale, 0.10);
        if (!hovering) targetDotScale = 1.0;
        dotScale  = lerp(dotScale,  targetDotScale,  0.14);

        alpha = lerp(alpha, targetAlpha, 0.09);

        if (clickPulse > 0.008) {
            clickPulse = lerp(clickPulse, 0, 0.09);
            clickRad   = lerp(clickRad, 42, 0.12);
        } else {
            clickPulse = 0;
            clickRad   = lerp(clickRad, 0, 0.18);
        }

        var a = Math.min(1, alpha);
        ctx.clearRect(0, 0, w, h);
        if (a < 0.015) return;

        var caStrength = Math.min(speed * 0.21, 7.5);
        var caAngle    = Math.atan2(vy || 0.001, vx || 0.001);
        var cax = Math.cos(caAngle) * caStrength;
        var cay = Math.sin(caAngle) * caStrength;

        var ringR  = 20 * ringScale;
        var dotR   = 3.2 * Math.max(0.2, dotScale);
        var rc     = hoverColor || [248, 240, 220];

        if (ringR > 0.5) {

            if (caStrength > 0.6) {
                var caA = Math.min(0.58, caStrength / 11) * a;

                ctx.beginPath();
                ctx.arc(rx + cax * 1.28, ry + cay * 1.28, ringR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255,55,85,' + (caA * 0.6) + ')';
                ctx.lineWidth = 1.1;
                ctx.stroke();

                ctx.beginPath();
                ctx.arc(rx - cax * 1.28, ry - cay * 1.28, ringR, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(65,110,255,' + (caA * 0.6) + ')';
                ctx.lineWidth = 1.1;
                ctx.stroke();
            }

            if (hovering) {
                ctx.beginPath();
                ctx.arc(rx, ry, ringR + 1, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(' + rc[0] + ',' + rc[1] + ',' + rc[2] + ',' + (0.16 * a) + ')';
                ctx.lineWidth = 7;
                ctx.stroke();
            }

            ctx.beginPath();
            ctx.arc(rx, ry, ringR, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(' + rc[0] + ',' + rc[1] + ',' + rc[2] + ',' + (0.76 * a) + ')';
            ctx.lineWidth = hovering ? 1.4 : 1.0;
            ctx.stroke();
        }

        if (clickPulse > 0.04 && clickRad > 1) {
            ctx.beginPath();
            ctx.arc(rx, ry, clickRad, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(' + rc[0] + ',' + rc[1] + ',' + rc[2] + ',' + (clickPulse * 0.32 * a) + ')';
            ctx.lineWidth = 1;
            ctx.stroke();
        }

        if (dotR > 0.3) {

            var glowSize = dotR * 4.5;
            var grad = ctx.createRadialGradient(dx, dy, 0, dx, dy, glowSize);
            grad.addColorStop(0,   'rgba(248,240,220,' + (0.20 * a) + ')');
            grad.addColorStop(0.4, 'rgba(248,240,220,' + (0.08 * a) + ')');
            grad.addColorStop(1,   'rgba(0,0,0,0)');
            ctx.beginPath();
            ctx.arc(dx, dy, glowSize, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();

            ctx.beginPath();
            ctx.arc(dx, dy, dotR, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(248,240,220,' + (0.96 * a) + ')';
            ctx.fill();
        }
    }

    function init() {
        document.body.appendChild(canvas);
        resize();
        window.addEventListener('resize', resize, { passive: true });
        document.documentElement.classList.add('has-custom-cursor');
        requestAnimationFrame(frame);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
