import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, LineItems, useSettings, Note } from '../ui';
import { addDoc, updateDoc, nextNumber, postActivity, me } from '../data';
import { ENQ_STATUSES, LEAD_SOURCES, LIFT_TYPES, DOOR_TYPES, DRIVES, DEFAULT_MILESTONES, STATE_NAMES, stateFromGstin } from '../constants';
import { inr, fmtDate, today, addDays, num, sum, calcTotals } from '../utils';
import { quoteTotal } from '../workflow';
import { teamOptions } from './shared';

export const BLANK_SPEC = { type: 'Passenger', capacity: '', stops: '', speed: '1.0 m/s', drive: 'MRL (Gearless)', doorType: 'Auto Centre Opening', cabin: 'SS Hairline' };

export function defaultQuoteItems(spec, lifts, company) {
  const n = num(lifts) || 1;
  const parts = [spec.capacity, spec.stops, spec.speed, spec.drive, spec.doorType && spec.doorType + ' doors', spec.cabin && spec.cabin + ' cabin'].filter(Boolean).join(', ');
  return [
    { desc: `Supply of ${spec.type} lift${parts ? ' — ' + parts : ''}`, hsn: company.hsnSupply || '', qty: n, rate: 0 },
    { desc: 'Installation, testing & commissioning', hsn: company.sacService || '', qty: n, rate: 0 },
    { desc: 'ARD (Automatic Rescue Device)', hsn: company.hsnSupply || '', qty: n, rate: 0 },
  ];
}
export const liftTitle = (spec, lifts) => `${num(lifts) || 1} × ${spec.type} lift${spec.stops ? ' (' + spec.stops + ')' : ''}`;

export default function Enquiries({ user, params }) {
  const all = useCol('projects', [['status', 'in', ['Enquiry', 'Lost']]]);
  const staff = useCol('staff');
  const [filter, setFilter] = useState('Open');
  const t = today();
  const isNew = params[0] === 'new';
  const priceMissing = (p) => quoteTotal(p) <= 0;
  const due = (p) => p.enquiry?.followUpDate && p.enquiry.followUpDate <= t;
  const open = all.filter((p) => p.status === 'Enquiry');
  const groups = {
    Open: open,
    'Price to enter': open.filter(priceMissing),
    'Follow-up due': open.filter(due),
    Lost: all.filter((p) => p.status === 'Lost'),
  };
  return (
    <div className="page">
      <PageHeader title="Enquiries & Quotations" sub="Add a new client — the quotation is created for you. Enter the price, send it, and confirm the order when the client agrees." actions={<button className="btn" onClick={() => go('enquiries/new')}>+ New client enquiry</button>} />
      <div className="chips">
        {Object.entries(groups).map(([k, v]) => <button key={k} className={'chip' + (filter === k ? ' on' : '')} onClick={() => setFilter(k)}>{k} <span>{v.length}</span></button>)}
      </div>
      <Card pad={false}>
        <DataTable
          csvName="enquiries" rows={groups[filter]} onRow={(r) => go('orders/' + r.id)} initialSort={{ key: 'follow' }}
          columns={[
            { key: 'clientName', label: 'Client', render: (r) => <><b>{r.clientName}</b><div className="muted small">{r.contactPerson} · {r.contactPhone}</div></>, csv: (r) => r.clientName },
            { key: 'title', label: 'Requirement', render: (r) => <>{r.title}<div className="muted small">{r.quoteNo}{r.quote?.rev ? ' R' + r.quote.rev : ''}</div></>, csv: (r) => r.title },
            { key: 'value', label: 'Quotation', align: 'r', render: (r) => (priceMissing(r) ? <Badge tone="red">Price to enter</Badge> : <b>{inr(quoteTotal(r))}</b>), sortValue: quoteTotal, csv: quoteTotal },
            { key: 'status', label: 'Stage', render: (r) => <Badge>{r.status === 'Lost' ? 'Lost' : r.enquiry?.status || 'New'}</Badge>, csv: (r) => (r.status === 'Lost' ? 'Lost' : r.enquiry?.status) },
            { key: 'follow', label: 'Follow-up', render: (r) => <span className={due(r) && r.status === 'Enquiry' ? 'danger-text' : ''}>{fmtDate(r.enquiry?.followUpDate)}</span>, sortValue: (r) => r.enquiry?.followUpDate || '9999', csv: (r) => r.enquiry?.followUpDate },
            { key: 'sales', label: 'Sales', value: (r) => r.salesName || staff.find((s) => s.id === r.salesBy)?.name || '—' },
          ]}
        />
      </Card>
      <p className="muted small">Open pipeline value: <b>{inr(sum(open, quoteTotal))}</b></p>
      {isNew && <NewEnquiry clientId={params[1]} user={user} onClose={() => go('enquiries')} />}
    </div>
  );
}

/* ---------- New client + enquiry: creates the client tab with its quotation ---------- */
function NewEnquiry({ clientId, onClose }) {
  const company = useSettings();
  const clients = useCol('clients');
  const staff = useCol('staff');
  const meStaff = me()?.staffId || '';
  const { f, setF, bind, set } = useForm({
    existingId: clientId || '', name: '', contactPerson: '', phone: '', email: '', address: '', city: '', state: company.state || '', gstin: '',
    siteAddress: '', lifts: 1, spec: BLANK_SPEC, source: 'Phone', followUpDate: addDays(today(), 2), salesBy: meStaff, notes: '',
  });
  const existing = clients.find((c) => c.id === f.existingId);
  const spec = (k) => ({ value: f.spec[k] || '', onChange: (e) => setF((p) => ({ ...p, spec: { ...p.spec, [k]: e.target.value } })) });
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!existing && (!f.name.trim() || !f.phone.trim())) return act(async () => { throw new Error('Client name and phone are required'); });
    setBusy(true);
    try {
      await act(async () => {
        let cid = existing?.id;
        const c = existing || { name: f.name.trim(), contactPerson: f.contactPerson || f.name.trim(), phone: f.phone.trim(), email: f.email, address: f.address, city: f.city, state: f.state || stateFromGstin(f.gstin), gstin: (f.gstin || '').toUpperCase() };
        if (!cid) cid = await addDoc('clients', c, c.name);
        const quoteNo = await nextNumber('QT');
        const sales = staff.find((s) => s.id === f.salesBy);
        const pid = await addDoc('projects', {
          quoteNo, clientId: cid, clientName: c.name, contactPerson: c.contactPerson || '', contactPhone: c.phone || '',
          siteAddress: f.siteAddress || c.address || '', siteState: c.state || company.state || '',
          title: liftTitle(f.spec, f.lifts), lifts: num(f.lifts) || 1, liftSpec: f.spec, status: 'Enquiry',
          enquiry: { status: 'New', source: f.source, followUpDate: f.followUpDate, notes: f.notes },
          salesBy: f.salesBy || '', salesName: sales?.name || me()?.name || '',
          quote: { number: quoteNo, rev: 0, date: today(), validTill: addDays(today(), 30), items: defaultQuoteItems(f.spec, f.lifts, company), gstRate: company.defaultGst ?? 18, discount: 0, terms: company.quoteTerms || '' },
        }, quoteNo);
        go('orders/' + pid);
      }, 'Client tab created — now enter the quotation price');
    } finally { setBusy(false); }
  };
  return (
    <Modal title="New client enquiry" wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={busy} onClick={save}>{busy ? 'Creating…' : 'Create client tab & quotation'}</button></>}>
      <div className="form-grid">
        <Field label="Existing client?" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="— No, this is a new client —" {...bind('existingId')} /></Field>
      </div>
      {!existing && (<>
        <h4 className="section-title">Client details</h4>
        <div className="form-grid">
          <Field label="Client / building name *"><input {...bind('name')} autoFocus /></Field>
          <Field label="Contact person"><input {...bind('contactPerson')} /></Field>
          <Field label="Phone *"><input {...bind('phone')} inputMode="tel" /></Field>
          <Field label="Email"><input {...bind('email')} type="email" /></Field>
          <Field label="Address" span={2}><input {...bind('address')} /></Field>
          <Field label="City"><input {...bind('city')} /></Field>
          <Field label="State"><Select options={STATE_NAMES} {...bind('state')} /></Field>
          <Field label="GSTIN (if any)"><input {...bind('gstin')} /></Field>
        </div>
      </>)}
      <h4 className="section-title">Requirement</h4>
      <div className="form-grid four">
        <Field label="Lift type"><Select options={LIFT_TYPES} placeholder={false} {...spec('type')} /></Field>
        <Field label="No. of lifts"><input type="number" min="1" {...bind('lifts', 'number')} /></Field>
        <Field label="Capacity"><input {...spec('capacity')} placeholder="8 Persons / 544 kg" /></Field>
        <Field label="Stops / floors"><input {...spec('stops')} placeholder="G+4" /></Field>
        <Field label="Speed"><input {...spec('speed')} /></Field>
        <Field label="Drive"><Select options={DRIVES} placeholder={false} {...spec('drive')} /></Field>
        <Field label="Doors"><Select options={DOOR_TYPES} placeholder={false} {...spec('doorType')} /></Field>
        <Field label="Cabin finish"><input {...spec('cabin')} /></Field>
        <Field label="Site address (if different)" span={2}><input {...bind('siteAddress')} placeholder={existing?.address || 'Same as client address'} /></Field>
        <Field label="Source"><Select options={LEAD_SOURCES} placeholder={false} {...bind('source')} /></Field>
        <Field label="Next follow-up"><input type="date" {...bind('followUpDate')} /></Field>
        <Field label="Sales person"><Select options={staff.filter((s) => s.active !== false).map((s) => ({ value: s.id, label: s.name }))} {...bind('salesBy')} /></Field>
        <Field label="Notes" span={3}><input {...bind('notes')} placeholder="Anything the client mentioned" /></Field>
      </div>
      <p className="muted small">A quotation with standard lines (supply, installation, ARD) is created automatically. You only need to enter the prices.</p>
    </Modal>
  );
}

/* ---------- Edit quotation (sales) ---------- */
export function QuoteEditor({ p, onClose }) {
  const company = useSettings();
  const q = p.quote || {};
  const { f, setF, bind, set } = useForm({ lifts: p.lifts || 1, liftSpec: { ...BLANK_SPEC, ...(p.liftSpec || {}) }, siteAddress: p.siteAddress || '', siteState: p.siteState || '', items: q.items || defaultQuoteItems(p.liftSpec || BLANK_SPEC, p.lifts, company), gstRate: q.gstRate ?? 18, discount: q.discount || 0, terms: q.terms || company.quoteTerms || '', validTill: q.validTill || addDays(today(), 30), date: q.date || today() });
  const spec = (k) => ({ value: f.liftSpec[k] || '', onChange: (e) => setF((x) => ({ ...x, liftSpec: { ...x.liftSpec, [k]: e.target.value } })) });
  const locked = !!p.orderConfirmedAt;
  const save = async (newRev) => {
    const quote = { ...q, items: f.items, gstRate: num(f.gstRate), discount: num(f.discount), terms: f.terms, validTill: f.validTill, date: newRev ? today() : f.date, rev: (q.rev || 0) + (newRev ? 1 : 0) };
    const total = calcTotals(quote.items, quote.gstRate, quote.discount).total;
    const enquiry = { ...(p.enquiry || {}), status: total > 0 && ['New', 'Contacted', 'Site Visit'].includes(p.enquiry?.status) ? 'Quoted' : p.enquiry?.status || 'New' };
    await act(() => updateDoc('projects', p.id, { quote, lifts: num(f.lifts) || 1, liftSpec: f.liftSpec, title: liftTitle(f.liftSpec, f.lifts), siteAddress: f.siteAddress, siteState: f.siteState, ...(p.status === 'Enquiry' ? { enquiry } : {}) }, p.quoteNo), newRev ? `Saved as revision R${quote.rev}` : 'Quotation saved');
    onClose();
  };
  return (
    <Modal title={`Quotation ${p.quoteNo}${q.rev ? ' R' + q.rev : ''}`} wide onClose={onClose}
      footer={<>
        <span className="spacer" />
        <button className="btn ghost" onClick={onClose}>Cancel</button>
        {!locked && q.rev != null && quoteTotal(p) > 0 && <button className="btn ghost" onClick={() => save(true)}>Save as new revision</button>}
        {!locked && <button className="btn" onClick={() => save(false)}>Save quotation</button>}
      </>}>
      {locked && <Note tone="blue">The order is confirmed, so the quotation is locked.</Note>}
      <fieldset className="plain" disabled={locked}>
        <div className="form-grid four">
          <Field label="Lift type"><Select options={LIFT_TYPES} placeholder={false} {...spec('type')} /></Field>
          <Field label="No. of lifts"><input type="number" {...bind('lifts', 'number')} /></Field>
          <Field label="Capacity"><input {...spec('capacity')} /></Field>
          <Field label="Stops"><input {...spec('stops')} /></Field>
          <Field label="Speed"><input {...spec('speed')} /></Field>
          <Field label="Drive"><Select options={DRIVES} placeholder={false} {...spec('drive')} /></Field>
          <Field label="Doors"><Select options={DOOR_TYPES} placeholder={false} {...spec('doorType')} /></Field>
          <Field label="Cabin"><input {...spec('cabin')} /></Field>
          <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
          <Field label="Site state (for GST)"><Select options={STATE_NAMES} {...bind('siteState')} /></Field>
          <Field label="Valid till"><input type="date" {...bind('validTill')} /></Field>
        </div>
        <h4 className="section-title">Price — enter the rate for each line</h4>
        <LineItems items={f.items} onChange={(v) => set('items', v)} gstRate={f.gstRate} discount={f.discount} onGst={(v) => set('gstRate', v)} onDiscount={(v) => set('discount', v)} defaultHsn={company.hsnSupply || ''} />
        <Field label="Terms & conditions"><textarea rows={5} {...bind('terms')} /></Field>
      </fieldset>
    </Modal>
  );
}

/* ---------- Confirm order (sales) ---------- */
export function ConfirmOrder({ p, onClose }) {
  const teams = useCol('teams');
  const total = quoteTotal(p);
  const { f, setF, bind } = useForm({ value: total, orderRef: '', expectedHandover: addDays(today(), 120), teamId: '', milestones: DEFAULT_MILESTONES.map((m) => ({ ...m })) });
  const pct = sum(f.milestones, 'percent');
  const ms = (i, k, v) => setF((x) => ({ ...x, milestones: x.milestones.map((m, j) => (j === i ? { ...m, [k]: v } : m)) }));
  const save = async () => {
    const value = num(f.value);
    if (value <= 0) return act(async () => { throw new Error('Enter the final order value'); });
    if (Math.round(pct) !== 100) return act(async () => { throw new Error('Payment milestones must add up to 100%'); });
    await act(async () => {
      const code = await nextNumber('PRJ');
      const team = teams.find((t) => t.id === f.teamId);
      await updateDoc('projects', p.id, {
        code, status: 'Order', orderConfirmedAt: Date.now(), orderBy: me()?.name || '', orderRef: f.orderRef, contractValue: value, expectedHandover: f.expectedHandover,
        milestones: f.milestones.map((m) => ({ name: m.name, percent: num(m.percent), amount: Math.round((value * num(m.percent)) / 100) })),
        enquiry: { ...(p.enquiry || {}), status: 'Won' },
        advance: { confirmed: false }, drawing: { status: 'Pending' }, site: { status: 'Not checked', checks: {} }, material: { status: 'Pending' }, install: { status: 'Not started', steps: {}, progress: 0 },
        teamId: f.teamId || null, teamName: team?.name || '',
      }, code);
      await postActivity({ projectId: p.id, clientId: p.clientId, text: `Order confirmed (${code}) for ${inr(value)}. Next: advance payment.`, visibleToClient: true, kind: 'stage' });
    }, 'Order confirmed — Material, Drawing and Installation teams can now see it');
    onClose();
  };
  return (
    <Modal title="Confirm order" wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Confirm order</button></>}>
      <p className="muted">{p.clientName} · {p.title} · Quotation {p.quoteNo} ({inr(total)})</p>
      <div className="form-grid">
        <Field label="Final order value incl. GST (₹)" hint={num(f.value) !== total ? 'Different from quotation — the order value will be used for payments' : 'Same as quotation'}><input type="number" {...bind('value', 'number')} /></Field>
        <Field label="Client PO / reference no."><input {...bind('orderRef')} /></Field>
        <Field label="Target handover date"><input type="date" {...bind('expectedHandover')} /></Field>
        <Field label="Installation team (can be set later)"><Select options={teamOptions(teams, 'Installation')} {...bind('teamId')} /></Field>
      </div>
      <h4 className="section-title">Payment milestones {Math.round(pct) !== 100 && <span className="danger-text small">(total {pct}% — must be 100%)</span>}</h4>
      <table className="lines-table">
        <thead><tr><th>Milestone</th><th className="r" style={{ width: 80 }}>%</th><th className="r" style={{ width: 130 }}>Amount</th></tr></thead>
        <tbody>{f.milestones.map((m, i) => (
          <tr key={i}><td><input value={m.name} onChange={(e) => ms(i, 'name', e.target.value)} /></td><td><input type="number" className="r" value={m.percent} onChange={(e) => ms(i, 'percent', e.target.value)} /></td><td className="r">{inr((num(f.value) * num(m.percent)) / 100)}</td></tr>
        ))}</tbody>
      </table>
    </Modal>
  );
}

export function EnquiryStatus({ p, onClose }) {
  const { f, bind } = useForm({ status: p.enquiry?.status || 'New', followUpDate: p.enquiry?.followUpDate || '', notes: p.enquiry?.notes || '', lost: false, lostReason: '' });
  const save = async () => {
    const enquiry = { ...(p.enquiry || {}), status: f.status, followUpDate: f.followUpDate, notes: f.notes, ...(f.lost ? { lostReason: f.lostReason } : {}) };
    await act(() => updateDoc('projects', p.id, { enquiry, ...(f.lost ? { status: 'Lost' } : {}) }, p.quoteNo), f.lost ? 'Marked as lost' : 'Saved');
    onClose();
  };
  return (
    <Modal title="Enquiry follow-up" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Stage"><Select options={ENQ_STATUSES} placeholder={false} {...bind('status')} /></Field>
        <Field label="Next follow-up"><input type="date" {...bind('followUpDate')} /></Field>
        <Field label="Call notes" span={2}><textarea rows={3} {...bind('notes')} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.lost} onChange={(e) => bind('lost').onChange({ target: { value: e.target.checked } })} /> Client did not go ahead — mark as lost</label>
      {f.lost && <Field label="Reason"><input {...bind('lostReason')} placeholder="Price, went with competitor, project dropped…" /></Field>}
    </Modal>
  );
}
