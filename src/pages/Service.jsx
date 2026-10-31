import React, { useState } from 'react';
import { useCol, useDoc, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Tabs, Stat, PhotoGrid, Empty, Note } from '../ui';
import { addDoc, updateDoc, deleteDoc, nextNumber, postActivity, getOne } from '../data';
import { COMPLAINT_STATUSES, PRIORITIES, AMC_TYPES, AMC_CHECKLIST } from '../constants';
import { inr, fmtDate, fmtDateTime, today, addDays, addMonths, daysUntil, waLink, sum } from '../utils';
import { VisitForm, InvoiceForm, teamOptions } from './shared';
import { hasAny, isAdminU } from '../roles';

const OPEN_C = ['Open', 'Assigned', 'In Progress'];

export default function Service({ user, params }) {
  const [tab, id, extra] = params;
  const t = ['amc', 'visits'].includes(tab) ? tab : 'complaints';
  const openC = useCol('complaints', [['status', 'in', OPEN_C]]);
  const amcs = useCol('amcs');
  const todayJobs = useCol('visits', [['date', '==', today()]]);
  const activeAmc = amcs.filter((a) => a.status === 'Active' && daysUntil(a.end) >= 0);
  return (
    <div className="page">
      <PageHeader title="Service & AMC" sub="Breakdowns, maintenance contracts and team visits" />
      <div className="stats">
        <Stat label="Open complaints" value={openC.length} sub={`${openC.filter((c) => c.priority?.startsWith('Critical')).length} critical · ${openC.filter((c) => c.status === 'Open').length} not assigned`} tone={openC.length ? 'amber' : ''} onClick={() => go('service/complaints')} />
        <Stat label="Active AMCs" value={activeAmc.length} sub={inr(sum(activeAmc, 'value')) + ' / yr'} onClick={() => go('service/amc')} />
        <Stat label="Renewals due (30 d)" value={amcs.filter((a) => a.status === 'Active' && daysUntil(a.end) <= 30).length} tone="amber" onClick={() => go('service/amc')} />
        <Stat label="Jobs today" value={todayJobs.length} sub={`${todayJobs.filter((v) => v.status === 'Done').length} done`} onClick={() => go('service/visits')} />
      </div>
      <Tabs value={t} onChange={(k) => go('service/' + k)} tabs={[{ key: 'complaints', label: 'Complaints' }, { key: 'amc', label: 'AMC contracts' }, { key: 'visits', label: 'Field jobs' }]} />
      {t === 'complaints' && <Complaints openId={id} user={user} />}
      {t === 'amc' && <Amcs rows={amcs} openId={id} newFromProject={id === 'new' ? extra : null} user={user} />}
      {t === 'visits' && <Visits openId={id} user={user} />}
    </div>
  );
}

/* ---------------- COMPLAINTS ---------------- */
function Complaints({ openId, user }) {
  const [filter, setFilter] = useState('Open');
  const filters = filter === 'Open' ? [['status', 'in', OPEN_C]] : filter === 'All' ? [['reportedAt', '>=', Date.now() - 365 * 86400000]] : [['status', '==', filter]];
  const rows = useCol('complaints', filters, true, filter === 'All' ? { orderBy: ['reportedAt', 'desc'] } : undefined);
  const [create, setCreate] = useState(false);
  const pr = (p) => PRIORITIES.indexOf(p);
  return (
    <>
      <div className="chips">
        {['Open', ...COMPLAINT_STATUSES, 'All'].map((s) => <button key={s} className={'chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>{s === 'Open' ? 'All open' : s === 'All' ? 'Last 12 months' : s}</button>)}
        <span className="spacer" />
        <button className="btn" onClick={() => setCreate(true)}>+ Log complaint</button>
      </div>
      <Card pad={false}>
        <DataTable
          csvName="complaints" rows={rows} onRow={(r) => go('service/complaints/' + r.id)} initialSort={{ key: 'priority', desc: true }}
          columns={[
            { key: 'number', label: 'No.', render: (r) => <><b>{r.number}</b><div className="muted small">{fmtDateTime(r.reportedAt)}</div></>, csv: (r) => r.number },
            { key: 'clientName', label: 'Client / Lift', render: (r) => <>{r.clientName}<div className="muted small">{r.liftRef}</div></>, csv: (r) => r.clientName + ' / ' + (r.liftRef || '') },
            { key: 'issue', label: 'Issue' },
            { key: 'priority', label: 'Priority', render: (r) => <Badge tone={pr(r.priority) >= 2 ? 'red' : pr(r.priority) === 1 ? 'blue' : 'grey'}>{r.priority}</Badge>, sortValue: (r) => pr(r.priority), csv: (r) => r.priority },
            { key: 'teamName', label: 'Team', value: (r) => r.teamName || '—' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
      {create && <ComplaintForm onClose={() => setCreate(false)} />}
      {openId && <ComplaintView key={openId} id={openId} user={user} onClose={() => go('service/complaints')} />}
    </>
  );
}

export function ComplaintForm({ onClose, initial = {} }) {
  const clients = useCol('clients');
  const amcs = useCol('amcs');
  const { f, bind } = useForm({ priority: 'Normal', reportedVia: 'Phone', liftRef: '', issue: '', ...initial });
  const save = async () => {
    if (!f.clientId || !f.issue) return act(async () => { throw new Error('Client and issue are required'); });
    const c = clients.find((x) => x.id === f.clientId);
    const a = amcs.find((x) => x.clientId === f.clientId && x.status === 'Active');
    const number = await nextNumber('CMP');
    await act(async () => {
      const id = await addDoc('complaints', { ...f, number, clientName: c?.name, contactPhone: f.contactPhone || c?.phone || '', amcId: a?.id || null, projectId: a?.projectId || null, status: 'Open', teamId: null, assignedTo: null, reportedAt: Date.now() }, number);
      await postActivity({ clientId: f.clientId, projectId: a?.projectId || null, text: `Complaint ${number} logged: ${f.issue}`, visibleToClient: true, kind: 'service' });
      go('service/complaints/' + id);
    }, 'Complaint logged');
    onClose();
  };
  return (
    <Modal title="Log complaint / breakdown" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} {...bind('clientId')} /></Field>
        <Field label="Which lift"><input {...bind('liftRef')} placeholder="Tower A – Lift 2" /></Field>
        <Field label="Priority"><Select options={PRIORITIES} placeholder={false} {...bind('priority')} /></Field>
        <Field label="Issue *" span={2}><textarea rows={3} {...bind('issue')} /></Field>
        <Field label="Site contact phone"><input {...bind('contactPhone')} /></Field>
        <Field label="Reported via"><Select options={['Phone', 'WhatsApp', 'Email', 'Client Portal', 'Technician']} placeholder={false} {...bind('reportedVia')} /></Field>
      </div>
      {f.clientId && !amcs.some((a) => a.clientId === f.clientId && a.status === 'Active' && daysUntil(a.end) >= 0) && <Note tone="red">This client has no active AMC — the visit may be chargeable.</Note>}
    </Modal>
  );
}

function ComplaintView({ id, user, onClose }) {
  const c = useDoc('complaints', id);
  const visits = useCol('visits', [['complaintId', '==', id]]);
  const [schedule, setSchedule] = useState(false);
  const [status, setStatus] = useState(null);
  const [resolution, setResolution] = useState(null);
  const [del, setDel] = useState(false);
  if (!c) return null;
  const st = status ?? c.status;
  const res = resolution ?? c.resolution ?? '';
  const save = async () => {
    const patch = { status: st, resolution: res };
    if (['Resolved', 'Closed'].includes(st) && !c.resolvedAt) patch.resolvedAt = Date.now();
    await act(async () => {
      await updateDoc('complaints', c.id, patch, c.number);
      if (st !== c.status) await postActivity({ clientId: c.clientId, projectId: c.projectId || null, text: `Complaint ${c.number} is now ${st}${res && st === 'Resolved' ? ': ' + res : ''}.`, visibleToClient: true, kind: 'service' });
    }, 'Complaint updated');
    onClose();
  };
  return (
    <>
      <Modal title={`${c.number} · ${c.clientName}`} onClose={onClose}
        footer={<>
          {isAdminU(user) && (del ? <button className="btn danger-btn" onClick={() => act(() => deleteDoc('complaints', c.id, c.number), 'Deleted').then(onClose)}>Confirm delete</button> : <button className="btn ghost danger" onClick={() => setDel(true)}>Delete</button>)}
          <span className="spacer" />
          {c.contactPhone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(c.contactPhone, `Dear Sir/Madam, your complaint ${c.number} has been registered with DeeCee Elevators.${c.teamName ? ` Our ${c.teamName} will attend.` : ' We will assign a team shortly.'}`)}>WhatsApp client</a>}
          <button className="btn ghost" onClick={() => setSchedule(true)}>Assign team & schedule visit</button>
          <button className="btn" onClick={save}>Save</button>
        </>}>
        <dl className="dl">
          <dt>Lift</dt><dd>{c.liftRef || '—'}</dd>
          <dt>Issue</dt><dd>{c.issue}</dd>
          <dt>Priority</dt><dd><Badge>{c.priority}</Badge></dd>
          <dt>Reported</dt><dd>{fmtDateTime(c.reportedAt)} via {c.reportedVia}</dd>
          <dt>Contact</dt><dd>{c.contactPhone ? <a href={'tel:' + c.contactPhone}>{c.contactPhone}</a> : '—'}</dd>
          <dt>Team</dt><dd>{c.teamName || <span className="danger-text">Not assigned</span>}</dd>
          <dt>AMC</dt><dd>{c.amcId ? <a href={'#/service/amc/' + c.amcId}>Under AMC</a> : <span className="danger-text">No AMC</span>}</dd>
          {c.resolvedAt && <><dt>Resolved</dt><dd>{fmtDateTime(c.resolvedAt)} ({Math.round((c.resolvedAt - c.reportedAt) / 3600000)} h)</dd></>}
        </dl>
        <div className="form-grid">
          <Field label="Status"><Select options={COMPLAINT_STATUSES} placeholder={false} value={st} onChange={(e) => setStatus(e.target.value)} /></Field>
          <Field label="Resolution / action taken" span={2}><textarea rows={2} value={res} onChange={(e) => setResolution(e.target.value)} /></Field>
        </div>
        {visits.length > 0 && <><h4 className="section-title">Visits</h4><ul className="list">{visits.map((v) => <li key={v.id} className="clickable" onClick={() => go('service/visits/' + v.id)}><span>{fmtDate(v.date)} · {v.teamName}</span><Badge>{v.status}</Badge></li>)}</ul></>}
        {visits.map((v) => <PhotoGrid key={v.id} refId={v.id} />)}
      </Modal>
      {schedule && <VisitForm initial={{ type: 'Breakdown / Complaint', clientId: c.clientId, clientName: c.clientName, complaintId: c.id, amcId: c.amcId || '', projectId: c.projectId || '', contactPhone: c.contactPhone, title: `${c.number}: ${c.issue}`.slice(0, 80), date: today(), teamId: c.teamId || '' }} onClose={() => setSchedule(false)} />}
    </>
  );
}

/* ---------------- AMC ---------------- */
const amcState = (a) => (a.status !== 'Active' ? a.status : daysUntil(a.end) < 0 ? 'Expired' : daysUntil(a.end) <= 30 ? 'Expiring' : 'Active');

function Amcs({ rows, openId, newFromProject, user }) {
  const [create, setCreate] = useState(null);
  const fromProject = useDoc('projects', newFromProject || null);
  const open = openId && openId !== 'new' && rows.find((a) => a.id === openId);
  const canWrite = hasAny(user, 'service');
  return (
    <>
      <div className="chips"><span className="spacer" />{canWrite && <button className="btn" onClick={() => setCreate({})}>+ New AMC</button>}</div>
      <Card pad={false}>
        <DataTable
          csvName="amc-contracts" rows={rows} onRow={(r) => go('service/amc/' + r.id)} initialSort={{ key: 'end' }}
          columns={[
            { key: 'number', label: 'AMC' },
            { key: 'clientName', label: 'Client', render: (r) => <>{r.clientName}<div className="muted small">{r.siteAddress}</div></>, csv: (r) => r.clientName },
            { key: 'type', label: 'Type' },
            { key: 'lifts', label: 'Lifts', align: 'r' },
            { key: 'end', label: 'Period', value: (r) => `${fmtDate(r.start)} → ${fmtDate(r.end)}`, sortValue: (r) => r.end, csv: (r) => r.start + ' to ' + r.end },
            { key: 'value', label: 'Value / yr', align: 'r', value: (r) => inr(r.value), sortValue: (r) => Number(r.value), csv: (r) => r.value },
            { key: 'status', label: 'Status', render: (r) => <Badge>{amcState(r)}</Badge>, csv: amcState },
          ]}
        />
      </Card>
      {(create || (newFromProject && fromProject)) && <AmcForm initial={fromProject && newFromProject ? { clientId: fromProject.clientId, projectId: fromProject.id, siteAddress: fromProject.siteAddress, lifts: fromProject.lifts, start: addMonths(fromProject.handover?.date || today(), 12) } : create} onClose={() => { setCreate(null); if (newFromProject) go('service/amc'); }} />}
      {open && <AmcView key={open.id} a={open} canWrite={canWrite} onClose={() => go('service/amc')} />}
    </>
  );
}

function AmcForm({ initial = {}, onClose }) {
  const clients = useCol('clients');
  const start = initial.start || today();
  const { f, setF, bind } = useForm({ type: 'Comprehensive', lifts: 1, visitsPerYear: 12, value: '', start, end: addDays(addMonths(start, 12), -1), status: 'Active', ...initial });
  const save = async () => {
    if (!f.clientId || !f.start || !f.end) return act(async () => { throw new Error('Client and period are required'); });
    const c = clients.find((x) => x.id === f.clientId);
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    data.clientName = c?.name;
    data.siteAddress ||= c?.address || '';
    if (id) { await act(() => updateDoc('amcs', id, data, data.number), 'AMC updated'); onClose(); return; }
    data.number = await nextNumber('AMC');
    const nid = await act(() => addDoc('amcs', data, data.number), 'AMC created');
    if (data.renewedFrom) await updateDoc('amcs', data.renewedFrom, { status: 'Renewed' });
    await postActivity({ clientId: data.clientId, projectId: data.projectId || null, text: `AMC ${data.number} (${data.type}) active from ${fmtDate(data.start)} to ${fmtDate(data.end)}.`, visibleToClient: true, kind: 'service' });
    onClose();
    go('service/amc/' + nid);
  };
  return (
    <Modal title={f.id ? 'Edit AMC' : 'New AMC contract'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} {...bind('clientId')} /></Field>
        <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
        <Field label="Type"><Select options={AMC_TYPES} placeholder={false} {...bind('type')} /></Field>
        <Field label="No. of lifts"><input type="number" {...bind('lifts', 'number')} /></Field>
        <Field label="Start"><input type="date" value={f.start} onChange={(e) => setF((p) => ({ ...p, start: e.target.value, end: addDays(addMonths(e.target.value, 12), -1) }))} /></Field>
        <Field label="End"><input type="date" {...bind('end')} /></Field>
        <Field label="Contract value / year (₹, incl. GST)"><input type="number" {...bind('value', 'number')} /></Field>
        <Field label="Preventive visits / year"><input type="number" {...bind('visitsPerYear', 'number')} /></Field>
        <Field label="Status"><Select options={['Active', 'Cancelled', 'Renewed']} placeholder={false} {...bind('status')} /></Field>
        <Field label="Scope / notes" span={2}><textarea rows={2} {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

function AmcView({ a, canWrite, onClose }) {
  const teams = useCol('teams');
  const visits = useCol('visits', [['amcId', '==', a.id]]);
  const complaints = useCol('complaints', [['amcId', '==', a.id]]);
  const client = useDoc('clients', a.clientId) || {};
  const [modal, setModal] = useState(null);
  const [team, setTeam] = useState('');
  const [msg, setMsg] = useState('');
  const done = visits.filter((v) => v.status === 'Done').length;

  const generate = async () => {
    if (!team) return setMsg('Pick a team');
    const n = Number(a.visitsPerYear) || 12;
    const gap = 12 / n;
    const existing = new Set(visits.map((v) => v.date));
    const t = teams.find((x) => x.id === team);
    let created = 0;
    await act(async () => {
      for (let i = 0; i < n; i++) {
        const d = addDays(addMonths(a.start, Math.round(i * gap)), 7);
        if (d < today() || d > a.end || existing.has(d)) continue;
        await addDoc('visits', { type: 'AMC Preventive Visit', clientId: a.clientId, clientName: a.clientName, siteAddress: a.siteAddress, contactPhone: client.phone || '', amcId: a.id, projectId: null, teamId: team, teamName: t?.name || '', date: d, status: 'Scheduled', title: `PM visit ${i + 1}/${n} – ${a.clientName}` }, 'PM schedule');
        created++;
      }
    }, 'Maintenance schedule created');
    if (!created) setMsg('No new visits — all remaining dates are already scheduled.'); else setModal(null);
  };

  return (
    <>
      <Modal title={`${a.number} · ${a.clientName}`} onClose={onClose}
        footer={<>
          <span className="spacer" />
          {canWrite && <button className="btn ghost" onClick={() => setModal('edit')}>Edit</button>}
          {canWrite && <button className="btn ghost" onClick={() => setModal('plan')}>Generate PM schedule</button>}
          {canWrite && <button className="btn ghost" onClick={() => setModal('bill')}>Bill AMC</button>}
          {canWrite && <button className="btn" onClick={() => setModal('renew')}>Renew</button>}
        </>}>
        <dl className="dl">
          <dt>Status</dt><dd><Badge>{amcState(a)}</Badge> {daysUntil(a.end) >= 0 ? `${daysUntil(a.end)} days left` : `expired ${-daysUntil(a.end)} days ago`}</dd>
          <dt>Type</dt><dd>{a.type} · {a.lifts} lift(s)</dd>
          <dt>Period</dt><dd>{fmtDate(a.start)} → {fmtDate(a.end)}</dd>
          <dt>Value</dt><dd>{inr(a.value)} / year</dd>
          <dt>Site</dt><dd>{a.siteAddress}</dd>
          <dt>Visits</dt><dd>{done} done of {a.visitsPerYear} planned · {visits.filter((v) => v.status === 'Scheduled').length} scheduled</dd>
          <dt>Complaints</dt><dd>{complaints.length} under this contract</dd>
          {a.notes && <><dt>Scope</dt><dd>{a.notes}</dd></>}
        </dl>
        {client.phone && daysUntil(a.end) <= 30 && <a className="btn ghost sm" target="_blank" rel="noreferrer" href={waLink(client.phone, `Dear ${client.contactPerson || client.name}, your lift AMC ${a.number} ${daysUntil(a.end) < 0 ? 'expired on' : 'expires on'} ${fmtDate(a.end)}. Please renew to continue uninterrupted maintenance & breakdown support. — DeeCee Elevators`)}>Send renewal reminder on WhatsApp</a>}
        <h4 className="section-title">Visit history</h4>
        {visits.length === 0 ? <Empty>No visits yet</Empty> : <ul className="list">{[...visits].sort((x, y) => (x.date < y.date ? 1 : -1)).map((v) => <li key={v.id} className="clickable" onClick={() => go('service/visits/' + v.id)}><span>{fmtDate(v.date)} · {v.type} · {v.teamName}</span><Badge>{v.status}</Badge></li>)}</ul>}
      </Modal>
      {modal === 'edit' && <AmcForm initial={a} onClose={() => setModal(null)} />}
      {modal === 'renew' && <AmcForm initial={{ clientId: a.clientId, projectId: a.projectId || null, siteAddress: a.siteAddress, lifts: a.lifts, type: a.type, value: a.value, visitsPerYear: a.visitsPerYear, start: addDays(a.end, 1), renewedFrom: a.id }} onClose={() => setModal(null)} />}
      {modal === 'bill' && <InvoiceForm initial={{ clientId: a.clientId, amcId: a.id, projectId: a.projectId || '', items: [{ desc: `Annual Maintenance Contract (${a.type}) – ${a.lifts} lift(s), ${fmtDate(a.start)} to ${fmtDate(a.end)}`, hsn: '', qty: 1, rate: Math.round((Number(a.value) / 1.18) * 100) / 100 }] }} onClose={() => setModal(null)} onSaved={(id) => go('billing/invoices/' + id)} />}
      {modal === 'plan' && (
        <Modal title="Generate preventive maintenance schedule" onClose={() => setModal(null)} footer={<><button className="btn ghost" onClick={() => setModal(null)}>Cancel</button><button className="btn" onClick={generate}>Create visits</button></>}>
          <p className="muted">Creates {a.visitsPerYear} evenly spaced visits across the contract period (skipping past dates and dates already scheduled). They appear on the team's phones.</p>
          <Field label="Service team"><Select options={teamOptions(teams, 'Service')} value={team} onChange={(e) => setTeam(e.target.value)} /></Field>
          {msg && <div className="form-msg">{msg}</div>}
        </Modal>
      )}
    </>
  );
}

/* ---------------- FIELD JOBS ---------------- */
function Visits({ openId, user }) {
  const teams = useCol('teams');
  const [filter, setFilter] = useState('Upcoming');
  const [teamF, setTeamF] = useState('');
  const t = today();
  const filters = filter === 'Today' ? [['date', '==', t]] : filter === 'Done' ? [['date', '>=', addDays(t, -90)]] : [['status', 'in', ['Scheduled', 'In Progress']]];
  const rows = useCol('visits', filters);
  const [create, setCreate] = useState(false);
  const shown = rows.filter((v) => (filter === 'Upcoming' ? v.date >= t : filter === 'Overdue' ? v.date < t : filter === 'Done' ? v.status === 'Done' : true)).filter((v) => !teamF || v.teamId === teamF);
  return (
    <>
      <div className="chips">
        {['Today', 'Upcoming', 'Overdue', 'Done'].map((s) => <button key={s} className={'chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>{s === 'Done' ? 'Done (90 days)' : s}</button>)}
        <Select className="chip-select" options={teams.map((x) => ({ value: x.id, label: x.name }))} placeholder="All teams" value={teamF} onChange={(e) => setTeamF(e.target.value)} />
        <span className="spacer" />
        <button className="btn" onClick={() => setCreate(true)}>+ Schedule job</button>
      </div>
      <Card pad={false}>
        <DataTable
          csvName="field-jobs" rows={shown} onRow={(r) => go('service/visits/' + r.id)} initialSort={{ key: 'date', desc: filter === 'Done' }}
          columns={[
            { key: 'date', label: 'Date', render: (r) => <span className={r.status !== 'Done' && r.date < t ? 'danger-text' : ''}>{fmtDate(r.date)}</span>, sortValue: (r) => r.date, csv: (r) => r.date },
            { key: 'title', label: 'Job', render: (r) => <><b>{r.title}</b><div className="muted small">{r.type}</div></>, csv: (r) => r.title },
            { key: 'clientName', label: 'Client' },
            { key: 'teamName', label: 'Team', value: (r) => r.teamName || '—' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
      {create && <VisitForm onClose={() => setCreate(false)} />}
      {openId && <VisitReport id={openId} user={user} onClose={() => go('service/visits')} />}
    </>
  );
}

export function VisitReport({ id, user, onClose }) {
  const v = useDoc('visits', id);
  const [edit, setEdit] = useState(false);
  const [del, setDel] = useState(false);
  if (!v) return null;
  const checks = Object.keys(v.checklist || {}).length;
  return (
    <>
      <Modal title={v.title} onClose={onClose}
        footer={<>
          {hasAny(user, 'service', 'projects') && (del ? <button className="btn danger-btn" onClick={() => act(() => deleteDoc('visits', v.id, v.title), 'Deleted').then(onClose)}>Confirm delete</button> : <button className="btn ghost danger" onClick={() => setDel(true)}>Delete</button>)}
          <span className="spacer" />
          {v.status !== 'Done' && <button className="btn ghost" onClick={() => setEdit(true)}>Edit / reassign</button>}
          {v.status !== 'Done' && <button className="btn" onClick={() => go('tech/' + v.id)}>Open in Field App</button>}
        </>}>
        <dl className="dl">
          <dt>Status</dt><dd><Badge>{v.status}</Badge> {v.doneAt && fmtDateTime(v.doneAt)}{v.doneBy ? ' · ' + v.doneBy : ''}</dd>
          <dt>Type</dt><dd>{v.type}</dd>
          <dt>Client</dt><dd><a href={'#/clients/' + v.clientId}>{v.clientName}</a></dd>
          {v.projectId && <><dt>Order</dt><dd><a href={'#/orders/' + v.projectId}>Open client tab</a></dd></>}
          <dt>Date</dt><dd>{fmtDate(v.date)}</dd>
          <dt>Team</dt><dd>{v.teamName || '—'}</dd>
          <dt>Site</dt><dd>{v.siteAddress || '—'}</dd>
          {v.instructions && <><dt>Instructions</dt><dd>{v.instructions}</dd></>}
          {v.notes && <><dt>Work done</dt><dd className="pre">{v.notes}</dd></>}
          {v.partsUsed && <><dt>Parts used</dt><dd>{v.partsUsed}</dd></>}
          {v.customerName && <><dt>Signed by</dt><dd>{v.customerName}</dd></>}
        </dl>
        {checks > 0 && <><h4 className="section-title">Checklist</h4><ul className="checklist">{AMC_CHECKLIST.map((c) => <li key={c} className={v.checklist?.[c] ? 'ok' : ''}>{v.checklist?.[c] ? '✓' : '○'} {c}</li>)}</ul></>}
        <PhotoGrid refId={v.id} />
        {v.signature && <><h4 className="section-title">Customer signature</h4><img className="sig-img" src={v.signature} alt="Customer signature" /></>}
      </Modal>
      {edit && <VisitForm initial={v} onClose={() => setEdit(false)} />}
    </>
  );
}
