import React, { useMemo, useState } from 'react';
import { Card, Field, Select, act, Badge, Note, ProgressBar, useSettings, toast, go } from '../ui';
import { addQuiet, setQuiet, queryOnce, nextNumber, logAudit, backend } from '../data';
import { STATE_NAMES } from '../constants';
import { inr, fmtDate } from '../utils';
import { FIELDS, STATUS_OPTIONS, readWorkbook, sheetNames, readRows, guessStatus, colourName, buildRecord, parseDate } from '../importer';

const SWATCH = (hex) => (/^[0-9A-F]{6}$/.test(hex) ? '#' + hex : '#ccc');

export default function ImportOld() {
  const company = useSettings();
  const [file, setFile] = useState(null);
  const [wb, setWb] = useState(null);
  const [sheet, setSheet] = useState('');
  const [map, setMap] = useState(Object.fromEntries(FIELDS.map(([k, , c]) => [k, c])));
  const [colourMap, setColourMap] = useState({});
  const [opts, setOpts] = useState({ state: 'Uttar Pradesh', greenAs: 'order', from: '' });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const rows = useMemo(() => (wb && sheet ? readRows(wb, sheet, map) : []), [wb, sheet, map]);
  const colours = useMemo(() => {
    const c = {};
    rows.forEach((r) => { c[r.colour] = (c[r.colour] || 0) + 1; });
    return Object.entries(c).sort((a, b) => b[1] - a[1]);
  }, [rows]);
  const statusOf = (r) => colourMap[r.colour] || guessStatus(r.colour);
  const chosen = rows.filter((r) => statusOf(r) !== 'skip' && (!opts.from || (parseDate(r.date) || '9999') >= opts.from));
  const counts = { new: 0, quoted: 0, order: 0 };
  chosen.forEach((r) => { counts[statusOf(r)]++; });

  const load = async (f) => {
    setFile(f); setResult(null); setWb(null);
    if (!f) return;
    setBusy(true);
    try {
      const w = await readWorkbook(f);
      setWb(w); setSheet(sheetNames(w)[0]);
    } catch (e) { toast('Could not read this file. Save it as .xlsx (Google Sheets: File → Download → Microsoft Excel).', 'err'); console.error(e); }
    setBusy(false);
  };

  const run = async () => {
    setBusy(true); setProgress(0); setResult(null);
    try {
      await act(async () => {
        const already = new Set((await queryOnce('projects', [['imported', '==', true]])).map((p) => String(p.legacySerial)));
        const clients = await queryOnce('clients');
        const byPhone = new Map(); const byName = new Map();
        clients.forEach((c) => { if (c.phone) byPhone.set(String(c.phone).replace(/\D/g, '').slice(-10), c.id); byName.set(`${c.name}|${c.address}`.toUpperCase(), c.id); });
        let done = 0; let skipped = 0; let created = 0; let newClients = 0; let maxSerial = 0;
        const todo = chosen.filter((r) => { if (already.has(String(r.serial).trim())) { skipped++; return false; } return true; });
        const one = async (r) => {
          const rec = buildRecord(r, { status: statusOf(r), greenAs: opts.greenAs, state: opts.state, prefix: company.quotePrefix, company, hsn: company.hsnSupply });
          const ph = rec.phone.replace(/\D/g, '').slice(-10);
          const key = `${rec.client.name}|${rec.client.address}`.toUpperCase();
          let cid = (ph.length >= 10 && byPhone.get(ph)) || byName.get(key);
          if (!cid) {
            cid = await addQuiet('clients', { ...rec.client, createdAt: rec.project.createdAt });
            newClients++;
            if (ph.length >= 10) byPhone.set(ph, cid);
            byName.set(key, cid);
          }
          const project = { ...rec.project, clientId: cid };
          if (project.status !== 'Enquiry') project.code = await nextNumber('PRJ');
          const pid = await addQuiet('projects', project);
          if (rec.costing) await setQuiet('costings', pid, { ...rec.costing, projectId: pid, clientName: rec.name });
          maxSerial = Math.max(maxSerial, Number(r.serial) || 0);
          created++;
        };
        for (let i = 0; i < todo.length; i += 10) {
          await Promise.all(todo.slice(i, i + 10).map(one));
          done = Math.min(todo.length, i + 10);
          setProgress(Math.round((done / Math.max(1, todo.length)) * 100));
        }
        // New quotations continue after the highest imported serial
        if (maxSerial) {
          const cur = (await backend().getOne('counters', 'QREF'))?.n || 0;
          if (maxSerial > cur) await setQuiet('counters', 'QREF', { n: maxSerial });
        }
        logAudit('Imported', 'projects', `${created} rows from ${file?.name || 'Excel'}`);
        setResult({ created, skipped, newClients, maxSerial });
      }, 'Import finished');
    } finally { setBusy(false); }
  };

  return (
    <div className="stack">
      <Card title="Import old client register (Excel)">
        <ol className="import-steps">
          <li>In Google Sheets open your register → <b>File → Download → Microsoft Excel (.xlsx)</b>.</li>
          <li>Choose the file below. Row colours decide the status: <span className="sw" style={{ background: '#fff' }} /> white = quote to be given, <span className="sw" style={{ background: '#ff0' }} /> yellow = quote given, <span className="sw" style={{ background: '#3c3' }} /> green = order confirmed.</li>
          <li>Check the preview, then click <b>Import</b>. Rows already imported (same serial no.) are skipped, so it is safe to import again later.</li>
        </ol>
        <div className="row gap wrap">
          <label className="btn file-btn">{file ? 'Choose another file' : 'Choose Excel file'}<input type="file" accept=".xlsx" hidden onChange={(e) => load(e.target.files[0])} /></label>
          {file && <span className="muted small">{file.name}</span>}
          {busy && !progress && <span className="muted small">Reading…</span>}
        </div>
      </Card>

      {wb && (<>
        <Card title="Settings for this import">
          <div className="form-grid four">
            <Field label="Sheet / tab"><Select options={sheetNames(wb)} placeholder={false} value={sheet} onChange={(e) => setSheet(e.target.value)} /></Field>
            <Field label="State of the sites" hint="Used for GST and Ref No. (Jaipur, Delhi etc. are detected)"><Select options={STATE_NAMES} placeholder={false} value={opts.state} onChange={(e) => setOpts({ ...opts, state: e.target.value })} /></Field>
            <Field label="Green rows (orders) are"><Select options={[{ value: 'order', label: 'Running orders (track in Orders)' }, { value: 'completed', label: 'Completed / handed over' }]} placeholder={false} value={opts.greenAs} onChange={(e) => setOpts({ ...opts, greenAs: e.target.value })} /></Field>
            <Field label="Only rows dated from" hint="Leave empty to import all"><input type="date" value={opts.from} onChange={(e) => setOpts({ ...opts, from: e.target.value })} /></Field>
          </div>
          <h4 className="section-title">Colours found in the sheet</h4>
          <div className="colour-map">
            {colours.map(([hex, n]) => (
              <div key={hex} className="colour-row">
                <span className="sw big" style={{ background: SWATCH(hex) }} />
                <span><b>{colourName(hex)}</b> <span className="muted small">#{hex} · {n} rows</span></span>
                <Select options={STATUS_OPTIONS} placeholder={false} value={colourMap[hex] || guessStatus(hex)} onChange={(e) => setColourMap({ ...colourMap, [hex]: e.target.value })} />
              </div>
            ))}
          </div>
          <details className="mt">
            <summary className="muted small">Column layout (change only if your sheet is different)</summary>
            <div className="form-grid four mt">
              {FIELDS.map(([k, label]) => <Field key={k} label={label}><input value={map[k]} maxLength={2} onChange={(e) => setMap({ ...map, [k]: e.target.value.toUpperCase() })} /></Field>)}
            </div>
          </details>
        </Card>

        <Card title={`Preview — ${chosen.length} rows will be imported`} pad={false}>
          <div className="card-body row gap wrap">
            <Badge tone="blue">{counts.new} quote to be given</Badge>
            <Badge tone="amber">{counts.quoted} quote given</Badge>
            <Badge tone="green">{counts.order} {opts.greenAs === 'completed' ? 'completed orders' : 'running orders'}</Badge>
            <span className="muted small">{rows.length - chosen.length} rows left out</span>
          </div>
          <div className="table-scroll">
            <table className="preview-table">
              <thead><tr><th>Serial</th><th>Status</th><th>Client</th><th>Site</th><th>Lift</th><th>Floors / doors</th><th>Shaft</th><th className="r">Costing</th><th className="r">Quoted</th><th>Date</th></tr></thead>
              <tbody>
                {chosen.slice(-40).reverse().map((r) => {
                  const rec = buildRecord(r, { status: statusOf(r), greenAs: opts.greenAs, state: opts.state, prefix: company.quotePrefix, company });
                  const x = rec.project.proposal;
                  return (
                    <tr key={r.rowNumber}>
                      <td><span className="sw" style={{ background: SWATCH(r.colour) }} /> {r.serial}</td>
                      <td><Badge tone={statusOf(r) === 'order' ? 'green' : statusOf(r) === 'quoted' ? 'amber' : 'blue'}>{STATUS_OPTIONS.find((o) => o.value === statusOf(r))?.label}</Badge></td>
                      <td><b>{rec.name}</b><div className="muted small">{rec.phone}{x.architect ? ' · ' + x.architect : ''}</div></td>
                      <td className="small">{x.buildingType}<div className="muted">{rec.project.siteAddress}, {rec.project.siteCity}</div></td>
                      <td className="small">{x.lifts} × {x.liftKind}{x.persons ? ` · ${x.persons}P` : ''} · {x.drive}</td>
                      <td className="small">{x.floors || '—'}<div className="muted">{x.door}{x.color ? ' · ' + x.color : ''}</div></td>
                      <td className="small">{x.shaftW ? `${x.shaftW}×${x.shaftD}` : '—'}</td>
                      <td className="r small">{rec.costing?.costing ? inr(rec.costing.costing) : '—'}</td>
                      <td className="r small">{rec.project.quote.items[0].rate ? inr(rec.project.quote.items[0].rate) : '—'}</td>
                      <td className="small">{fmtDate(rec.project.quote.date)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="muted small pad-x">Showing the latest 40 rows. Ref No. example: {chosen[0] ? buildRecord(chosen[chosen.length - 1], { status: 'new', state: opts.state, prefix: company.quotePrefix, company }).project.quoteNo : '—'}</p>
        </Card>

        <Card>
          {progress !== null && <div className="mb"><ProgressBar value={progress} tone="green" /><span className="muted small">{progress}%</span></div>}
          {result ? (
            <Note tone="blue">
              Imported <b>{result.created}</b> client tabs ({result.newClients} new clients). {result.skipped > 0 && <>{result.skipped} were already imported and skipped. </>}
              {result.maxSerial > 0 && <>Highest serial imported: <b>{result.maxSerial}</b>. New quotations continue from <b>{Math.max(result.maxSerial + 1, Number(company.quoteNextSerial) || 0)}</b> — change “Next quotation serial no.” in the Company tab if that's not right.{' '}</>}
              <button className="link" onClick={() => go('enquiries')}>Open Enquiries</button> · <button className="link" onClick={() => go('orders')}>Open Orders</button>
            </Note>
          ) : (
            <div className="row gap wrap between">
              <span className="muted small">Costing (column L) is saved privately — only Admin, Sales and Accounts can see it. Clients never see it.</span>
              <button className="btn" disabled={busy || !chosen.length} onClick={run}>{busy ? 'Importing…' : `Import ${chosen.length} rows`}</button>
            </div>
          )}
        </Card>
      </>)}
    </div>
  );
}
