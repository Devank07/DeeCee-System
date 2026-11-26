import { VersionTag } from '../version';
import { t, getLang, setLang } from '../i18n';
import { InstallButton } from '../pwa';
// Client portal — phone-first. Home · Progress · Documents · Payments · Service
import React, { useEffect, useMemo, useState } from 'react';
import { logoUrl, useCol, Badge, Empty, Modal, Field, Select, useForm, act, PrintDoc, PrintFrame, useSettings, ProgressBar, toast, WaIcon } from '../ui';
import { addDoc, updateDoc, nextNumber, backend, fetchFileBlob } from '../data';
import { inr, fmtDate, fmtDateTime, num, sum, daysUntil, waLink, compressImage, today, amountInWords } from '../utils';
import { steps, progressPct, milestoneStatus, quoteTotal } from '../workflow';
import { SITE_CHECKLIST, INSTALL_STEPS, PAY_MODES } from '../constants';
import { invStatus } from './Billing';
import ProposalDoc from './ProposalDoc';

/* What each stage means for the client, and what (if anything) they need to do */
const STEP_INFO = {
  quote: { text: 'Our proposal with the lift specifications and price.' },
  order: { text: 'Your order is booked and your project file is opened.' },
  advance: { text: 'The advance payment starts the drawing and the manufacturing of your lift.', you: 'Pay the advance and send us the payment details.' },
  drawing: { text: 'Our drawing team prepares the lift layout drawing (GA drawing) for your approval.', you: 'Check the drawing, then approve it or ask for changes.' },
  site: { text: 'The shaft, pit, machine room / top and power supply must be ready before material arrives.', you: 'Get the site ready as per the checklist and tell us.' },
  dispatch: { text: 'Your lift material is manufactured, packed and sent to your site.' },
  install: { text: 'Our installation team fits the rails, machine, cabin, doors and wiring, then tests the lift.' },
  handover: { text: 'Final testing, lift licence and handover of keys, manuals and warranty.', you: 'Receive the lift and sign the handover.' },
};
const COMPLAINT_FLOW = ['Open', 'Assigned', 'In Progress', 'Resolved'];

const ACCEPTED = { ids: new Set() };
const quoteAccepted = (p) => ACCEPTED.ids.has(p.id);

/* ---------- small icons ---------- */
const I = {
  home: <path d="M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  progress: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
  docs: <path d="M7 3h7l5 5v12a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM14 3v5h5M9 13h6M9 17h6" />,
  pay: <path d="M3 7h18v12H3zM3 11h18M7 15h3" />,
  service: <path d="M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z" />,
  phone: <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2" />,
  chat: <path d="M4 5h16v11H8l-4 4z" />,
  alert: <path d="M12 3 2 20h20zM12 10v4M12 17v.5" />,
  check: <path d="m5 12 5 5L20 7" />,
};
const Ico = ({ n, size = 20 }) => <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{I[n]}</svg>;

function Ring({ pct, size = 104 }) {
  const r = (size - 12) / 2, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="ring" aria-label={pct + '% complete'}>
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-bg" />
      <circle cx={size / 2} cy={size / 2} r={r} className="ring-fg" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle">{pct}%</text>
    </svg>
  );
}

const TABS = [['home', 'Home'], ['progress', 'Progress'], ['docs', 'Documents'], ['pay', 'Payments'], ['service', 'Service']];

export default function Portal({ user }) {
  const cid = user.clientId || '_none_';
  const company = useSettings();
  const all = useCol('projects', [['clientId', '==', cid]]);
  const projects = useMemo(() => all.filter((p) => !['Lost', 'Cancelled'].includes(p.status) && (p.orderConfirmedAt || quoteTotal(p) > 0))
    .sort((a, b) => (a.status === 'Order' ? 0 : a.status === 'Enquiry' ? 1 : 2) - (b.status === 'Order' ? 0 : b.status === 'Enquiry' ? 1 : 2) || (b.orderConfirmedAt || 0) - (a.orderConfirmedAt || 0)), [all]);
  const orders = projects.filter((p) => ['Order', 'Completed', 'On Hold'].includes(p.status));
  const invoices = useCol('invoices', [['clientId', '==', cid]]).filter((i) => i.status !== 'Cancelled');
  const payments = useCol('payments', [['clientId', '==', cid]]);
  const amcs = useCol('amcs', [['clientId', '==', cid]]);
  const complaints = useCol('complaints', [['clientId', '==', cid]]);
  const visits = useCol('visits', [['clientId', '==', cid]]);
  const activity = useCol('activity', [['clientId', '==', cid], ['visibleToClient', '==', true]]);
  const files = useCol('files', [['clientId', '==', cid], ['visibleToClient', '==', true]]).filter((f) => !f.uploading);
  const requests = useCol('clientRequests', [['clientId', '==', cid]]);
  const [tab, setTabRaw] = useState(() => { try { return sessionStorage.getItem('portalTab') || 'home'; } catch { return 'home'; } });
  const setTab = (t) => { setTabRaw(t); try { sessionStorage.setItem('portalTab', t); } catch { /* ignore */ } window.scrollTo(0, 0); };
  const [pid, setPid] = useState(null);
  const [m, setM] = useState(null); // modal
  const p = projects.find((x) => x.id === pid) || projects[0] || null;
  useEffect(() => { if (!pid && projects[0]) setPid(projects[0].id); }, [projects, pid]);
  useEffect(() => { window.scrollTo(0, 0); }, []);

  ACCEPTED.ids = new Set(requests.filter((r) => r.type === 'quote').map((r) => r.projectId));
  const ctx = { user, cid, company, projects, orders, invoices, payments, amcs, complaints, visits, activity, files, requests, p, setPid, setTab, setM };
  const contacts = p?.contacts || {};
  const officePhone = company.phone;
  const [, setL] = useState(getLang());
  const toggleLang = () => { const n = getLang() === 'hi' ? 'en' : 'hi'; setLang(n); setL(n); };
  const newReplies = activity.filter((a) => a.kind === 'reply' && Date.now() - a.at < 3 * 86400000).length;

  return (
    <div className="portal">
      <header className="portal-head">
        <div className="brand"><img src={logoUrl} alt="" className="brand-logo" /><div><b>Dee Cee Elevators</b><span>{t("Customer portal")}</span></div></div>
        <nav className="portal-tabs" aria-label="Portal sections">
          {TABS.map(([k, l]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}><Ico n={k} size={18} /><span>{t(l)}</span>{k === 'home' && newReplies > 0 && <i className="dotb" />}</button>)}
        </nav>
        <div className="row gap portal-head-r">
          <InstallButton />
          <button className="btn ghost sm lang-btn" onClick={toggleLang}>{getLang() === 'hi' ? 'EN' : 'हिंदी'}</button>
          {officePhone && <a className="btn ghost sm" href={'tel:' + officePhone}><Ico n="phone" size={15} /> <span className="hide-sm">{t("Call us")}</span></a>}
          <button className="btn ghost sm" onClick={() => backend().logout()}>{t("Sign out")}</button>
        </div>
      </header>

      <main className="portal-body">
        {projects.length > 1 && ['home', 'progress'].includes(tab) && (
          <div className="proj-chips">{projects.map((x) => <button key={x.id} className={x.id === p?.id ? 'on' : ''} onClick={() => setPid(x.id)}>{x.title || x.code}<span>{x.status === 'Enquiry' ? 'Proposal' : x.code}</span></button>)}</div>
        )}
        {tab === 'home' && <Home {...ctx} contacts={contacts} />}
        {tab === 'progress' && <Progress {...ctx} />}
        {tab === 'docs' && <Documents {...ctx} />}
        {tab === 'pay' && <Payments {...ctx} />}
        {tab === 'service' && <Service {...ctx} />}
        <div className="portal-foot">{company.name || 'Dee Cee Elevators'} · <VersionTag /></div>
      </main>

      {m?.t === 'payment' && <PaymentProof {...ctx} preset={m} onClose={() => setM(null)} />}
      {m?.t === 'site' && <SiteReady p={m.p} user={user} onClose={() => setM(null)} />}
      {m?.t === 'message' && <MessageForm {...ctx} preset={m} onClose={() => setM(null)} />}
      {m?.t === 'drawing' && <DrawingReview file={m.file} p={m.p} decision={m.decision} user={user} onClose={() => setM(null)} />}
      {m?.t === 'complaint' && <RaiseComplaint user={user} amcs={amcs} projects={orders} onClose={() => setM(null)} />}
      {m?.t === 'rate' && <Rate col={m.col} doc={m.doc} onClose={() => setM(null)} />}
      {m?.t === 'quote' && <ProposalDoc p={m.p} clientView onClose={() => setM(null)} />}
      {m?.t === 'accept' && <AcceptQuote p={m.p} user={user} onClose={() => setM(null)} />}
      {m?.t === 'invoice' && <PrintDoc kind="Tax Invoice" doc={m.doc} company={company} onClose={() => setM(null)} />}
      {m?.t === 'receipt' && <Receipt pay={m.doc} company={company} user={user} onClose={() => setM(null)} />}
    </div>
  );
}

/* ================= HOME ================= */
function Home({ user, company, projects, invoices, payments, complaints, activity, files, requests, p, setTab, setM, contacts }) {
  const pending = (type, f = () => true) => requests.some((r) => r.type === type && r.status === 'New' && f(r));
  const todos = [];
  if (p && p.status === 'Order') {
    const st = Object.fromEntries(steps(p).map((s) => [s.key, s]));
    if (!st.advance.done) {
      const ms = p.milestones?.[0];
      todos.push(pending('payment', (r) => r.projectId === p.id)
        ? { tone: 'grey', title: 'Advance payment details sent', text: 'Our accounts team is confirming it.' }
        : { tone: 'amber', title: 'Pay the advance', text: ms ? `${ms.name}: ${inr(ms.amount)}` : 'Advance as per the order', btn: 'I have paid', go: () => setM({ t: 'payment', projectId: p.id, milestone: 0, amount: ms?.amount }) });
    }
    const latest = files.filter((f) => f.projectId === p.id && f.kind === 'Drawing').sort((a, b) => b.at - a.at)[0];
    if (latest && p.drawing?.status !== 'Approved') {
      todos.push(pending('drawing', (r) => r.fileId === latest.id)
        ? { tone: 'grey', title: 'Drawing feedback sent', text: 'Our drawing team will reply soon.' }
        : { tone: 'amber', title: 'Approve your drawing', text: `${latest.title || latest.name} · Rev ${latest.rev}`, btn: 'Review', go: () => setTab('docs') });
    }
    if (st.order.done && !st.site.done) {
      todos.push(pending('site', (r) => r.projectId === p.id)
        ? { tone: 'grey', title: 'Site-ready report sent', text: 'Our installation team will verify it.' }
        : { tone: p.site?.status === 'Not ready' ? 'red' : 'amber', title: 'Get your site ready', text: p.site?.status === 'Not ready' ? `Our team found: ${p.site?.notes || 'some work pending'}` : 'Shaft, pit, hook, openings & power', btn: 'Site is ready', go: () => setM({ t: 'site', p }) });
    }
  }
  invoices.filter((i) => num(i.total) - num(i.paid) > 0.5 && (!p || !i.projectId || i.projectId === p.id)).slice(0, 2).forEach((i) => todos.push(
    pending('payment', (r) => r.invoiceId === i.id)
      ? { tone: 'grey', title: `Payment details sent for ${i.number}`, text: 'Being confirmed by accounts.' }
      : { tone: invStatus(i) === 'Overdue' ? 'red' : 'amber', title: `Invoice ${i.number} — ${inr(num(i.total) - num(i.paid))} due`, text: i.dueDate ? 'Due ' + fmtDate(i.dueDate) : '', btn: 'Pay / send details', go: () => setM({ t: 'payment', invoiceId: i.id, projectId: i.projectId, amount: num(i.total) - num(i.paid) }) }));
  complaints.filter((c) => ['Resolved', 'Closed'].includes(c.status) && !c.rating && c.resolvedAt && Date.now() - c.resolvedAt < 30 * 86400000).slice(0, 1).forEach((c) => todos.push({ tone: 'blue', title: 'How did we do?', text: `Rate the fix for “${c.issue}”`, btn: 'Rate', go: () => setM({ t: 'rate', col: 'complaints', doc: c }) }));

  const st = p ? steps(p) : [];
  const cur = st.find((s) => !s.done);
  const pct = p ? (p.status === 'Enquiry' ? 0 : progressPct(p)) : 0;
  const myUpdates = activity.filter((a) => !p || !a.projectId || a.projectId === p.id).sort((a, b) => b.at - a.at);
  const paid = p ? sum(payments.filter((x) => x.projectId === p.id), 'amount') : 0;

  return (<>
    <h1 className="portal-hello">{t('Namaste')}{(p?.contactPerson || user.name) ? ', ' + (p?.contactPerson || user.name) : ''}</h1>
    {(projects.find((x) => x.clientNo)?.clientNo || user.phone) && <div className="portal-id">{projects.find((x) => x.clientNo)?.clientNo && <span>{t('Client No.')} <b>{projects.find((x) => x.clientNo).clientNo}</b></span>}{user.phone && <span>📱 {user.phone}</span>}</div>}
    {!p ? <div className="p-card"><Empty>{t("Your project will appear here once your order is booked.")}</Empty></div> : (
      <section className="hero">
        <div className="hero-top">
          <div className="grow">
            <div className="hero-k">{t(p.status === 'Enquiry' ? 'Proposal' : p.status === 'Completed' ? 'Handed over' : p.status === 'On Hold' ? 'On hold' : 'In progress')} · {p.code || p.quote?.refNo || p.quoteNo}</div>
            <h2>{p.title}</h2>
            <div className="hero-addr">{(p.siteAddress || '').split('\n')[0]}</div>
          </div>
          {p.status !== 'Enquiry' && <Ring pct={pct} />}
        </div>
        {p.status === 'Enquiry' ? (
          <div className="hero-now">
            <div><span>{t("Proposal")}</span><b>{p.quote?.refNo || p.quoteNo}</b></div>
            <div><span>{t("Amount")}</span><b>{inr(quoteTotal(p))} <small>{t("incl. GST")}</small></b></div>
            <button className="btn hero-btn" onClick={() => setM({ t: 'quote', p })}>{t("View proposal")}</button>
            {quoteAccepted(p) ? <span className="hero-note">✓ {t('Acceptance sent — we will confirm your order')}</span> : <button className="btn hero-btn accept" onClick={() => setM({ t: 'accept', p })}>✍️ {t('Accept quotation')}</button>}
          </div>
        ) : (
          <div className="hero-now">
            <div><span>{t("Now")}</span><b>{cur ? t(cur.label) : t('Handed over') + ' 🎉'}</b>{cur && <small>{t(STEP_INFO[cur.key].text)}</small>}</div>
            {p.status === 'Order' && p.expectedHandover && <div><span>{t("Target handover")}</span><b>{fmtDate(p.expectedHandover)}</b></div>}
            {p.handoverAt && <div><span>{t("Handed over")}</span><b>{fmtDate(p.handoverAt)}</b></div>}
            {num(p.contractValue) > 0 && <div><span>{t("Paid")}</span><b>{inr(paid)} <small>of {inr(p.contractValue)}</small></b></div>}
          </div>
        )}
        {p.status !== 'Enquiry' && <button className="hero-link" onClick={() => setTab('progress')}>{t("See all stages ›")}</button>}
      </section>
    )}

    {todos.length > 0 && (
      <section className="p-card">
        <h3 className="p-h">{t("Needs your attention")}</h3>
        <ul className="todo">{todos.map((td, i) => (
          <li key={i} className={'t-' + td.tone}><span className="t-dot" /><div className="grow"><b>{t(td.title)}</b>{td.text && <div className="muted small">{t(td.text)}</div>}</div>{td.btn && <button className="btn sm" onClick={td.go}>{t(td.btn)}</button>}</li>
        ))}</ul>
      </section>
    )}

    <section className="quick">
      <button onClick={() => setM({ t: 'payment', projectId: p?.status === 'Order' ? p.id : '' })}><Ico n="pay" /><span>{t("Send payment details")}</span></button>
      <button onClick={() => setM({ t: 'message', projectId: p?.id || '' })}><Ico n="chat" /><span>{t("Message our team")}</span></button>
      <button onClick={() => setTab('docs')}><Ico n="docs" /><span>{t("Quotes, drawings & invoices")}</span></button>
      <button className="q-red" onClick={() => setM({ t: 'complaint' })}><Ico n="alert" /><span>{t("Report a lift problem")}</span></button>
    </section>

    <section className="p-card">
      <h3 className="p-h">{t("Your Dee Cee team")}</h3>
      <div className="contacts">
        {contacts.sales?.name && <Contact role={t("Your sales contact")} c={contacts.sales} msg={`Hello ${contacts.sales.name}, this is ${user.name} regarding ${p?.title || 'my lift'} (${p?.code || p?.quoteNo || ''}).`} />}
        {(contacts.lead?.name || contacts.lead?.team) && p?.status !== 'Enquiry' && <Contact role={`${t('Site team leader')}${contacts.lead.team ? ' · ' + contacts.lead.team : ''}`} c={contacts.lead} msg={`Hello, this is ${user.name} regarding the lift work at ${(p?.siteAddress || '').split('\n')[0]}.`} />}
        <Contact role={t("Office & service helpline")} c={{ name: company.name || 'Dee Cee Elevators', phone: company.phone, email: company.email }} msg={`Hello, this is ${user.name}.`} />
      </div>
    </section>

    <section className="p-card">
      <div className="row between"><h3 className="p-h">{t("Latest updates")}</h3>{myUpdates.length > 3 && <button className="link-btn" onClick={() => setTab('progress')}>{t("See all")}</button>}</div>
      {myUpdates.length === 0 ? <p className="muted small">{t("Updates from our team will appear here.")}</p> : <Timeline items={myUpdates.slice(0, 3)} />}
    </section>
    {p && <Photos cid={user.clientId} pid={p.id} limit={6} />}
  </>);
}

function Contact({ role, c, msg }) {
  const initials = (c.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <div className="contact">
      <span className="avatar">{initials}</span>
      <div className="grow"><div className="muted small">{role}</div><b>{c.name || '—'}</b>{c.designation && <div className="muted small">{c.designation}</div>}</div>
      {c.phone && <a className="icon-act" href={'tel:' + c.phone} aria-label={'Call ' + c.name}><Ico n="phone" size={18} /></a>}
      {c.phone && <a className="icon-act wa" href={waLink(c.phone, msg)} target="_blank" rel="noreferrer" aria-label={'WhatsApp ' + c.name}><WaIcon /></a>}
    </div>
  );
}

function Timeline({ items }) {
  return <ul className="p-feed">{items.map((a) => <li key={a.id} className={a.kind === 'reply' ? 'reply' : ''}><span className="pf-dot" /><div><div className="pf-text">{a.text}</div><div className="muted small">{a.byName || 'Dee Cee'} · {fmtDateTime(a.at)}</div></div></li>)}</ul>;
}

function Photos({ cid, pid, limit }) {
  const photos = useCol('photos', [['clientId', '==', cid], ['projectId', '==', pid], ['visibleToClient', '==', true]]);
  const [open, setOpen] = useState(null);
  if (!photos.length) return null;
  const list = [...photos].sort((a, b) => b.at - a.at).slice(0, limit || 60);
  return (
    <section className="p-card">
      <h3 className="p-h">{t("Site photos")} <span className="muted small">({photos.length})</span></h3>
      <div className="p-photos">{list.map((ph) => <img key={ph.id} src={ph.data} alt="Site" onClick={() => setOpen(ph)} />)}</div>
      {open && <div className="lightbox" onClick={() => setOpen(null)}><img src={open.data} alt="" /><span>{open.caption || ''} {fmtDateTime(open.at)}</span></div>}
    </section>
  );
}

/* ================= PROGRESS (workflow) ================= */
function Progress({ user, activity, requests, p, setM }) {
  if (!p) return <div className="p-card"><Empty>{t("No project yet")}</Empty></div>;
  if (p.status === 'Enquiry') return <div className="p-card"><p>{t("This is a proposal. Once you confirm the order, every stage of your lift will be tracked here.")}</p><button className="btn" onClick={() => setM({ t: 'quote', p })}>{t("View proposal")}</button></div>;
  const st = steps(p);
  const curIdx = st.findIndex((s) => !s.done);
  const pend = (type) => requests.some((r) => r.type === type && r.status === 'New' && r.projectId === p.id);
  const action = {
    advance: !pend('payment') && { label: 'Send payment details', go: () => setM({ t: 'payment', projectId: p.id, milestone: 0, amount: p.milestones?.[0]?.amount }) },
    site: !pend('site') && { label: 'Tell us the site is ready', go: () => setM({ t: 'site', p }) },
  };
  const items = activity.filter((a) => !a.projectId || a.projectId === p.id).sort((a, b) => b.at - a.at);
  return (<>
    <section className="p-card">
      <div className="row between"><h3 className="p-h">{p.title}</h3><Badge tone={p.status === 'Completed' ? 'green' : 'blue'}>{progressPct(p)}% {t('complete')}</Badge></div>
      <ol className="vsteps">
        {st.map((s, i) => {
          const state = s.done ? 'done' : i === curIdx ? 'now' : 'later';
          const info = STEP_INFO[s.key];
          return (
            <li key={s.key} className={state}>
              <span className="vs-dot">{s.done ? <Ico n="check" size={14} /> : i + 1}</span>
              <div className="vs-body">
                <div className="vs-title"><b>{t(s.label)}</b><span className="muted small">{s.done ? (s.at ? fmtDate(s.at) : t('Done')) : i === curIdx ? t('In progress') : ''}</span></div>
                {(state !== 'later') && <div className="muted small">{t(info.text)}</div>}
                {s.detail && <div className="small">{s.detail}</div>}
                {s.key === 'site' && p.site?.status === 'Not ready' && <div className="small danger-text">Not ready yet{p.site?.notes ? ': ' + p.site.notes : ''}</div>}
                {s.key === 'install' && (state === 'now' || (p.install?.progress > 0 && !s.done)) && (
                  <div className="vs-sub"><ProgressBar value={p.install?.progress || 0} tone="green" />
                    <ul>{INSTALL_STEPS.map((x) => <li key={x} className={p.install?.steps?.[x] ? 'ok' : ''}>{p.install?.steps?.[x] ? '✓' : '○'} {t(x)}</li>)}</ul></div>
                )}
                {state === 'now' && info.you && <div className="vs-you"><b>{t("Your part:")}</b> {t(info.you)}{action[s.key] && <button className="btn sm" onClick={action[s.key].go}>{t(action[s.key].label)}</button>}{s.key === 'drawing' && <span className="muted small"> {t("Open the Documents tab.")}</span>}</div>}
                {state === 'now' && !info.you && <div className="vs-who">{getLang() === 'hi' ? `हमारी ${s.team} टीम के पास` : `With our ${s.team} team`}</div>}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
    {(p.licence?.status && p.licence.status !== 'Not required') && (
      <section className="p-card"><div className="row between"><h3 className="p-h">{t("Lift licence")}</h3><Badge tone={p.licence.status === 'Issued' ? 'green' : 'amber'}>{p.licence.status}</Badge></div>
        <div className="muted small">{[p.licence.number && 'No. ' + p.licence.number, p.licence.issuedOn && 'issued ' + fmtDate(p.licence.issuedOn), p.licence.validTill && 'valid till ' + fmtDate(p.licence.validTill)].filter(Boolean).join(' · ') || 'Our team is handling the licence for you.'}</div></section>
    )}
    <Photos cid={user.clientId} pid={p.id} />
    <section className="p-card"><h3 className="p-h">{t("All updates")}</h3>{items.length ? <Timeline items={items.slice(0, 80)} /> : <p className="muted small">{t("No updates yet")}</p>}</section>
  </>);
}

/* ================= DOCUMENTS ================= */
async function openFile(f, download) {
  try {
    const blob = await fetchFileBlob(f);
    const url = URL.createObjectURL(blob);
    if (download) { const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); } else window.open(url, '_blank', 'noopener');
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) { toast('Could not open the file. Please try again.', 'err'); }
}

function Documents({ projects, invoices, payments, files, requests, setM }) {
  const [busy, setBusy] = useState(null);
  const byP = Object.fromEntries(projects.map((x) => [x.id, x]));
  const drawings = files.filter((f) => f.kind === 'Drawing').sort((a, b) => b.at - a.at);
  const latestOf = {};
  drawings.forEach((f) => { if (!latestOf[f.projectId]) latestOf[f.projectId] = f.id; });
  const others = files.filter((f) => f.kind !== 'Drawing').sort((a, b) => b.at - a.at);
  const run = async (f, dl) => { setBusy(f.id + dl); await openFile(f, dl); setBusy(null); };
  const FileRow = ({ f, children }) => (
    <li className="doc">
      <span className={'doc-ico ' + (f.type === 'application/pdf' ? 'pdf' : 'img')}>{f.type === 'application/pdf' ? 'PDF' : f.type?.startsWith('image/') ? 'IMG' : 'DOC'}</span>
      <div className="grow"><b>{f.title || f.name}</b><div className="muted small">{byP[f.projectId]?.code || ''} · {fmtDate(f.at)}</div>{children}</div>
      <div className="doc-btns">
        <button className="btn ghost sm" disabled={!!busy} onClick={() => run(f, false)}>{busy === f.id + false ? '…' : 'Open'}</button>
        <button className="btn ghost sm" disabled={!!busy} onClick={() => run(f, true)}>{t("Download")}</button>
      </div>
    </li>
  );
  return (<>
    <section className="p-card">
      <h3 className="p-h">{t("Quotations")}</h3>
      {projects.length === 0 ? <p className="muted small">{t("No quotations yet")}</p> : (
        <ul className="docs">{projects.map((x) => (
          <React.Fragment key={x.id}>
            <li className="doc">
              <span className="doc-ico q">QT</span>
              <div className="grow"><b>{x.quote?.refNo || x.quoteNo}</b><div className="muted small">{x.title} · {fmtDate(x.quote?.date)} · {inr(quoteTotal(x))} incl. GST</div>{x.status !== 'Enquiry' && <Badge tone="green">{t("Order confirmed")}</Badge>}</div>
              <div className="doc-btns"><button className="btn sm" onClick={() => setM({ t: 'quote', p: x })}>{t("View / PDF")}</button>{x.status === 'Enquiry' && (quoteAccepted(x) ? <Badge tone="green">{t('Acceptance sent')}</Badge> : <button className="btn sm green-btn" onClick={() => setM({ t: 'accept', p: x })}>{t('Accept')}</button>)}</div>
            </li>
            {(x.revisions || []).filter((r) => r.refNo !== (x.quote?.refNo || x.quoteNo)).reverse().map((r, i) => (
              <li className="doc old" key={i}><span className="doc-ico q">QT</span><div className="grow"><b>{r.refNo}</b><div className="muted small">{t('Earlier version')} · {fmtDate(r.quote?.date)}</div></div>
                <div className="doc-btns"><button className="btn ghost sm" onClick={() => setM({ t: 'quote', p: { ...x, ...r } })}>{t("View")}</button></div></li>
            ))}
          </React.Fragment>
        ))}</ul>
      )}
    </section>

    <section className="p-card">
      <h3 className="p-h">{t("Drawings")}</h3>
      {drawings.length === 0 ? <p className="muted small">{t("Your lift drawing will appear here once it is issued.")}</p> : (
        <ul className="docs">{drawings.map((f) => {
          const latest = latestOf[f.projectId] === f.id;
          const proj = byP[f.projectId];
          const myReq = requests.filter((r) => r.type === 'drawing' && r.fileId === f.id).sort((a, b) => b.at - a.at)[0];
          const approved = proj?.drawing?.status === 'Approved' && latest;
          return (
            <FileRow key={f.id} f={f}>
              <div className="row gap wrap mt-s">
                <Badge tone={latest ? 'blue' : 'grey'}>Rev {f.rev}{latest ? ' · latest' : ''}</Badge>
                {approved && <Badge tone="green">{t("Approved")}</Badge>}
                {!approved && myReq && <Badge tone={myReq.decision === 'Approved' ? 'green' : 'amber'}>You: {myReq.decision}</Badge>}
              </div>
              {latest && !approved && !(myReq && myReq.status === 'New') && proj?.status === 'Order' && (
                <div className="row gap wrap mt-s">
                  <button className="btn sm green-btn" onClick={() => setM({ t: 'drawing', file: f, p: proj, decision: 'Approved' })}>{t("✓ Approve drawing")}</button>
                  <button className="btn ghost sm" onClick={() => setM({ t: 'drawing', file: f, p: proj, decision: 'Changes requested' })}>{t("Ask for changes")}</button>
                </div>
              )}
            </FileRow>
          );
        })}</ul>
      )}
    </section>

    <section className="p-card">
      <h3 className="p-h">{t("Invoices")}</h3>
      {invoices.length === 0 ? <p className="muted small">{t("No invoices yet")}</p> : (
        <ul className="docs">{[...invoices].sort((a, b) => (a.date < b.date ? 1 : -1)).map((i) => (
          <li className="doc" key={i.id}><span className="doc-ico inv">INV</span>
            <div className="grow"><b>{i.number}</b><div className="muted small">{fmtDate(i.date)} · {inr(i.total)}</div><Badge>{invStatus(i)}</Badge></div>
            <div className="doc-btns"><button className="btn ghost sm" onClick={() => setM({ t: 'invoice', doc: i })}>{t("View / PDF")}</button></div></li>
        ))}</ul>
      )}
    </section>

    <section className="p-card">
      <h3 className="p-h">{t("Payment receipts")}</h3>
      {payments.length === 0 ? <p className="muted small">{t("Receipts appear here for every payment we receive.")}</p> : (
        <ul className="docs">{[...payments].sort((a, b) => (a.date < b.date ? 1 : -1)).map((x) => (
          <li className="doc" key={x.id}><span className="doc-ico rc">RCT</span>
            <div className="grow"><b>{inr(x.amount)}</b><div className="muted small">{fmtDate(x.date)} · {x.mode}{x.invoiceNumber ? ' · ' + x.invoiceNumber : ''}</div></div>
            <div className="doc-btns"><button className="btn ghost sm" onClick={() => setM({ t: 'receipt', doc: x })}>{t("Receipt")}</button></div></li>
        ))}</ul>
      )}
    </section>

    <section className="p-card">
      <h3 className="p-h">{t("Other documents")}</h3>
      {others.length === 0 ? <p className="muted small">{t("Handover papers, licences, warranty and other files will appear here.")}</p> : <ul className="docs">{others.map((f) => <FileRow key={f.id} f={f} />)}</ul>}
    </section>
  </>);
}

/* ================= PAYMENTS ================= */
function Payments({ company, orders, invoices, payments, requests, setM }) {
  const value = sum(orders, 'contractValue');
  const paid = sum(payments, 'amount');
  const due = invoices.filter((i) => num(i.total) - num(i.paid) > 0.5);
  const sent = requests.filter((r) => r.type === 'payment').sort((a, b) => b.at - a.at);
  const copy = (t) => { try { navigator.clipboard.writeText(t); toast('Copied'); } catch { /* ignore */ } };
  return (<>
    {orders.length > 0 && (
      <section className="p-card">
        <div className="pay-sum">
          <div><span>{t("Order value")}</span><b>{inr(value)}</b></div>
          <div><span>{t("Paid")}</span><b className="ok-text">{inr(paid)}</b></div>
          <div><span>{t("Balance")}</span><b>{inr(Math.max(0, value - paid))}</b></div>
        </div>
        <ProgressBar value={(paid / (value || 1)) * 100} tone="green" />
      </section>
    )}
    <button className="btn wide big" onClick={() => setM({ t: 'payment' })}>{t("I have made a payment — send details")}</button>

    {due.length > 0 && (
      <section className="p-card">
        <h3 className="p-h">{t("Invoices to pay")}</h3>
        <ul className="docs">{due.map((i) => (
          <li className="doc" key={i.id}><span className="doc-ico inv">INV</span>
            <div className="grow"><b>{i.number} · {inr(num(i.total) - num(i.paid))}</b><div className="muted small">{i.dueDate ? 'Due ' + fmtDate(i.dueDate) : fmtDate(i.date)}</div><Badge>{invStatus(i)}</Badge></div>
            <div className="doc-btns"><button className="btn ghost sm" onClick={() => setM({ t: 'invoice', doc: i })}>{t("View")}</button><button className="btn sm" onClick={() => setM({ t: 'payment', invoiceId: i.id, projectId: i.projectId, amount: num(i.total) - num(i.paid) })}>{t("Paid?")}</button></div></li>
        ))}</ul>
      </section>
    )}

    {company.bank && (
      <section className="p-card">
        <div className="row between"><h3 className="p-h">{t("Pay by bank transfer")}</h3><button className="btn ghost sm" onClick={() => copy(company.bank)}>{t("Copy")}</button></div>
        <div className="bank pre">{company.bank}</div>
        <p className="muted small">{t("After paying, tap “send details” above with the UTR / cheque number so we can confirm it quickly.")}</p>
      </section>
    )}

    {orders.map((p) => {
      const pp = payments.filter((x) => x.projectId === p.id);
      const paidFor = (i) => sum(pp.filter((x) => x.milestone === i), 'amount');
      if (!(p.milestones || []).length) return null;
      return (
        <section className="p-card" key={p.id}>
          <h3 className="p-h">{p.title} <span className="muted small">{p.code}</span></h3>
          <ul className="ms">{p.milestones.map((m, i) => {
            const s = milestoneStatus(m, paidFor(i));
            return <li key={i} className={s === 'Paid' ? 'paid' : ''}><span className="ms-dot" /><div className="grow"><b>{m.name}</b><div className="muted small">{m.percent}% · {inr(m.amount)}{paidFor(i) > 0 && s !== 'Paid' ? ` · ${inr(paidFor(i))} received` : ''}</div></div><Badge>{s}</Badge></li>;
          })}</ul>
        </section>
      );
    })}

    {sent.length > 0 && (
      <section className="p-card">
        <h3 className="p-h">{t("Payment details you sent")}</h3>
        <ul className="docs">{sent.map((r) => <li key={r.id} className="doc"><div className="grow"><b>{inr(r.amount)}</b> <span className="muted small">{fmtDate(r.date)} · {r.mode}{r.ref ? ' · ' + r.ref : ''}</span>{r.reply && <div className="small">{r.reply}</div>}</div><Badge tone={r.status === 'New' ? 'amber' : 'green'}>{t(r.status === 'New' ? 'Being confirmed' : 'Confirmed')}</Badge></li>)}</ul>
      </section>
    )}

    <section className="p-card">
      <h3 className="p-h">{t("Payments received")}</h3>
      {payments.length === 0 ? <p className="muted small">{t("No payments yet")}</p> : (
        <ul className="docs">{[...payments].sort((a, b) => (a.date < b.date ? 1 : -1)).map((x) => <li key={x.id} className="doc"><div className="grow"><b>{inr(x.amount)}</b><div className="muted small">{fmtDate(x.date)} · {x.mode}</div></div><button className="btn ghost sm" onClick={() => setM({ t: 'receipt', doc: x })}>{t("Receipt")}</button></li>)}</ul>
      )}
    </section>
  </>);
}

/* ================= SERVICE ================= */
function Service({ user, company, amcs, complaints, visits, requests, setM }) {
  const open = complaints.filter((c) => !['Resolved', 'Closed'].includes(c.status)).sort((a, b) => b.reportedAt - a.reportedAt);
  const past = complaints.filter((c) => ['Resolved', 'Closed'].includes(c.status)).sort((a, b) => (b.resolvedAt || b.reportedAt) - (a.resolvedAt || a.reportedAt));
  const done = visits.filter((v) => v.status === 'Done').sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const upcoming = visits.filter((v) => v.status !== 'Done' && v.status !== 'Cancelled').sort((a, b) => (a.date > b.date ? 1 : -1));
  const renewReq = (a) => requests.find((r) => r.type === 'amc' && r.amcId === a.id && r.status === 'New');
  const askRenew = (a) => act(() => addDoc('clientRequests', { type: 'amc', status: 'New', at: Date.now(), clientId: user.clientId, clientName: user.name, projectId: a.projectId || null, amcId: a.id, amcNumber: a.number, text: `Please renew AMC ${a.number} (${a.type}, ${a.lifts} lift(s)).` }), 'Renewal request sent');
  return (<>
    <button className="btn danger-btn wide big" onClick={() => setM({ t: 'complaint' })}>{t("🚨 Report a lift problem")}</button>
    {company.phone && <p className="muted small center">{t("Someone stuck inside the lift? Call us now:")} <a href={'tel:' + company.phone}><b>{company.phone}</b></a></p>}

    <section className="p-card">
      <h3 className="p-h">{t("Your complaints")}</h3>
      {open.length === 0 && <p className="muted small">{t("No open complaints.")}</p>}
      {open.map((c) => {
        const idx = Math.max(0, COMPLAINT_FLOW.indexOf(c.status));
        return (
          <div className="cmp" key={c.id}>
            <div className="row between"><b>{c.issue}</b><Badge tone={c.priority?.startsWith('Critical') ? 'red' : 'amber'}>{c.status}</Badge></div>
            <div className="muted small">{c.number} · {c.liftRef || ''} · reported {fmtDateTime(c.reportedAt)}</div>
            <ol className="cmp-track">{COMPLAINT_FLOW.map((s, i) => <li key={s} className={i <= idx ? 'on' : ''}><span />{t(s === 'Open' ? 'Received' : s)}</li>)}</ol>
            {c.teamName && <div className="small">{t("Attending:")} <b>{c.teamName}</b></div>}
          </div>
        );
      })}
      {past.length > 0 && (
        <details className="mt"><summary className="muted small">{t('Earlier complaints')} ({past.length})</summary>
          <ul className="docs">{past.map((c) => (
            <li key={c.id} className="doc"><div className="grow"><b>{c.issue}</b><div className="muted small">{c.number} · {fmtDate(c.resolvedAt || c.reportedAt)}{c.resolution ? ' · ' + c.resolution : ''}</div></div>
              {c.rating ? <span className="stars-s">{'★'.repeat(c.rating)}</span> : <button className="btn ghost sm" onClick={() => setM({ t: 'rate', col: 'complaints', doc: c })}>{t("Rate")}</button>}</li>
          ))}</ul>
        </details>
      )}
    </section>

    {amcs.length > 0 && (
      <section className="p-card">
        <h3 className="p-h">{t("Maintenance contract (AMC)")}</h3>
        {amcs.map((a) => {
          const d = daysUntil(a.end);
          const req = renewReq(a);
          return (
            <div className="amc" key={a.id}>
              <div className="row between"><b>{a.number}</b><Badge tone={d < 0 ? 'red' : d <= 30 ? 'amber' : 'green'}>{d < 0 ? 'Expired' : d <= 30 ? `Ends in ${d} days` : 'Active'}</Badge></div>
              <div className="muted small">{a.type} · {a.lifts} lift(s) · {fmtDate(a.start)} → {fmtDate(a.end)}{a.visitsPerYear ? ` · ${a.visitsPerYear} visits/year` : ''}</div>
              {d <= 45 && (req ? <p className="small ok-text">{t("Renewal requested — our team will contact you.")}</p> : <button className="btn sm mt-s" onClick={() => askRenew(a)}>{t("Request renewal")}</button>)}
            </div>
          );
        })}
      </section>
    )}

    {upcoming.length > 0 && (
      <section className="p-card"><h3 className="p-h">{t("Upcoming visits")}</h3>
        <ul className="docs">{upcoming.slice(0, 6).map((v) => <li key={v.id} className="doc"><div className="grow"><b>{v.type}</b><div className="muted small">{fmtDate(v.date)}{v.teamName ? ' · ' + v.teamName : ''}</div></div><Badge tone="blue">{v.status}</Badge></li>)}</ul>
      </section>
    )}

    <section className="p-card"><h3 className="p-h">{t("Service history")}</h3>
      {done.length === 0 ? <p className="muted small">{t("No visits yet")}</p> : (
        <ul className="docs">{done.slice(0, 30).map((v) => (
          <li key={v.id} className="doc"><div className="grow"><b>{v.type}</b><div className="muted small">{fmtDate(v.date)}{v.teamName ? ' · ' + v.teamName : ''}{v.notes ? ' · ' + v.notes : ''}</div></div>
            {v.rating ? <span className="stars-s">{'★'.repeat(v.rating)}</span> : <button className="btn ghost sm" onClick={() => setM({ t: 'rate', col: 'visits', doc: v })}>{t("Rate")}</button>}</li>
        ))}</ul>
      )}
    </section>
  </>);
}

/* ================= CLIENT FORMS ================= */
function ImagePicker({ images, setImages, max = 3, label = 'Add photo' }) {
  const add = async (e) => {
    const list = [...e.target.files].slice(0, max - images.length);
    e.target.value = '';
    try { const out = await Promise.all(list.map((f) => compressImage(f, 1000, 0.55))); setImages([...images, ...out].slice(0, max)); } catch { toast('Could not read that photo', 'err'); }
  };
  return (
    <div className="img-pick">
      {images.map((src, i) => <span key={i} className="thumb"><img src={src} alt="" /><button type="button" aria-label="Remove" onClick={() => setImages(images.filter((_, j) => j !== i))}>✕</button></span>)}
      {images.length < max && <label className="thumb add">＋<span>{label}</span><input type="file" accept="image/*" multiple hidden onChange={add} /></label>}
    </div>
  );
}

const sendReq = (user, data) => addDoc('clientRequests', { status: 'New', at: Date.now(), clientId: user.clientId, clientName: user.name, ...data });
const projInfo = (p) => (p ? { projectId: p.id, projectCode: p.code || '', projectTitle: p.title || '' } : { projectId: null });

function PaymentProof({ user, orders, invoices, payments, preset, onClose }) {
  const { f, bind, setF } = useForm({ projectId: preset.projectId || (orders.length === 1 ? orders[0].id : ''), milestone: preset.milestone ?? '', invoiceId: preset.invoiceId || '', amount: preset.amount ? Math.round(preset.amount) : '', date: today(), mode: 'Bank Transfer / NEFT', ref: '', text: '' });
  const [images, setImages] = useState([]);
  const p = orders.find((x) => x.id === f.projectId);
  const paidFor = (i) => sum(payments.filter((x) => x.projectId === f.projectId && x.milestone === i), 'amount');
  const myInv = invoices.filter((i) => num(i.total) - num(i.paid) > 0.5 && (!f.projectId || i.projectId === f.projectId));
  const save = async () => {
    if (num(f.amount) <= 0) return act(async () => { throw new Error('Enter the amount you paid'); });
    if (!f.ref.trim() && !images.length) return act(async () => { throw new Error('Add the UTR / cheque number or a screenshot'); });
    const inv = invoices.find((i) => i.id === f.invoiceId);
    await act(() => sendReq(user, { type: 'payment', ...projInfo(p), amount: num(f.amount), date: f.date, mode: f.mode, ref: f.ref.trim(), text: f.text.trim(), milestone: f.milestone === '' ? null : Number(f.milestone), invoiceId: inv?.id || null, invoiceNumber: inv?.number || '', images }), 'Sent — our accounts team will confirm it');
    onClose();
  };
  return (
    <Modal title={t("Send payment details")} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Cancel")}</button><button className="btn" onClick={save}>{t("Send")}</button></>}>
      <div className="form-grid">
        {orders.length > 1 && <Field label={t("For which lift / order")} span={2}><Select options={orders.map((o) => ({ value: o.id, label: `${o.title} · ${o.code}` }))} placeholder="— choose —" value={f.projectId} onChange={(e) => setF((x) => ({ ...x, projectId: e.target.value, milestone: '', invoiceId: '' }))} /></Field>}
        {p?.milestones?.length > 0 && <Field label={t("Payment for")} span={2}><Select options={p.milestones.map((m, i) => ({ value: i, label: `${m.name} — ${inr(m.amount)} (${milestoneStatus(m, paidFor(i))})` }))} placeholder="— not sure —" value={f.milestone} onChange={(e) => { const v = e.target.value; setF((x) => ({ ...x, milestone: v, amount: v === '' ? x.amount : Math.max(0, Math.round(num(p.milestones[v].amount) - paidFor(Number(v)))) })); }} /></Field>}
        {myInv.length > 0 && <Field label={t("Against invoice (optional)")} span={2}><Select options={myInv.map((i) => ({ value: i.id, label: `${i.number} — ${inr(num(i.total) - num(i.paid))} due` }))} placeholder="— none —" {...bind('invoiceId')} /></Field>}
        <Field label={t("Amount paid (₹)")}><input type="number" inputMode="decimal" {...bind('amount')} /></Field>
        <Field label={t("Date paid")}><input type="date" {...bind('date')} /></Field>
        <Field label={t("Paid by")}><Select options={PAY_MODES} placeholder={false} {...bind('mode')} /></Field>
        <Field label={t("UTR / cheque / UPI ref.")}><input {...bind('ref')} placeholder="e.g. UTR 4321…" /></Field>
        <Field label={t("Screenshot / cheque photo (optional)")} span={2}><ImagePicker images={images} setImages={setImages} max={2} label="Add" /></Field>
        <Field label={t("Note (optional)")} span={2}><input {...bind('text')} /></Field>
      </div>
    </Modal>
  );
}

function SiteReady({ p, user, onClose }) {
  const [checks, setChecks] = useState(() => Object.fromEntries(SITE_CHECKLIST.map((c) => [c, !!p.site?.checks?.[c]])));
  const [images, setImages] = useState([]);
  const [text, setText] = useState('');
  const all = SITE_CHECKLIST.every((c) => checks[c]);
  const save = async () => {
    if (!images.length) return act(async () => { throw new Error('Please add at least one photo of the shaft / pit'); });
    await act(() => sendReq(user, { type: 'site', ...projInfo(p), checks, images, text: text.trim() }), 'Sent — our installation team will verify the site');
    onClose();
  };
  return (
    <Modal title={t("Is your site ready?")} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Cancel")}</button><button className="btn" onClick={save}>{t("Send to installation team")}</button></>}>
      <p className="muted small">{t("Tick what is complete. Our team will check and confirm before sending the material.")}</p>
      <div className="checks">{SITE_CHECKLIST.map((c) => <label key={c} className="check"><input type="checkbox" checked={checks[c]} onChange={(e) => setChecks({ ...checks, [c]: e.target.checked })} /> {t(c)}</label>)}</div>
      {!all && <p className="small amber-text">{t("Some items are not ticked — you can still send, and tell us what is pending below.")}</p>}
      <Field label={t("Photos of the shaft, pit and top (up to 3)")}><ImagePicker images={images} setImages={setImages} /></Field>
      <Field label={t("Anything we should know?")}><textarea rows={2} value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </Modal>
  );
}

function MessageForm({ user, projects, preset, onClose }) {
  const { f, bind } = useForm({ projectId: preset.projectId || '', subject: 'Question about my order', text: '' });
  const [images, setImages] = useState([]);
  const save = async () => {
    if (!f.text.trim()) return act(async () => { throw new Error('Please type your message'); });
    const p = projects.find((x) => x.id === f.projectId);
    await act(() => sendReq(user, { type: 'message', ...projInfo(p), subject: f.subject, text: f.text.trim(), images }), 'Message sent — the reply will show in your portal');
    onClose();
  };
  return (
    <Modal title={t("Message our team")} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Cancel")}</button><button className="btn" onClick={save}>{t("Send")}</button></>}>
      <div className="form-grid">
        {projects.length > 1 && <Field label={t("About")} span={2}><Select options={projects.map((o) => ({ value: o.id, label: `${o.title} · ${o.code || o.quoteNo}` }))} placeholder="— general —" {...bind('projectId')} /></Field>}
        <Field label={t("Topic")} span={2}><Select options={['Question about my order', 'Change in lift / finish', 'Site or schedule', 'Payment or invoice', 'Something else']} placeholder={false} {...bind('subject')} /></Field>
        <Field label={t("Message")} span={2}><textarea rows={4} {...bind('text')} autoFocus /></Field>
        <Field label={t("Photo (optional)")} span={2}><ImagePicker images={images} setImages={setImages} max={2} /></Field>
      </div>
      <p className="muted small">{t("For a breakdown, use “Report a lift problem” instead — it alerts our service team immediately.")}</p>
    </Modal>
  );
}

function DrawingReview({ file, p, decision, user, onClose }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const approve = decision === 'Approved';
  const save = async () => {
    if (!approve && !text.trim()) return act(async () => { throw new Error('Please tell us what should change'); });
    await act(() => sendReq(user, { type: 'drawing', ...projInfo(p), fileId: file.id, fileTitle: file.title || file.name, rev: file.rev ?? null, decision, text: text.trim(), images }), approve ? 'Thank you — drawing approval sent' : 'Sent to our drawing team');
    onClose();
  };
  return (
    <Modal title={approve ? 'Approve drawing' : 'Ask for changes'} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Cancel")}</button><button className={'btn' + (approve ? ' green-btn' : '')} onClick={save}>{approve ? 'I approve this drawing' : 'Send'}</button></>}>
      <p><b>{file.title || file.name}</b> · Rev {file.rev}</p>
      {approve ? <p className="small">{t("By approving, you confirm the shaft size, door and cabin details in this drawing are correct. Manufacturing will go ahead as per this drawing.")}</p> : <p className="small muted">{t("Describe the changes. You can add a photo of a marked-up print.")}</p>}
      <Field label={approve ? 'Comment (optional)' : 'What should change?'}><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
      {!approve && <Field label={t("Photo (optional)")}><ImagePicker images={images} setImages={setImages} max={2} /></Field>}
    </Modal>
  );
}

function Rate({ col, doc, onClose }) {
  const [stars, setStars] = useState(0);
  const [text, setText] = useState('');
  const save = async () => {
    if (!stars) return act(async () => { throw new Error('Tap the stars to rate'); });
    await act(() => updateDoc(col, doc.id, { rating: stars, feedback: text.trim(), ratedAt: Date.now() }), 'Thank you for your feedback!');
    onClose();
  };
  return (
    <Modal title={t("Rate our service")} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Later")}</button><button className="btn" onClick={save}>{t("Submit")}</button></>}>
      <p className="small muted">{doc.issue || doc.type} · {fmtDate(doc.resolvedAt || doc.date)}</p>
      <div className="stars">{[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" className={n <= stars ? 'on' : ''} onClick={() => setStars(n)} aria-label={n + ' stars'}>★</button>)}</div>
      <Field label={t("Comments (optional)")}><textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} /></Field>
    </Modal>
  );
}

function RaiseComplaint({ user, amcs, projects, onClose }) {
  const { f, bind } = useForm({ liftRef: '', issue: '', priority: 'Normal', contactPhone: user.phone || '' });
  const [images, setImages] = useState([]);
  const [done, setDone] = useState(null);
  const save = async () => {
    if (!f.issue.trim()) return act(async () => { throw new Error('Please describe the problem'); });
    const a = amcs.find((x) => x.status === 'Active' && daysUntil(x.end) >= 0);
    const number = await nextNumber('CMP');
    await act(() => addDoc('complaints', { ...f, images, number, clientId: user.clientId, clientName: user.name, amcId: a?.id || null, projectId: a?.projectId || projects[0]?.id || null, status: 'Open', teamId: null, assignedTo: null, reportedVia: 'Client Portal', reportedAt: Date.now() }));
    setDone(number);
  };
  if (done) return <Modal title={t("Complaint registered")} onClose={onClose} footer={<button className="btn" onClick={onClose}>{t("OK")}</button>}><p>{t("Your complaint number is")} <b>{done}</b>{t(". Our service team has been alerted and will contact you shortly. You can track it in the Service tab.")}</p><p className="muted small">{t("If someone is trapped inside the lift, please also call us immediately.")}</p></Modal>;
  return (
    <Modal title={t("Report a lift problem")} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t("Cancel")}</button><button className="btn" onClick={save}>{t("Submit")}</button></>}>
      <div className="form-grid">
        <Field label={t("Which lift / location")}><input {...bind('liftRef')} placeholder="e.g. Tower A, Lift 1" /></Field>
        <Field label={t("How urgent?")}><Select options={['Normal', 'High', 'Critical (Trapped / Stuck)']} placeholder={false} {...bind('priority')} /></Field>
        <Field label={t("What's the problem?")} span={2}><textarea rows={4} {...bind('issue')} placeholder="Describe what is happening" /></Field>
        <Field label={t("Photo (optional)")} span={2}><ImagePicker images={images} setImages={setImages} max={2} /></Field>
        <Field label={t("Your phone number")} span={2}><input {...bind('contactPhone')} inputMode="tel" /></Field>
      </div>
    </Modal>
  );
}

/* Payment receipt (printable / PDF / WhatsApp) */
export function Receipt({ pay, company, user, onClose }) {
  const no = 'RCT-' + String(pay.id).slice(-6).toUpperCase();
  return (
    <PrintFrame title="Payment Receipt" fileName={`Payment Receipt ${fmtDate(pay.date)} ${pay.clientName || ''}`} onClose={onClose}
      whatsapp={{ phone: '', text: `Payment receipt: ${inr(pay.amount)} received by ${company.name} on ${fmtDate(pay.date)}.` }}>
      <div className="print-area">
        <div className="pd-head">
          <img src={logoUrl} alt="" className="pd-logo" />
          <div className="pd-left">
            <div className="pd-co">{company.name}</div>
            <div className="pd-small pre">{company.address}{company.state ? ', ' + company.state : ''}</div>
            <div className="pd-small">{[company.phone, company.email, company.website].filter(Boolean).join(' · ')}</div>
            {company.gstin && <div className="pd-small">GSTIN: {company.gstin}</div>}
          </div>
          <div className="pd-title"><div>PAYMENT RECEIPT</div><div className="pd-small">No: <b>{no}</b></div><div className="pd-small">Date: {fmtDate(pay.date)}</div></div>
        </div>
        <div className="pd-to"><div className="pd-small muted">Received with thanks from</div><b>{pay.clientName || user?.name}</b>{pay.clientNo && <div className="pd-small">Client No.: <b>{pay.clientNo}</b></div>}</div>
        <table className="pd-table"><tbody>
          <tr><td>Amount</td><td className="r"><b>{inr(pay.amount)}</b></td></tr>
          <tr><td>In words</td><td className="r">{amountInWords(pay.amount)}</td></tr>
          <tr><td>Mode</td><td className="r">{pay.mode}{pay.ref ? ' · ' + pay.ref : ''}</td></tr>
          {pay.projectCode && <tr><td>Order</td><td className="r">{pay.projectCode}</td></tr>}
          {pay.invoiceNumber && <tr><td>Against invoice</td><td className="r">{pay.invoiceNumber}</td></tr>}
        </tbody></table>
        <div className="pd-sign"><div /><div>For {company.name}<br />{company.signature ? <img src={company.signature} alt="" className="pd-sigimg" /> : <><br /><br /></>}<br />Authorised Signatory</div></div>
        <p className="pd-small muted">This is a computer-generated receipt. Cheque payments are subject to realisation.</p>
      </div>
    </PrintFrame>
  );
}

/* Client accepts the quotation online (optional PO no. + PO copy) */
function AcceptQuote({ p, user, onClose }) {
  const [name, setName] = useState(p.contactPerson || user.name || '');
  const [poNo, setPoNo] = useState('');
  const [file, setFile] = useState(null);
  const [agree, setAgree] = useState(false);
  const amount = quoteTotal(p);
  const pick = async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      if (f.type.startsWith('image/')) setFile({ name: f.name.replace(/\.[^.]+$/, '') + '.jpg', type: 'image/jpeg', data: await compressImage(f, 1600, 0.7) });
      else if (f.size > 700 * 1024) toast(t('File too large — please attach a photo or a PDF under 700 KB'), 'err');
      else setFile({ name: f.name, type: f.type, data: await new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsDataURL(f); }) });
    } catch { toast('Could not read the file', 'err'); }
  };
  const save = async () => {
    if (!agree) return act(async () => { throw new Error(t('Please tick the confirmation box')); });
    if (!name.trim()) return act(async () => { throw new Error(t('Please enter your name')); });
    await act(() => sendReq(user, { type: 'quote', ...projInfo(p), refNo: p.quote?.refNo || p.quoteNo, amount, acceptedBy: name.trim(), poNo: poNo.trim(), acceptedAt: Date.now(), ...(file ? { attachment: file } : {}), text: `Quotation ${p.quote?.refNo || p.quoteNo} accepted by ${name.trim()}${poNo ? ' (PO ' + poNo + ')' : ''}.` }), t('Thank you! Our team will confirm your order shortly.'));
    onClose();
  };
  return (
    <Modal title={t('Accept quotation')} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>{t('Cancel')}</button><button className="btn green-btn" onClick={save}>✍️ {t('Accept quotation')}</button></>}>
      <div className="accept-box">
        <div><span className="muted small">{t('Quotation')}</span><b>{p.quote?.refNo || p.quoteNo}</b></div>
        <div><span className="muted small">{p.title}</span><b>{inr(amount)} <small className="muted">{t('incl. GST')}</small></b></div>
      </div>
      <div className="form-grid">
        <Field label={t('Your name')}><input value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label={t('Your PO / work order no. (optional)')}><input value={poNo} onChange={(e) => setPoNo(e.target.value)} /></Field>
        <Field label={t('Attach PO or signed quotation (optional)')} span={2}>
          <label className="btn ghost sm file-pick">📎 {file ? file.name : t('Choose photo or PDF')}<input type="file" accept="image/*,application/pdf" hidden onChange={pick} /></label>
        </Field>
      </div>
      <label className="check strong"><input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} /> {t('I accept this quotation, its price and terms, and want to place the order.')}</label>
      <p className="muted small">{t('Our sales team will confirm your order and share the advance payment details.')}</p>
    </Modal>
  );
}
