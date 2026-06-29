(function () {
    'use strict';

    var TRANSITION_KEY = 'nickeno-page-transition';
    var INTRO_KEY = 'nickeno-intro-seen';
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var scriptSrc = document.currentScript && document.currentScript.src;
    var assetBase = scriptSrc ? new URL('.', scriptSrc).href : new URL('assets/', window.location.href).href;
    var transitionSoundIndex = Math.random() < 0.5 ? 0 : 1;
    var transitionSounds = [
        new URL('sounds/transition-subtle-01.mp3', assetBase).href,
        new URL('sounds/transition-subtle-02.mp3', assetBase).href
    ];

    function ready(fn) {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', fn);
        } else {
            fn();
        }
    }

    function cssVar(element, name, fallback) {
        var value = window.getComputedStyle(element).getPropertyValue(name).trim();
        return value || fallback;
    }

    function waitForWindowLoad() {
        if (document.readyState === 'complete') return Promise.resolve();
        return new Promise(function (resolve) {
            window.addEventListener('load', resolve, { once: true });
        });
    }

    function waitForFonts() {
        if (!document.fonts || !document.fonts.ready) return Promise.resolve();
        return document.fonts.ready.catch(function () {});
    }

    function waitForMedia(media, timeout) {
        if (!media) return Promise.resolve();
        if (media.readyState >= 3) return Promise.resolve();

        return new Promise(function (resolve) {
            var done = false;
            var timer = window.setTimeout(finish, timeout || 1600);

            function finish() {
                if (done) return;
                done = true;
                window.clearTimeout(timer);
                media.removeEventListener('canplaythrough', finish);
                media.removeEventListener('loadeddata', finish);
                media.removeEventListener('error', finish);
                resolve();
            }

            media.addEventListener('canplaythrough', finish);
            media.addEventListener('loadeddata', finish);
            media.addEventListener('error', finish);
            try { media.load(); } catch (error) {}
        });
    }

    function waitForWebGLScene(timeout) {
        if (document.documentElement.classList.contains('has-nickeno-webgl')) return Promise.resolve();

        return new Promise(function (resolve) {
            var done = false;
            var timer = window.setTimeout(finish, timeout || 2200);
            var observer = new MutationObserver(function () {
                if (document.documentElement.classList.contains('has-nickeno-webgl')) finish();
            });

            function finish() {
                if (done) return;
                done = true;
                window.clearTimeout(timer);
                observer.disconnect();
                resolve();
            }

            observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
        });
    }

    function delay(ms) {
        return new Promise(function (resolve) {
            window.setTimeout(resolve, ms);
        });
    }

    function getTransitionData() {
        try {
            var raw = window.sessionStorage.getItem(TRANSITION_KEY);
            if (!raw) return null;
            var data = JSON.parse(raw);
            if (!data || Date.now() - data.createdAt > 8000) {
                window.sessionStorage.removeItem(TRANSITION_KEY);
                return null;
            }
            return data;
        } catch (error) {
            return null;
        }
    }

    function setTransitionData(data) {
        try {
            window.sessionStorage.setItem(TRANSITION_KEY, JSON.stringify(data));
        } catch (error) {}
    }

    function clearTransitionData() {
        try {
            window.sessionStorage.removeItem(TRANSITION_KEY);
        } catch (error) {}
    }

    function hasForcedIntro() {
        return /(?:\?|&)intro=1(?:&|$)/.test(window.location.search);
    }

    function hasRecentTransitionData() {
        return !!getTransitionData();
    }

    function markIntroSeen() {
        try {
            window.sessionStorage.setItem(INTRO_KEY, String(Date.now()));
        } catch (error) {}
    }

    function shouldRunStartupIntro() {
        if (document.body.getAttribute('data-page') !== 'home') return false;
        if (reduceMotion) return false;
        if (hasRecentTransitionData()) return false;
        if (window.location.hash && !hasForcedIntro()) return false;

        try {
            if (!hasForcedIntro() && window.sessionStorage.getItem(INTRO_KEY)) return false;
        } catch (error) {}

        return !!document.getElementById('intro-overlay');
    }

    function setupStartupIntro() {
        var root = document.documentElement;
        var overlay = document.getElementById('intro-overlay');
        if (!overlay) return;

        if (!shouldRunStartupIntro()) {
            root.classList.remove('intro-pending', 'intro-playing');
            overlay.setAttribute('aria-hidden', 'true');
            return;
        }

        var audio = document.getElementById('intro-audio');
        var noteMark = overlay.querySelector('.intro-note-mark');
        var letters = overlay.querySelectorAll('.intro-word span');
        var bg = overlay.querySelector('.intro-bg');
        var rule = overlay.querySelector('.intro-rule');
        var started = false;
        var finished = false;
        var requestedStart = false;
        var readyToStart = false;
        var fallbackTimers = [];
        var noteMotion = {
            raf: 0,
            x: 0,
            y: 0,
            targetX: 0,
            targetY: 0,
            active: false
        };

        root.classList.add('intro-pending');
        overlay.classList.add('intro-loading');
        overlay.setAttribute('aria-hidden', 'false');
        window.requestAnimationFrame(function () {
            try {
                overlay.focus({ preventScroll: true });
            } catch (error) {
                try { overlay.focus(); } catch (focusError) {}
            }
        });

        function clearFallbackTimers() {
            fallbackTimers.forEach(function (timer) {
                window.clearTimeout(timer);
            });
            fallbackTimers = [];
        }

        function finishIntro() {
            if (finished) return;
            finished = true;
            clearFallbackTimers();
            markIntroSeen();
            root.classList.remove('intro-pending', 'intro-playing');
            overlay.classList.remove('intro-loading', 'intro-armed', 'intro-title', 'intro-running', 'intro-finishing');
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.pointerEvents = 'none';
            document.removeEventListener('pointerdown', requestStart);
            document.removeEventListener('pointermove', moveIntroNote);
            window.removeEventListener('pointerleave', resetIntroNote);
            document.removeEventListener('keydown', handleKeydown);
            resetIntroNote();
            stopIntroNoteMotion();
            if (audio) {
                try {
                    audio.pause();
                    audio.currentTime = 0;
                } catch (error) {}
            }
            window.setTimeout(function () {
                if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
            }, 520);
        }

        function startTimeline() {
            if (typeof gsap !== 'undefined') {
                var stage = overlay.querySelector('.intro-stage');
                var tweenTargets = [overlay, bg, rule, stage].concat(Array.prototype.slice.call(letters)).filter(Boolean);
                gsap.killTweensOf(tweenTargets);
                gsap.set(overlay, { autoAlpha: 1, clipPath: 'inset(0 0 0 0)', filter: 'blur(0px)' });
                gsap.set(stage, { opacity: 1, y: 0, scale: 1 });
                gsap.set(bg, { opacity: 0, scale: 1.03 });
                gsap.set(rule, { opacity: 0, scaleX: 0, transformOrigin: '50% 50%' });
                gsap.set(letters, {
                    opacity: 0,
                    y: 62,
                    rotationX: -76,
                    scale: 0.86,
                    filter: 'blur(18px)',
                    transformOrigin: '50% 75%',
                    transformPerspective: 900
                });

                var loader = overlay.querySelector('.intro-loader');
                fallbackTimers.push(window.setTimeout(finishIntro, 5900));
                gsap.timeline()
                    .to(bg, { opacity: 1, scale: 1, duration: 1.25, ease: 'power2.out' }, 0.08)
                    .to(loader, { opacity: 0, y: -42, scale: 0.86, filter: 'blur(10px)', duration: 1.08, ease: 'power3.inOut' }, 0)
                    .to(letters, {
                        opacity: 1,
                        y: 0,
                        rotationX: 0,
                        scale: 1,
                        filter: 'blur(0px)',
                        duration: 1.24,
                        ease: 'expo.out',
                        stagger: 0.108
                    }, 0.72)
                    .to(rule, { opacity: 1, scaleX: 1, duration: 1.05, ease: 'power3.inOut' }, 1.96)
                    .to(letters, {
                        y: -2,
                        duration: 0.48,
                        ease: 'sine.inOut',
                        stagger: { each: 0.032, yoyo: true, repeat: 1 }
                    }, 2.72)
                    .to(overlay, {
                        clipPath: 'inset(100% 0 0 0)',
                        opacity: 0,
                        filter: 'blur(14px)',
                        duration: 1.58,
                        ease: 'power4.inOut'
                    }, 3.95);
                return;
            }

            overlay.classList.add('intro-title');
            overlay.classList.add('intro-running');
            fallbackTimers.push(window.setTimeout(function () {
                overlay.classList.add('intro-finishing');
            }, 3950));
            fallbackTimers.push(window.setTimeout(finishIntro, 5600));
        }

        function beginIntro() {
            if (started) return;
            started = true;
            resetIntroNote();
            overlay.classList.remove('intro-loading');
            overlay.classList.add('intro-title', 'intro-running');
            root.classList.remove('intro-pending');
            root.classList.add('intro-playing');
            startTimeline();
        }

        function playAudio() {
            if (!audio) return;
            try {
                audio.volume = 0.76;
                audio.currentTime = 0;
                var playPromise = audio.play();
                if (playPromise && typeof playPromise.catch === 'function') playPromise.catch(function () {});
            } catch (error) {}
        }

        function beginWhenReady() {
            playAudio();
            beginIntro();
        }

        function resetIntroNote() {
            if (!noteMark) return;
            noteMark.classList.remove('is-magnetic');
            noteMotion.targetX = 0;
            noteMotion.targetY = 0;
            startIntroNoteMotion();
        }

        function stopIntroNoteMotion() {
            if (noteMotion.raf) window.cancelAnimationFrame(noteMotion.raf);
            noteMotion.raf = 0;
            noteMotion.x = 0;
            noteMotion.y = 0;
            noteMotion.targetX = 0;
            noteMotion.targetY = 0;
            if (noteMark) {
                noteMark.style.setProperty('--intro-note-x', '0px');
                noteMark.style.setProperty('--intro-note-y', '0px');
            }
        }

        function startIntroNoteMotion() {
            if (!noteMark || noteMotion.raf || started || finished) return;

            function tick() {
                var ease = 0.055;
                noteMotion.x += (noteMotion.targetX - noteMotion.x) * ease;
                noteMotion.y += (noteMotion.targetY - noteMotion.y) * ease;

                if (Math.abs(noteMotion.targetX) < 0.01 && Math.abs(noteMotion.targetY) < 0.01 &&
                    Math.abs(noteMotion.x) < 0.08 && Math.abs(noteMotion.y) < 0.08) {
                    noteMotion.x = 0;
                    noteMotion.y = 0;
                    noteMark.style.setProperty('--intro-note-x', '0px');
                    noteMark.style.setProperty('--intro-note-y', '0px');
                    noteMotion.raf = 0;
                    return;
                }

                noteMark.style.setProperty('--intro-note-x', noteMotion.x.toFixed(2) + 'px');
                noteMark.style.setProperty('--intro-note-y', noteMotion.y.toFixed(2) + 'px');
                noteMotion.raf = window.requestAnimationFrame(tick);
            }

            noteMotion.raf = window.requestAnimationFrame(tick);
        }

        function moveIntroNote(event) {
            if (!noteMark || started || finished || requestedStart || !event) return;
            var rect = noteMark.getBoundingClientRect();
            var centerX = rect.left + rect.width / 2;
            var centerY = rect.top + rect.height / 2;
            var dx = event.clientX - centerX;
            var dy = event.clientY - centerY;
            var distance = Math.sqrt(dx * dx + dy * dy);
            var radius = Math.min(112, Math.max(82, window.innerWidth * 0.075));

            if (distance > radius) {
                resetIntroNote();
                return;
            }

            var pull = 0.2 * (1 - distance / radius * 0.48);
            var maxPull = 13;
            var x = Math.max(-maxPull, Math.min(maxPull, dx * pull));
            var y = Math.max(-maxPull, Math.min(maxPull, dy * pull));
            noteMark.classList.add('is-magnetic');
            noteMotion.targetX = x;
            noteMotion.targetY = y;
            startIntroNoteMotion();
        }

        function requestStart(event) {
            if (started || finished || requestedStart) return;
            if (event && event.type === 'keydown' && event.key === 'Escape') {
                finishIntro();
                return;
            }
            if (event && event.type === 'keydown' && event.key.length > 1 && event.key !== 'Enter' && event.key !== ' ') return;
            if (event && typeof event.preventDefault === 'function') event.preventDefault();
            requestedStart = true;
            resetIntroNote();
            overlay.classList.add('intro-armed');
            if (readyToStart) beginWhenReady();
        }

        function handleKeydown(event) {
            requestStart(event);
        }

        document.addEventListener('pointerdown', requestStart);
        document.addEventListener('pointermove', moveIntroNote, { passive: true });
        window.addEventListener('pointerleave', resetIntroNote);
        document.addEventListener('keydown', handleKeydown);

        Promise.all([
            waitForWindowLoad(),
            waitForFonts(),
            waitForMedia(audio, 1800),
            waitForWebGLScene(2200),
            delay(760)
        ]).then(function () {
            readyToStart = true;
            if (requestedStart) beginWhenReady();
        }).catch(function () {
            readyToStart = true;
            if (requestedStart) beginWhenReady();
        });
    }

    function setupPackageHeading() {
        var word = document.querySelector('.package-word');
        var heading = document.querySelector('.package-heading');
        if (!word || !heading || reduceMotion) return;

        var played = false;
        function zing() {
            if (played) return;
            played = true;
            window.setTimeout(function () {
                word.classList.remove('zing');
                void word.offsetWidth;
                word.classList.add('zing');
            }, 720);
        }

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        zing();
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.55 });
            observer.observe(heading);
        } else {
            zing();
        }
    }

    function setupSound() {
        document.documentElement.classList.add('has-nickeno-sound');
        var AudioContext = window.AudioContext || window.webkitAudioContext;
        var ctx = null;
        var lastClick = 0;
        var transitionPlayers = transitionSounds.map(function (src) {
            var audio = new Audio(src);
            audio.preload = 'auto';
            audio.volume = 0.48;
            return audio;
        });

        function unlockContext() {
            if (!AudioContext || reduceMotion) return null;
            if (!ctx) ctx = new AudioContext();
            if (ctx.state === 'suspended') ctx.resume().catch(function () {});
            return ctx;
        }

        function playSoftClick() {
            var now = performance.now();
            if (reduceMotion || now - lastClick < 150) return;
            lastClick = now;

            var context = unlockContext();
            if (!context) return;

            var start = context.currentTime;
            var osc = context.createOscillator();
            var gain = context.createGain();
            var filter = context.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.setValueAtTime(520, start);
            osc.frequency.exponentialRampToValueAtTime(390, start + 0.07);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(1800, start);
            gain.gain.setValueAtTime(0.0001, start);
            gain.gain.exponentialRampToValueAtTime(0.007, start + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.09);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(context.destination);
            osc.start(start);
            osc.stop(start + 0.11);
        }

        function playTransitionSound() {
            if (reduceMotion || !transitionPlayers.length) return;
            var audio = transitionPlayers[transitionSoundIndex % transitionPlayers.length];
            transitionSoundIndex = (transitionSoundIndex + 1) % transitionPlayers.length;

            try {
                audio.pause();
                audio.currentTime = 0;
                audio.volume = 0.52;
                var promise = audio.play();
                if (promise && typeof promise.catch === 'function') promise.catch(function () {});
            } catch (error) {}
        }

        document.addEventListener('pointerdown', unlockContext, { once: true, passive: true });
        document.addEventListener('keydown', unlockContext, { once: true });

        document.addEventListener('click', function (event) {
            var target = event.target.closest('button, .button, .nav-link, .email-link, .footer-links a, .footer-brand, .mobile-menu a');
            if (!target) return;
            if (target.closest('[data-license-transition], [data-license-back]')) return;
            playSoftClick();
        });

        window.nickenoSound = {
            hover: function () {},
            click: playSoftClick,
            transition: playTransitionSound,
            openPackage: playTransitionSound
        };
    }

    function setOverlayVisuals(overlay, data) {
        var title = overlay.querySelector('[data-transition-title]');
        overlay.style.setProperty('--origin-x', (data.originX || window.innerWidth / 2) + 'px');
        overlay.style.setProperty('--origin-y', (data.originY || window.innerHeight / 2) + 'px');
        overlay.style.setProperty('--transition-color', data.color || '#d8a75f');
        if (title) title.textContent = data.mode === 'back' ? 'Licenses' : (data.title || 'License');
        overlay.setAttribute('aria-hidden', 'false');
    }

    function animateOverlayIn(overlay, data, href) {
        var x = data.originX || window.innerWidth / 2;
        var y = data.originY || window.innerHeight / 2;
        var pack = overlay.querySelector('.transition-pack');
        var panels = overlay.querySelectorAll('.transition-pack span');
        var title = overlay.querySelector('[data-transition-title]');
        var fullClip = 'circle(155% at ' + x + 'px ' + y + 'px)';

        document.body.classList.add('transitioning');
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';

        if (!reduceMotion && typeof gsap !== 'undefined') {
            gsap.killTweensOf([overlay, pack, panels, title]);
            gsap.set(overlay, { clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' });
            gsap.set(pack, { rotateX: 64, rotateZ: -16, scale: 0.72 });
            gsap.set(title, { y: 34, opacity: 0, filter: 'blur(12px)' });
            gsap.set(panels, {
                rotateX: function (i) { return 58 - i * 7; },
                rotateZ: function (i) { return -18 + i * 8; },
                transformOrigin: '50% 50%'
            });

            gsap.to(overlay, {
                clipPath: fullClip,
                duration: 0.76,
                ease: 'power3.inOut',
                onComplete: function () {
                    window.location.href = href;
                }
            });
            gsap.to(pack, { rotateX: 50, rotateZ: 3, scale: 1.12, duration: 0.92, ease: 'power3.inOut' });
            gsap.fromTo(panels, {
                x: 0,
                y: 0,
                opacity: 0.24
            }, {
                x: function (i) { return (i - 1.5) * 34; },
                y: function (i) { return (1.5 - i) * 22; },
                rotateX: function (i) { return 40 - i * 5; },
                rotateZ: function (i) { return -3 + i * 5; },
                opacity: function (i) { return 0.42 + i * 0.18; },
                duration: 0.72,
                ease: 'power3.out',
                stagger: 0.04
            });
            gsap.to(title, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.44, ease: 'power3.out', delay: 0.22 });
            return;
        }

        overlay.style.transition = 'clip-path 760ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease';
        window.requestAnimationFrame(function () {
            overlay.style.clipPath = fullClip;
        });
        window.setTimeout(function () {
            window.location.href = href;
        }, 760);
    }

    function transitionTo(link, event, mode) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        var href = link.getAttribute('href');
        if (!href) return;
        event.preventDefault();

        if (reduceMotion) {
            clearTransitionData();
            window.location.href = href;
            return;
        }

        var overlay = document.getElementById('page-transition');
        if (!overlay) {
            window.location.href = href;
            return;
        }

        var card = link.closest('[data-package-card]');
        var tier = card ? card.getAttribute('data-tier') : (document.querySelector('.license-page') || {}).dataset?.tier || '';
        var rect = (card || link).getBoundingClientRect();
        var color = card ? cssVar(card, '--tier-color', '#d8a75f') : cssVar(document.querySelector('.license-page') || document.documentElement, '--tier-accent', '#d8a75f');
        var data = {
            mode: mode,
            title: link.getAttribute('data-license-title') || link.textContent.trim() || 'License',
            tier: tier,
            color: color,
            originX: rect.left + rect.width / 2,
            originY: rect.top + rect.height / 2,
            createdAt: Date.now()
        };

        if (mode === 'back') {
            data.title = 'Licenses';
            data.originX = window.innerWidth / 2;
            data.originY = window.innerHeight / 2;
        }

        setTransitionData(data);
        setOverlayVisuals(overlay, data);
        if (mode === 'open' && window.nickeno3D && typeof window.nickeno3D.openTier === 'function') {
            window.nickeno3D.openTier(tier, rect);
        }
        if (window.nickenoSound) window.nickenoSound.openPackage();

        window.setTimeout(function () {
            animateOverlayIn(overlay, data, href);
        }, mode === 'open' ? 110 : 0);
    }

    function setupLicenseTransition() {
        document.querySelectorAll('[data-license-transition]').forEach(function (link) {
            link.addEventListener('click', function (event) {
                transitionTo(link, event, 'open');
            });
        });

        document.querySelectorAll('[data-license-back]').forEach(function (link) {
            link.addEventListener('click', function (event) {
                transitionTo(link, event, 'back');
            });
        });

        document.querySelectorAll('[data-package-card]').forEach(function (card) {
            var tier = card.getAttribute('data-tier');
            var link = card.querySelector('[data-license-transition]');

            function activate() {
                if (window.nickeno3D && typeof window.nickeno3D.setActiveTier === 'function') {
                    window.nickeno3D.setActiveTier(tier);
                }
            }

            function clear() {
                if (window.nickeno3D && typeof window.nickeno3D.clearActiveTier === 'function') {
                    window.nickeno3D.clearActiveTier();
                }
            }

            card.addEventListener('pointerenter', activate);
            card.addEventListener('focusin', activate);
            card.addEventListener('pointerleave', clear);
            card.addEventListener('focusout', clear);
            card.addEventListener('click', function (event) {
                if (event.target.closest('a, button')) return;
                if (link) transitionTo(link, event, 'open');
            });
        });
    }

    function revealArrivingOverlay() {
        var data = getTransitionData();
        var overlay = document.getElementById('page-transition');
        if (!data || !overlay) {
            document.documentElement.classList.remove('transition-arriving');
            return;
        }

        clearTransitionData();
        setOverlayVisuals(overlay, data);
        overlay.style.opacity = '1';
        overlay.style.pointerEvents = 'auto';
        overlay.style.clipPath = 'circle(155% at ' + (data.originX || window.innerWidth / 2) + 'px ' + (data.originY || window.innerHeight / 2) + 'px)';

        if (data.mode === 'back') {
            var pricing = document.getElementById('pricing');
            if (pricing) pricing.scrollIntoView({ block: 'start' });
        } else if (document.body.getAttribute('data-page') === 'license') {
            document.body.classList.add('arrived-from-package');
        }

        if (reduceMotion) {
            overlay.style.display = 'none';
            document.documentElement.classList.remove('transition-arriving');
            return;
        }

        var x = data.mode === 'back' ? window.innerWidth / 2 : (data.originX || window.innerWidth / 2);
        var y = data.mode === 'back' ? window.innerHeight / 2 : (data.originY || window.innerHeight / 2);
        var exitClip = 'circle(0px at ' + x + 'px ' + y + 'px)';
        var pack = overlay.querySelector('.transition-pack');
        var title = overlay.querySelector('[data-transition-title]');
        var finished = false;

        function finishArrival() {
            if (finished) return;
            finished = true;
            overlay.setAttribute('aria-hidden', 'true');
            overlay.style.pointerEvents = 'none';
            overlay.style.opacity = '0';
            document.documentElement.classList.remove('transition-arriving');
            document.body.classList.remove('transitioning');
        }

        if (typeof gsap !== 'undefined') {
            gsap.set([pack, title], { opacity: 1 });
            var panels = overlay.querySelectorAll('.transition-pack span');
            gsap.set(overlay, { clipPath: 'circle(155% at ' + (data.originX || window.innerWidth / 2) + 'px ' + (data.originY || window.innerHeight / 2) + 'px)' });
            gsap.set(panels, {
                transformOrigin: '50% 50%',
                opacity: function (i) { return 0.45 + i * 0.13; }
            });
            window.setTimeout(finishArrival, 1800);
            gsap.timeline({
                delay: 0.26,
                onComplete: finishArrival
            })
                .to(title, { y: -34, opacity: 0, filter: 'blur(12px)', duration: 0.42, ease: 'power2.inOut' }, 0)
                .to(panels, {
                    x: function (i) { return (i - 1.5) * 170; },
                    y: function (i) { return (i % 2 ? -1 : 1) * 92; },
                    rotateX: function (i) { return 76 - i * 10; },
                    rotateY: function (i) { return (i - 1.5) * -24; },
                    rotateZ: function (i) { return (i - 1.5) * 18; },
                    scale: function (i) { return 1.15 + i * 0.08; },
                    opacity: 0,
                    duration: 0.86,
                    ease: 'power4.inOut',
                    stagger: 0.035
                }, 0)
                .to(pack, { rotateX: 24, rotateZ: 24, scale: 1.55, opacity: 0, duration: 0.9, ease: 'power4.inOut' }, 0)
                .to(overlay, { opacity: 0, duration: 0.72, ease: 'power3.inOut' }, 0.22)
                .set(overlay, { opacity: 0, pointerEvents: 'none' });
            return;
        }

        window.setTimeout(function () {
            overlay.style.transition = 'clip-path 820ms cubic-bezier(0.16, 1, 0.3, 1), opacity 820ms ease';
            overlay.style.clipPath = exitClip;
            overlay.style.opacity = '0';
            window.setTimeout(function () {
                overlay.setAttribute('aria-hidden', 'true');
                overlay.style.pointerEvents = 'none';
                document.documentElement.classList.remove('transition-arriving');
                finishArrival();
            }, 840);
        }, 260);
    }

    function setupLuxuryScroll() {
        if (reduceMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        gsap.utils.toArray('.package-preview').forEach(function (preview) {
            gsap.fromTo(preview, {
                rotateX: -8,
                y: 18
            }, {
                rotateX: 0,
                y: 0,
                ease: 'none',
                scrollTrigger: {
                    trigger: preview,
                    start: 'top bottom',
                    end: 'bottom 35%',
                    scrub: true
                }
            });
        });

        var heading = document.querySelector('.package-heading');
        if (heading) {
            gsap.fromTo(heading, {
                y: 42,
                opacity: 0,
                filter: 'blur(16px)'
            }, {
                y: 0,
                opacity: 1,
                filter: 'blur(0px)',
                duration: 1,
                ease: 'power3.out',
                scrollTrigger: {
                    trigger: heading,
                    start: 'top 82%',
                    toggleActions: 'play none none none'
                }
            });
        }
    }

    ready(function () {
        revealArrivingOverlay();
        setupStartupIntro();
        setupPackageHeading();
        setupSound();
        setupLicenseTransition();
        setupLuxuryScroll();
    });
})();
