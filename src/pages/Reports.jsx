// Owner reports: sales funnel, bookings vs collections, profit per order, salesperson performance, who owes what.
import React, { useMemo, useState } from 'react';
import { useCol, PageHeader, Card, Stat, Badge, DataTable, go, Empty } from '../ui';
import { inr, num, sum, today, fmtDate, daysUntil } from '../utils';
import { quoteTotal } from '../workflow';
import { isAdminU, hasAny } from '../roles';

const SERIES = { booked: '#0a66d8', collected: '#1f8a4c' };
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar'];
const lakh = (n) => (Math.abs(n) >= 1e7 ? (n / 1e7).toFixed(2) + ' Cr' : (n / 1e5).toFixed(1) + ' L');
const ymd = (t) => (t ? new Date(t).toISOString().slice(0, 10) : '');
const exGst = (amount, rate) => num(amount) / (1 + num(rate ?? 18) / 100);

function fyList() {
  const d = new Date();
  const start = d.getMonth() >= 3 ? d.getFullYear() : d.getFullYear() - 1;
  return [0, 1, 2, 3].map((i) => {
    const y = start - i;
    return { key: String(y), label: `FY ${String(y).slice(2)}-${String(y + 1).slice(2)}`, from: `${y}-04-01`, to: `${y + 1}-03-31`, y };
  });
}

export default function Reports({ user }) {
  const admin = isAdminU(user);
  const fys = useMemo(fyList, []);
  const [fyKey, setFyKey] = useState(fys[0].key);
  const fy = fys.find((f) => f.key === fyKey) || fys[0];
  const inFy = (d) => d && d >= fy.from && d <= fy.to;

  const projects = useCol('projects');
  const payments = useCol('payments');
  const invoices = useCol('invoices');
  const costings = useCol('costings', [], hasAny(user, 'sales', 'accounts'));
  const pos = useCol('purchaseOrders', [], admin);

  // ---------- funnel (enquiries created in this FY) ----------
  const cohort = projects.filter((p) => inFy(ymd(p.createdAt)) && p.status !== 'Cancelled');
  const quoted = cohort.filter((p) => p.orderConfirmedAt || quoteTotal(p) > 0);
  const won = cohort.filter((p) => p.orderConfirmedAt);
  const lost = cohort.filter((p) => p.status === 'Lost');
  const winRate = quoted.length ? Math.round((won.length / quoted.length) * 100) : 0;
  const lostReasons = Object.entries(lost.reduce((m, p) => { const r = (p.enquiry?.lostReason || 'No reason given').trim(); m[r] = (m[r] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]).slice(0, 5);

  // ---------- money in this FY ----------
  const booked = projects.filter((p) => inFy(ymd(p.orderConfirmedAt)));
  const bookedValue = sum(booked, 'contractValue');
  const fyPayments = payments.filter((x) => inFy(x.date));
  const collected = sum(fyPayments, 'amount');
  const liveInv = invoices.filter((i) => i.status !== 'Cancelled');
  const outstanding = sum(liveInv, (i) => Math.max(0, num(i.total) - num(i.paid)));
  const monthly = MONTHS.map((m, i) => {
    const y = i < 9 ? fy.y : fy.y + 1;
    const key = `${y}-${String(((i + 3) % 12) + 1).padStart(2, '0')}`;
    return { m, key, booked: sum(booked.filter((p) => ymd(p.orderConfirmedAt).startsWith(key)), 'contractValue'), collected: sum(fyPayments.filter((x) => (x.date || '').startsWith(key)), 'amount') };
  });

  // ---------- profit per order ----------
  const costBy = Object.fromEntries(costings.map((c) => [c.projectId || c.id, c]));
  const poBy = {};
  pos.filter((po) => po.projectId && po.status !== 'Cancelled').forEach((po) => { poBy[po.projectId] = (poBy[po.projectId] || 0) + exGst(po.total, po.gstRate); });
  const profitRows = projects.filter((p) => p.orderConfirmedAt && (inFy(ymd(p.orderConfirmedAt)) || p.status === 'Order')).map((p) => {
    const value = Math.round(exGst(p.contractValue, p.quote?.gstRate));
    const est = num(costBy[p.id]?.costing);
    const actual = Math.round(poBy[p.id] || 0);
    const cost = actual || est;
    return { id: p.id, code: p.code, clientName: p.clientName, status: p.status, salesName: p.salesName || '—', value, est, actual, profit: cost ? value - cost : null, margin: cost && value ? Math.round(((value - cost) / value) * 100) : null };
  });
  const withCost = profitRows.filter((r) => r.profit !== null);

  // ---------- salespeople ----------
  const sp = {};
  cohort.forEach((p) => {
    const k = p.salesName || 'Unassigned';
    const s = (sp[k] ||= { name: k, enquiries: 0, quoted: 0, quotedValue: 0, won: 0, wonValue: 0, lost: 0 });
    s.enquiries++;
    if (p.orderConfirmedAt || quoteTotal(p) > 0) { s.quoted++; s.quotedValue += quoteTotal(p); }
    if (p.orderConfirmedAt) { s.won++; s.wonValue += num(p.contractValue); }
    if (p.status === 'Lost') s.lost++;
  });
  const spRows = Object.values(sp).map((s) => ({ ...s, rate: s.quoted ? Math.round((s.won / s.quoted) * 100) : 0 })).sort((a, b) => b.wonValue - a.wonValue);

  // ---------- who owes ----------
  const owe = {};
  liveInv.forEach((i) => {
    const bal = num(i.total) - num(i.paid);
    if (bal <= 0.5) return;
    const o = (owe[i.clientId || i.clientName] ||= { id: i.clientId, clientName: i.clientName, phone: i.phone, due: 0, overdue: 0, oldest: null, count: 0 });
    o.due += bal; o.count++;
    if (i.dueDate && i.dueDate < today()) { o.overdue += bal; if (!o.oldest || i.dueDate < o.oldest) o.oldest = i.dueDate; }
  });
  const oweRows = Object.values(owe).sort((a, b) => b.overdue - a.overdue || b.due - a.due);

  return (
    <div className="page">
      <PageHeader title="Reports" sub="How the business is doing — sales, money in, profit and dues"
        actions={<div className="fy-seg">{fys.map((f) => <button key={f.key} className={f.key === fyKey ? 'on' : ''} onClick={() => setFyKey(f.key)}>{f.label}</button>)}</div>} />

      <div className="stats">
        <Stat label="Enquiries" value={cohort.length} sub={`${quoted.length} quoted`} />
        <Stat label="Orders won" value={won.length} sub={`Win rate ${winRate}% of quotes`} tone={winRate >= 30 ? 'green' : 'amber'} />
        <Stat label="Orders booked" value={inr(bookedValue)} sub={`${booked.length} orders · incl. GST`} />
        <Stat label="Collected" value={inr(collected)} sub={`${fyPayments.length} payments`} tone="green" />
        <Stat label="Outstanding now" value={inr(outstanding)} sub={`${oweRows.filter((o) => o.overdue > 0).length} clients overdue`} tone={outstanding ? 'red' : ''} onClick={() => go('billing/receivables')} />
      </div>

      <div className="grid-2">
        <Card title="Sales funnel">
          <Funnel steps={[['Enquiries', cohort.length], ['Quoted', quoted.length], ['Won', won.length]]} />
          <p className="muted small">{lost.length} lost{lostReasons.length ? ' — top reasons:' : ''}</p>
          {lostReasons.length > 0 && <ul className="list">{lostReasons.map(([r, n]) => <li key={r}><span className="small">{r}</span><b>{n}</b></li>)}</ul>}
        </Card>
        <Card title="Orders booked vs money collected">
          <MonthBars data={monthly} />
        </Card>
      </div>

      {admin && (
        <Card title="Profit per order (before overheads)" pad={false}>
          {profitRows.length === 0 ? <Empty>No orders in this year</Empty> : (<>
            <div className="pad-x small muted rep-note">Order value is without GST. Cost = material purchase orders linked to the order (if any), otherwise the internal costing entered by Sales. {withCost.length < profitRows.length && <b>{profitRows.length - withCost.length} orders have no cost yet.</b>}</div>
            <DataTable csvName="profit-per-order" rows={profitRows} onRow={(r) => go('orders/' + r.id)} initialSort={{ key: 'value', desc: true }}
              columns={[
                { key: 'code', label: 'Order' },
                { key: 'clientName', label: 'Client' },
                { key: 'salesName', label: 'Sales' },
                { key: 'value', label: 'Value (ex GST)', align: 'r', value: (r) => inr(r.value), sortValue: (r) => r.value, csv: (r) => r.value },
                { key: 'est', label: 'Est. cost', align: 'r', value: (r) => (r.est ? inr(r.est) : '—'), sortValue: (r) => r.est, csv: (r) => r.est },
                { key: 'actual', label: 'Material bought', align: 'r', value: (r) => (r.actual ? inr(r.actual) : '—'), sortValue: (r) => r.actual, csv: (r) => r.actual },
                { key: 'profit', label: 'Profit', align: 'r', value: (r) => (r.profit === null ? '—' : inr(r.profit)), sortValue: (r) => r.profit ?? -1e12, csv: (r) => r.profit ?? '' },
                { key: 'margin', label: 'Margin', align: 'r', render: (r) => (r.margin === null ? <span className="muted">—</span> : <Badge tone={r.margin < 10 ? 'red' : r.margin < 20 ? 'amber' : 'green'}>{r.margin}%</Badge>), sortValue: (r) => r.margin ?? -999, csv: (r) => r.margin ?? '' },
              ]} />
            {withCost.length > 0 && <div className="pad-x rep-total"><span>Total profit on {withCost.length} costed orders</span><b>{inr(sum(withCost, 'profit'))}</b><span className="muted">avg margin {Math.round((sum(withCost, 'profit') / (sum(withCost, 'value') || 1)) * 100)}%</span></div>}
          </>)}
        </Card>
      )}

      <Card title="Salesperson performance" pad={false}>
        {spRows.length === 0 ? <Empty>No enquiries in this year</Empty> : (
          <DataTable csvName="salesperson-performance" rows={spRows} searchable={false} initialSort={{ key: 'wonValue', desc: true }}
            columns={[
              { key: 'name', label: 'Salesperson' },
              { key: 'enquiries', label: 'Enquiries', align: 'r' },
              { key: 'quoted', label: 'Quoted', align: 'r' },
              { key: 'quotedValue', label: 'Quoted value', align: 'r', value: (r) => inr(r.quotedValue), sortValue: (r) => r.quotedValue, csv: (r) => Math.round(r.quotedValue) },
              { key: 'won', label: 'Won', align: 'r' },
              { key: 'wonValue', label: 'Won value', align: 'r', value: (r) => inr(r.wonValue), sortValue: (r) => r.wonValue, csv: (r) => r.wonValue },
              { key: 'lost', label: 'Lost', align: 'r' },
              { key: 'rate', label: 'Win rate', align: 'r', render: (r) => <Badge tone={r.rate >= 30 ? 'green' : r.rate >= 15 ? 'amber' : 'red'}>{r.rate}%</Badge>, sortValue: (r) => r.rate, csv: (r) => r.rate },
            ]} />
        )}
      </Card>

      <Card title="Who owes us (all open invoices)" pad={false}>
        {oweRows.length === 0 ? <Empty>Nothing outstanding 🎉</Empty> : (
          <DataTable csvName="dues-by-client" rows={oweRows} initialSort={{ key: 'overdue', desc: true }} onRow={(r) => r.id && go('clients/' + r.id)}
            columns={[
              { key: 'clientName', label: 'Client' },
              { key: 'count', label: 'Invoices', align: 'r' },
              { key: 'due', label: 'Total due', align: 'r', value: (r) => inr(r.due), sortValue: (r) => r.due, csv: (r) => Math.round(r.due) },
              { key: 'overdue', label: 'Overdue', align: 'r', render: (r) => (r.overdue > 0 ? <b className="danger-text">{inr(r.overdue)}</b> : '—'), sortValue: (r) => r.overdue, csv: (r) => Math.round(r.overdue) },
              { key: 'oldest', label: 'Oldest due date', value: (r) => (r.oldest ? `${fmtDate(r.oldest)} (${-daysUntil(r.oldest)} days)` : '—'), sortValue: (r) => r.oldest || '9', csv: (r) => r.oldest || '' },
            ]} />
        )}
      </Card>
    </div>
  );
}

function Funnel({ steps }) {
  const max = Math.max(1, ...steps.map((s) => s[1]));
  return (
    <div className="funnel">
      {steps.map(([label, n], i) => (
        <div key={label} className="fn-row" title={`${label}: ${n}`}>
          <span className="fn-l">{label}</span>
          <span className="fn-bar"><i style={{ width: `${Math.max(2, (n / max) * 100)}%` }} /></span>
          <b className="fn-n">{n}{i > 0 && steps[i - 1][1] > 0 && <span className="muted small"> · {Math.round((n / steps[i - 1][1]) * 100)}%</span>}</b>
        </div>
      ))}
    </div>
  );
}

/* Grouped monthly bars: booked vs collected. One axis, hover tooltip, legend, table view via title. */
function MonthBars({ data }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 220, L = 46, B = 24, T = 10;
  const max = Math.max(1, ...data.flatMap((d) => [d.booked, d.collected]));
  const step = niceStep(max / 4);
  const top = Math.ceil(max / step) * step;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const slot = (W - L) / data.length;
  const bw = Math.min(16, (slot - 8) / 2);
  const ticks = []; for (let v = 0; v <= top + 1; v += step) ticks.push(v);
  const bar = (x, v, color) => {
    const h = Math.max(0, y(0) - y(v));
    if (h < 0.5) return null;
    const r = Math.min(4, bw / 2, h);
    return <path d={`M${x},${y(0)} V${y(v) + r} Q${x},${y(v)} ${x + r},${y(v)} H${x + bw - r} Q${x + bw},${y(v)} ${x + bw},${y(v) + r} V${y(0)} Z`} fill={color} />;
  };
  const h = hover !== null ? data[hover] : null;
  return (
    <div className="mbars">
      <div className="legend"><span><i style={{ background: SERIES.booked }} />Orders booked</span><span><i style={{ background: SERIES.collected }} />Collected</span></div>
      <div className="mbars-wrap">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Orders booked and money collected by month">
          {ticks.map((v) => <g key={v}><line x1={L} x2={W} y1={y(v)} y2={y(v)} className="grid" /><text x={L - 6} y={y(v)} className="axis" textAnchor="end" dominantBaseline="central">{v ? lakh(v) : '0'}</text></g>)}
          {data.map((d, i) => {
            const x0 = L + i * slot + (slot - (bw * 2 + 2)) / 2;
            return (
              <g key={d.key} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(hover === i ? null : i)}>
                <rect x={L + i * slot} y={T} width={slot} height={H - T - B} fill={hover === i ? 'rgba(0,0,0,0.04)' : 'transparent'} />
                {bar(x0, d.booked, SERIES.booked)}
                {bar(x0 + bw + 2, d.collected, SERIES.collected)}
                <text x={L + i * slot + slot / 2} y={H - 6} className="axis" textAnchor="middle">{d.m}</text>
              </g>
            );
          })}
        </svg>
        {h && (
          <div className="tip" style={{ left: `${((L + hover * slot + slot / 2) / W) * 100}%` }}>
            <b>{h.m} {h.key.slice(0, 4)}</b>
            <div><i style={{ background: SERIES.booked }} />Booked <b>{inr(h.booked)}</b></div>
            <div><i style={{ background: SERIES.collected }} />Collected <b>{inr(h.collected)}</b></div>
          </div>
        )}
      </div>
      <details className="small"><summary className="muted">Show as table</summary>
        <table className="mini-table"><thead><tr><th>Month</th><th className="r">Booked</th><th className="r">Collected</th></tr></thead>
          <tbody>{data.map((d) => <tr key={d.key}><td>{d.m} {d.key.slice(0, 4)}</td><td className="r">{inr(d.booked)}</td><td className="r">{inr(d.collected)}</td></tr>)}</tbody></table>
      </details>
    </div>
  );
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p;
}
