// Team tools: tasks between staff, leave requests, salary slips, monthly performance.
import React, { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useCol, PageHeader, Card, Badge, Modal, Field, Select, useForm, act, go, Empty, DataTable, Tabs, PrintFrame, useSettings, logoUrl, Stat } from '../ui';
import { addDoc, updateDoc, setDoc, me } from '../data';
import { today, addDays, fmtDate, num, inr, daysUntil, amountInWords } from '../utils';
import { hasAny, isAdminU } from '../roles';
import { t } from '../i18n';

const mine = (task, user) => (user.staffId && task.assigneeStaffId === user.staffId) || task.assigneeUid === user.id;
const isLate = (x) => x.status !== 'Done' && x.due && x.due < today();

/* ================= TASKS ================= */
export default function Tasks({ user, params }) {
  const admin = isAdminU(user);
  const tasks = useCol('tasks');
  const [view, setView] = useState(params[0] === 'by-me' ? 'by-me' : params[0] === 'all' && admin ? 'all' : 'mine');
  const [form, setForm] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const lists = {
    mine: tasks.filter((x) => mine(x, user)),
    'by-me': tasks.filter((x) => x.byUid === user.id),
    all: tasks,
  };
  const rows = lists[view].filter((x) => showDone || x.status !== 'Done').sort((a, b) => (a.status === 'Done') - (b.status === 'Done') || (a.due || '9') .localeCompare(b.due || '9'));
  const open = lists.mine.filter((x) => x.status !== 'Done');
  return (
    <div className="page">
      <PageHeader title="Tasks" sub="Give work to anyone in the company with a due date — and see what's pending" actions={<button className="btn" onClick={() => setForm({})}>+ New task</button>} />
      <div className="stats">
        <Stat label="My open tasks" value={open.length} tone={open.some(isLate) ? 'red' : ''} sub={`${open.filter(isLate).length} overdue`} onClick={() => setView('mine')} />
        <Stat label="Due today" value={open.filter((x) => x.due === today()).length} tone="amber" />
        <Stat label="Given by me, open" value={lists['by-me'].filter((x) => x.status !== 'Done').length} sub={`${lists['by-me'].filter(isLate).length} overdue`} onClick={() => setView('by-me')} />
      </div>
      <div className="row between wrap">
        <Tabs value={view} onChange={setView} tabs={[{ key: 'mine', label: `My tasks (${open.length})` }, { key: 'by-me', label: 'Given by me' }, ...(admin ? [{ key: 'all', label: 'Everyone' }] : [])]} />
        <label className="check small"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> Show done</label>
      </div>
      <Card pad={false}>
        {rows.length === 0 ? <Empty>{view === 'mine' ? 'Nothing pending for you 🎉' : 'No tasks'}</Empty> : <TaskList rows={rows} user={user} onEdit={setForm} showWho={view !== 'mine'} />}
      </Card>
      {form && <TaskForm initial={form} user={user} onClose={() => setForm(null)} />}
    </div>
  );
}

export function TaskList({ rows, user, onEdit, showWho, compact }) {
  const done = (x) => act(() => updateDoc('tasks', x.id, x.status === 'Done' ? { status: 'Open', doneAt: null } : { status: 'Done', doneAt: Date.now(), doneBy: me()?.name || '' }, x.title), x.status === 'Done' ? 'Re-opened' : 'Done ✓');
  return (
    <ul className="task-list">{rows.map((x) => (
      <li key={x.id} className={(x.status === 'Done' ? 'done ' : '') + (isLate(x) ? 'late' : '')}>
        <button className="tick" onClick={() => done(x)} aria-label={x.status === 'Done' ? 'Re-open' : 'Mark done'}>{x.status === 'Done' ? '✓' : ''}</button>
        <div className="grow" onClick={() => onEdit && onEdit(x)}>
          <b>{x.title}</b>{x.priority === 'High' && <> <Badge tone="red">High</Badge></>}
          <div className="muted small">
            {x.due && <span className={isLate(x) ? 'danger-text' : ''}>{x.due === today() ? 'Today' : daysUntil(x.due) === 1 ? 'Tomorrow' : fmtDate(x.due)}{isLate(x) ? ` (${-daysUntil(x.due)}d late)` : ''}</span>}
            {showWho && <> · for <b>{x.assigneeName}</b></>}{!compact && x.byName && x.byUid !== user.id && <> · from {x.byName}</>}
            {x.projectLabel && <> · <a href={'#/orders/' + x.projectId} onClick={(e) => e.stopPropagation()}>{x.projectLabel}</a></>}
          </div>
          {!compact && x.notes && <div className="small pre">{x.notes}</div>}
        </div>
      </li>
    ))}</ul>
  );
}

export function TaskForm({ initial = {}, user, project, onClose }) {
  const staff = useCol('staff').filter((s) => s.active !== false);
  const { f, bind, setF } = useForm({ title: '', notes: '', assigneeStaffId: '', due: addDays(today(), 1), priority: 'Normal', ...initial, ...(project && !initial.id ? { projectId: project.id, projectLabel: `${project.clientName} · ${project.code || project.quoteNo}`, clientId: project.clientId } : {}) });
  const save = async () => {
    if (!f.title.trim()) return act(async () => { throw new Error('Write the task'); });
    const s = staff.find((x) => x.id === f.assigneeStaffId);
    if (!s) return act(async () => { throw new Error('Choose who should do it'); });
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    Object.assign(data, { title: f.title.trim(), assigneeName: s.name });
    if (id) await act(() => updateDoc('tasks', id, data, data.title), 'Task updated');
    else await act(() => addDoc('tasks', { ...data, status: 'Open', byUid: user.id, byName: user.name || '' }, data.title), `Task given to ${s.name}`);
    onClose();
  };
  return (
    <Modal title={f.id ? 'Task' : 'New task'} onClose={onClose} footer={<>
      {f.id && (isAdminU(user) || f.byUid === user.id) && <button className="btn ghost danger" onClick={() => act(() => updateDoc('tasks', f.id, { status: 'Done', doneAt: Date.now(), cancelled: true }, f.title), 'Closed').then(onClose)}>Close task</button>}
      <span className="spacer" /><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>{f.id ? 'Save' : 'Give task'}</button></>}>
      <div className="form-grid">
        <Field label="Task *" span={2}><input {...bind('title')} autoFocus placeholder="e.g. Call Mr. Gupta about site readiness" /></Field>
        <Field label="Who should do it *"><Select options={staff.map((s) => ({ value: s.id, label: `${s.name}${s.department ? ' · ' + s.department : ''}` }))} {...bind('assigneeStaffId')} /></Field>
        <Field label="Due"><input type="date" {...bind('due')} /></Field>
        <Field label="Priority"><Select options={['Normal', 'High']} placeholder={false} {...bind('priority')} /></Field>
        {f.projectLabel && <Field label="Client / order"><input value={f.projectLabel} readOnly /></Field>}
        <Field label="Details" span={2}><textarea rows={3} {...bind('notes')} /></Field>
      </div>
      {!staff.length && <p className="muted small">Add people in Staff & Teams first.</p>}
      {setF && null}
    </Modal>
  );
}

export function MyTasksCard({ user }) {
  const tasks = useCol('tasks', [['status', '==', 'Open']]);
  const [edit, setEdit] = useState(null);
  const rows = tasks.filter((x) => mine(x, user)).sort((a, b) => (a.due || '9').localeCompare(b.due || '9'));
  if (!rows.length) return null;
  return (
    <Card title={<>My tasks <Badge tone={rows.some(isLate) ? 'red' : 'blue'}>{rows.length}</Badge></>} actions={<button className="btn ghost sm" onClick={() => go('tasks')}>All tasks</button>}>
      <TaskList rows={rows.slice(0, 8)} user={user} onEdit={setEdit} compact />
      {edit && <TaskForm initial={edit} user={user} onClose={() => setEdit(null)} />}
    </Card>
  );
}
export const useTaskBadge = (user, enabled) => {
  const tasks = useCol('tasks', [['status', '==', 'Open']], enabled);
  return tasks.filter((x) => mine(x, user) && (!x.due || x.due <= today())).length;
};

/* ================= LEAVE ================= */
export const LEAVE_TYPES = ['Casual leave', 'Sick leave', 'Earned leave', 'Unpaid leave'];
const dayCount = (a, b) => Math.max(1, Math.round((new Date(b) - new Date(a)) / 86400000) + 1);

export function LeaveButton({ user, className = 'btn ghost sm' }) {
  const [open, setOpen] = useState(false);
  if (!user.staffId) return null;
  return (<>
    <button className={className} onClick={() => setOpen(true)}>🗓 {t('Leave')}</button>
    {open && createPortal(<div className="version-host"><MyLeave user={user} onClose={() => setOpen(false)} /></div>, document.body)}
  </>);
}

function MyLeave({ user, onClose }) {
  const leaves = useCol('leaves', [['staffId', '==', user.staffId]]);
  const { f, bind } = useForm({ from: addDays(today(), 1), to: addDays(today(), 1), type: LEAVE_TYPES[0], reason: '' });
  const apply = async () => {
    if (f.to < f.from) return act(async () => { throw new Error(t('“To” date is before “From”')); });
    await act(() => addDoc('leaves', { ...f, days: dayCount(f.from, f.to), staffId: user.staffId, staffName: user.name || '', status: 'Pending', appliedAt: Date.now() }, 'Leave request'), t('Leave request sent'));
  };
  const list = [...leaves].sort((a, b) => (a.from < b.from ? 1 : -1));
  return (
    <Modal title={t('Apply for leave')} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t('Close')}</button><button className="btn" onClick={apply}>{t('Send request')}</button></>}>
      <div className="form-grid">
        <Field label={t('From')}><input type="date" {...bind('from')} /></Field>
        <Field label={t('To')}><input type="date" {...bind('to')} /></Field>
        <Field label={t('Type')}><Select options={LEAVE_TYPES} placeholder={false} {...bind('type')} /></Field>
        <Field label={t('Days')}><input readOnly value={f.to >= f.from ? dayCount(f.from, f.to) : '—'} /></Field>
        <Field label={t('Reason')} span={2}><input {...bind('reason')} /></Field>
      </div>
      {list.length > 0 && (<>
        <h4 className="section-title">{t('My leave')}</h4>
        <ul className="list">{list.slice(0, 10).map((l) => <li key={l.id}><span>{fmtDate(l.from)}{l.to !== l.from ? ' – ' + fmtDate(l.to) : ''} · {l.type} · {l.days}d{l.note ? ' · ' + l.note : ''}</span><Badge tone={l.status === 'Approved' ? 'green' : l.status === 'Rejected' ? 'red' : 'amber'}>{t(l.status)}</Badge></li>)}</ul>
      </>)}
    </Modal>
  );
}

export function LeaveRequests() {
  const leaves = useCol('leaves');
  const [note, setNote] = useState({});
  const pending = leaves.filter((l) => l.status === 'Pending').sort((a, b) => (a.from > b.from ? 1 : -1));
  const past = leaves.filter((l) => l.status !== 'Pending').sort((a, b) => (a.from < b.from ? 1 : -1)).slice(0, 40);
  const decide = (l, status) => act(async () => {
    await updateDoc('leaves', l.id, { status, decidedBy: me()?.name || '', decidedAt: Date.now(), note: note[l.id] || '' }, `${l.staffName} leave`);
    if (status === 'Approved') {
      for (let d = l.from; d <= l.to; d = addDays(d, 1)) await setDoc('attendance', `${d}_${l.staffId}`, { date: d, staffId: l.staffId, staffName: l.staffName, status: l.type === 'Unpaid leave' ? 'A' : 'L', leaveType: l.type }, true, 'Leave');
    }
  }, status === 'Approved' ? 'Approved — attendance marked' : 'Rejected');
  return (<>
    <Card title={<>Waiting for approval <Badge tone={pending.length ? 'amber' : 'grey'}>{pending.length}</Badge></>}>
      {pending.length === 0 ? <Empty>No pending requests</Empty> : (
        <ul className="list">{pending.map((l) => (
          <li key={l.id} className="leave-row">
            <div className="grow"><b>{l.staffName}</b> <span className="muted small">· {l.type} · {l.days} day{l.days > 1 ? 's' : ''}</span><div className="small">{fmtDate(l.from)}{l.to !== l.from ? ' – ' + fmtDate(l.to) : ''}{l.reason ? ' · ' + l.reason : ''}</div></div>
            <input className="leave-note" placeholder="Note (optional)" value={note[l.id] || ''} onChange={(e) => setNote({ ...note, [l.id]: e.target.value })} />
            <button className="btn ghost sm danger" onClick={() => decide(l, 'Rejected')}>Reject</button>
            <button className="btn sm" onClick={() => decide(l, 'Approved')}>Approve</button>
          </li>
        ))}</ul>
      )}
      <p className="muted small">Approving marks the days as Leave in attendance (Unpaid leave is marked Absent, so it is deducted on the salary slip).</p>
    </Card>
    {past.length > 0 && <Card title="Recent decisions"><ul className="list">{past.map((l) => <li key={l.id}><span>{l.staffName} · {fmtDate(l.from)}{l.to !== l.from ? ' – ' + fmtDate(l.to) : ''} · {l.type}</span><Badge tone={l.status === 'Approved' ? 'green' : 'red'}>{l.status}</Badge></li>)}</ul></Card>}
  </>);
}

/* ================= SALARY SLIPS ================= */
const daysIn = (month) => new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();

export function SalarySlips({ staff }) {
  const [month, setMonth] = useState(addDays(today().slice(0, 8) + '01', -1).slice(0, 7));
  const payroll = useCol('payroll');
  const att = useCol('attendance', [['date', '>=', month + '-01'], ['date', '<=', month + '-31']]);
  const slips = useCol('payslips', [['month', '==', month]]);
  const [extra, setExtra] = useState({});
  const [slip, setSlip] = useState(null);
  const dim = daysIn(month);
  const rows = staff.map((s) => {
    const pay = num(payroll.find((p) => p.id === s.id)?.salary);
    const a = att.filter((x) => x.staffId === s.id);
    const c = (k) => a.filter((x) => x.status === k).length;
    const absent = c('A') + c('H') * 0.5;
    const perDay = pay / dim;
    const ex = extra[s.id] || {};
    const saved = slips.find((x) => x.staffId === s.id);
    const deduct = Math.round(absent * perDay);
    const allowance = num(ex.allowance ?? saved?.allowance);
    const advance = num(ex.advance ?? saved?.advance);
    return { ...s, pay, P: c('P'), H: c('H'), L: c('L'), A: c('A'), absent, deduct, allowance, advance, net: Math.max(0, Math.round(pay - deduct + allowance - advance)), saved };
  }).filter((r) => r.pay > 0);
  const setEx = (id, k, v) => setExtra({ ...extra, [id]: { ...(extra[id] || {}), [k]: v } });
  const save = (r) => act(() => setDoc('payslips', `${month}_${r.id}`, { month, staffId: r.id, staffName: r.name, salary: r.pay, present: r.P, half: r.H, leave: r.L, absent: r.A, deduct: r.deduct, allowance: r.allowance, advance: r.advance, net: r.net, paidOn: today(), by: me()?.name || '' }, true, `Salary ${month} ${r.name}`), 'Marked paid');
  return (
    <Card title={<span className="row gap">Salary slips <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></span>} pad={false}>
      {rows.length === 0 ? <Empty>Enter monthly salaries in each staff record (Staff directory → open person) to make slips.</Empty> : (
        <table className="mini-table full slip-table">
          <thead><tr><th>Staff</th><th className="r">Salary</th><th className="r">P / H / L / A</th><th className="r">Deduction</th><th className="r">Allowance</th><th className="r">Advance</th><th className="r">Net pay</th><th /></tr></thead>
          <tbody>{rows.map((r) => (
            <tr key={r.id}>
              <td><b>{r.name}</b><div className="muted small">{r.designation || r.department}</div></td>
              <td className="r">{inr(r.pay)}</td>
              <td className="r small">{r.P} / {r.H} / {r.L} / {r.A}</td>
              <td className="r">{r.deduct ? '− ' + inr(r.deduct) : '—'}</td>
              <td className="r"><input className="mini r" type="number" value={extra[r.id]?.allowance ?? r.saved?.allowance ?? ''} onChange={(e) => setEx(r.id, 'allowance', e.target.value)} placeholder="0" /></td>
              <td className="r"><input className="mini r" type="number" value={extra[r.id]?.advance ?? r.saved?.advance ?? ''} onChange={(e) => setEx(r.id, 'advance', e.target.value)} placeholder="0" /></td>
              <td className="r"><b>{inr(r.net)}</b></td>
              <td className="r nowrap"><button className="btn ghost sm" onClick={() => setSlip(r)}>Slip</button>{r.saved ? <Badge tone="green">Paid</Badge> : <button className="btn sm" onClick={() => save(r)}>Mark paid</button>}</td>
            </tr>
          ))}</tbody>
        </table>
      )}
      <p className="muted small" style={{ padding: '8px 16px' }}>Deduction = (absent days + ½ for half days) × salary ÷ {dim} days. Paid leave (L) is not deducted; Unpaid leave is marked Absent. Days not marked count as worked.</p>
      {slip && <SlipDoc r={slip} month={month} dim={dim} onClose={() => setSlip(null)} />}
    </Card>
  );
}

function SlipDoc({ r, month, dim, onClose }) {
  const company = useSettings();
  const label = new Date(month + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  return (
    <PrintFrame title={`Salary slip — ${r.name}`} fileName={`Salary slip ${label} ${r.name}`} onClose={onClose}
      whatsapp={{ phone: r.phone, text: `Dear ${r.name}, your salary slip for ${label} is attached. Net pay ${inr(r.net)}. — ${company.name}` }}>
      <div className="print-area">
        <div className="pd-head">
          <img src={logoUrl} alt="" className="pd-logo" />
          <div className="pd-left"><div className="pd-co">{company.name}</div><div className="pd-small pre">{company.address}{company.state ? ', ' + company.state : ''}</div></div>
          <div className="pd-title"><div>SALARY SLIP</div><div className="pd-small">{label}</div></div>
        </div>
        <table className="pd-table"><tbody>
          <tr><td>Employee</td><td><b>{r.name}</b></td><td>Designation</td><td>{r.designation || r.department || '—'}</td></tr>
          <tr><td>Joining date</td><td>{fmtDate(r.joiningDate)}</td><td>Days in month</td><td>{dim}</td></tr>
          <tr><td>Present / Half day</td><td>{r.P} / {r.H}</td><td>Paid leave / Absent</td><td>{r.L} / {r.A}</td></tr>
        </tbody></table>
        <table className="pd-table">
          <thead><tr><th>Earnings</th><th className="r">₹</th><th>Deductions</th><th className="r">₹</th></tr></thead>
          <tbody>
            <tr><td>Monthly salary</td><td className="r">{inr(r.pay)}</td><td>Absence ({r.absent} day{r.absent === 1 ? '' : 's'})</td><td className="r">{inr(r.deduct)}</td></tr>
            <tr><td>Allowance / incentive</td><td className="r">{inr(r.allowance)}</td><td>Advance recovered</td><td className="r">{inr(r.advance)}</td></tr>
            <tr><td><b>Total earnings</b></td><td className="r"><b>{inr(r.pay + r.allowance)}</b></td><td><b>Total deductions</b></td><td className="r"><b>{inr(r.deduct + r.advance)}</b></td></tr>
          </tbody>
        </table>
        <div className="pd-totals"><div className="grand"><span>Net pay</span><span>{inr(r.net)}</span></div><div className="pd-words">{amountInWords(r.net)}</div></div>
        <div className="pd-sign"><div>Employee signature</div><div>For {company.name}<br />{company.signature ? <img src={company.signature} alt="" className="pd-sigimg" /> : <><br /><br /></>}<br />Authorised Signatory</div></div>
      </div>
    </PrintFrame>
  );
}

/* ================= PERFORMANCE ================= */
export function Performance({ staff }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const from = month + '-01', to = month + '-31';
  const att = useCol('attendance', [['date', '>=', from], ['date', '<=', to]]);
  const tasks = useCol('tasks');
  const projects = useCol('projects');
  const visits = useCol('visits', [['date', '>=', from], ['date', '<=', to]]);
  const diary = useCol('diary', [['date', '>=', from], ['date', '<=', to]]);
  const inMonth = (ms) => ms && new Date(ms).toISOString().slice(0, 7) === month;
  const rows = useMemo(() => staff.map((s) => {
    const a = att.filter((x) => x.staffId === s.id);
    const myTasks = tasks.filter((x) => x.assigneeStaffId === s.id && (x.due || '').slice(0, 7) === month && !x.cancelled);
    const doneT = myTasks.filter((x) => x.status === 'Done');
    const onTime = doneT.filter((x) => !x.due || new Date(x.doneAt).toISOString().slice(0, 10) <= x.due);
    const enq = projects.filter((p) => p.salesBy === s.id && inMonth(p.createdAt));
    const won = projects.filter((p) => p.salesBy === s.id && inMonth(p.orderConfirmedAt));
    const jobs = visits.filter((v) => v.status === 'Done' && (v.doneBy === s.name || (s.teamId && v.teamId === s.teamId)));
    const days = diary.filter((d) => d.by === s.name);
    return {
      id: s.id, name: s.name, department: s.department, present: a.filter((x) => x.status === 'P').length + a.filter((x) => x.status === 'H').length * 0.5, leave: a.filter((x) => x.status === 'L').length, absent: a.filter((x) => x.status === 'A').length,
      tasks: myTasks.length, tasksDone: doneT.length, onTime: doneT.length ? Math.round((onTime.length / doneT.length) * 100) : null, overdue: myTasks.filter(isLate).length,
      enquiries: enq.length, won: won.length, wonValue: won.reduce((x, p) => x + num(p.contractValue), 0), jobs: jobs.length, diary: days.length,
    };
  }), [staff, att, tasks, projects, visits, diary, month]);
  return (
    <Card title={<span className="row gap">Monthly performance <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></span>} pad={false}>
      <DataTable csvName={'performance-' + month} rows={rows} searchable initialSort={{ key: 'name' }}
        columns={[
          { key: 'name', label: 'Staff', render: (r) => <><b>{r.name}</b><div className="muted small">{r.department}</div></>, csv: (r) => r.name },
          { key: 'present', label: 'Present', align: 'r', render: (r) => <>{r.present}{r.absent ? <span className="danger-text small"> · {r.absent} A</span> : ''}{r.leave ? <span className="muted small"> · {r.leave} L</span> : ''}</>, sortValue: (r) => r.present, csv: (r) => r.present },
          { key: 'tasksDone', label: 'Tasks done', align: 'r', render: (r) => (r.tasks ? <>{r.tasksDone}/{r.tasks}{r.overdue ? <span className="danger-text small"> · {r.overdue} late</span> : ''}</> : '—'), sortValue: (r) => r.tasksDone, csv: (r) => `${r.tasksDone}/${r.tasks}` },
          { key: 'onTime', label: 'On time', align: 'r', render: (r) => (r.onTime === null ? '—' : <Badge tone={r.onTime >= 80 ? 'green' : r.onTime >= 50 ? 'amber' : 'red'}>{r.onTime}%</Badge>), sortValue: (r) => r.onTime ?? -1, csv: (r) => r.onTime ?? '' },
          { key: 'enquiries', label: 'Enquiries', align: 'r', value: (r) => r.enquiries || '—', sortValue: (r) => r.enquiries },
          { key: 'won', label: 'Orders won', align: 'r', render: (r) => (r.won ? <>{r.won}<div className="muted small">{inr(r.wonValue)}</div></> : '—'), sortValue: (r) => r.wonValue, csv: (r) => `${r.won} (${r.wonValue})` },
          { key: 'jobs', label: 'Jobs done', align: 'r', value: (r) => r.jobs || '—', sortValue: (r) => r.jobs },
          { key: 'diary', label: 'Diary days', align: 'r', value: (r) => r.diary || '—', sortValue: (r) => r.diary },
        ]} />
      <p className="muted small" style={{ padding: '8px 16px' }}>Jobs done counts completed field jobs of the person's team. Orders won and enquiries use the salesperson on the client tab.</p>
    </Card>
  );
}
