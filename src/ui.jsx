import React, { useEffect, useMemo, useRef, useState } from 'react';
import { subscribe, addDoc, deleteDoc, me } from './data';
import { calcTotals, compressImage, downloadFile, toCSV, inr, fmtDate, amountInWords, num, fmtDateTime } from './utils';
import { PROJECT_STAGES } from './constants';

/* ---------- routing (hash based) ---------- */
export function useRoute() {
  const parse = () => (location.hash.replace(/^#\/?/, '') || '').split('/');
  const [r, setR] = useState(parse);
  useEffect(() => { const f = () => setR(parse()); addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (path) => { location.hash = '#/' + path; };

/* ---------- data hooks ---------- */
export function useCol(col, filters = [], enabled = true) {
  const key = JSON.stringify(filters);
  const [rows, setRows] = useState(null);
  useEffect(() => {
    if (!enabled) { setRows([]); return; }
    return subscribe(col, JSON.parse(key), setRows);
  }, [col, key, enabled]);
  return rows || [];
}
export function useSettings() {
  const rows = useCol('settings');
  return rows.find((r) => r.id === 'company') || { name: 'DeeCee Elevators Pvt. Ltd.', defaultGst: 18 };
}

/* ---------- toast ---------- */
let toastFn = () => {};
export const toast = (msg, tone = 'ok') => toastFn(msg, tone);
export function Toaster() {
  const [t, setT] = useState(null);
  useEffect(() => { toastFn = (msg, tone) => { setT({ msg, tone, k: Date.now() }); }; }, []);
  useEffect(() => { if (!t) return; const h = setTimeout(() => setT(null), 3200); return () => clearTimeout(h); }, [t]);
  return t ? <div className={'toast ' + t.tone} key={t.k}>{t.msg}</div> : null;
}
// run an async action with error toast
export async function act(fn, okMsg) {
  try { const r = await fn(); if (okMsg) toast(okMsg); return r; } catch (e) { console.error(e); toast(e.message || 'Something went wrong', 'err'); throw e; }
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
    <div><h1>{title}</h1>{sub && <p className="muted">{sub}</p>}</div>
    {actions && <div className="row gap">{actions}</div>}
  </div>
);
export const Card = ({ title, actions, children, className = '', pad = true }) => (
  <section className={'card ' + className}>
    {(title || actions) && <div className="card-head"><h3>{title}</h3><div className="row gap">{actions}</div></div>}
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
  green: ['Paid', 'Won', 'Accepted', 'Active', 'Done', 'Resolved', 'Closed', 'Received', 'Delivered', 'Completed', 'P', 'Present'],
  amber: ['Partly Paid', 'Invoiced', 'Sent', 'Quoted', 'Negotiation', 'Site Visit', 'Assigned', 'In Progress', 'Ordered', 'Scheduled', 'On Hold', 'High', 'Expiring', 'L', 'Leave', 'Dispatched', 'H'],
  red: ['Overdue', 'Lost', 'Rejected', 'Open', 'Expired', 'Critical (Trapped / Stuck)', 'Cancelled', 'Unpaid', 'A', 'Absent', 'Low stock', 'Disabled'],
  blue: ['New', 'Draft', 'Contacted', 'Pending', 'Normal'],
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
  const [sort, setSort] = useState(initialSort || null); // {key, desc}
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

/* ---------- project stage stepper ---------- */
export function StageStepper({ stage, compact }) {
  const ref = useRef(null);
  useEffect(() => {
    const ol = ref.current;
    const li = ol?.children[stage];
    if (ol && li && !compact) ol.scrollLeft = Math.max(0, li.offsetLeft - ol.clientWidth / 2 + li.clientWidth / 2);
  }, [stage, compact]);
  return (
    <ol ref={ref} className={'stepper' + (compact ? ' compact' : '')}>
      {PROJECT_STAGES.map((s, i) => (
        <li key={s} className={i < stage ? 'done' : i === stage ? 'current' : ''}>
          <span className="dot">{i < stage ? '✓' : i + 1}</span>
          <span className="lbl">{s}</span>
        </li>
      ))}
    </ol>
  );
}
export const ProgressBar = ({ value, tone }) => <div className="progress"><div className={tone || ''} style={{ width: Math.min(100, Math.max(0, value)) + '%' }} /></div>;

/* ---------- line items editor ---------- */
export function LineItems({ items, onChange, gstRate, discount, onGst, onDiscount, catalog }) {
  const upd = (i, k, v) => onChange(items.map((it, j) => (j === i ? { ...it, [k]: v } : it)));
  const t = calcTotals(items, gstRate, discount);
  return (
    <div className="lines">
      <table className="lines-table">
        <thead><tr><th>Description</th><th className="r" style={{ width: 80 }}>Qty</th><th className="r" style={{ width: 130 }}>Rate (₹)</th><th className="r" style={{ width: 120 }}>Amount</th><th style={{ width: 36 }} /></tr></thead>
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
              <td><input type="number" className="r" value={it.qty} onChange={(e) => upd(i, 'qty', e.target.value)} /></td>
              <td><input type="number" className="r" value={it.rate} onChange={(e) => upd(i, 'rate', e.target.value)} /></td>
              <td className="r">{inr(num(it.qty) * num(it.rate))}</td>
              <td><button className="icon-btn" onClick={() => onChange(items.filter((_, j) => j !== i))} aria-label="Remove line">✕</button></td>
            </tr>
          ))}
        </tbody>
      </table>
      {catalog && <datalist id="catalog-list">{catalog.map((c) => <option key={c.id} value={c.name} />)}</datalist>}
      <div className="lines-foot">
        <button className="btn ghost sm" onClick={() => onChange([...items, { desc: '', qty: 1, rate: 0 }])}>+ Add line</button>
        <div className="totals">
          <div><span>Subtotal</span><b>{inr(t.subtotal)}</b></div>
          {onDiscount && <div><span>Discount</span><input type="number" className="r mini" value={discount} onChange={(e) => onDiscount(e.target.value)} /></div>}
          {onGst && <div><span>GST %</span><input type="number" className="r mini" value={gstRate} onChange={(e) => onGst(e.target.value)} /></div>}
          <div><span>GST</span><b>{inr(t.gst)}</b></div>
          <div className="grand"><span>Total</span><b>{inr(t.total)}</b></div>
        </div>
      </div>
    </div>
  );
}

/* ---------- photos (stored as compressed base64 in 'photos' collection) ---------- */
export function PhotoUploader({ refId, clientId = null, projectId = null, label = '+ Add photos' }) {
  const [busy, setBusy] = useState(false);
  const onFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = '';
    if (!files.length) return;
    setBusy(true);
    try {
      for (const f of files.slice(0, 6)) {
        const data = await compressImage(f);
        await addDoc('photos', { refId, clientId, projectId, data, at: Date.now(), byName: me()?.name || '' }, 'Photo');
      }
      toast(files.length > 1 ? 'Photos added' : 'Photo added');
    } catch (err) { toast('Could not add photo: ' + err.message, 'err'); }
    setBusy(false);
  };
  return (
    <label className="btn ghost sm file-btn">
      {busy ? 'Uploading…' : label}
      <input type="file" accept="image/*" capture="environment" multiple hidden onChange={onFiles} />
    </label>
  );
}
export function PhotoGrid({ refId, canDelete }) {
  const photos = useCol('photos', [['refId', '==', refId]], !!refId);
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  return (
    <>
      <div className="photo-grid">
        {photos.sort((a, b) => a.at - b.at).map((p) => (
          <div key={p.id} className="photo">
            <img src={p.data} alt="Site photo" onClick={() => setOpen(p)} />
            {canDelete && <button className="photo-x" onClick={() => confirm('Delete this photo?') && deleteDoc('photos', p.id)} aria-label="Delete photo">✕</button>}
          </div>
        ))}
      </div>
      {open && <div className="lightbox" onClick={() => setOpen(null)}><img src={open.data} alt="" /><span>{open.byName} · {fmtDateTime(open.at)}</span></div>}
    </>
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
export function ActivityFeed({ items, showClientFlag = true }) {
  if (!items.length) return <Empty>No updates yet</Empty>;
  return (
    <ul className="feed">
      {[...items].sort((a, b) => b.at - a.at).map((a) => (
        <li key={a.id}>
          <div className="feed-meta"><b>{a.byName || 'System'}</b>{a.byRole && <span className="muted"> · {a.byRole}</span>}<span className="muted"> · {fmtDateTime(a.at)}</span>
            {showClientFlag && a.visibleToClient && <span className="badge blue tiny">Shared with client</span>}</div>
          <div className="feed-text">{a.text}</div>
        </li>
      ))}
    </ul>
  );
}

/* ---------- printable documents (Quotation / Tax Invoice / Delivery Challan / Receipt) ---------- */
export function PrintDoc({ kind, doc, company, onClose }) {
  const t = calcTotals(doc.items || [], doc.gstRate ?? 0, doc.discount || 0);
  const isInvoice = kind === 'Tax Invoice';
  const isChallan = kind === 'Delivery Challan';
  const intra = (company.gstin || '').slice(0, 2) && (doc.clientGstin || '').slice(0, 2) ? company.gstin.slice(0, 2) === doc.clientGstin.slice(0, 2) : true;
  return (
    <Modal title={kind} onClose={onClose} wide footer={<><button className="btn ghost" onClick={onClose}>Close</button><button className="btn" onClick={() => window.print()}>Print / Save as PDF</button></>}>
      <div className="print-area">
        <div className="pd-head">
          <div>
            <div className="pd-co">{company.name}</div>
            {company.tagline && <div className="pd-small">{company.tagline}</div>}
            <div className="pd-small pre">{company.address}</div>
            <div className="pd-small">{[company.phone, company.email, company.website].filter(Boolean).join(' · ')}</div>
            {company.gstin && <div className="pd-small">GSTIN: {company.gstin}</div>}
          </div>
          <div className="pd-title">
            <div>{kind.toUpperCase()}</div>
            <div className="pd-small">No: <b>{doc.number}</b></div>
            <div className="pd-small">Date: {fmtDate(doc.date)}</div>
            {doc.validTill && <div className="pd-small">Valid till: {fmtDate(doc.validTill)}</div>}
            {doc.dueDate && isInvoice && <div className="pd-small">Due: {fmtDate(doc.dueDate)}</div>}
          </div>
        </div>
        <div className="pd-to">
          <div className="pd-small muted">{isChallan ? 'Deliver to' : 'Bill to'}</div>
          <b>{doc.clientName}</b>
          {doc.clientContact && <div className="pd-small">{doc.clientContact}</div>}
          <div className="pd-small pre">{doc.address || doc.siteAddress || ''}</div>
          {doc.phone && <div className="pd-small">Ph: {doc.phone}</div>}
          {doc.clientGstin && <div className="pd-small">GSTIN: {doc.clientGstin}</div>}
          {isChallan && doc.vehicle && <div className="pd-small">Vehicle: {doc.vehicle} {doc.driver ? '· ' + doc.driver : ''}</div>}
        </div>
        {doc.liftSpec && (
          <div className="pd-spec">
            {Object.entries({ 'Lift type': doc.liftSpec.type, 'No. of lifts': doc.lifts, Capacity: doc.liftSpec.capacity, Stops: doc.liftSpec.stops, Speed: doc.liftSpec.speed, Drive: doc.liftSpec.drive, Doors: doc.liftSpec.doorType, Cabin: doc.liftSpec.cabin })
              .filter(([, v]) => v).map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          </div>
        )}
        <table className="pd-table">
          <thead><tr><th>#</th><th>Description</th><th className="r">Qty</th>{!isChallan && <><th className="r">Rate</th><th className="r">Amount</th></>}</tr></thead>
          <tbody>
            {(doc.items || []).map((it, i) => (
              <tr key={i}><td>{i + 1}</td><td>{it.desc || it.name}</td><td className="r">{it.qty}</td>{!isChallan && <><td className="r">{inr(it.rate)}</td><td className="r">{inr(num(it.qty) * num(it.rate))}</td></>}</tr>
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
          <div>For {company.name}<br /><br /><br />Authorised Signatory</div>
        </div>
      </div>
    </Modal>
  );
}
