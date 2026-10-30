import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { subscribe, subscribeDoc, addDoc, deleteDoc, updateDoc, me, uploadFile, fetchFileBlob, deleteFile, MAX_FILE_MB } from './data';
import { calcTotals, compressImage, downloadFile, toCSV, inr, fmtDate, amountInWords, num, fmtDateTime } from './utils';
import { stateCode } from './constants';
import { COMPANY_DEFAULTS } from './proposal';
import logoUrl from './assets/logo.png';
import { createPortal } from 'react-dom';
export { logoUrl };
import { steps as pipelineSteps } from './workflow';

/* ---------- routing (hash based) ---------- */
export function useRoute() {
  const parse = () => (location.hash.replace(/^#\/?/, '') || '').split('/');
  const [r, setR] = useState(parse);
  useEffect(() => { const f = () => setR(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path) => { location.hash = '#/' + path; };

/* ---------- scope: technicians only see their own team's records ---------- */
export const Scope = createContext({ teamId: null });
export const useScope = () => useContext(Scope);
const scoped = (filters, teamId) => (teamId ? [...filters, ['teamId', '==', teamId]] : filters);

/* ---------- data hooks ---------- */
export function useCol(col, filters = [], enabled = true, opts) {
  const key = JSON.stringify([filters, opts || null]);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!enabled) { setRows([]); return; }
    const [f, o] = JSON.parse(key);
    return subscribe(col, f, setRows, o || undefined);
  }, [col, key, enabled]);
  return rows || [];
}
export function useDoc(col, id) {
  const [doc, setDoc] = useState(undefined);
  useEffect(() => { if (!id) { setDoc(null); return; } return subscribeDoc(col, id, setDoc); }, [col, id]);
  return doc;
}
export function useSettings() {
  const d = useDoc('settings', 'company');
  const out = { ...COMPANY_DEFAULTS };
  Object.entries(d || {}).forEach(([k, v]) => { if (v !== '' && v != null) out[k] = v; });
  return out;
}

/* ---------- toast ---------- */
let toastFn = () => {};
export const toast = (msg, tone = 'ok') => toastFn(msg, tone);
export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { toastFn = (msg, tone) => { setT({ msg, tone, k: Date.now() }); }; }, []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 3400); return () => clearTimeout(h); }, [t]);
  return t ? <div className={'toast ' + t.tone} key={t.k}>{t.msg}</div> : null;
}
export async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast(friendlyError(e), 'err'); throw e; }
}
function friendlyError(e) {
  const c = e?.code || '';
  if (c.includes('permission-denied')) return 'You don\'t have permission to do this. Ask the Admin if you need access.';
  if (c.includes('unavailable')) return 'No internet connection — the change will sync when you are back online.';
  return e?.message || 'Something went wrong';
}

/* ---------- forms ---------- */
export function useForm(initial) {
  const [f, setF] = useState(initial);
  const bind = (k, type) => ({
    value: f[k] ?? '',
    onChange: (e) => setF((p) => ({ ...p, [k]: type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value })),
  });
  const set = (k, v) => setF((p) => ({ ...p, [k]: v }));
  return { f, setF, bind, set };
}
export const Field = ({ label, children, hint, span }) => (
  <label className={'field' + (span ? ' span' + span : '')}>
    <span className="field-label">{label}</span>
    {children}
    {hint && <span className="hint">{hint}</span>}
  </label>
);
export const Select = ({ options, placeholder, ...p }) => (
  <select {...p}>
    {placeholder !== false && <option value="">{placeholder || '— Select —'}</option>}
    {options.map((o) => (typeof o === 'string' ? <option key={o} value={o}>{o}</option> : <option key={o.value} value={o.value}>{o.label}</option>))}
  </select>
);

/* ---------- layout bits ---------- */
export const PageHeader = ({ title, sub, actions }) => (
  <div className="page-head">
    <div><h1>{title}</h1>{sub && <div className="muted sub">{sub}</div>}</div>
    {actions && <div className="row gap wrap">{actions}</div>}
  </div>
);
export const Card = ({ title, actions, children, className = '', pad = true, id }) => (
  <section className={'card ' + className} id={id}>
    {(title || actions) && <div className="card-head"><h3>{title}</h3><div className="row gap wrap">{actions}</div></div>}
    <div className={pad ? 'card-body' : ''}>{children}</div>
  </section>
);
export const Stat = ({ label, value, sub, tone = '', onClick }) => (
  <button className={'stat ' + tone} onClick={onClick} disabled={!onClick}>
    <span className="stat-label">{label}</span>
    <span className="stat-value">{value}</span>
    {sub && <span className="stat-sub">{sub}</span>}
  </button>
);
export const Empty = ({ children = 'Nothing here yet' }) => <div className="empty">{children}</div>;
export const Note = ({ tone = 'amber', children }) => <div className={'note ' + tone}>{children}</div>;

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs">
      {tabs.map((t) => {
        const k = typeof t === 'string' ? t : t.key;
        const l = typeof t === 'string' ? t : t.label;
        return <button key={k} className={value === k ? 'on' : ''} onClick={() => onChange(k)}>{l}</button>;
      })}
    </div>
  );
}

const TONES = {
  green: ['Paid', 'Won', 'Accepted', 'Active', 'Done', 'Resolved', 'Closed', 'Received', 'Delivered', 'Completed', 'P', 'Present', 'Ready', 'Approved', 'Issued', 'Dispatched', 'Order'],
  amber: ['Part paid', 'Partly Paid', 'Invoiced', 'Sent', 'Quoted', 'Negotiation', 'Site Visit', 'Assigned', 'In Progress', 'In progress', 'Ordered', 'Scheduled', 'On Hold', 'High', 'Expiring', 'L', 'Leave', 'H', 'Procuring', 'Ready to dispatch', 'Not ready', 'Enquiry'],
  red: ['Overdue', 'Lost', 'Rejected', 'Open', 'Expired', 'Critical (Trapped / Stuck)', 'Cancelled', 'Unpaid', 'A', 'Absent', 'Low stock', 'Disabled'],
  blue: ['New', 'Draft', 'Contacted', 'Pending', 'Normal', 'Due later', 'Not checked', 'Not started'],
};
export function Badge({ children, tone }) {
  const t = tone || Object.keys(TONES).find((k) => TONES[k].includes(children)) || 'grey';
  return <span className={'badge ' + t}>{children}</span>;
}

/* ---------- modal ---------- */
export function Modal({ title, onClose, children, footer, wide }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    document.body.classList.add('noscroll');
    return () => { removeEventListener('keydown', k); document.body.classList.remove('noscroll'); };
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-label={title}>
        <div className="modal-head"><h2>{title}</h2><button className="icon-btn" onClick={onClose} aria-label="Close">✕</button></div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  );
}

/* ---------- data table with search + CSV ---------- */
export function DataTable({ columns, rows, onRow, csvName, searchable = true, empty, toolbar, initialSort }) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort || null);
  const filtered = useMemo(() => {
    let r = rows;
    if (q) {
      const s = q.toLowerCase();
      r = r.filter((row) => columns.some((c) => String(c.csv ? c.csv(row) : c.value ? c.value(row) : row[c.key] ?? '').toLowerCase().includes(s)));
    }
    if (sort) {
      const c = columns.find((x) => x.key === sort.key);
      const get = (row) => (c?.sortValue ? c.sortValue(row) : c?.csv ? c.csv(row) : row[sort.key]);
      r = [...r].sort((a, b) => { const x = get(a) ?? '', y = get(b) ?? ''; return (x > y ? 1 : x < y ? -1 : 0) * (sort.desc ? -1 : 1); });
    }
    return r;
  }, [rows, q, sort, columns]);
  return (
    <div className="table-wrap">
      {(searchable || csvName || toolbar) && (
        <div className="table-tools">
          {searchable && <input className="search" placeholder="Search…" value={q} onChange={(e) => setQ(e.target.value)} />}
          <div className="row gap">{toolbar}{csvName && <button className="btn ghost sm" onClick={() => downloadFile(csvName + '.csv', toCSV(filtered, columns.filter((c) => !c.noExport)), 'text/csv')}>Export CSV</button>}</div>
        </div>
      )}
      {filtered.length === 0 ? <Empty>{empty || (q ? 'No matches' : 'Nothing here yet')}</Empty> : (
        <div className="table-scroll">
          <table>
            <thead><tr>{columns.map((c) => (
              <th key={c.key || c.label} className={c.align || ''} onClick={() => c.key && setSort((s) => ({ key: c.key, desc: s?.key === c.key ? !s.desc : false }))}>
                {c.label}{sort?.key === c.key ? (sort.desc ? ' ↓' : ' ↑') : ''}
              </th>))}</tr></thead>
            <tbody>
              {filtered.map((row) => (
                <tr key={row.id} onClick={onRow ? () => onRow(row) : undefined} className={onRow ? 'clickable' : ''}>
                  {columns.map((c) => <td key={c.key || c.label} className={c.align || ''} data-label={c.label}>{c.render ? c.render(row) : c.value ? c.value(row) : row[c.key] ?? '—'}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ---------- order pipeline ---------- */
export function Pipeline({ p, compact }) {
  const list = pipelineSteps(p);
  const ref = useRef(null);
  const cur = list.findIndex((s) => !s.done);
  useEffect(() => {
    const ol = ref.current;
    const li = ol?.children[cur];
    if (ol && li && !compact) ol.scrollLeft = Math.max(0, li.offsetLeft - ol.clientWidth / 2 + li.clientWidth / 2);
  }, [cur, compact]);
  return (
    <ol ref={ref} className={'pipeline' + (compact ? ' compact' : '')}>
      {list.map((s, i) => (
        <li key={s.key} className={s.done ? 'done' : s.open ? 'open' : 'wait'}>
          <span className="dot">{s.done ? '✓' : i + 1}</span>
          <span className="pl-text">
            <span className="lbl">{s.label}</span>
            <span className="team">{s.team}</span>
            <span className="det">{s.done ? (s.detail || (s.at ? fmtDate(s.at) : 'Done')) : s.open ? (s.detail || 'Action needed') : s.waiting || s.detail}</span>
          </span>
        </li>
      ))}
    </ol>
  );
}
export function MiniPipeline({ p }) {
  return <span className="mini-pipe" aria-label="Progress">{pipelineSteps(p).map((s) => <i key={s.key} className={s.done ? 'd' : s.open ? 'o' : ''} title={`${s.label}: ${s.done ? 'done' : s.open ? 'action needed' : s.waiting || ''}`} />)}</span>;
}
export const ProgressBar = ({ value, tone }) => <div className="progress"><div className={tone || ''} style={{ width: Math.min(100, Math.max(0, value)) + '%' }} /></div>;

/* ---------- line items editor ---------- */
export function LineItems({ items, onChange, gstRate, discount, onGst, onDiscount, catalog, hsn = true, defaultHsn = '' }) {
  const upd = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const t = calcTotals(items, gstRate, discount);
  return (
    <div className="lines">
      <div className="table-scroll">
        <table className="lines-table">
          <thead><tr><th>Description</th>{hsn && <th style={{ width: 90 }}>HSN/SAC</th>}<th className="r" style={{ width: 70 }}>Qty</th><th className="r" style={{ width: 120 }}>Rate (₹)</th><th className="r" style={{ width: 110 }}>Amount</th><th style={{ width: 36 }} /></tr></thead>
          <tbody>
            {items.map((it, i) => (
              <tr key={i}>
                <td>
                  <input list={catalog ? 'catalog-list' : undefined} value={it.desc ?? it.name ?? ''} placeholder="Item / service description"
                    onChange={(e) => {
                      const c = catalog?.find((x) => x.name === e.target.value);
                      onChange(items.map((x, j) => (j === i ? { ...x, desc: e.target.value, name: e.target.value, ...(c ? { itemId: c.id, rate: x.rate || c.rate } : {}) } : x)));
                    }} />
                </td>
                {hsn && <td><input value={it.hsn || ''} onChange={(e) => upd(i, 'hsn', e.target.value)} /></td>}
                <td><input type="number" className="r" value={it.qty} onChange={(e) => upd(i, 'qty', e.target.value)} /></td>
                <td><input type="number" className={'r' + (!num(it.rate) ? ' need' : '')} value={it.rate} onChange={(e) => upd(i, 'rate', e.target.value)} /></td>
                <td className="r">{inr(num(it.qty) * num(it.rate))}</td>
                <td><button className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove line">✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {catalog && <datalist id="catalog-list">{catalog.map((c) => <option key={c.id} value={c.name} />)}</datalist>}
      <div className="lines-foot">
        <button className="btn ghost sm" onClick={() => onChange([...items, { desc: '', hsn: defaultHsn, qty: 1, rate: 0 }])}>+ Add line</button>
        <div className="totals">
          <div><span>Subtotal</span><b>{inr(t.subtotal)}</b></div>
          {onDiscount && <div><span>Discount (₹)</span><input type="number" className="r mini" value={discount} onChange={(e) => onDiscount(e.target.value)} /></div>}
          {onGst && <div><span>GST %</span><input type="number" className="r mini" value={gstRate} onChange={(e) => onGst(e.target.value)} /></div>}
          <div><span>GST</span><b>{inr(t.gst)}</b></div>
          <div className="grand"><span>Total</span><b>{inr(t.total)}</b></div>
        </div>
      </div>
    </div>
  );
}

/* ---------- photos (compressed, stored in Firestore) ---------- */
export function PhotoUploader({ refId, clientId = null, projectId = null, teamId = null, visibleToClient = true, label = '+ Add photos', onAdded }) {
  const [busy, setBusy] = useState(false);
  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files.slice(0, 8)) {
        const data = await compressImage(f);
        await addDoc('photos', { refId, clientId, projectId, teamId, visibleToClient, data, at: Date.now(), byName: me()?.name || '' }, 'Photo');
      }
      toast(files.length > 1 ? 'Photos added' : 'Photo added');
      onAdded?.(files.length);
    } catch (err) { toast('Could not add photo: ' + friendlyError(err), 'err'); }
    setBusy(false);
  };
  return (
    <label className="btn ghost sm file-btn">
      {busy ? 'Uploading…' : label}
      <input type="file" accept="image/*" multiple hidden onChange={onFiles} />
    </label>
  );
}
export function PhotoGrid({ refId, canDelete, canToggleClient }) {
  const { teamId } = useScope();
  const photos = useCol('photos', scoped([['refId', '==', refId]], teamId), !!refId);
  const [open, setOpen] = useState(null);
  if (!photos.length) return <p className="muted small">No photos yet</p>;
  return (
    <>
      <div className="photo-grid">
        {[...photos].sort((a, b) => b.at - a.at).map((p) => (
          <div key={p.id} className="photo">
            <img src={p.data} alt="Site photo" onClick={() => setOpen(p)} />
            {canToggleClient && <button className={'photo-eye' + (p.visibleToClient ? ' on' : '')} title={p.visibleToClient ? 'Client can see this — tap to hide' : 'Hidden from client — tap to show'} onClick={() => updateDoc('photos', p.id, { visibleToClient: !p.visibleToClient })}>{p.visibleToClient ? '👁' : '⊘'}</button>}
            {canDelete && <button className="photo-x" onClick={() => setOpen({ ...p, confirmDelete: true })} aria-label="Delete photo">✕</button>}
          </div>
        ))}
      </div>
      {open && !open.confirmDelete && <div className="lightbox" onClick={() => setOpen(null)}><img src={open.data} alt="" /><span>{open.byName} · {fmtDateTime(open.at)}</span></div>}
      {open?.confirmDelete && (
        <Modal title="Delete photo?" onClose={() => setOpen(null)} footer={<><button className="btn ghost" onClick={() => setOpen(null)}>Keep</button><button className="btn danger-btn" onClick={() => act(() => deleteDoc('photos', open.id, 'Photo'), 'Photo deleted').then(() => setOpen(null))}>Delete</button></>}>
          <img src={open.data} alt="" className="confirm-img" />
        </Modal>
      )}
    </>
  );
}

/* ---------- files: drawings & documents ---------- */
const fmtSize = (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');

export function FileList({ projectId, kind, canDelete, canToggle, clientView, clientId, hideEmpty }) {
  const { teamId } = useScope();
  const base = clientView ? [['clientId', '==', clientId], ['projectId', '==', projectId], ['visibleToClient', '==', true]] : [['projectId', '==', projectId]];
  const all = useCol('files', scoped(base, teamId), !!projectId);
  const files = all.filter((f) => !f.uploading && (!kind || f.kind === kind)).sort((a, b) => b.at - a.at);
  const [busy, setBusy] = useState(null);
  const [del, setDel] = useState(null);
  const open = async (f, download) => {
    setBusy(f.id);
    try {
      const blob = await fetchFileBlob(f);
      const url = URL.createObjectURL(blob);
      if (download) {
        const a = document.createElement('a');
        a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove();
      } else {
        window.open(url, '_blank', 'noopener');
      }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { toast(friendlyError(e), 'err'); }
    setBusy(null);
  };
  if (!files.length) return hideEmpty ? null : <p className="muted small">{kind === 'Drawing' ? 'No drawing uploaded yet' : 'No documents yet'}</p>;
  return (
    <>
      <ul className="file-list">
        {files.map((f, i) => (
          <li key={f.id} className={kind === 'Drawing' && i > 0 ? 'old' : ''}>
            <span className="file-ico">{f.type === 'application/pdf' ? 'PDF' : f.type?.startsWith('image/') ? 'IMG' : 'DOC'}</span>
            <div className="file-meta">
              <b>{f.title || f.name}</b>{f.kind === 'Drawing' && <> <Badge tone={i === 0 ? 'green' : 'grey'}>Rev {f.rev}{i === 0 ? ' · latest' : ''}</Badge></>}
              <div className="muted small">{f.name} · {fmtSize(f.size)} · {f.byName} · {fmtDate(f.at)}
                {!clientView && <> · {f.visibleToClient ? 'Client can see' : 'Office only'}{f.shareWithTeam ? ' · Site team can see' : ''}</>}
              </div>
            </div>
            <div className="row gap">
              <button className="btn ghost sm" disabled={busy === f.id} onClick={() => open(f, false)}>{busy === f.id ? 'Opening…' : 'Open'}</button>
              <button className="btn ghost sm" disabled={busy === f.id} onClick={() => open(f, true)}>Download</button>
              {canToggle && <button className="btn ghost sm" onClick={() => updateDoc('files', f.id, { visibleToClient: !f.visibleToClient }, f.title)}>{f.visibleToClient ? 'Hide from client' : 'Show to client'}</button>}
              {canDelete && <button className="icon-btn" aria-label="Delete file" onClick={() => setDel(f)}>✕</button>}
            </div>
          </li>
        ))}
      </ul>
      {del && (
        <Modal title="Delete file?" onClose={() => setDel(null)} footer={<><button className="btn ghost" onClick={() => setDel(null)}>Keep</button><button className="btn danger-btn" onClick={() => act(() => deleteFile(del), 'File deleted').then(() => setDel(null))}>Delete</button></>}>
          <p>Delete <b>{del.title || del.name}</b>? Everyone will lose access to it.</p>
        </Modal>
      )}
    </>
  );
}

export function FileUpload({ project, kind = 'Document', nextRev = 0, onDone, onClose }) {
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState(kind === 'Drawing' ? `GA drawing – ${project.title}` : '');
  const [rev, setRev] = useState(nextRev);
  const [client, setClient] = useState(kind === 'Drawing');
  const [team, setTeam] = useState(kind === 'Drawing');
  const [pct, setPct] = useState(null);
  const save = async () => {
    if (!file) return toast('Choose a file first', 'err');
    setPct(0);
    try {
      const id = await uploadFile(file, {
        projectId: project.id, clientId: project.clientId, kind, title: title || file.name, rev: kind === 'Drawing' ? Number(rev) : null,
        visibleToClient: client, shareWithTeam: team, teamId: team ? project.teamId || null : null,
      }, setPct);
      toast(kind === 'Drawing' ? 'Drawing uploaded' : 'File uploaded');
      await onDone?.({ id, rev: Number(rev), visibleToClient: client, shareWithTeam: team });
      onClose();
    } catch (e) { toast(friendlyError(e), 'err'); setPct(null); }
  };
  return (
    <Modal title={kind === 'Drawing' ? 'Upload drawing' : 'Upload document'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={pct !== null} onClick={save}>{pct !== null ? `Uploading ${pct}%` : 'Upload'}</button></>}>
      <div className="form-grid">
        <Field label="File" span={2} hint={`PDF or image, up to ${MAX_FILE_MB} MB`}><input type="file" accept=".pdf,image/*,.dwg,.dxf" onChange={(e) => setFile(e.target.files[0] || null)} /></Field>
        <Field label="Title" span={kind === 'Drawing' ? 1 : 2}><input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Client purchase order" /></Field>
        {kind === 'Drawing' && <Field label="Revision"><input type="number" value={rev} onChange={(e) => setRev(e.target.value)} /></Field>}
      </div>
      <label className="check"><input type="checkbox" checked={client} onChange={(e) => setClient(e.target.checked)} /> Client can see and download it on their portal</label>
      <label className="check"><input type="checkbox" checked={team} onChange={(e) => setTeam(e.target.checked)} /> Site team can see it on their phones</label>
    </Modal>
  );
}

/* ---------- signature pad ---------- */
export function SignaturePad({ onSave, onCancel }) {
  const ref = useRef(null);
  const drawing = useRef(false);
  const [has, setHas] = useState(false);
  useEffect(() => {
    const c = ref.current;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.strokeStyle = '#111';
  }, []);
  const pos = (e) => { const r = ref.current.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  const down = (e) => { e.preventDefault(); ref.current.setPointerCapture(e.pointerId); drawing.current = true; const ctx = ref.current.getContext('2d'); ctx.beginPath(); ctx.moveTo(...pos(e)); };
  const move = (e) => { if (!drawing.current) return; const ctx = ref.current.getContext('2d'); ctx.lineTo(...pos(e)); ctx.stroke(); setHas(true); };
  const up = () => { drawing.current = false; };
  const clear = () => { const c = ref.current; c.getContext('2d').clearRect(0, 0, c.width, c.height); setHas(false); };
  return (
    <div className="sig">
      <canvas ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerLeave={up} />
      <div className="row gap between">
        <button className="btn ghost sm" onClick={clear}>Clear</button>
        <div className="row gap">
          {onCancel && <button className="btn ghost sm" onClick={onCancel}>Cancel</button>}
          <button className="btn sm" disabled={!has} onClick={() => onSave(ref.current.toDataURL('image/png'))}>Save signature</button>
        </div>
      </div>
    </div>
  );
}

/* ---------- activity feed ---------- */
export function ActivityFeed({ items, showFlags = true, limit }) {
  if (!items.length) return <Empty>No updates yet</Empty>;
  const list = [...items].sort((a, b) => b.at - a.at).slice(0, limit || 999);
  return (
    <ul className="feed">
      {list.map((a) => (
        <li key={a.id}>
          <div className="feed-meta"><b>{a.byName || 'System'}</b><span className="muted"> · {fmtDateTime(a.at)}</span>
            {showFlags && a.visibleToClient && <span className="badge blue tiny">Client sees</span>}
            {showFlags && a.teamId && <span className="badge grey tiny">Site team sees</span>}</div>
          <div className="feed-text">{a.text}</div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- printable documents (Quotation / Tax Invoice / Delivery Challan / PO) ---------- */
export function PrintDoc({ kind, doc, company, onClose }) {
  const t = calcTotals(doc.items || [], doc.gstRate ?? 0, doc.discount || 0);
  const isInvoice = kind === 'Tax Invoice';
  const isChallan = kind === 'Delivery Challan';
  const pos = doc.placeOfSupply || '';
  const intra = pos && company.state ? pos === company.state : (company.gstin || '').slice(0, 2) === (doc.clientGstin || company.gstin || '').slice(0, 2);
  const showHsn = (doc.items || []).some((i) => i.hsn);
  return (
    <PrintFrame title={kind} fileName={`${kind} ${doc.number || ''} ${doc.clientName || ''}`} onClose={onClose}>
      <div className="print-area">
        {doc.status === 'Cancelled' && <div className="pd-cancel">CANCELLED</div>}
        <div className="pd-head">
          <img src={logoUrl} alt="" className="pd-logo" />
          <div className="pd-left">
            <div className="pd-co">{company.name}</div>
            {company.tagline && <div className="pd-small">{company.tagline}</div>}
            <div className="pd-small pre">{company.address}{company.state ? ', ' + company.state : ''}</div>
            <div className="pd-small">{[company.phone, company.email, company.website].filter(Boolean).join(' · ')}</div>
            {company.gstin && <div className="pd-small">GSTIN: {company.gstin}{company.pan ? ' · PAN: ' + company.pan : ''}</div>}
          </div>
          <div className="pd-title">
            <div>{kind.toUpperCase()}</div>
            <div className="pd-small">No: <b>{doc.number}{doc.rev ? ` R${doc.rev}` : ''}</b></div>
            <div className="pd-small">Date: {fmtDate(doc.date)}</div>
            {doc.validTill && <div className="pd-small">Valid till: {fmtDate(doc.validTill)}</div>}
            {doc.dueDate && isInvoice && <div className="pd-small">Due: {fmtDate(doc.dueDate)}</div>}
          </div>
        </div>
        <div className="pd-to">
          <div className="pd-small muted">{isChallan ? 'Deliver to' : kind === 'Purchase Order' ? 'Supplier' : 'Bill to'}</div>
          <b>{doc.clientName}</b>
          {doc.clientContact && <div className="pd-small">{doc.clientContact}</div>}
          <div className="pd-small pre">{doc.address || doc.siteAddress || ''}</div>
          {doc.phone && <div className="pd-small">Ph: {doc.phone}</div>}
          {doc.clientGstin && <div className="pd-small">GSTIN: {doc.clientGstin}</div>}
          {isInvoice && pos && <div className="pd-small">Place of supply: {pos} ({stateCode(pos)})</div>}
          {isChallan && doc.vehicle && <div className="pd-small">Vehicle: {doc.vehicle} {doc.driver ? '· ' + doc.driver : ''}</div>}
        </div>
        {doc.liftSpec && (
          <div className="pd-spec">
            {Object.entries({ 'Lift type': doc.liftSpec.type, 'No. of lifts': doc.lifts, Capacity: doc.liftSpec.capacity, Stops: doc.liftSpec.stops, Speed: doc.liftSpec.speed, Drive: doc.liftSpec.drive, Doors: doc.liftSpec.doorType, Cabin: doc.liftSpec.cabin })
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          </div>
        )}
        <table className="pd-table">
          <thead><tr><th>#</th><th>Description</th>{showHsn && !isChallan && <th>HSN/SAC</th>}<th className="r">Qty</th>{!isChallan && <><th className="r">Rate</th><th className="r">Amount</th></>}</tr></thead>
          <tbody>
            {(doc.items || []).map((it, i) => (
              <tr key={i}><td>{i + 1}</td><td>{it.desc || it.name}</td>{showHsn && !isChallan && <td>{it.hsn}</td>}<td className="r">{it.qty}</td>{!isChallan && <><td className="r">{inr(it.rate)}</td><td className="r">{inr(num(it.qty) * num(it.rate))}</td></>}</tr>
            ))}
          </tbody>
        </table>
        {!isChallan && (
          <div className="pd-totals">
            <div><span>Subtotal</span><span>{inr(t.subtotal)}</span></div>
            {t.discount > 0 && <div><span>Discount</span><span>− {inr(t.discount)}</span></div>}
            {intra ? (<>
              <div><span>CGST @ {num(doc.gstRate) / 2}%</span><span>{inr(t.gst / 2)}</span></div>
              <div><span>SGST @ {num(doc.gstRate) / 2}%</span><span>{inr(t.gst / 2)}</span></div>
            </>) : <div><span>IGST @ {doc.gstRate}%</span><span>{inr(t.gst)}</span></div>}
            <div className="grand"><span>Total</span><span>{inr(t.total)}</span></div>
            <div className="pd-words">{amountInWords(t.total)}</div>
            {isInvoice && num(doc.paid) > 0 && <div><span>Received</span><span>{inr(doc.paid)}</span></div>}
            {isInvoice && <div className="grand"><span>Balance due</span><span>{inr(t.total - num(doc.paid))}</span></div>}
          </div>
        )}
        {doc.terms && <div className="pd-terms"><b>Terms & Conditions</b><div className="pre">{doc.terms}</div></div>}
        {isInvoice && company.bank && <div className="pd-terms"><b>Bank details</b><div className="pre">{company.bank}</div></div>}
        <div className="pd-sign">
          {isChallan ? <div>Receiver's signature</div> : <div />}
          <div>For {company.name}<br />{company.signature ? <img src={company.signature} alt="" className="pd-sigimg" /> : <><br /><br /></>}<br />Authorised Signatory</div>
        </div>
      </div>
    </PrintFrame>
  );
}

/* Print / PDF window: rendered outside the app so only the document prints */
export function PrintFrame({ title, fileName, onClose, children }) {
  const print = () => {
    const old = document.title;
    if (fileName) document.title = fileName.replace(/[\\/:*?"<>|]+/g, ' ').trim();
    window.print();
    setTimeout(() => { document.title = old; }, 1500);
  };
  return createPortal(
    <div className="print-host">
      <Modal title={title} onClose={onClose} wide footer={<><button className="btn ghost" onClick={onClose}>Close</button><button className="btn" onClick={print}>Print / Save as PDF</button></>}>
        {children}
      </Modal>
    </div>,
    document.body,
  );
}
