// Company hierarchy: levels, reporting lines, organisation chart.
import React, { useMemo, useState } from 'react';
import { Card, Badge, Empty } from './ui';

export const LEVELS = [
  { k: 'Director', rank: 1 },
  { k: 'CEO / General Manager', rank: 2 },
  { k: 'Head of department', rank: 3 },
  { k: 'Manager', rank: 4 },
  { k: 'Supervisor / Coordinator', rank: 5 },
  { k: 'Executive / Office staff', rank: 6 },
  { k: 'Site team leader', rank: 6, field: true },
  { k: 'Technician / Fitter', rank: 7, field: true },
  { k: 'Helper / Trainee', rank: 8, field: true },
];
const BY = Object.fromEntries(LEVELS.map((l) => [l.k, l]));

/* Older records have no level — guess it from the designation */
export function levelOf(s) {
  if (s?.level && BY[s.level]) return s.level;
  const d = String(s?.designation || '').toLowerCase();
  if (/director|owner|chairman|partner|\bmd\b|proprietor/.test(d)) return 'Director';
  if (/ceo|general manager|\bgm\b|chief/.test(d)) return 'CEO / General Manager';
  if (/\bhead\b|\bhod\b/.test(d)) return 'Head of department';
  if (/manager/.test(d)) return 'Manager';
  if (/supervisor|coordinator|in-?charge/.test(d)) return 'Supervisor / Coordinator';
  if (/team leader|leader|foreman/.test(d) && s?.isTechnician) return 'Site team leader';
  if (/helper|trainee|apprentice/.test(d)) return 'Helper / Trainee';
  if (s?.isTechnician || /fitter|technician|mechanic|electrician|wireman|welder/.test(d)) return 'Technician / Fitter';
  return 'Executive / Office staff';
}
export const rankOf = (s) => BY[levelOf(s)]?.rank ?? 9;
export const isFieldLevel = (level) => !!BY[level]?.field;

/* Who works at sites (gets a site team and the phone app). Explicit tick wins; otherwise the level decides. */
export const isTechStaff = (s) => {
  if (s.isTechnician === true) return true;
  if (s.level) return isFieldLevel(s.level);
  // older records (no level yet): Installation / Service staff below supervisor level, as before
  return ['Installation', 'Service'].includes(s.department) && rankOf(s) >= 6;
};

/* Everyone below a person (direct and indirect reports) */
export function reportsUnder(staffId, staff) {
  const out = new Set();
  const walk = (id) => staff.filter((s) => s.reportsTo === id && !out.has(s.id)).forEach((s) => { out.add(s.id); walk(s.id); });
  if (staffId) walk(staffId);
  return out;
}

export const LevelBadge = ({ s }) => {
  const l = levelOf(s);
  const r = BY[l]?.rank ?? 9;
  return <Badge tone={r <= 2 ? 'amber' : r <= 4 ? 'blue' : BY[l]?.field ? 'green' : 'grey'}>{l}</Badge>;
};

/* Organisation chart */
export function OrgChart({ staff, teams = [], onOpen }) {
  const [collapsed, setCollapsed] = useState({});
  const active = staff.filter((s) => s.active !== false);
  const ids = new Set(active.map((s) => s.id));
  const roots = useMemo(() => active.filter((s) => !s.reportsTo || !ids.has(s.reportsTo)).sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name)), [staff]);
  const top = roots.filter((s) => rankOf(s) <= 3);
  const loose = roots.filter((s) => rankOf(s) > 3);
  const kids = (id) => active.filter((s) => s.reportsTo === id).sort((a, b) => rankOf(a) - rankOf(b) || a.name.localeCompare(b.name));
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const Node = ({ s, depth }) => {
    const k = kids(s.id);
    const open = !collapsed[s.id];
    return (
      <li>
        <div className={'org-node r' + Math.min(rankOf(s), 8)} onClick={() => onOpen && onOpen(s)}>
          <div className="org-av">{(s.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()}</div>
          <div className="grow"><b>{s.name}</b><div className="muted small">{s.designation || levelOf(s)}{s.department ? ' · ' + s.department : ''}{s.teamId && teamName(s.teamId) ? ' · ' + teamName(s.teamId) : ''}</div></div>
          <LevelBadge s={s} />
          {k.length > 0 && <button className="org-tog" onClick={(e) => { e.stopPropagation(); setCollapsed({ ...collapsed, [s.id]: open }); }}>{open ? '−' : '+'} {k.length}</button>}
        </div>
        {k.length > 0 && open && <ul>{k.map((c) => <Node key={c.id} s={c} depth={depth + 1} />)}</ul>}
      </li>
    );
  };
  if (!active.length) return <Empty>Add staff first</Empty>;
  return (<>
    <Card title="Organisation chart">
      {top.length === 0 ? <p className="muted">Set a <b>Level</b> (Director, CEO…) and <b>Reports to</b> for each person in the Staff directory to build the chart.</p> : <ul className="org">{top.map((s) => <Node key={s.id} s={s} depth={0} />)}</ul>}
    </Card>
    {loose.length > 0 && (
      <Card title={<>No manager set <Badge tone="amber">{loose.length}</Badge></>}>
        <p className="muted small">Open each person and choose whom they <b>report to</b> so they appear under their manager.</p>
        <ul className="org flat">{loose.map((s) => <Node key={s.id} s={s} depth={0} />)}</ul>
      </Card>
    )}
  </>);
}
