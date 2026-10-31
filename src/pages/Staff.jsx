import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Tabs, Stat, Empty, toast } from '../ui';
import { addDoc, updateDoc, setDoc, backend, me, DEMO } from '../data';
import { DEPARTMENTS, TEAM_TYPES } from '../constants';
import { inr, fmtDate, today, num } from '../utils';
import { hasAny, isAdminU, rolesOf, roleLabel } from '../roles';
import { RoleChecks } from './Access';

const isTechStaff = (s) => s.isTechnician || ['Installation', 'Service'].includes(s.department);

export default function Staff({ user, params }) {
  const hr = hasAny(user, 'accounts');
  const tabs = hr ? [{ key: 'directory', label: 'Staff directory' }, { key: 'teams', label: 'Site teams' }, { key: 'attendance', label: 'Mark attendance' }, { key: 'report', label: 'Monthly report' }] : [{ key: 'teams', label: 'Site teams' }, { key: 'directory', label: 'Staff directory' }];
  const tab = tabs.some((t) => t.key === params[0]) ? params[0] : tabs[0].key;
  const staff = useCol('staff');
  const att = useCol('attendance', [['date', '==', today()]]);
  const active = staff.filter((s) => s.active !== false);
  return (
    <div className="page">
      <PageHeader title="Staff & Teams" sub="Employee records, site teams and attendance" />
      <div className="stats">
        <Stat label="Active staff" value={active.length} />
        <Stat label="Technicians" value={active.filter(isTechStaff).length} sub={`${active.filter((s) => isTechStaff(s) && !s.teamId).length} not in a team`} tone={active.some((s) => isTechStaff(s) && !s.teamId) ? 'amber' : ''} onClick={() => go('staff/teams')} />
        <Stat label="Present today" value={att.filter((a) => a.status === 'P').length} tone="green" />
        <Stat label="Leave / absent" value={att.filter((a) => ['L', 'A'].includes(a.status)).length} tone="amber" />
      </div>
      <Tabs value={tab} onChange={(k) => go('staff/' + k)} tabs={tabs} />
      {tab === 'directory' && <Directory staff={staff} user={user} canEdit={hr} />}
      {tab === 'teams' && <Teams staff={active} />}
      {tab === 'attendance' && <Attendance staff={active} />}
      {tab === 'report' && <Report staff={active} />}
    </div>
  );
}

/* ---------- TEAMS ---------- */
function Teams({ staff }) {
  const teams = useCol('teams');
  const [edit, setEdit] = useState(null);
  const unassigned = staff.filter((s) => isTechStaff(s) && !s.teamId);
  return (
    <>
      <div className="chips"><p className="muted small">Technicians see only the sites and jobs of their own team on their phones.</p><span className="spacer" /><button className="btn" onClick={() => setEdit({})}>+ New team</button></div>
      <div className="team-grid">
        {teams.filter((t) => t.active !== false).map((t) => {
          const members = staff.filter((s) => s.teamId === t.id);
          return (
            <Card key={t.id} title={<>{t.name} <Badge tone={t.type === 'Service' ? 'green' : 'blue'}>{t.type}</Badge></>} actions={<button className="btn ghost sm" onClick={() => setEdit(t)}>Edit</button>}>
              {members.length === 0 ? <p className="muted small">No members yet</p> : (
                <ul className="list">{members.map((m) => <li key={m.id}><div><b>{m.name}</b>{t.leaderId === m.id && <> <Badge tone="amber">Leader</Badge></>}<div className="muted small">{m.designation}</div></div>{m.phone && <a href={'tel:' + m.phone} className="small">{m.phone}</a>}</li>)}</ul>
              )}
            </Card>
          );
        })}
      </div>
      {teams.length === 0 && <Empty>No teams yet. Create one team per installation crew and one for service.</Empty>}
      {unassigned.length > 0 && (
        <Card title="Technicians not in any team">
          <p className="muted small">They won't see any jobs until they are added to a team.</p>
          <ul className="list">{unassigned.map((s) => <li key={s.id}><span>{s.name} <span className="muted small">· {s.designation || s.department}</span></span></li>)}</ul>
        </Card>
      )}
      {edit && <TeamForm team={edit.id ? edit : null} staff={staff} teams={teams} onClose={() => setEdit(null)} />}
    </>
  );
}

function TeamForm({ team, staff, teams, onClose }) {
  const { f, bind } = useForm(team || { name: '', type: 'Installation', leaderId: '' });
  const [members, setMembers] = useState(team ? staff.filter((s) => s.teamId === team.id).map((s) => s.id) : []);
  const techs = staff.filter(isTechStaff);
  const teamName = (id) => teams.find((t) => t.id === id)?.name;
  const save = async (deactivate) => {
    if (!f.name.trim()) return act(async () => { throw new Error('Team name is required'); });
    await act(async () => {
      const data = { name: f.name.trim(), type: f.type, leaderId: members.includes(f.leaderId) ? f.leaderId : '', active: !deactivate };
      let id = team?.id;
      if (id) await updateDoc('teams', id, data, data.name); else id = await addDoc('teams', data, data.name);
      const before = team ? staff.filter((s) => s.teamId === team.id).map((s) => s.id) : [];
      const keep = deactivate ? [] : members;
      for (const sid of keep.filter((x) => !before.includes(x))) await updateDoc('staff', sid, { teamId: id }, 'Team');
      for (const sid of before.filter((x) => !keep.includes(x))) await updateDoc('staff', sid, { teamId: null }, 'Team');
    }, deactivate ? 'Team removed' : 'Team saved');
    onClose();
  };
  return (
    <Modal title={team ? 'Edit team' : 'New team'} onClose={onClose} footer={<>{team && <button className="btn ghost danger" onClick={() => save(true)}>Remove team</button>}<span className="spacer" /><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={() => save(false)}>Save</button></>}>
      <div className="form-grid">
        <Field label="Team name *"><input {...bind('name')} placeholder="Installation Team A" /></Field>
        <Field label="Type"><Select options={TEAM_TYPES} placeholder={false} {...bind('type')} /></Field>
        <Field label="Team leader" span={2}><Select options={techs.filter((s) => members.includes(s.id)).map((s) => ({ value: s.id, label: s.name }))} placeholder="— Pick from members —" {...bind('leaderId')} /></Field>
      </div>
      <div className="field"><span className="field-label">Members</span>
        <div className="checks">
          {techs.map((s) => (
            <label key={s.id} className="check"><input type="checkbox" checked={members.includes(s.id)} onChange={(e) => setMembers(e.target.checked ? [...members, s.id] : members.filter((x) => x !== s.id))} />
              {s.name} <span className="muted small">· {s.designation || s.department}{s.teamId && s.teamId !== team?.id ? ` · now in ${teamName(s.teamId) || 'another team'}` : ''}</span></label>
          ))}
          {techs.length === 0 && <p className="muted small">Add technicians in the Staff directory first (tick “Field technician”).</p>}
        </div>
      </div>
    </Modal>
  );
}

/* ---------- DIRECTORY ---------- */
function Directory({ staff, user, canEdit }) {
  const teams = useCol('teams');
  const canSeePay = hasAny(user, 'accounts');
  const admin = isAdminU(user);
  const payroll = useCol('payroll', [], canSeePay);
  const users = useCol('users', [], admin);
  const loginOf = (sid) => users.find((u) => u.staffId === sid);
  const [form, setForm] = useState(null);
  const [showInactive, setShowInactive] = useState(false);
  const rows = staff.filter((s) => showInactive || s.active !== false);
  return (
    <>
      <div className="chips">
        <label className="check"><input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} /> Show former staff</label>
        <span className="spacer" />
        {canEdit && <button className="btn" onClick={() => setForm({})}>+ Add staff</button>}
      </div>
      <Card pad={false}>
        <DataTable csvName="staff" rows={rows} onRow={canEdit ? setForm : undefined} initialSort={{ key: 'department' }}
          columns={[
            { key: 'name', label: 'Name', render: (r) => <><b>{r.name}</b><div className="muted small">{r.designation}</div></>, csv: (r) => r.name },
            { key: 'department', label: 'Department' },
            { key: 'team', label: 'Team', value: (r) => teams.find((t) => t.id === r.teamId)?.name || (isTechStaff(r) ? 'Not in a team' : '—') },
            { key: 'phone', label: 'Phone', render: (r) => (r.phone ? <a href={'tel:' + r.phone} onClick={(e) => e.stopPropagation()}>{r.phone}</a> : '—'), csv: (r) => r.phone },
            { key: 'joiningDate', label: 'Joined', value: (r) => fmtDate(r.joiningDate), sortValue: (r) => r.joiningDate, csv: (r) => r.joiningDate },
            ...(admin ? [{ key: 'access', label: 'System access', render: (r) => { const u = loginOf(r.id); return u ? <span className="role-chips">{u.active === false ? <Badge tone="red">Login disabled</Badge> : rolesOf(u).map((x) => <Badge key={x} tone={x === 'admin' ? 'amber' : 'blue'}>{roleLabel({ roles: [x] })}</Badge>)}</span> : <span className="muted small">No login</span>; }, csv: (r) => roleLabel(loginOf(r.id)) || 'No login' }] : []),
            { key: 'active', label: 'Status', render: (r) => <Badge>{r.active === false ? 'Disabled' : 'Active'}</Badge>, csv: (r) => (r.active === false ? 'Left' : 'Active') },
          ]} />
      </Card>
      {form && <StaffForm s={form.id ? form : null} teams={teams} canSeePay={canSeePay} admin={admin} login={form.id ? loginOf(form.id) : null} salary={payroll.find((x) => x.id === form.id)?.salary ?? ''} onClose={() => setForm(null)} />}
    </>
  );
}

const DEPT_ROLE = { Sales: 'sales', Drawing: 'drawing', 'Material & Dispatch': 'stores', Installation: 'projects', Service: 'service', Accounts: 'accounts', Management: 'admin' };

function StaffForm({ s, teams, canSeePay, admin, login, salary, onClose }) {
  const { f, bind, set } = useForm({ ...(s || { name: '', phone: '', email: '', department: 'Installation', designation: '', joiningDate: today(), dob: '', address: '', emergencyContact: '', bloodGroup: '', isTechnician: false, teamId: '', active: true, notes: '' }), salary });
  const self = login && login.id === me()?.id;
  const [acc, setAcc] = useState({ give: !!login, email: login?.email || s?.email || '', password: '', roles: login ? rolesOf(login) : [], active: login ? login.active !== false : true });
  const setA = (k, v) => setAcc((a) => ({ ...a, [k]: v }));
  const suggest = () => [...new Set([f.isTechnician ? 'technician' : DEPT_ROLE[f.department]].filter(Boolean))];
  const save = async () => {
    const fail = (m) => act(async () => { throw new Error(m); });
    if (!f.name) return fail('Name is required');
    const wantLogin = admin && (login || acc.give);
    if (wantLogin) {
      if (!acc.roles.length) return fail('Tick at least one access area, or untick “Give login”');
      if (!login && !/^\S+@\S+\.\S+$/.test(acc.email)) return fail('Enter a valid login email');
      if (!login && acc.password.length < 6) return fail('Temporary password must be at least 6 characters');
      if (self && !acc.roles.includes('admin')) return fail("You can't remove your own Admin access");
    }
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, salary: pay, ...data } = f;
    data.teamId = data.teamId || null;
    if (acc.roles.includes('technician')) data.isTechnician = true;
    let sid = s?.id;
    if (sid) await act(() => updateDoc('staff', sid, data, data.name), 'Saved'); else sid = await act(() => addDoc('staff', data, data.name), 'Staff added');
    if (canSeePay && pay !== '' && pay !== salary) await setDoc('payroll', sid, { salary: num(pay), staffName: data.name }, true, data.name);
    if (wantLogin) {
      const roles = acc.roles.includes('admin') ? ['admin', ...acc.roles.filter((r) => r !== 'admin')] : acc.roles;
      if (login) await act(() => updateDoc('users', login.id, { roles, role: roles[0], name: data.name, staffId: sid, active: self ? true : acc.active }, login.email), 'Access updated');
      else await act(() => backend().createAccount({ email: acc.email.trim(), password: acc.password, name: data.name, roles, role: roles[0], staffId: sid }), `Login created — give ${data.name} the email and password`);
      if (roles.includes('technician') && !data.teamId) toast('Add this technician to a site team so jobs show on their phone', 'err');
    }
    onClose();
  };
  return (
    <Modal title={s ? s.name : 'Add staff member'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Full name *"><input {...bind('name')} /></Field>
        <Field label="Phone"><input {...bind('phone')} inputMode="tel" /></Field>
        <Field label="Email"><input {...bind('email')} /></Field>
        <Field label="Department"><Select options={DEPARTMENTS} placeholder={false} {...bind('department')} /></Field>
        <Field label="Designation"><input {...bind('designation')} placeholder="Fitter, Helper, Draughtsman…" /></Field>
        <Field label="Joining date"><input type="date" {...bind('joiningDate')} /></Field>
        <Field label="Date of birth"><input type="date" {...bind('dob')} /></Field>
        <Field label="Blood group"><input {...bind('bloodGroup')} /></Field>
        <Field label="Address" span={2}><input {...bind('address')} /></Field>
        <Field label="Emergency contact" span={2}><input {...bind('emergencyContact')} placeholder="Name & phone" /></Field>
        {canSeePay && <Field label="Monthly salary (₹)" hint="Only Admin & Accounts can see this"><input type="number" {...bind('salary', 'number')} /></Field>}
        {(f.isTechnician || ['Installation', 'Service'].includes(f.department)) && <Field label="Site team"><Select options={teams.filter((t) => t.active !== false).map((t) => ({ value: t.id, label: t.name }))} placeholder="— Not in a team —" {...bind('teamId')} /></Field>}
        <Field label="Notes (documents, skills, licences)" span={2}><textarea rows={2} {...bind('notes')} /></Field>
        {['Sales', 'Management'].includes(f.department) && <Field label="Quotation sign-off (page 1)" span={2} hint="One line per row. First two lines print in bold."><textarea rows={5} {...bind('quoteSignature')} placeholder={'VIVEK AGARWAL\nVee Kay Engineers\n2/49 Ram Nagar Colony-AGRA-282002\nMobile: 98xxxxxxxx\nEmail: name@example.com'} /></Field>}
      </div>
      <label className="check"><input type="checkbox" checked={!!f.isTechnician} onChange={(e) => set('isTechnician', e.target.checked)} /> Field technician (works at sites)</label>
      <label className="check"><input type="checkbox" checked={f.active !== false} onChange={(e) => set('active', e.target.checked)} /> Currently working</label>
      {canSeePay && salary ? <p className="muted small">Salary on record: {inr(salary)} / month</p> : null}

      {admin && (
        <div className="access-box">
          <div className="access-head">
            <h4>System access</h4>
            {login ? <span className="muted small">Login: <b>{login.email}</b></span>
              : <label className="check"><input type="checkbox" checked={acc.give} onChange={(e) => { setA('give', e.target.checked); if (e.target.checked && !acc.roles.length) setA('roles', suggest()); if (e.target.checked && !acc.email) setA('email', f.email || ''); }} /> Give {f.name || 'this person'} a login</label>}
          </div>
          {(login || acc.give) ? (<>
            {!login && (
              <div className="form-grid">
                <Field label="Login email"><input type="email" value={acc.email} onChange={(e) => setA('email', e.target.value)} placeholder="name@deeceeelevators.in" /></Field>
                <Field label="Temporary password" hint="At least 6 characters. They can change it from “Forgot password?” on the login page."><input value={acc.password} onChange={(e) => setA('password', e.target.value)} /></Field>
              </div>
            )}
            <p className="muted small">Tick what {f.name || 'this person'} can see and do. You can tick more than one.</p>
            <RoleChecks value={acc.roles} onChange={(v) => setA('roles', v)} lockAdmin={self} />
            {login && (
              <div className="row gap wrap mt">
                {!self && <label className="check"><input type="checkbox" checked={acc.active} onChange={(e) => setA('active', e.target.checked)} /> Login active (untick to block access immediately)</label>}
                {!DEMO && <button className="btn ghost sm" onClick={() => act(() => backend().resetPassword(login.email), 'Password reset email sent to ' + login.email)}>Send password reset email</button>}
              </div>
            )}
          </>) : <p className="muted small">No login. This person won't be able to sign in. Tick above to give them access.</p>}
        </div>
      )}
    </Modal>
  );
}

/* ---------- ATTENDANCE ---------- */
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
              <div className="seg">{MARKS.map(([k, l]) => <button key={k} title={l} className={a?.status === k ? 'on ' + k : ''} onClick={() => mark(s, k)}>{k}</button>)}</div>
            </li>
          );
        })}
      </ul>
      <p className="muted small">P = Present · H = Half day · L = Leave · A = Absent. Technicians can also check in from their phones.</p>
    </Card>
  );
}

function Report({ staff }) {
  const [month, setMonth] = useState(today().slice(0, 7));
  const all = useCol('attendance', [['date', '>=', month + '-01'], ['date', '<=', month + '-31']]);
  const rows = staff.map((s) => {
    const mine = all.filter((a) => a.staffId === s.id);
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
