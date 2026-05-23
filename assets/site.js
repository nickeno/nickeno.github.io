(function () {
    const root = document.documentElement;
    const body = document.body;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;

    if (reduceMotion) {
        root.classList.add('reduced-motion');
    }

    const state = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        tx: window.innerWidth / 2,
        ty: window.innerHeight / 2,
        ambientX: window.innerWidth / 2,
        ambientY: window.innerHeight * 0.44,
        energy: 0,
        scrollProgress: 0,
        isAutoScrolling: false,
        autoScrollTarget: '',
        scrollRaf: 0,
        scrollToken: 0
    };

    function setActiveLink(id) {
        const links = document.querySelectorAll('.nav-link[href^="#"]');
        links.forEach((link) => {
            link.classList.toggle('active', link.getAttribute('href') === `#${id}`);
        });
        updateNavIndicator();
    }

    function easeInOutQuint(t) {
        return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
    }

    function targetScrollY(target) {
        const nav = document.querySelector('.site-nav');
        const navHeight = nav ? nav.getBoundingClientRect().height : 0;
        const extra = target.id === 'hero' ? 0 : navHeight + 34;
        const top = window.scrollY + target.getBoundingClientRect().top - extra;
        const max = document.documentElement.scrollHeight - window.innerHeight;
        return Math.max(0, Math.min(top, max));
    }

    function smoothScrollTo(target, id) {
        if (state.scrollRaf) {
            window.cancelAnimationFrame(state.scrollRaf);
        }

        const start = window.scrollY;
        const end = targetScrollY(target);
        const distance = Math.abs(end - start);
        const duration = Math.min(1350, Math.max(720, distance * 0.58));
        const started = performance.now();
        const token = state.scrollToken + 1;

        state.scrollToken = token;
        state.isAutoScrolling = true;
        state.autoScrollTarget = id;

        function step(now) {
            if (token !== state.scrollToken) return;

            const elapsed = Math.min(1, (now - started) / duration);
            const eased = easeInOutQuint(elapsed);
            window.scrollTo(0, start + (end - start) * eased);

            if (elapsed < 1) {
                state.scrollRaf = window.requestAnimationFrame(step);
                return;
            }

            window.scrollTo(0, end);
            state.isAutoScrolling = false;
            state.autoScrollTarget = '';
            state.scrollRaf = 0;
            setActiveLink(id);
        }

        state.scrollRaf = window.requestAnimationFrame(step);
    }

    function updateNavIndicator() {
        const navLinks = document.querySelector('.nav-links');
        const active = document.querySelector('.nav-link.active');
        if (!navLinks || !active) return;

        const navRect = navLinks.getBoundingClientRect();
        const activeRect = active.getBoundingClientRect();
        root.style.setProperty('--nav-x', `${activeRect.left - navRect.left}px`);
        root.style.setProperty('--nav-w', `${activeRect.width}px`);
    }

    function closeMenu() {
        body.classList.remove('menu-open');
        const button = document.querySelector('.menu-toggle');
        const menu = document.getElementById('mobile-menu');
        if (button) {
            button.setAttribute('aria-expanded', 'false');
            button.setAttribute('aria-label', 'Open menu');
        }
        if (menu) menu.setAttribute('aria-hidden', 'true');
    }

    function initMenu() {
        const button = document.querySelector('.menu-toggle');
        const menu = document.getElementById('mobile-menu');
        if (!button || !menu) return;

        button.addEventListener('click', () => {
            const isOpen = !body.classList.contains('menu-open');
            body.classList.toggle('menu-open', isOpen);
            button.setAttribute('aria-expanded', String(isOpen));
            button.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
            menu.setAttribute('aria-hidden', String(!isOpen));
        });

        menu.querySelectorAll('a').forEach((link) => {
            link.addEventListener('click', closeMenu);
        });

        document.addEventListener('keydown', (event) => {
            if (event.key === 'Escape') closeMenu();
        });
    }

    function initNav() {
        const links = document.querySelectorAll('a[href^="#"]');
        const sections = Array.from(document.querySelectorAll('main section[id]')).filter((section) => section.id !== 'signal-transition');

        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                const hash = link.getAttribute('href');
                if (!hash || hash === '#') return;
                const target = document.getElementById(hash.slice(1));
                if (!target) return;

                event.preventDefault();
                closeMenu();
                setActiveLink(target.id);
                if (reduceMotion) {
                    window.scrollTo(0, targetScrollY(target));
                } else {
                    smoothScrollTo(target, target.id);
                }
                if (history.pushState) history.pushState(null, '', hash);
            });
        });

        if (sections.length) {
            let ticking = false;
            const syncActiveSection = () => {
                if (state.isAutoScrolling) {
                    if (state.autoScrollTarget) setActiveLink(state.autoScrollTarget);
                    ticking = false;
                    return;
                }

                const marker = window.scrollY + window.innerHeight * 0.38;
                let current = sections[0].id;

                sections.forEach((section) => {
                    if (section.offsetTop <= marker) current = section.id;
                });

                setActiveLink(current);
                ticking = false;
            };

            window.addEventListener('scroll', () => {
                if (ticking) return;
                ticking = true;
                window.requestAnimationFrame(syncActiveSection);
            }, { passive: true });

            syncActiveSection();
        }

        window.addEventListener('resize', updateNavIndicator, { passive: true });
        window.setTimeout(updateNavIndicator, 80);
    }

    function initReveal() {
        const revealItems = document.querySelectorAll('.reveal');
        if (!revealItems.length) return;

        revealItems.forEach((item) => {
            const delay = item.getAttribute('data-reveal-delay');
            if (delay) item.style.setProperty('--reveal-delay', `${delay}ms`);
        });

        if (reduceMotion || !('IntersectionObserver' in window)) {
            revealItems.forEach((item) => item.classList.add('visible'));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');
                    observer.unobserve(entry.target);
                }
            });
        }, {
            rootMargin: '0px 0px -12% 0px',
            threshold: 0.14
        });

        revealItems.forEach((item) => observer.observe(item));
    }

    async function copyText(value) {
        if (navigator.clipboard && window.isSecureContext) {
            try {
                await navigator.clipboard.writeText(value);
                return;
            } catch (error) {}
        }

        const textarea = document.createElement('textarea');
        textarea.value = value;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.left = '-999px';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
    }

    function markCopied(button, message) {
        const textTarget = button.querySelector('span');
        const original = textTarget ? textTarget.textContent : button.textContent;
        if (textTarget) textTarget.textContent = message;
        else button.textContent = message;
        button.classList.add('copied');

        window.setTimeout(() => {
            if (textTarget) textTarget.textContent = original;
            else button.textContent = original;
            button.classList.remove('copied');
        }, 1700);
    }

    function initCopyButtons() {
        document.querySelectorAll('[data-copy-email]').forEach((button) => {
            button.addEventListener('click', async () => {
                const value = button.getAttribute('data-copy-value') || 'nickenoproduction@gmail.com';
                await copyText(value);
                markCopied(button, 'Copied');
            });
        });

        document.querySelectorAll('[data-copy-license]').forEach((button) => {
            button.addEventListener('click', async () => {
                const source = document.getElementById(button.getAttribute('data-copy-license'));
                if (!source) return;
                await copyText(source.innerText.trim());
                markCopied(button, 'License copied');
                const status = document.querySelector('[data-copy-status]');
                if (status) status.textContent = 'License text copied.';
            });
        });

        document.querySelectorAll('[data-copy-link]').forEach((button) => {
            button.addEventListener('click', async () => {
                await copyText(window.location.href);
                markCopied(button, 'Link copied');
                const status = document.querySelector('[data-copy-status]');
                if (status) status.textContent = 'Page link copied.';
            });
        });
    }

    function initPointer() {
        if (reduceMotion) return;

        window.addEventListener('pointermove', (event) => {
            state.tx = event.clientX;
            state.ty = event.clientY;
            state.energy = Math.min(1, state.energy + 0.14);
            root.style.setProperty('--mx', `${event.clientX}px`);
            root.style.setProperty('--my', `${event.clientY}px`);
        }, { passive: true });
    }

    function initMagnetic() {
        if (reduceMotion || coarsePointer || window.innerWidth < 768) return;

        document.querySelectorAll('[data-magnetic]').forEach((element) => {
            element.addEventListener('pointermove', (event) => {
                const rect = element.getBoundingClientRect();
                const relX = (event.clientX - rect.left) / rect.width - 0.5;
                const relY = (event.clientY - rect.top) / rect.height - 0.5;
                element.style.setProperty('--tx', `${relX * 6}px`);
                element.style.setProperty('--ty', `${relY * 6}px`);
                element.style.setProperty('--px', `${(relX + 0.5) * 100}%`);
                element.style.setProperty('--py', `${(relY + 0.5) * 100}%`);
            });

            element.addEventListener('pointerleave', () => {
                element.style.setProperty('--tx', '0px');
                element.style.setProperty('--ty', '0px');
                element.style.setProperty('--px', '50%');
                element.style.setProperty('--py', '50%');
            });
        });
    }

    function initLicenseTilt() {
        if (reduceMotion || coarsePointer || window.innerWidth < 768) return;

        document.querySelectorAll('[data-tilt]').forEach((card) => {
            card.addEventListener('pointermove', (event) => {
                const rect = card.getBoundingClientRect();
                const relX = (event.clientX - rect.left) / rect.width - 0.5;
                const relY = (event.clientY - rect.top) / rect.height - 0.5;
                card.style.setProperty('--tx', `${relX * 6}px`);
                card.style.setProperty('--ty', `${relY * 6}px`);
                card.style.setProperty('--rx', `${relY * -1.4}deg`);
                card.style.setProperty('--ry', `${relX * 1.4}deg`);
                card.style.setProperty('--px', `${(relX + 0.5) * 100}%`);
                card.style.setProperty('--py', `${(relY + 0.5) * 100}%`);
            });

            card.addEventListener('pointerleave', () => {
                card.style.setProperty('--tx', '0px');
                card.style.setProperty('--ty', '0px');
                card.style.setProperty('--rx', '0deg');
                card.style.setProperty('--ry', '0deg');
                card.style.setProperty('--px', '50%');
                card.style.setProperty('--py', '50%');
            });
        });
    }

    function initScrollTransform() {
        const section = document.getElementById('signal-transition');
        if (!section || reduceMotion) return;

        let ticking = false;
        const update = () => {
            const rect = section.getBoundingClientRect();
            const available = Math.max(rect.height - window.innerHeight, 1);
            const progress = Math.min(1, Math.max(0, -rect.top / available));
            state.scrollProgress = progress;
            section.style.setProperty('--scroll-progress', progress.toFixed(3));
            ticking = false;
        };

        window.addEventListener('scroll', () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(update);
        }, { passive: true });

        window.addEventListener('resize', update, { passive: true });
        update();
    }

    function initSignalCanvas() {
        const canvas = document.getElementById('signal-canvas');
        if (!canvas || reduceMotion) return;

        const ctx = canvas.getContext('2d', { alpha: true });
        if (!ctx) return;

        let width = 0;
        let height = 0;
        let dpr = 1;
        let rafId = 0;
        let time = 0;

        function resize() {
            dpr = Math.min(window.devicePixelRatio || 1, 1.5);
            width = window.innerWidth;
            height = window.innerHeight;
            canvas.width = Math.floor(width * dpr);
            canvas.height = Math.floor(height * dpr);
            canvas.style.width = `${width}px`;
            canvas.style.height = `${height}px`;
            ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        }

        function ellipse(cx, cy, rx, ry, alpha, phase) {
            ctx.strokeStyle = `rgba(244, 234, 216, ${alpha})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            for (let i = 0; i <= 220; i += 1) {
                const angle = (i / 220) * Math.PI * 2;
                const wave = Math.sin(angle * 6 + phase) * (2.5 + state.energy * 6);
                const x = cx + Math.cos(angle) * (rx + wave);
                const y = cy + Math.sin(angle) * (ry + wave * 0.28);
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();
        }

        function frame() {
            time += 0.012;
            state.x += (state.tx - state.x) * 0.055;
            state.y += (state.ty - state.y) * 0.055;
            state.ambientX += (state.tx - state.ambientX) * 0.025;
            state.ambientY += (state.ty - state.ambientY) * 0.025;
            state.energy *= 0.94;

            root.style.setProperty('--ambient-x', `${state.ambientX}px`);
            root.style.setProperty('--ambient-y', `${state.ambientY}px`);

            ctx.clearRect(0, 0, width, height);

            const cx = width / 2 + ((state.x - width / 2) / Math.max(width, 1)) * 18;
            const cy = height * 0.48 + ((state.y - height / 2) / Math.max(height, 1)) * 10;
            const base = Math.min(width * 0.36, 520);
            const scrollOpen = 1 + state.scrollProgress * 0.18;

            for (let i = 0; i < 5; i += 1) {
                ellipse(cx, cy, base * (0.52 + i * 0.13) * scrollOpen, base * (0.15 + i * 0.038), 0.035 + i * 0.012, time * (1 + i * 0.12));
            }

            const lines = width < 700 ? 34 : 64;
            const span = Math.min(width * 0.47, 560);
            ctx.lineWidth = 1;
            for (let i = -lines; i <= lines; i += 1) {
                const pct = i / lines;
                const x = cx + pct * span;
                const amp = (1 - Math.abs(pct)) * (34 + state.energy * 42);
                const phase = time * 2.2 + Math.abs(i) * 0.22;
                const y1 = cy - Math.sin(phase) * amp - 14;
                const y2 = cy + Math.sin(phase) * amp + 14;
                const alpha = 0.025 + (1 - Math.abs(pct)) * 0.1;
                ctx.strokeStyle = `rgba(210, 164, 95, ${alpha})`;
                ctx.beginPath();
                ctx.moveTo(x, y1);
                ctx.lineTo(x, y2);
                ctx.stroke();
            }

            ctx.strokeStyle = 'rgba(244, 234, 216, 0.13)';
            ctx.lineWidth = 1.2;
            ctx.beginPath();
            for (let x = -20; x <= width + 20; x += 16) {
                const distance = Math.abs(x - width / 2) / Math.max(width / 2, 1);
                const y = cy + Math.sin(time * 2.5 + x * 0.022) * 18 * (1 - distance * 0.6);
                if (x === -20) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.stroke();

            rafId = window.requestAnimationFrame(frame);
        }

        resize();
        window.addEventListener('resize', resize, { passive: true });
        rafId = window.requestAnimationFrame(frame);

        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                window.cancelAnimationFrame(rafId);
            } else {
                rafId = window.requestAnimationFrame(frame);
            }
        });
    }

    /* ── Lenis smooth scroll ── */
    function initLenis() {
        if (reduceMotion || typeof Lenis === 'undefined') return;

        const lenis = new Lenis({
            lerp: 0.07,
            duration: 1.2,
            smoothWheel: true,
            wheelMultiplier: 1,
            touchMultiplier: 1.6
        });

        // Sync with GSAP ScrollTrigger if available
        if (typeof gsap !== 'undefined' && typeof ScrollTrigger !== 'undefined') {
            lenis.on('scroll', ScrollTrigger.update);
            gsap.ticker.add((time) => {
                lenis.raf(time * 1000);
            });
            gsap.ticker.lagSmoothing(0);
        } else {
            function raf(time) {
                lenis.raf(time);
                requestAnimationFrame(raf);
            }
            requestAnimationFrame(raf);
        }

        // Make lenis accessible for anchor click integration
        window.__lenis = lenis;
    }

    /* ── Nav scroll state ── */
    function initNavScroll() {
        const navWrap = document.querySelector('.nav-wrap');
        if (!navWrap) return;

        let scrolled = false;
        const threshold = 100;

        function check() {
            const now = window.scrollY > threshold;
            if (now !== scrolled) {
                scrolled = now;
                navWrap.classList.toggle('nav-scrolled', scrolled);
            }
        }

        window.addEventListener('scroll', check, { passive: true });
        check();
    }

    /* ── Hero word-by-word reveal ── */
    function initHeroWordReveal() {
        const words = document.querySelectorAll('.hero-word');
        if (!words.length) return;

        if (reduceMotion) {
            words.forEach((w) => w.classList.add('visible'));
            return;
        }

        // Stagger the words after the logo animation has started
        words.forEach((word, i) => {
            window.setTimeout(() => {
                word.classList.add('visible');
            }, 900 + i * 200);
        });
    }

    /* ── GSAP ScrollTrigger animations ── */
    function initScrollAnimations() {
        if (reduceMotion) return;
        if (typeof gsap === 'undefined' || typeof ScrollTrigger === 'undefined') return;

        gsap.registerPlugin(ScrollTrigger);

        // ─── Hero parallax: scale down + fade as scrolling past ───
        const heroCopy = document.querySelector('.hero-copy');
        const heroObject = document.querySelector('.hero-object');
        const heroSection = document.getElementById('hero');

        if (heroCopy && heroSection) {
            heroCopy.classList.remove('reveal'); // Ensure CSS doesn't fight GSAP
            gsap.fromTo(heroCopy, {
                scale: 1,
                y: 0,
                opacity: 1
            }, {
                scale: 0.92,
                y: -40,
                opacity: 0,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroSection,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true
                }
            });
        }

        if (heroObject && heroSection) {
            // Animate the container instead of individual rings to preserve CSS animations
            gsap.fromTo(heroObject, {
                opacity: 1,
                scale: 1,
                y: 0
            }, {
                opacity: 0,
                scale: 1.15,
                y: 40,
                ease: 'none',
                scrollTrigger: {
                    trigger: heroSection,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true
                }
            });
        }

        // ─── Pricing heading: split-word reveal ───
        const pricingHeading = document.querySelector('.pricing-section .section-heading h2');
        if (pricingHeading) {
            const text = pricingHeading.textContent.trim();
            const wordsArr = text.split(/\s+/);
            pricingHeading.innerHTML = wordsArr.map((word) =>
                `<span class="split-word"><span class="split-word-inner">${word}</span></span>`
            ).join(' ');

            const inners = pricingHeading.querySelectorAll('.split-word-inner');
            gsap.set(inners, { yPercent: 110, opacity: 0 });

            gsap.to(inners, {
                yPercent: 0,
                opacity: 1,
                duration: 0.8,
                ease: 'power3.out',
                stagger: 0.12,
                scrollTrigger: {
                    trigger: pricingHeading,
                    start: 'top 82%',
                    toggleActions: 'play none none none'
                }
            });
        }

        // ─── License cards: stagger entrance from center outward ───
        const cards = document.querySelectorAll('.license-card');
        if (cards.length) {
            // Order: center cards first (indices 1,2), then outer (0,3)
            const orderedCards = [];
            if (cards.length >= 4) {
                orderedCards.push(cards[1], cards[2], cards[0], cards[3]);
            } else {
                cards.forEach((c) => orderedCards.push(c));
            }

            orderedCards.forEach((card, i) => {
                gsap.fromTo(card, {
                    scale: 0.9,
                    y: 30,
                    opacity: 0
                }, {
                    scale: 1,
                    y: 0,
                    opacity: 1,
                    duration: 0.7,
                    ease: 'power2.out',
                    scrollTrigger: {
                        trigger: card,
                        start: 'top 88%',
                        toggleActions: 'play none none none'
                    },
                    delay: i * 0.1
                });
            });
        }

        // ─── Contact heading: clip-path reveal ───
        const contactHeading = document.querySelector('.contact-section .section-heading h2');
        if (contactHeading) {
            gsap.fromTo(contactHeading, {
                clipPath: 'inset(0 100% 0 0)'
            }, {
                clipPath: 'inset(0 0% 0 0)',
                duration: 1,
                ease: 'power3.inOut',
                scrollTrigger: {
                    trigger: contactHeading,
                    start: 'top 80%',
                    toggleActions: 'play none none none'
                }
            });
        }

        // ─── Contact panel: float up with depth ───
        const contactPanel = document.querySelector('.contact-panel');
        if (contactPanel) {
            gsap.fromTo(contactPanel, {
                y: 40,
                opacity: 0
            }, {
                y: 0,
                opacity: 1,
                duration: 0.9,
                ease: 'power2.out',
                scrollTrigger: {
                    trigger: contactPanel,
                    start: 'top 85%',
                    toggleActions: 'play none none none'
                }
            });
        }

        // ─── Signal transition: enhanced staggered lines ───
        const transitionSpans = document.querySelectorAll('.transition-field span');
        if (transitionSpans.length) {
            transitionSpans.forEach((span, i) => {
                span.style.transformOrigin = 'center center';
                gsap.fromTo(span, {
                    scaleX: 0.3,
                    opacity: 0
                }, {
                    scaleX: 1,
                    opacity: 1,
                    ease: 'none',
                    scrollTrigger: {
                        trigger: '#signal-transition',
                        start: 'top bottom',
                        end: 'center center',
                        scrub: true
                    },
                    delay: i * 0.05
                });
            });
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initLenis();
        initMenu();
        initNav();
        initReveal();
        initCopyButtons();
        initPointer();
        initMagnetic();
        initLicenseTilt();
        initScrollTransform();
        initSignalCanvas();
        initNavScroll();
        initHeroWordReveal();
        initScrollAnimations();
    });
})();
