import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, Badge, Tabs, useSettings } from '../ui';
import { setDoc, updateDoc, backend, DEMO, me } from '../data';
import { ROLES, STATE_NAMES } from '../constants';
import { downloadFile, fmtDate } from '../utils';

export default function Settings({ params }) {
  const tab = ['users', 'data'].includes(params[0]) ? params[0] : 'company';
  return (
    <div className="page">
      <PageHeader title="Settings" sub="Company details, user logins and data backup" />
      <Tabs value={tab} onChange={(k) => (location.hash = '#/settings/' + k)} tabs={[{ key: 'company', label: 'Company' }, { key: 'users', label: 'Users & roles' }, { key: 'data', label: 'Backup' }]} />
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
  const { f, bind } = useForm({ name: '', tagline: '', address: '', state: '', phone: '', email: '', website: '', gstin: '', pan: '', bank: '', defaultGst: 18, hsnSupply: '', sacService: '', quoteTerms: '', ...s });
  const save = () => { const { id, ...data } = f; return act(() => setDoc('settings', 'company', data, true, 'Company details'), 'Saved'); };
  return (
    <Card title="Company details (printed on quotations, invoices, POs & challans)" actions={<button className="btn" onClick={save}>Save</button>}>
      <div className="form-grid">
        <Field label="Company name"><input {...bind('name')} /></Field>
        <Field label="Tagline"><input {...bind('tagline')} /></Field>
        <Field label="Address" span={2}><textarea rows={2} {...bind('address')} /></Field>
        <Field label="State (for GST)" hint="Decides CGST+SGST (same state) or IGST (other state)"><Select options={STATE_NAMES} {...bind('state')} /></Field>
        <Field label="Phone"><input {...bind('phone')} /></Field>
        <Field label="Email"><input {...bind('email')} /></Field>
        <Field label="Website"><input {...bind('website')} /></Field>
        <Field label="GSTIN"><input {...bind('gstin')} /></Field>
        <Field label="PAN"><input {...bind('pan')} /></Field>
        <Field label="Default GST %"><input type="number" {...bind('defaultGst', 'number')} /></Field>
        <Field label="Default HSN for lift supply" hint="Filled into new quotation & invoice lines. Confirm codes with your CA."><input {...bind('hsnSupply')} placeholder="e.g. 8428" /></Field>
        <Field label="Default SAC for installation / AMC services"><input {...bind('sacService')} placeholder="SAC code" /></Field>
        <Field label="Bank details (printed on invoices)" span={2}><textarea rows={3} {...bind('bank')} /></Field>
        <Field label="Default quotation terms" span={2}><textarea rows={5} {...bind('quoteTerms')} /></Field>
      </div>
    </Card>
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
      <div className="chips"><span className="spacer" /><button className="btn" onClick={() => setCreate(true)}>+ Create login</button></div>
      <Card pad={false}>
        <DataTable csvName="users" rows={users} onRow={setEdit} initialSort={{ key: 'role' }}
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'email', label: 'Login email' },
            { key: 'role', label: 'Role', value: (r) => ROLES[r.role] },
            { key: 'link', label: 'Linked to', value: (r) => (r.staffId ? staff.find((s) => s.id === r.staffId)?.name : r.clientId ? clients.find((c) => c.id === r.clientId)?.name : '—') || '—' },
            { key: 'active', label: 'Status', render: (r) => <Badge>{r.active === false ? 'Disabled' : 'Active'}</Badge>, csv: (r) => (r.active === false ? 'Disabled' : 'Active') },
          ]} />
      </Card>
      <p className="muted small">Each person gets their own login and their role decides what they see. Technicians must be linked to their staff record — they then see only their team's sites and jobs (set teams in Staff & Teams). Client logins see only their own lifts.</p>
      {create && <CreateUser staff={staff} clients={clients} onClose={() => setCreate(false)} />}
      {edit && <EditUser u={edit} staff={staff} clients={clients} onClose={() => setEdit(null)} />}
    </>
  );
}

function RoleFields({ f, bind, staff, clients }) {
  return (<>
    <Field label="Role"><Select options={Object.entries(ROLES).map(([value, label]) => ({ value, label }))} placeholder={false} {...bind('role')} /></Field>
    {f.role === 'client'
      ? <Field label="Client"><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} {...bind('clientId')} /></Field>
      : <Field label="Staff record"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} {...bind('staffId')} /></Field>}
  </>);
}

function CreateUser({ staff, clients, onClose }) {
  const { f, setF, bind } = useForm({ email: '', password: '', name: '', role: 'technician', staffId: '', clientId: '' });
  const save = async () => {
    const fail = (m) => act(async () => { throw new Error(m); });
    if (!f.email || (f.password || '').length < 6) return fail('Email and a password of at least 6 characters are required');
    if (f.role === 'technician' && !f.staffId) return fail('Link the technician to their staff record');
    if (f.role === 'client' && !f.clientId) return fail('Pick the client');
    const name = f.name || (f.role === 'client' ? clients.find((c) => c.id === f.clientId)?.name : staff.find((s) => s.id === f.staffId)?.name) || f.email;
    await act(() => backend().createAccount({ email: f.email, password: f.password, name, role: f.role, ...(f.role === 'client' ? { clientId: f.clientId } : { staffId: f.staffId || null }) }), 'Login created — share the email & password with them');
    onClose();
  };
  return (
    <Modal title="Create login" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Create</button></>}>
      <div className="form-grid">
        <RoleFields f={f} bind={bind} staff={staff} clients={clients} />
        <Field label="Display name (optional)"><input {...bind('name')} /></Field>
        <Field label="Login email"><input type="email" {...bind('email')} onFocus={() => { if (!f.email) { const s = staff.find((x) => x.id === f.staffId); if (s?.email) setF((p) => ({ ...p, email: s.email })); } }} /></Field>
        <Field label="Temporary password" hint="At least 6 characters. They can reset it from the login screen."><input {...bind('password')} /></Field>
      </div>
    </Modal>
  );
}

function EditUser({ u, staff, clients, onClose }) {
  const { f, bind } = useForm({ role: u.role, staffId: u.staffId || '', clientId: u.clientId || '', name: u.name || '', active: u.active !== false });
  const self = u.id === me()?.id;
  const save = async (patch = {}) => {
    await act(() => updateDoc('users', u.id, { name: f.name, role: f.role, staffId: f.role === 'client' ? null : f.staffId || null, clientId: f.role === 'client' ? f.clientId : null, ...patch }, u.email), 'User updated');
    onClose();
  };
  return (
    <Modal title={u.email} onClose={onClose} footer={<>
      {!self && <button className="btn ghost danger" onClick={() => save({ active: !(u.active !== false) })}>{u.active === false ? 'Re-enable login' : 'Disable login'}</button>}
      <span className="spacer" />
      {!DEMO && <button className="btn ghost" onClick={() => act(() => backend().resetPassword(u.email), 'Password reset email sent')}>Send password reset</button>}
      <button className="btn" onClick={() => save()} disabled={self && f.role !== 'admin'}>Save</button>
    </>}>
      <div className="form-grid">
        <Field label="Display name"><input {...bind('name')} /></Field>
        <RoleFields f={f} bind={bind} staff={staff} clients={clients} />
      </div>
      {self && <p className="muted small">You can't remove your own Admin role or disable yourself.</p>}
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
