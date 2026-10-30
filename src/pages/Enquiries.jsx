import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, LineItems, useSettings, Note } from '../ui';
import { addDoc, updateDoc, nextNumber, postActivity, me } from '../data';
import { ENQ_STATUSES, LEAD_SOURCES, LIFT_TYPES, DOOR_TYPES, DRIVES, DEFAULT_MILESTONES, STATE_NAMES, stateFromGstin } from '../constants';
import { inr, fmtDate, today, addDays, num, sum, calcTotals } from '../utils';
import { quoteTotal } from '../workflow';
import { teamOptions } from './shared';
import ProposalForm from './ProposalForm';
import { DEFAULT_PAY_TERMS } from '../proposal';

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
      <PageHeader title="Enquiries & Quotations" sub="Add a new client — the system asks for the lift details and makes the quotation in the DeeCee proposal format. Send it, and confirm the order when the client agrees." actions={<button className="btn" onClick={() => go('enquiries/new')}>+ New client enquiry</button>} />
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
      {isNew && <ProposalForm clientId={params[1]} onClose={() => go('enquiries')} />}
    </div>
  );
}

/* ---------- Confirm order (sales) ---------- */
export function ConfirmOrder({ p, onClose }) {
  const teams = useCol('teams');
  const total = quoteTotal(p);
  const terms = p.proposal?.payTerms?.length ? p.proposal.payTerms : DEFAULT_PAY_TERMS;
  const { f, setF, bind } = useForm({ value: total, orderRef: '', expectedHandover: addDays(today(), 84), teamId: '', milestones: terms.map((t) => ({ name: t.label, percent: num(t.percent) })) });
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
