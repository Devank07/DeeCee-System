import { t, getLang, setLang } from '../i18n';
import React, { useState } from 'react';
import { Modal, useCol, useDoc, act, go, Badge, Empty, PhotoUploader, PhotoGrid, SignaturePad, Select, FileList, ActivityFeed, Scope, toast, Note, ProgressBar } from '../ui';
import { updateDoc, setDoc, postActivity } from '../data';
import { AMC_CHECKLIST } from '../constants';
import { today, fmtDate, mapsLink, fmtDateTime, compressImage } from '../utils';
import { InstallButton } from '../pwa';
import { UserBox } from '../App';
import { SiteForm, InstallForm } from './siteForms';
import { rolesOf } from '../roles';

export default function FieldApp({ user, params }) {
  const isTech = rolesOf(user).includes('technician');
  const meStaff = useDoc('staff', user.staffId || null);
  const teams = useCol('teams');
  const [viewTeam, setViewTeam] = useState('');
  const teamId = isTech ? meStaff?.teamId || null : viewTeam || null;
  const team = teams.find((x) => x.id === teamId);
  const [, setL] = useState(getLang());
  const toggleLang = () => { const n = getLang() === 'hi' ? 'en' : 'hi'; setLang(n); setL(n); };

  let body;
  if (isTech && meStaff === undefined) body = <Empty>{t("Loading…")}</Empty>;
  else if (isTech && !user.staffId) body = <Empty>Your login is not linked to a staff record yet. Ask the office to link it in Settings → Users.</Empty>;
  else if (isTech && !teamId) body = <Empty>You are not in a team yet. Ask the office to add you to a team in Staff & Teams.</Empty>;
  else if (params[0] === 'site' && params[1]) body = <SiteScreen id={params[1]} teamId={teamId} />;
  else if (params[0]) body = <JobScreen id={params[0]} me={meStaff} isTech={isTech} />;
  else body = <Home teamId={teamId} team={team} />;

  return (
    <Scope.Provider value={{ teamId: isTech ? teamId : null }}>
      <div className="tech">
        {!params[0] && (
          <header className="tech-head">
            <div>
              <div className="muted small">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
              <h1>Hi {((isTech ? meStaff?.name : user.name) || '').split(' ')[0]} 👋</h1>
              {team && <div className="muted small">{team.name}</div>}
            </div>
            <div className="tech-head-r">
              {isTech && user.staffId && <CheckIn staffId={user.staffId} name={meStaff?.name} />}
              <div className="row gap"><InstallButton /><button className="btn ghost sm lang-btn" onClick={toggleLang}>{getLang() === 'hi' ? 'EN' : 'हिंदी'}</button></div>
            </div>
          </header>
        )}
        {!isTech && !params[0] && (
          <div className="viewas"><span className="muted small">See the phone view of team</span><Select options={teams.map((x) => ({ value: x.id, label: x.name }))} placeholder="— pick a team —" value={viewTeam} onChange={(e) => setViewTeam(e.target.value)} /></div>
        )}
        {!isTech && !teamId && !params[0] ? <Empty>Pick a team to see what its technicians see on their phones.</Empty> : body}
        {isTech && !params[0] && <div className="tech-foot"><UserBox user={user} compact /></div>}
      </div>
    </Scope.Provider>
  );
}

function Home({ teamId }) {
  const td = today();
  const open = useCol('visits', [['teamId', '==', teamId], ['status', 'in', ['Scheduled', 'In Progress']]], !!teamId);
  const done = useCol('visits', [['teamId', '==', teamId], ['status', '==', 'Done']], !!teamId);
  const sites = useCol('projects', [['teamId', '==', teamId], ['status', '==', 'Order']], !!teamId);
  const [tab, setTab] = useState('today');
  const todays = open.filter((v) => v.date <= td).sort((a, b) => (a.date > b.date ? 1 : -1));
  const upcoming = open.filter((v) => v.date > td).sort((a, b) => (a.date > b.date ? 1 : -1));
  const doneList = [...done].sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0)).slice(0, 20);
  const list = tab === 'today' ? todays : tab === 'upcoming' ? upcoming : doneList;
  return (
    <>
      <div className="seg-tabs">
        <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>{t("Today")} <b>{todays.length}</b></button>
        <button className={tab === 'sites' ? 'on' : ''} onClick={() => setTab('sites')}>{t("Sites")} <b>{sites.length}</b></button>
        <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>{t("Upcoming")} <b>{upcoming.length}</b></button>
        <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>{t("Done")}</button>
      </div>
      {tab === 'sites' ? (
        sites.length === 0 ? <Empty>{t("No installation sites assigned to your team")}</Empty> : sites.map((p) => (
          <button key={p.id} className="job-card" onClick={() => go('tech/site/' + p.id)}>
            <div className="job-top"><Badge tone={p.site?.status === 'Ready' ? 'green' : 'amber'}>Site {p.site?.status === 'Ready' ? 'ready' : (p.site?.status || 'not checked').toLowerCase()}</Badge><span className="muted small">{p.code}</span></div>
            <b>{p.clientName}</b>
            <span className="muted">{p.title}</span>
            <span className="muted small">📍 {p.siteAddress}</span>
            {p.install?.progress > 0 && <span className="row gap"><ProgressBar value={p.install.progress} tone="green" /><span className="small">{p.install.progress}%</span></span>}
          </button>
        ))
      ) : list.length === 0 ? <Empty>{t(tab === 'today' ? 'No jobs for today 🎉' : 'Nothing here')}</Empty> : list.map((v) => (
        <button key={v.id} className={'job-card' + (v.date < td && v.status !== 'Done' ? ' late' : '') + (v.type.startsWith('Breakdown') ? ' urgent' : v.type.startsWith('AMC') ? ' amc' : '')} onClick={() => go('tech/' + v.id)}>
          <div className="job-top"><Badge tone={v.type.startsWith('Breakdown') ? 'red' : v.type.startsWith('AMC') ? 'green' : 'blue'}>{v.type}</Badge><span className="muted small">{v.status === 'Done' ? 'Done ' + fmtDateTime(v.doneAt) : v.date < td ? 'Overdue · ' + fmtDate(v.date) : fmtDate(v.date)}</span></div>
          <b>{v.title}</b>
          <span className="muted">{v.clientName}</span>
          {v.siteAddress && <span className="muted small">📍 {v.siteAddress}</span>}
        </button>
      ))}
    </>
  );
}

function CheckIn({ staffId, name }) {
  const att = useCol('attendance', [['date', '==', today()], ['staffId', '==', staffId]]);
  const a = att[0];
  const [mode, setMode] = useState(null);
  if (a?.outTime) return <span className="checked">✓ {t('In at')} {a.inTime} · {t('Out at')} {a.outTime}</span>;
  return (<>
    {a?.status === 'P' ? <span className="row gap"><span className="checked">✓ {t('In at')} {a.inTime || '—'}</span><button className="btn ghost sm" onClick={() => setMode('out')}>{t('Check out')}</button></span>
      : <button className="btn sm" onClick={() => setMode('in')}>{t('Check in')}</button>}
    {mode && <CheckInSheet mode={mode} staffId={staffId} name={name} onClose={() => setMode(null)} />}
  </>);
}

function CheckInSheet({ mode, staffId, name, onClose }) {
  const [photo, setPhoto] = useState(null);
  const [loc, setLoc] = useState(undefined); // undefined = loading, null = unavailable
  const [busy, setBusy] = useState(false);
  React.useEffect(() => {
    if (!navigator.geolocation) { setLoc(null); return; }
    navigator.geolocation.getCurrentPosition((p) => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }), () => setLoc(null), { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 });
  }, []);
  const pick = async (e) => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { setPhoto(await compressImage(f, 360, 0.5)); } catch { toast('Could not read the photo', 'err'); } };
  const save = async () => {
    if (mode === 'in' && !photo) return toast(t('Take selfie'), 'err');
    setBusy(true);
    const time = new Date().toTimeString().slice(0, 5);
    const p = mode === 'in' ? 'in' : 'out';
    const data = { date: today(), staffId, staffName: name || '', via: 'Phone', [p + 'Time']: time, ...(photo ? { [p + 'Photo']: photo } : {}), ...(loc ? { [p + 'Lat']: loc.lat, [p + 'Lng']: loc.lng, [p + 'Acc']: loc.acc } : {}), ...(mode === 'in' ? { status: 'P' } : {}) };
    try { await act(() => setDoc('attendance', `${today()}_${staffId}`, data, true, mode === 'in' ? 'Check-in' : 'Check-out'), mode === 'in' ? 'Checked in ✓' : 'Checked out ✓'); onClose(); } catch { /* shown */ }
    setBusy(false);
  };
  return (
    <Modal title={t(mode === 'in' ? 'Check in with photo' : 'Check out')} onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn" disabled={busy || loc === undefined} onClick={save}>{t(mode === 'in' ? 'Check in' : 'Check out')}</button></>}>
      <p className="muted small">{t('Take a selfie at the site and we save your location.')}</p>
      <label className="selfie-box">
        {photo ? <img src={photo} alt="" /> : <span>📷 {t('Take selfie')}</span>}
        <input type="file" accept="image/*" capture="user" hidden onChange={pick} />
      </label>
      <p className="small">{loc === undefined ? '⏳ ' + t('Getting your location…') : loc ? <>📍 {t('Location saved')} (±{loc.acc} m) · <a href={`https://www.google.com/maps?q=${loc.lat},${loc.lng}`} target="_blank" rel="noreferrer">map</a></> : '⚠︎ ' + t('Location not available — check-in will be saved without it.')}</p>
    </Modal>
  );
}

/* ---------- installation site ---------- */
function SiteScreen({ id, teamId }) {
  const p = useDoc('projects', id);
  const acts = useCol('activity', teamId ? [['projectId', '==', id], ['teamId', '==', teamId]] : [['projectId', '==', id]], !!p);
  const [modal, setModal] = useState(null);
  const [text, setText] = useState('');
  if (p === undefined) return <Empty>{t("Loading…")}</Empty>;
  if (!p) return <><button className="back" onClick={() => go('tech')}>{t("‹ Back")}</button><Empty>{t("This site is not assigned to your team.")}</Empty></>;
  const dispatched = ['Dispatched', 'Delivered'].includes(p.material?.status);
  const post = async () => {
    if (!text.trim()) return;
    await act(() => postActivity({ projectId: p.id, clientId: p.clientId, text: text.trim(), visibleToClient: false, teamId: p.teamId || teamId, kind: 'site' }), 'Update sent to office');
    setText('');
  };
  return (
    <>
      <button className="back" onClick={() => go('tech')}>{t("‹ Back")}</button>
      <div className="job-hero">
        <span className="muted small">{p.code}</span>
        <h1>{p.clientName}</h1>
        <p className="muted">{p.title}</p>
        <div className="quick">
          {p.contactPhone && <a className="qbtn" href={'tel:' + p.contactPhone}>{t("📞 Call site")}</a>}
          <a className="qbtn" target="_blank" rel="noreferrer" href={mapsLink(p.siteAddress)}>{t("🧭 Navigate")}</a>
        </div>
        <p className="small">📍 {p.siteAddress}</p>
        <p className="small muted">{p.lifts} × {p.liftSpec?.type} · {p.liftSpec?.capacity} · {p.liftSpec?.stops} · {p.liftSpec?.drive}</p>
      </div>

      <section className="tech-sec">
        <h3>{t("Drawings")}</h3>
        <FileList projectId={p.id} kind="Drawing" />
      </section>

      <section className="tech-sec">
        <div className="row between"><h3>{t("Site status")}</h3><Badge>{p.site?.status || 'Not checked'}</Badge></div>
        {p.site?.notes && <p className="small">{p.site.notes}</p>}
        <button className="btn wide" onClick={() => setModal('site')}>{p.site?.status === 'Ready' ? 'Update site status' : 'Report site status'}</button>
      </section>

      <section className="tech-sec">
        <div className="row between"><h3>{t("Installation")}</h3><span className="small">{p.install?.progress || 0}%</span></div>
        <ProgressBar value={p.install?.progress || 0} tone="green" />
        {dispatched ? <button className="btn wide" onClick={() => setModal('install')}>{t("Update installation status")}</button>
          : <p className="muted small">Starts after the material reaches site. Material: {p.material?.status || 'Pending'}.</p>}
      </section>

      <section className="tech-sec">
        <div className="row between"><h3>{t("Site photos")}</h3><PhotoUploader refId={p.id} clientId={p.clientId} projectId={p.id} teamId={p.teamId || teamId} label="📷 Add photo" /></div>
        <p className="muted small">{t("Photos are shared with the office and the client.")}</p>
        <PhotoGrid refId={p.id} />
      </section>

      <section className="tech-sec">
        <h3>{t("Message to office")}</h3>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Material short, client issue, help needed…" />
        <button className="btn ghost wide" onClick={post}>{t("Send to office")}</button>
        <ActivityFeed items={acts} showFlags={false} limit={15} />
      </section>
      {modal === 'site' && <SiteForm p={p} onClose={() => setModal(null)} />}
      {modal === 'install' && <InstallForm p={p} onClose={() => setModal(null)} />}
    </>
  );
}

/* ---------- field job (service visit / breakdown / installation work) ---------- */
function JobScreen({ id, me, isTech }) {
  const v = useDoc('visits', id);
  const [checklist, setChecklist] = useState(null);
  const [notes, setNotes] = useState(null);
  const [parts, setParts] = useState(null);
  const [custName, setCustName] = useState(null);
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState(undefined);
  const back = () => (isTech ? go('tech') : history.back());
  if (v === undefined) return <Empty>{t("Loading…")}</Empty>;
  if (!v) return <><button className="back" onClick={back}>{t("‹ Jobs")}</button><Empty>{t("This job is not assigned to your team.")}</Empty></>;
  const cl = checklist ?? v.checklist ?? {};
  const nt = notes ?? v.notes ?? '';
  const pt = parts ?? v.partsUsed ?? '';
  const cn = custName ?? v.customerName ?? '';
  const sig = signature === undefined ? v.signature || null : signature;
  const done = v.status === 'Done';
  const isAmc = v.type.startsWith('AMC');

  const saveDraft = async () => { const loc = v.status === 'Scheduled' ? await here() : null; return act(() => updateDoc('visits', v.id, { checklist: cl, notes: nt, partsUsed: pt, customerName: cn, ...(v.status === 'Scheduled' ? { status: 'In Progress', startedAt: Date.now(), ...(loc ? { startLoc: loc } : {}) } : {}) }, v.title), 'Saved'); };
  const complete = async () => {
    if (!nt.trim()) return toast('Please write what work was done', 'err');
    await act(async () => {
      const loc = await here();
      await updateDoc('visits', v.id, { status: 'Done', doneAt: Date.now(), doneBy: me?.name || '', checklist: cl, notes: nt, partsUsed: pt, customerName: cn, signature: sig, ...(loc ? { doneLoc: loc } : {}) }, v.title);
      if (v.complaintId) await updateDoc('complaints', v.complaintId, { status: 'Resolved', resolution: nt, resolvedAt: Date.now() });
      await postActivity({ projectId: v.projectId || null, clientId: v.clientId, text: `${v.type} completed by ${me?.name || v.teamName || 'our team'}: ${nt}`, visibleToClient: true, teamId: v.projectId ? v.teamId : null, kind: 'visit' });
    }, 'Job completed ✓');
    back();
  };

  return (
    <>
      <button className="back" onClick={back}>{t("‹ Jobs")}</button>
      <div className="job-hero">
        <Badge tone={v.type.startsWith('Breakdown') ? 'red' : 'blue'}>{v.type}</Badge>
        <h1>{v.title}</h1>
        <p className="muted">{v.clientName} · {fmtDate(v.date)} · {v.teamName}</p>
        <div className="quick">
          {v.contactPhone && <a className="qbtn" href={'tel:' + v.contactPhone}>{t("📞 Call")}</a>}
          {v.siteAddress && <a className="qbtn" target="_blank" rel="noreferrer" href={mapsLink(v.siteAddress)}>{t("🧭 Navigate")}</a>}
        </div>
        {v.siteAddress && <p className="small">📍 {v.siteAddress}</p>}
        {v.instructions && <div className="note-box"><b>{t("Office instructions:")}</b> {v.instructions}</div>}
        {v.projectId && <button className="link" onClick={() => go('tech/site/' + v.projectId)}>{t("Open site — drawings & status ›")}</button>}
      </div>

      {isAmc && (
        <section className="tech-sec">
          <h3>{t("Checklist")}</h3>
          <ul className="tick-list">
            {AMC_CHECKLIST.map((c) => (
              <li key={c}><label><input type="checkbox" disabled={done} checked={!!cl[c]} onChange={(e) => setChecklist({ ...cl, [c]: e.target.checked })} /> {t(c)}</label></li>
            ))}
          </ul>
        </section>
      )}

      <section className="tech-sec">
        <h3>{t("Work done")}</h3>
        <textarea rows={4} disabled={done} value={nt} onChange={(e) => setNotes(e.target.value)} placeholder="What did you check / repair? Anything the office should know?" />
        <input disabled={done} value={pt} onChange={(e) => setParts(e.target.value)} placeholder="Parts used (e.g. door roller × 2)" />
      </section>

      <section className="tech-sec">
        <div className="row between"><h3>{t("Photos")}</h3>{!done && <PhotoUploader refId={v.id} clientId={v.clientId} projectId={v.projectId || null} teamId={v.teamId} label="📷 Add photo" />}</div>
        <PhotoGrid refId={v.id} />
      </section>

      <section className="tech-sec">
        <h3>{t("Customer sign-off")}</h3>
        <input disabled={done} value={cn} onChange={(e) => setCustName(e.target.value)} placeholder="Customer / guard name" />
        {sig && !signing ? (
          <div><img className="sig-img" src={sig} alt="Signature" />{!done && <button className="link" onClick={() => setSigning(true)}>{t("Sign again")}</button>}</div>
        ) : !done && (signing ? <SignaturePad onSave={(s) => { setSignature(s); setSigning(false); }} onCancel={() => setSigning(false)} /> : <button className="btn ghost wide" onClick={() => setSigning(true)}>{t("✍️ Take signature")}</button>)}
        {!done && !sig && <Note>{t("Take the customer's signature before completing the job.")}</Note>}
      </section>

      {!done ? (
        <div className="tech-actions">
          <button className="btn ghost" onClick={saveDraft}>{t("Save")}</button>
          <button className="btn" onClick={complete}>{t("Complete job ✓")}</button>
        </div>
      ) : <p className="ok-text center">✓ Completed {fmtDateTime(v.doneAt)}{v.doneBy ? ' by ' + v.doneBy : ''}</p>}
    </>
  );
}

// Current GPS position (or null) — never blocks more than ~8 seconds
function here() {
  return new Promise((resolve) => {
    if (!navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition((p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }), () => resolve(null), { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 });
  });
}
