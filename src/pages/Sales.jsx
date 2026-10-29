import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Tabs, LineItems, PrintDoc, useSettings } from '../ui';
import { addDoc, updateDoc, deleteDoc, nextNumber, postActivity, me } from '../data';
import { LEAD_STATUSES, LEAD_SOURCES, QUOTE_STATUSES, LIFT_TYPES, DOOR_TYPES, DRIVES, DEFAULT_MILESTONES } from '../constants';
import { inr, fmtDate, today, addDays, calcTotals, waLink, sum } from '../utils';

export default function Sales({ params }) {
  const tab = params[0] === 'quotes' ? 'quotes' : 'leads';
  return (
    <div className="page">
      <PageHeader title="Leads & Quotations" sub="Track every enquiry from first call to signed order" />
      <Tabs value={tab} onChange={(k) => go('sales/' + k)} tabs={[{ key: 'leads', label: 'Leads' }, { key: 'quotes', label: 'Quotations' }]} />
      {tab === 'leads' ? <Leads openId={params[1]} /> : <Quotes openId={params[1]} />}
    </div>
  );
}

/* ---------------- LEADS ---------------- */
function Leads({ openId }) {
  const leads = useCol('leads');
  const staff = useCol('staff');
  const [filter, setFilter] = useState('Open');
  const [form, setForm] = useState(null);
  const open = openId && leads.find((l) => l.id === openId);
  const staffName = (id) => staff.find((s) => s.id === id)?.name || '—';
  const rows = leads.filter((l) => (filter === 'All' ? true : filter === 'Open' ? !['Won', 'Lost'].includes(l.status) : l.status === filter));
  return (
    <>
      <div className="chips">
        {['Open', ...LEAD_STATUSES, 'All'].map((s) => (
          <button key={s} className={'chip' + (filter === s ? ' on' : '')} onClick={() => setFilter(s)}>
            {s} <span>{s === 'All' ? leads.length : s === 'Open' ? leads.filter((l) => !['Won', 'Lost'].includes(l.status)).length : leads.filter((l) => l.status === s).length}</span>
          </button>
        ))}
        <span className="spacer" />
        <button className="btn" onClick={() => setForm({})}>+ New lead</button>
      </div>
      <Card pad={false}>
        <DataTable
          csvName="leads" rows={rows} onRow={(r) => go('sales/leads/' + r.id)} initialSort={{ key: 'followUpDate' }}
          columns={[
            { key: 'name', label: 'Lead', render: (r) => <><b>{r.name}</b>{r.company && <div className="muted small">{r.company}</div>}</>, csv: (r) => r.name + (r.company ? ' / ' + r.company : '') },
            { key: 'requirement', label: 'Requirement' },
            { key: 'city', label: 'City' },
            { key: 'value', label: 'Est. value', align: 'r', value: (r) => (r.value ? inr(r.value) : '—'), sortValue: (r) => r.value || 0, csv: (r) => r.value },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
            { key: 'followUpDate', label: 'Follow-up', render: (r) => <span className={r.followUpDate && r.followUpDate <= today() && !['Won', 'Lost'].includes(r.status) ? 'danger-text' : ''}>{fmtDate(r.followUpDate)}</span>, csv: (r) => r.followUpDate },
            { key: 'assignedTo', label: 'Owner', value: (r) => staffName(r.assignedTo) },
          ]}
        />
      </Card>
      <p className="muted small">Pipeline (open leads): <b>{inr(sum(leads.filter((l) => !['Won', 'Lost'].includes(l.status)), 'value'))}</b></p>
      {(form || open) && <LeadForm key={form ? 'new' : open.id} lead={form?.id || !form ? open : null} staff={staff} onClose={() => { setForm(null); if (openId) go('sales/leads'); }} />}
    </>
  );
}

function LeadForm({ lead, staff, onClose }) {
  const { f, bind } = useForm(lead || { name: '', company: '', phone: '', email: '', city: '', source: 'Phone', requirement: '', status: 'New', assignedTo: me()?.staffId || '', followUpDate: addDays(today(), 1), value: '', notes: '' });
  const [quote, setQuote] = useState(false);
  const save = async (close = true) => {
    if (!f.name?.trim()) return alert('Name is required');
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    if (lead?.id) await act(() => updateDoc('leads', lead.id, data, data.name), 'Lead saved');
    else await act(() => addDoc('leads', data, data.name), 'Lead added');
    if (close) onClose();
  };
  return (
    <>
      <Modal title={lead?.id ? 'Lead — ' + lead.name : 'New lead'} onClose={onClose} wide
        footer={<>
          {lead?.id && <button className="btn ghost danger" onClick={() => confirm('Delete lead?') && act(() => deleteDoc('leads', lead.id, lead.name), 'Deleted').then(onClose)}>Delete</button>}
          <span className="spacer" />
          {lead?.id && f.phone && <a className="btn ghost" href={waLink(f.phone, `Namaste ${f.name}, thank you for your enquiry with DeeCee Elevators. `)} target="_blank" rel="noreferrer">WhatsApp</a>}
          {lead?.id && <button className="btn ghost" onClick={() => setQuote(true)}>Create quotation</button>}
          <button className="btn" onClick={() => save()}>Save</button>
        </>}>
        <div className="form-grid">
          <Field label="Name *"><input {...bind('name')} autoFocus /></Field>
          <Field label="Company / Building"><input {...bind('company')} /></Field>
          <Field label="Phone"><input {...bind('phone')} inputMode="tel" /></Field>
          <Field label="Email"><input {...bind('email')} /></Field>
          <Field label="City / Site"><input {...bind('city')} /></Field>
          <Field label="Source"><Select options={LEAD_SOURCES} {...bind('source')} /></Field>
          <Field label="Requirement" span={2}><textarea rows={2} {...bind('requirement')} placeholder="e.g. 2 passenger lifts, G+8, MRL" /></Field>
          <Field label="Status"><Select options={LEAD_STATUSES} placeholder={false} {...bind('status')} /></Field>
          <Field label="Estimated value (₹)"><input type="number" {...bind('value', 'number')} /></Field>
          <Field label="Next follow-up"><input type="date" {...bind('followUpDate')} /></Field>
          <Field label="Assigned to"><Select options={staff.filter((s) => s.active !== false).map((s) => ({ value: s.id, label: s.name }))} {...bind('assignedTo')} /></Field>
          {f.status === 'Lost' && <Field label="Lost reason" span={2}><input {...bind('lostReason')} /></Field>}
          <Field label="Notes / call log" span={2}><textarea rows={3} {...bind('notes')} /></Field>
        </div>
      </Modal>
      {quote && <QuoteEditor initial={{ leadId: lead.id, clientName: f.company || f.name, clientContact: f.name, phone: f.phone, address: f.city }} onClose={() => { setQuote(false); onClose(); }} />}
    </>
  );
}

/* ---------------- QUOTATIONS ---------------- */
function Quotes({ openId }) {
  const quotes = useCol('quotations');
  const [edit, setEdit] = useState(null);
  const open = openId && quotes.find((q) => q.id === openId);
  return (
    <>
      <div className="chips"><span className="spacer" /><button className="btn" onClick={() => setEdit({})}>+ New quotation</button></div>
      <Card pad={false}>
        <DataTable
          csvName="quotations" rows={quotes} onRow={(r) => go('sales/quotes/' + r.id)} initialSort={{ key: 'date', desc: true }}
          columns={[
            { key: 'number', label: 'No.' },
            { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
            { key: 'clientName', label: 'Client' },
            { key: 'lift', label: 'Lift', value: (r) => [r.lifts && r.lifts + ' ×', r.liftSpec?.type, r.liftSpec?.stops].filter(Boolean).join(' ') },
            { key: 'total', label: 'Total', align: 'r', value: (r) => inr(calcTotals(r.items, r.gstRate, r.discount).total), sortValue: (r) => calcTotals(r.items, r.gstRate, r.discount).total, csv: (r) => calcTotals(r.items, r.gstRate, r.discount).total },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
      {(edit || open) && <QuoteEditor key={edit ? 'new' : open.id} initial={edit?.id || !edit ? open : edit} onClose={() => { setEdit(null); if (openId) go('sales/quotes'); }} />}
    </>
  );
}

export function QuoteEditor({ initial, onClose }) {
  const company = useSettings();
  const clients = useCol('clients');
  const blank = { number: '', date: today(), validTill: addDays(today(), 30), status: 'Draft', clientId: '', clientName: '', clientContact: '', phone: '', address: '', lifts: 1, liftSpec: { type: 'Passenger', capacity: '', stops: '', speed: '1.0 m/s', drive: 'MRL (Gearless)', doorType: 'Auto Centre Opening', cabin: 'SS Hairline' }, items: [{ desc: '', qty: 1, rate: 0 }], gstRate: company.defaultGst ?? 18, discount: 0, terms: company.quoteTerms || '' };
  const { f, setF, bind, set } = useForm({ ...blank, ...(initial || {}), liftSpec: { ...blank.liftSpec, ...(initial?.liftSpec || {}) } });
  const [print, setPrint] = useState(false);
  const spec = (k) => ({ value: f.liftSpec[k] || '', onChange: (e) => setF((p) => ({ ...p, liftSpec: { ...p.liftSpec, [k]: e.target.value } })) });
  const isNew = !f.id;
  const t = calcTotals(f.items, f.gstRate, f.discount);

  const persist = async () => {
    if (!f.clientName) { alert('Enter client name'); return null; }
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    data.total = t.total;
    if (isNew) {
      data.number = await nextNumber('QT');
      const nid = await act(() => addDoc('quotations', data, data.number), 'Quotation saved');
      setF((p) => ({ ...p, id: nid, number: data.number }));
      if (data.leadId) updateDoc('leads', data.leadId, { status: 'Quoted' });
      return { ...data, id: nid };
    }
    await act(() => updateDoc('quotations', f.id, data, data.number), 'Quotation saved');
    return { ...data, id: f.id };
  };

  const convert = async () => {
    const q = await persist();
    if (!q) return;
    if (q.projectId) return go('projects/' + q.projectId);
    if (!confirm('Mark this quotation as Accepted and create the project?')) return;
    await act(async () => {
      let clientId = q.clientId;
      if (!clientId) clientId = await addDoc('clients', { name: q.clientName, contactPerson: q.clientContact || '', phone: q.phone || '', email: '', address: q.address || '', city: '', gstin: q.clientGstin || '' }, q.clientName);
      const code = await nextNumber('PRJ');
      const lead = q.leadId ? { assignedTo: me()?.staffId } : {};
      const pid = await addDoc('projects', {
        code, clientId, clientName: q.clientName, title: `${q.lifts || 1} × ${q.liftSpec?.type || 'Lift'} ${q.liftSpec?.stops ? '(' + q.liftSpec.stops + ')' : ''}`.trim(), siteAddress: q.address || '',
        liftSpec: q.liftSpec, lifts: q.lifts, contractValue: q.total, stage: 0, status: 'Active', quotationId: q.id, expectedHandover: addDays(today(), 120),
        team: { sales: lead.assignedTo || '', projectLead: '', technicians: [] },
        stageHistory: [{ stage: 0, at: Date.now(), by: me()?.name || '', note: 'Order confirmed from ' + q.number }],
        milestones: DEFAULT_MILESTONES.map((m) => ({ ...m, amount: Math.round((q.total * m.percent) / 100), status: 'Pending' })),
      }, code);
      await updateDoc('quotations', q.id, { status: 'Accepted', clientId, projectId: pid });
      if (q.leadId) await updateDoc('leads', q.leadId, { status: 'Won', clientId });
      await postActivity({ projectId: pid, clientId, text: `Order confirmed. Project ${code} created from quotation ${q.number}.`, visibleToClient: true, kind: 'stage' });
      go('projects/' + pid);
    }, 'Project created');
  };

  return (
    <>
      <Modal title={isNew ? 'New quotation' : 'Quotation ' + f.number} onClose={onClose} wide
        footer={<>
          {!isNew && <button className="btn ghost danger" onClick={() => confirm('Delete quotation?') && act(() => deleteDoc('quotations', f.id, f.number), 'Deleted').then(onClose)}>Delete</button>}
          <span className="spacer" />
          <button className="btn ghost" onClick={async () => { const q = await persist(); if (q) setPrint(q); }}>Print / PDF</button>
          {f.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(f.phone, `Dear ${f.clientContact || f.clientName}, please find our quotation ${f.number || ''} for ${f.lifts} × ${f.liftSpec.type} lift — total ${inr(t.total)} incl. GST. — ${company.name}`)}>WhatsApp</a>}
          <button className="btn ghost" onClick={convert}>{f.projectId ? 'Open project' : 'Accepted → Create project'}</button>
          <button className="btn" onClick={async () => { if (await persist()) onClose(); }}>Save</button>
        </>}>
        <div className="form-grid">
          <Field label="Existing client (optional)">
            <Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId || ''} placeholder="— New / from lead —"
              onChange={(e) => { const c = clients.find((x) => x.id === e.target.value); setF((p) => ({ ...p, clientId: e.target.value, ...(c ? { clientName: c.name, clientContact: c.contactPerson, phone: c.phone, address: c.address, clientGstin: c.gstin } : {}) })); }} />
          </Field>
          <Field label="Client name *"><input {...bind('clientName')} /></Field>
          <Field label="Contact person"><input {...bind('clientContact')} /></Field>
          <Field label="Phone"><input {...bind('phone')} /></Field>
          <Field label="Site address" span={2}><input {...bind('address')} /></Field>
          <Field label="Date"><input type="date" {...bind('date')} /></Field>
          <Field label="Valid till"><input type="date" {...bind('validTill')} /></Field>
          <Field label="Status"><Select options={QUOTE_STATUSES} placeholder={false} {...bind('status')} /></Field>
          <Field label="No. of lifts"><input type="number" {...bind('lifts', 'number')} /></Field>
        </div>
        <h4 className="section-title">Lift specification</h4>
        <div className="form-grid four">
          <Field label="Type"><Select options={LIFT_TYPES} placeholder={false} {...spec('type')} /></Field>
          <Field label="Capacity"><input {...spec('capacity')} placeholder="8 Persons / 544 kg" /></Field>
          <Field label="Stops / floors"><input {...spec('stops')} placeholder="G+4" /></Field>
          <Field label="Speed"><input {...spec('speed')} /></Field>
          <Field label="Drive"><Select options={DRIVES} placeholder={false} {...spec('drive')} /></Field>
          <Field label="Doors"><Select options={DOOR_TYPES} placeholder={false} {...spec('doorType')} /></Field>
          <Field label="Cabin finish"><input {...spec('cabin')} /></Field>
        </div>
        <h4 className="section-title">Price</h4>
        <LineItems items={f.items} onChange={(v) => set('items', v)} gstRate={f.gstRate} discount={f.discount} onGst={(v) => set('gstRate', v)} onDiscount={(v) => set('discount', v)} />
        <Field label="Terms & conditions"><textarea rows={5} {...bind('terms')} /></Field>
      </Modal>
      {print && <PrintDoc kind="Quotation" doc={print} company={company} onClose={() => setPrint(false)} />}
    </>
  );
}
