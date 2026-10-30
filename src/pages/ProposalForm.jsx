import React, { useId, useState } from 'react';
import { useCol, Modal, Field, Select, act, go, LineItems, useSettings, Note } from '../ui';
import { addDoc, updateDoc, nextSerial, postActivity, me } from '../data';
import { STATE_NAMES, LEAD_SOURCES, stateFromGstin } from '../constants';
import { num, today, addDays, inr, calcTotals, sum } from '../utils';
import {
  defaultProposal, defaultItems, nextRevRef, baseRefOf, specFromProposal, titleFromProposal, buildRef, cityCode, kgForPersons,
  ORIGINS, LIFT_KINDS, DRIVE_KINDS, OPERATIONS, DOORS, COLORS, PANELS, CEILINGS, FLOORINGS, LOPCOP, BUILDING_TYPES, KEY_FEATURES, CLIENT_SCOPE,
} from '../proposal';

function Combo({ options, ...p }) {
  const id = useId();
  return (<><input list={id} {...p} /><datalist id={id}>{options.map((o) => <option key={o} value={o} />)}</datalist></>);
}

const STEPS = ['Client & site', 'Lift & shaft', 'Car & finish', 'Price & terms'];

/* Step-by-step quotation in the DCEPL proposal format.
   p = existing client tab (edit) · clientId = start a new enquiry for an existing client */
export default function ProposalForm({ p, clientId, revise, onClose }) {
  const company = useSettings();
  const clients = useCol('clients');
  const staff = useCol('staff');
  const editing = !!p;
  const locked = !!p?.orderConfirmedAt;
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [f, setF] = useState(() => {
    const base = defaultProposal(company);
    if (p) {
      return {
        existingId: p.clientId, name: p.clientName, siteAddress: p.siteAddress || '', siteCity: p.siteCity || '', siteState: p.siteState || '', cityCode: p.proposal?.cityCode || cityCode(p.siteCity),
        x: { ...base, ...(p.proposal || {}) }, items: p.quote?.items?.length ? p.quote.items : defaultItems(company), gstRate: p.quote?.gstRate ?? 18, discount: p.quote?.discount || 0,
        validTill: p.quote?.validTill || addDays(today(), 30), date: p.quote?.date || today(), refNo: p.quote?.refNo || p.quoteNo,
      };
    }
    return {
      existingId: clientId || '', name: '', contactPerson: '', phone: '', email: '', gstin: '',
      siteAddress: '', siteCity: '', siteState: '', cityCode: '',
      source: 'Phone', followUpDate: addDays(today(), 2), salesBy: me()?.staffId || '', notes: '',
      x: base, items: defaultItems(company), gstRate: company.defaultGst ?? 18, discount: 0, validTill: addDays(today(), 30), date: today(),
    };
  });
  const existing = clients.find((c) => c.id === f.existingId);
  const set = (k, v) => setF((s) => ({ ...s, [k]: v }));
  const b = (k) => ({ value: f[k] ?? '', onChange: (e) => set(k, e.target.value) });
  const setX = (k, v) => setF((s) => ({ ...s, x: { ...s.x, [k]: v } }));
  const bx = (k) => ({ value: f.x[k] ?? '', onChange: (e) => setX(k, e.target.value) });
  const payTotal = sum(f.x.payTerms || [], (t) => num(t.percent));
  const sub = calcTotals(f.items, 0, f.discount).taxable;
  const total = calcTotals(f.items, f.gstRate, f.discount).total;
  const refPreview = f.refNo || buildRef(company.quotePrefix, f.siteState || existing?.state, f.cityCode || cityCode(f.siteCity || existing?.city), '####', f.date);

  const pickExisting = (id) => {
    const c = clients.find((x) => x.id === id);
    setF((s) => ({ ...s, existingId: id, siteAddress: s.siteAddress || c?.address || '', siteCity: s.siteCity || c?.city || '', siteState: s.siteState || c?.state || '', cityCode: s.cityCode || cityCode(c?.city) }));
  };

  const validate = () => {
    if (!editing && !existing && (!f.name.trim() || !f.phone.trim())) { setStep(0); return 'Enter the client name and phone number'; }
    if (!f.siteState) { setStep(0); return 'Select the state of the site (needed for GST and the reference number)'; }
    if (Math.round(payTotal) !== 100) { setStep(3); return `Payment terms add up to ${payTotal}% — they must total 100%`; }
    return null;
  };

  const save = async () => {
    const err = validate();
    if (err) return act(async () => { throw new Error(err); });
    setBusy(true);
    try {
      await act(async () => {
        const x = { ...f.x, cityCode: f.cityCode || cityCode(f.siteCity) };
        const spec = specFromProposal(x);
        if (editing) {
          let quote = { ...(p.quote || {}), items: f.items, gstRate: num(f.gstRate), discount: num(f.discount), validTill: f.validTill, terms: '' };
          const extra = {};
          if (revise) {
            // Keep the old version exactly as it was sent, then issue the new one as …A, …B
            const old = { refNo: p.quote?.refNo || p.quoteNo, rev: Number(p.quote?.rev) || 0, quote: p.quote || {}, proposal: p.proposal || {}, siteAddress: p.siteAddress || '', siteCity: p.siteCity || '', siteState: p.siteState || '', savedAt: Date.now(), by: me()?.name || '' };
            const rev = (Number(p.quote?.rev) || 0) + 1;
            const refNo = nextRevRef(p);
            quote = { ...quote, baseRef: baseRefOf(p), rev, refNo, number: refNo, date: today(), validTill: addDays(today(), 30) };
            Object.assign(extra, { quoteNo: refNo, revisions: [...(p.revisions || []), old] });
          }
          const enquiry = { ...(p.enquiry || {}), status: total > 0 && ['New', 'Contacted', 'Site Visit'].includes(p.enquiry?.status) ? 'Quoted' : p.enquiry?.status || 'New' };
          await updateDoc('projects', p.id, {
            proposal: x, quote, liftSpec: spec, lifts: num(x.lifts) || 1, title: titleFromProposal(x),
            siteAddress: f.siteAddress, siteCity: f.siteCity, siteState: f.siteState, ...(p.status === 'Enquiry' ? { enquiry } : {}), ...extra,
          }, extra.quoteNo || p.quoteNo);
          if (revise) await postActivity({ projectId: p.id, clientId: p.clientId, text: `Quotation revised: ${extra.quoteNo} replaces ${p.quote?.refNo || p.quoteNo} (old version kept).`, visibleToClient: false, kind: 'quote' });
          onClose();
          return;
        }
        let cid = existing?.id;
        const c = existing || { name: f.name.trim(), contactPerson: f.contactPerson || f.name.trim(), phone: f.phone.trim(), email: f.email, address: f.siteAddress.replace(/\n/g, ', '), city: f.siteCity, state: f.siteState || stateFromGstin(f.gstin), gstin: (f.gstin || '').toUpperCase() };
        if (!cid) cid = await addDoc('clients', c, c.name);
        const serial = await nextSerial('QREF', company.quoteNextSerial);
        const refNo = buildRef(company.quotePrefix, f.siteState, x.cityCode, serial, f.date);
        const sales = staff.find((s) => s.id === f.salesBy);
        const pid = await addDoc('projects', {
          quoteNo: refNo, clientId: cid, clientName: c.name, contactPerson: c.contactPerson || '', contactPhone: c.phone || '',
          siteAddress: f.siteAddress, siteCity: f.siteCity, siteState: f.siteState,
          title: titleFromProposal(x), lifts: num(x.lifts) || 1, liftSpec: spec, proposal: x, status: 'Enquiry',
          enquiry: { status: total > 0 ? 'Quoted' : 'New', source: f.source, followUpDate: f.followUpDate, notes: f.notes },
          salesBy: f.salesBy || '', salesName: sales?.name || me()?.name || '',
          quote: { number: refNo, refNo, serial, rev: 0, date: f.date, validTill: f.validTill, items: f.items, gstRate: num(f.gstRate), discount: num(f.discount) },
        }, refNo);
        onClose();
        go('orders/' + pid);
      }, revise ? `Revised quotation ${nextRevRef(p)} created — old version kept` : editing ? 'Quotation saved' : 'Client tab & quotation created');
    } finally { setBusy(false); }
  };

  const steps = [
    /* 1 — client & site */
    <>
      {!editing && <div className="form-grid"><Field label="Existing client?" span={2}><Select options={clients.map((c) => ({ value: c.id, label: c.name }))} placeholder="— No, this is a new client —" value={f.existingId} onChange={(e) => pickExisting(e.target.value)} /></Field></div>}
      {!editing && !existing && (
        <div className="form-grid">
          <Field label="Client name (as printed) *" hint="e.g. MR. PRASHANT JAIN"><input {...b('name')} autoFocus /></Field>
          <Field label="Phone *"><input {...b('phone')} inputMode="tel" /></Field>
          <Field label="Contact person (if different)"><input {...b('contactPerson')} /></Field>
          <Field label="Email"><input type="email" {...b('email')} /></Field>
          <Field label="GSTIN (if any)"><input {...b('gstin')} /></Field>
        </div>
      )}
      <div className="form-grid">
        <Field label="Building type"><Combo options={BUILDING_TYPES} {...bx('buildingType')} /></Field>
        <Field label="Site address" span={2} hint="One line per row, as it should print"><textarea rows={2} {...b('siteAddress')} placeholder={'25A SHALIMAR ENCLAVE KAMLA NAGAR'} /></Field>
        <Field label="City"><input value={f.siteCity} onChange={(e) => setF((s) => ({ ...s, siteCity: e.target.value, cityCode: s.cityCodeTouched ? s.cityCode : cityCode(e.target.value) }))} placeholder="AGRA" /></Field>
        <Field label="State *"><Select options={STATE_NAMES} {...b('siteState')} /></Field>
        <Field label="City code (for Ref No.)" hint={'Ref: ' + refPreview}><input value={f.cityCode} maxLength={4} onChange={(e) => setF((s) => ({ ...s, cityCode: e.target.value.toUpperCase(), cityCodeTouched: true }))} /></Field>
        <Field label="Architect"><input {...bx('architect')} /></Field>
        <Field label="Site supervisor"><input {...bx('siteSupervisor')} /></Field>
        <Field label="Site visit (date / by)"><input {...bx('siteVisit')} /></Field>
        {!editing && <>
          <Field label="Enquiry source"><Select options={LEAD_SOURCES} placeholder={false} {...b('source')} /></Field>
          <Field label="Next follow-up"><input type="date" {...b('followUpDate')} /></Field>
          <Field label="Sales person (signs page 1)"><Select options={staff.filter((s) => s.active !== false).map((s) => ({ value: s.id, label: s.name }))} {...b('salesBy')} /></Field>
          <Field label="Notes" span={2}><input {...b('notes')} placeholder="Anything the client mentioned" /></Field>
        </>}
      </div>
    </>,
    /* 2 — lift & shaft */
    <>
      <div className="form-grid four">
        <Field label="Make"><Select options={ORIGINS} placeholder={false} {...bx('origin')} /></Field>
        <Field label="Lift type"><Select options={LIFT_KINDS} placeholder={false} {...bx('liftKind')} /></Field>
        <Field label="Drive"><Select options={DRIVE_KINDS} placeholder={false} {...bx('drive')} /></Field>
        <Field label="No. of lifts"><input type="number" min="1" {...bx('lifts')} /></Field>
        <Field label="Persons"><input type="number" value={f.x.persons} onChange={(e) => setF((s) => ({ ...s, x: { ...s.x, persons: e.target.value, capacityKg: kgForPersons(e.target.value) } }))} /></Field>
        <Field label="Load (kg)" hint="68 kg per person"><input type="number" {...bx('capacityKg')} /></Field>
        <Field label="Speed (mps)"><input {...bx('speed')} /></Field>
        <Field label="Travel / rise (mtr)"><input {...bx('travel')} placeholder="9.3" /></Field>
        <Field label="Floors"><input {...bx('floors')} placeholder="G+1+2" /></Field>
        <Field label="Stops"><input type="number" {...bx('stops')} /></Field>
        <Field label="Openings" span={2}><Combo options={['All Openings on same side', 'Front & rear openings', 'Front & side openings']} {...bx('openings')} /></Field>
        <Field label="Machine" span={2}><Combo options={['2.8 KW Gearless Traction Machine (Sharp/Techtronic)', '3.7 KW Gearless Traction Machine (Sharp/Techtronic)', '5.5 KW Gearless Traction Machine (Montanari)', '7.5 KW Geared Traction Machine']} {...bx('machine')} /></Field>
        <Field label="Drive & control"><Combo options={['Microprocessor with V3F Drive']} {...bx('control')} /></Field>
        <Field label="Operation"><Combo options={OPERATIONS} {...bx('operation')} /></Field>
      </div>
      <h4 className="section-title">Required shaft sizes (mm)</h4>
      <div className="form-grid four">
        <Field label="Hoistway width"><input type="number" {...bx('shaftW')} placeholder="1550" /></Field>
        <Field label="Hoistway depth"><input type="number" {...bx('shaftD')} placeholder="1550" /></Field>
        <Field label="Pit depth"><input type="number" {...bx('pit')} /></Field>
        <Field label="Overhead"><input type="number" {...bx('overhead')} /></Field>
        <Field label="Overhead note"><Combo options={['Top Slab', 'Below Machine Room']} {...bx('overheadNote')} /></Field>
      </div>
    </>,
    /* 3 — car & finish */
    <>
      <div className="form-grid four">
        <Field label="Car width (mm)"><input type="number" {...bx('carW')} placeholder="1000" /></Field>
        <Field label="Car depth (mm)"><input type="number" {...bx('carD')} placeholder="1100" /></Field>
        <Field label="Car height (mm)"><input type="number" {...bx('carH')} /></Field>
        <span />
        <Field label="Clear entrance width"><input type="number" {...bx('entW')} /></Field>
        <Field label="Clear entrance height"><input type="number" {...bx('entH')} /></Field>
        <Field label="Door operation / type" span={2}><Combo options={DOORS} {...bx('door')} /></Field>
        <Field label="Lift colour (car + doors)"><Combo options={COLORS} {...bx('color')} /></Field>
        <Field label="Car panels" span={2}><Combo options={PANELS} {...bx('panels')} /></Field>
        <Field label="LOP / COP"><Combo options={LOPCOP} {...bx('lopcop')} /></Field>
        <Field label="False ceiling" span={2}><Combo options={CEILINGS} {...bx('ceiling')} /></Field>
        <Field label="Flooring" span={2}><Combo options={FLOORINGS} {...bx('flooring')} /></Field>
        <Field label="Flooring note" span={4}><input {...bx('flooringNote')} /></Field>
        <Field label="Main power supply" span={2}><input {...bx('powerMain')} /></Field>
        <Field label="Lighting supply" span={2}><input {...bx('powerLight')} /></Field>
      </div>
      <h4 className="section-title">Key features — untick any that are not included (they won't be printed)</h4>
      <Checks list={KEY_FEATURES} value={f.x.features} onChange={(v) => setX('features', v)} />
    </>,
    /* 4 — price & terms */
    <>
      <h4 className="section-title">Project cost — amounts before GST</h4>
      <LineItems items={f.items} onChange={(v) => set('items', v)} gstRate={f.gstRate} discount={f.discount} onGst={(v) => set('gstRate', v)} onDiscount={(v) => set('discount', v)} defaultHsn={company.hsnSupply || ''} />
      <p className="muted small">Printed as: {inr(sub)} + GST {f.gstRate}% extra · Total with GST {inr(total)}</p>
      <div className="form-grid">
        <Field label="Note after GST line" span={2}><input {...bx('freightNote')} /></Field>
        <Field label="Quotation valid till"><input type="date" {...b('validTill')} /></Field>
        <Field label="Delivery timeline"><input {...bx('delivery')} /></Field>
        <Field label="AMC without material (% per year)"><input type="number" {...bx('amcWithout')} /></Field>
        <Field label="Comprehensive AMC (% per year)"><input type="number" {...bx('amcComp')} /></Field>
      </div>
      <h4 className="section-title">Payment terms {Math.round(payTotal) !== 100 && <span className="danger-text small">(total {payTotal}% — must be 100%)</span>}</h4>
      <table className="lines-table"><tbody>
        {(f.x.payTerms || []).map((t, i) => (
          <tr key={i}>
            <td style={{ width: 90 }}><input type="number" className="r" value={t.percent} onChange={(e) => setX('payTerms', f.x.payTerms.map((y, j) => (j === i ? { ...y, percent: e.target.value } : y)))} /></td>
            <td><input value={t.label} onChange={(e) => setX('payTerms', f.x.payTerms.map((y, j) => (j === i ? { ...y, label: e.target.value } : y)))} /></td>
            <td style={{ width: 36 }}><button className="icon-btn" onClick={() => setX('payTerms', f.x.payTerms.filter((_, j) => j !== i))}>✕</button></td>
          </tr>
        ))}
      </tbody></table>
      <button className="btn ghost sm" onClick={() => setX('payTerms', [...(f.x.payTerms || []), { percent: 0, label: '' }])}>+ Add payment stage</button>
      <h4 className="section-title">Client scope — untick anything DeeCee will do instead (it won't be printed)</h4>
      <Checks list={CLIENT_SCOPE} value={f.x.clientScope} onChange={(v) => setX('clientScope', v)} />
      <div className="form-grid">
        <Field label="Warranty & maintenance (one per line)"><textarea rows={2} value={(f.x.warranty || []).join('\n')} onChange={(e) => setX('warranty', e.target.value.split('\n'))} /></Field>
        <Field label="Our scope (one per line)"><textarea rows={3} value={(f.x.ourScope || []).join('\n')} onChange={(e) => setX('ourScope', e.target.value.split('\n'))} /></Field>
        <Field label="Important terms & conditions (one per line)" span={2}><textarea rows={5} value={(f.x.terms || []).join('\n')} onChange={(e) => setX('terms', e.target.value.split('\n'))} /></Field>
      </div>
    </>,
  ];

  return (
    <Modal title={revise ? `Revise quotation → ${nextRevRef(p)}` : editing ? `Quotation ${p.quote?.refNo || p.quoteNo}` : 'New client & quotation'} wide onClose={onClose}
      footer={<>
        <span className="muted small">Step {step + 1} of {STEPS.length}</span>
        <span className="spacer" />
        {step > 0 && <button className="btn ghost" onClick={() => setStep(step - 1)}>← Back</button>}
        {step < STEPS.length - 1 && <button className={'btn' + (editing ? ' ghost' : '')} onClick={() => setStep(step + 1)}>Next →</button>}
        {!locked && (editing || step === STEPS.length - 1) && <button className="btn" disabled={busy} onClick={save}>{busy ? 'Saving…' : revise ? `Save as ${nextRevRef(p)}` : editing ? 'Save changes (same ref)' : 'Create client tab & quotation'}</button>}
      </>}>
      <div className="wizard-steps">
        {STEPS.map((s, i) => <button key={s} className={i === step ? 'on' : i < step ? 'done' : ''} onClick={() => setStep(i)}><span>{i + 1}</span>{s}</button>)}
      </div>
      {locked && <Note tone="blue">The order is confirmed, so this quotation is locked. You can still view and print it.</Note>}
      {revise && <Note tone="blue">Change what the client asked for. Saving creates <b>{nextRevRef(p)}</b> dated today. The current version <b>{p.quote?.refNo || p.quoteNo}</b> stays saved and can still be printed.</Note>}
      <fieldset className="plain" disabled={locked}>{steps[step]}</fieldset>
    </Modal>
  );
}

function Checks({ list, value = {}, onChange }) {
  const extra = Object.keys(value).filter((k) => !list.includes(k));
  const [add, setAdd] = useState('');
  return (
    <div className="checks two">
      {[...list, ...extra].map((item) => (
        <label key={item} className={'check' + (value[item] === false ? ' struck' : '')}>
          <input type="checkbox" checked={value[item] !== false} onChange={(e) => onChange({ ...value, [item]: e.target.checked })} /> {item}
        </label>
      ))}
      <div className="row gap"><input value={add} onChange={(e) => setAdd(e.target.value)} placeholder="Add another item" /><button className="btn ghost sm" onClick={() => { if (add.trim()) { onChange({ ...value, [add.trim()]: true }); setAdd(''); } }}>Add</button></div>
    </div>
  );
}
