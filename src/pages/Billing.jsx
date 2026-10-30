import React, { useState } from 'react';
import { useCol, useDoc, PageHeader, Card, DataTable, Modal, act, go, Badge, Tabs, PrintDoc, useSettings, Stat, Note } from '../ui';
import { updateDoc, getOne } from '../data';
import { inr, fmtDate, today, num, sum, waLink, daysUntil, addDays } from '../utils';
import { InvoiceForm, PaymentForm } from './shared';

export const invStatus = (i) => {
  if (i.status === 'Cancelled') return 'Cancelled';
  const bal = num(i.total) - num(i.paid);
  if (bal <= 0.5) return 'Paid';
  if (i.dueDate && i.dueDate < today()) return 'Overdue';
  return num(i.paid) > 0 ? 'Partly Paid' : 'Unpaid';
};
const live = (i) => i.status !== 'Cancelled';

export default function Billing({ user, params }) {
  const tab = ['payments', 'receivables', 'orders'].includes(params[0]) ? params[0] : 'invoices';
  const invoices = useCol('invoices');
  const payments = useCol('payments', [['date', '>=', addDays(today(), -400)]], true, { orderBy: ['date', 'desc'] });
  const [newInv, setNewInv] = useState(false);
  const openId = params[0] === 'invoices' && params[1];
  const canWrite = ['admin', 'accounts'].includes(user.role);
  const due = invoices.filter((i) => live(i) && invStatus(i) !== 'Paid');
  const month = today().slice(0, 7);
  return (
    <div className="page">
      <PageHeader title="Billing & Payments" sub="GST invoices, payments received and who owes what" actions={canWrite && <button className="btn" onClick={() => setNewInv(true)}>+ New invoice</button>} />
      <div className="stats">
        <Stat label="Invoices outstanding" value={inr(sum(due, (i) => num(i.total) - num(i.paid)))} sub={`${due.length} invoices`} tone="amber" />
        <Stat label="Overdue" value={inr(sum(due.filter((i) => invStatus(i) === 'Overdue'), (i) => num(i.total) - num(i.paid)))} tone="red" />
        <Stat label="Invoiced this month" value={inr(sum(invoices.filter((i) => live(i) && (i.date || '').startsWith(month)), 'total'))} />
        <Stat label="Received this month" value={inr(sum(payments.filter((p) => (p.date || '').startsWith(month)), 'amount'))} tone="green" />
      </div>
      <Tabs value={tab} onChange={(k) => go('billing/' + k)} tabs={[{ key: 'invoices', label: 'Invoices' }, { key: 'payments', label: 'Payments received' }, { key: 'orders', label: 'Order balances' }, { key: 'receivables', label: 'Invoice ageing' }]} />
      {tab === 'invoices' && (
        <Card pad={false}>
          <DataTable
            csvName="invoices" rows={invoices} onRow={(r) => go('billing/invoices/' + r.id)} initialSort={{ key: 'date', desc: true }}
            columns={[
              { key: 'number', label: 'Invoice' },
              { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
              { key: 'clientName', label: 'Client' },
              { key: 'placeOfSupply', label: 'Place of supply' },
              { key: 'total', label: 'Amount', align: 'r', value: (r) => inr(r.total), sortValue: (r) => num(r.total), csv: (r) => r.total },
              { key: 'bal', label: 'Balance', align: 'r', value: (r) => (live(r) ? inr(num(r.total) - num(r.paid)) : '—'), sortValue: (r) => num(r.total) - num(r.paid), csv: (r) => (live(r) ? num(r.total) - num(r.paid) : 0) },
              { key: 'dueDate', label: 'Due', value: (r) => fmtDate(r.dueDate), sortValue: (r) => r.dueDate, csv: (r) => r.dueDate },
              { key: 'status', label: 'Status', render: (r) => <Badge>{invStatus(r)}</Badge>, csv: invStatus },
            ]}
          />
        </Card>
      )}
      {tab === 'payments' && (
        <Card pad={false}>
          <DataTable
            csvName="payments" rows={payments} initialSort={{ key: 'date', desc: true }} onRow={(r) => (r.projectId ? go('orders/' + r.projectId) : r.invoiceId && go('billing/invoices/' + r.invoiceId))}
            columns={[
              { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
              { key: 'clientName', label: 'Client' },
              { key: 'projectCode', label: 'Order', value: (r) => r.projectCode || '—' },
              { key: 'invoiceNumber', label: 'Invoice', value: (r) => r.invoiceNumber || '—' },
              { key: 'mode', label: 'Mode' },
              { key: 'ref', label: 'Reference' },
              { key: 'amount', label: 'Amount', align: 'r', value: (r) => inr(r.amount), sortValue: (r) => num(r.amount), csv: (r) => r.amount },
            ]}
          />
          <p className="muted small pad-x">Showing the last 13 months.</p>
        </Card>
      )}
      {tab === 'orders' && <OrderBalances />}
      {tab === 'receivables' && <Receivables invoices={invoices.filter(live)} />}
      {newInv && <InvoiceForm onClose={() => setNewInv(false)} onSaved={(id) => go('billing/invoices/' + id)} />}
      {openId && <InvoiceView id={openId} canWrite={canWrite} onClose={() => go('billing/invoices')} />}
    </div>
  );
}

function OrderBalances() {
  const projects = useCol('projects', [['status', 'in', ['Order', 'On Hold', 'Completed']]]);
  const pays = useCol('payments');
  const rows = projects.map((p) => {
    const got = sum(pays.filter((x) => x.projectId === p.id), 'amount');
    return { ...p, got, bal: num(p.contractValue) - got };
  }).filter((r) => r.bal > 0.5);
  return (
    <Card pad={false}>
      <DataTable csvName="order-balances" rows={rows} onRow={(r) => go('orders/' + r.id)} initialSort={{ key: 'bal', desc: true }}
        columns={[
          { key: 'clientName', label: 'Client', render: (r) => <><b>{r.clientName}</b><div className="muted small">{r.code} · {r.title}</div></>, csv: (r) => r.clientName },
          { key: 'adv', label: 'Advance', render: (r) => <Badge>{r.advance?.confirmed ? 'Received' : 'Pending'}</Badge>, csv: (r) => (r.advance?.confirmed ? 'Received' : 'Pending') },
          { key: 'contractValue', label: 'Order value', align: 'r', value: (r) => inr(r.contractValue), sortValue: (r) => num(r.contractValue), csv: (r) => r.contractValue },
          { key: 'got', label: 'Received', align: 'r', value: (r) => inr(r.got), sortValue: (r) => r.got, csv: (r) => r.got },
          { key: 'bal', label: 'Balance', align: 'r', render: (r) => <b>{inr(r.bal)}</b>, sortValue: (r) => r.bal, csv: (r) => r.bal },
        ]} />
    </Card>
  );
}

function Receivables({ invoices }) {
  const byClient = {};
  invoices.forEach((i) => {
    const bal = num(i.total) - num(i.paid);
    if (bal <= 0.5) return;
    const age = -daysUntil(i.date);
    const r = (byClient[i.clientId] ||= { id: i.clientId, clientName: i.clientName, b0: 0, b30: 0, b60: 0, b90: 0, total: 0 });
    r[age <= 30 ? 'b0' : age <= 60 ? 'b30' : age <= 90 ? 'b60' : 'b90'] += bal;
    r.total += bal;
  });
  return (
    <Card pad={false}>
      <DataTable
        csvName="receivables-ageing" rows={Object.values(byClient)} initialSort={{ key: 'total', desc: true }} onRow={(r) => go('clients/' + r.id)}
        columns={[
          { key: 'clientName', label: 'Client' },
          { key: 'b0', label: '0–30 days', align: 'r', value: (r) => inr(r.b0), sortValue: (r) => r.b0, csv: (r) => r.b0 },
          { key: 'b30', label: '31–60', align: 'r', value: (r) => inr(r.b30), sortValue: (r) => r.b30, csv: (r) => r.b30 },
          { key: 'b60', label: '61–90', align: 'r', value: (r) => inr(r.b60), sortValue: (r) => r.b60, csv: (r) => r.b60 },
          { key: 'b90', label: '90+', align: 'r', render: (r) => <span className={r.b90 ? 'danger-text' : ''}>{inr(r.b90)}</span>, sortValue: (r) => r.b90, csv: (r) => r.b90 },
          { key: 'total', label: 'Total due', align: 'r', render: (r) => <b>{inr(r.total)}</b>, sortValue: (r) => r.total, csv: (r) => r.total },
        ]}
      />
    </Card>
  );
}

function InvoiceView({ id, canWrite, onClose }) {
  const inv = useDoc('invoices', id);
  const payments = useCol('payments', [['invoiceId', '==', id]]);
  const company = useSettings();
  const [modal, setModal] = useState(null);
  if (!inv) return null;
  const bal = num(inv.total) - num(inv.paid);
  const cancelled = inv.status === 'Cancelled';
  const reminder = `Dear ${inv.clientName}, a gentle reminder that ${inr(bal)} is pending against invoice ${inv.number} dated ${fmtDate(inv.date)}${inv.dueDate ? ' (due ' + fmtDate(inv.dueDate) + ')' : ''}. Kindly arrange the payment. Thank you — ${company.name}`;
  return (
    <>
      <Modal title={'Invoice ' + inv.number} onClose={onClose}
        footer={<>
          {canWrite && !payments.length && !cancelled && <button className="btn ghost danger" onClick={() => setModal('cancel')}>Cancel invoice</button>}
          <span className="spacer" />
          {canWrite && !payments.length && !cancelled && <button className="btn ghost" onClick={() => setModal('edit')}>Edit</button>}
          {bal > 0.5 && !cancelled && inv.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(inv.phone, reminder)}>WhatsApp reminder</a>}
          <button className="btn ghost" onClick={() => setModal('print')}>Print / PDF</button>
          {canWrite && bal > 0.5 && !cancelled && <button className="btn" onClick={() => setModal('pay')}>Record payment</button>}
        </>}>
        {cancelled && <Note tone="red">This invoice was cancelled{inv.cancelReason ? ': ' + inv.cancelReason : ''}. It is kept for your records and excluded from all totals.</Note>}
        <dl className="dl">
          <dt>Client</dt><dd><a href={'#/clients/' + inv.clientId}>{inv.clientName}</a></dd>
          {inv.projectId && <><dt>Order</dt><dd><a href={'#/orders/' + inv.projectId}>Open client tab</a></dd></>}
          <dt>Date / due</dt><dd>{fmtDate(inv.date)} → {fmtDate(inv.dueDate)}</dd>
          <dt>Place of supply</dt><dd>{inv.placeOfSupply || '—'}</dd>
          <dt>Amount</dt><dd><b>{inr(inv.total)}</b> (incl. GST {inv.gstRate}%)</dd>
          <dt>Received</dt><dd>{inr(inv.paid)}</dd>
          <dt>Balance</dt><dd><b>{inr(bal)}</b> <Badge>{invStatus(inv)}</Badge></dd>
        </dl>
        <h4 className="section-title">Items</h4>
        <ul className="list">{(inv.items || []).map((it, i) => <li key={i}><span>{it.desc}{it.hsn && <span className="muted small"> · HSN/SAC {it.hsn}</span>}</span><span className="nowrap">{it.qty} × {inr(it.rate)}</span></li>)}</ul>
        {payments.length > 0 && (<>
          <h4 className="section-title">Payments</h4>
          <ul className="list">{payments.map((p) => <li key={p.id}><span>{fmtDate(p.date)} · {p.mode} {p.ref && '· ' + p.ref}</span><b>{inr(p.amount)}</b></li>)}</ul>
        </>)}
      </Modal>
      {modal === 'pay' && <PaymentForm invoice={inv} onClose={() => setModal(null)} />}
      {modal === 'print' && <PrintDoc kind="Tax Invoice" doc={inv} company={company} onClose={() => setModal(null)} />}
      {modal === 'edit' && <InvoiceForm initial={inv} onClose={() => setModal(null)} />}
      {modal === 'cancel' && <CancelInvoice inv={inv} onClose={() => setModal(null)} />}
    </>
  );
}

function CancelInvoice({ inv, onClose }) {
  const [reason, setReason] = useState('');
  const save = async () => {
    await act(async () => {
      await updateDoc('invoices', inv.id, { status: 'Cancelled', cancelReason: reason, cancelledAt: Date.now() }, inv.number);
      if (inv.projectId && inv.milestone != null) {
        const p = await getOne('projects', inv.projectId);
        if (p?.milestones?.[inv.milestone]?.invoiceId === inv.id) await updateDoc('projects', p.id, { milestones: p.milestones.map((m, i) => (i === inv.milestone ? { ...m, invoiceId: null } : m)) }, p.code);
      }
    }, 'Invoice cancelled');
    onClose();
  };
  return (
    <Modal title={'Cancel ' + inv.number + '?'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Keep invoice</button><button className="btn danger-btn" onClick={save}>Cancel invoice</button></>}>
      <p>The invoice number stays in your records marked CANCELLED and is excluded from dues. If it was raised for a milestone, you can raise a fresh invoice for it.</p>
      <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. wrong amount)" />
      <p className="muted small">If you filed this invoice in a GST return already, ask your CA whether a credit note is needed instead.</p>
    </Modal>
  );
}
