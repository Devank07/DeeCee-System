import React from 'react';
import { PrintFrame, logoUrl, useSettings, useDoc } from '../ui';
import { num, inr } from '../utils';
import { KEY_FEATURES, CLIENT_SCOPE, typeLine, floorsLine, wordsUpper, stateAbbr } from '../proposal';

const dmy = (d) => { const x = new Date(d || Date.now()); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`; };
const up = (s) => String(s || '').toUpperCase();
const money = (n) => '₹ ' + Number(Math.round(num(n))).toLocaleString('en-IN') + '/-';
const dotted = (abbr) => abbr.split('').join('.');

function Sheet({ company, page, total, children }) {
  return (
    <section className="sheet">
      <header className="sh-head">
        <img src={logoUrl} alt="Dee Cee Elevators" className="sh-logo" />
        <div className="sh-co">
          <div className="sh-name">{up(company.name)}</div>
          <div className="sh-tag">{company.tagline}</div>
        </div>
      </header>
      <div className="sh-body">{children}</div>
      <footer className="sh-foot">
        <div className="sh-page">Page {page} of {total}</div>
        <div className="sh-addr">{company.address}</div>
        <div className="sh-web"><u>{company.website}</u>&nbsp;&nbsp;&nbsp;&nbsp;{company.phone}</div>
      </footer>
    </section>
  );
}

const boldPart = (text, re) => text.split(re).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));

function ClientBlock({ p, x }) {
  const city = up(p.siteCity || '');
  const st = dotted(stateAbbr(p.siteState));
  return (
    <div className="pp-client">
      <b>{up(p.clientName)}</b>
      {x.buildingType && <b>{up(x.buildingType)}</b>}
      {(p.siteAddress || '').split('\n').filter(Boolean).map((l, i) => <b key={i}>{up(l)}</b>)}
      {city && <b>{city} ({st}) INDIA</b>}
    </div>
  );
}

export default function ProposalDoc({ p, onClose }) {
  const company = useSettings();
  const sales = useDoc('staff', p.salesBy || null);
  const x = p.proposal || {};
  const q = p.quote || {};
  const items = (q.items || []).filter((it) => num(it.rate) * num(it.qty) > 0 || it.desc);
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0) - num(q.discount);
  const intra = company.state && p.siteState ? company.state === p.siteState : false;
  const gstText = intra ? `CGST (${num(q.gstRate ?? 18) / 2}%) + SGST (${num(q.gstRate ?? 18) / 2}%) Extra.` : `IGST (${q.gstRate ?? 18}%) Extra.`;
  const kind = (x.liftKind || 'PASSENGER').replace(' / STRETCHER', '');
  const signLines = (sales?.quoteSignature || [sales?.name || p.salesName, sales?.designation, sales?.phone && 'Mobile: ' + sales.phone, sales?.email && 'Email: ' + sales.email].filter(Boolean).join('\n')).split('\n');
  const fileName = `${up(p.clientName)} - ${up((p.siteAddress || '').split(',')[0])} ${String(q.refNo || '').split('/').pop()}`.trim();
  const T = 4;
  const row = (label, value) => (value ? <tr><td>{label}</td><td>{value}</td></tr> : null);

  return (
    <PrintFrame title={'Quotation ' + (q.refNo || p.quoteNo)} fileName={fileName} onClose={onClose}>
      <div className="sheets">
        {/* PAGE 1 — covering letter */}
        <Sheet company={company} page={1} total={T}>
          <div className="pp-title">PROPOSAL FOR SUPPLY, INSTALLATION &amp; COMMISSIONING OF {kind} ELEVATOR</div>
          <div className="pp-meta">
            <b>Dated {dmy(q.date)}</b>
            <b>Ref No.: {q.refNo || p.quoteNo}</b>
            <b>To,</b>
          </div>
          <ClientBlock p={p} x={x} />
          <div className="pp-subject">SUBJECT: PROPOSAL FOR {kind} ELEVATOR</div>
          <p>We thank you for the opportunity to submit our proposal for the supply, installation, and commissioning of an elevator at your esteemed property.</p>
          <p><b>{company.letterName || company.name}</b> is committed to delivering reliable, safe, and aesthetically superior vertical mobility solutions. Our systems are engineered using advanced technology and designed to meet modern performance standards.</p>
          <p>We are confident that our proposal aligns with your requirements and look forward to a long-term association.</p>
          <p className="pp-tight">Please find enclosed the following-</p>
          <ul className="pp-ul"><li>Technical Specifications</li><li>Price &amp; scope of work</li><li>Commercial terms &amp; conditions</li></ul>
          <p>We are sure that you will find this proposal acceptable.</p>
          <p>If you need any further information, please contact me.</p>
          <p>Yours Sincerely</p>
          <p className="pp-for"><b>For {company.shortName || company.name}</b> <img src={logoUrl} alt="" className="pp-mini-logo" /></p>
          <div className="pp-sign-lines">
            {signLines.map((l, i) => <div key={i} className={i < 2 ? 'b' : ''}>{l}</div>)}
            <div>Visit us: {company.website}</div>
          </div>
        </Sheet>

        {/* PAGE 2 — technical specifications */}
        <Sheet company={company} page={2} total={T}>
          <div className="pp-h">TECHNICAL SPECIFICATIONS-</div>
          <div className="pp-two">
            <ClientBlock p={p} x={x} />
            <div className="pp-right">
              <div><b>Ref:</b> {x.ref2 || ''}</div>
              <div><b>Architect:</b> <b>{up(x.architect)}</b></div>
              <div><b>Site Supervisor:</b> {x.siteSupervisor}</div>
              <div><b>Site Visit:</b> {x.siteVisit}</div>
            </div>
          </div>
          <table className="pp-spec">
            <tbody>
              {row('TYPE', <>{x.origin} {x.liftKind} LIFT <b>{x.drive}</b> TYPE</>)}
              {row('NO. OF LIFTS', <b>{String(x.lifts || 1).padStart(2, '0')}</b>)}
              {row('CAPACITY & LOAD', <><b>{x.persons}</b> PERSONS / <b>{x.capacityKg}</b> KG</>)}
              {row('SPEED', <><b>{x.speed}</b> mps</>)}
              {row('TRAVEL/RISE', x.travel ? <>Approx. <b>{x.travel}</b> mtr</> : null)}
              {row('FLOORS/OPENING', x.floors ? <><b>{x.floors}</b> {floorsLine({ ...x, floors: '' })}</> : null)}
              {row('MACHINE', x.machine ? <><b>{x.machine.split(' ').slice(0, 2).join(' ')}</b> {x.machine.split(' ').slice(2).join(' ')}</> : null)}
              {row('Drive & Control', x.control)}
              {row('Operation', x.operation)}
              {row('REQUIRED SHAFT SIZES', (x.shaftW || x.pit || x.overhead) ? <>
                {x.shaftW && <div>Hoist way Size: <b>{x.shaftW} mm</b> wide x <b>{x.shaftD} mm</b> depth</div>}
                {x.pit && <div>Pit Depth: <b>{x.pit} mm</b></div>}
                {x.overhead && <div>Over Head: <b>{x.overhead} mm</b> {x.overheadNote}</div>}
              </> : null)}
              {row('CAR SIZE', x.carW ? <><b>{x.carW} mm</b> wide X <b>{x.carD} mm</b> depth X <b>{x.carH} mm</b> high approx. (as per GAD)</> : null)}
              {row('Clear Entrance size', x.entW ? <><b>{x.entW} mm</b> wide X <b>{x.entH} mm</b> high</> : null)}
              {row('DOOR OPERATION/TYPE', x.door ? boldPart(x.door, /(Glass Door|SS Hairline Door|SS Door)/) : null)}
              {row('LIFT COLOR (CAR + DOORS)', <b>{up(x.color)}</b>)}
              {row('CAR DESIGN', <>
                <div>Car Panels: <b>{(x.panels || '').split(' ')[0]}</b> {(x.panels || '').split(' ').slice(1).join(' ')}</div>
                <div>False Ceiling: {x.ceiling}</div>
                <div>Flooring: {x.flooring}</div>
                {x.flooringNote && <div>&nbsp;{x.flooringNote}</div>}
              </>)}
              {row('LOP/COP', <b>{x.lopcop}</b>)}
              {row('POWER SUPPLY', <><div>Main Supply: {x.powerMain}</div><div>Lighting Supply: {x.powerLight}</div></>)}
            </tbody>
          </table>
          <div className="pp-h2">KEY FEATURES</div>
          <ul className="pp-ul cols">
            {[...KEY_FEATURES, ...Object.keys(x.features || {}).filter((f) => !KEY_FEATURES.includes(f))].map((f) => <li key={f} className={x.features?.[f] === false ? 'strike' : ''}>{f}</li>)}
          </ul>
        </Sheet>

        {/* PAGE 3 — price & commercial terms */}
        <Sheet company={company} page={3} total={T}>
          <div className="pp-h">PROJECT COST SUMMARY:</div>
          <table className="pp-cost">
            <thead><tr><th>Description</th><th>Amount</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.desc}{num(it.qty) > 1 && <span> ({num(it.qty)} Nos × {inr(it.rate)})</span>}</td>
                  <td className="c"><b>{money(num(it.qty) * num(it.rate))}</b><div className="sm">({wordsUpper(num(it.qty) * num(it.rate))})</div></td>
                </tr>
              ))}
              {num(q.discount) > 0 && <tr><td>Less: Special discount</td><td className="c"><b>− {money(q.discount)}</b></td></tr>}
              {items.length > 1 && <tr><td><b>Total</b></td><td className="c"><b>{money(subtotal)}</b><div className="sm">({wordsUpper(subtotal)})</div></td></tr>}
              <tr><td /><td className="c"><b>+</b><div><b>{gstText}</b> {x.freightNote}</div></td></tr>
            </tbody>
          </table>
          <div className="pp-h">ANNUAL MAINTENANCE CONTRACT (AMC)</div>
          <p className="pp-tight">Upon completion of the initial 12 months free maintenance period, the Annual Maintenance Contract (AMC) shall be applicable as follows:</p>
          <ul className="pp-ul">
            <li><b>{x.amcWithout}% of the total order value per annum – Without Material</b></li>
            <li><b>{x.amcComp}% of the total order value per annum – Comprehensive AMC</b></li>
          </ul>
          <p className="pp-tight">The AMC will cover routine maintenance, periodic inspections, and servicing to ensure smooth and safe operation of the elevator system.</p>
          <p>Detailed AMC terms and service scope shall be provided at the time of AMC agreement.</p>
          <div className="pp-h">COMMERCIAL TERMS</div>
          <div className="pp-h3">Payment Terms</div>
          <ul className="pp-ul">{(x.payTerms || []).map((t, i) => <li key={i}>{t.percent}% {t.label}</li>)}</ul>
          <div className="pp-h3">Delivery Timeline</div>
          <ul className="pp-ul"><li>{x.delivery}</li></ul>
          <div className="pp-h3">Warranty &amp; Maintenance</div>
          <ul className="pp-ul">{(x.warranty || []).map((w, i) => <li key={i}>{w}</li>)}</ul>
        </Sheet>

        {/* PAGE 4 — scope, terms, sign-off, bank */}
        <Sheet company={company} page={4} total={T}>
          <div className="pp-h">SCOPE OF WORK</div>
          <div className="pp-h3">Our Scope</div>
          <ul className="pp-ul">{(x.ourScope || []).map((s, i) => <li key={i}>{s}</li>)}</ul>
          <div className="pp-h3">Client Scope</div>
          <ol className="pp-ol">
            {[...CLIENT_SCOPE, ...Object.keys(x.clientScope || {}).filter((f) => !CLIENT_SCOPE.includes(f))].map((s) => <li key={s} className={x.clientScope?.[s] === false ? 'strike' : ''}>{s}</li>)}
          </ol>
          <div className="pp-h">IMPORTANT TERMS &amp; CONDITIONS</div>
          <ul className="pp-ul">{(x.terms || []).map((t, i) => <li key={i}>{t.replace(/(\d+ days)/, '§$1§').split('§').map((part, j) => (j === 1 ? <b key={j}>{part}</b> : part))}</li>)}</ul>
          <div className="pp-signoff">
            <div>
              <span className="pp-lbl"><b>For {company.shortName || company.name}</b> <img src={logoUrl} alt="" className="pp-mini-logo" /></span>
              <div className="pp-sig">{company.signature && <img src={company.signature} alt="Authorised signature" />}</div>
              <b>Auth. Signatory</b>
            </div>
            <div className="r">
              <span className="pp-lbl"><b>Accepted by Client</b></span>
              <div className="pp-sig" />
              <b>(Signature with Seal and Date)</b>
            </div>
          </div>
          {company.bank && (
            <div className="pp-bank">
              <div><u>OUR BANK DETAIL</u></div>
              {company.bank.split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </Sheet>
      </div>
    </PrintFrame>
  );
}
