// Data layer: Firebase (Auth + Firestore) when configured, otherwise an in-browser DEMO store.
import { firebaseConfig } from './firebaseConfig';
import { uid as makeId } from './utils';
import { seedData } from './seed';

// Demo mode: no Firebase config, or a build made with VITE_DEMO=1 (used for the shareable preview)
export const DEMO = !firebaseConfig.apiKey || import.meta.env.VITE_DEMO === '1';

let B = null; // backend
let currentUser = null;
export const setMe = (u) => { currentUser = u; };
export const me = () => currentUser;

// Marker for "add n to this number" — applied atomically on the server, so two people
// recording payments / moving stock at the same moment can't overwrite each other.
export const inc = (n) => ({ __inc: Number(n) || 0 });
const isInc = (v) => v && typeof v === 'object' && '__inc' in v;

const clean = (d) => JSON.parse(JSON.stringify(d)); // strips undefined (Firestore rejects it)

const matches = (doc, filters) =>
  filters.every(([f, op, v]) => {
    const x = doc[f];
    if (op === '==') return x === v;
    if (op === '!=') return x !== v;
    if (op === 'array-contains') return (x || []).includes(v);
    if (op === 'in') return v.includes(x);
    if (op === '>=') return x != null && x >= v;
    if (op === '<=') return x != null && x <= v;
    if (op === '>') return x != null && x > v;
    if (op === '<') return x != null && x < v;
    return true;
  });

/* ---------------- DEMO BACKEND (localStorage) ---------------- */
function demoBackend() {
  const KEY = 'deecee_erp_demo_v2';
  const UKEY = 'deecee_erp_demo_uid_v2';
  let mem = null;
  try { mem = JSON.parse(localStorage.getItem(KEY)); } catch { /* storage unavailable */ }
  if (!mem) mem = seedData();
  let sessionUid = null;
  try { sessionUid = localStorage.getItem(UKEY); } catch { /* ignore */ }

  const listeners = {}; // col -> Set(fn)
  const authListeners = new Set();
  const persist = (col) => {
    try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) { console.warn('Demo storage full / unavailable', e); }
    (listeners[col] || new Set()).forEach((fn) => fn());
    if (col === 'users') emitAuth();
  };
  const rows = (col) => Object.entries(mem[col] || {}).map(([id, d]) => ({ id, ...d }));
  const applyPatch = (old, patch) => {
    const out = { ...(old || {}) };
    for (const [k, v] of Object.entries(patch)) out[k] = isInc(v) ? (Number(out[k]) || 0) + v.__inc : v;
    return out;
  };
  const emitAuth = () => {
    const u = sessionUid && mem.users?.[sessionUid];
    const p = u ? { id: sessionUid, uid: sessionUid, ...u } : null;
    authListeners.forEach((cb) => cb(p));
  };
  const shape = (list, opts) => {
    if (opts?.orderBy) {
      const [f, dir] = opts.orderBy;
      list = [...list].sort((a, b) => ((a[f] ?? '') > (b[f] ?? '') ? 1 : (a[f] ?? '') < (b[f] ?? '') ? -1 : 0) * (dir === 'desc' ? -1 : 1));
    }
    if (opts?.limit) list = list.slice(0, opts.limit);
    return list;
  };

  return {
    subscribe(col, filters, cb, opts) {
      const run = () => cb(shape(rows(col).filter((d) => matches(d, filters)), opts));
      (listeners[col] ||= new Set()).add(run);
      run();
      return () => listeners[col].delete(run);
    },
    subscribeDoc(col, id, cb) {
      const run = () => { const d = mem[col]?.[id]; cb(d ? { id, ...d } : null); };
      (listeners[col] ||= new Set()).add(run);
      run();
      return () => listeners[col].delete(run);
    },
    async query(col, filters, opts) { return shape(rows(col).filter((d) => matches(d, filters)), opts); },
    async getOne(col, id) { const d = mem[col]?.[id]; return d ? { id, ...d } : null; },
    async add(col, data) { const id = makeId(); (mem[col] ||= {})[id] = applyPatch({}, data); persist(col); return id; },
    async set(col, id, data, merge) { (mem[col] ||= {}); mem[col][id] = merge ? applyPatch(mem[col][id], data) : applyPatch({}, data); persist(col); },
    async update(col, id, patch) { if (!mem[col]?.[id]) throw new Error('Not found'); mem[col][id] = applyPatch(mem[col][id], patch); persist(col); },
    async remove(col, id) { if (mem[col]) delete mem[col][id]; persist(col); },
    async nextNumber(key) { mem.counters ||= {}; const n = (mem.counters[key]?.n || 0) + 1; mem.counters[key] = { n }; persist('counters'); return n; },
    onAuth(cb) { authListeners.add(cb); emitAuth(); return () => authListeners.delete(cb); },
    async login(email, password) {
      const entry = Object.entries(mem.users || {}).find(([, u]) => (u.email || '').toLowerCase() === email.trim().toLowerCase());
      if (!entry || password !== (entry[1].demoPassword || 'demo123')) throw new Error('Wrong email or password');
      if (entry[1].active === false) throw new Error('This account is disabled');
      sessionUid = entry[0];
      try { localStorage.setItem(UKEY, sessionUid); } catch { /* ignore */ }
      emitAuth();
    },
    async logout() { sessionUid = null; try { localStorage.removeItem(UKEY); } catch { /* ignore */ } emitAuth(); },
    async createAccount({ email, password, ...profile }) {
      if (Object.values(mem.users || {}).some((u) => u.email?.toLowerCase() === email.toLowerCase())) throw new Error('Email already in use');
      const id = makeId();
      mem.users[id] = { ...profile, email, demoPassword: password, active: true, createdAt: Date.now() };
      persist('users');
      return id;
    },
    async resetPassword() { throw new Error('Password reset emails work after Firebase is connected. In demo, all passwords are demo123.'); },
    async bootstrapAdmin() {},
    resetDemo() { try { localStorage.removeItem(KEY); localStorage.removeItem(UKEY); } catch { /* ignore */ } location.reload(); },
    async exportAll() { const out = { ...mem }; Object.keys(out).filter((k) => k.includes('/chunks')).forEach((k) => delete out[k]); return out; },
  };
}

/* ---------------- FIREBASE BACKEND ---------------- */
async function firebaseBackend() {
  const { initializeApp, deleteApp } = await import('firebase/app');
  const fa = await import('firebase/auth');
  const fs = await import('firebase/firestore');
  const app = initializeApp(firebaseConfig);
  const auth = fa.getAuth(app);
  let db;
  try {
    db = fs.initializeFirestore(app, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) });
  } catch {
    db = fs.getFirestore(app);
  }
  let profileUnsub = null;
  const ALL = ['clients', 'projects', 'activity', 'invoices', 'payments', 'amcs', 'complaints', 'visits', 'items', 'stockMoves', 'vendors', 'purchaseOrders', 'dispatches', 'staff', 'teams', 'attendance', 'settings', 'users', 'audit', 'payroll', 'counters', 'files'];
  const conv = (data) => {
    const out = {};
    for (const [k, v] of Object.entries(data)) out[k] = isInc(v) ? fs.increment(v.__inc) : v;
    return out;
  };
  const buildQuery = (col, filters, opts) => {
    const parts = filters.map(([f, op, v]) => fs.where(f, op, v));
    if (opts?.orderBy) parts.push(fs.orderBy(opts.orderBy[0], opts.orderBy[1] || 'asc'));
    if (opts?.limit) parts.push(fs.limit(opts.limit));
    return parts.length ? fs.query(fs.collection(db, col), ...parts) : fs.collection(db, col);
  };

  return {
    subscribe(col, filters, cb, opts) {
      return fs.onSnapshot(
        buildQuery(col, filters, opts),
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => {
          if (e.code === 'failed-precondition') console.error('Missing database index — run "firebase deploy --only firestore" (details):', e.message);
          else console.warn('Read blocked/failed:', col, e.code || e);
          cb([]);
        },
      );
    },
    subscribeDoc(col, id, cb) {
      return fs.onSnapshot(fs.doc(db, col, id), (s) => cb(s.exists() ? { id: s.id, ...s.data() } : null), (e) => { console.warn('Read blocked:', col, id, e.code); cb(null); });
    },
    async query(col, filters, opts) { const s = await fs.getDocs(buildQuery(col, filters, opts)); return s.docs.map((d) => ({ id: d.id, ...d.data() })); },
    async getOne(col, id) { const s = await fs.getDoc(fs.doc(db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
    async add(col, data) { const r = await fs.addDoc(fs.collection(db, col), conv(data)); return r.id; },
    async set(col, id, data, merge) { await fs.setDoc(fs.doc(db, col, id), conv(data), { merge: !!merge }); },
    async update(col, id, patch) { await fs.updateDoc(fs.doc(db, col, id), conv(patch)); },
    async remove(col, id) { await fs.deleteDoc(fs.doc(db, col, id)); },
    async nextNumber(key) {
      return fs.runTransaction(db, async (t) => {
        const ref = fs.doc(db, 'counters', key);
        const s = await t.get(ref);
        const n = (s.exists() ? s.data().n : 0) + 1;
        t.set(ref, { n });
        return n;
      });
    },
    onAuth(cb) {
      return fa.onAuthStateChanged(auth, (u) => {
        profileUnsub?.();
        profileUnsub = null;
        if (!u) return cb(null);
        profileUnsub = fs.onSnapshot(
          fs.doc(db, 'users', u.uid),
          (s) => cb(s.exists() ? { id: u.uid, uid: u.uid, ...s.data() } : { id: u.uid, uid: u.uid, email: u.email, noProfile: true }),
          () => cb({ id: u.uid, uid: u.uid, email: u.email, noProfile: true }),
        );
      });
    },
    async login(email, password) { await fa.signInWithEmailAndPassword(auth, email.trim(), password); },
    async logout() { await fa.signOut(auth); },
    async resetPassword(email) { await fa.sendPasswordResetEmail(auth, email.trim()); },
    // Creates a login for staff/client without signing the admin out (uses a secondary Firebase app)
    async createAccount({ email, password, ...profile }) {
      const sec = initializeApp(firebaseConfig, 'secondary-' + Date.now());
      try {
        const sAuth = fa.getAuth(sec);
        const cred = await fa.createUserWithEmailAndPassword(sAuth, email.trim(), password);
        await fa.signOut(sAuth);
        await fs.setDoc(fs.doc(db, 'users', cred.user.uid), clean({ ...profile, email: email.trim(), active: true, createdAt: Date.now() }));
        return cred.user.uid;
      } finally {
        deleteApp(sec).catch(() => {});
      }
    },
    // First person to sign in on a fresh project becomes the Admin (allowed once by security rules)
    async bootstrapAdmin(name) {
      const u = auth.currentUser;
      const b = fs.writeBatch(db);
      b.set(fs.doc(db, 'users', u.uid), { name, email: u.email, role: 'admin', active: true, createdAt: Date.now() });
      b.set(fs.doc(db, 'meta', 'setup'), { by: u.uid, at: Date.now() });
      await b.commit();
    },
    async signUp(email, password) { await fa.createUserWithEmailAndPassword(auth, email.trim(), password); },
    resetDemo() {},
    async exportAll() {
      const out = {};
      for (const c of ALL) {
        const s = await fs.getDocs(fs.collection(db, c));
        out[c] = Object.fromEntries(s.docs.map((d) => [d.id, d.data()]));
      }
      return out;
    },
  };
}

export async function initBackend() {
  B = DEMO ? demoBackend() : await firebaseBackend();
  return B;
}
export const backend = () => B;

/* ---------------- PUBLIC API (adds timestamps + audit trail) ---------------- */
export const subscribe = (col, filters, cb, opts) => B.subscribe(col, filters || [], cb, opts);
export const subscribeDoc = (col, id, cb) => B.subscribeDoc(col, id, cb);
export const queryOnce = (col, filters, opts) => B.query(col, filters || [], opts);
export const getOne = (col, id) => B.getOne(col, id);

function audit(action, col, docId, label) {
  const u = me();
  if (!u || u.role === 'client' || col === 'audit') return;
  B.add('audit', { at: Date.now(), uid: u.id, name: u.name || u.email, role: u.role, action, col, docId, label: label || '' }).catch(() => {});
}

export async function addDoc(col, data, label) {
  const u = me();
  const id = await B.add(col, clean({ ...data, createdAt: Date.now(), createdBy: u?.id || null, createdByName: u?.name || '' }));
  audit('Created', col, id, label);
  return id;
}
export async function setDoc(col, id, data, merge = true, label) {
  await B.set(col, id, clean({ ...data, updatedAt: Date.now() }), merge);
  audit('Saved', col, id, label);
}
export async function updateDoc(col, id, patch, label) {
  const u = me();
  await B.update(col, id, clean({ ...patch, updatedAt: Date.now(), updatedBy: u?.name || '' }));
  audit('Updated', col, id, label);
}
export async function deleteDoc(col, id, label) {
  await B.remove(col, id);
  audit('Deleted', col, id, label);
}

// Indian financial year, e.g. "26-27"
function fy() {
  const d = new Date();
  const y = d.getFullYear() % 100;
  return d.getMonth() >= 3 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}
export async function nextNumber(prefix) {
  const f = fy();
  let n;
  try { n = await B.nextNumber(`${prefix}_${f}`); } catch { n = Date.now() % 100000; }
  return `${prefix}/${f}/${String(n).padStart(4, '0')}`;
}

// Timeline entry, shared across teams. teamId makes it visible to that site team; visibleToClient to the client portal.
export function postActivity({ projectId = null, clientId = null, text, visibleToClient = false, teamId = null, kind = 'note' }) {
  const u = me();
  return addDoc('activity', {
    projectId, clientId, text, visibleToClient, teamId: teamId || null, teamVisible: !!teamId, kind,
    at: Date.now(), byName: u?.name || '', byRole: u?.role || '',
  });
}

/* ---------------- FILES (drawings, documents) ----------------
   Stored inside Firestore in ~700 KB pieces so they work on the free plan without Cloud Storage. */
const CHUNK = 700000;
export const MAX_FILE_MB = 12;

const readAsBase64 = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onerror = () => reject(r.error);
  r.onload = () => resolve(String(r.result).split(',')[1] || '');
  r.readAsDataURL(file);
});

export async function uploadFile(file, meta, onProgress) {
  if (file.size > MAX_FILE_MB * 1024 * 1024) throw new Error(`File is larger than ${MAX_FILE_MB} MB. Please save the drawing as a smaller PDF.`);
  const b64 = await readAsBase64(file);
  const parts = Math.max(1, Math.ceil(b64.length / CHUNK));
  const u = me();
  const id = await B.add('files', clean({ ...meta, name: file.name, type: file.type || 'application/octet-stream', size: file.size, chunks: parts, uploading: true, at: Date.now(), byName: u?.name || '', createdBy: u?.id || null }));
  try {
    for (let i = 0; i < parts; i++) {
      await B.set(`files/${id}/chunks`, String(i), { d: b64.slice(i * CHUNK, (i + 1) * CHUNK) }, false);
      onProgress?.(Math.round(((i + 1) / parts) * 100));
    }
    await B.update('files', id, { uploading: false });
  } catch (e) {
    await deleteFile({ id, chunks: parts }).catch(() => {});
    throw e;
  }
  audit('Uploaded', 'files', id, `${meta.title || file.name}`);
  return id;
}

export async function fetchFileBlob(f) {
  let b64 = '';
  for (let i = 0; i < (f.chunks || 1); i++) {
    const c = await B.getOne(`files/${f.id}/chunks`, String(i));
    if (!c) throw new Error('File is incomplete — please upload it again');
    b64 += c.d;
  }
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: f.type || 'application/octet-stream' });
}

export async function deleteFile(f) {
  for (let i = 0; i < (f.chunks || 1); i++) await B.remove(`files/${f.id}/chunks`, String(i)).catch(() => {});
  await B.remove('files', f.id);
  audit('Deleted', 'files', f.id, f.title || f.name || '');
}

// When an order moves to a different site team, re-share its photos, drawings, updates and jobs with the new team.
export async function restampTeam(projectId, teamId) {
  const t = teamId || null;
  const [acts, photos, files, visits] = await Promise.all([
    queryOnce('activity', [['projectId', '==', projectId]]),
    queryOnce('photos', [['projectId', '==', projectId]]),
    queryOnce('files', [['projectId', '==', projectId]]),
    queryOnce('visits', [['projectId', '==', projectId]]),
  ]);
  const jobs = [];
  acts.filter((a) => a.teamId || a.teamVisible).forEach((a) => jobs.push(B.update('activity', a.id, { teamId: t, teamVisible: true })));
  photos.forEach((p) => jobs.push(B.update('photos', p.id, { teamId: t })));
  files.filter((f) => f.shareWithTeam).forEach((f) => jobs.push(B.update('files', f.id, { teamId: t })));
  visits.filter((v) => v.status !== 'Done' && v.type === 'Installation Work').forEach((v) => jobs.push(B.update('visits', v.id, { teamId: t })));
  await Promise.all(jobs);
}
