import React from 'react';
import { useCol, PageHeader, Card, Stat, go, ActivityFeed, Badge, Empty } from '../ui';
import { PROJECT_STAGES } from '../constants';
import { inr, sum, today, daysUntil, fmtDate, num } from '../utils';

export default function Dashboard({ user }) {
  const projects = useCol('projects');
  const invoices = useCol('invoices');
  const payments = useCol('payments');
  const complaints = useCol('complaints');
  const amcs = useCol('amcs');
  const leads = useCol('leads');
  const items = useCol('items');
  const visits = useCol('visits');
  const staff = useCol('staff');
  const attendance = useCol('attendance', [['date', '==', today()]]);
  const activity = useCol('activity');

  const t = today();
  const month = t.slice(0, 7);
  const active = projects.filter((p) => p.status === 'Active');
  const due = invoices.map((i) => ({ ...i, bal: num(i.total) - num(i.paid) })).filter((i) => i.bal > 0.5);
  const overdue = due.filter((i) => i.dueDate && i.dueDate < t);
  const collected = sum(payments.filter((p) => (p.date || '').startsWith(month)), 'amount');
  const openC = complaints.filter((c) => !['Resolved', 'Closed'].includes(c.status));
  const critical = openC.filter((c) => c.priority?.startsWith('Critical'));
  const amcSoon = amcs.filter((a) => a.status === 'Active' && daysUntil(a.end) <= 30);
  const followUps = leads.filter((l) => !['Won', 'Lost'].includes(l.status) && l.followUpDate && l.followUpDate <= t);
  const pipeline = sum(leads.filter((l) => !['Won', 'Lost'].includes(l.status)), 'value');
  const lowStock = items.filter((i) => num(i.stock) <= num(i.minStock));
  const todayJobs = visits.filter((v) => v.date === t);
  const present = attendance.filter((a) => a.status === 'P').length;
  const activeStaff = staff.filter((s) => s.active !== false).length;
  const late = active.filter((p) => p.expectedHandover && p.expectedHandover < t);

  const attention = [
    ...critical.map((c) => ({ k: 'c' + c.id, tone: 'red', tag: 'Critical', text: `${c.clientName}: ${c.issue}`, go: 'service/complaints/' + c.id })),
    ...overdue.map((i) => ({ k: 'i' + i.id, tone: 'red', tag: 'Overdue', text: `${i.clientName} owes ${inr(i.bal)} (${i.number}, due ${fmtDate(i.dueDate)})`, go: 'billing/invoices/' + i.id })),
    ...amcSoon.map((a) => ({ k: 'a' + a.id, tone: daysUntil(a.end) < 0 ? 'red' : 'amber', tag: daysUntil(a.end) < 0 ? 'AMC expired' : 'AMC renewal', text: `${a.clientName} — ${daysUntil(a.end) < 0 ? 'expired ' + fmtDate(a.end) : 'ends in ' + daysUntil(a.end) + ' days'}`, go: 'service/amc/' + a.id })),
    ...late.map((p) => ({ k: 'p' + p.id, tone: 'amber', tag: 'Delayed', text: `${p.clientName} — ${p.title} past target handover (${fmtDate(p.expectedHandover)})`, go: 'projects/' + p.id })),
    ...followUps.map((l) => ({ k: 'l' + l.id, tone: 'blue', tag: 'Follow-up', text: `${l.name}${l.company ? ' (' + l.company + ')' : ''} — ${l.requirement}`, go: 'sales/leads/' + l.id })),
    ...lowStock.map((i) => ({ k: 's' + i.id, tone: 'amber', tag: 'Low stock', text: `${i.name}: ${i.stock} ${i.unit} left (min ${i.minStock})`, go: 'inventory/items' })),
  ];

  const stageCounts = PROJECT_STAGES.map((s, i) => ({ s, n: active.filter((p) => p.stage === i).length }));
  const maxStage = Math.max(1, ...stageCounts.map((x) => x.n));

  return (
    <div className="page">
      <PageHeader title={`Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, ${(user.name || '').split(' ')[0]}`} sub={new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} />
      <div className="stats">
        <Stat label="Active projects" value={active.length} sub={late.length ? `${late.length} delayed` : 'All on track'} tone={late.length ? 'amber' : ''} onClick={() => go('projects')} />
        <Stat label="To collect" value={inr(sum(due, 'bal'))} sub={`${overdue.length} overdue invoices`} tone={overdue.length ? 'red' : ''} onClick={() => go('billing')} />
        <Stat label="Collected this month" value={inr(collected)} sub={`${payments.filter((p) => (p.date || '').startsWith(month)).length} payments`} tone="green" onClick={() => go('billing/payments')} />
        <Stat label="Open complaints" value={openC.length} sub={critical.length ? `${critical.length} critical` : 'None critical'} tone={critical.length ? 'red' : ''} onClick={() => go('service/complaints')} />
        <Stat label="AMC renewals (30 days)" value={amcSoon.length} sub={`${amcs.filter((a) => a.status === 'Active' && daysUntil(a.end) >= 0).length} active AMCs`} tone={amcSoon.length ? 'amber' : ''} onClick={() => go('service/amc')} />
        <Stat label="Sales pipeline" value={inr(pipeline)} sub={`${followUps.length} follow-ups due`} onClick={() => go('sales')} />
        <Stat label="Field jobs today" value={todayJobs.length} sub={`${todayJobs.filter((v) => v.status === 'Done').length} done`} onClick={() => go('service/visits')} />
        <Stat label="Staff present" value={`${present}/${activeStaff}`} sub="Today's attendance" onClick={() => go('staff/attendance')} />
      </div>

      <div className="grid-2">
        <Card title={`Needs attention (${attention.length})`}>
          {attention.length === 0 ? <Empty>All clear 🎉</Empty> : (
            <ul className="attention">
              {attention.slice(0, 14).map((a) => (
                <li key={a.k} onClick={() => go(a.go)}><Badge tone={a.tone}>{a.tag}</Badge><span>{a.text}</span><span className="chev">›</span></li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Projects by stage">
          <div className="bars">
            {stageCounts.map((x) => (
              <div key={x.s} className="bar-row"><span className="bar-l">{x.s}</span><div className="bar"><div style={{ width: (x.n / maxStage) * 100 + '%' }} /></div><b>{x.n}</b></div>
            ))}
          </div>
        </Card>
      </div>
      <Card title="Latest updates across teams">
        <ActivityFeed items={[...activity].sort((a, b) => b.at - a.at).slice(0, 8)} />
      </Card>
    </div>
  );
}
