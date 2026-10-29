import React from 'react';
import { useCol, Modal, Field, Select, useForm, act, LineItems, useSettings } from '../ui';
import { addDoc, updateDoc, nextNumber, postActivity, getOne } from '../data';
import { VISIT_TYPES, PAY_MODES } from '../constants';
import { today, addDays, calcTotals, num, inr } from '../utils';

export const technicianOptions = (staff) =>
  staff.filter((s) => s.active !== false && (s.isTechnician || ['Installation', 'Service'].includes(s.department))).map((s) => ({ value: s.id, label: `${s.name} — ${s.designation || s.department}` }));

/* -------- Schedule a field job (installation work / AMC visit / breakdown) -------- */
export function VisitForm({ initial = {}, onClose }) {
  const staff = useCol('staff');
  const clients = useCol('clients');
  const projects = useCol('projects');
  const amcs = useCol('amcs');
  const { f, setF, bind } = useForm({ type: VISIT_TYPES[0], date: today(), status: 'Scheduled', title: '', notes: '', technicianId: '', ...initial });
  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    setF((p) => ({ ...p, clientId: id, clientName: c?.name || '', siteAddress: p.siteAddress || c?.address || '', contactPhone: p.contactPhone || c?.phone || '', projectId: '', amcId: '' }));
  };
  const save = async () => {
    if (!f.clientId || !f.technicianId || !f.date) return alert('Client, technician and date are required');
    const { id, ...data } = f;
    if (!data.title) data.title = data.type;
    if (id) await act(() => updateDoc('visits', id, data, data.title), 'Job updated');
    else {
      await act(() => addDoc('visits', data, data.title), 'Job scheduled');
      if (data.complaintId) await updateDoc('complaints', data.complaintId, { status: 'Assigned', assignedTo: data.technicianId });
      const tech = staff.find((s) => s.id === data.technicianId)?.name;
      postActivity({ projectId: data.projectId || null, clientId: data.clientId, text: `${data.type} scheduled on ${data.date} — technician: ${tech}.`, visibleToClient: true, kind: 'visit' });
    }
    onClose();
  };
  return (
    <Modal title={f.id ? 'Edit field job' : 'Schedule field job'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Job type"><Select options={VISIT_TYPES} placeholder={false} {...bind('type')} /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId || ''} onChange={(e) => pickClient(e.target.value)} /></Field>
        <Field label="Project"><Select options={projects.filter((p) => p.clientId === f.clientId).map((p) => ({ value: p.id, label: p.code + ' ' + p.title }))} {...bind('projectId')} /></Field>
        <Field label="AMC"><Select options={amcs.filter((a) => a.clientId === f.clientId).map((a) => ({ value: a.id, label: a.number }))} {...bind('amcId')} /></Field>
        <Field label="Technician *" span={2}><Select options={technicianOptions(staff)} {...bind('technicianId')} /></Field>
        <Field label="Job title"><input {...bind('title')} placeholder="e.g. Monthly PM – Tower A" /></Field>
        <Field label="Site phone"><input {...bind('contactPhone')} /></Field>
        <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
        <Field label="Instructions for technician" span={2}><textarea rows={2} {...bind('instructions')} /></Field>
      </div>
    </Modal>
  );
}

/* -------- Tax invoice -------- */
export function InvoiceForm({ initial = {}, onClose, onSaved }) {
  const company = useSettings();
  const clients = useCol('clients');
  const projects = useCol('projects');
  const { f, setF, bind, set } = useForm({ date: today(), dueDate: addDays(today(), 15), items: [{ desc: '', qty: 1, rate: 0 }], gstRate: company.defaultGst ?? 18, discount: 0, paid: 0, notes: '', ...initial });
  const t = calcTotals(f.items, f.gstRate, f.discount);
  const save = async () => {
    if (!f.clientId) return alert('Select a client');
    if (!t.total) return alert('Add at least one line with an amount');
    const { id, ...data } = f;
    const c = clients.find((x) => x.id === f.clientId);
    Object.assign(data, { clientName: c?.name || data.clientName, clientGstin: c?.gstin || '', address: c?.address || '', phone: c?.phone || '', total: t.total });
    if (id) {
      await act(() => updateDoc('invoices', id, data, data.number), 'Invoice updated');
      onSaved?.(id, data);
    } else {
      data.number = await nextNumber('INV');
      const nid = await act(() => addDoc('invoices', data, data.number), 'Invoice created');
      postActivity({ projectId: data.projectId || null, clientId: data.clientId, text: `Invoice ${data.number} raised for ${inr(t.total)}.`, visibleToClient: true, kind: 'billing' });
      onSaved?.(nid, data);
    }
    onClose();
  };
  return (
    <Modal title={f.id ? 'Invoice ' + f.number : 'New tax invoice'} wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save invoice</button></>}>
      <div className="form-grid four">
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId || ''} onChange={(e) => setF((p) => ({ ...p, clientId: e.target.value, projectId: '' }))} /></Field>
        <Field label="Project"><Select options={projects.filter((p) => p.clientId === f.clientId).map((p) => ({ value: p.id, label: p.code }))} {...bind('projectId')} /></Field>
        <Field label="Invoice date"><input type="date" {...bind('date')} /></Field>
        <Field label="Due date"><input type="date" {...bind('dueDate')} /></Field>
      </div>
      <LineItems items={f.items} onChange={(v) => set('items', v)} gstRate={f.gstRate} discount={f.discount} onGst={(v) => set('gstRate', v)} onDiscount={(v) => set('discount', v)} />
      <Field label="Notes (printed)"><textarea rows={2} {...bind('terms')} /></Field>
    </Modal>
  );
}

/* -------- Record a payment against an invoice -------- */
export function PaymentForm({ invoice, onClose }) {
  const bal = num(invoice.total) - num(invoice.paid);
  const { f, bind } = useForm({ amount: bal, date: today(), mode: PAY_MODES[0], ref: '' });
  const save = async () => {
    const amt = num(f.amount);
    if (amt <= 0) return alert('Enter amount');
    await act(async () => {
      await addDoc('payments', { invoiceId: invoice.id, invoiceNumber: invoice.number, clientId: invoice.clientId, clientName: invoice.clientName, projectId: invoice.projectId || null, amount: amt, date: f.date, mode: f.mode, ref: f.ref }, invoice.number);
      const paid = num(invoice.paid) + amt;
      await updateDoc('invoices', invoice.id, { paid }, invoice.number);
      if (invoice.projectId) {
        const p = await getOne('projects', invoice.projectId);
        if (p?.milestones?.some((m) => m.invoiceId === invoice.id)) {
          const ms = p.milestones.map((m) => (m.invoiceId === invoice.id ? { ...m, status: paid >= num(invoice.total) - 0.5 ? 'Paid' : 'Invoiced' } : m));
          await updateDoc('projects', p.id, { milestones: ms }, p.code);
        }
      }
      await postActivity({ projectId: invoice.projectId || null, clientId: invoice.clientId, text: `Payment of ${inr(amt)} received against ${invoice.number}. Thank you!`, visibleToClient: true, kind: 'billing' });
    }, 'Payment recorded');
    onClose();
  };
  return (
    <Modal title={'Record payment — ' + invoice.number} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save payment</button></>}>
      <p className="muted">{invoice.clientName} · Balance {inr(bal)}</p>
      <div className="form-grid">
        <Field label="Amount (₹)"><input type="number" {...bind('amount', 'number')} autoFocus /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Mode"><Select options={PAY_MODES} placeholder={false} {...bind('mode')} /></Field>
        <Field label="UTR / Cheque no."><input {...bind('ref')} /></Field>
      </div>
    </Modal>
  );
}
