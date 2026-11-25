// Export for the CA / Tally: sales register, receipts, HSN summary, GST summary (Excel) and Tally XML (party ledgers + vouchers).
import React, { useState } from 'react';
import { useCol, Card, Field, act, useSettings, Badge } from '../ui';
import { num, inr, today, fmtDate, downloadFile } from '../utils';
import { stateCode } from '../constants';

const r2 = (n) => Math.round(num(n) * 100) / 100;
function fyStart() { const d = new Date(); const y = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1; return `${y}-04-01`; }
function monthStart() { return today().slice(0, 8) + '01'; }
function lastMonth() { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - 1); const s = d.toISOString().slice(0, 8) + '01'; const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); return [s, `${e.getFullYear()}-${String(e.getMonth() + 1).padStart(2, '0')}-${String(e.getDate()).padStart(2, '0')}`]; }

/* Tax split for one invoice, same rules as the printed invoice */
export function invoiceTax(inv, company) {
  const items = inv.items || [];
  const sub = items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
  const taxable = Math.max(0, sub - num(inv.discount));
  const gst = (taxable * num(inv.gstRate)) / 100;
  const pos = inv.placeOfSupply || '';
  const intra = pos && company.state ? pos === company.state : true;
  const total = num(inv.total) || Math.round(taxable + gst);
  const cgst = intra ? r2(gst / 2) : 0, sgst = intra ? r2(gst / 2) : 0, igst = intra ? 0 : r2(gst);
  return { taxable: r2(taxable), cgst, sgst, igst, total, roundOff: r2(total - (r2(taxable) + cgst + sgst + igst)), intra, pos, rate: num(inv.gstRate) };
}

const xml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tdate = (d) => String(d || '').replace(/-/g, '');
const amt = (n) => r2(n).toFixed(2);
const envelope = (report, body) => `<?xml version="1.0" encoding="UTF-8"?>\n<ENVELOPE>\n <HEADER><TALLYREQUEST>Import Data</TALLYREQUEST></HEADER>\n <BODY><IMPORTDATA>\n  <REQUESTDESC><REPORTNAME>${report}</REPORTNAME></REQUESTDESC>\n  <REQUESTDATA>\n${body}\n  </REQUESTDATA>\n </IMPORTDATA></BODY>\n</ENVELOPE>\n`;

export default function CaExport() {
  const company = useSettings();
  const invoices = useCol('invoices');
  const payments = useCol('payments');
  const clients = useCol('clients');
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(today());
  const [busy, setBusy] = useState(false);
  const inRange = (d) => d && d >= from && d <= to;
  const inv = invoices.filter((i) => i.status !== 'Cancelled' && inRange(i.date)).sort((a, b) => (a.date + a.number > b.date + b.number ? 1 : -1));
  const cancelled = invoices.filter((i) => i.status === 'Cancelled' && inRange(i.date));
  const pays = payments.filter((x) => inRange(x.date)).sort((a, b) => (a.date > b.date ? 1 : -1));
  const clientOf = (id) => clients.find((c) => c.id === id) || {};
  const L = {
    sales: company.tallySales || 'Sales - Lifts', cgst: company.tallyCgst || 'Output CGST', sgst: company.tallySgst || 'Output SGST', igst: company.tallyIgst || 'Output IGST',
    round: company.tallyRound || 'Round Off', bank: company.tallyBank || 'Bank', cash: company.tallyCash || 'Cash', group: company.tallyDebtors || 'Sundry Debtors',
  };
  const tax = inv.map((i) => ({ i, t: invoiceTax(i, company) }));
  const tot = tax.reduce((s, { t }) => ({ taxable: s.taxable + t.taxable, cgst: s.cgst + t.cgst, sgst: s.sgst + t.sgst, igst: s.igst + t.igst, total: s.total + t.total }), { taxable: 0, cgst: 0, sgst: 0, igst: 0, total: 0 });
  const period = `${from} to ${to}`;
  const fileBase = `DeeCee ${from} to ${to}`;

  const excel = async () => {
    setBusy(true);
    try {
      await act(async () => {
        const ExcelJS = (await import('exceljs')).default;
        const wb = new ExcelJS.Workbook();
        wb.creator = company.name || 'Dee Cee Elevators';
        const sheet = (name, cols, rows, totals) => {
          const ws = wb.addWorksheet(name);
          ws.addRow([`${company.name || ''} — ${name} — ${period}`]).font = { bold: true, size: 12 };
          ws.addRow([`GSTIN: ${company.gstin || '—'}`]);
          ws.addRow([]);
          const h = ws.addRow(cols.map((c) => c[0]));
          h.font = { bold: true }; h.eachCell((c) => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE8F1FD' } }; c.border = { bottom: { style: 'thin' } }; });
          rows.forEach((r) => ws.addRow(r));
          if (totals) { const t = ws.addRow(totals); t.font = { bold: true }; }
          cols.forEach((c, i) => { ws.getColumn(i + 1).width = c[1]; if (c[2]) ws.getColumn(i + 1).numFmt = '#,##0.00'; });
          ws.views = [{ state: 'frozen', ySplit: 4 }];
        };
        sheet('Sales register', [['Invoice no.', 16], ['Date', 12], ['Party', 32], ['Party GSTIN', 18], ['Place of supply', 18], ['State code', 8], ['HSN/SAC', 12], ['GST %', 7], ['Taxable value', 15, 1], ['CGST', 12, 1], ['SGST', 12, 1], ['IGST', 12, 1], ['Round off', 9, 1], ['Invoice total', 15, 1], ['Type', 7]],
          tax.map(({ i, t }) => [i.number, i.date, i.clientName, i.clientGstin || clientOf(i.clientId).gstin || '', t.pos, t.pos ? stateCode(t.pos) : '', [...new Set((i.items || []).map((x) => x.hsn).filter(Boolean))].join(', '), t.rate, t.taxable, t.cgst, t.sgst, t.igst, t.roundOff, t.total, (i.clientGstin || clientOf(i.clientId).gstin) ? 'B2B' : 'B2C']),
          ['Total', '', `${inv.length} invoices`, '', '', '', '', '', r2(tot.taxable), r2(tot.cgst), r2(tot.sgst), r2(tot.igst), '', r2(tot.total), '']);
        sheet('Receipts', [['Date', 12], ['Party', 32], ['Amount', 15, 1], ['Mode', 20], ['UTR / cheque', 20], ['Against invoice', 16], ['Order', 16]],
          pays.map((x) => [x.date, x.clientName, num(x.amount), x.mode, x.ref || '', x.invoiceNumber || '', x.projectCode || '']),
          ['Total', `${pays.length} receipts`, pays.reduce((s, x) => s + num(x.amount), 0)]);
        const hsn = {};
        tax.forEach(({ i, t }) => {
          const lines = (i.items || []).filter((x) => num(x.qty) * num(x.rate));
          const sub = lines.reduce((s, x) => s + num(x.qty) * num(x.rate), 0) || 1;
          lines.forEach((x) => {
            const share = (num(x.qty) * num(x.rate)) / sub;
            const k = (x.hsn || 'NA') + '|' + t.rate;
            const h = (hsn[k] ||= { hsn: x.hsn || 'NA', rate: t.rate, qty: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
            h.qty += num(x.qty); h.taxable += t.taxable * share; h.cgst += t.cgst * share; h.sgst += t.sgst * share; h.igst += t.igst * share;
          });
        });
        const hs = Object.values(hsn);
        sheet('HSN summary', [['HSN/SAC', 12], ['GST %', 7], ['Qty', 8], ['Taxable value', 15, 1], ['CGST', 12, 1], ['SGST', 12, 1], ['IGST', 12, 1], ['Total tax', 13, 1]],
          hs.map((h) => [h.hsn, h.rate, h.qty, r2(h.taxable), r2(h.cgst), r2(h.sgst), r2(h.igst), r2(h.cgst + h.sgst + h.igst)]));
        const g = {};
        tax.forEach(({ i, t }) => {
          const b2b = !!(i.clientGstin || clientOf(i.clientId).gstin);
          const k = `${b2b ? 'B2B' : 'B2C'}|${t.intra ? 'Intra-state' : 'Inter-state'}|${t.rate}`;
          const x = (g[k] ||= { type: b2b ? 'B2B (registered)' : 'B2C (unregistered)', where: t.intra ? 'Intra-state' : 'Inter-state', rate: t.rate, count: 0, taxable: 0, cgst: 0, sgst: 0, igst: 0 });
          x.count++; x.taxable += t.taxable; x.cgst += t.cgst; x.sgst += t.sgst; x.igst += t.igst;
        });
        sheet('GST summary', [['Type', 20], ['Supply', 12], ['GST %', 7], ['Invoices', 9], ['Taxable value', 15, 1], ['CGST', 12, 1], ['SGST', 12, 1], ['IGST', 12, 1]],
          Object.values(g).map((x) => [x.type, x.where, x.rate, x.count, r2(x.taxable), r2(x.cgst), r2(x.sgst), r2(x.igst)]),
          ['Total', '', '', inv.length, r2(tot.taxable), r2(tot.cgst), r2(tot.sgst), r2(tot.igst)]);
        if (cancelled.length) sheet('Cancelled invoices', [['Invoice no.', 16], ['Date', 12], ['Party', 32], ['Reason', 40]], cancelled.map((i) => [i.number, i.date, i.clientName, i.cancelReason || '']));
        const buf = await wb.xlsx.writeBuffer();
        downloadFile(`${fileBase} - CA pack.xlsx`, buf, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      }, 'Excel downloaded');
    } catch { /* shown */ }
    setBusy(false);
  };

  const tallyMasters = () => {
    const parties = [...new Map([...inv.map((i) => [i.clientName, i]), ...pays.map((x) => [x.clientName, x])]).keys()].filter(Boolean);
    const body = parties.map((name) => {
      const i = inv.find((x) => x.clientName === name) || {};
      const c = clientOf(i.clientId || pays.find((x) => x.clientName === name)?.clientId);
      const gstin = i.clientGstin || c.gstin || '';
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <LEDGER NAME="${xml(name)}" ACTION="Create">
     <NAME.LIST><NAME>${xml(name)}</NAME></NAME.LIST>
     <PARENT>${xml(L.group)}</PARENT>
     <ISBILLWISEON>Yes</ISBILLWISEON>
     <AFFECTSSTOCK>No</AFFECTSSTOCK>
     ${c.address || i.address ? `<ADDRESS.LIST TYPE="String"><ADDRESS>${xml(c.address || i.address)}</ADDRESS></ADDRESS.LIST>` : ''}
     ${i.placeOfSupply || c.state ? `<LEDSTATENAME>${xml(i.placeOfSupply || c.state)}</LEDSTATENAME>` : ''}
     ${gstin ? `<PARTYGSTIN>${xml(gstin)}</PARTYGSTIN><GSTREGISTRATIONTYPE>Regular</GSTREGISTRATIONTYPE>` : '<GSTREGISTRATIONTYPE>Unregistered</GSTREGISTRATIONTYPE>'}
    </LEDGER>
   </TALLYMESSAGE>`;
    }).join('\n');
    downloadFile(`${fileBase} - Tally 1 party ledgers.xml`, envelope('All Masters', body), 'application/xml');
  };

  const tallyVouchers = () => {
    const le = (name, positive, amount, bill) => `     <ALLLEDGERENTRIES.LIST>
      <LEDGERNAME>${xml(name)}</LEDGERNAME>
      <ISDEEMEDPOSITIVE>${positive ? 'Yes' : 'No'}</ISDEEMEDPOSITIVE>
      <AMOUNT>${amt(amount)}</AMOUNT>${bill ? `
      <BILLALLOCATIONS.LIST><NAME>${xml(bill.name)}</NAME><BILLTYPE>${bill.type}</BILLTYPE><AMOUNT>${amt(amount)}</AMOUNT></BILLALLOCATIONS.LIST>` : ''}
     </ALLLEDGERENTRIES.LIST>`;
    const sales = tax.map(({ i, t }) => {
      const lines = [le(i.clientName, true, -t.total, { name: i.number, type: 'New Ref' }), le(L.sales, false, t.taxable)];
      if (t.cgst) lines.push(le(L.cgst, false, t.cgst));
      if (t.sgst) lines.push(le(L.sgst, false, t.sgst));
      if (t.igst) lines.push(le(L.igst, false, t.igst));
      if (t.roundOff) lines.push(le(L.round, t.roundOff < 0, t.roundOff));
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Sales" ACTION="Create" OBJVIEW="Accounting Voucher View">
     <DATE>${tdate(i.date)}</DATE>
     <VOUCHERTYPENAME>Sales</VOUCHERTYPENAME>
     <VOUCHERNUMBER>${xml(i.number)}</VOUCHERNUMBER>
     <REFERENCE>${xml(i.number)}</REFERENCE>
     <PARTYLEDGERNAME>${xml(i.clientName)}</PARTYLEDGERNAME>
     ${t.pos ? `<PLACEOFSUPPLY>${xml(t.pos)}</PLACEOFSUPPLY>` : ''}
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <NARRATION>${xml((i.items || []).map((x) => x.desc).filter(Boolean).join('; ').slice(0, 240))}</NARRATION>
${lines.join('\n')}
    </VOUCHER>
   </TALLYMESSAGE>`;
    });
    const receipts = pays.map((x) => {
      const cashLike = /cash/i.test(x.mode || '');
      return `   <TALLYMESSAGE xmlns:UDF="TallyUDF">
    <VOUCHER VCHTYPE="Receipt" ACTION="Create" OBJVIEW="Accounting Voucher View">
     <DATE>${tdate(x.date)}</DATE>
     <VOUCHERTYPENAME>Receipt</VOUCHERTYPENAME>
     <PARTYLEDGERNAME>${xml(x.clientName)}</PARTYLEDGERNAME>
     <PERSISTEDVIEW>Accounting Voucher View</PERSISTEDVIEW>
     <NARRATION>${xml(`${x.mode || ''}${x.ref ? ' ' + x.ref : ''}${x.projectCode ? ' · ' + x.projectCode : ''}`)}</NARRATION>
${le(x.clientName, false, num(x.amount), x.invoiceNumber ? { name: x.invoiceNumber, type: 'Agst Ref' } : { name: x.projectCode || 'On Account', type: x.projectCode ? 'Advance' : 'On Account' })}
${le(cashLike ? L.cash : L.bank, true, -num(x.amount))}
    </VOUCHER>
   </TALLYMESSAGE>`;
    });
    downloadFile(`${fileBase} - Tally 2 vouchers.xml`, envelope('Vouchers', [...sales, ...receipts].join('\n')), 'application/xml');
  };

  const preset = (a, b) => { setFrom(a); setTo(b); };
  const [lmS, lmE] = lastMonth();
  return (<>
    <Card title="Export for CA / Tally">
      <div className="row gap wrap">
        <button className="btn ghost sm" onClick={() => preset(monthStart(), today())}>This month</button>
        <button className="btn ghost sm" onClick={() => preset(lmS, lmE)}>Last month</button>
        <button className="btn ghost sm" onClick={() => preset(fyStart(), today())}>This financial year</button>
      </div>
      <div className="form-grid mt">
        <Field label="From"><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></Field>
        <Field label="To"><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></Field>
      </div>
      <div className="pay-sum mt">
        <div><span>Invoices</span><b>{inv.length}</b></div>
        <div><span>Taxable value</span><b>{inr(tot.taxable)}</b></div>
        <div><span>GST</span><b>{inr(tot.cgst + tot.sgst + tot.igst)}</b></div>
        <div><span>Received</span><b>{inr(pays.reduce((s, x) => s + num(x.amount), 0))}</b></div>
      </div>
      {cancelled.length > 0 && <p className="muted small">{cancelled.length} cancelled invoice(s) in this period are listed separately and not counted.</p>}
      <div className="ca-btns">
        <div><button className="btn" disabled={busy} onClick={excel}>{busy ? 'Preparing…' : 'Download Excel for CA'}</button><p className="muted small">Sales register, receipts, HSN summary, GST summary (B2B/B2C, intra/inter-state){cancelled.length ? ', cancelled invoices' : ''}.</p></div>
        <div><div className="row gap wrap"><button className="btn ghost" onClick={tallyMasters} disabled={!inv.length && !pays.length}>1 · Tally party ledgers (XML)</button><button className="btn ghost" onClick={tallyVouchers} disabled={!inv.length && !pays.length}>2 · Tally vouchers (XML)</button></div>
          <p className="muted small">In Tally: <b>Gateway → Import → Masters</b> (file 1), then <b>Import → Transactions</b> (file 2). Sales and receipt vouchers are created with bill-wise references.</p></div>
      </div>
    </Card>
    <Card title="Tally ledger names" actions={<Badge tone="grey">Change in Settings</Badge>}>
      <p className="muted small">The XML posts to these ledgers — they must exist in your Tally company with the same spelling. Change them in <b>Settings → Company</b>.</p>
      <dl className="dl">
        <dt>Sales</dt><dd>{L.sales}</dd><dt>GST</dt><dd>{L.cgst} · {L.sgst} · {L.igst}</dd><dt>Round off</dt><dd>{L.round}</dd><dt>Bank / Cash</dt><dd>{L.bank} · {L.cash}</dd><dt>Clients under</dt><dd>{L.group}</dd>
      </dl>
      <p className="muted small">Exported {fmtDate(today())}. Please have your CA verify HSN/SAC codes and ledger mapping once.</p>
    </Card>
  </>);
}
