import React from 'react';
import { PrintFrame, logoUrl, useSettings, useDoc } from '../ui';
import { num, inr } from '../utils';
import { KEY_FEATURES, CLIENT_SCOPE, wordsUpper, stateAbbr } from '../proposal';

const dmy = (d) => { const x = new Date(d || Date.now()); return `${String(x.getDate()).padStart(2, '0')}.${String(x.getMonth() + 1).padStart(2, '0')}.${x.getFullYear()}`; };
const up = (s) => String(s || '').toUpperCase();
const money = (n) => '₹ ' + Number(Math.round(num(n))).toLocaleString('en-IN') + '/-';
const dotted = (abbr) => abbr.split('').join('.');
const boldPart = (text, re) => String(text || '').split(re).map((part, i) => (i % 2 ? <b key={i}>{part}</b> : part));
const titleCase = (s) => s.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
// Only items that are ticked are printed (unticked = not included)
const included = (std, map = {}) => [...std, ...Object.keys(map).filter((k) => !std.includes(k))].filter((k) => map[k] !== false && String(k).trim());

function Sheet({ company, page, total, refNo, children }) {
  return (
    <section className="sheet">
      <header className="sh-head">
        <img src={logoUrl} alt="Dee Cee Elevators" className="sh-logo" />
        <div className="sh-co">
          <div className="sh-name">{up(company.name)}</div>
          <div className="sh-tag">{company.tagline}</div>
        </div>
        <div className="sh-ref">{page > 1 && refNo ? <><span>Ref.</span><br />{refNo}</> : null}</div>
      </header>
      <div className="sh-rule" />
      <div className="sh-body">{children}</div>
      <footer className="sh-foot">
        <div className="sh-rule thin" />
        <div className="sh-foot-row">
          <span>{company.address}</span>
          <span>{company.website}&nbsp;&nbsp;|&nbsp;&nbsp;{company.phone}</span>
          <span className="sh-page">Page {page} of {total}</span>
        </div>
      </footer>
    </section>
  );
}

function ClientBlock({ p, x }) {
  const city = up(p.siteCity || '');
  return (
    <div className="pp-client">
      <b>{up(p.clientName)}</b>
      {x.buildingType && <span>{up(x.buildingType)}</span>}
      {(p.siteAddress || '').split('\n').filter(Boolean).map((l, i) => <span key={i}>{up(l)}</span>)}
      {city && <span>{city} ({dotted(stateAbbr(p.siteState))}) INDIA</span>}
    </div>
  );
}

const H = ({ children }) => <div className="pp-h"><span>{children}</span></div>;

export default function ProposalDoc({ p, onClose }) {
  const company = useSettings();
  const sales = useDoc('staff', p.salesBy || null);
  const x = p.proposal || {};
  const q = p.quote || {};
  const refNo = q.refNo || p.quoteNo;
  const items = (q.items || []).filter((it) => it.desc || num(it.rate));
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0) - num(q.discount);
  const gst = num(q.gstRate ?? 18);
  const intra = company.state && p.siteState ? company.state === p.siteState : false;
  const gstText = intra ? `CGST ${gst / 2}% + SGST ${gst / 2}% extra` : `IGST ${gst}% extra`;
  const kind = (x.liftKind || 'PASSENGER').replace(' / STRETCHER', '');
  const signLines = (sales?.quoteSignature || [sales?.name || p.salesName, sales?.designation, sales?.phone && 'Mobile: ' + sales.phone, sales?.email && 'Email: ' + sales.email].filter(Boolean).join('\n')).split('\n').filter((l) => l.trim());
  const prevList = (p.revisions || []).filter((r) => r.refNo !== refNo);
  const prev = Number(q.rev) > 0 ? prevList.slice(-1)[0]?.refNo : null;
  const fileName = `${up(p.clientName)} - ${up((p.siteAddress || '').split('\n')[0])} ${String(refNo || '').split('/').pop()}`.trim();
  const features = included(KEY_FEATURES, x.features);
  const clientScope = included(CLIENT_SCOPE, x.clientScope);
  const T = 4;
  const row = (label, value) => (value ? <tr><th>{label}</th><td>{value}</td></tr> : null);
  const sheet = (n, body) => <Sheet company={company} page={n} total={T} refNo={refNo}>{body}</Sheet>;

  return (
    <PrintFrame title={'Quotation ' + refNo} fileName={fileName} onClose={onClose}>
      <div className="sheets">
        {/* PAGE 1 — covering letter */}
        {sheet(1, <>
          <div className="pp-title">Proposal for Supply, Installation &amp; Commissioning of {titleCase(kind)} Elevator</div>
          <div className="pp-letterhead">
            <div>
              <div className="pp-to">To,</div>
              <ClientBlock p={p} x={x} />
            </div>
            <table className="pp-refbox"><tbody>
              <tr><th>Ref No.</th><td>{refNo}</td></tr>
              <tr><th>Date</th><td>{dmy(q.date)}</td></tr>
              {prev && <tr><th>Supersedes</th><td>{prev}</td></tr>}
              <tr><th>Valid till</th><td>{dmy(q.validTill)}</td></tr>
            </tbody></table>
          </div>
          <div className="pp-subject">Subject: Proposal for {titleCase(kind)} Elevator</div>
          <p>Dear Sir / Madam,</p>
          <p>We thank you for the opportunity to submit our proposal for the supply, installation, and commissioning of an elevator at your esteemed property.</p>
          <p><b>{company.letterName || company.name}</b> is committed to delivering reliable, safe, and aesthetically superior vertical mobility solutions. Our systems are engineered using advanced technology and designed to meet modern performance standards.</p>
          <p>We are confident that our proposal aligns with your requirements and look forward to a long-term association.</p>
          <p className="pp-tight">Please find enclosed the following:</p>
          <ul className="pp-list"><li>Technical Specifications</li><li>Price &amp; Scope of Work</li><li>Commercial Terms &amp; Conditions</li></ul>
          <p>We are sure that you will find this proposal acceptable. If you need any further information, please contact me.</p>
          <p>Yours sincerely,</p>
          <div className="pp-for"><b>For {company.shortName || company.name}</b></div>
          <div className="pp-sign-lines">
            {signLines.map((l, i) => <div key={i} className={i === 0 ? 'nm' : i === 1 ? 'b' : ''}>{l}</div>)}
            <div>Visit us: {company.website}</div>
          </div>
        </>)}

        {/* PAGE 2 — technical specifications */}
        {sheet(2, <>
          <H>Technical Specifications</H>
          <div className="pp-two">
            <ClientBlock p={p} x={x} />
            <table className="pp-mini"><tbody>
              {x.architect && <tr><th>Architect</th><td>{up(x.architect)}</td></tr>}
              {x.siteSupervisor && <tr><th>Site Supervisor</th><td>{x.siteSupervisor}</td></tr>}
              {x.siteVisit && <tr><th>Site Visit</th><td>{x.siteVisit}</td></tr>}
            </tbody></table>
          </div>
          <table className="pp-spec">
            <tbody>
              {row('Type', <>{x.origin} {x.liftKind} LIFT — <b>{x.drive}</b> TYPE</>)}
              {row('No. of Lifts', <b>{String(x.lifts || 1).padStart(2, '0')}</b>)}
              {row('Capacity & Load', <><b>{x.persons}</b> Persons / <b>{x.capacityKg}</b> kg</>)}
              {row('Speed', <><b>{x.speed}</b> mps</>)}
              {row('Travel / Rise', x.travel ? <>Approx. <b>{x.travel}</b> mtr</> : null)}
              {row('Floors / Openings', x.floors ? <><b>{x.floors}</b>{x.stops ? ` (${x.stops}/${x.stops} Stops)` : ''}{x.openings ? ` — ${x.openings}` : ''}</> : null)}
              {row('Machine', x.machine ? boldPart(x.machine, /^(\S+ \S+)/) : null)}
              {row('Drive & Control', x.control)}
              {row('Operation', x.operation)}
              {row('Required Shaft Size', (x.shaftW || x.pit || x.overhead) ? <>
                {x.shaftW && <div>Hoistway: <b>{x.shaftW} mm</b> wide × <b>{x.shaftD} mm</b> deep</div>}
                {x.pit && <div>Pit depth: <b>{x.pit} mm</b></div>}
                {x.overhead && <div>Overhead: <b>{x.overhead} mm</b>{x.overheadNote ? ` (${x.overheadNote})` : ''}</div>}
              </> : null)}
              {row('Car Size', x.carW ? <><b>{x.carW}</b> W × <b>{x.carD}</b> D × <b>{x.carH}</b> H mm approx. (as per GAD)</> : null)}
              {row('Clear Entrance', x.entW ? <><b>{x.entW}</b> W × <b>{x.entH}</b> H mm</> : null)}
              {row('Door Operation / Type', x.door ? boldPart(x.door, /(Glass Door|SS Hairline Door|SS Door|Swing Door|Collapsible Door)/) : null)}
              {row('Lift Colour (Car + Doors)', x.color ? <b>{up(x.color)}</b> : null)}
              {row('Car Design', (x.panels || x.ceiling || x.flooring) ? <>
                {x.panels && <div>Car panels: {boldPart(x.panels, /^(\S+)/)}</div>}
                {x.ceiling && <div>False ceiling: {x.ceiling}</div>}
                {x.flooring && <div>Flooring: {x.flooring} {x.flooringNote && <span className="pp-note">{x.flooringNote}</span>}</div>}
              </> : null)}
              {row('LOP / COP', x.lopcop ? <b>{x.lopcop}</b> : null)}
              {row('Power Supply', <><div>Main: {x.powerMain}</div><div>Lighting: {x.powerLight}</div></>)}
            </tbody>
          </table>
          {features.length > 0 && <>
            <H>Key Features</H>
            <ul className="pp-ticks">{features.map((f) => <li key={f}>{f}</li>)}</ul>
          </>}
        </>)}

        {/* PAGE 3 — price & commercial terms */}
        {sheet(3, <>
          <H>Project Cost Summary</H>
          <table className="pp-cost">
            <thead><tr><th>Description</th><th className="r">Amount</th></tr></thead>
            <tbody>
              {items.map((it, i) => (
                <tr key={i}>
                  <td>{it.desc}{num(it.qty) > 1 && <span className="pp-note"> — {num(it.qty)} Nos × {inr(it.rate)}</span>}</td>
                  <td className="r"><b>{money(num(it.qty) * num(it.rate))}</b></td>
                </tr>
              ))}
              {num(q.discount) > 0 && <tr><td>Less: special discount</td><td className="r"><b>− {money(q.discount)}</b></td></tr>}
            </tbody>
            <tfoot>
              <tr><td><b>Total (excluding GST)</b><div className="pp-words">Rupees {titleCase(wordsUpper(subtotal))}</div></td><td className="r"><b className="pp-big">{money(subtotal)}</b></td></tr>
              <tr className="pp-gst"><td colSpan={2}>+ <b>{gstText}</b>{x.freightNote ? ` · ${x.freightNote}` : ''}</td></tr>
            </tfoot>
          </table>

          <H>Annual Maintenance Contract (AMC)</H>
          <p className="pp-tight">After the first 12 months of free maintenance, the AMC is applicable as follows:</p>
          <table className="pp-amc"><tbody>
            <tr><td>Without material</td><td className="r"><b>{x.amcWithout}%</b> of the order value per year</td></tr>
            <tr><td>Comprehensive</td><td className="r"><b>{x.amcComp}%</b> of the order value per year</td></tr>
          </tbody></table>
          <p className="pp-small">The AMC covers routine maintenance, periodic inspections and servicing for smooth and safe operation. Detailed AMC terms and scope are provided at the time of the AMC agreement.</p>

          <H>Commercial Terms</H>
          <div className="pp-terms-grid">
            <div>
              <div className="pp-h3">Payment Terms</div>
              <table className="pp-pay"><tbody>{(x.payTerms || []).map((t, i) => <tr key={i}><td className="pct">{t.percent}%</td><td>{t.label}</td></tr>)}</tbody></table>
            </div>
            <div>
              <div className="pp-h3">Delivery Timeline</div>
              <p className="pp-small">{x.delivery}</p>
              <div className="pp-h3">Warranty &amp; Maintenance</div>
              <ul className="pp-list">{(x.warranty || []).filter((w) => w.trim()).map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          </div>
        </>)}

        {/* PAGE 4 — scope, terms, sign-off, bank */}
        {sheet(4, <>
          <H>Scope of Work</H>
          <div className="pp-scope">
            <div>
              <div className="pp-h3">Our Scope</div>
              <ul className="pp-ticks one">{(x.ourScope || []).filter((s) => s.trim()).map((s, i) => <li key={i}>{s}</li>)}</ul>
            </div>
            <div>
              <div className="pp-h3">Client Scope</div>
              <ol className="pp-ol">{clientScope.map((s) => <li key={s}>{s}</li>)}</ol>
            </div>
          </div>
          <H>Important Terms &amp; Conditions</H>
          <ul className="pp-list">{(x.terms || []).filter((t) => t.trim()).map((t, i) => <li key={i}>{boldPart(t, /(\d+ days)/)}</li>)}</ul>
          <div className="pp-signoff">
            <div className="pp-sbox">
              <div className="pp-lbl"><b>For {company.shortName || company.name}</b></div>
              <div className="pp-sig">{company.signature && <img src={company.signature} alt="Authorised signature" />}</div>
              <div className="pp-cap">Authorised Signatory</div>
            </div>
            <div className="pp-sbox">
              <div className="pp-lbl"><b>Accepted by Client</b></div>
              <div className="pp-sig" />
              <div className="pp-cap">Signature with seal &amp; date</div>
            </div>
          </div>
          {company.bank && (
            <div className="pp-bank">
              <div className="pp-bank-h">Our Bank Details</div>
              {company.bank.split('\n').filter(Boolean).map((l, i) => <div key={i}>{l}</div>)}
            </div>
          )}
        </>)}
      </div>
    </PrintFrame>
  );
}
