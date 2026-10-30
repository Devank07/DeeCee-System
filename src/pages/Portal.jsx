import React, { useState } from 'react';
import { useCol, Card, Badge, Empty, Pipeline, ActivityFeed, Modal, Field, Select, useForm, act, PrintDoc, useSettings, Tabs, ProgressBar, FileList } from '../ui';
import { addDoc, nextNumber, backend } from '../data';
import { inr, fmtDate, fmtDateTime, num, sum, daysUntil, waLink } from '../utils';
import { steps, progressPct, milestoneStatus } from '../workflow';
import { invStatus } from './Billing';

export default function Portal({ user }) {
  const cid = user.clientId || '_none_';
  const company = useSettings();
  const projects = useCol('projects', [['clientId', '==', cid]]).filter((p) => ['Order', 'Completed', 'On Hold'].includes(p.status));
  const invoices = useCol('invoices', [['clientId', '==', cid]]).filter((i) => i.status !== 'Cancelled');
  const payments = useCol('payments', [['clientId', '==', cid]]);
  const amcs = useCol('amcs', [['clientId', '==', cid]]);
  const complaints = useCol('complaints', [['clientId', '==', cid]]);
  const visits = useCol('visits', [['clientId', '==', cid]]);
  const activity = useCol('activity', [['clientId', '==', cid], ['visibleToClient', '==', true]]);
  const [tab, setTab] = useState('projects');
  const [raise, setRaise] = useState(false);
  const [print, setPrint] = useState(null);
  const due = sum(invoices, (i) => num(i.total) - num(i.paid));
  const openC = complaints.filter((c) => !['Resolved', 'Closed'].includes(c.status));

  return (
    <div className="portal">
      <header className="portal-head">
        <div className="brand"><div className="logo">DC</div><div><b>{company.name}</b><span>Customer portal</span></div></div>
        <div className="row gap">
          {company.phone && <a className="btn ghost sm" href={'tel:' + company.phone}>Call us</a>}
          <button className="btn ghost sm" onClick={() => backend().logout()}>Sign out</button>
        </div>
      </header>
      <div className="portal-body">
        <h1>Welcome, {user.name}</h1>
        <div className="stats">
          <div className="stat"><span className="stat-label">Lift projects</span><span className="stat-value">{projects.length}</span></div>
          <div className={'stat ' + (due > 0 ? 'amber' : 'green')}><span className="stat-label">Invoices due</span><span className="stat-value">{inr(due)}</span></div>
          <div className="stat"><span className="stat-label">Open complaints</span><span className="stat-value">{openC.length}</span></div>
          <div className="stat"><span className="stat-label">AMC</span><span className="stat-value small-v">{amcs.find((a) => daysUntil(a.end) >= 0 && a.status === 'Active') ? 'Active' : amcs.length ? 'Expired' : '—'}</span></div>
        </div>
        <button className="btn danger-btn wide" onClick={() => setRaise(true)}>🚨 Report a lift problem</button>
        <Tabs value={tab} onChange={setTab} tabs={[{ key: 'projects', label: 'My lifts' }, { key: 'payments', label: 'Payments' }, { key: 'service', label: 'Service & AMC' }, { key: 'updates', label: 'Updates' }]} />

        {tab === 'projects' && (projects.length === 0 ? <Empty>No projects yet</Empty> : projects.map((p) => {
          const paid = sum(payments.filter((x) => x.projectId === p.id), 'amount');
          const paidFor = (i) => sum(payments.filter((x) => x.projectId === p.id && x.milestone === i), 'amount');
          const current = steps(p).find((s) => !s.done);
          return (
            <Card key={p.id} title={p.title} actions={<Badge>{p.status === 'Order' ? 'In progress' : p.status}</Badge>}>
              <p className="muted small">{p.code} · {p.siteAddress}</p>
              <Pipeline p={p} />
              <div className="portal-now">
                <div><span className="muted small">Current stage</span><b>{current ? current.label : 'Handed over'}</b></div>
                <div><span className="muted small">Overall progress</span><b>{progressPct(p)}%</b></div>
                {p.status === 'Order' && p.expectedHandover && <div><span className="muted small">Expected handover</span><b>{fmtDate(p.expectedHandover)}</b></div>}
                {p.install?.progress > 0 && p.install.progress < 100 && <div><span className="muted small">Installation</span><b>{p.install.progress}% done</b></div>}
              </div>
              <h4 className="section-title">Drawings</h4>
              <FileList projectId={p.id} clientId={cid} kind="Drawing" clientView />
              <h4 className="section-title">Payments</h4>
              <div className="pay-sum">
                <div><span>Order value</span><b>{inr(p.contractValue)}</b></div>
                <div><span>Paid</span><b className="ok-text">{inr(paid)}</b></div>
                <div><span>Balance</span><b>{inr(num(p.contractValue) - paid)}</b></div>
              </div>
              <ProgressBar value={(paid / (num(p.contractValue) || 1)) * 100} tone="green" />
              <ul className="list">{(p.milestones || []).map((m, i) => <li key={i}><span>{m.name} ({m.percent}%)</span><span className="nowrap">{inr(m.amount)} <Badge>{milestoneStatus(m, paidFor(i))}</Badge></span></li>)}</ul>
              <ClientPhotos cid={cid} pid={p.id} />
              <FileList projectId={p.id} clientId={cid} kind="Document" clientView hideEmpty />
            </Card>
          );
        }))}

        {tab === 'payments' && (<>
          <Card title="Invoices" pad={false}>
            {invoices.length === 0 ? <Empty>No invoices</Empty> : (
              <ul className="list pad">{[...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).map((i) => (
                <li key={i.id}>
                  <div><b>{i.number}</b><div className="muted small">{fmtDate(i.date)} · {inr(i.total)}{num(i.paid) > 0 && ' · paid ' + inr(i.paid)}</div></div>
                  <div className="row gap"><Badge>{invStatus(i)}</Badge><button className="btn ghost sm" onClick={() => setPrint(i)}>View</button></div>
                </li>
              ))}</ul>
            )}
            {due > 0 && company.bank && <div className="card-body"><b>Pay by bank transfer</b><div className="pre small">{company.bank}</div></div>}
          </Card>
          <Card title="Payments received" pad={false}>
            {payments.length === 0 ? <Empty>No payments yet</Empty> : <ul className="list pad">{[...payments].sort((a, b) => (a.date < b.date ? 1 : -1)).map((x) => <li key={x.id}><span>{fmtDate(x.date)} · {x.mode}</span><b>{inr(x.amount)}</b></li>)}</ul>}
          </Card>
        </>)}

        {tab === 'service' && (<>
          {amcs.map((a) => (
            <Card key={a.id} title={`AMC ${a.number}`} actions={<Badge tone={daysUntil(a.end) < 0 ? 'red' : daysUntil(a.end) <= 30 ? 'amber' : 'green'}>{daysUntil(a.end) < 0 ? 'Expired' : 'Active'}</Badge>}>
              <p>{a.type} · {a.lifts} lift(s) · {fmtDate(a.start)} → {fmtDate(a.end)}</p>
              {daysUntil(a.end) <= 30 && company.phone && <a className="btn sm" target="_blank" rel="noreferrer" href={waLink(company.phone, `Hello, we would like to renew our AMC ${a.number} (${user.name}).`)}>Request renewal</a>}
            </Card>
          ))}
          <Card title="Complaints">
            {complaints.length === 0 ? <Empty>No complaints</Empty> : (
              <ul className="list">{[...complaints].sort((a, b) => b.reportedAt - a.reportedAt).map((c) => (
                <li key={c.id}><div><b>{c.issue}</b><div className="muted small">{c.number} · {fmtDateTime(c.reportedAt)}{c.resolution && ' · ' + c.resolution}</div></div><Badge>{c.status}</Badge></li>
              ))}</ul>
            )}
          </Card>
          <Card title="Service visits">
            {visits.filter((v) => v.status === 'Done').length === 0 ? <Empty>No visits yet</Empty> : (
              <ul className="list">{visits.filter((v) => v.status === 'Done').sort((a, b) => b.doneAt - a.doneAt).map((v) => (
                <li key={v.id}><div><b>{v.type}</b><div className="muted small">{fmtDate(v.date)} · {v.notes}</div></div><Badge>Done</Badge></li>
              ))}</ul>
            )}
            {visits.some((v) => v.status !== 'Done') && <p className="muted small">Upcoming: {visits.filter((v) => v.status !== 'Done').map((v) => `${v.type} on ${fmtDate(v.date)}`).join(' · ')}</p>}
          </Card>
        </>)}

        {tab === 'updates' && <Card><ActivityFeed items={activity} showFlags={false} limit={60} /></Card>}
      </div>
      {raise && <RaiseComplaint user={user} amcs={amcs} projects={projects} onClose={() => setRaise(false)} />}
      {print && <PrintDoc kind="Tax Invoice" doc={print} company={company} onClose={() => setPrint(null)} />}
    </div>
  );
}

function ClientPhotos({ cid, pid }) {
  const photos = useCol('photos', [['clientId', '==', cid], ['projectId', '==', pid], ['visibleToClient', '==', true]]);
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  return (<>
    <h4 className="section-title">Site photos</h4>
    <div className="photo-grid">{[...photos].sort((a, b) => b.at - a.at).slice(0, 24).map((p) => <div className="photo" key={p.id}><img src={p.data} alt="Site" onClick={() => setOpen(p)} /></div>)}</div>
    {open && <div className="lightbox" onClick={() => setOpen(null)}><img src={open.data} alt="" /><span>{fmtDateTime(open.at)}</span></div>}
  </>);
}

function RaiseComplaint({ user, amcs, projects, onClose }) {
  const { f, bind } = useForm({ liftRef: '', issue: '', priority: 'Normal', contactPhone: '' });
  const [done, setDone] = useState(null);
  const save = async () => {
    if (!f.issue.trim()) return act(async () => { throw new Error('Please describe the problem'); });
    const a = amcs.find((x) => x.status === 'Active' && daysUntil(x.end) >= 0);
    const number = await nextNumber('CMP');
    await act(() => addDoc('complaints', { ...f, number, clientId: user.clientId, clientName: user.name, amcId: a?.id || null, projectId: a?.projectId || projects[0]?.id || null, status: 'Open', teamId: null, assignedTo: null, reportedVia: 'Client Portal', reportedAt: Date.now() }));
    setDone(number);
  };
  if (done) return <Modal title="Complaint registered" onClose={onClose} footer={<button className="btn" onClick={onClose}>OK</button>}><p>Your complaint number is <b>{done}</b>. Our service team has been alerted and will contact you shortly.</p><p className="muted small">If someone is trapped inside the lift, please also call us immediately.</p></Modal>;
  return (
    <Modal title="Report a lift problem" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Submit</button></>}>
      <div className="form-grid">
        <Field label="Which lift / location"><input {...bind('liftRef')} placeholder="e.g. Tower A, Lift 1" /></Field>
        <Field label="How urgent?"><Select options={['Normal', 'High', 'Critical (Trapped / Stuck)']} placeholder={false} {...bind('priority')} /></Field>
        <Field label="What's the problem?" span={2}><textarea rows={4} {...bind('issue')} placeholder="Describe what is happening" /></Field>
        <Field label="Your phone number" span={2}><input {...bind('contactPhone')} inputMode="tel" /></Field>
      </div>
    </Modal>
  );
}
