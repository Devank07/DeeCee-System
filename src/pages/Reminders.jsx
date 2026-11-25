// Reminders: follow-ups, invoices due, AMC renewals & bills, sites stuck, lift licences — each with a one-tap WhatsApp message.
import React, { useState } from 'react';
import { useCol, Card, Badge, act, go, useSettings, WaIcon, Modal, Field, Select, useForm, FileUpload, FileList } from '../ui';
import { addDoc, updateDoc, nextNumber, postActivity } from '../data';
import { inr, num, fmtDate, today, addDays, addMonths, daysUntil, waLink } from '../utils';
import { hasAny } from '../roles';

/* ---------- AMC billing periods ---------- */
export const AMC_BILLING = { Yearly: 12, 'Half-yearly': 6, Quarterly: 3, Monthly: 1 };
export function amcPeriods(a) {
  const months = AMC_BILLING[a.billing || 'Yearly'] || 12;
  const out = [];
  for (let s = a.start, i = 0; s && s <= a.end && i < 24; i++) {
    let next = addMonths(s, months);
    let e = addDays(next, -1);
    // last period runs to the contract end; a leftover of a couple of weeks is folded into it
    if (e >= a.end || daysBetween(next, a.end) < 20) { e = a.end; next = addDays(a.end, 1); }
    out.push({ key: `${s}..${e}`, from: s, to: e });
    s = next;
  }
  return out;
}
const daysBetween = (x, y) => Math.round((new Date(y) - new Date(x)) / 86400000);
export function amcDue(amcs, invoices, within = 7) {
  const billed = new Set(invoices.filter((i) => i.amcId && i.status !== 'Cancelled').map((i) => i.amcId + '|' + (i.amcPeriod || '')));
  const legacy = new Set(invoices.filter((i) => i.amcId && i.status !== 'Cancelled' && !i.amcPeriod).map((i) => i.amcId));
  const limit = addDays(today(), within);
  const out = [];
  amcs.filter((a) => a.status === 'Active' && num(a.value) > 0).forEach((a) => {
    const ps = amcPeriods(a);
    ps.forEach((pd, idx) => {
      // only the running period or one starting within a week (older periods are billed by hand if needed)
      if (pd.from > limit || pd.to < today() || billed.has(a.id + '|' + pd.key)) return;
      if (idx === 0 && legacy.has(a.id)) return; // billed before periods were tracked
      out.push({ a, pd, amount: Math.round(num(a.value) / ps.length) });
    });
  });
  return out;
}
export async function raiseAmcInvoice({ a, pd, amount }, company, client) {
  const rate = Math.round((amount / 1.18) * 100) / 100;
  const number = await nextNumber('INV');
  const data = {
    number, date: today(), dueDate: addDays(today(), 15), clientId: a.clientId, clientName: a.clientName, clientGstin: client?.gstin || '', address: client?.address || a.siteAddress || '', phone: client?.phone || '',
    placeOfSupply: client?.state || company.state || '', projectId: a.projectId || '', amcId: a.id, amcPeriod: pd.key,
    items: [{ desc: `Annual Maintenance Contract ${a.number} (${a.type}) – ${a.lifts} lift(s), ${fmtDate(pd.from)} to ${fmtDate(pd.to)}`, hsn: company.sacService || '9987', qty: 1, rate }],
    gstRate: 18, discount: 0, paid: 0, status: 'Active', total: Math.round(rate * 1.18),
  };
  const id = await addDoc('invoices', data, number);
  await postActivity({ projectId: a.projectId || null, clientId: a.clientId, text: `Invoice ${number} raised for AMC ${a.number} (${fmtDate(pd.from)} – ${fmtDate(pd.to)}): ${inr(data.total)}.`, visibleToClient: true, kind: 'billing' });
  return id;
}

export function AmcBillsDue({ user, compact }) {
  const amcs = useCol('amcs', [['status', '==', 'Active']]);
  const invoices = useCol('invoices', [], hasAny(user, 'accounts', 'service'));
  const clients = useCol('clients');
  const company = useSettings();
  const [busy, setBusy] = useState(false);
  const due = amcDue(amcs, invoices);
  if (!due.length) return compact ? null : <p className="muted small">No AMC bills due in the next 7 days.</p>;
  const raise = async (list) => {
    setBusy(true);
    try { await act(async () => { for (const d of list) await raiseAmcInvoice(d, company, clients.find((c) => c.id === d.a.clientId)); }, `${list.length} AMC invoice${list.length > 1 ? 's' : ''} raised`); } catch { /* shown */ }
    setBusy(false);
  };
  return (
    <Card title={<>AMC bills due <Badge tone="amber">{due.length}</Badge></>} actions={<button className="btn sm" disabled={busy} onClick={() => raise(due)}>Raise all {due.length}</button>}>
      <ul className="list">{due.map((d) => (
        <li key={d.a.id + d.pd.key}><span><b>{d.a.clientName}</b> <span className="muted small">· {d.a.number} · {fmtDate(d.pd.from)} – {fmtDate(d.pd.to)}</span></span>
          <span className="nowrap">{inr(d.amount)} <button className="btn ghost sm" disabled={busy} onClick={() => raise([d])}>Raise</button></span></li>
      ))}</ul>
      <p className="muted small">Invoices use SAC {company.sacService || '9987'}, GST 18%, due in 15 days. Clients see them in their portal.</p>
    </Card>
  );
}

/* ---------- Reminders for the dashboard ---------- */
const SNOOZE_KEY = 'deecee_snooze';
const getSnooze = () => { try { return JSON.parse(localStorage.getItem(SNOOZE_KEY) || '{}'); } catch { return {}; } };

export function Reminders({ user }) {
  const company = useSettings();
  const sales = hasAny(user, 'sales'), acc = hasAny(user, 'accounts'), svc = hasAny(user, 'service'), prj = hasAny(user, 'projects');
  const enquiries = useCol('projects', [['status', '==', 'Enquiry']], sales);
  const orders = useCol('projects', [['status', 'in', ['Order', 'Completed']]], sales || prj);
  const invoices = useCol('invoices', [['status', '==', 'Active']], acc);
  const amcs = useCol('amcs', [['status', '==', 'Active']], svc);
  const clients = useCol('clients', [], svc);
  const [snooze, setSnooze] = useState(getSnooze);
  const t = today();
  const name = company.name || 'Dee Cee Elevators';
  const items = [];

  if (sales) enquiries.filter((p) => p.enquiry?.followUpDate && p.enquiry.followUpDate <= t).forEach((p) => items.push({
    id: 'fu' + p.id, tone: p.enquiry.followUpDate < t ? 'red' : 'amber', kind: 'Follow-up', text: `${p.clientName} — ${p.title || ''}`, sub: `Due ${fmtDate(p.enquiry.followUpDate)}${p.enquiry.notes ? ' · ' + p.enquiry.notes.slice(0, 60) : ''}`,
    phone: p.contactPhone, msg: `Dear ${p.contactPerson || p.clientName}, this is ${user.name} from ${name}. Just following up on our proposal ${p.quote?.refNo || p.quoteNo || ''} for your lift. Is there anything I can clarify or help with?`, open: 'orders/' + p.id,
  }));
  if (acc) invoices.forEach((i) => {
    const bal = num(i.total) - num(i.paid);
    if (bal <= 0.5 || !i.dueDate || daysUntil(i.dueDate) > 3) return;
    const late = daysUntil(i.dueDate) < 0;
    items.push({ id: 'inv' + i.id, tone: late ? 'red' : 'amber', kind: late ? 'Overdue' : 'Payment due', text: `${i.clientName} — ${i.number} · ${inr(bal)}`, sub: late ? `${-daysUntil(i.dueDate)} days overdue` : `Due ${fmtDate(i.dueDate)}`,
      phone: i.phone, msg: `Dear ${i.clientName}, a gentle reminder that ${inr(bal)} ${late ? 'is overdue' : 'is due on ' + fmtDate(i.dueDate)} against invoice ${i.number}. Kindly arrange the payment. Thank you — ${name}`, open: 'billing/invoices/' + i.id });
  });
  if (svc) amcs.filter((a) => daysUntil(a.end) <= 30).forEach((a) => {
    const c = clients.find((x) => x.id === a.clientId);
    items.push({ id: 'amc' + a.id + a.end, tone: daysUntil(a.end) < 0 ? 'red' : 'amber', kind: 'AMC renewal', text: `${a.clientName} — ${a.number}`, sub: daysUntil(a.end) < 0 ? `Expired ${fmtDate(a.end)}` : `Ends ${fmtDate(a.end)} (${daysUntil(a.end)} days)`,
      phone: c?.phone, msg: `Dear ${c?.contactPerson || a.clientName}, your lift AMC ${a.number} ${daysUntil(a.end) < 0 ? 'expired on' : 'ends on'} ${fmtDate(a.end)}. Shall we renew it for another year (${inr(a.value)} incl. GST) so maintenance and breakdown support continue without a break? — ${name}`, open: 'service/amc/' + a.id });
  });
  if (sales || prj) orders.filter((p) => p.status === 'Order' && p.orderConfirmedAt && p.site?.status !== 'Ready' && Date.now() - p.orderConfirmedAt > 14 * 86400000).forEach((p) => items.push({
    id: 'site' + p.id, tone: 'amber', kind: 'Site not ready', text: `${p.clientName} — ${p.code}`, sub: `Order ${Math.round((Date.now() - p.orderConfirmedAt) / 86400000)} days ago${p.site?.notes ? ' · ' + p.site.notes.slice(0, 60) : ''}`,
    phone: p.contactPhone, msg: `Dear ${p.contactPerson || p.clientName}, your lift material is planned for dispatch. Please let us know when the shaft, pit and power supply will be ready, so our team can come and check the site. — ${name}`, open: 'orders/' + p.id,
  }));
  if (prj) orders.forEach((p) => {
    const L = p.licence || {};
    if (p.status === 'Completed' && L.status !== 'Issued' && p.handoverAt && Date.now() - p.handoverAt > 7 * 86400000) items.push({ id: 'lic' + p.id, tone: 'amber', kind: 'Lift licence', text: `${p.clientName} — ${p.code}`, sub: `Handed over ${fmtDate(p.handoverAt)} · licence ${L.status || 'not applied'}`, open: 'orders/' + p.id });
    if (L.validTill && daysUntil(L.validTill) <= 60) items.push({ id: 'licx' + p.id + L.validTill, tone: daysUntil(L.validTill) < 0 ? 'red' : 'amber', kind: 'Licence renewal', text: `${p.clientName} — licence ${L.number || ''}`, sub: `${daysUntil(L.validTill) < 0 ? 'Expired' : 'Expires'} ${fmtDate(L.validTill)}`,
      phone: p.contactPhone, msg: `Dear ${p.contactPerson || p.clientName}, the lift licence ${L.number || ''} for your lift ${daysUntil(L.validTill) < 0 ? 'expired on' : 'expires on'} ${fmtDate(L.validTill)}. We can help with the renewal and inspection. — ${name}`, open: 'orders/' + p.id });
  });

  const shown = items.filter((x) => !(snooze[x.id] && snooze[x.id] > Date.now())).sort((a, b) => (a.tone === b.tone ? 0 : a.tone === 'red' ? -1 : 1));
  const doSnooze = (id) => { const s = { ...getSnooze(), [id]: Date.now() + 3 * 86400000 }; try { localStorage.setItem(SNOOZE_KEY, JSON.stringify(s)); } catch { /* ignore */ } setSnooze(s); };
  return (<>
    {(acc || svc) && <AmcBillsDue user={user} compact />}
    {shown.length > 0 && (
      <Card title={<>Reminders <Badge tone={shown.some((x) => x.tone === 'red') ? 'red' : 'amber'}>{shown.length}</Badge></>}>
        <ul className="rem-list">{shown.slice(0, 25).map((x) => (
          <li key={x.id} className={'rem-' + x.tone}>
            <span className="rem-k">{x.kind}</span>
            <div className="grow clickable" onClick={() => go(x.open)}><b>{x.text}</b><div className="muted small">{x.sub}</div></div>
            {x.phone && x.msg && <a className="btn ghost sm wa-text" href={waLink(x.phone, x.msg)} target="_blank" rel="noreferrer" onClick={() => doSnooze(x.id)} title="Opens WhatsApp with the message ready"><WaIcon /> Remind</a>}
            <button className="icon-btn" title="Hide for 3 days" aria-label="Hide for 3 days" onClick={() => doSnooze(x.id)}>✕</button>
          </li>
        ))}</ul>
        <p className="muted small">Tapping Remind opens WhatsApp with the message typed; the reminder then hides for 3 days.</p>
      </Card>
    )}
  </>);
}

/* ---------- Lift licence (client tab) ---------- */
export const LICENCE_STATUS = ['Not applied', 'Applied', 'Inspection done', 'Issued', 'Not required'];
export function LicenceCard({ p, user }) {
  const [edit, setEdit] = useState(false);
  const [upload, setUpload] = useState(false);
  const L = p.licence || {};
  const can = hasAny(user, 'projects', 'sales');
  const tone = L.status === 'Issued' ? (L.validTill && daysUntil(L.validTill) < 0 ? 'red' : 'green') : L.status === 'Not required' ? 'grey' : L.status ? 'amber' : 'grey';
  return (
    <Card title={<>Lift licence <Badge tone={tone}>{L.status || 'Not applied'}</Badge></>} actions={can && <><button className="btn ghost sm" onClick={() => setUpload(true)}>Upload copy</button><button className="btn ghost sm" onClick={() => setEdit(true)}>Update</button></>}>
      <dl className="dl">
        {L.authority && <><dt>Authority</dt><dd>{L.authority}</dd></>}
        {L.appliedOn && <><dt>Applied on</dt><dd>{fmtDate(L.appliedOn)}</dd></>}
        {L.inspectionOn && <><dt>Inspection</dt><dd>{fmtDate(L.inspectionOn)}</dd></>}
        {L.number && <><dt>Licence no.</dt><dd>{L.number}</dd></>}
        {L.issuedOn && <><dt>Issued</dt><dd>{fmtDate(L.issuedOn)}</dd></>}
        {L.validTill && <><dt>Valid till</dt><dd className={daysUntil(L.validTill) <= 60 ? 'danger-text' : ''}>{fmtDate(L.validTill)}</dd></>}
        {L.notes && <><dt>Notes</dt><dd>{L.notes}</dd></>}
      </dl>
      {!L.status && <p className="muted small">Track the lift licence from application to issue. You'll get a reminder before it expires.</p>}
      {edit && <LicenceForm p={p} onClose={() => setEdit(false)} />}
      {upload && <FileUpload project={p} kind="Document" onClose={() => setUpload(false)} />}
    </Card>
  );
}
function LicenceForm({ p, onClose }) {
  const { f, bind } = useForm({ status: 'Applied', authority: '', appliedOn: '', inspectionOn: '', number: '', issuedOn: '', validTill: '', notes: '', ...(p.licence || {}) });
  const save = async () => {
    await act(async () => {
      await updateDoc('projects', p.id, { licence: f }, p.code);
      if (f.status !== (p.licence?.status || '')) await postActivity({ projectId: p.id, clientId: p.clientId, text: `Lift licence: ${f.status}${f.number ? ' (no. ' + f.number + ')' : ''}${f.validTill ? ', valid till ' + fmtDate(f.validTill) : ''}.`, visibleToClient: true, kind: 'licence' });
    }, 'Licence updated');
    onClose();
  };
  return (
    <Modal title="Lift licence" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Status"><Select options={LICENCE_STATUS} placeholder={false} {...bind('status')} /></Field>
        <Field label="Authority (e.g. Electrical Inspector, Jaipur)"><input {...bind('authority')} /></Field>
        <Field label="Applied on"><input type="date" {...bind('appliedOn')} /></Field>
        <Field label="Inspection date"><input type="date" {...bind('inspectionOn')} /></Field>
        <Field label="Licence no."><input {...bind('number')} /></Field>
        <Field label="Issued on"><input type="date" {...bind('issuedOn')} /></Field>
        <Field label="Valid till"><input type="date" {...bind('validTill')} /></Field>
        <Field label="Notes" span={2}><input {...bind('notes')} /></Field>
      </div>
    </Modal>
  );
}

/* ---------- All licences (Service page tab) ---------- */
export function LicenceList() {
  const projects = useCol('projects', [['status', 'in', ['Order', 'Completed']]]);
  const rows = projects.filter((p) => p.status === 'Completed' || p.licence?.status).map((p) => ({ ...p, L: p.licence || {} }))
    .sort((a, b) => (a.L.validTill || '9') < (b.L.validTill || '9') ? -1 : 1);
  if (!rows.length) return <Card><p className="muted">No completed lifts yet.</p></Card>;
  return (
    <Card pad={false}>
      <table className="mini-table full"><thead><tr><th>Client</th><th>Order</th><th>Status</th><th>Licence no.</th><th>Valid till</th></tr></thead>
        <tbody>{rows.map((p) => (
          <tr key={p.id} className="clickable" onClick={() => go('orders/' + p.id)}><td>{p.clientName}</td><td>{p.code}</td><td><Badge tone={p.L.status === 'Issued' ? 'green' : p.L.status === 'Not required' ? 'grey' : 'amber'}>{p.L.status || 'Not applied'}</Badge></td><td>{p.L.number || '—'}</td>
            <td className={p.L.validTill && daysUntil(p.L.validTill) <= 60 ? 'danger-text' : ''}>{p.L.validTill ? fmtDate(p.L.validTill) : '—'}</td></tr>
        ))}</tbody></table>
    </Card>
  );
}
