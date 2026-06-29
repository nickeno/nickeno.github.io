
(function () {
    'use strict';

    var ctx = null;
    var masterGain = null;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) return;

    function initAudio() {
        if (ctx) return;
        try {
            ctx = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) { return; }

        masterGain = ctx.createGain();
        masterGain.gain.setValueAtTime(1, ctx.currentTime);
        masterGain.connect(ctx.destination);

        window.nickenoAudio = api;
    }

    function ping(freq, vol, duration) {
        if (!ctx || !masterGain) return;
        var osc  = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(vol, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(ctx.currentTime);
        osc.stop(ctx.currentTime + duration);
    }

    function softClick() {
        if (!ctx || !masterGain) return;

        var buffer = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
        var data   = buffer.getChannelData(0);
        for (var i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * 0.28;
        var src    = ctx.createBufferSource();
        var filt   = ctx.createBiquadFilter();
        var gain   = ctx.createGain();
        filt.type  = 'bandpass';
        filt.frequency.setValueAtTime(2800, ctx.currentTime);
        filt.Q.setValueAtTime(4, ctx.currentTime);
        gain.gain.setValueAtTime(0.18, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.04);
        src.buffer = buffer;
        src.connect(filt);
        filt.connect(gain);
        gain.connect(masterGain);
        src.start(ctx.currentTime);
    }

    var tierPings = {
        basic:     1046.50,
        pro:       1174.66,
        unlimited: 1318.51,
        exclusive: 1567.98
    };

    var navPingFreq = 880;

    var api = {
        pingTier: function (tier) {
            var f = tierPings[tier];
            if (f) ping(f, 0.06, 0.38);
        },
        pingNav: function () {
            ping(navPingFreq, 0.04, 0.28);
        },
        click: function () {
            softClick();
        }
    };

    function attachHooks() {

        document.querySelectorAll('[data-tier]').forEach(function (card) {
            var tier = card.getAttribute('data-tier');
            card.addEventListener('mouseenter', function () {
                initAudio();
                if (window.nickenoAudio) window.nickenoAudio.pingTier(tier);
            });
        });

        document.querySelectorAll('.nav-link, .footer-links a').forEach(function (link) {
            link.addEventListener('mouseenter', function () {
                initAudio();
                if (window.nickenoAudio) window.nickenoAudio.pingNav();
            });
        });

        document.querySelectorAll('a, button').forEach(function (el) {
            el.addEventListener('pointerdown', function () {
                initAudio();
                if (window.nickenoAudio) window.nickenoAudio.click();
            }, { passive: true });
        });
    }

    function firstTouch() {
        initAudio();
        document.removeEventListener('pointerdown', firstTouch);
        document.removeEventListener('keydown', firstTouch);
    }
    document.addEventListener('pointerdown', firstTouch, { passive: true });
    document.addEventListener('keydown', firstTouch);

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', attachHooks);
    } else {
        attachHooks();
    }
})();
