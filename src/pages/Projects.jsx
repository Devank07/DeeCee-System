import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, StageStepper, ProgressBar, ActivityFeed, PhotoUploader, PhotoGrid, Empty, Stat, Tabs } from '../ui';
import { addDoc, updateDoc, deleteDoc, nextNumber, postActivity, me } from '../data';
import { PROJECT_STAGES, DEFAULT_MILESTONES, LIFT_TYPES, DOOR_TYPES, DRIVES } from '../constants';
import { inr, fmtDate, today, addDays, num, sum, waLink, mapsLink, daysUntil, fmtDateTime } from '../utils';
import { VisitForm, InvoiceForm, technicianOptions } from './shared';

const canEdit = (u) => ['admin', 'projects', 'sales'].includes(u.role);

export default function Projects({ user, params }) {
  const [a, b] = params;
  if (a === 'new') return <ProjectForm clientId={b} onClose={() => go('projects')} />;
  if (a) return <ProjectDetail id={a} user={user} />;
  return <ProjectList user={user} />;
}

function ProjectList({ user }) {
  const projects = useCol('projects');
  const invoices = useCol('invoices');
  const staff = useCol('staff');
  const [tab, setTab] = useState('Active');
  const rows = projects.filter((p) => tab === 'All' || p.status === tab);
  const received = (pid) => sum(invoices.filter((i) => i.projectId === pid), 'paid');
  return (
    <div className="page">
      <PageHeader title="Projects" sub="Every installation from order to handover — shared by sales, installation, stores, accounts and the client" actions={canEdit(user) && <button className="btn" onClick={() => go('projects/new')}>+ New project</button>} />
      <Tabs value={tab} onChange={setTab} tabs={['Active', 'On Hold', 'Completed', 'All'].map((s) => ({ key: s, label: `${s} (${s === 'All' ? projects.length : projects.filter((p) => p.status === s).length})` }))} />
      <Card pad={false}>
        <DataTable
          csvName="projects" rows={rows} onRow={(r) => go('projects/' + r.id)} initialSort={{ key: 'code', desc: true }}
          columns={[
            { key: 'code', label: 'Project', render: (r) => <><b>{r.title}</b><div className="muted small">{r.code} · {r.clientName}</div></>, csv: (r) => `${r.code} ${r.title} / ${r.clientName}` },
            { key: 'stage', label: 'Stage', render: (r) => <div className="stage-cell"><span>{PROJECT_STAGES[r.stage]}</span><ProgressBar value={((r.stage + 1) / PROJECT_STAGES.length) * 100} /></div>, csv: (r) => PROJECT_STAGES[r.stage] },
            { key: 'lead', label: 'Project lead', value: (r) => staff.find((s) => s.id === r.team?.projectLead)?.name || '—' },
            { key: 'expectedHandover', label: 'Target handover', render: (r) => <span className={r.status === 'Active' && daysUntil(r.expectedHandover) < 0 ? 'danger-text' : ''}>{fmtDate(r.expectedHandover)}</span>, csv: (r) => r.expectedHandover },
            { key: 'pay', label: 'Received / Value', align: 'r', render: (r) => <><b>{inr(received(r.id))}</b><div className="muted small">of {inr(r.contractValue)}</div></>, csv: (r) => received(r.id) + ' / ' + r.contractValue },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
    </div>
  );
}

/* ---------------- CREATE / EDIT ---------------- */
function ProjectForm({ project, clientId, onClose }) {
  const clients = useCol('clients');
  const staff = useCol('staff');
  const blank = { clientId: clientId || '', title: '', siteAddress: '', lifts: 1, liftSpec: { type: 'Passenger', capacity: '', stops: '', speed: '1.0 m/s', drive: 'MRL (Gearless)', doorType: 'Auto Centre Opening', cabin: '' }, contractValue: '', expectedHandover: addDays(today(), 120), status: 'Active', team: { sales: '', projectLead: '', technicians: [] }, milestones: DEFAULT_MILESTONES.map((m) => ({ ...m, status: 'Pending' })), notes: '' };
  const { f, setF, bind } = useForm(project ? { ...blank, ...project } : blank);
  const spec = (k) => ({ value: f.liftSpec?.[k] || '', onChange: (e) => setF((p) => ({ ...p, liftSpec: { ...p.liftSpec, [k]: e.target.value } })) });
  const team = (k) => ({ value: f.team?.[k] || '', onChange: (e) => setF((p) => ({ ...p, team: { ...p.team, [k]: e.target.value } })) });
  const ms = (i, k, v) => setF((p) => ({ ...p, milestones: p.milestones.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const value = num(f.contractValue);
  const save = async () => {
    if (!f.clientId || !f.title) return alert('Client and project title are required');
    const c = clients.find((x) => x.id === f.clientId);
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    data.clientName = c?.name || data.clientName;
    data.contractValue = value;
    data.milestones = data.milestones.map((m) => ({ ...m, percent: num(m.percent), amount: Math.round((value * num(m.percent)) / 100) }));
    if (project?.id) {
      await act(() => updateDoc('projects', project.id, data, data.code), 'Project saved');
      onClose();
    } else {
      data.code = await nextNumber('PRJ');
      data.stage = 0;
      data.stageHistory = [{ stage: 0, at: Date.now(), by: me()?.name || '', note: 'Project created' }];
      const pid = await act(() => addDoc('projects', data, data.code), 'Project created');
      await postActivity({ projectId: pid, clientId: data.clientId, text: `Order confirmed — project ${data.code} started.`, visibleToClient: true, kind: 'stage' });
      go('projects/' + pid);
    }
  };
  const pctTotal = sum(f.milestones, 'percent');
  const body = (
    <>
      <div className="form-grid">
        <Field label="Client *"><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId} onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setF((p) => ({ ...p, clientId: e.target.value, siteAddress: p.siteAddress || c?.address || '' })); }} /></Field>
        <Field label="Project title *"><input {...bind('title')} placeholder="2 × Passenger Lifts – Tower B" /></Field>
        <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
        <Field label="Contract value incl. GST (₹)"><input type="number" {...bind('contractValue', 'number')} /></Field>
        <Field label="Target handover"><input type="date" {...bind('expectedHandover')} /></Field>
        <Field label="No. of lifts"><input type="number" {...bind('lifts', 'number')} /></Field>
        <Field label="Status"><Select options={['Active', 'On Hold', 'Completed', 'Cancelled']} placeholder={false} {...bind('status')} /></Field>
      </div>
      <h4 className="section-title">Lift specification</h4>
      <div className="form-grid four">
        <Field label="Type"><Select options={LIFT_TYPES} placeholder={false} {...spec('type')} /></Field>
        <Field label="Capacity"><input {...spec('capacity')} /></Field>
        <Field label="Stops"><input {...spec('stops')} /></Field>
        <Field label="Speed"><input {...spec('speed')} /></Field>
        <Field label="Drive"><Select options={DRIVES} placeholder={false} {...spec('drive')} /></Field>
        <Field label="Doors"><Select options={DOOR_TYPES} placeholder={false} {...spec('doorType')} /></Field>
        <Field label="Cabin"><input {...spec('cabin')} /></Field>
      </div>
      <h4 className="section-title">Team</h4>
      <div className="form-grid">
        <Field label="Sales person"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} {...team('sales')} /></Field>
        <Field label="Project lead"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} {...team('projectLead')} /></Field>
      </div>
      <h4 className="section-title">Payment milestones {pctTotal !== 100 && <span className="danger-text small">(total {pctTotal}% — should be 100%)</span>}</h4>
      <table className="lines-table">
        <thead><tr><th>Milestone</th><th className="r" style={{ width: 90 }}>%</th><th className="r" style={{ width: 130 }}>Amount</th><th style={{ width: 36 }} /></tr></thead>
        <tbody>
          {f.milestones.map((m, i) => (
            <tr key={i}>
              <td><input value={m.name} onChange={(e) => ms(i, 'name', e.target.value)} /></td>
              <td><input type="number" className="r" value={m.percent} onChange={(e) => ms(i, 'percent', e.target.value)} /></td>
              <td className="r">{inr((value * num(m.percent)) / 100)}</td>
              <td>{m.status === 'Pending' && <button className="icon-btn" onClick={() => setF((p) => ({ ...p, milestones: p.milestones.filter((_, j) => j !== i) }))}>✕</button>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <button className="btn ghost sm" onClick={() => setF((p) => ({ ...p, milestones: [...p.milestones, { name: '', percent: 0, status: 'Pending' }] }))}>+ Milestone</button>
      <Field label="Internal notes"><textarea rows={2} {...bind('notes')} /></Field>
    </>
  );
  return <Modal title={project ? 'Edit project' : 'New project'} wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>{body}</Modal>;
}

/* ---------------- DETAIL (the hub) ---------------- */
function ProjectDetail({ id, user }) {
  const projects = useCol('projects');
  const p = projects.find((x) => x.id === id);
  const staff = useCol('staff');
  const clients = useCol('clients');
  const invoices = useCol('invoices', [['projectId', '==', id]]);
  const activity = useCol('activity', [['projectId', '==', id]]);
  const visits = useCol('visits', [['projectId', '==', id]]);
  const dispatches = useCol('dispatches', [['projectId', '==', id]]);
  const pos = useCol('purchaseOrders', [['projectId', '==', id]]);
  const [edit, setEdit] = useState(false);
  const [advance, setAdvance] = useState(false);
  const [visit, setVisit] = useState(null);
  const [invoice, setInvoice] = useState(null);
  const [teamEdit, setTeamEdit] = useState(false);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(false);
  if (!p) return <div className="page"><Empty>Loading project…</Empty></div>;
  const client = clients.find((c) => c.id === p.clientId) || {};
  const name = (sid) => staff.find((s) => s.id === sid)?.name || '—';
  const billed = sum(invoices, 'total');
  const received = sum(invoices, 'paid');
  const editable = canEdit(user);
  const stageEditable = ['admin', 'projects', 'stores'].includes(user.role);

  const raiseMilestone = (m, i) => setInvoice({
    initial: { clientId: p.clientId, projectId: p.id, items: [{ desc: `${m.name} (${m.percent}%) — ${p.title}`, qty: 1, rate: Math.round((num(m.amount) / 1.18) * 100) / 100 }], gstRate: 18 },
    onSaved: (iid) => updateDoc('projects', p.id, { milestones: p.milestones.map((x, j) => (j === i ? { ...x, status: 'Invoiced', invoiceId: iid } : x)) }, p.code),
  });

  const postNote = async () => {
    if (!note.trim()) return;
    await act(() => postActivity({ projectId: p.id, clientId: p.clientId, text: note.trim(), visibleToClient: share }), 'Update posted');
    setNote(''); setShare(false);
  };

  return (
    <div className="page">
      <PageHeader
        title={p.title}
        sub={<>{p.code} · <a href={'#/clients/' + p.clientId}>{p.clientName}</a> · <Badge>{p.status}</Badge></>}
        actions={<>
          <button className="btn ghost" onClick={() => go('projects')}>← Projects</button>
          {client.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(client.phone, `Dear ${client.contactPerson || client.name}, update on your lift project ${p.code}: current stage — ${PROJECT_STAGES[p.stage]}. — DeeCee Elevators`)}>WhatsApp update</a>}
          {editable && <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>}
          {p.stage === PROJECT_STAGES.length - 1 && ['admin', 'service', 'projects'].includes(user.role) && <button className="btn ghost" onClick={() => go('service/amc/new/' + p.id)}>Create AMC</button>}
        </>}
      />
      <Card>
        <StageStepper stage={p.stage} />
        <div className="row gap between wrap mt">
          <span className="muted">Now: <b>{PROJECT_STAGES[p.stage]}</b> · Target handover {fmtDate(p.expectedHandover)}{p.status === 'Active' && daysUntil(p.expectedHandover) < 0 && <span className="danger-text"> (delayed)</span>}</span>
          {stageEditable && p.status !== 'Completed' && <button className="btn" onClick={() => setAdvance(true)}>Update stage →</button>}
        </div>
      </Card>

      <div className="stats">
        <Stat label="Contract value" value={inr(p.contractValue)} />
        <Stat label="Invoiced" value={inr(billed)} />
        <Stat label="Received" value={inr(received)} tone="green" />
        <Stat label="Balance (contract − received)" value={inr(num(p.contractValue) - received)} tone={num(p.contractValue) - received > 0 ? 'amber' : ''} />
      </div>

      <div className="grid-2">
        <Card title="Payment milestones">
          <table className="mini-table">
            <tbody>
              {(p.milestones || []).map((m, i) => {
                const inv = invoices.find((x) => x.id === m.invoiceId);
                return (
                  <tr key={i}>
                    <td><b>{m.name}</b><div className="muted small">{m.percent}% · {inr(m.amount)}</div></td>
                    <td><Badge>{m.status}</Badge>{inv && <div className="small"><a href={'#/billing/invoices/' + inv.id}>{inv.number}</a> · paid {inr(inv.paid)}</div>}</td>
                    <td className="r">{m.status === 'Pending' && ['admin', 'accounts'].includes(user.role) && <button className="btn ghost sm" onClick={() => raiseMilestone(m, i)}>Raise invoice</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
        <Card title="Lift & site">
          <dl className="dl">
            <dt>Lifts</dt><dd>{p.lifts} × {p.liftSpec?.type}</dd>
            <dt>Capacity</dt><dd>{p.liftSpec?.capacity || '—'}</dd>
            <dt>Stops</dt><dd>{p.liftSpec?.stops || '—'}</dd>
            <dt>Drive / Speed</dt><dd>{p.liftSpec?.drive} · {p.liftSpec?.speed}</dd>
            <dt>Doors</dt><dd>{p.liftSpec?.doorType}</dd>
            <dt>Site</dt><dd>{p.siteAddress ? <a href={mapsLink(p.siteAddress)} target="_blank" rel="noreferrer">{p.siteAddress}</a> : '—'}</dd>
            <dt>Site contact</dt><dd>{client.contactPerson} {client.phone && <a href={'tel:' + client.phone}>{client.phone}</a>}</dd>
          </dl>
        </Card>
        <Card title="Team" actions={editable && <button className="btn ghost sm" onClick={() => setTeamEdit(true)}>Edit team</button>}>
          <dl className="dl">
            <dt>Sales</dt><dd>{name(p.team?.sales)}</dd>
            <dt>Project lead</dt><dd>{name(p.team?.projectLead)}</dd>
            <dt>Technicians</dt><dd>{(p.team?.technicians || []).map(name).join(', ') || '—'}</dd>
          </dl>
        </Card>
        <Card title="Field jobs" actions={['admin', 'projects', 'service'].includes(user.role) && <button className="btn ghost sm" onClick={() => setVisit({ type: 'Installation Work', clientId: p.clientId, clientName: p.clientName, projectId: p.id, siteAddress: p.siteAddress, contactPhone: client.phone, technicianId: p.team?.technicians?.[0] || '' })}>+ Schedule job</button>}>
          {visits.length === 0 ? <Empty>No jobs scheduled</Empty> : (
            <ul className="list">{[...visits].sort((a, b) => (a.date < b.date ? 1 : -1)).map((v) => (
              <li key={v.id} className="clickable" onClick={() => go('service/visits/' + v.id)}><div><b>{v.title}</b><div className="muted small">{fmtDate(v.date)} · {name(v.technicianId)}</div></div><Badge>{v.status}</Badge></li>
            ))}</ul>
          )}
        </Card>
        <Card title="Material" actions={['admin', 'stores'].includes(user.role) && <button className="btn ghost sm" onClick={() => go('inventory/dispatch/new/' + p.id)}>+ Dispatch</button>}>
          {dispatches.length + pos.length === 0 ? <Empty>No purchase orders or dispatches yet</Empty> : (
            <ul className="list">
              {pos.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">PO · {x.vendorName}</span><div className="muted small">{x.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div></div><Badge>{x.status}</Badge></li>)}
              {dispatches.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">Dispatch · {fmtDate(x.date)}</span><div className="muted small">{x.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div></div><Badge>{x.status}</Badge></li>)}
            </ul>
          )}
        </Card>
        <Card title="Site photos" actions={<PhotoUploader refId={p.id} clientId={p.clientId} projectId={p.id} />}>
          <PhotoGrid refId={p.id} canDelete={editable} />
        </Card>
      </div>

      <Card title="Project timeline — all teams">
        <div className="composer">
          <textarea rows={2} placeholder="Post an update for the team (e.g. 'Machine room hook pending from client')" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row gap between">
            <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Share with client on portal</label>
            <button className="btn sm" onClick={postNote}>Post</button>
          </div>
        </div>
        <ActivityFeed items={activity} />
        <details className="mt"><summary className="muted small">Stage history</summary>
          <ul className="feed">{(p.stageHistory || []).map((h, i) => <li key={i}><b>{PROJECT_STAGES[h.stage]}</b> <span className="muted small">· {fmtDateTime(h.at)} · {h.by}</span>{h.note && <div className="feed-text">{h.note}</div>}</li>)}</ul>
        </details>
      </Card>

      {user.role === 'admin' && <p className="r"><button className="link danger" onClick={() => confirm('Delete this project permanently? Invoices and jobs stay.') && act(() => deleteDoc('projects', p.id, p.code), 'Deleted').then(() => go('projects'))}>Delete project</button></p>}

      {edit && <ProjectForm project={p} onClose={() => setEdit(false)} />}
      {advance && <StageModal p={p} onClose={() => setAdvance(false)} />}
      {visit && <VisitForm initial={visit} onClose={() => setVisit(null)} />}
      {invoice && <InvoiceForm initial={invoice.initial} onSaved={invoice.onSaved} onClose={() => setInvoice(null)} />}
      {teamEdit && <TeamModal p={p} staff={staff} onClose={() => setTeamEdit(false)} />}
    </div>
  );
}

function StageModal({ p, onClose }) {
  const [stage, setStage] = useState(Math.min(p.stage + 1, PROJECT_STAGES.length - 1));
  const [note, setNote] = useState('');
  const [share, setShare] = useState(true);
  const save = async () => {
    const done = stage === PROJECT_STAGES.length - 1;
    await act(async () => {
      await updateDoc('projects', p.id, { stage, status: done ? 'Completed' : p.status, stageHistory: [...(p.stageHistory || []), { stage, at: Date.now(), by: me()?.name || '', note }], ...(done ? { handoverDate: today() } : {}) }, p.code);
      await postActivity({ projectId: p.id, clientId: p.clientId, text: `Stage updated: ${PROJECT_STAGES[stage]}${note ? ' — ' + note : ''}`, visibleToClient: share, kind: 'stage' });
    }, 'Stage updated');
    onClose();
  };
  return (
    <Modal title="Update project stage" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Update</button></>}>
      <Field label="New stage"><Select options={PROJECT_STAGES.map((s, i) => ({ value: i, label: `${i + 1}. ${s}` }))} placeholder={false} value={stage} onChange={(e) => setStage(Number(e.target.value))} /></Field>
      <Field label="Note"><textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What happened / what's next" /></Field>
      <label className="check"><input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} /> Show this update to the client on their portal</label>
      {stage === PROJECT_STAGES.length - 1 && <p className="muted small">Handover marks the project Completed. You can then create an AMC from the project page.</p>}
    </Modal>
  );
}

function TeamModal({ p, staff, onClose }) {
  const [techs, setTechs] = useState(p.team?.technicians || []);
  const [lead, setLead] = useState(p.team?.projectLead || '');
  const save = async () => { await act(() => updateDoc('projects', p.id, { team: { ...(p.team || {}), technicians: techs, projectLead: lead } }, p.code), 'Team updated'); onClose(); };
  return (
    <Modal title="Project team" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <Field label="Project lead"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} value={lead} onChange={(e) => setLead(e.target.value)} /></Field>
      <div className="field"><span className="field-label">Technicians on this site</span>
        <div className="checks">
          {technicianOptions(staff).map((o) => (
            <label key={o.value} className="check"><input type="checkbox" checked={techs.includes(o.value)} onChange={(e) => setTechs(e.target.checked ? [...techs, o.value] : techs.filter((x) => x !== o.value))} /> {o.label}</label>
          ))}
        </div>
      </div>
    </Modal>
  );
}
