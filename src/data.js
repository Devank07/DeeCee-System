// Data layer: Firebase (Auth + Firestore) when configured, otherwise an in-browser DEMO store.
import { firebaseConfig } from './firebaseConfig';
import { uid as makeId } from './utils';
import { seedData } from './seed';

export const DEMO = !firebaseConfig.apiKey;

let B = null; // backend
let currentUser = null;
export const setMe = (u) => { currentUser = u; };
export const me = () => currentUser;

const clean = (d) => JSON.parse(JSON.stringify(d)); // strips undefined (Firestore rejects it)

const matches = (doc, filters) =>
  filters.every(([f, op, v]) => {
    if (op === '==') return doc[f] === v;
    if (op === 'array-contains') return (doc[f] || []).includes(v);
    if (op === 'in') return v.includes(doc[f]);
    return true;
  });

/* ---------------- DEMO BACKEND (localStorage) ---------------- */
function demoBackend() {
  const KEY = 'deecee_erp_demo_v1';
  const UKEY = 'deecee_erp_demo_uid';
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
  const emitAuth = () => {
    const u = sessionUid && mem.users?.[sessionUid];
    const p = u ? { id: sessionUid, uid: sessionUid, ...u } : null;
    authListeners.forEach((cb) => cb(p));
  };

  return {
    subscribe(col, filters, cb) {
      const run = () => cb(rows(col).filter((d) => matches(d, filters)));
      (listeners[col] ||= new Set()).add(run);
      run();
      return () => listeners[col].delete(run);
    },
    async getOne(col, id) { const d = mem[col]?.[id]; return d ? { id, ...d } : null; },
    async add(col, data) { const id = makeId(); (mem[col] ||= {})[id] = data; persist(col); return id; },
    async set(col, id, data, merge) { (mem[col] ||= {}); mem[col][id] = merge ? { ...(mem[col][id] || {}), ...data } : data; persist(col); },
    async update(col, id, patch) { if (!mem[col]?.[id]) throw new Error('Not found'); mem[col][id] = { ...mem[col][id], ...patch }; persist(col); },
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
    async exportAll() { return mem; },
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
  const ALL = ['clients', 'leads', 'quotations', 'projects', 'activity', 'invoices', 'payments', 'amcs', 'complaints', 'visits', 'photos', 'items', 'stockMoves', 'vendors', 'purchaseOrders', 'dispatches', 'staff', 'attendance', 'settings', 'users', 'audit', 'payroll', 'counters'];

  return {
    subscribe(col, filters, cb) {
      let q = fs.collection(db, col);
      if (filters.length) q = fs.query(q, ...filters.map(([f, op, v]) => fs.where(f, op, v)));
      return fs.onSnapshot(
        q,
        (s) => cb(s.docs.map((d) => ({ id: d.id, ...d.data() }))),
        (e) => { console.warn('Read blocked/failed:', col, e.code || e); cb([]); },
      );
    },
    async getOne(col, id) { const s = await fs.getDoc(fs.doc(db, col, id)); return s.exists() ? { id: s.id, ...s.data() } : null; },
    async add(col, data) { const r = await fs.addDoc(fs.collection(db, col), data); return r.id; },
    async set(col, id, data, merge) { await fs.setDoc(fs.doc(db, col, id), data, { merge: !!merge }); },
    async update(col, id, patch) { await fs.updateDoc(fs.doc(db, col, id), patch); },
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
export const subscribe = (col, filters, cb) => B.subscribe(col, filters || [], cb);
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

// Project / client timeline entry, shared across all teams (and optionally the client)
export function postActivity({ projectId = null, clientId = null, text, visibleToClient = false, kind = 'note' }) {
  const u = me();
  return addDoc('activity', {
    projectId, clientId, text, visibleToClient, kind,
    at: Date.now(), byName: u?.name || '', byRole: u?.role || '',
  });
}
