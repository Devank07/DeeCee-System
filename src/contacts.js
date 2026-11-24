// Contact cards shown to the client in the portal.
// Clients can't read staff records, so the office app copies just the name/phone of the
// salesperson and the site-team leader onto the client tab (projects/{id}.contacts).
import { useEffect, useRef } from 'react';
import { useCol } from './ui';
import { setQuiet } from './data';

const card = (s, extra = {}) => (s ? { name: s.name || '', phone: s.phone || '', email: s.email || '', designation: s.designation || '', ...extra } : null);

export function computeContacts(p, staffById, teamsById) {
  const s = staffById[p.salesBy];
  const t = teamsById[p.teamId];
  const lead = t && staffById[t.leaderId];
  return {
    sales: s ? card(s, { quoteSignature: s.quoteSignature || '' }) : p.salesName ? { name: p.salesName, phone: '', email: '', designation: 'Sales', quoteSignature: '' } : null,
    lead: lead ? card(lead, { team: t.name || '' }) : t ? { name: '', phone: '', email: '', designation: '', team: t.name || '' } : null,
  };
}

// Renders nothing. Keeps project.contacts up to date for the given client tabs.
export function ContactSync({ projects }) {
  const staff = useCol('staff');
  const teams = useCol('teams');
  const tried = useRef({});
  useEffect(() => {
    if (!staff.length) return;
    const sById = Object.fromEntries(staff.map((s) => [s.id, s]));
    const tById = Object.fromEntries(teams.map((t) => [t.id, t]));
    (projects || []).filter((p) => p && p.id && p.clientId && p.status !== 'Lost').forEach((p) => {
      const next = computeContacts(p, sById, tById);
      const sig = JSON.stringify(next);
      if (sig === JSON.stringify(p.contacts || { sales: null, lead: null }) || tried.current[p.id] === sig) return;
      tried.current[p.id] = sig;
      setQuiet('projects', p.id, { contacts: next }).catch(() => {});
    });
  }, [projects, staff, teams]);
  return null;
}
