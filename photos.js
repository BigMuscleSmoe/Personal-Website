/* ============================================================
   Photos page — albums + viewer
   ============================================================ */

const ALBUMS = [
  {
    id: 'ny',
    name: 'New York',
    photos: ['photos/ny1.jpg', 'photos/ny2.jpg', 'photos/ny3.jpg'],
  },
  {
    id: 'china',
    name: 'China',
    photos: ['photos/china1.jpg'],
  },
  {
    id: 'pittsburgh',
    name: 'Pittsburgh',
    photos: [
      'photos/pitt1.png',
      'photos/pitt2.png',
      'photos/pitt3.png',
      'photos/pitt4.png',
      'photos/pitt5.png',
    ],
  },
];

const albumsView = document.getElementById('albums-view');
const viewerView = document.getElementById('viewer-view');
const albumGrid = document.getElementById('album-grid');
const albumCount = document.getElementById('album-count');
const viewerTitle = document.getElementById('viewer-title');
const viewerImg = document.getElementById('viewer-img');
const viewerCounter = document.getElementById('viewer-counter');
const viewerCounter2 = document.getElementById('viewer-counter-2');
const prevBtn = document.getElementById('viewer-prev');
const nextBtn = document.getElementById('viewer-next');
const backBtn = document.getElementById('back-to-albums');

let activeAlbum = null;
let photoIdx = 0;

/* Build album grid */
function renderAlbums() {
  albumCount.textContent = `${ALBUMS.length} albums`;
  albumGrid.innerHTML = '';
  ALBUMS.forEach((alb, i) => {
    const card = document.createElement('a');
    card.className = 'album-card reveal';
    if (i > 0) card.classList.add('d' + Math.min(i, 5));
    card.href = '#';
    card.dataset.cursor = 'Open';
    card.innerHTML = `
      <div class="album-cover" style="background-image: url('${alb.photos[0]}')"></div>
      <div class="album-meta">
        <span class="album-name">${alb.name}</span>
        <span class="album-count">${alb.photos.length} photo${alb.photos.length === 1 ? '' : 's'}</span>
      </div>
    `;
    card.addEventListener('click', e => {
      e.preventDefault();
      openAlbum(alb);
    });
    albumGrid.appendChild(card);
  });

  // Trigger reveal observer for newly-added cards
  requestAnimationFrame(() => {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          e.target.classList.add('show');
          io.unobserve(e.target);
        }
      }
    }, { threshold: 0.12 });
    document.querySelectorAll('.album-card.reveal').forEach(el => io.observe(el));
  });
}

function openAlbum(album) {
  activeAlbum = album;
  photoIdx = 0;
  albumsView.style.display = 'none';
  viewerView.style.display = 'block';
  viewerTitle.textContent = album.name;
  updateViewer();
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function closeAlbum() {
  activeAlbum = null;
  viewerView.style.display = 'none';
  albumsView.style.display = 'block';
  window.scrollTo({ top: 0, behavior: 'instant' });
}

function updateViewer() {
  if (!activeAlbum) return;
  viewerImg.src = activeAlbum.photos[photoIdx];
  viewerImg.alt = `${activeAlbum.name} — photo ${photoIdx + 1}`;
  const total = activeAlbum.photos.length;
  const text = `${String(photoIdx + 1).padStart(2, '0')} / ${String(total).padStart(2, '0')}`;
  viewerCounter.textContent = text;
  viewerCounter2.textContent = text;
}

function next() {
  if (!activeAlbum) return;
  photoIdx = (photoIdx + 1) % activeAlbum.photos.length;
  updateViewer();
}
function prev() {
  if (!activeAlbum) return;
  photoIdx = (photoIdx - 1 + activeAlbum.photos.length) % activeAlbum.photos.length;
  updateViewer();
}

nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);
backBtn.addEventListener('click', e => { e.preventDefault(); closeAlbum(); });

document.addEventListener('keydown', e => {
  if (!activeAlbum) return;
  if (e.key === 'ArrowRight') next();
  if (e.key === 'ArrowLeft') prev();
  if (e.key === 'Escape') closeAlbum();
});

renderAlbums();

/* ---- Spotlight pointer tracker for the album cards ---- */
(() => {
  const root = document.documentElement;
  const onMove = (e) => {
    root.style.setProperty('--x', e.clientX.toFixed(1));
    root.style.setProperty('--y', e.clientY.toFixed(1));
    root.style.setProperty('--xp', (e.clientX / window.innerWidth).toFixed(3));
    root.style.setProperty('--yp', (e.clientY / window.innerHeight).toFixed(3));
  };
  window.addEventListener('pointermove', onMove, { passive: true });
})();
