// One-tap client portal invite: creates the client's login (mobile number + password) and sends it on WhatsApp.
import React, { useState } from 'react';
import { Modal, Field, act, useDoc, useSettings, WaIcon, toast } from '../ui';
import { backend, updateDoc, postActivity, me } from '../data';
import { phoneLoginEmail, makePassword, waLink, fmtDate } from '../utils';

export const portalUrlOf = (company) => (company.portalUrl || (typeof location !== 'undefined' ? location.origin : '')).replace(/\/+$/, '');

export function inviteText({ name, url, loginId, password, company, clientNo }) {
  return `Namaste ${name || ''},${clientNo ? `\nYour client no.: ${clientNo}` : ''}\n\nYou can now track your lift project with ${company.name || 'Dee Cee Elevators'} online — progress, drawings, photos, quotations, invoices and payments, and report any problem.\n\nOpen: ${url}\nLogin: ${loginId}\nPassword: ${password}\n\nTip: open the link on your phone and choose “Add to Home Screen”.\n— ${company.name || 'Dee Cee Elevators'}${company.phone ? ', ' + company.phone : ''}`;
}

export default function PortalInvite({ clientId, project, onClose }) {
  const client = useDoc('clients', clientId);
  const company = useSettings();
  const [phone, setPhone] = useState(null);
  const [password, setPassword] = useState(makePassword());
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(null); // { text, phone }
  if (client === undefined) return null;
  if (!client) return <Modal title="Client portal" onClose={onClose}><p>This client record could not be found.</p></Modal>;
  const portal = client.portal || null;
  const ph = phone ?? (client.phone || project?.contactPhone || '');
  const url = portalUrlOf(company);
  const name = project?.contactPerson || client.contactPerson || client.name;

  const create = async () => {
    const loginEmail = phoneLoginEmail(ph);
    if (!loginEmail) return act(async () => { throw new Error('Enter the client\'s 10-digit mobile number'); });
    if (password.length < 6) return act(async () => { throw new Error('Password must be at least 6 characters'); });
    setBusy(true);
    try {
      await act(async () => {
        let uid;
        try {
          uid = await backend().createAccount({ email: loginEmail, password, name: client.name, role: 'client', roles: ['client'], clientId: client.id, phone: ph });
        } catch (e) {
          if (/already|in-use|in use/i.test(e.code || e.message || '')) throw new Error('A portal login already exists for this mobile number. If it belongs to this client, use “Send again”. Otherwise use a different number.');
          throw e;
        }
        const loginId = loginEmail.split('@')[0];
        await updateDoc('clients', client.id, { portal: { uid, loginId, loginEmail, password, createdAt: Date.now(), createdBy: me()?.name || '', invitedAt: Date.now() } }, client.name);
        await postActivity({ projectId: project?.id || null, clientId: client.id, text: 'Client portal login created and sent to the client.', visibleToClient: false, kind: 'portal' });
        setReady({ phone: ph, text: inviteText({ name, url, loginId, password, company, clientNo: client.clientNo }) });
      }, 'Portal login created');
    } catch { /* toast shown */ }
    setBusy(false);
  };
  const resend = async () => {
    const text = inviteText({ name, url, loginId: portal.loginId || portal.loginEmail, password: portal.password || '(the password sent earlier)', company, clientNo: client.clientNo });
    await updateDoc('clients', client.id, { portal: { ...portal, invitedAt: Date.now() } }, client.name).catch(() => {});
    setReady({ phone: ph, text });
  };
  const copy = (t) => { try { navigator.clipboard.writeText(t); toast('Message copied'); } catch { /* ignore */ } };

  if (ready) {
    return (
      <Modal title="Send portal invite" onClose={onClose} footer={<><button className="btn ghost" onClick={() => copy(ready.text)}>Copy message</button><span className="spacer" /><a className="btn wa-btn" href={waLink(ready.phone, ready.text)} target="_blank" rel="noreferrer" onClick={() => setTimeout(onClose, 400)}><WaIcon /> Send on WhatsApp to {ready.phone}</a></>}>
        <p className="muted small">This message will open in WhatsApp — just press send.</p>
        <pre className="invite-preview">{ready.text}</pre>
      </Modal>
    );
  }
  return (
    <Modal title="Client portal" onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><span className="spacer" />
        {portal ? <button className="btn wa-btn" onClick={resend}><WaIcon /> Send login again on WhatsApp</button>
          : <button className="btn wa-btn" disabled={busy} onClick={create}><WaIcon /> {busy ? 'Creating…' : 'Create login & send on WhatsApp'}</button>}
      </>}>
      {portal ? (<>
        <p><b>{client.name}</b> already has a portal login.</p>
        <dl className="dl">
          <dt>Login</dt><dd>{portal.loginId || portal.loginEmail}</dd>
          <dt>Password</dt><dd>{portal.password || <span className="muted">not stored</span>}</dd>
          <dt>Created</dt><dd>{fmtDate(portal.createdAt)}{portal.createdBy ? ' by ' + portal.createdBy : ''}</dd>
          {portal.invitedAt && <><dt>Last sent</dt><dd>{fmtDate(portal.invitedAt)}</dd></>}
        </dl>
        <Field label="Send to WhatsApp number"><input value={ph} onChange={(e) => setPhone(e.target.value)} inputMode="tel" /></Field>
      </>) : (<>
        <p className="muted">The client logs in with their <b>mobile number</b> and this password, and sees their lift's progress, drawings, photos, quotations, invoices and payments.</p>
        <div className="form-grid">
          <Field label="Client's mobile number (becomes the login)"><input value={ph} onChange={(e) => setPhone(e.target.value)} inputMode="tel" autoFocus /></Field>
          <Field label="Password" hint="Made for you — you can change it"><div className="row gap"><input value={password} onChange={(e) => setPassword(e.target.value.trim())} /><button type="button" className="btn ghost sm" onClick={() => setPassword(makePassword())}>New</button></div></Field>
        </div>
        <p className="muted small">Portal address: {url}</p>
      </>)}
    </Modal>
  );
}
