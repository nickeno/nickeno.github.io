(function () {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const coarsePointer = window.matchMedia('(hover: none), (pointer: coarse)').matches;
    const pointer = {
        x: window.innerWidth / 2,
        y: window.innerHeight / 2,
        targetX: window.innerWidth / 2,
        targetY: window.innerHeight / 2,
        energy: 0
    };

    function setActiveLink(id) {
        const links = document.querySelectorAll('.nav-link[href^="#"]');
        links.forEach((link) => {
            const isActive = link.getAttribute('href') === `#${id}`;
            link.classList.toggle('active', isActive);
        });
    }

    function initNav() {
        const links = document.querySelectorAll('.nav-link[href^="#"]');
        const sections = Array.from(document.querySelectorAll('main section[id]'));

        links.forEach((link) => {
            link.addEventListener('click', (event) => {
                const targetId = link.getAttribute('href').slice(1);
                const target = document.getElementById(targetId);
                if (!target) return;

                event.preventDefault();
                setActiveLink(targetId);
                target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' });
                if (history.pushState) {
                    history.pushState(null, '', `#${targetId}`);
                }
            });
        });

        if (!sections.length) return;

        let ticking = false;
        const syncActiveSection = () => {
            const marker = window.scrollY + window.innerHeight * 0.38;
            let current = sections[0].id;

            sections.forEach((section) => {
                if (section.offsetTop <= marker) {
                    current = section.id;
                }
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
            } catch (error) {
                // Fall back for preview browsers that expose Clipboard but deny writes.
            }
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
        if (textTarget) {
            textTarget.textContent = message;
        } else {
            button.textContent = message;
        }
        button.classList.add('copied');

        window.setTimeout(() => {
            if (textTarget) {
                textTarget.textContent = original;
            } else {
                button.textContent = original;
            }
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
            pointer.targetX = event.clientX;
            pointer.targetY = event.clientY;
            pointer.energy = Math.min(1, pointer.energy + 0.16);
            root.style.setProperty('--mx', `${event.clientX}px`);
            root.style.setProperty('--my', `${event.clientY}px`);
        }, { passive: true });
    }

    function initMagnetic() {
        if (reduceMotion || coarsePointer || window.innerWidth < 768) return;

        document.querySelectorAll('[data-magnetic]').forEach((element) => {
            const isCard = element.classList.contains('license-card');
            const strength = isCard ? 10 : 8;

            element.addEventListener('pointermove', (event) => {
                const rect = element.getBoundingClientRect();
                const relX = (event.clientX - rect.left) / rect.width - 0.5;
                const relY = (event.clientY - rect.top) / rect.height - 0.5;
                element.style.setProperty('--tx', `${relX * strength}px`);
                element.style.setProperty('--ty', `${relY * strength}px`);

                if (isCard) {
                    element.style.setProperty('--rx', `${relY * -2.2}deg`);
                    element.style.setProperty('--ry', `${relX * 2.2}deg`);
                }
            });

            element.addEventListener('pointerleave', () => {
                element.style.setProperty('--tx', '0px');
                element.style.setProperty('--ty', '0px');
                element.style.setProperty('--rx', '0deg');
                element.style.setProperty('--ry', '0deg');
            });
        });
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

        function drawLine(x1, y1, x2, y2, alpha) {
            ctx.strokeStyle = `rgba(243, 232, 210, ${alpha})`;
            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();
        }

        function frame() {
            time += 0.012;
            pointer.x += (pointer.targetX - pointer.x) * 0.055;
            pointer.y += (pointer.targetY - pointer.y) * 0.055;
            pointer.energy *= 0.94;

            ctx.clearRect(0, 0, width, height);
            ctx.lineWidth = 1;

            const centerX = width / 2;
            const centerY = height * 0.5;
            const cursorPull = (pointer.x - centerX) / Math.max(width, 1);
            const lines = width < 700 ? 42 : 68;
            const maxSpan = Math.min(width * 0.46, 520);
            const step = maxSpan / lines;

            for (let i = 0; i < lines; i += 1) {
                const distance = i / lines;
                const mirrorX = step * i;
                const phase = time * (1.4 + distance) + i * 0.34;
                const wave = Math.sin(phase) * (18 + pointer.energy * 32) * (1 - distance * 0.52);
                const bend = cursorPull * 36 * (1 - distance);
                const bar = 24 + Math.abs(Math.sin(phase * 0.72)) * 80 * (1 - distance);
                const alpha = 0.045 + (1 - distance) * 0.12;

                drawLine(centerX - mirrorX + bend, centerY - bar - wave, centerX - mirrorX + bend, centerY + bar - wave, alpha);
                drawLine(centerX + mirrorX + bend, centerY - bar + wave, centerX + mirrorX + bend, centerY + bar + wave, alpha);
            }

            ctx.strokeStyle = 'rgba(214, 167, 96, 0.18)';
            ctx.lineWidth = 1.3;
            ctx.beginPath();
            for (let x = -20; x <= width + 20; x += 18) {
                const distance = Math.abs(x - centerX) / Math.max(centerX, 1);
                const y = centerY + Math.sin(time * 2.1 + x * 0.018) * 22 * (1 - distance * 0.5);
                if (x === -20) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
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

    document.addEventListener('DOMContentLoaded', () => {
        initNav();
        initReveal();
        initCopyButtons();
        initPointer();
        initMagnetic();
        initSignalCanvas();
    });
})();
