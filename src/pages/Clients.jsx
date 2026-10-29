import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, useForm, act, go, Badge, Stat, ActivityFeed, Empty } from '../ui';
import { addDoc, updateDoc, deleteDoc, backend } from '../data';
import { inr, sum, num, fmtDate, waLink, mapsLink, daysUntil } from '../utils';
import { PROJECT_STAGES } from '../constants';

export function ClientForm({ client, onClose, onSaved }) {
  const { f, bind } = useForm(client || { name: '', contactPerson: '', phone: '', email: '', address: '', city: '', gstin: '' });
  const save = async () => {
    if (!f.name.trim()) return alert('Client name is required');
    const data = { name: f.name.trim(), contactPerson: f.contactPerson || '', phone: f.phone || '', email: f.email || '', address: f.address || '', city: f.city || '', gstin: (f.gstin || '').toUpperCase(), notes: f.notes || '' };
    const id = client?.id
      ? (await act(() => updateDoc('clients', client.id, data, data.name), 'Client updated'), client.id)
      : await act(() => addDoc('clients', data, data.name), 'Client added');
    onSaved?.(id, data);
    onClose();
  };
  return (
    <Modal title={client?.id ? 'Edit client' : 'New client'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Client / company name *" span={2}><input {...bind('name')} autoFocus /></Field>
        <Field label="Contact person"><input {...bind('contactPerson')} /></Field>
        <Field label="Phone"><input {...bind('phone')} inputMode="tel" /></Field>
        <Field label="Email"><input {...bind('email')} type="email" /></Field>
        <Field label="City"><input {...bind('city')} /></Field>
        <Field label="Address" span={2}><textarea rows={2} {...bind('address')} /></Field>
        <Field label="GSTIN"><input {...bind('gstin')} /></Field>
        <Field label="Notes"><input {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

export default function Clients({ user, params }) {
  const clients = useCol('clients');
  const projects = useCol('projects');
  const invoices = useCol('invoices');
  const amcs = useCol('amcs');
  const [form, setForm] = useState(null);
  const id = params[0];
  if (id) {
    const c = clients.find((x) => x.id === id);
    return c ? <ClientDetail c={c} user={user} onEdit={() => setForm(c)} form={form} setForm={setForm} /> : <div className="page"><Empty>Loading…</Empty></div>;
  }
  const bal = (cid) => sum(invoices.filter((i) => i.clientId === cid), (i) => num(i.total) - num(i.paid));
  return (
    <div className="page">
      <PageHeader title="Clients" sub="Every customer with their projects, AMCs, dues and complaints in one place" actions={<button className="btn" onClick={() => setForm({})}>+ New client</button>} />
      <Card pad={false}>
        <DataTable
          csvName="clients"
          rows={clients}
          onRow={(r) => go('clients/' + r.id)}
          initialSort={{ key: 'name' }}
          columns={[
            { key: 'name', label: 'Client', render: (r) => <><b>{r.name}</b><div className="muted small">{r.contactPerson}</div></> , csv: (r) => r.name },
            { key: 'phone', label: 'Phone' },
            { key: 'city', label: 'City' },
            { key: 'projects', label: 'Projects', align: 'r', value: (r) => projects.filter((p) => p.clientId === r.id).length },
            { key: 'amc', label: 'AMC', render: (r) => { const a = amcs.find((x) => x.clientId === r.id && x.status === 'Active'); return a ? <Badge tone={daysUntil(a.end) < 0 ? 'red' : daysUntil(a.end) <= 30 ? 'amber' : 'green'}>{daysUntil(a.end) < 0 ? 'Expired' : 'Till ' + fmtDate(a.end)}</Badge> : <span className="muted">—</span>; }, csv: (r) => amcs.find((x) => x.clientId === r.id)?.end || '' },
            { key: 'due', label: 'Outstanding', align: 'r', value: (r) => { const b = bal(r.id); return b > 0 ? inr(b) : '—'; }, sortValue: (r) => bal(r.id), csv: (r) => bal(r.id) },
          ]}
        />
      </Card>
      {form && <ClientForm client={form.id ? form : null} onClose={() => setForm(null)} onSaved={(nid) => !form.id && go('clients/' + nid)} />}
    </div>
  );
}

function ClientDetail({ c, user, onEdit, form, setForm }) {
  const projects = useCol('projects', [['clientId', '==', c.id]]);
  const invoices = useCol('invoices', [['clientId', '==', c.id]]);
  const payments = useCol('payments', [['clientId', '==', c.id]]);
  const amcs = useCol('amcs', [['clientId', '==', c.id]]);
  const complaints = useCol('complaints', [['clientId', '==', c.id]]);
  const activity = useCol('activity', [['clientId', '==', c.id]]);
  const users = useCol('users', [['clientId', '==', c.id]], user.role === 'admin');
  const [portal, setPortal] = useState(false);
  const billed = sum(invoices, 'total');
  const paid = sum(invoices, 'paid');
  return (
    <div className="page">
      <PageHeader
        title={c.name}
        sub={[c.contactPerson, c.city].filter(Boolean).join(' · ')}
        actions={<>
          <button className="btn ghost" onClick={() => go('clients')}>← All clients</button>
          {c.phone && <a className="btn ghost" href={'tel:' + c.phone}>Call</a>}
          {c.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(c.phone, `Hello ${c.contactPerson || ''}, `)}>WhatsApp</a>}
          <button className="btn ghost" onClick={onEdit}>Edit</button>
          {user.role === 'admin' && <button className="btn" onClick={() => setPortal(true)}>Client portal login</button>}
        </>}
      />
      <div className="stats">
        <Stat label="Projects" value={projects.length} />
        <Stat label="Billed" value={inr(billed)} />
        <Stat label="Received" value={inr(paid)} tone="green" />
        <Stat label="Outstanding" value={inr(billed - paid)} tone={billed - paid > 0 ? 'amber' : ''} />
      </div>
      <div className="grid-2">
        <Card title="Details">
          <dl className="dl">
            <dt>Phone</dt><dd>{c.phone || '—'}</dd>
            <dt>Email</dt><dd>{c.email || '—'}</dd>
            <dt>Address</dt><dd>{c.address ? <a href={mapsLink(c.address)} target="_blank" rel="noreferrer">{c.address}</a> : '—'}</dd>
            <dt>GSTIN</dt><dd>{c.gstin || '—'}</dd>
            {c.notes && <><dt>Notes</dt><dd>{c.notes}</dd></>}
            {user.role === 'admin' && <><dt>Portal access</dt><dd>{users.length ? users.map((u) => u.email).join(', ') : <span className="muted">Not set up</span>}</dd></>}
          </dl>
        </Card>
        <Card title="Projects" actions={<button className="btn ghost sm" onClick={() => go('projects/new/' + c.id)}>+ Project</button>}>
          {projects.length === 0 ? <Empty /> : (
            <ul className="list">{projects.map((p) => (
              <li key={p.id} onClick={() => go('projects/' + p.id)} className="clickable"><div><b>{p.title}</b><div className="muted small">{p.code} · {PROJECT_STAGES[p.stage]}</div></div><Badge>{p.status}</Badge></li>
            ))}</ul>
          )}
        </Card>
        <Card title="Invoices & payments">
          {invoices.length === 0 ? <Empty /> : (
            <ul className="list">{invoices.map((i) => (
              <li key={i.id} className="clickable" onClick={() => go('billing/invoices/' + i.id)}><div><b>{i.number}</b><div className="muted small">{fmtDate(i.date)} · {inr(i.total)}</div></div><Badge>{num(i.paid) >= num(i.total) ? 'Paid' : num(i.paid) > 0 ? 'Partly Paid' : 'Unpaid'}</Badge></li>
            ))}</ul>
          )}
          {payments.length > 0 && <p className="muted small">Last payment: {inr(payments.sort((a, b) => (b.date > a.date ? 1 : -1))[0].amount)} on {fmtDate(payments[0].date)}</p>}
        </Card>
        <Card title="AMC & complaints">
          {amcs.map((a) => <div key={a.id} className="list-line clickable" onClick={() => go('service/amc/' + a.id)}><b>{a.number}</b> {a.type} · {fmtDate(a.start)} → {fmtDate(a.end)} <Badge tone={daysUntil(a.end) < 0 ? 'red' : 'green'}>{daysUntil(a.end) < 0 ? 'Expired' : 'Active'}</Badge></div>)}
          {complaints.slice(0, 6).map((x) => <div key={x.id} className="list-line clickable" onClick={() => go('service/complaints/' + x.id)}><Badge>{x.status}</Badge> {x.issue}</div>)}
          {!amcs.length && !complaints.length && <Empty />}
        </Card>
      </div>
      <Card title="Timeline"><ActivityFeed items={activity} /></Card>
      {form && <ClientForm client={form} onClose={() => setForm(null)} />}
      {portal && <PortalLogin client={c} onClose={() => setPortal(false)} />}
      {user.role === 'admin' && !projects.length && !invoices.length && (
        <p className="r"><button className="link danger" onClick={() => confirm('Delete this client permanently?') && act(() => deleteDoc('clients', c.id, c.name), 'Client deleted').then(() => go('clients'))}>Delete client</button></p>
      )}
    </div>
  );
}

function PortalLogin({ client, onClose }) {
  const { f, bind } = useForm({ email: client.email || '', password: '' });
  const create = async () => {
    if (!f.email || (f.password || '').length < 6) return alert('Enter an email and a password of at least 6 characters');
    await act(() => backend().createAccount({ email: f.email, password: f.password, name: client.name, role: 'client', clientId: client.id }), 'Portal login created');
    onClose();
  };
  return (
    <Modal title="Create client portal login" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={create}>Create login</button></>}>
      <p className="muted">The client will be able to see their project progress, invoices, payments, AMC and raise complaints. Share these details with them.</p>
      <div className="form-grid">
        <Field label="Login email"><input type="email" {...bind('email')} /></Field>
        <Field label="Temporary password" hint="At least 6 characters"><input {...bind('password')} /></Field>
      </div>
    </Modal>
  );
}
