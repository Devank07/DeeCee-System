import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Tabs, Stat } from '../ui';
import { addDoc, updateDoc, setDoc } from '../data';
import { DEPARTMENTS } from '../constants';
import { inr, fmtDate, today, num } from '../utils';

export default function Staff({ user, params }) {
  const tab = ['attendance', 'report'].includes(params[0]) ? params[0] : 'directory';
  const staff = useCol('staff');
  const att = useCol('attendance', [['date', '==', today()]]);
  const active = staff.filter((s) => s.active !== false);
  return (
    <div className="page">
      <PageHeader title="Staff & Attendance" sub="Employee records, daily attendance and monthly summary" />
      <div className="stats">
        <Stat label="Active staff" value={active.length} />
        <Stat label="Present today" value={att.filter((a) => a.status === 'P').length} tone="green" />
        <Stat label="On leave / absent" value={att.filter((a) => ['L', 'A'].includes(a.status)).length} tone="amber" />
        <Stat label="Not marked" value={active.filter((s) => !att.some((a) => a.staffId === s.id)).length} />
      </div>
      <Tabs value={tab} onChange={(k) => go('staff/' + k)} tabs={[{ key: 'directory', label: 'Staff directory' }, { key: 'attendance', label: 'Mark attendance' }, { key: 'report', label: 'Monthly report' }]} />
      {tab === 'directory' && <Directory staff={staff} user={user} />}
      {tab === 'attendance' && <Attendance staff={active} />}
      {tab === 'report' && <Report staff={active} />}
    </div>
  );
}

function Directory({ staff, user }) {
  const canSeePay = ['admin', 'accounts'].includes(user.role);
  const payroll = useCol('payroll', [], canSeePay);
  const [form, setForm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const rows = staff.filter((s) => showInactive || s.active !== false);
  return (
    <>
      <div className="chips">
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show former staff</label>
        <span className="spacer" />
        <button className="btn" onClick={() => setForm({})}>+ Add staff</button>
      </div>
      <Card pad={false}>
        <DataTable csvName="staff" rows={rows} onRow={setForm} initialSort={{ key: 'department' }}
          columns={[
            { key: 'name', label: 'Name', render: (r) => <><b>{r.name}</b><div className="muted small">{r.designation}</div></>, csv: (r) => r.name },
            { key: 'department', label: 'Department' },
            { key: 'phone', label: 'Phone', render: (r) => (r.phone ? <a href={'tel:' + r.phone} onClick={(e) => e.stopPropagation()}>{r.phone}</a> : '—'), csv: (r) => r.phone },
            { key: 'joiningDate', label: 'Joined', value: (r) => fmtDate(r.joiningDate), sortValue: (r) => r.joiningDate, csv: (r) => r.joiningDate },
            { key: 'tech', label: 'Field', render: (r) => (r.isTechnician ? <Badge tone="blue">Technician</Badge> : ''), csv: (r) => (r.isTechnician ? 'Yes' : '') },
            { key: 'active', label: 'Status', render: (r) => <Badge>{r.active === false ? 'Disabled' : 'Active'}</Badge>, csv: (r) => (r.active === false ? 'Left' : 'Active') },
          ]} />
      </Card>
      {form && <StaffForm s={form.id ? form : null} canSeePay={canSeePay} salary={payroll.find((x) => x.id === form.id)?.salary ?? ''} onClose={() => setForm(null)} />}
    </>
  );
}

function StaffForm({ s, canSeePay, salary, onClose }) {
  const { f, bind, set } = useForm({ ...(s || { name: '', phone: '', email: '', department: 'Installation', designation: '', joiningDate: today(), dob: '', address: '', emergencyContact: '', bloodGroup: '', isTechnician: false, active: true, notes: '' }), salary });
  const save = async () => {
    if (!f.name) return alert('Name required');
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, salary: pay, ...data } = f;
    let sid = s?.id;
    if (sid) await act(() => updateDoc('staff', sid, data, data.name), 'Saved'); else sid = await act(() => addDoc('staff', data, data.name), 'Staff added');
    // Salary lives in a separate collection that only Admin & Accounts can read
    if (canSeePay && pay !== '' && pay !== salary) await setDoc('payroll', sid, { salary: num(pay), staffName: data.name }, true, data.name);
    onClose();
  };
  return (
    <Modal title={s ? s.name : 'Add staff member'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Full name *"><input {...bind('name')} /></Field>
        <Field label="Phone"><input {...bind('phone')} inputMode="tel" /></Field>
        <Field label="Email"><input {...bind('email')} /></Field>
        <Field label="Department"><Select options={DEPARTMENTS} placeholder={false} {...bind('department')} /></Field>
        <Field label="Designation"><input {...bind('designation')} placeholder="Fitter, Helper, Supervisor…" /></Field>
        <Field label="Joining date"><input type="date" {...bind('joiningDate')} /></Field>
        <Field label="Date of birth"><input type="date" {...bind('dob')} /></Field>
        <Field label="Blood group"><input {...bind('bloodGroup')} /></Field>
        <Field label="Address" span={2}><input {...bind('address')} /></Field>
        <Field label="Emergency contact" span={2}><input {...bind('emergencyContact')} placeholder="Name & phone" /></Field>
        {canSeePay && <Field label="Monthly salary (₹)"><input type="number" {...bind('salary', 'number')} /></Field>}
        <Field label="Notes (documents, skills, licences)" span={2}><textarea rows={2} {...bind('notes')} /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={!!f.isTechnician} onChange={(e) => set('isTechnician', e.target.checked)} /> Field technician (can be assigned site jobs)</label>
      <label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Currently working</label>
      {canSeePay && salary ? <p className="muted small">Salary on record: {inr(salary)} / month</p> : null}
    </Modal>
  );
}

const MARKS = [['P', 'Present'], ['H', 'Half day'], ['L', 'Leave'], ['A', 'Absent']];
function Attendance({ staff }) {
  const [date, setDate] = useState(today());
  const att = useCol('attendance', [['date', '==', date]]);
  const mark = (s, status) => act(() => setDoc('attendance', `${date}_${s.id}`, { date, staffId: s.id, staffName: s.name, status, ...(status === 'P' && !att.find((a) => a.staffId === s.id)?.inTime ? { inTime: new Date().toTimeString().slice(0, 5) } : {}) }, true, s.name));
  const markAll = () => Promise.all(staff.filter((s) => !att.some((a) => a.staffId === s.id)).map((s) => mark(s, 'P')));
  return (
    <Card title={<input type="date" value={date} onChange={(e) => setDate(e.target.value)} />} actions={<button className="btn ghost sm" onClick={markAll}>Mark remaining Present</button>}>
      <ul className="att-list">
        {staff.map((s) => {
          const a = att.find((x) => x.staffId === s.id);
          return (
            <li key={s.id}>
              <div><b>{s.name}</b><div className="muted small">{s.department}{a?.inTime ? ' · in ' + a.inTime : ''}{a?.via ? ' · ' + a.via : ''}</div></div>
              <div className="seg">
                {MARKS.map(([k, l]) => <button key={k} title={l} className={a?.status === k ? 'on ' + k : ''} onClick={() => mark(s, k)}>{k}</button>)}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">P = Present · H = Half day · L = Leave · A = Absent. Technicians can also check in from their phone.</p>
    </Card>
  );
}

function Report({ staff }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const all = useCol('attendance');
  const rows = staff.map((s) => {
    const mine = all.filter((a) => a.staffId === s.id && (a.date || '').startsWith(month));
    const c = (k) => mine.filter((a) => a.status === k).length;
    return { id: s.id, name: s.name, department: s.department, P: c('P'), H: c('H'), L: c('L'), A: c('A'), days: c('P') + c('H') * 0.5 };
  });
  return (
    <Card title={<input type="month" value={month} onChange={(e) => setMonth(e.target.value)} />} pad={false}>
      <DataTable csvName={'attendance-' + month} rows={rows} searchable={false} initialSort={{ key: 'name' }}
        columns={[{ key: 'name', label: 'Staff' }, { key: 'department', label: 'Dept' }, { key: 'P', label: 'Present', align: 'r' }, { key: 'H', label: 'Half', align: 'r' }, { key: 'L', label: 'Leave', align: 'r' }, { key: 'A', label: 'Absent', align: 'r' }, { key: 'days', label: 'Paid days', align: 'r' }]} />
    </Card>
  );
}
