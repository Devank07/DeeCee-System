import React, { useEffect, useRef, useState } from 'react';
import { initBackend, backend, DEMO, setMe } from './data';
import { NAV, ROLES, OFFICE_ROLES } from './constants';
import { useRoute, go, Toaster, useSettings, act, useCol, logoUrl } from './ui';
import { openTasks } from './workflow';
import Dashboard from './pages/Dashboard';
import Clients from './pages/Clients';
import Enquiries from './pages/Enquiries';
import Orders from './pages/Orders';
import Billing from './pages/Billing';
import Service from './pages/Service';
import Inventory from './pages/Inventory';
import Staff from './pages/Staff';
import FieldApp from './pages/FieldApp';
import Portal from './pages/Portal';
import Audit from './pages/Audit';
import Settings from './pages/Settings';

const PAGES = { dashboard: Dashboard, clients: Clients, enquiries: Enquiries, orders: Orders, billing: Billing, service: Service, inventory: Inventory, staff: Staff, tech: FieldApp, audit: Audit, settings: Settings };

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);
  const [user, setUser] = useState(undefined);
  useEffect(() => {
    let unsub;
    initBackend()
      .then((b) => { setReady(true); unsub = b.onAuth((u) => { setMe(u); setUser(u); }); })
      .catch((e) => setErr(e.message));
    return () => unsub?.();
  }, []);
  if (err) return <div className="center-screen"><div className="card card-body">Could not start: {err}</div></div>;
  if (!ready || user === undefined) return <div className="center-screen"><div className="spinner" /></div>;
  return (
    <>
      {!user ? <Login /> : user.noProfile ? <NoProfile user={user} /> : user.active === false ? <Disabled /> : user.role === 'client' ? <Portal user={user} /> : !ROLES[user.role] ? <Disabled msg="Your login has an unknown role. Ask the Admin to set it in Settings → Users." /> : <Shell user={user} />}
      <Toaster />
    </>
  );
}

function useBadges(user) {
  const office = OFFICE_ROLES.includes(user.role);
  const orders = useCol('projects', [['status', '==', 'Order']], office);
  const enquiries = useCol('projects', [['status', '==', 'Enquiry']], ['admin', 'sales'].includes(user.role));
  const today = new Date().toISOString().slice(0, 10);
  return {
    orders: orders.filter((p) => openTasks(p, user.role).length).length,
    enquiries: enquiries.filter((p) => (p.enquiry?.followUpDate && p.enquiry.followUpDate <= today) || !p.quote?.items?.some((i) => Number(i.rate) > 0)).length,
  };
}

function Shell({ user }) {
  const [page, ...rest] = useRoute();
  const company = useSettings();
  const [menu, setMenu] = useState(false);
  const allowed = NAV.filter((n) => n.roles.includes(user.role));
  const home = user.role === 'technician' ? 'tech' : 'dashboard';
  const current = allowed.find((n) => n.key === page) ? page : home;
  useEffect(() => { if (page !== current) go(current); }, [page, current]);
  useEffect(() => { setMenu(false); }, [page, rest[0]]);
  const badges = useBadges(user);
  const Page = PAGES[current];
  const tech = user.role === 'technician';
  return (
    <div className={'shell' + (tech ? ' tech-shell' : '')}>
      {!tech && (
        <aside className={'sidebar' + (menu ? ' open' : '')}>
          <div className="brand"><img src={logoUrl} alt="Dee Cee Elevators" className="brand-logo" /><div><b>Dee Cee Elevators</b><span>Company OS</span></div></div>
          <nav>
            {allowed.map((n) => (
              <a key={n.key} href={'#/' + n.key} className={current === n.key ? 'on' : ''}>
                <span className="ico">{n.icon}</span><span className="nav-l">{n.label}</span>
                {badges[n.key] > 0 && <span className="nav-badge" title="Waiting for your team">{badges[n.key]}</span>}
              </a>
            ))}
          </nav>
          <UserBox user={user} />
        </aside>
      )}
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <main className="main">
        {!tech && <div className="topbar"><button className="icon-btn" onClick={() => setMenu(true)} aria-label="Menu">☰</button><b>{allowed.find((n) => n.key === current)?.label}</b><span /></div>}
        {DEMO && <div className="demo-banner">Demo mode — sample data saved only in this browser.</div>}
        {['admin', 'service'].includes(user.role) && <ComplaintAlerts />}
        <Page user={user} params={rest} />
      </main>
    </div>
  );
}

/* New complaints (e.g. from the client portal) pop up for Admin & Service, with a sound and a desktop notification. */
function ComplaintAlerts() {
  const open = useCol('complaints', [['status', '==', 'Open']]);
  const read = () => { try { return JSON.parse(localStorage.getItem('dc_seen_cmp') || '[]'); } catch { return []; } };
  const [seen, setSeen] = useState(read);
  const [perm, setPerm] = useState(typeof Notification !== 'undefined' ? Notification.permission : 'unsupported');
  const prev = useRef(null);
  const fresh = open.filter((c) => !seen.includes(c.id)).sort((a, b) => b.reportedAt - a.reportedAt);
  const ids = fresh.map((c) => c.id).join(',');
  useEffect(() => {
    document.title = (fresh.length ? `(${fresh.length}) ` : '') + 'DeeCee ERP';
    if (prev.current !== null) {
      const brandNew = fresh.filter((c) => !prev.current.includes(c.id));
      if (brandNew.length) {
        beep(brandNew.some((c) => c.priority?.startsWith('Critical')));
        if (perm === 'granted') brandNew.forEach((c) => { try { new Notification('New lift complaint — ' + c.clientName, { body: `${c.priority}: ${c.issue}` }); } catch { /* ignore */ } });
      }
    }
    prev.current = fresh.map((c) => c.id);
  }, [ids]);
  const dismiss = (id) => { const s = [...seen, id]; setSeen(s); try { localStorage.setItem('dc_seen_cmp', JSON.stringify(s.slice(-300))); } catch { /* ignore */ } };
  if (!fresh.length) return null;
  const c = fresh[0];
  return (
    <div className={'alert-bar' + (c.priority?.startsWith('Critical') ? ' critical' : '')} role="alert">
      <span className="alert-ico">🚨</span>
      <span className="alert-text"><b>New complaint{fresh.length > 1 ? ` (${fresh.length})` : ''}:</b> {c.clientName} — {c.issue} <span className="muted-inv">· {c.priority}</span></span>
      <span className="row gap">
        {perm === 'default' && <button className="btn sm ghost-inv" onClick={() => Notification.requestPermission().then(setPerm)}>Turn on desktop alerts</button>}
        <button className="btn sm ghost-inv" onClick={() => { dismiss(c.id); go('service/complaints/' + c.id); }}>Open</button>
        <button className="btn sm ghost-inv" onClick={() => dismiss(c.id)}>Dismiss</button>
      </span>
    </div>
  );
}
function beep(urgent) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const times = urgent ? [0, 0.25, 0.5] : [0];
    times.forEach((t) => {
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.frequency.value = urgent ? 880 : 660; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.15, ctx.currentTime + t); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + 0.2);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.22);
    });
  } catch { /* sound blocked until the user interacts with the page */ }
}

export function UserBox({ user, compact }) {
  return (
    <div className={'userbox' + (compact ? ' compact' : '')}>
      <div className="avatar">{(user.name || user.email || '?').slice(0, 1).toUpperCase()}</div>
      <div className="ub-text"><b>{user.name || user.email}</b><span>{ROLES[user.role]}</span></div>
      <button className="btn ghost sm" onClick={() => backend().logout()}>Sign out</button>
    </div>
  );
}

const DEMO_ACCOUNTS = [
  ['admin@deecee.demo', 'Owner / Admin', 'Sees everything'],
  ['sales@deecee.demo', 'Sales', 'New clients, quotations, confirm orders'],
  ['stores@deecee.demo', 'Material & Dispatch', 'Confirm advance, dispatch'],
  ['drawing@deecee.demo', 'Drawing team', 'Upload drawings'],
  ['projects@deecee.demo', 'Installation manager', 'Site readiness, teams, handover'],
  ['tech@deecee.demo', 'Installation technician', 'Team A phone app'],
  ['servicetech@deecee.demo', 'Service technician', 'Service team phone app'],
  ['service@deecee.demo', 'Service & AMC', 'Complaints, AMC'],
  ['accounts@deecee.demo', 'Accounts', 'Invoices & payments'],
  ['client@deecee.demo', 'Client portal', 'What a customer sees'],
];

function Login() {
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [mode, setMode] = useState('login');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setMsg('');
    try {
      if (mode === 'login') await backend().login(email, pw);
      else if (mode === 'reset') { await backend().resetPassword(email); setMsg('Password reset email sent.'); }
      else await backend().signUp(email, pw);
    } catch (e2) { setMsg(prettyAuthError(e2)); }
    setBusy(false);
  };
  return (
    <div className="login">
      <div className="login-card">
        <div className="brand big"><img src={logoUrl} alt="Dee Cee Elevators" className="brand-logo" /><div><b>Dee Cee Elevators</b><span>Company OS</span></div></div>
        {DEMO && (
          <div className="demo-pick">
            <p className="muted">Demo mode — tap an account to explore that team's view:</p>
            <div className="demo-grid">
              {DEMO_ACCOUNTS.map(([em, t, s]) => (
                <button key={em} className="demo-btn" onClick={() => backend().login(em, 'demo123').catch((x) => setMsg(x.message))}><b>{t}</b><span>{s}</span></button>
              ))}
            </div>
            <div className="divider"><span>or sign in</span></div>
          </div>
        )}
        <form onSubmit={submit} className="stack">
          <input type="email" required placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" />
          {mode !== 'reset' && <input type="password" required placeholder="Password" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={6} />}
          <button className="btn wide" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : mode === 'reset' ? 'Send reset link' : 'Create admin login'}</button>
          {msg && <div className="form-msg">{msg}</div>}
        </form>
        {!DEMO && (
          <div className="login-links">
            {mode !== 'login' && <button className="link" onClick={() => setMode('login')}>Back to sign in</button>}
            {mode === 'login' && <button className="link" onClick={() => setMode('reset')}>Forgot password?</button>}
            {mode === 'login' && <button className="link" onClick={() => setMode('signup')}>First-time setup (owner only)</button>}
          </div>
        )}
      </div>
    </div>
  );
}

function prettyAuthError(e) {
  const c = e.code || '';
  if (c.includes('invalid-credential') || c.includes('wrong-password') || c.includes('user-not-found')) return 'Wrong email or password.';
  if (c.includes('email-already-in-use')) return 'That email already has an account — sign in instead.';
  if (c.includes('too-many-requests')) return 'Too many attempts. Try again in a few minutes.';
  if (c.includes('network')) return 'No internet connection.';
  return e.message;
}

function NoProfile({ user }) {
  const [name, setName] = useState('');
  const [msg, setMsg] = useState('');
  const setup = async () => {
    try { await act(() => backend().bootstrapAdmin(name || 'Owner'), 'You are now the Admin'); } catch { setMsg('Setup is already done for this company. Ask the Admin to give your email access in Settings → Users.'); }
  };
  return (
    <div className="login"><div className="login-card stack">
      <h2>Almost there</h2>
      <p className="muted">Signed in as <b>{user.email}</b>, but this login has no access yet.</p>
      <p className="muted">If you are the owner setting up the system for the first time, claim the Admin role below. Otherwise, ask your Admin to create your login from Settings → Users.</p>
      <input placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />
      <button className="btn wide" onClick={setup}>Set up as Admin (first time only)</button>
      {msg && <div className="form-msg">{msg}</div>}
      <button className="link" onClick={() => backend().logout()}>Sign out</button>
    </div></div>
  );
}
function Disabled({ msg }) {
  return <div className="login"><div className="login-card stack"><h2>No access</h2><p className="muted">{msg || 'This account is disabled. Please contact your administrator.'}</p><button className="btn" onClick={() => backend().logout()}>Sign out</button></div></div>;
}
