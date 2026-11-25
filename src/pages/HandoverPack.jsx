// Handover pack: Handover Certificate, Warranty Card and AMC Offer — print, send on WhatsApp, or save all to the client's documents.
import React, { useRef, useState } from 'react';
import { Modal, Field, act, useSettings, PrintFrame, logoUrl, elementToPdf, toast, Tabs } from '../ui';
import { uploadFile, postActivity, updateDoc } from '../data';
import { inr, num, fmtDate, addMonths, amountInWords } from '../utils';
import { specFromProposal, floorsLine } from '../proposal';

const exGst = (p) => Math.round(num(p.contractValue) / (1 + num(p.quote?.gstRate ?? 18) / 100));

function Letterhead({ company, title, no, date }) {
  return (
    <div className="pd-head">
      <img src={logoUrl} alt="" className="pd-logo" />
      <div className="pd-left">
        <div className="pd-co">{company.name}</div>
        {company.tagline && <div className="pd-small">{company.tagline}</div>}
        <div className="pd-small pre">{company.address}{company.state ? ', ' + company.state : ''}</div>
        <div className="pd-small">{[company.phone, company.email, company.website].filter(Boolean).join(' · ')}</div>
        {company.gstin && <div className="pd-small">GSTIN: {company.gstin}</div>}
      </div>
      <div className="pd-title"><div>{title}</div><div className="pd-small">No: <b>{no}</b></div><div className="pd-small">Date: {fmtDate(date)}</div></div>
    </div>
  );
}
const Sign = ({ company, client }) => (
  <div className="pd-sign">
    <div>{client ? <>Accepted by client<br /><br /><br />Name, signature & date</> : null}</div>
    <div>For {company.name}<br />{company.signature ? <img src={company.signature} alt="" className="pd-sigimg" /> : <><br /><br /></>}<br />Authorised Signatory</div>
  </div>
);

function liftRows(p, d) {
  const x = p.proposal || {};
  const s = p.proposal ? specFromProposal(x) : p.liftSpec || {};
  return [
    ['Lift type', s.type || p.liftSpec?.type], ['No. of lifts', x.lifts || p.lifts], ['Capacity', s.capacity || p.liftSpec?.capacity],
    ['Floors / stops', x.floors ? floorsLine(x) : p.liftSpec?.stops], ['Speed', s.speed || p.liftSpec?.speed], ['Drive', s.drive || p.liftSpec?.drive],
    ['Doors', x.door || p.liftSpec?.doorType], ['Lift ID / serial no.', d.liftIds.split('\n').map((l) => l.trim()).filter(Boolean).join(', ')],
  ].filter(([, v]) => v);
}

function Certificate({ p, d, company }) {
  return (
    <div className="print-area hp-doc">
      <Letterhead company={company} title="HANDOVER CERTIFICATE" no={`HO/${p.code || p.quoteNo}`} date={d.date} />
      <div className="pd-to"><div className="pd-small muted">Handed over to</div><b>{p.clientName}</b>{p.clientNo && <div className="pd-small">Client No.: <b>{p.clientNo}</b></div>}<div className="pd-small pre">{p.siteAddress}</div></div>
      <p className="hp-p">This is to certify that the lift installation described below has been completed, tested and commissioned by <b>{company.name}</b>, and handed over to the client in good working condition on <b>{fmtDate(d.date)}</b>.</p>
      <table className="pd-table"><tbody>{liftRows(p, d).map(([k, v]) => <tr key={k}><td style={{ width: '38%' }}>{k}</td><td><b>{v}</b></td></tr>)}
        <tr><td>Order no.</td><td>{p.code}{p.orderRef ? ` (client ref. ${p.orderRef})` : ''}</td></tr>
        {d.licenceNo && <tr><td>Lift licence no.</td><td>{d.licenceNo}</td></tr>}
      </tbody></table>
      <p className="hp-h">Handed over along with</p>
      <ul className="hp-list">{d.items.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => <li key={l}>☐ {l}</li>)}</ul>
      {d.notes && <p className="hp-p"><b>Remarks:</b> {d.notes}</p>}
      <p className="hp-p small">The client confirms the lift(s) were demonstrated, the operating and emergency rescue procedure was explained, and the items above were received.</p>
      <Sign company={company} client />
    </div>
  );
}

function Warranty({ p, d, company }) {
  const end = addMonths(d.date, num(d.warrantyMonths));
  return (
    <div className="print-area hp-doc">
      <Letterhead company={company} title="WARRANTY CARD" no={`WC/${p.code || p.quoteNo}`} date={d.date} />
      <div className="pd-to"><div className="pd-small muted">Issued to</div><b>{p.clientName}</b>{p.clientNo && <div className="pd-small">Client No.: <b>{p.clientNo}</b></div>}<div className="pd-small pre">{p.siteAddress}</div></div>
      <div className="hp-box">
        <div><span>Warranty period</span><b>{d.warrantyMonths} months</b></div>
        <div><span>Valid from</span><b>{fmtDate(d.date)}</b></div>
        <div><span>Valid till</span><b>{fmtDate(end)}</b></div>
        <div><span>Free maintenance</span><b>{d.freeMonths} months</b></div>
      </div>
      <table className="pd-table"><tbody>{liftRows(p, d).map(([k, v]) => <tr key={k}><td style={{ width: '38%' }}>{k}</td><td><b>{v}</b></td></tr>)}</tbody></table>
      <p className="hp-h">What is covered</p>
      <ul className="hp-list dot">
        <li>Free repair or replacement of any part that fails due to a manufacturing or installation defect.</li>
        <li>Free preventive maintenance visit every month during the free maintenance period.</li>
        <li>Breakdown attendance on call. Service helpline: <b>{company.phone || '—'}</b>.</li>
      </ul>
      <p className="hp-h">Not covered</p>
      <ul className="hp-list dot">
        <li>Damage due to misuse, overloading, vandalism, fire, flood, water entering the shaft or pit, or rodents.</li>
        <li>Damage due to voltage fluctuation, single-phasing or faulty power supply / earthing at site.</li>
        <li>Civil, electrical or other work outside the lift; parts replaced or repaired by anyone other than {company.name}.</li>
        <li>Consumables such as bulbs, and glass breakage.</li>
      </ul>
      <p className="hp-p small">Please quote the warranty number when calling for service. After the warranty, protect your lift with our Annual Maintenance Contract.</p>
      <Sign company={company} />
    </div>
  );
}

function AmcOffer({ p, d, company }) {
  const base = exGst(p);
  const start = addMonths(d.date, num(d.freeMonths));
  const opts = [
    ['Non-comprehensive AMC', num(d.amcWithout), 'Monthly preventive maintenance, lubrication, adjustment and safety checks; breakdown calls attended 24×7. Spare parts charged extra at actuals.'],
    ['Comprehensive AMC', num(d.amcComp), 'Everything in the non-comprehensive AMC plus all spare parts replaced free (except exclusions below).'],
  ].map(([name, pct, text]) => { const fee = Math.round((base * pct) / 100); return { name, pct, text, fee, gst: Math.round(fee * 0.18), total: Math.round(fee * 1.18) }; });
  return (
    <div className="print-area hp-doc">
      <Letterhead company={company} title="AMC OFFER" no={`AMC-OFF/${p.code || p.quoteNo}`} date={d.date} />
      <div className="pd-to"><div className="pd-small muted">To</div><b>{p.clientName}</b>{p.clientNo && <div className="pd-small">Client No.: <b>{p.clientNo}</b></div>}<div className="pd-small pre">{p.siteAddress}</div></div>
      <p className="hp-p">Dear Sir / Madam,<br />Thank you for choosing {company.name}. Your free maintenance period ends on <b>{fmtDate(start)}</b>. To keep your lift{num(p.lifts) > 1 ? 's' : ''} safe and running smoothly, we are pleased to offer our Annual Maintenance Contract from <b>{fmtDate(start)}</b> to <b>{fmtDate(addMonths(start, 12))}</b>.</p>
      <table className="pd-table">
        <thead><tr><th>Plan</th><th>What you get</th><th className="r">Per year</th></tr></thead>
        <tbody>{opts.map((o) => <tr key={o.name}><td><b>{o.name}</b></td><td className="small">{o.text}</td><td className="r nowrap">{inr(o.fee)}<div className="pd-small">+ GST 18% {inr(o.gst)}</div><b>{inr(o.total)}</b></td></tr>)}</tbody>
      </table>
      <p className="pd-small">({opts[0].name}: {amountInWords(opts[0].total)} incl. GST)</p>
      <p className="hp-h">Terms</p>
      <ul className="hp-list dot">
        <li>Payment: 100% in advance, or quarterly in advance by agreement.</li>
        <li>Rates are valid for 30 days from the date of this offer.</li>
        <li>Exclusions: damage from misuse, vandalism, water, fire or power faults; civil and electrical work outside the lift; glass and consumables.</li>
      </ul>
      <p className="hp-p">To accept, sign below and return this offer, or simply reply on WhatsApp — we will raise the AMC invoice.</p>
      <Sign company={company} client />
    </div>
  );
}

const DOCS = [
  { key: 'cert', label: 'Handover certificate', C: Certificate, file: 'Handover Certificate' },
  { key: 'war', label: 'Warranty card', C: Warranty, file: 'Warranty Card' },
  { key: 'amc', label: 'AMC offer', C: AmcOffer, file: 'AMC Offer' },
];

export default function HandoverPack({ p, onClose }) {
  const company = useSettings();
  const x = p.proposal || {};
  const lifts = Math.max(1, num(x.lifts || p.lifts) || 1);
  const [d, setD] = useState(() => ({
    date: p.handover?.date || (p.handoverAt ? new Date(p.handoverAt).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)),
    liftIds: p.handoverPack?.liftIds || Array.from({ length: lifts }, (_, i) => `Lift ${i + 1}`).join('\n'),
    warrantyMonths: p.handoverPack?.warrantyMonths || 12, freeMonths: p.handoverPack?.freeMonths || 12,
    amcWithout: p.handoverPack?.amcWithout ?? x.amcWithout ?? company.amcWithout ?? 3, amcComp: p.handoverPack?.amcComp ?? x.amcComp ?? company.amcComp ?? 6,
    licenceNo: p.licence?.number || '', notes: p.handover?.notes || '',
    items: p.handoverPack?.items || 'Lift keys and landing door emergency key\nOperation & maintenance manual\nEmergency rescue procedure (displayed in machine room / top floor)\nTest & commissioning report\nWiring diagram',
  }));
  const [tab, setTab] = useState('cert');
  const [show, setShow] = useState(null);
  const [saving, setSaving] = useState(null);
  const refs = { cert: useRef(null), war: useRef(null), amc: useRef(null) };
  const set = (k) => (e) => setD({ ...d, [k]: e.target.value });

  const saveAll = async () => {
    try {
      for (const doc of DOCS) {
        setSaving(doc.label);
        const name = `${doc.file} ${p.code || ''} ${p.clientName}`.replace(/[\\/:*?"<>|]+/g, ' ').replace(/\s+/g, ' ').trim() + '.pdf';
        const file = await elementToPdf(refs[doc.key].current, name);
        await uploadFile(file, { projectId: p.id, clientId: p.clientId, kind: 'Document', title: doc.file, rev: null, visibleToClient: true, shareWithTeam: false, teamId: null });
      }
      await act(async () => {
        await updateDoc('projects', p.id, { handoverPack: { liftIds: d.liftIds, warrantyMonths: num(d.warrantyMonths), freeMonths: num(d.freeMonths), amcWithout: num(d.amcWithout), amcComp: num(d.amcComp), items: d.items, savedAt: Date.now(), warrantyEnd: addMonths(d.date, num(d.warrantyMonths)) } }, p.code);
        await postActivity({ projectId: p.id, clientId: p.clientId, text: 'Your handover certificate, warranty card and AMC offer are ready — see Documents.', visibleToClient: true, kind: 'handover' });
      }, 'Handover pack saved to the client\'s documents');
      onClose();
    } catch (e) { toast('Could not save: ' + (e.message || e), 'err'); }
    setSaving(null);
  };

  const Cur = DOCS.find((x2) => x2.key === tab);
  return (<>
    <Modal title={'Handover pack — ' + p.clientName} wide onClose={onClose}
      footer={<><button className="btn ghost" onClick={onClose}>Close</button><span className="spacer" />
        <button className="btn ghost" onClick={() => setShow(tab)}>Print / WhatsApp this one</button>
        <button className="btn" disabled={!!saving} onClick={saveAll}>{saving ? `Saving ${saving}…` : 'Save all 3 to client documents'}</button></>}>
      <div className="form-grid">
        <Field label="Handover date"><input type="date" value={d.date} onChange={set('date')} /></Field>
        <Field label="Lift licence no. (if issued)"><input value={d.licenceNo} onChange={set('licenceNo')} /></Field>
        <Field label="Warranty (months)"><input type="number" value={d.warrantyMonths} onChange={set('warrantyMonths')} /></Field>
        <Field label="Free maintenance (months)"><input type="number" value={d.freeMonths} onChange={set('freeMonths')} /></Field>
        <Field label="AMC non-comprehensive (% of order value / year)"><input type="number" step="0.5" value={d.amcWithout} onChange={set('amcWithout')} /></Field>
        <Field label="AMC comprehensive (% / year)"><input type="number" step="0.5" value={d.amcComp} onChange={set('amcComp')} /></Field>
        <Field label="Lift IDs / serial numbers (one per line)"><textarea rows={3} value={d.liftIds} onChange={set('liftIds')} /></Field>
        <Field label="Handed over items (one per line)"><textarea rows={3} value={d.items} onChange={set('items')} /></Field>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={DOCS.map((x2) => ({ key: x2.key, label: x2.label }))} />
      <div className="hp-preview"><div className="hp-scale"><Cur.C p={p} d={d} company={company} /></div></div>
    </Modal>
    {/* full-size copies used to make the PDFs */}
    <div className="hp-offscreen" aria-hidden="true">{DOCS.map((doc) => <div key={doc.key} ref={refs[doc.key]}><doc.C p={p} d={d} company={company} /></div>)}</div>
    {show && (() => { const doc = DOCS.find((x2) => x2.key === show); return (
      <PrintFrame title={doc.file} fileName={`${doc.file} ${p.code || ''} ${p.clientName}`} onClose={() => setShow(null)}
        whatsapp={{ phone: p.contactPhone, text: `Dear ${p.contactPerson || p.clientName}, please find attached your ${doc.file.toLowerCase()} for ${p.title || 'your lift'} (${p.code}). — ${company.name}` }}>
        <doc.C p={p} d={d} company={company} />
      </PrintFrame>); })()}
  </>);
}
