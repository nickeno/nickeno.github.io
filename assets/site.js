(function () {
    const root = document.documentElement;
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function setTheme(theme) {
        const nextTheme = theme === 'dark' ? 'dark' : 'light';
        root.setAttribute('data-theme', nextTheme);
        try {
            localStorage.setItem('nickeno-theme', nextTheme);
        } catch (error) {}

        const button = document.getElementById('theme-btn');
        if (button) {
            button.setAttribute('aria-label', nextTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode');
        }

    }

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

        if (sections.length) {
            let ticking = false;
            const syncActiveSection = () => {
                const marker = window.scrollY + window.innerHeight * 0.36;
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
    }

    function initTheme() {
        const savedTheme = root.getAttribute('data-theme') || 'light';
        setTheme(savedTheme);

        const button = document.getElementById('theme-btn');
        if (!button) return;

        button.addEventListener('click', () => {
            const currentTheme = root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
            setTheme(currentTheme === 'dark' ? 'light' : 'dark');
        });
    }

    function initReveal() {
        const revealItems = document.querySelectorAll('.reveal');
        if (!revealItems.length) return;

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
            rootMargin: '0px 0px -10% 0px',
            threshold: 0.12
        });

        revealItems.forEach((item) => observer.observe(item));
    }

    async function copyText(value) {
        if (navigator.clipboard && window.isSecureContext) {
            await navigator.clipboard.writeText(value);
            return;
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
        }, 1800);
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

    document.addEventListener('DOMContentLoaded', () => {
        initTheme();
        initNav();
        initReveal();
        initCopyButtons();
    });
})();
