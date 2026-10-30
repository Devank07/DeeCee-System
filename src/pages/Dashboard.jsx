import React from 'react';
import { useCol, PageHeader, Card, Stat, go, ActivityFeed, Badge, Empty } from '../ui';
import { inr, sum, today, daysUntil, fmtDate, num } from '../utils';
import { STEPS, openTasks, quoteTotal } from '../workflow';
import { ROLES } from '../constants';

const has = (u, ...r) => u.role === 'admin' || r.includes(u.role);

export default function Dashboard({ user }) {
  const t = today();
  const month = t.slice(0, 7);
  const money = has(user, 'accounts', 'sales', 'stores');
  const orders = useCol('projects', [['status', '==', 'Order']]);
  const enquiries = useCol('projects', [['status', '==', 'Enquiry']], has(user, 'sales'));
  const invoices = useCol('invoices', [], has(user, 'accounts'));
  const payments = useCol('payments', [['date', '>=', month + '-01']], money);
  const openC = useCol('complaints', [['status', 'in', ['Open', 'Assigned', 'In Progress']]], has(user, 'service', 'projects'));
  const amcs = useCol('amcs', [], has(user, 'service'));
  const items = useCol('items', [], has(user, 'stores', 'projects'));
  const visits = useCol('visits', [['date', '==', t]]);
  const staff = useCol('staff');
  const attendance = useCol('attendance', [['date', '==', t]]);
  const activity = useCol('activity', [], true, { orderBy: ['at', 'desc'], limit: 12 });

  const due = invoices.filter((i) => i.status !== 'Cancelled').map((i) => ({ ...i, bal: num(i.total) - num(i.paid) })).filter((i) => i.bal > 0.5);
  const overdue = due.filter((i) => i.dueDate && i.dueDate < t);
  const critical = openC.filter((c) => c.priority?.startsWith('Critical'));
  const unassigned = openC.filter((c) => c.status === 'Open');
  const amcSoon = amcs.filter((a) => a.status === 'Active' && daysUntil(a.end) <= 30);
  const followUps = enquiries.filter((l) => l.enquiry?.followUpDate && l.enquiry.followUpDate <= t);
  const noPrice = enquiries.filter((p) => quoteTotal(p) <= 0);
  const lowStock = items.filter((i) => num(i.stock) <= num(i.minStock));
  const late = orders.filter((p) => p.expectedHandover && p.expectedHandover < t);
  const present = attendance.filter((a) => a.status === 'P').length;
  const activeStaff = staff.filter((s) => s.active !== false).length;

  // Workflow tasks for this user's team
  const tasks = orders.flatMap((p) => openTasks(p, user.role).map((s) => ({ p, s })));
  const stepCount = STEPS.map((s) => ({ ...s, n: orders.filter((p) => openTasks(p, 'admin').some((x) => x.key === s.key)).length }));

  const attention = [
    ...(has(user, 'service') ? critical.map((c) => ({ k: 'c' + c.id, tone: 'red', tag: 'Critical', text: `${c.clientName}: ${c.issue}`, go: 'service/complaints/' + c.id })) : []),
    ...(has(user, 'service') ? unassigned.filter((c) => !c.priority?.startsWith('Critical')).map((c) => ({ k: 'u' + c.id, tone: 'amber', tag: 'No team yet', text: `${c.clientName}: ${c.issue}`, go: 'service/complaints/' + c.id })) : []),
    ...overdue.map((i) => ({ k: 'i' + i.id, tone: 'red', tag: 'Overdue', text: `${i.clientName} owes ${inr(i.bal)} (${i.number}, due ${fmtDate(i.dueDate)})`, go: 'billing/invoices/' + i.id })),
    ...amcSoon.map((a) => ({ k: 'a' + a.id, tone: daysUntil(a.end) < 0 ? 'red' : 'amber', tag: daysUntil(a.end) < 0 ? 'AMC expired' : 'AMC renewal', text: `${a.clientName} — ${daysUntil(a.end) < 0 ? 'expired ' + fmtDate(a.end) : 'ends in ' + daysUntil(a.end) + ' days'}`, go: 'service/amc/' + a.id })),
    ...(has(user, 'projects') ? late.map((p) => ({ k: 'p' + p.id, tone: 'amber', tag: 'Delayed', text: `${p.clientName} — past target handover (${fmtDate(p.expectedHandover)})`, go: 'orders/' + p.id })) : []),
    ...noPrice.map((p) => ({ k: 'q' + p.id, tone: 'red', tag: 'Price to enter', text: `${p.clientName} — ${p.title}`, go: 'orders/' + p.id })),
    ...followUps.map((l) => ({ k: 'l' + l.id, tone: 'blue', tag: 'Follow-up', text: `${l.clientName} — ${l.title}`, go: 'orders/' + l.id })),
    ...lowStock.map((i) => ({ k: 's' + i.id, tone: 'amber', tag: 'Low stock', text: `${i.name}: ${i.stock} ${i.unit} left (min ${i.minStock})`, go: 'inventory/items' })),
  ];

  const hour = new Date().getHours();
  return (
    <div className="page">
      <PageHeader title={`Good ${hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening'}, ${(user.name || '').split(' ')[0]}`} sub={`${new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${ROLES[user.role]}`} />
      <div className="stats">
        <Stat label="Active orders" value={orders.length} sub={late.length ? `${late.length} past target date` : 'All on track'} tone={late.length ? 'amber' : ''} onClick={() => go('orders')} />
        <Stat label={user.role === 'admin' ? 'Steps waiting' : 'Waiting for my team'} value={tasks.length} sub={tasks.length ? 'Open the list below' : 'Nothing pending'} tone={tasks.length ? 'amber' : 'green'} onClick={() => go('orders')} />
        {has(user, 'sales') && <Stat label="Open enquiries" value={enquiries.length} sub={inr(sum(enquiries, quoteTotal)) + ' quoted'} onClick={() => go('enquiries')} />}
        {has(user, 'accounts') && <Stat label="Invoices outstanding" value={inr(sum(due, 'bal'))} sub={`${overdue.length} overdue`} tone={overdue.length ? 'red' : ''} onClick={() => go('billing')} />}
        {money && <Stat label="Received this month" value={inr(sum(payments, 'amount'))} sub={`${payments.length} payments`} tone="green" onClick={has(user, 'accounts') ? () => go('billing/payments') : undefined} />}
        {has(user, 'service', 'projects') && <Stat label="Open complaints" value={openC.length} sub={critical.length ? `${critical.length} critical` : `${unassigned.length} not assigned`} tone={critical.length ? 'red' : ''} onClick={() => go('service/complaints')} />}
        {has(user, 'service') && <Stat label="AMC renewals (30 days)" value={amcSoon.length} tone={amcSoon.length ? 'amber' : ''} onClick={() => go('service/amc')} />}
        <Stat label="Field jobs today" value={visits.length} sub={`${visits.filter((v) => v.status === 'Done').length} done`} onClick={has(user, 'service', 'projects') ? () => go('service/visits') : undefined} />
        <Stat label="Staff present" value={`${present}/${activeStaff}`} sub="Today" onClick={has(user, 'accounts') ? () => go('staff/attendance') : undefined} />
      </div>

      <div className="grid-2">
        <Card title={user.role === 'admin' ? `Orders waiting on a team (${tasks.length})` : `Waiting for your team (${tasks.length})`}>
          {tasks.length === 0 ? <Empty>Nothing is waiting for your team 🎉</Empty> : (
            <ul className="attention">
              {tasks.slice(0, 16).map(({ p, s }) => (
                <li key={p.id + s.key} onClick={() => go('orders/' + p.id)}><Badge tone="blue">{s.label}</Badge><span>{p.clientName} — {p.title}{user.role === 'admin' && <span className="muted small"> · {s.team}</span>}</span><span className="chev">›</span></li>
              ))}
            </ul>
          )}
        </Card>
        {user.role === 'admin' || user.role === 'projects' ? (
          <Card title="Where orders are waiting">
            <div className="bars">
              {stepCount.map((x) => (
                <div key={x.key} className="bar-row"><span className="bar-l">{x.label} <span className="muted small">· {x.team}</span></span><div className="bar"><div style={{ width: (x.n / Math.max(1, ...stepCount.map((y) => y.n))) * 100 + '%' }} /></div><b>{x.n}</b></div>
              ))}
            </div>
          </Card>
        ) : (
          <Card title={`Needs attention (${attention.length})`}>
            {attention.length === 0 ? <Empty>All clear</Empty> : <AttentionList items={attention} />}
          </Card>
        )}
      </div>
      {(user.role === 'admin' || user.role === 'projects') && attention.length > 0 && <Card title={`Needs attention (${attention.length})`}><AttentionList items={attention} /></Card>}
      <Card title="Latest updates across teams"><ActivityFeed items={activity} /></Card>
    </div>
  );
}

function AttentionList({ items }) {
  return (
    <ul className="attention">
      {items.slice(0, 14).map((a) => (
        <li key={a.k} onClick={() => go(a.go)}><Badge tone={a.tone}>{a.tag}</Badge><span>{a.text}</span><span className="chev">›</span></li>
      ))}
    </ul>
  );
}
