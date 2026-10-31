import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, Badge, Tabs, useSettings } from '../ui';
import { setDoc, updateDoc, backend, DEMO, me } from '../data';
import { ROLES, STATE_NAMES } from '../constants';
import { downloadFile, fmtDate, compressImage } from '../utils';
import { buildRef } from '../proposal';
import { rolesOf, roleLabel } from '../roles';
import { RoleChecks } from './Access';

export default function Settings({ params }) {
  const tab = ['users', 'data'].includes(params[0]) ? params[0] : 'company';
  return (
    <div className="page">
      <PageHeader title="Settings" sub="Company details, user logins and data backup" />
      <Tabs value={tab} onChange={(k) => (location.hash = '#/settings/' + k)} tabs={[{ key: 'company', label: 'Company' }, { key: 'users', label: 'Logins & access' }, { key: 'data', label: 'Backup' }]} />
      {tab === 'company' && <Company />}
      {tab === 'users' && <Users />}
      {tab === 'data' && <Data />}
    </div>
  );
}

function Company() {
  const s = useSettings();
  return <CompanyForm key={s.id ? 'loaded' : 'empty'} s={s} />;
}
function CompanyForm({ s }) {
  const { f, bind, set } = useForm({ ...s });
  const save = () => { const { id, createdAt, updatedAt, ...data } = f; return act(() => setDoc('settings', 'company', data, true, 'Company details'), 'Saved'); };
  const sig = async (e) => { const file = e.target.files[0]; e.target.value = ''; if (file) set('signature', await compressImage(file, 600, 0.85)); };
  return (
    <>
      <Card title="Company details (printed on quotations, invoices, POs & challans)" actions={<button className="btn" onClick={save}>Save</button>}>
        <div className="form-grid">
          <Field label="Company name (letterhead)"><input {...bind('name')} /></Field>
          <Field label="Tagline"><input {...bind('tagline')} /></Field>
          <Field label="Name for sign-off" hint="“For DEE CEE ELEVATORS (P) LTD”"><input {...bind('shortName')} /></Field>
          <Field label="Name in letter text"><input {...bind('letterName')} /></Field>
          <Field label="Address (footer of every page)" span={2}><textarea rows={2} {...bind('address')} /></Field>
          <Field label="State (for GST)" hint="Same state → CGST+SGST, other states → IGST"><Select options={STATE_NAMES} {...bind('state')} /></Field>
          <Field label="Phone"><input {...bind('phone')} /></Field>
          <Field label="Email"><input {...bind('email')} /></Field>
          <Field label="Website"><input {...bind('website')} /></Field>
          <Field label="GSTIN"><input {...bind('gstin')} /></Field>
          <Field label="PAN"><input {...bind('pan')} /></Field>
          <Field label="Bank details (printed on quotations & invoices)" span={2} hint="One line per row, e.g. DEE CEE ELEVATORS PVT LTD / INDIAN BANK A/C No. …, IFSC … / BRANCH: …"><textarea rows={3} {...bind('bank')} /></Field>
        </div>
      </Card>
      <Card title="Quotation settings" actions={<button className="btn" onClick={save}>Save</button>}>
        <div className="form-grid">
          <Field label="Reference prefix"><input {...bind('quotePrefix')} /></Field>
          <Field label="Next quotation serial no." hint={'Next ref looks like ' + buildRef(f.quotePrefix, 'Uttar Pradesh', 'AG', f.quoteNextSerial)}><input type="number" {...bind('quoteNextSerial', 'number')} /></Field>
          <Field label="Default note after GST line"><input {...bind('freightNote')} /></Field>
          <Field label="Default GST %"><input type="number" {...bind('defaultGst', 'number')} /></Field>
          <Field label="AMC without material (% / year)"><input type="number" {...bind('amcWithout', 'number')} /></Field>
          <Field label="Comprehensive AMC (% / year)"><input type="number" {...bind('amcComp', 'number')} /></Field>
          <Field label="Default HSN for lift supply" hint="Confirm codes with your CA"><input {...bind('hsnSupply')} /></Field>
          <Field label="Default SAC for installation / AMC"><input {...bind('sacService')} /></Field>
        </div>
        <div className="field"><span className="field-label">Authorised signatory signature (printed on page 4 and on invoices)</span>
          <div className="row gap wrap">
            {f.signature ? <img src={f.signature} alt="Signature" className="sig-preview" /> : <span className="muted small">No signature uploaded</span>}
            <label className="btn ghost sm file-btn">Upload signature photo<input type="file" accept="image/*" hidden onChange={sig} /></label>
            {f.signature && <button className="btn ghost sm" onClick={() => set('signature', '')}>Remove</button>}
          </div>
          <span className="hint">Sign on white paper, take a clear photo, crop it close. Click Save after uploading.</span>
        </div>
      </Card>
    </>
  );
}

function Users() {
  const users = useCol('users');
  const staff = useCol('staff');
  const clients = useCol('clients');
  const [create, setCreate] = useState(false);
  const [edit, setEdit] = useState(null);
  return (
    <>
      <div className="chips"><p className="muted small">Tip: the easiest way to add a person is <b>Staff &amp; Teams → Staff directory → + Add staff</b>, which creates their staff record and login together.</p><span className="spacer" /><button className="btn" onClick={() => setCreate(true)}>+ Create login</button></div>
      <Card pad={false}>
        <DataTable csvName="users" rows={users} onRow={setEdit} initialSort={{ key: 'name' }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Login email' },
            { key: 'role', label: 'Access', render: (r) => <span className="role-chips">{rolesOf(r).map((x) => <Badge key={x} tone={x === 'admin' ? 'amber' : x === 'client' ? 'green' : 'blue'}>{ROLES[x] || x}</Badge>)}</span>, csv: (r) => roleLabel(r) },
            { key: 'link', label: 'Linked to', value: (r) => (r.staffId ? staff.find((s) => s.id === r.staffId)?.name : r.clientId ? clients.find((c) => c.id === r.clientId)?.name : '—') || '—' },
            { key: 'active', label: 'Status', render: (r) => <Badge>{r.active === false ? 'Disabled' : 'Active'}</Badge>, csv: (r) => (r.active === false ? 'Disabled' : 'Active') },
          ]} />
      </Card>
      {create && <CreateUser staff={staff} clients={clients} users={users} onClose={() => setCreate(false)} />}
      {edit && <EditUser u={edit} staff={staff} clients={clients} onClose={() => setEdit(null)} />}
    </>
  );
}

function CreateUser({ staff, clients, users, onClose }) {
  const [kind, setKind] = useState('staff');
  const { f, setF, bind } = useForm({ email: '', password: '', staffId: '', clientId: '' });
  const [roles, setRoles] = useState([]);
  const free = staff.filter((s) => !users.some((u) => u.staffId === s.id));
  const save = async () => {
    const fail = (m) => act(async () => { throw new Error(m); });
    if (!f.email || (f.password || '').length < 6) return fail('Email and a password of at least 6 characters are required');
    if (kind === 'staff' && !f.staffId) return fail('Pick the staff member');
    if (kind === 'staff' && !roles.length) return fail('Tick at least one access area');
    if (kind === 'client' && !f.clientId) return fail('Pick the client');
    const r = kind === 'client' ? ['client'] : roles;
    const name = kind === 'client' ? clients.find((c) => c.id === f.clientId)?.name : staff.find((s) => s.id === f.staffId)?.name;
    await act(() => backend().createAccount({ email: f.email, password: f.password, name: name || f.email, roles: r, role: r[0], ...(kind === 'client' ? { clientId: f.clientId } : { staffId: f.staffId }) }), 'Login created — share the email & password with them');
    onClose();
  };
  return (
    <Modal title="Create login" wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Create</button></>}>
      <div className="seg-choice"><button className={kind === 'staff' ? 'on ok' : ''} onClick={() => setKind('staff')}>Staff member</button><button className={kind === 'client' ? 'on ok' : ''} onClick={() => setKind('client')}>Client (portal)</button></div>
      <div className="form-grid">
        {kind === 'staff'
          ? <Field label="Staff member"><Select options={free.map((s) => ({ value: s.id, label: `${s.name} — ${s.department}` }))} value={f.staffId} onChange={(e) => { const st = staff.find((x) => x.id === e.target.value); setF((p) => ({ ...p, staffId: e.target.value, email: p.email || st?.email || '' })); }} /></Field>
          : <Field label="Client"><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} {...bind('clientId')} /></Field>}
        <Field label="Login email"><input type="email" {...bind('email')} /></Field>
        <Field label="Temporary password" hint="At least 6 characters"><input {...bind('password')} /></Field>
      </div>
      {kind === 'staff' && <><h4 className="section-title">Access</h4><RoleChecks value={roles} onChange={setRoles} /></>}
    </Modal>
  );
}

function EditUser({ u, staff, clients, onClose }) {
  const [roles, setRoles] = useState(rolesOf(u));
  const [name, setName] = useState(u.name || '');
  const [staffId, setStaffId] = useState(u.staffId || '');
  const self = u.id === me()?.id;
  const client = rolesOf(u).includes('client');
  const save = async (patch = {}) => {
    if (!client && !roles.length) return act(async () => { throw new Error('Tick at least one access area'); });
    const r = client ? ['client'] : roles.includes('admin') ? ['admin', ...roles.filter((x) => x !== 'admin')] : roles;
    await act(() => updateDoc('users', u.id, { name, roles: r, role: r[0], ...(client ? {} : { staffId: staffId || null }), ...patch }, u.email), 'Login updated');
    onClose();
  };
  return (
    <Modal title={u.email} wide onClose={onClose} footer={<>
      {!self && <button className="btn ghost danger" onClick={() => save({ active: !(u.active !== false) })}>{u.active === false ? 'Re-enable login' : 'Disable login'}</button>}
      <span className="spacer" />
      {!DEMO && <button className="btn ghost" onClick={() => act(() => backend().resetPassword(u.email), 'Password reset email sent')}>Send password reset</button>}
      <button className="btn" onClick={() => save()}>Save</button>
    </>}>
      <div className="form-grid">
        <Field label="Display name"><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        {client ? <Field label="Client"><input disabled value={clients.find((c) => c.id === u.clientId)?.name || ''} /></Field>
          : <Field label="Staff record"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} value={staffId} onChange={(e) => setStaffId(e.target.value)} /></Field>}
      </div>
      {!client && <><h4 className="section-title">Access</h4><RoleChecks value={roles} onChange={setRoles} lockAdmin={self} /></>}
      {self && <p className="muted small">You can't remove your own Admin access or disable yourself.</p>}
      {u.createdAt && <p className="muted small">Created {fmtDate(u.createdAt)}</p>}
    </Modal>
  );
}

function Data() {
  const [busy, setBusy] = useState(false);
  const exportAll = async () => {
    setBusy(true);
    try {
      const all = await backend().exportAll();
      downloadFile(`deecee-backup-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(all, null, 1), 'application/json');
    } finally { setBusy(false); }
  };
  return (
    <Card title="Backup">
      <p>Download a complete copy of all company records (clients, orders, invoices, AMC, stock, staff…) as a JSON file. Keep a monthly copy on your computer or Google Drive. Uploaded drawings are not included — keep the original drawing files in your drawing team's folder.</p>
      <div className="row gap">
        <button className="btn" onClick={exportAll} disabled={busy}>{busy ? 'Preparing…' : 'Download full backup'}</button>
        {DEMO && <button className="btn ghost danger" onClick={() => backend().resetDemo()}>Reset demo data</button>}
      </div>
      <p className="muted small">Every table in the app also has an “Export CSV” button for Excel.</p>
    </Card>
  );
}
