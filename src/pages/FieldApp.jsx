import React, { useState } from 'react';
import { useCol, act, go, Badge, Empty, PhotoUploader, PhotoGrid, SignaturePad, Select, StageStepper, toast } from '../ui';
import { updateDoc, setDoc, postActivity } from '../data';
import { AMC_CHECKLIST, PROJECT_STAGES } from '../constants';
import { today, fmtDate, mapsLink, fmtDateTime } from '../utils';
import { UserBox } from '../App';
import { technicianOptions } from './shared';

export default function FieldApp({ user, params }) {
  const staff = useCol('staff');
  const [viewAs, setViewAs] = useState(user.staffId || '');
  const isTech = user.role === 'technician';
  const sid = isTech ? user.staffId : viewAs;
  const visits = useCol('visits', [['technicianId', '==', sid || '_none_']]);
  const projects = useCol('projects');
  const [tab, setTab] = useState('today');
  const jobId = params[0];
  const job = jobId && (visits.find((v) => v.id === jobId));
  const me = staff.find((s) => s.id === sid);

  if (jobId && job) return <JobScreen v={job} me={me} onBack={() => go('tech')} />;
  if (jobId && !job && params[0] !== 'site') {
    // office user opening a job assigned to someone else
    return <OfficeJobLoader id={jobId} />;
  }
  if (params[0] === 'site') {
    const p = projects.find((x) => x.id === params[1]);
    return p ? <SiteScreen p={p} onBack={() => go('tech')} /> : <div className="tech"><Empty>Loading…</Empty></div>;
  }

  const t = today();
  const todays = visits.filter((v) => v.date <= t && v.status !== 'Done').sort((a, b) => (a.date > b.date ? 1 : -1));
  const upcoming = visits.filter((v) => v.date > t && v.status !== 'Done').sort((a, b) => (a.date > b.date ? 1 : -1));
  const done = visits.filter((v) => v.status === 'Done').sort((a, b) => b.doneAt - a.doneAt).slice(0, 20);
  const sites = projects.filter((p) => p.status === 'Active' && (p.team?.technicians || []).includes(sid));
  const list = tab === 'today' ? todays : tab === 'upcoming' ? upcoming : done;

  return (
    <div className="tech">
      <header className="tech-head">
        <div>
          <div className="muted small">{new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h1>Hi {(me?.name || user.name || '').split(' ')[0]} 👋</h1>
        </div>
        {sid && <CheckIn staffId={sid} name={me?.name} />}
      </header>
      {!isTech && (
        <div className="viewas"><span className="muted small">Viewing as</span><Select options={technicianOptions(staff)} placeholder="— pick technician —" value={viewAs} onChange={(e) => setViewAs(e.target.value)} /></div>
      )}
      {!sid ? <Empty>{isTech ? 'Your login is not linked to a staff record yet. Ask the office to link it in Settings → Users.' : 'Pick a technician to see their phone view.'}</Empty> : (<>
        <div className="seg-tabs">
          <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Today <b>{todays.length}</b></button>
          <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>Upcoming <b>{upcoming.length}</b></button>
          <button className={tab === 'sites' ? 'on' : ''} onClick={() => setTab('sites')}>My sites <b>{sites.length}</b></button>
          <button className={tab === 'done' ? 'on' : ''} onClick={() => setTab('done')}>Done</button>
        </div>
        {tab === 'sites' ? (
          sites.length === 0 ? <Empty>No installation sites assigned</Empty> : sites.map((p) => (
            <button key={p.id} className="job-card" onClick={() => go('tech/site/' + p.id)}>
              <div className="job-top"><Badge tone="blue">{PROJECT_STAGES[p.stage]}</Badge><span className="muted small">{p.code}</span></div>
              <b>{p.title}</b>
              <span className="muted">{p.clientName}</span>
              <span className="muted small">📍 {p.siteAddress}</span>
            </button>
          ))
        ) : list.length === 0 ? <Empty>{tab === 'today' ? 'No jobs for today 🎉' : 'Nothing here'}</Empty> : list.map((v) => (
          <button key={v.id} className={'job-card' + (v.date < t && v.status !== 'Done' ? ' late' : '') + (v.type.startsWith('Breakdown') ? ' urgent' : v.type.startsWith('AMC') ? ' amc' : '')} onClick={() => go('tech/' + v.id)}>
            <div className="job-top"><Badge tone={v.type.startsWith('Breakdown') ? 'red' : v.type.startsWith('AMC') ? 'green' : 'blue'}>{v.type}</Badge><span className="muted small">{v.status === 'Done' ? 'Done ' + fmtDateTime(v.doneAt) : v.date < t ? 'Overdue · ' + fmtDate(v.date) : fmtDate(v.date)}</span></div>
            <b>{v.title}</b>
            <span className="muted">{v.clientName}</span>
            {v.siteAddress && <span className="muted small">📍 {v.siteAddress}</span>}
          </button>
        ))}
      </>)}
      {isTech && <div className="tech-foot"><UserBox user={user} compact /></div>}
    </div>
  );
}

function OfficeJobLoader({ id }) {
  const all = useCol('visits');
  const staff = useCol('staff');
  const v = all.find((x) => x.id === id);
  if (!v) return <div className="tech"><Empty>Loading job…</Empty></div>;
  return <JobScreen v={v} me={staff.find((s) => s.id === v.technicianId)} onBack={() => history.back()} />;
}

function CheckIn({ staffId, name }) {
  const att = useCol('attendance', [['date', '==', today()], ['staffId', '==', staffId]]);
  const a = att[0];
  const check = () => {
    const save = (coords) => act(() => setDoc('attendance', `${today()}_${staffId}`, { date: today(), staffId, staffName: name || '', status: 'P', inTime: new Date().toTimeString().slice(0, 5), via: 'Phone', ...(coords ? { lat: coords.latitude, lng: coords.longitude } : {}) }, true, 'Check-in'), 'Checked in ✓');
    if (navigator.geolocation) navigator.geolocation.getCurrentPosition((p) => save(p.coords), () => save(null), { timeout: 8000, maximumAge: 60000 });
    else save(null);
  };
  if (a?.status === 'P') return <span className="checked">✓ In at {a.inTime || '—'}</span>;
  return <button className="btn sm" onClick={check}>Check in</button>;
}

function JobScreen({ v, me, onBack }) {
  const done = v.status === 'Done';
  const [checklist, setChecklist] = useState(v.checklist || {});
  const [notes, setNotes] = useState(v.notes || '');
  const [parts, setParts] = useState(v.partsUsed || '');
  const [custName, setCustName] = useState(v.customerName || '');
  const [signing, setSigning] = useState(false);
  const [signature, setSignature] = useState(v.signature || null);
  const isAmc = v.type.startsWith('AMC');

  const saveDraft = () => act(() => updateDoc('visits', v.id, { checklist, notes, partsUsed: parts, customerName: custName, ...(v.status === 'Scheduled' ? { status: 'In Progress', startedAt: Date.now() } : {}) }, v.title), 'Saved');
  const complete = async () => {
    if (!notes.trim()) return toast('Please write what work was done', 'err');
    if (!signature && !confirm('Complete without customer signature?')) return;
    await act(async () => {
      await updateDoc('visits', v.id, { status: 'Done', doneAt: Date.now(), checklist, notes, partsUsed: parts, customerName: custName, signature }, v.title);
      if (v.complaintId) await updateDoc('complaints', v.complaintId, { status: 'Resolved', resolution: notes, resolvedAt: Date.now() });
      await postActivity({ projectId: v.projectId || null, clientId: v.clientId, text: `${v.type} completed by ${me?.name || 'technician'}: ${notes}`, visibleToClient: true, kind: 'visit' });
    }, 'Job completed ✓');
    onBack();
  };

  return (
    <div className="tech">
      <button className="back" onClick={onBack}>‹ Jobs</button>
      <div className="job-hero">
        <Badge tone={v.type.startsWith('Breakdown') ? 'red' : 'blue'}>{v.type}</Badge>
        <h1>{v.title}</h1>
        <p className="muted">{v.clientName} · {fmtDate(v.date)}</p>
        <div className="quick">
          {v.contactPhone && <a className="qbtn" href={'tel:' + v.contactPhone}>📞 Call</a>}
          {v.siteAddress && <a className="qbtn" target="_blank" rel="noreferrer" href={mapsLink(v.siteAddress)}>🧭 Navigate</a>}
        </div>
        {v.siteAddress && <p className="small">📍 {v.siteAddress}</p>}
        {v.instructions && <div className="note-box"><b>Office instructions:</b> {v.instructions}</div>}
      </div>

      {isAmc && (
        <section className="tech-sec">
          <h3>Checklist</h3>
          <ul className="tick-list">
            {AMC_CHECKLIST.map((c) => (
              <li key={c}><label><input type="checkbox" disabled={done} checked={!!checklist[c]} onChange={(e) => setChecklist({ ...checklist, [c]: e.target.checked })} /> {c}</label></li>
            ))}
          </ul>
        </section>
      )}

      <section className="tech-sec">
        <h3>Work done</h3>
        <textarea rows={4} disabled={done} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="What did you check / repair? Anything the office should know?" />
        <input disabled={done} value={parts} onChange={(e) => setParts(e.target.value)} placeholder="Parts used (e.g. door roller × 2)" />
      </section>

      <section className="tech-sec">
        <div className="row between"><h3>Photos</h3>{!done && <PhotoUploader refId={v.id} clientId={v.clientId} projectId={v.projectId || null} label="📷 Add photo" />}</div>
        <PhotoGrid refId={v.id} canDelete={!done} />
      </section>

      <section className="tech-sec">
        <h3>Customer sign-off</h3>
        <input disabled={done} value={custName} onChange={(e) => setCustName(e.target.value)} placeholder="Customer / guard name" />
        {signature && !signing ? (
          <div><img className="sig-img" src={signature} alt="Signature" />{!done && <button className="link" onClick={() => setSigning(true)}>Sign again</button>}</div>
        ) : !done && (signing ? <SignaturePad onSave={(s) => { setSignature(s); setSigning(false); }} onCancel={() => setSigning(false)} /> : <button className="btn ghost wide" onClick={() => setSigning(true)}>✍️ Take signature</button>)}
      </section>

      {!done ? (
        <div className="tech-actions">
          <button className="btn ghost" onClick={saveDraft}>Save</button>
          <button className="btn" onClick={complete}>Complete job ✓</button>
        </div>
      ) : <p className="ok-text center">✓ Completed {fmtDateTime(v.doneAt)}</p>}
    </div>
  );
}

function SiteScreen({ p, onBack }) {
  const [text, setText] = useState('');
  const post = async () => {
    if (!text.trim()) return;
    await act(() => postActivity({ projectId: p.id, clientId: p.clientId, text: text.trim(), visibleToClient: false, kind: 'site' }), 'Update sent to office');
    setText('');
  };
  return (
    <div className="tech">
      <button className="back" onClick={onBack}>‹ Back</button>
      <div className="job-hero">
        <h1>{p.title}</h1>
        <p className="muted">{p.clientName} · {p.code}</p>
        <div className="quick"><a className="qbtn" target="_blank" rel="noreferrer" href={mapsLink(p.siteAddress)}>🧭 Navigate</a></div>
      </div>
      <section className="tech-sec"><StageStepper stage={p.stage} compact /></section>
      <section className="tech-sec">
        <h3>Site update to office</h3>
        <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} placeholder="Progress today, material needed, client issues…" />
        <button className="btn wide" onClick={post}>Send update</button>
      </section>
      <section className="tech-sec">
        <div className="row between"><h3>Site photos</h3><PhotoUploader refId={p.id} clientId={p.clientId} projectId={p.id} label="📷 Add photo" /></div>
        <PhotoGrid refId={p.id} />
      </section>
    </div>
  );
}
