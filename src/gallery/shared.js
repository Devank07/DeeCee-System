// Client photo gallery — shared by the staff Gallery page (inside the app) and the public /gallery page.
// Collections (see firestore.rules):
//   gallery/{id}        public photo card: code, cat, title, thumb (small JPEG), w, h, pin, hidden, at
//   galleryFull/{id}    the full-size JPEG for the same id: { data }
//   gallerySets/{id}    a client selection: { name, ids: [...], at } — opened by link only (/gallery?s=<id>)
//   galleryConfig/main  categories, WhatsApp number, intro text (public, Admin edits)
// Nothing about clients, sites or staff is stored on public records.

export const GALLERY_COLS = { photos: 'gallery', full: 'galleryFull', sets: 'gallerySets', config: 'galleryConfig' };

export const DEFAULT_CATEGORIES = [
  { k: 'cabins', n: 'Cabin interiors', p: 'CAB', d: 'Wall finishes, ceilings, lighting and flooring' },
  { k: 'doors', n: 'Doors & entrances', p: 'DR', d: 'Landing doors, frames and lobby entrances' },
  { k: 'home', n: 'Home lifts', p: 'HL', d: 'Lifts for villas and independent homes' },
  { k: 'capsule', n: 'Capsule & glass lifts', p: 'CAP', d: 'Panoramic and glass-shaft elevators' },
  { k: 'hospital', n: 'Hospital lifts', p: 'HSP', d: 'Stretcher and bed elevators' },
  { k: 'goods', n: 'Goods & car lifts', p: 'GDS', d: 'Freight, industrial and car parking lifts' },
  { k: 'panels', n: 'Buttons & displays', p: 'COP', d: 'Operating panels, push buttons and indicators' },
  { k: 'finishes', n: 'Finishes & colours', p: 'FIN', d: 'Sheet finishes and colour options' },
  { k: 'projects', n: 'Completed projects', p: 'PRJ', d: 'Full installations at client sites' },
];

// Colour / finish of the steel — shown as a coloured tag on each photo and as a filter
export const FINISHES = [
  { k: 'steel', n: 'Steel', c: '#c3c9d0', t: '#1d1f22' },
  { k: 'rosegold', n: 'Rose gold', c: '#d8a08c', t: '#2b1610' },
  { k: 'gold', n: 'Gold', c: '#d9b44a', t: '#2a2104' },
];
export const finishOf = (k) => FINISHES.find((f) => f.k === k) || null;

export const DEFAULT_CONFIG = {
  whatsapp: '919837221980',
  intro: 'Every photo here is from our own installations. Pick a category to explore, tap the heart on designs you like, and send us your shortlist on WhatsApp. Each photo has a code so we know exactly what you mean.',
  categories: DEFAULT_CATEGORIES,
};

export const withDefaults = (c) => ({
  ...DEFAULT_CONFIG,
  ...(c || {}),
  categories: Array.isArray(c?.categories) && c.categories.length ? c.categories : DEFAULT_CATEGORIES,
});

export const waDigits = (s) => String(s || '').replace(/\D/g, '').replace(/^0+/, '').replace(/^(\d{10})$/, '91$1');
export const waLink = (num, text) => `https://wa.me/${waDigits(num)}?text=${encodeURIComponent(text)}`;
export const fmtCode = (prefix, n) => `${prefix}-${String(n).padStart(3, '0')}`;
export const isImgData = (s) => typeof s === 'string' && s.startsWith('data:image/');
// Pinned first, then newest first
export const sortPhotos = (list) => [...list].sort((a, b) => (b.pin ? 1 : 0) - (a.pin ? 1 : 0) || (b.at || 0) - (a.at || 0));

/* ---------- photo preparation (in the browser, before upload) ----------
   Full photo up to 1800 px and under ~900 KB, thumbnail 560 px under ~140 KB —
   fits a Firestore document, so no paid Cloud Storage is needed. */
function loadImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This file could not be read. Use a JPG or PNG photo.')); };
    img.src = url;
  });
}
function shrink(img, max, quality, limit) {
  const w = img.naturalWidth, h = img.naturalHeight;
  let s = Math.min(1, max / Math.max(w, h)), q = quality;
  for (let i = 0; i < 14; i++) {
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(w * s));
    c.height = Math.max(1, Math.round(h * s));
    const x = c.getContext('2d');
    x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(img, 0, 0, c.width, c.height);
    const data = c.toDataURL('image/jpeg', q);
    if (data.length <= limit) return { data, w: c.width, h: c.height };
    if (q > 0.6) q -= 0.08; else s *= 0.85;
  }
  throw new Error('This photo is too large to process.');
}
export async function preparePhoto(file, { small = false } = {}) {
  const { img, url } = await loadImg(file);
  try {
    return {
      full: shrink(img, small ? 1000 : 1800, 0.85, small ? 250000 : 900000),
      thumb: shrink(img, small ? 360 : 560, 0.74, small ? 50000 : 140000),
    };
  } finally { URL.revokeObjectURL(url); }
}
