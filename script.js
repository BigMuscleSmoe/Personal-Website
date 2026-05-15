/* ============================================================
   Steven Zhang — Portfolio
   Shared JS: loader, cursor, reveals, nav
   ============================================================ */

/* ── Footer year ── */
const _y = document.getElementById('year');
if (_y) _y.textContent = new Date().getFullYear();

/* ── Loader: counter 0 → 100 ── */
(() => {
  const loader = document.getElementById('loader');
  const countEl = document.getElementById('loader-count');
  const barEl = document.getElementById('loader-bar');
  if (!loader || !countEl) {
    // No loader on this page — just enter immediately
    requestAnimationFrame(() => {
      document.body.classList.add('entered');
      const nav = document.querySelector('.nav');
      if (nav) nav.classList.add('visible');
    });
    return;
  }

  let n = 0;
  const tick = setInterval(() => {
    n += Math.max(1, Math.ceil((100 - n) * 0.09));
    if (n >= 100) { n = 100; clearInterval(tick); finish(); }
    countEl.textContent = String(n).padStart(2, '0');
    if (barEl) barEl.style.width = n + '%';
  }, 28);

  function finish() {
    setTimeout(() => {
      loader.classList.add('hide');
      document.body.classList.add('entered');
      const nav = document.querySelector('.nav');
      if (nav) nav.classList.add('visible');
      setTimeout(() => { loader.style.display = 'none'; }, 700);
    }, 220);
  }
})();

/* ── Magnetic cursor ── */
(() => {
  if (!window.matchMedia('(pointer: fine)').matches) return;

  const dot = document.createElement('div');
  const ring = document.createElement('div');
  const lab = document.createElement('div');
  dot.className = 'cur-dot';
  ring.className = 'cur-ring';
  lab.className = 'cur-label';
  document.body.append(dot, ring, lab);

  const pos = { x: -999, y: -999 };
  const r = { x: -999, y: -999 };

  window.addEventListener('mousemove', e => {
    pos.x = e.clientX; pos.y = e.clientY;
    dot.style.transform = `translate(${e.clientX}px, ${e.clientY}px) translate(-50%, -50%)`;
    lab.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`;
    const hov = e.target.closest('[data-cursor]');
    if (hov) {
      ring.classList.add('hover');
      lab.classList.add('show');
      lab.textContent = hov.dataset.cursor;
    } else {
      ring.classList.remove('hover');
      lab.classList.remove('show');
    }
  });

  window.addEventListener('mouseleave', () => {
    document.body.classList.add('cur-hidden');
  });
  window.addEventListener('mouseenter', () => {
    document.body.classList.remove('cur-hidden');
  });

  const lerp = () => {
    r.x += (pos.x - r.x) * 0.1;
    r.y += (pos.y - r.y) * 0.1;
    ring.style.transform = `translate(${r.x}px, ${r.y}px) translate(-50%, -50%)`;
    requestAnimationFrame(lerp);
  };
  requestAnimationFrame(lerp);
})();

/* ── Scroll reveal (IntersectionObserver) ── */
(() => {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) {
        e.target.classList.add('show');
        io.unobserve(e.target);
      }
    }
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach(el => io.observe(el));
})();

/* ── Mark current nav link as active based on filename ── */
(() => {
  const path = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href) return;
    if (href === path || (path === '' && href === 'index.html')) {
      link.classList.add('active');
    }
  });
})();

/* ── Tabs (Experience page) ── */
(() => {
  const tabs = document.querySelectorAll('.tab-btn');
  if (!tabs.length) return;

  tabs.forEach(btn => {
    btn.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      btn.classList.add('active');

      const target = btn.dataset.tab;
      document.querySelectorAll('.tab-panel').forEach(panel => {
        panel.style.display = panel.id === 'tab-' + target ? '' : 'none';
      });

      // Re-trigger reveals for newly-visible cards
      const visible = document.getElementById('tab-' + target);
      if (visible) {
        visible.querySelectorAll('.reveal').forEach(el => {
          el.classList.remove('show');
        });
        requestAnimationFrame(() => {
          visible.querySelectorAll('.reveal').forEach(el => {
            el.classList.add('show');
          });
        });
      }
    });
  });
})();
