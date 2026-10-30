import React, { useState } from 'react';
import { Modal, Field, act, Note } from '../ui';
import { updateDoc, postActivity, me } from '../data';
import { SITE_CHECKLIST, INSTALL_STEPS } from '../constants';
import { installProgress } from '../workflow';

/* Site readiness report — installation manager or the site team's technicians */
export function SiteForm({ p, onClose }) {
  const [checks, setChecks] = useState(p.site?.checks || {});
  const missing = SITE_CHECKLIST.filter((c) => !checks[c]);
  const [ready, setReady] = useState(p.site?.status === 'Ready' || missing.length === 0);
  const [notes, setNotes] = useState('');
  const save = async () => {
    const status = ready ? 'Ready' : 'Not ready';
    await act(async () => {
      await updateDoc('projects', p.id, { site: { status, checks, notes: notes || p.site?.notes || '', at: Date.now(), by: me()?.name || '' } }, p.code);
      const text = ready
        ? `Site checked: ready for installation.${notes ? ' ' + notes : ''}`
        : `Site not ready yet — pending: ${missing.join(', ') || 'see notes'}.${notes ? ' ' + notes : ''}`;
      await postActivity({ projectId: p.id, clientId: p.clientId, text, visibleToClient: true, teamId: p.teamId || null, kind: 'site' });
    }, ready ? 'Site marked ready — Material team can dispatch' : 'Site status sent');
    onClose();
  };
  return (
    <Modal title="Site readiness" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Send site status</button></>}>
      <p className="muted small">{p.clientName} · {p.siteAddress}</p>
      <ul className="tick-list">
        {SITE_CHECKLIST.map((c) => (
          <li key={c}><label><input type="checkbox" checked={!!checks[c]} onChange={(e) => { const n = { ...checks, [c]: e.target.checked }; setChecks(n); setReady(SITE_CHECKLIST.every((x) => n[x])); }} /> {c}</label></li>
        ))}
      </ul>
      <div className="seg-choice">
        <button className={ready ? 'on ok' : ''} onClick={() => setReady(true)}>✓ Site is ready</button>
        <button className={!ready ? 'on bad' : ''} onClick={() => setReady(false)}>✕ Not ready</button>
      </div>
      {ready && missing.length > 0 && <Note>Some checks are not ticked. Make sure the site really is ready before the material is sent.</Note>}
      <Field label="Notes for office & client"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={ready ? 'Anything to note' : 'What is pending at site and who needs to do it'} /></Field>
      <p className="muted small">The client sees this update on their portal. Add photos from the Site photos section.</p>
    </Modal>
  );
}

/* Installation progress — installation manager or the site team */
export function InstallForm({ p, onClose }) {
  const [stepsDone, setSteps] = useState(p.install?.steps || {});
  const [notes, setNotes] = useState('');
  const progress = installProgress(stepsDone);
  const save = async () => {
    const before = p.install?.steps || {};
    const newly = INSTALL_STEPS.filter((s) => stepsDone[s] && !before[s]);
    const status = progress >= 100 ? 'Completed' : progress > 0 ? 'In progress' : 'Not started';
    await act(async () => {
      await updateDoc('projects', p.id, { install: { status, steps: stepsDone, progress, notes, at: Date.now(), by: me()?.name || '' } }, p.code);
      const text = status === 'Completed'
        ? 'Installation complete — testing & commissioning done. Ready for handover.'
        : `Installation progress ${progress}%${newly.length ? ' — ' + newly.join(', ') + ' done' : ''}.${notes ? ' ' + notes : ''}`;
      await postActivity({ projectId: p.id, clientId: p.clientId, text, visibleToClient: true, teamId: p.teamId || null, kind: 'install' });
    }, 'Installation status sent');
    onClose();
  };
  return (
    <Modal title="Installation status" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Send status ({progress}%)</button></>}>
      <p className="muted small">{p.clientName} · {p.title}</p>
      <ul className="tick-list">
        {INSTALL_STEPS.map((c) => (
          <li key={c}><label><input type="checkbox" checked={!!stepsDone[c]} onChange={(e) => setSteps({ ...stepsDone, [c]: e.target.checked })} /> {c}</label></li>
        ))}
      </ul>
      <div className="progress big"><div style={{ width: progress + '%' }} /></div>
      <Field label="Notes (shared with office & client)"><textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Work done today, problems, material short…" /></Field>
    </Modal>
  );
}
