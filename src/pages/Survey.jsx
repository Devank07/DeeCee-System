// Site survey on the phone — measurements + photos, then one tap fills the quotation.
import React, { useState } from 'react';
import { Modal, Field, Select, act, Card, Badge, useCol, useForm } from '../ui';
import { updateDoc, postActivity, addDoc, me } from '../data';
import { compressImage, fmtDate, fmtDateTime, today, addDays, num } from '../utils';
import { hasAny } from '../roles';
import { teamOptions } from './shared';
import { t } from '../i18n';

const SURVEY_FIELDS = [
  ['shaftW', 'Shaft width (mm)', 'number'], ['shaftD', 'Shaft depth (mm)', 'number'], ['pit', 'Pit depth (mm)', 'number'], ['overhead', 'Overhead / headroom (mm)', 'number'],
  ['floors', 'Floors (e.g. G+3, B+G+4)', 'text'], ['stops', 'No. of stops', 'number'], ['travel', 'Travel (m)', 'number'], ['entW', 'Door opening width (mm)', 'number'],
];
const getLoc = () => new Promise((res) => { if (!navigator.geolocation) return res(null); navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), () => res(null), { timeout: 8000, maximumAge: 60000 }); });

export function SurveyForm({ initial = {}, title, onSave, onClose }) {
  const [f, setF] = useState({ shaftW: '', shaftD: '', pit: '', overhead: '', floors: '', stops: '', travel: '', entW: '', machineRoom: 'MRL — no machine room', power: 'Not yet', shaftType: 'RCC', constructionStatus: 'Shaft ready', notes: '', ...initial });
  const [photos, setPhotos] = useState(initial.photos || []);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  const addPhoto = async (e) => {
    const files = [...e.target.files].slice(0, 6 - photos.length); e.target.value = '';
    try { const out = await Promise.all(files.map((x) => compressImage(x, 900, 0.5))); setPhotos([...photos, ...out].slice(0, 6)); } catch { /* ignore */ }
  };
  const save = async () => {
    if (!f.shaftW || !f.shaftD) return act(async () => { throw new Error(t('Enter at least the shaft width and depth')); });
    setBusy(true);
    const loc = await getLoc();
    try { await act(() => onSave({ ...f, photos, by: me()?.name || '', at: Date.now(), ...(loc ? { loc } : {}) }), t('Survey saved')); onClose(); } catch { /* shown */ }
    setBusy(false);
  };
  return (
    <Modal title={title || t('Site survey')} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn" disabled={busy} onClick={save}>{busy ? '…' : t('Save survey')}</button></>}>
      <div className="form-grid">
        {SURVEY_FIELDS.map(([k, l, type]) => <Field key={k} label={t(l)}><input type={type} inputMode={type === 'number' ? 'decimal' : undefined} value={f[k]} onChange={set(k)} /></Field>)}
        <Field label={t('Machine room')}><Select options={['MRL — no machine room', 'Machine room above shaft', 'Machine room — side', 'Hydraulic — pump room']} placeholder={false} value={f.machineRoom} onChange={set('machineRoom')} /></Field>
        <Field label={t('3-phase power at site')}><Select options={['Available', 'Not yet', 'Applied']} placeholder={false} value={f.power} onChange={set('power')} /></Field>
        <Field label={t('Shaft construction')}><Select options={['RCC', 'Brick', 'Steel structure (we provide)', 'Glass / structure', 'Not built yet']} placeholder={false} value={f.shaftType} onChange={set('shaftType')} /></Field>
        <Field label={t('Status of building')}><Select options={['Shaft ready', 'Under construction', 'Only drawings', 'Existing building — new shaft']} placeholder={false} value={f.constructionStatus} onChange={set('constructionStatus')} /></Field>
        <Field label={t('Notes (beams, obstructions, access for material…)')} span={2}><textarea rows={3} value={f.notes} onChange={set('notes')} /></Field>
        <Field label={t('Photos (shaft, pit, top, entrance) — up to 6')} span={2}>
          <div className="img-pick">
            {photos.map((src, i) => <span key={i} className="thumb"><img src={src} alt="" /><button type="button" onClick={() => setPhotos(photos.filter((_, j) => j !== i))}>✕</button></span>)}
            {photos.length < 6 && <label className="thumb add">＋<span>{t('Photo')}</span><input type="file" accept="image/*" capture="environment" multiple hidden onChange={addPhoto} /></label>}
          </div>
        </Field>
      </div>
    </Modal>
  );
}

export function SurveyView({ s }) {
  const [img, setImg] = useState(null);
  if (!s) return null;
  return (
    <div className="survey-view">
      <div className="sv-grid">
        {SURVEY_FIELDS.filter(([k]) => s[k] !== '' && s[k] != null).map(([k, l]) => <div key={k}><span>{l.replace(/\s*\(.*\)/, '')}</span><b>{s[k]}{/mm/.test(l) ? ' mm' : k === 'travel' ? ' m' : ''}</b></div>)}
        <div><span>Machine room</span><b>{s.machineRoom}</b></div><div><span>3-phase power</span><b>{s.power}</b></div><div><span>Shaft</span><b>{s.shaftType}</b></div><div><span>Building</span><b>{s.constructionStatus}</b></div>
      </div>
      {s.notes && <p className="small pre">{s.notes}</p>}
      {s.photos?.length > 0 && <div className="req-imgs">{s.photos.map((src, i) => <img key={i} src={src} alt="" onClick={() => setImg(src)} />)}</div>}
      <p className="muted small">By {s.by || '—'} · {fmtDateTime(s.at)}{s.loc && <> · <a href={`https://www.google.com/maps?q=${s.loc.lat},${s.loc.lng}`} target="_blank" rel="noreferrer">📍 location</a></>}</p>
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </div>
  );
}

/* Card on the client tab */
export function SurveyCard({ p, user }) {
  const visits = useCol('visits', [['projectId', '==', p.id], ['type', '==', 'Site Survey']]);
  const [form, setForm] = useState(false);
  const [send, setSend] = useState(false);
  const fromVisits = visits.filter((v) => v.survey).map((v) => ({ ...v.survey, via: v.teamName }));
  const all = [...(p.survey ? [p.survey] : []), ...fromVisits].sort((a, b) => (b.at || 0) - (a.at || 0));
  const latest = all[0];
  const pending = visits.filter((v) => !v.survey && v.status !== 'Done');
  const sales = hasAny(user, 'sales', 'projects');
  const useInQuote = () => act(async () => {
    const s = latest; const x = { ...(p.proposal || {}) };
    ['shaftW', 'shaftD', 'pit', 'overhead', 'floors', 'stops', 'travel', 'entW'].forEach((k) => { if (s[k] !== '' && s[k] != null) x[k] = ['floors'].includes(k) ? s[k] : num(s[k]) || s[k]; });
    if (/^MRL/.test(s.machineRoom)) x.drive = 'MRL';
    await updateDoc('projects', p.id, { proposal: x, ...(s.floors ? { liftSpec: { ...(p.liftSpec || {}), stops: s.floors } } : {}) }, p.quoteNo);
  }, 'Survey sizes copied into the quotation — check and print');
  return (
    <Card title={<>Site survey {latest ? <Badge tone="green">Done {fmtDate(latest.at)}</Badge> : pending.length ? <Badge tone="amber">Team going {fmtDate(pending[0].date)}</Badge> : <Badge tone="grey">Not done</Badge>}</>}
      actions={sales && <>
        {!latest && !pending.length && <button className="btn ghost sm" onClick={() => setSend(true)}>Send team</button>}
        <button className="btn ghost sm" onClick={() => setForm(true)}>{latest ? 'New survey' : 'Fill survey'}</button>
        {latest && hasAny(user, 'sales') && <button className="btn sm" onClick={useInQuote}>Use in quotation</button>}
      </>}>
      {latest ? <SurveyView s={latest} /> : <p className="muted small">Measure the shaft at site on your phone — sizes and photos go straight into the quotation. Or send a site team to do it.</p>}
      {all.length > 1 && <p className="muted small">{all.length - 1} earlier survey(s) kept.</p>}
      {form && <SurveyForm initial={latest ? { ...latest, photos: [] } : { floors: p.proposal?.floors || '' }} onClose={() => setForm(false)} onSave={async (s) => {
        await updateDoc('projects', p.id, { survey: s }, p.code || p.quoteNo);
        await postActivity({ projectId: p.id, clientId: p.clientId, text: `Site survey done: shaft ${s.shaftW} × ${s.shaftD} mm, pit ${s.pit || '—'} mm, overhead ${s.overhead || '—'} mm.`, visibleToClient: false, kind: 'survey' });
      }} />}
      {send && <SendSurveyTeam p={p} onClose={() => setSend(false)} />}
    </Card>
  );
}

function SendSurveyTeam({ p, onClose }) {
  const teams = useCol('teams');
  const { f, bind } = useForm({ teamId: '', date: addDays(today(), 1), instructions: '' });
  const save = async () => {
    const tm = teams.find((x) => x.id === f.teamId);
    if (!tm) return act(async () => { throw new Error('Pick a team'); });
    await act(async () => {
      await addDoc('visits', { type: 'Site Survey', projectId: p.id, clientId: p.clientId, clientName: p.clientName, siteAddress: p.siteAddress, contactPhone: p.contactPhone, teamId: tm.id, teamName: tm.name, date: f.date, status: 'Scheduled', title: `Site survey – ${p.clientName}`, instructions: f.instructions }, 'Survey visit');
    }, `Survey sent to ${tm.name}`);
    onClose();
  };
  return (
    <Modal title="Send a team for site survey" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Send</button></>}>
      <div className="form-grid">
        <Field label="Team"><Select options={teamOptions(teams)} {...bind('teamId')} /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Instructions" span={2}><input {...bind('instructions')} placeholder="Measure shaft, pit, overhead; photos of entrance" /></Field>
      </div>
      <p className="muted small">The job appears on the team's phones. Their survey shows here and can be copied into the quotation.</p>
    </Modal>
  );
}
