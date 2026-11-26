// Material without stock-keeping: Installation says "site ready — send material" → Material team: Procuring → Ready → Dispatched → Delivered.
import React, { useState } from 'react';
import { Card, Badge, Modal, Field, act, useSettings, PrintDoc, Note } from '../ui';
import { addDoc, updateDoc, nextNumber, postActivity, me } from '../data';
import { fmtDate, fmtDateTime, today, addDays, num } from '../utils';
import { hasAny, isAdminU } from '../roles';
import { t } from '../i18n';

export const MATERIAL_FLOW = ['Pending', 'Requested', 'Procuring', 'Ready to dispatch', 'Dispatched', 'Delivered'];

export async function requestMaterial(p, { neededBy, note }) {
  const m = p.material || {};
  const status = ['Dispatched', 'Delivered', 'Procuring', 'Ready to dispatch'].includes(m.status) ? m.status : 'Requested';
  await updateDoc('projects', p.id, { material: { ...m, status, requested: true, requestedAt: Date.now(), requestedBy: me()?.name || '', neededBy: neededBy || '', requestNote: note || '' } }, p.code);
  await postActivity({ projectId: p.id, clientId: p.clientId, text: `Material requested for installation${neededBy ? ' — needed by ' + fmtDate(neededBy) : ''}.${note ? ' ' + note : ''}`, visibleToClient: false, teamId: p.teamId || null, kind: 'material' });
}

export async function markDelivered(p, dispatches = []) {
  await updateDoc('projects', p.id, { material: { ...(p.material || {}), status: 'Delivered', deliveredAt: Date.now(), deliveredBy: me()?.name || '' } }, p.code);
  await Promise.all(dispatches.filter((d) => d.status !== 'Delivered').map((d) => updateDoc('dispatches', d.id, { status: 'Delivered', deliveredAt: Date.now() }, d.number).catch(() => {})));
  await postActivity({ projectId: p.id, clientId: p.clientId, text: 'Material received at site.', visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
}

/* Fields shown in the site-ready form */
export function MaterialRequestFields({ value, onChange }) {
  return (
    <div className="mat-req">
      <label className="check strong"><input type="checkbox" checked={value.on} onChange={(e) => onChange({ ...value, on: e.target.checked })} /> {t('Request material dispatch now')}</label>
      {value.on && (
        <div className="form-grid">
          <Field label={t('Material needed at site by')}><input type="date" value={value.neededBy} onChange={(e) => onChange({ ...value, neededBy: e.target.value })} /></Field>
          <Field label={t('Note for material team (optional)')}><input value={value.note} onChange={(e) => onChange({ ...value, note: e.target.value })} placeholder={t('e.g. unload with crane, gate closes 6 pm')} /></Field>
        </div>
      )}
    </div>
  );
}

function RequestModal({ p, onClose }) {
  const [v, setV] = useState({ on: true, neededBy: addDays(today(), 7), note: '' });
  return (
    <Modal title={t('Request material')} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn" onClick={() => act(() => requestMaterial(p, v), 'Material requested — Material team informed').then(onClose)}>{t('Send request')}</button></>}>
      <p className="muted small">{p.clientName} · {p.siteAddress}</p>
      <div className="form-grid">
        <Field label={t('Material needed at site by')}><input type="date" value={v.neededBy} onChange={(e) => setV({ ...v, neededBy: e.target.value })} /></Field>
        <Field label={t('Note for material team (optional)')}><input value={v.note} onChange={(e) => setV({ ...v, note: e.target.value })} /></Field>
      </div>
    </Modal>
  );
}

/* Dispatch with a typed list — no stock needed */
export function SimpleDispatch({ p, onClose }) {
  const company = useSettings();
  const [f, setF] = useState({ date: today(), vehicle: '', driver: '', lines: defaultLines(p), notes: '' });
  const [print, setPrint] = useState(null);
  const gateOk = p.advance?.confirmed && p.site?.status === 'Ready';
  const items = f.lines.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => { const m = l.match(/^(.*?)(?:\s*[×x*]\s*(\d+(?:\.\d+)?))?\s*$/i); return { name: (m?.[1] || l).trim(), qty: m?.[2] ? num(m[2]) : 1 }; });
  const save = async () => {
    if (!gateOk && !isAdminU(me())) return act(async () => { throw new Error('Dispatch unlocks after the advance is received and the site is marked ready'); });
    let doc = null;
    await act(async () => {
      const number = await nextNumber('DSP');
      doc = { projectId: p.id, clientId: p.clientId, date: f.date, vehicle: f.vehicle, driver: f.driver, notes: f.notes, items, number, projectCode: p.code, clientName: p.clientName, siteAddress: p.siteAddress, status: 'Dispatched', address: p.siteAddress, phone: p.contactPhone };
      await addDoc('dispatches', doc, number);
      await updateDoc('projects', p.id, { material: { ...(p.material || {}), status: 'Dispatched', at: Date.now(), by: me()?.name || '', challan: number, dispatchedOn: f.date } }, p.code);
      await postActivity({ projectId: p.id, clientId: p.clientId, text: `Material dispatched to site (${number})${f.vehicle ? ' · Vehicle ' + f.vehicle : ''}${f.driver ? ' · ' + f.driver : ''}.${items.length ? ' ' + items.map((i) => `${i.name} × ${i.qty}`).join(', ') : ''}`, visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
    }, 'Dispatched — site team and client informed');
    setPrint(doc);
  };
  if (print) return <PrintDoc kind="Delivery Challan" doc={print} company={company} onClose={onClose} />;
  return (
    <Modal title={'Dispatch material — ' + p.clientName} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Dispatch & make challan</button></>}>
      {!gateOk && <Note tone="red">{!p.advance?.confirmed ? 'Advance not confirmed. ' : ''}{p.site?.status !== 'Ready' ? 'Site not marked ready. ' : ''}Only the Admin can dispatch now.</Note>}
      <div className="form-grid">
        <Field label="Dispatch date"><input type="date" value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
        <Field label="Vehicle no."><input value={f.vehicle} onChange={(e) => setF({ ...f, vehicle: e.target.value })} /></Field>
        <Field label="Driver / transporter & phone" span={2}><input value={f.driver} onChange={(e) => setF({ ...f, driver: e.target.value })} /></Field>
        <Field label="What is being sent (one per line, “× qty” optional)" span={2} hint="Printed on the delivery challan. Leave as is for a full lift set."><textarea rows={6} value={f.lines} onChange={(e) => setF({ ...f, lines: e.target.value })} /></Field>
        <Field label="Notes" span={2}><input value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
      </div>
      <p className="muted small">Deliver to: {p.siteAddress} · Site team: {p.teamName || 'not assigned'} · Contact: {p.contactPhone || '—'}</p>
    </Modal>
  );
}
function defaultLines(p) {
  const n = num(p.proposal?.lifts || p.lifts) || 1;
  return [`Lift machine with controller × ${n}`, `Guide rails & brackets (set) × ${n}`, `Car frame & cabin × ${n}`, `Landing doors (set) × ${n}`, `Wiring & travelling cable (set) × ${n}`, `Ropes / belts & counterweight (set) × ${n}`].join('\n');
}

/* Material card on the client tab */
export function MaterialCard({ p, user, adv, siteReady, dispatches, pos, setModal, lock }) {
  const company = useSettings();
  const [req, setReq] = useState(false);
  const [disp, setDisp] = useState(false);
  const m = p.material || {};
  const dispatched = ['Dispatched', 'Delivered'].includes(m.status);
  const stores = hasAny(user, 'stores');
  const setStatus = (status) => act(async () => {
    await updateDoc('projects', p.id, { material: { ...m, status, at: Date.now(), by: me()?.name || '' } }, p.code);
    await postActivity({ projectId: p.id, clientId: p.clientId, text: status === 'Procuring' ? 'Material is being arranged for your lift.' : status === 'Ready to dispatch' ? 'Material is packed and ready to dispatch.' : `Material: ${status}.`, visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
  }, 'Material status updated');
  return (
    <Card title={<>Material <Badge tone={m.status === 'Requested' ? 'amber' : dispatched ? 'green' : undefined}>{m.status || 'Pending'}</Badge></>} className={m.status === 'Requested' && stores ? 'attn-card' : ''}
      actions={<>
        {hasAny(user, 'projects') && !m.requested && !dispatched && <button className="btn ghost sm" onClick={() => setReq(true)}>Request material</button>}
        {stores && !dispatched && m.status !== 'Procuring' && <button className="btn ghost sm" onClick={() => setStatus('Procuring')}>Procuring</button>}
        {stores && !dispatched && m.status !== 'Ready to dispatch' && <button className="btn ghost sm" onClick={() => setStatus('Ready to dispatch')}>Ready to dispatch</button>}
        {stores && !dispatched && <button className="btn sm" disabled={!!lock(adv && siteReady, 'x')} onClick={() => (company.useStock ? setModal({ t: 'dispatch' }) : setDisp(true))}>Dispatch to site</button>}
        {m.status === 'Dispatched' && hasAny(user, 'stores', 'projects') && <button className="btn ghost sm" onClick={() => act(() => markDelivered(p, dispatches), 'Marked delivered')}>Mark delivered</button>}
      </>}>
      <ol className="mat-flow">{MATERIAL_FLOW.slice(1).map((s) => {
        const idx = MATERIAL_FLOW.indexOf(m.status || 'Pending');
        const me2 = MATERIAL_FLOW.indexOf(s);
        return <li key={s} className={me2 <= idx ? 'on' : ''}><span />{s}</li>;
      })}</ol>
      {m.requested && (
        <div className="mat-reqbox small">
          <b>Requested</b> by {m.requestedBy || 'Installation'} · {fmtDateTime(m.requestedAt)}
          {m.neededBy && <> · needed by <b className={m.neededBy < today() && !dispatched ? 'danger-text' : ''}>{fmtDate(m.neededBy)}</b></>}
          {m.requestNote && <div>{m.requestNote}</div>}
        </div>
      )}
      {!m.requested && !dispatched && <p className="muted small">The installation team requests material when the site is ready.</p>}
      {!dispatched && (!adv || !siteReady) && (
        <div className="gate small">Dispatch unlocks when: {!adv && <Badge tone="red">advance received</Badge>} {!siteReady && <Badge tone="red">site ready (Installation team)</Badge>}</div>
      )}
      {m.dispatchedOn && <p className="small">Dispatched {fmtDate(m.dispatchedOn)}{m.challan ? ' · challan ' + m.challan : ''}{m.deliveredAt ? ` · received at site ${fmtDateTime(m.deliveredAt)}${m.deliveredBy ? ' by ' + m.deliveredBy : ''}` : ''}</p>}
      {(dispatches.length + pos.length) > 0 && (
        <ul className="list">
          {pos.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">PO · {x.vendorName}</span></div><Badge>{x.status}</Badge></li>)}
          {dispatches.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">Challan · {fmtDate(x.date)}{x.vehicle ? ' · ' + x.vehicle : ''}</span><div className="muted small">{(x.items || []).map((i) => `${i.name} × ${i.qty}`).join(', ')}</div></div><span className="row gap"><Badge>{x.status}</Badge><button className="btn ghost sm" onClick={() => setModal({ t: 'challan', doc: x })}>Challan</button></span></li>)}
        </ul>
      )}
      {req && <RequestModal p={p} onClose={() => setReq(false)} />}
      {disp && <SimpleDispatch p={p} onClose={() => setDisp(false)} />}
    </Card>
  );
}
