import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, act, go, Badge, Tabs, PrintDoc, useSettings, Stat } from '../ui';
import { deleteDoc } from '../data';
import { inr, fmtDate, today, num, sum, waLink, daysUntil } from '../utils';
import { InvoiceForm, PaymentForm } from './shared';

export const invStatus = (i) => {
  const bal = num(i.total) - num(i.paid);
  if (bal <= 0.5) return 'Paid';
  if (i.dueDate && i.dueDate < today()) return 'Overdue';
  return num(i.paid) > 0 ? 'Partly Paid' : 'Unpaid';
};

export default function Billing({ user, params }) {
  const tab = ['payments', 'receivables'].includes(params[0]) ? params[0] : 'invoices';
  const invoices = useCol('invoices');
  const payments = useCol('payments');
  const [newInv, setNewInv] = useState(false);
  const open = params[0] === 'invoices' && params[1] && invoices.find((i) => i.id === params[1]);
  const canWrite = ['admin', 'accounts'].includes(user.role);
  const due = invoices.filter((i) => invStatus(i) !== 'Paid');
  const month = today().slice(0, 7);
  return (
    <div className="page">
      <PageHeader title="Billing & Payments" sub="GST invoices, collections and who owes what" actions={canWrite && <button className="btn" onClick={() => setNewInv(true)}>+ New invoice</button>} />
      <div className="stats">
        <Stat label="Outstanding" value={inr(sum(due, (i) => num(i.total) - num(i.paid)))} sub={`${due.length} invoices`} tone="amber" />
        <Stat label="Overdue" value={inr(sum(due.filter((i) => invStatus(i) === 'Overdue'), (i) => num(i.total) - num(i.paid)))} tone="red" />
        <Stat label="Invoiced this month" value={inr(sum(invoices.filter((i) => (i.date || '').startsWith(month)), 'total'))} />
        <Stat label="Collected this month" value={inr(sum(payments.filter((p) => (p.date || '').startsWith(month)), 'amount'))} tone="green" />
      </div>
      <Tabs value={tab} onChange={(k) => go('billing/' + k)} tabs={[{ key: 'invoices', label: 'Invoices' }, { key: 'payments', label: 'Payments received' }, { key: 'receivables', label: 'Client-wise dues' }]} />
      {tab === 'invoices' && (
        <Card pad={false}>
          <DataTable
            csvName="invoices" rows={invoices} onRow={(r) => go('billing/invoices/' + r.id)} initialSort={{ key: 'date', desc: true }}
            columns={[
              { key: 'number', label: 'Invoice' },
              { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
              { key: 'clientName', label: 'Client' },
              { key: 'total', label: 'Amount', align: 'r', value: (r) => inr(r.total), sortValue: (r) => num(r.total), csv: (r) => r.total },
              { key: 'paid', label: 'Received', align: 'r', value: (r) => inr(r.paid), sortValue: (r) => num(r.paid), csv: (r) => r.paid },
              { key: 'bal', label: 'Balance', align: 'r', value: (r) => inr(num(r.total) - num(r.paid)), sortValue: (r) => num(r.total) - num(r.paid), csv: (r) => num(r.total) - num(r.paid) },
              { key: 'dueDate', label: 'Due', value: (r) => fmtDate(r.dueDate), sortValue: (r) => r.dueDate, csv: (r) => r.dueDate },
              { key: 'status', label: 'Status', render: (r) => <Badge>{invStatus(r)}</Badge>, csv: invStatus },
            ]}
          />
        </Card>
      )}
      {tab === 'payments' && (
        <Card pad={false}>
          <DataTable
            csvName="payments" rows={payments} initialSort={{ key: 'date', desc: true }} onRow={(r) => go('billing/invoices/' + r.invoiceId)}
            columns={[
              { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
              { key: 'clientName', label: 'Client', value: (r) => r.clientName || invoices.find((i) => i.id === r.invoiceId)?.clientName },
              { key: 'invoiceNumber', label: 'Invoice' },
              { key: 'mode', label: 'Mode' },
              { key: 'ref', label: 'Reference' },
              { key: 'amount', label: 'Amount', align: 'r', value: (r) => inr(r.amount), sortValue: (r) => num(r.amount), csv: (r) => r.amount },
            ]}
          />
        </Card>
      )}
      {tab === 'receivables' && <Receivables invoices={invoices} />}
      {newInv && <InvoiceForm onClose={() => setNewInv(false)} onSaved={(id) => go('billing/invoices/' + id)} />}
      {open && <InvoiceView inv={open} canWrite={canWrite} payments={payments.filter((p) => p.invoiceId === open.id)} onClose={() => go('billing/invoices')} />}
    </div>
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

function InvoiceView({ inv, payments, canWrite, onClose }) {
  const company = useSettings();
  const [pay, setPay] = useState(false);
  const [print, setPrint] = useState(false);
  const [edit, setEdit] = useState(false);
  const bal = num(inv.total) - num(inv.paid);
  const reminder = `Dear ${inv.clientName}, a gentle reminder that ${inr(bal)} is pending against invoice ${inv.number} dated ${fmtDate(inv.date)}${inv.dueDate ? ' (due ' + fmtDate(inv.dueDate) + ')' : ''}. Kindly arrange the payment. Thank you — ${company.name}`;
  return (
    <>
      <Modal title={'Invoice ' + inv.number} onClose={onClose}
        footer={<>
          {canWrite && !payments.length && <button className="btn ghost danger" onClick={() => confirm('Delete invoice?') && act(() => deleteDoc('invoices', inv.id, inv.number), 'Deleted').then(onClose)}>Delete</button>}
          <span className="spacer" />
          {canWrite && !payments.length && <button className="btn ghost" onClick={() => setEdit(true)}>Edit</button>}
          {bal > 0.5 && inv.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(inv.phone, reminder)}>WhatsApp reminder</a>}
          <button className="btn ghost" onClick={() => setPrint(true)}>Print / PDF</button>
          {canWrite && bal > 0.5 && <button className="btn" onClick={() => setPay(true)}>Record payment</button>}
        </>}>
        <dl className="dl">
          <dt>Client</dt><dd><a href={'#/clients/' + inv.clientId}>{inv.clientName}</a></dd>
          {inv.projectId && <><dt>Project</dt><dd><a href={'#/projects/' + inv.projectId}>Open project</a></dd></>}
          <dt>Date / due</dt><dd>{fmtDate(inv.date)} → {fmtDate(inv.dueDate)}</dd>
          <dt>Amount</dt><dd><b>{inr(inv.total)}</b> (incl. GST {inv.gstRate}%)</dd>
          <dt>Received</dt><dd>{inr(inv.paid)}</dd>
          <dt>Balance</dt><dd><b>{inr(bal)}</b> <Badge>{invStatus(inv)}</Badge></dd>
        </dl>
        <h4 className="section-title">Items</h4>
        <ul className="list">{(inv.items || []).map((it, i) => <li key={i}><span>{it.desc}</span><span>{it.qty} × {inr(it.rate)}</span></li>)}</ul>
        {payments.length > 0 && (<>
          <h4 className="section-title">Payments</h4>
          <ul className="list">{payments.map((p) => <li key={p.id}><span>{fmtDate(p.date)} · {p.mode} {p.ref && '· ' + p.ref}</span><b>{inr(p.amount)}</b></li>)}</ul>
        </>)}
      </Modal>
      {pay && <PaymentForm invoice={inv} onClose={() => setPay(false)} />}
      {print && <PrintDoc kind="Tax Invoice" doc={inv} company={company} onClose={() => setPrint(false)} />}
      {edit && <InvoiceForm initial={inv} onClose={() => setEdit(false)} />}
    </>
  );
}
