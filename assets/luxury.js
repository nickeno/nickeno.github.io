(function () {
    'use strict';

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

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

    function setupPackageHeading() {
        var word = document.querySelector('.package-word');
        var heading = document.querySelector('.package-heading');
        if (!word || !heading || reduceMotion) return;

        var timeout = 0;
        function zing(delay) {
            window.clearTimeout(timeout);
            timeout = window.setTimeout(function () {
                word.classList.remove('zing');
                void word.offsetWidth;
                word.classList.add('zing');
            }, delay || 0);
        }

        if ('IntersectionObserver' in window) {
            var observer = new IntersectionObserver(function (entries) {
                entries.forEach(function (entry) {
                    if (entry.isIntersecting) {
                        zing(160);
                        observer.disconnect();
                    }
                });
            }, { threshold: 0.38 });
            observer.observe(heading);
        } else {
            zing(600);
        }

        document.querySelectorAll('[data-package-card]').forEach(function (card) {
            card.addEventListener('pointerenter', function () {
                zing(0);
            });
        });
    }

    function setupSound() {
        if (reduceMotion) return;

        var AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;

        var ctx = null;
        var unlocked = false;
        var lastHover = 0;

        function unlock() {
            if (!ctx) ctx = new AudioContext();
            if (ctx.state === 'suspended') ctx.resume();
            unlocked = true;
        }

        function tone(freq, start, duration, gain, type) {
            if (!ctx || !unlocked) return;
            var osc = ctx.createOscillator();
            var amp = ctx.createGain();
            var filter = ctx.createBiquadFilter();
            osc.type = type || 'sine';
            osc.frequency.setValueAtTime(freq, start);
            osc.frequency.exponentialRampToValueAtTime(freq * 1.018, start + duration);
            filter.type = 'lowpass';
            filter.frequency.setValueAtTime(4200, start);
            amp.gain.setValueAtTime(0.0001, start);
            amp.gain.exponentialRampToValueAtTime(gain, start + 0.015);
            amp.gain.exponentialRampToValueAtTime(0.0001, start + duration);
            osc.connect(filter);
            filter.connect(amp);
            amp.connect(ctx.destination);
            osc.start(start);
            osc.stop(start + duration + 0.03);
        }

        function hover() {
            var now = performance.now();
            if (!ctx || !unlocked || now - lastHover < 260) return;
            lastHover = now;
            var t = ctx.currentTime;
            tone(740, t, 0.13, 0.018, 'triangle');
            tone(1110, t + 0.025, 0.16, 0.012, 'sine');
        }

        function openPackage() {
            unlock();
            var t = ctx.currentTime;
            tone(196, t, 0.28, 0.026, 'sine');
            tone(392, t + 0.04, 0.24, 0.02, 'triangle');
            tone(784, t + 0.11, 0.32, 0.014, 'sine');
        }

        window.addEventListener('pointerdown', unlock, { once: true, passive: true });
        window.addEventListener('keydown', unlock, { once: true });

        document.querySelectorAll('.button, .nav-link, [data-package-card]').forEach(function (item) {
            item.addEventListener('pointerenter', hover);
        });

        window.nickenoSound = {
            hover: hover,
            openPackage: openPackage
        };
    }

    function setupLicenseTransition() {
        var overlay = document.getElementById('page-transition');
        var title = overlay ? overlay.querySelector('[data-transition-title]') : null;
        if (!overlay || !title) return;

        function open(link, event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            var href = link.getAttribute('href');
            if (!href) return;

            event.preventDefault();

            var card = link.closest('[data-package-card]');
            var rect = (card || link).getBoundingClientRect();
            var x = rect.left + rect.width / 2;
            var y = rect.top + rect.height / 2;
            var tierColor = card ? cssVar(card, '--tier-color', '#d8a75f') : '#d8a75f';
            var label = link.getAttribute('data-license-title') || link.textContent.trim() || 'License';

            overlay.style.setProperty('--origin-x', x + 'px');
            overlay.style.setProperty('--origin-y', y + 'px');
            overlay.style.setProperty('--transition-color', tierColor);
            title.textContent = label;
            document.body.classList.add('transitioning');
            overlay.setAttribute('aria-hidden', 'false');

            try {
                window.sessionStorage.setItem('nickeno-license-entry', label);
            } catch (error) {}

            if (window.nickenoSound) window.nickenoSound.openPackage();

            if (!reduceMotion && typeof gsap !== 'undefined') {
                var pack = overlay.querySelector('.transition-pack');
                var panels = overlay.querySelectorAll('.transition-pack span');
                gsap.killTweensOf([overlay, pack, panels, title]);
                gsap.set(overlay, { opacity: 1, clipPath: 'circle(0px at ' + x + 'px ' + y + 'px)' });
                gsap.set(pack, { rotateX: 64, rotateZ: -16, scale: 0.74 });
                gsap.set(title, { y: 34, opacity: 0, filter: 'blur(12px)' });
                gsap.fromTo(panels, {
                    x: 0,
                    y: 0,
                    opacity: 0.25
                }, {
                    x: function (i) { return (i - 1.5) * 28; },
                    y: function (i) { return (1.5 - i) * 18; },
                    opacity: function (i) { return 0.42 + i * 0.18; },
                    duration: 0.72,
                    ease: 'power3.out',
                    stagger: 0.045
                });

                gsap.timeline({
                    defaults: { ease: 'power3.inOut' },
                    onComplete: function () {
                        window.location.href = href;
                    }
                })
                    .to(overlay, { clipPath: 'circle(155% at ' + x + 'px ' + y + 'px)', duration: 0.78 })
                    .to(pack, { rotateX: 52, rotateZ: 4, scale: 1.08, duration: 0.82 }, '<')
                    .to(title, { y: 0, opacity: 1, filter: 'blur(0px)', duration: 0.48, ease: 'power3.out' }, '-=0.34')
                    .to(pack, { scale: 1.18, duration: 0.28, ease: 'power2.in' }, '+=0.08');
                return;
            }

            overlay.style.transition = 'clip-path 620ms cubic-bezier(0.16, 1, 0.3, 1), opacity 180ms ease';
            overlay.style.opacity = '1';
            window.requestAnimationFrame(function () {
                overlay.style.clipPath = 'circle(155% at ' + x + 'px ' + y + 'px)';
            });
            window.setTimeout(function () {
                window.location.href = href;
            }, 620);
        }

        document.querySelectorAll('[data-license-transition]').forEach(function (link) {
            link.addEventListener('click', function (event) {
                open(link, event);
            });
        });

        document.querySelectorAll('[data-package-card]').forEach(function (card) {
            card.addEventListener('click', function (event) {
                if (event.target.closest('a, button')) return;
                var link = card.querySelector('[data-license-transition]');
                if (link) open(link, event);
            });
        });
    }

    function setupEntryAnimation() {
        if (document.body.getAttribute('data-page') !== 'license') return;
        try {
            if (window.sessionStorage.getItem('nickeno-license-entry')) {
                window.sessionStorage.removeItem('nickeno-license-entry');
                document.body.classList.add('arrived-from-package');
            }
        } catch (error) {}
    }

    function setupLuxuryScroll() {
        if (reduceMotion || typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        gsap.utils.toArray('.atelier-row').forEach(function (row, index) {
            gsap.fromTo(row, {
                y: 36,
                opacity: 0,
                filter: 'blur(10px)'
            }, {
                y: 0,
                opacity: 1,
                filter: 'blur(0px)',
                duration: 0.82,
                ease: 'power3.out',
                delay: index * 0.04,
                scrollTrigger: {
                    trigger: row,
                    start: 'top 86%',
                    toggleActions: 'play none none none'
                }
            });
        });

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
        setupEntryAnimation();
        setupPackageHeading();
        setupSound();
        setupLicenseTransition();
        setupLuxuryScroll();
    });
})();
