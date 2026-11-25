// Client number + phone shown everywhere, the one-time numbering of existing clients, and the quick "Find client" search.
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useCol, go, WaIcon, toast } from './ui';
import { backfillClientNos } from './data';
import { waLink } from './utils';
import { isAdminU } from './roles';

export const ClientNo = ({ no, className = '' }) => (no ? <span className={'cno ' + className} title="Client number">{no}</span> : null);

export function Phone({ phone, msg = '', className = '' }) {
  if (!phone) return null;
  return (
    <span className={'phone-links ' + className} onClick={(e) => e.stopPropagation()}>
      <a href={'tel:' + phone} title={'Call ' + phone}>📞 {phone}</a>
      <a className="wa" href={waLink(phone, msg)} target="_blank" rel="noreferrer" title="WhatsApp"><WaIcon /></a>
    </span>
  );
}

/* Admin only: numbers existing clients once (oldest first) and copies the number onto their orders, invoices, payments… */
export function ClientNoSync({ user }) {
  const admin = isAdminU(user);
  const clients = useCol('clients', [], admin);
  const projects = useCol('projects', [], admin);
  const ran = useRef(false);
  const [msg, setMsg] = useState(null);
  useEffect(() => {
    if (!admin || ran.current || !clients.length) return;
    const byId = Object.fromEntries(clients.map((c) => [c.id, c]));
    const need = clients.some((c) => !c.clientNo) || projects.some((p) => p.clientId && byId[p.clientId]?.clientNo && p.clientNo !== byId[p.clientId].clientNo);
    if (!need) return;
    ran.current = true;
    setMsg('Giving client numbers…');
    backfillClientNos(setMsg).then((n) => { setMsg(null); if (n) toast(`Client numbers added (${n} records updated)`); }).catch(() => { setMsg(null); ran.current = false; });
  }, [admin, clients, projects]);
  return msg ? <div className="sync-bar">⏳ {msg} — please keep this page open</div> : null;
}

/* Quick search: name, client number, phone, quotation ref, order no. */
export function FindClient({ user }) {
  const office = true;
  const clients = useCol('clients', [], office);
  const projects = useCol('projects', [], office);
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const box = useRef(null);
  useEffect(() => {
    const key = (e) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.current?.focus(); } };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (s.length < 2) return [];
    const digits = s.replace(/\D/g, '');
    const hit = (txt) => String(txt || '').toLowerCase().includes(s);
    const phoneHit = (ph) => digits.length >= 4 && String(ph || '').replace(/\D/g, '').includes(digits);
    const out = [];
    clients.forEach((c) => { if (hit(c.name) || hit(c.clientNo) || hit(c.contactPerson) || phoneHit(c.phone) || hit(c.email) || hit(c.gstin)) out.push({ k: 'c' + c.id, title: c.name, sub: [c.clientNo, c.phone, c.city].filter(Boolean).join(' · '), go: 'clients/' + c.id, kind: 'Client' }); });
    projects.forEach((p) => { if (hit(p.code) || hit(p.quoteNo) || hit(p.quote?.refNo) || hit(p.title) || ((hit(p.clientName) || hit(p.clientNo) || phoneHit(p.contactPhone)) && !out.some((o) => o.k === 'c' + p.clientId))) out.push({ k: 'p' + p.id, title: p.clientName + ' — ' + (p.title || ''), sub: [p.clientNo, p.code || p.quote?.refNo || p.quoteNo, p.status === 'Enquiry' ? 'Enquiry' : p.status].filter(Boolean).join(' · '), go: 'orders/' + p.id, kind: p.status === 'Enquiry' ? 'Quote' : 'Order' }); });
    return out.slice(0, 12);
  }, [q, clients, projects]);
  const pick = (r) => { go(r.go); setQ(''); setOpen(false); box.current?.blur(); };
  return (
    <div className="find">
      <input ref={box} value={q} onChange={(e) => { setQ(e.target.value); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => { if (e.key === 'Enter' && results[0]) pick(results[0]); if (e.key === 'Escape') { setQ(''); e.currentTarget.blur(); } }}
        placeholder="Find client, no., phone…" aria-label="Find client by name, client number, phone, quote or order number" />
      {open && q.trim().length >= 2 && (
        <ul className="find-res">
          {results.length === 0 ? <li className="muted small">No match</li> : results.map((r) => (
            <li key={r.k} onMouseDown={() => pick(r)}><span className="find-k">{r.kind}</span><div><b>{r.title}</b><div className="muted small">{r.sub}</div></div></li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* clientId → client number, for lists where a record hasn't got its copy yet */
export function useClientNos(enabled = true) {
  const clients = useCol('clients', [], enabled);
  return useMemo(() => Object.fromEntries(clients.map((c) => [c.id, c.clientNo])), [clients]);
}
