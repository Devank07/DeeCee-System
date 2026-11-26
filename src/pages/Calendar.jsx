// Team calendar (week view) and the daily site diary.
import React, { useMemo, useState } from 'react';
import { useCol, PageHeader, Card, Badge, Modal, Field, Select, act, go, Empty } from '../ui';
import { setDoc, postActivity, me } from '../data';
import { today, addDays, fmtDate, num } from '../utils';
import { VisitForm } from './shared';
import { hasAny } from '../roles';
import { t } from '../i18n';

export const DELAYS = ['No delay', 'Material short / not arrived', 'Site not ready (civil work)', 'No power at site', 'Client asked to stop', 'Payment pending', 'Rain / weather', 'Team short-handed', 'Other'];
const mondayOf = (d) => { const x = new Date(d); const k = (x.getDay() + 6) % 7; x.setDate(x.getDate() - k); return x.toISOString().slice(0, 10); };
const dayName = (d) => new Date(d).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

export default function Calendar({ user }) {
  const [week, setWeek] = useState(mondayOf(today()));
  const days = Array.from({ length: 7 }, (_, i) => addDays(week, i));
  const teams = useCol('teams').filter((x) => x.active !== false);
  const visits = useCol('visits', [['date', '>=', days[0]], ['date', '<=', days[6]]]);
  const sites = useCol('projects', [['status', '==', 'Order']]);
  const diary = useCol('diary', [['date', '>=', addDays(today(), -30)]]);
  const [newJob, setNewJob] = useState(null);
  const canPlan = hasAny(user, 'projects', 'service');
  const working = (teamId) => sites.filter((p) => p.teamId === teamId && ['Dispatched', 'Delivered'].includes(p.material?.status) && !p.handoverAt);
  const waiting = (teamId) => sites.filter((p) => p.teamId === teamId && !['Dispatched', 'Delivered'].includes(p.material?.status));
  const rows = [...teams, { id: null, name: 'Not assigned', type: '' }];
  const delays = useMemo(() => {
    const m = {};
    diary.filter((d) => d.delay && d.delay !== 'No delay').forEach((d) => { m[d.delay] = (m[d.delay] || 0) + 1; });
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [diary]);

  return (
    <div className="page">
      <PageHeader title="Team calendar" sub="Which team is where this week — installation sites, surveys, service and AMC visits"
        actions={<div className="row gap"><button className="btn ghost" onClick={() => setWeek(addDays(week, -7))}>‹</button><button className="btn ghost" onClick={() => setWeek(mondayOf(today()))}>This week</button><button className="btn ghost" onClick={() => setWeek(addDays(week, 7))}>›</button></div>} />
      <Card pad={false}>
        <div className="cal-wrap">
          <table className="cal">
            <thead><tr><th className="cal-team">Team</th>{days.map((d) => <th key={d} className={d === today() ? 'today' : ''}>{dayName(d)}</th>)}</tr></thead>
            <tbody>{rows.map((tm) => {
              const tv = visits.filter((v) => (v.teamId || null) === tm.id);
              if (tm.id === null && !tv.length) return null;
              const w = tm.id ? working(tm.id) : [];
              const wt = tm.id ? waiting(tm.id) : [];
              return (
                <tr key={tm.id || 'none'}>
                  <td className="cal-team"><b>{tm.name}</b>{tm.type && <div className="muted small">{tm.type}</div>}
                    {w.length > 0 && <div className="cal-sites">{w.map((p) => <button key={p.id} className="cal-site" onClick={() => go('orders/' + p.id)} title={p.title}>🏗 {p.clientName} · {p.install?.progress || 0}%</button>)}</div>}
                    {wt.length > 0 && <div className="muted small">{wt.length} site(s) waiting for material</div>}
                  </td>
                  {days.map((d) => {
                    const dv = tv.filter((v) => v.date === d);
                    const dd = diary.filter((x) => x.teamId === tm.id && x.date === d);
                    return (
                      <td key={d} className={(d === today() ? 'today ' : '') + (canPlan && tm.id ? 'cal-cell add' : 'cal-cell')} onClick={(e) => { if (canPlan && tm.id && e.target === e.currentTarget) setNewJob({ teamId: tm.id, date: d }); }}>
                        {dv.map((v) => <button key={v.id} className={'cal-job ' + (v.type.startsWith('Breakdown') ? 'red' : v.type.startsWith('AMC') ? 'green' : v.type === 'Site Survey' ? 'purple' : 'blue') + (v.status === 'Done' ? ' done' : '')} onClick={() => go('service/visits/' + v.id)} title={v.title}>{v.status === 'Done' ? '✓ ' : ''}{v.clientName}<span>{v.type.replace(' / Complaint', '').replace('AMC Preventive Visit', 'AMC visit')}</span></button>)}
                        {dd.map((x) => <button key={x.id} className={'cal-diary' + (x.delay && x.delay !== 'No delay' ? ' late' : '')} onClick={() => go('orders/' + x.projectId)} title={x.work}>📓 {x.clientName}<span>{x.men ? x.men + ' men' : ''}{x.hours ? ' · ' + x.hours + ' h' : ''}{x.delay && x.delay !== 'No delay' ? ' · ' + x.delay : ''}</span></button>)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}</tbody>
          </table>
        </div>
        <p className="muted small pad-x" style={{ padding: '8px 16px' }}>Click an empty box to plan a job for that team and day. 🏗 = installation site the team is working on · 📓 = site diary sent from the phone.</p>
      </Card>
      <Card title="Delays reported in the last 30 days">
        {delays.length === 0 ? <Empty>No delays reported 🎉</Empty> : <ul className="list">{delays.map(([r, n]) => <li key={r}><span>{r}</span><b>{n} day{n > 1 ? 's' : ''}</b></li>)}</ul>}
      </Card>
      {newJob && <VisitForm initial={newJob} onClose={() => setNewJob(null)} />}
    </div>
  );
}

/* ---------- Daily site diary ---------- */
export function DiaryForm({ p, teamId, onClose }) {
  const id = `${p.id}_${today()}`;
  const existing = useCol('diary', [['projectId', '==', p.id], ['date', '==', today()], ...(teamId ? [['teamId', '==', teamId]] : [])])[0];
  const [f, setF] = useState(null);
  const v = f || { men: existing?.men || '', hours: existing?.hours || '8', work: existing?.work || '', delay: existing?.delay || 'No delay', delayNote: existing?.delayNote || '' };
  const set = (k) => (e) => setF({ ...v, [k]: e.target.value });
  const save = async () => {
    if (!v.work.trim()) return act(async () => { throw new Error(t('Write what work was done today')); });
    await act(async () => {
      await setDoc('diary', id, { ...v, men: num(v.men) || '', hours: num(v.hours) || '', projectId: p.id, clientId: p.clientId, clientName: p.clientName, projectCode: p.code, teamId: p.teamId || teamId || null, teamName: p.teamName || '', date: today(), by: me()?.name || '', at: Date.now() }, true, 'Site diary');
      if (!existing) await postActivity({ projectId: p.id, clientId: p.clientId, text: `Site diary ${fmtDate(today())}: ${v.work.trim()}${v.delay && v.delay !== 'No delay' ? ` — delay: ${v.delay}${v.delayNote ? ' (' + v.delayNote + ')' : ''}` : ''}`, visibleToClient: false, teamId: p.teamId || teamId || null, kind: 'diary' });
    }, t('Diary saved'));
    onClose();
  };
  return (
    <Modal title={t("Today's site diary") + ' — ' + fmtDate(today())} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn" onClick={save}>{t('Save diary')}</button></>}>
      <div className="form-grid">
        <Field label={t('Men at site')}><input type="number" inputMode="numeric" value={v.men} onChange={set('men')} /></Field>
        <Field label={t('Hours worked')}><input type="number" inputMode="decimal" value={v.hours} onChange={set('hours')} /></Field>
        <Field label={t('Work done today')} span={2}><textarea rows={3} value={v.work} onChange={set('work')} placeholder={t('e.g. Fixed guide rails up to 3rd floor')} /></Field>
        <Field label={t('Any delay?')}><Select options={DELAYS} placeholder={false} value={v.delay} onChange={set('delay')} /></Field>
        {v.delay !== 'No delay' && <Field label={t('Delay details')}><input value={v.delayNote} onChange={set('delayNote')} /></Field>}
      </div>
    </Modal>
  );
}

export function DiaryCard({ p }) {
  const entries = useCol('diary', [['projectId', '==', p.id]]);
  if (!entries.length) return null;
  const list = [...entries].sort((a, b) => (a.date < b.date ? 1 : -1));
  const lost = list.filter((x) => x.delay && x.delay !== 'No delay');
  const manDays = list.reduce((s, x) => s + (num(x.men) || 0), 0);
  return (
    <Card title={<>Site diary <Badge tone="grey">{list.length} day{list.length > 1 ? 's' : ''}</Badge>{lost.length > 0 && <> <Badge tone="red">{lost.length} delay day{lost.length > 1 ? 's' : ''}</Badge></>}</>}>
      <p className="muted small">{manDays ? `${manDays} man-days on site` : ''}{lost.length ? ` · main delay: ${Object.entries(lost.reduce((m, x) => ({ ...m, [x.delay]: (m[x.delay] || 0) + 1 }), {})).sort((a, b) => b[1] - a[1])[0][0]}` : ''}</p>
      <ul className="list">{list.slice(0, 14).map((x) => (
        <li key={x.id}><div><b>{fmtDate(x.date)}</b> <span className="muted small">{x.men ? x.men + ' men' : ''}{x.hours ? ' · ' + x.hours + ' h' : ''} · {x.by}</span><div className="small">{x.work}</div>{x.delay && x.delay !== 'No delay' && <div className="small danger-text">Delay: {x.delay}{x.delayNote ? ' — ' + x.delayNote : ''}</div>}</div></li>
      ))}</ul>
    </Card>
  );
}
