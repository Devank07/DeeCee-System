import React, { useState } from 'react';
import { useCol, Modal, Field, Select, useForm, act, LineItems, useSettings, Note } from '../ui';
import { addDoc, updateDoc, deleteDoc, queryOnce, nextNumber, postActivity, getOne, inc, me } from '../data';
import { VISIT_TYPES, PAY_MODES, STATE_NAMES, stateFromGstin } from '../constants';
import { today, addDays, calcTotals, num, inr, sum, fmtDate } from '../utils';
import { milestoneStatus } from '../workflow';
import { hasAny } from '../roles';

export const teamOptions = (teams, type) => teams.filter((t) => t.active !== false && (!type || t.type === type)).map((t) => ({ value: t.id, label: `${t.name} (${t.type})` }));
export const teamMembers = (staff, teamId) => staff.filter((s) => s.teamId === teamId && s.active !== false);
export const can = (user, ...roles) => hasAny(user, ...roles);

/* -------- Schedule a field job (installation work / AMC visit / breakdown) for a team -------- */
export function VisitForm({ initial = {}, onClose }) {
  const staff = useCol('staff');
  const teams = useCol('teams');
  const clients = useCol('clients');
  const projects = useCol('projects', [['status', 'in', ['Order', 'Completed']]]);
  const amcs = useCol('amcs');
  const { f, setF, bind } = useForm({ type: VISIT_TYPES[0], date: today(), status: 'Scheduled', title: '', technicianId: '', teamId: '', ...initial });
  const pickClient = (id) => {
    const c = clients.find((x) => x.id === id);
    setF((p) => ({ ...p, clientId: id, clientName: c?.name || '', siteAddress: c?.address || '', contactPhone: c?.phone || '', projectId: '', amcId: '' }));
  };
  const save = async () => {
    if (!f.clientId || !f.teamId || !f.date) return act(async () => { throw new Error('Client, team and date are required'); });
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    data.teamName = teams.find((t) => t.id === data.teamId)?.name || '';
    if (!data.title) data.title = data.type;
    if (id) await act(() => updateDoc('visits', id, data, data.title), 'Job updated');
    else {
      await act(() => addDoc('visits', data, data.title), 'Job scheduled');
      if (data.complaintId) await updateDoc('complaints', data.complaintId, { status: 'Assigned', teamId: data.teamId, teamName: data.teamName, assignedTo: data.technicianId || null });
      postActivity({ projectId: data.projectId || null, clientId: data.clientId, text: `${data.type} scheduled on ${data.date} — ${data.teamName}.`, visibleToClient: true, teamId: data.projectId ? data.teamId : null, kind: 'visit' });
    }
    onClose();
  };
  return (
    <Modal title={f.id ? 'Edit field job' : 'Schedule field job'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Job type"><Select options={VISIT_TYPES} placeholder={false} {...bind('type')} /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId || ''} onChange={(e) => pickClient(e.target.value)} /></Field>
        <Field label="Order"><Select options={projects.filter((p) => p.clientId === f.clientId).map((p) => ({ value: p.id, label: (p.code || p.quoteNo) + ' ' + p.title }))} value={f.projectId || ''} onChange={(e) => { const p = projects.find((x) => x.id === e.target.value); setF((x) => ({ ...x, projectId: e.target.value, siteAddress: p?.siteAddress || x.siteAddress, teamId: x.teamId || p?.teamId || '' })); }} /></Field>
        <Field label="AMC"><Select options={amcs.filter((a) => a.clientId === f.clientId).map((a) => ({ value: a.id, label: a.number }))} {...bind('amcId')} /></Field>
        <Field label="Team *"><Select options={teamOptions(teams)} value={f.teamId} onChange={(e) => setF((p) => ({ ...p, teamId: e.target.value, technicianId: '' }))} /></Field>
        <Field label="Lead technician (optional)"><Select options={teamMembers(staff, f.teamId).map((s) => ({ value: s.id, label: s.name }))} placeholder="Whole team" {...bind('technicianId')} /></Field>
        <Field label="Job title"><input {...bind('title')} placeholder="e.g. Monthly PM – Tower A" /></Field>
        <Field label="Site phone"><input {...bind('contactPhone')} /></Field>
        <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
        <Field label="Instructions for the team" span={2}><textarea rows={2} {...bind('instructions')} /></Field>
      </div>
    </Modal>
  );
}

/* -------- GST tax invoice -------- */
export function InvoiceForm({ initial = {}, onClose, onSaved }) {
  const company = useSettings();
  const clients = useCol('clients');
  const projects = useCol('projects', [['status', 'in', ['Order', 'Completed', 'On Hold']]]);
  const { f, setF, bind, set } = useForm({ date: today(), dueDate: addDays(today(), 15), items: [{ desc: '', hsn: company.hsnSupply || '', qty: 1, rate: 0 }], gstRate: company.defaultGst ?? 18, discount: 0, paid: 0, status: 'Active', ...initial });
  const t = calcTotals(f.items, f.gstRate, f.discount);
  const client = clients.find((x) => x.id === f.clientId);
  const pos = f.placeOfSupply || projects.find((p) => p.id === f.projectId)?.siteState || client?.state || stateFromGstin(client?.gstin) || '';
  const intra = pos && company.state ? pos === company.state : true;
  const save = async () => {
    if (!f.clientId) return act(async () => { throw new Error('Select a client'); });
    if (!t.total) return act(async () => { throw new Error('Add at least one line with an amount'); });
    if (!pos) return act(async () => { throw new Error('Select the place of supply (state of the site)'); });
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    Object.assign(data, { clientName: client?.name || data.clientName, clientGstin: client?.gstin || '', address: client?.address || '', phone: client?.phone || '', placeOfSupply: pos, total: t.total });
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
        <Field label="Client *" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} value={f.clientId || ''} onChange={(e) => setF((p) => ({ ...p, clientId: e.target.value, projectId: '', placeOfSupply: '' }))} /></Field>
        <Field label="Order"><Select options={projects.filter((p) => p.clientId === f.clientId).map((p) => ({ value: p.id, label: p.code || p.quoteNo }))} {...bind('projectId')} /></Field>
        <Field label="Place of supply *" hint={pos ? (intra ? 'Same state → CGST + SGST' : 'Other state → IGST') : 'State where the lift is installed'}><Select options={STATE_NAMES} value={pos} onChange={(e) => set('placeOfSupply', e.target.value)} /></Field>
        <Field label="Invoice date"><input type="date" {...bind('date')} /></Field>
        <Field label="Due date"><input type="date" {...bind('dueDate')} /></Field>
      </div>
      {!company.state && <Note>Set your company's state in Settings → Company so CGST/SGST vs IGST is worked out correctly.</Note>}
      <LineItems items={f.items} onChange={(v) => set('items', v)} gstRate={f.gstRate} discount={f.discount} onGst={(v) => set('gstRate', v)} onDiscount={(v) => set('discount', v)} defaultHsn={company.hsnSupply || ''} />
      <Field label="Notes (printed)"><textarea rows={2} {...bind('terms')} /></Field>
    </Modal>
  );
}

/* -------- Record a payment: against an order milestone and/or an invoice -------- */
export function PaymentForm({ project, invoice, milestone: initialMs, confirmAdvance: confirmDefault, onClose }) {
  const payments = useCol('payments', [['projectId', '==', project?.id || invoice?.projectId || '_none_']], !!(project?.id || invoice?.projectId));
  const msList = project?.milestones || [];
  const paidFor = (i) => sum(payments.filter((p) => p.milestone === i), 'amount');
  const firstDue = msList.findIndex((m, i) => paidFor(i) < num(m.amount) - 0.5);
  const startMs = initialMs ?? invoice?.milestone ?? (firstDue === -1 ? '' : firstDue);
  const msDefault = startMs === '' ? 0 : Math.max(0, num(msList[startMs]?.amount) - paidFor(startMs));
  const invBal = invoice ? num(invoice.total) - num(invoice.paid) : 0;
  const { f, bind, setF } = useForm({ amount: invoice ? invBal : msDefault, date: today(), mode: PAY_MODES[0], ref: '', milestone: startMs });
  const needsAdvance = project && !project.advance?.confirmed;
  const [confirmAdv, setConfirmAdv] = useState(confirmDefault ?? (needsAdvance && Number(startMs) === 0));
  const save = async () => {
    const amt = num(f.amount);
    if (amt <= 0) return act(async () => { throw new Error('Enter the amount received'); });
    const ms = f.milestone === '' || f.milestone == null ? null : Number(f.milestone);
    const invId = invoice?.id || (ms != null ? msList[ms]?.invoiceId : null) || null;
    await act(async () => {
      const proj = project || (invoice?.projectId ? await getOne('projects', invoice.projectId) : null);
      const invNo = invoice?.number || (invId ? (await getOne('invoices', invId))?.number : '') || '';
      await addDoc('payments', {
        projectId: proj?.id || null, projectCode: proj?.code || '', milestone: ms, invoiceId: invId, invoiceNumber: invNo,
        clientId: proj?.clientId || invoice?.clientId, clientName: proj?.clientName || invoice?.clientName, amount: amt, date: f.date, mode: f.mode, ref: f.ref,
      }, invNo || proj?.code || '');
      if (invId) await updateDoc('invoices', invId, { paid: inc(amt) }, invNo);
      const msName = ms != null && proj?.milestones?.[ms] ? ` (${proj.milestones[ms].name})` : '';
      await postActivity({ projectId: proj?.id || null, clientId: proj?.clientId || invoice?.clientId, text: `Payment of ${inr(amt)} received${msName}. Thank you!`, visibleToClient: true, kind: 'billing' });
      if (proj && confirmAdv && !proj.advance?.confirmed) {
        await updateDoc('projects', proj.id, { advance: { confirmed: true, at: Date.now(), by: me()?.name || '', amount: amt } }, proj.code);
        await postActivity({ projectId: proj.id, clientId: proj.clientId, text: 'Advance received — order released to the drawing and material teams.', visibleToClient: true, teamId: proj.teamId || null, kind: 'stage' });
      }
    }, 'Payment recorded');
    onClose();
  };
  return (
    <Modal title={'Record payment received' + (invoice ? ' — ' + invoice.number : project ? ' — ' + (project.code || project.clientName) : '')} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save payment</button></>}>
      <p className="muted">{project?.clientName || invoice?.clientName}{invoice ? ` · Invoice balance ${inr(invBal)}` : ''}</p>
      <div className="form-grid">
        {msList.length > 0 && (
          <Field label="Against milestone" span={2}>
            <Select options={msList.map((m, i) => ({ value: i, label: `${m.name} — ${inr(m.amount)} · ${milestoneStatus(m, paidFor(i))}${paidFor(i) ? ' (' + inr(paidFor(i)) + ' received)' : ''}` }))} placeholder="Not linked to a milestone" value={f.milestone ?? ''}
              onChange={(e) => { const v = e.target.value === '' ? '' : Number(e.target.value); setF((p) => ({ ...p, milestone: v, amount: invoice || v === '' ? p.amount : Math.max(0, num(msList[v]?.amount) - paidFor(v)) })); if (needsAdvance) setConfirmAdv(v === 0); }} />
          </Field>
        )}
        <Field label="Amount received (₹)"><input type="number" {...bind('amount', 'number')} autoFocus /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Mode"><Select options={PAY_MODES} placeholder={false} {...bind('mode')} /></Field>
        <Field label="UTR / Cheque no."><input {...bind('ref')} /></Field>
      </div>
      {needsAdvance && (
        <label className="check strong"><input type="checkbox" checked={confirmAdv} onChange={(e) => setConfirmAdv(e.target.checked)} /> This confirms the advance — release the order to the Drawing and Material teams</label>
      )}
    </Modal>
  );
}

/* -------- Admin: delete a payment (reverses invoice "received" and, if asked, the advance) -------- */
async function removePayment(pay) {
  await deleteDoc('payments', pay.id, `${inr(pay.amount)} · ${pay.clientName || ''} ${pay.invoiceNumber || pay.projectCode || ''}`.trim());
  if (pay.invoiceId) {
    const inv = await getOne('invoices', pay.invoiceId);
    if (inv) await updateDoc('invoices', inv.id, { paid: inc(-num(pay.amount)) }, inv.number);
  }
}

export function DeletePayment({ payment: pay, onClose }) {
  const [proj, setProj] = useState(undefined);
  const [others, setOthers] = useState(0);
  const [undoAdv, setUndoAdv] = useState(false);
  React.useEffect(() => {
    if (!pay.projectId) { setProj(null); return; }
    (async () => {
      const p = await getOne('projects', pay.projectId);
      const rest = (await queryOnce('payments', [['projectId', '==', pay.projectId]])).filter((x) => x.id !== pay.id);
      setProj(p || null); setOthers(rest.length);
      setUndoAdv(!!p?.advance?.confirmed && rest.length === 0);
    })().catch(() => setProj(null));
  }, [pay.id]);
  const save = async () => {
    await act(async () => {
      await removePayment(pay);
      if (proj && undoAdv && proj.advance?.confirmed) await updateDoc('projects', proj.id, { advance: { confirmed: false } }, proj.code);
    }, 'Payment deleted');
    onClose();
  };
  return (
    <Modal title="Delete this payment?" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Keep it</button><button className="btn danger-btn" disabled={proj === undefined} onClick={save}>Delete payment</button></>}>
      <p><b>{inr(pay.amount)}</b> from {pay.clientName || '—'} on {fmtDate(pay.date)} · {pay.mode}{pay.ref ? ' · ' + pay.ref : ''}{pay.invoiceNumber ? ' · invoice ' + pay.invoiceNumber : ''}</p>
      <p className="muted">It is removed from all totals{pay.invoiceId ? ' and the invoice balance goes back up' : ''}. The deletion is kept in the Audit log.</p>
      {proj?.advance?.confirmed && (
        <label className="check strong"><input type="checkbox" checked={undoAdv} onChange={(e) => setUndoAdv(e.target.checked)} /> Also mark the advance as <b>not received</b> for {proj.code || proj.clientName}{others ? ` (${others} other payment${others > 1 ? 's' : ''} remain on this order)` : ''}</label>
      )}
    </Modal>
  );
}

/* -------- Admin: delete an invoice completely (and its payments) -------- */
export function DeleteInvoice({ inv, onClose, onDeleted }) {
  const [pays, setPays] = useState(null);
  React.useEffect(() => { queryOnce('payments', [['invoiceId', '==', inv.id]]).then(setPays).catch(() => setPays([])); }, [inv.id]);
  const save = async () => {
    await act(async () => {
      for (const p of pays) await deleteDoc('payments', p.id, `${inr(p.amount)} · ${inv.number}`);
      await deleteDoc('invoices', inv.id, `${inv.number} · ${inv.clientName || ''}`);
      if (inv.projectId) {
        const p = await getOne('projects', inv.projectId);
        if (p?.milestones?.some((m) => m.invoiceId === inv.id)) await updateDoc('projects', p.id, { milestones: p.milestones.map((m) => (m.invoiceId === inv.id ? { ...m, invoiceId: null } : m)) }, p.code);
      }
    }, 'Invoice deleted');
    onDeleted?.(); onClose();
  };
  return (
    <Modal title={'Delete ' + inv.number + '?'} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Keep it</button><button className="btn danger-btn" disabled={!pays} onClick={save}>Delete permanently</button></>}>
      <p>This removes invoice <b>{inv.number}</b> ({inr(inv.total)}, {inv.clientName}) completely.</p>
      {pays?.length > 0 && <Note tone="red">Its {pays.length} payment{pays.length > 1 ? 's' : ''} ({inr(sum(pays, 'amount'))}) will be deleted too.</Note>}
      <p className="muted small">Use this for test or duplicate invoices. For a real invoice sent to a client, use <b>Cancel invoice</b> instead so the number stays in your GST records. The number will not be reused. The deletion is kept in the Audit log.</p>
    </Modal>
  );
}
