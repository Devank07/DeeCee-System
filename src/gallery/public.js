// Public client gallery (/gallery). Loads only gallery records — no login, no Company OS code.
// Uses Firestore "lite" (small, no realtime) to keep this page fast on phones.
import './public.css';
import logoUrl from '../assets/logo.png';
import { firebaseConfig } from '../firebaseConfig';
import { GALLERY_COLS as C, withDefaults, waLink, isImgData, sortPhotos } from './shared';

const DEMO = !firebaseConfig.apiKey || import.meta.env.VITE_DEMO === '1';
const $ = (id) => document.getElementById(id);
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const here = location.pathname; // gallery page without ?s=
const setId = new URLSearchParams(location.search).get('s');

$('logo').src = logoUrl;
$('home').href = here;
$('fullLink').href = here;

let cfg = withDefaults(null), photos = [], set = null, view = [], cat = 'all';
let getFull = async () => null;
const fullCache = new Map();
const catOf = (k) => cfg.categories.find((c) => c.k === k);

/* ---------- data ---------- */
async function loadFirebase() {
  const [{ initializeApp }, F] = await Promise.all([import('firebase/app'), import('firebase/firestore/lite')]);
  const db = F.getFirestore(initializeApp(firebaseConfig, 'gallery'));
  const [cfgSnap, snap, setSnap] = await Promise.all([
    F.getDoc(F.doc(db, C.config, 'main')).catch(() => null),
    F.getDocs(F.query(F.collection(db, C.photos), F.where('hidden', '==', false))),
    setId ? F.getDoc(F.doc(db, C.sets, setId)).catch(() => null) : null,
  ]);
  cfg = withDefaults(cfgSnap?.exists() ? cfgSnap.data() : null);
  photos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  set = setSnap?.exists() ? { id: setSnap.id, ...setSnap.data() } : null;
  getFull = async (id) => { const s = await F.getDoc(F.doc(db, C.full, id)); return s.exists() ? s.data().data : null; };
}
function loadDemo() {
  // Demo build: show whatever was added in the demo Company OS (same browser), otherwise sample tiles
  let mem = {};
  try { mem = JSON.parse(localStorage.getItem('deecee_erp_demo_v4')) || {}; } catch { /* ignore */ }
  const rows = (col) => Object.entries(mem[col] || {}).map(([id, d]) => ({ id, ...d }));
  cfg = withDefaults(mem.galleryConfig?.main);
  photos = rows(C.photos).filter((p) => p.hidden === false);
  if (!photos.length) photos = samplePhotos();
  const s = setId && mem[C.sets]?.[setId];
  set = s ? { id: setId, ...s } : null;
  getFull = async (id) => mem[C.full]?.[id]?.data || null;
}
function samplePhotos() {
  const tones = [['#c9a24a', '#f6e1a0'], ['#b7bcc2', '#eceff2'], ['#c48b7c', '#f3cbbd'], ['#2c2e33', '#6a6f78'], ['#6e4c33', '#9e7352'], ['#9cc3d4', '#e3f3fa']];
  const out = [];
  cfg.categories.forEach((c, ci) => {
    for (let j = 0; j < 3 + (ci % 3); j++) {
      const cv = document.createElement('canvas'); cv.width = 480; cv.height = 600;
      const x = cv.getContext('2d'); const [a, b] = tones[(ci + j) % tones.length];
      const g = x.createLinearGradient(0, 0, 480, 600); g.addColorStop(0, a); g.addColorStop(0.45, b); g.addColorStop(1, a);
      x.fillStyle = '#1b1f25'; x.fillRect(0, 0, 480, 600); x.fillStyle = g; x.fillRect(90, 90, 300, 450);
      x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(238, 90, 4, 450);
      x.fillStyle = '#fff'; x.textAlign = 'center'; x.font = '600 26px Inter,sans-serif'; x.fillText('Sample photo', 240, 70);
      x.font = '18px Inter,sans-serif'; x.fillText(c.n, 240, 575);
      out.push({ id: `s-${c.k}-${j}`, code: `${c.p}-${String(j + 1).padStart(3, '0')}`, cat: c.k, title: '', thumb: cv.toDataURL('image/jpeg', 0.8), at: Date.now() - j });
    }
  });
  return out;
}
async function fullSrc(p) {
  if (fullCache.has(p.id)) return fullCache.get(p.id);
  let s = null;
  try { s = await getFull(p.id); } catch { /* fall back to the thumbnail */ }
  const src = isImgData(s) ? s : p.thumb;
  fullCache.set(p.id, src);
  return src;
}

/* ---------- shortlist ---------- */
const wa = (text) => waLink(cfg.whatsapp, text);
let fav = [];
try { fav = JSON.parse(localStorage.getItem('dc-gallery-fav') || '[]'); } catch { /* ignore */ }
const saveFav = () => { try { localStorage.setItem('dc-gallery-fav', JSON.stringify(fav)); } catch { /* ignore */ } };
function toggleFav(id) {
  fav = fav.includes(id) ? fav.filter((x) => x !== id) : [...fav, id];
  saveFav();
  document.querySelectorAll('.fav[data-id]').forEach((b) => b.setAttribute('aria-pressed', fav.includes(b.dataset.id)));
  if ($('lb').classList.contains('on')) $('lbF').setAttribute('aria-pressed', fav.includes(view[li].id));
  updSL();
}
const label = (p) => `${p.code}${p.title ? ' – ' + p.title : ''} (${catOf(p.cat)?.n || ''})`;
function updSL() {
  const items = fav.map((id) => photos.find((p) => p.id === id)).filter(Boolean);
  $('sl').classList.toggle('on', items.length > 0);
  $('slN').textContent = `${items.length} shortlisted`;
  $('slW').href = wa(`Hello Dee Cee Elevators, I liked these from your photo gallery${set ? ` (${set.name})` : ''}:\n${items.map((p) => '• ' + label(p)).join('\n')}\nPlease share details and a quotation.`);
}
$('slC').onclick = () => { fav = []; saveFav(); document.querySelectorAll('.fav[data-id]').forEach((b) => b.setAttribute('aria-pressed', 'false')); updSL(); };

/* ---------- render ---------- */
const heart = '<svg viewBox="0 0 24 24"><path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/></svg>';
const visibleCats = () => cfg.categories.filter((c) => photos.some((p) => p.cat === c.k));

function renderHead() {
  $('waTop').href = wa('Hello Dee Cee Elevators, I was looking at your photo gallery.');
  if (set) {
    $('h1').textContent = set.name || 'Photos selected for you';
    $('intro').textContent = 'We picked these photos for you. Tap the heart on the ones you like and send them to us on WhatsApp — each photo has a code so we know exactly which one you mean.';
    $('fullLink').hidden = false;
    document.title = (set.name || 'Your selection') + ' — Dee Cee Elevators';
    return;
  }
  $('intro').textContent = cfg.intro;
  const box = $('cats'); box.textContent = '';
  for (const c of visibleCats()) {
    const list = sortPhotos(photos.filter((p) => p.cat === c.k));
    const b = el('button', 'cat'); b.type = 'button';
    const img = el('img'); img.alt = ''; img.loading = 'lazy'; if (isImgData(list[0].thumb)) img.src = list[0].thumb;
    const lab = el('div', 'lab'); lab.append(el('b', null, c.n), el('span', null, `${list.length} photo${list.length > 1 ? 's' : ''}`));
    b.append(img, lab);
    b.onclick = () => { location.hash = c.k; };
    box.append(b);
  }
}
function renderTabs() {
  const t = $('tabs'); t.textContent = '';
  if (set) return;
  for (const c of [{ k: 'all', n: 'All' }, ...visibleCats()]) {
    const n = c.k === 'all' ? photos.length : photos.filter((p) => p.cat === c.k).length;
    const b = el('button', null, c.n); b.type = 'button'; b.setAttribute('aria-pressed', c.k === cat);
    b.append(el('small', null, n));
    b.onclick = () => { location.hash = c.k === 'all' ? 'browse' : c.k; };
    t.append(b);
  }
}
function renderGrid() {
  const g = $('grid'); g.textContent = '';
  if (set) {
    const order = set.ids || [];
    view = order.map((id) => photos.find((p) => p.id === id)).filter(Boolean);
    $('gt').textContent = `${view.length} photo${view.length === 1 ? '' : 's'}`;
    $('gd').textContent = '';
  } else {
    const c = catOf(cat);
    view = sortPhotos(cat === 'all' ? photos : photos.filter((p) => p.cat === cat));
    $('gt').textContent = c ? c.n : 'All photos';
    $('gd').textContent = c ? c.d || '' : `${photos.length} photos across ${visibleCats().length} categories`;
  }
  if (!view.length) { g.append(el('div', 'msg', photos.length ? 'No photos here yet.' : 'Photos are being added. Please check back soon.')); return; }
  view.forEach((p, i) => {
    const d = el('div', 'ph');
    const o = el('button', 'o'); o.type = 'button'; o.setAttribute('aria-label', 'Open ' + label(p));
    const img = el('img'); img.alt = p.title || catOf(p.cat)?.n || p.code; img.loading = 'lazy'; if (isImgData(p.thumb)) img.src = p.thumb;
    o.append(img); o.onclick = () => openLb(i);
    const f = el('button', 'fav'); f.type = 'button'; f.dataset.id = p.id; f.innerHTML = heart;
    f.setAttribute('aria-pressed', fav.includes(p.id)); f.setAttribute('aria-label', 'Shortlist ' + p.code);
    f.onclick = () => toggleFav(p.id);
    d.append(o, el('span', 'cd', p.code), f);
    g.append(d);
  });
}
function route(scroll) {
  const h = decodeURIComponent(location.hash.slice(1));
  cat = !set && catOf(h) && photos.some((p) => p.cat === h) ? h : 'all';
  renderTabs(); renderGrid();
  if (scroll && (catOf(h) || h === 'browse')) $('browse').scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' });
}
addEventListener('hashchange', () => route(true));

/* ---------- lightbox ---------- */
let li = 0, lastFocus = null, token = 0;
async function openLb(i) {
  li = (i + view.length) % view.length;
  const p = view[li], my = ++token, img = $('lbI');
  img.src = isImgData(p.thumb) ? p.thumb : ''; img.classList.add('low'); img.alt = p.title || p.code;
  $('lbT').textContent = p.code + (p.title ? ' · ' + p.title : '');
  $('lbS').textContent = catOf(p.cat)?.n || '';
  $('lbC').textContent = `${li + 1} of ${view.length}`;
  $('lbF').setAttribute('aria-pressed', fav.includes(p.id));
  $('lbW').href = wa(`Hello Dee Cee Elevators, I'm interested in photo ${label(p)} from your gallery. Please share details.`);
  if (!$('lb').classList.contains('on')) { lastFocus = document.activeElement; $('lb').classList.add('on'); document.body.style.overflow = 'hidden'; $('lbX').focus(); }
  const src = await fullSrc(p);
  if (my !== token) return;
  img.src = src; img.classList.remove('low');
  const nx = view[(li + 1) % view.length]; if (nx) fullSrc(nx);
}
function closeLb() { $('lb').classList.remove('on'); document.body.style.overflow = ''; lastFocus?.focus(); }
$('lbX').onclick = closeLb;
$('lbP').onclick = () => openLb(li - 1);
$('lbN').onclick = () => openLb(li + 1);
$('lbF').onclick = () => toggleFav(view[li].id);
addEventListener('keydown', (e) => {
  if (!$('lb').classList.contains('on')) return;
  if (e.key === 'Escape') closeLb(); else if (e.key === 'ArrowLeft') openLb(li - 1); else if (e.key === 'ArrowRight') openLb(li + 1);
});
let tx = null;
$('stage').addEventListener('touchstart', (e) => { tx = e.touches[0].clientX; }, { passive: true });
$('stage').addEventListener('touchend', (e) => { if (tx == null) return; const dx = e.changedTouches[0].clientX - tx; tx = null; if (Math.abs(dx) > 50) openLb(li + (dx < 0 ? 1 : -1)); });

/* ---------- start ---------- */
(async () => {
  try {
    if (DEMO) loadDemo(); else await loadFirebase();
    renderHead();
    if (setId && !set) $('intro').textContent = 'This selection link is no longer available. Here is our full gallery instead.';
    route(false); updSL();
  } catch (e) {
    console.error(e);
    $('grid').textContent = '';
    $('grid').append(el('div', 'msg', 'Photos couldn’t load right now. Please refresh, or message us on WhatsApp.'));
    $('waTop').href = wa('Hello Dee Cee Elevators, I was looking at your photo gallery.');
  }
})();
