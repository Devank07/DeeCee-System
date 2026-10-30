import React, { useState } from 'react';
import { useCol, useDoc, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Pipeline, MiniPipeline, ProgressBar, ActivityFeed, PhotoUploader, PhotoGrid, FileList, FileUpload, Empty, Stat, Note, PrintDoc, useSettings } from '../ui';
import { updateDoc, deleteDoc, postActivity, restampTeam, me } from '../data';
import { SITE_CHECKLIST, INSTALL_STEPS, STATE_NAMES } from '../constants';
import { inr, fmtDate, fmtDateTime, today, num, sum, waLink, mapsLink, daysUntil } from '../utils';
import { steps, openTasks, nextText, progressPct, quoteTotal, milestoneStatus } from '../workflow';
import { VisitForm, InvoiceForm, PaymentForm, teamOptions, can } from './shared';
import { ConfirmOrder, EnquiryStatus } from './Enquiries';
import ProposalForm from './ProposalForm';
import ProposalDoc from './ProposalDoc';
import { SiteForm, InstallForm } from './siteForms';
import { DispatchForm } from './Inventory';

export default function Orders({ user, params }) {
  if (params[0]) return <ClientTab id={params[0]} user={user} />;
  return <OrderList user={user} />;
}

function OrderList({ user }) {
  const projects = useCol('projects', [['status', 'in', ['Order', 'On Hold', 'Completed']]]);
  const payments = useCol('payments', [], ['admin', 'accounts', 'stores', 'sales'].includes(user.role));
  const mine = projects.filter((p) => p.status === 'Order' && openTasks(p, user.role).length);
  const [tab, setTab] = useState(user.role === 'admin' ? 'Active' : 'mine');
  const groups = {
    mine: mine,
    Active: projects.filter((p) => p.status === 'Order'),
    'On Hold': projects.filter((p) => p.status === 'On Hold'),
    Completed: projects.filter((p) => p.status === 'Completed'),
    All: projects,
  };
  const received = (pid) => sum(payments.filter((x) => x.projectId === pid), 'amount');
  const showMoney = payments.length > 0 || ['admin', 'accounts', 'stores', 'sales'].includes(user.role);
  return (
    <div className="page">
      <PageHeader title="Orders" sub="Every confirmed order from advance to handover. Each team sees what is waiting for them." />
      <div className="chips">
        {Object.entries(groups).map(([k, v]) => (
          <button key={k} className={'chip' + (tab === k ? ' on' : '') + (k === 'mine' && v.length ? ' attn' : '')} onClick={() => setTab(k)}>
            {k === 'mine' ? (user.role === 'admin' ? 'Needs action' : 'Waiting for my team') : k} <span>{v.length}</span>
          </button>
        ))}
      </div>
      <Card pad={false}>
        <DataTable
          csvName="orders" rows={groups[tab]} onRow={(r) => go('orders/' + r.id)} initialSort={{ key: 'code', desc: true }}
          empty={tab === 'mine' ? 'Nothing is waiting for your team right now' : undefined}
          columns={[
            { key: 'code', label: 'Order', render: (r) => <><b>{r.clientName}</b><div className="muted small">{r.title} · {r.code}</div></>, csv: (r) => `${r.code} ${r.clientName} / ${r.title}` },
            { key: 'progress', label: 'Progress', render: (r) => <div className="stage-cell"><MiniPipeline p={r} /><span className="muted small">{progressPct(r)}%</span></div>, sortValue: progressPct, csv: progressPct },
            { key: 'next', label: 'Next step', render: (r) => <span className="small">{nextText(r)}</span>, csv: nextText },
            { key: 'teamName', label: 'Site team', value: (r) => r.teamName || '—' },
            ...(showMoney ? [{ key: 'pay', label: 'Received / Value', align: 'r', render: (r) => <><b>{inr(received(r.id))}</b><div className="muted small">of {inr(r.contractValue)}</div></>, sortValue: (r) => received(r.id), csv: (r) => received(r.id) + ' / ' + r.contractValue }] : []),
            { key: 'expectedHandover', label: 'Target', render: (r) => <span className={r.status === 'Order' && daysUntil(r.expectedHandover) < 0 ? 'danger-text' : ''}>{fmtDate(r.expectedHandover)}</span>, csv: (r) => r.expectedHandover },
          ]}
        />
      </Card>
    </div>
  );
}

/* ================= CLIENT TAB ================= */
function ClientTab({ id, user }) {
  const p = useDoc('projects', id);
  const company = useSettings();
  const office = user.role !== 'technician';
  const moneyRoles = can(user, 'stores', 'accounts', 'sales');
  const payments = useCol('payments', [['projectId', '==', id]], moneyRoles);
  const invoices = useCol('invoices', [['projectId', '==', id]], moneyRoles);
  const activity = useCol('activity', [['projectId', '==', id]]);
  const visits = useCol('visits', [['projectId', '==', id]]);
  const dispatches = useCol('dispatches', [['projectId', '==', id]]);
  const pos = useCol('purchaseOrders', [['projectId', '==', id]]);
  const drawings = useCol('files', [['projectId', '==', id], ['kind', '==', 'Drawing']]);
  const teams = useCol('teams');
  const [modal, setModal] = useState(null);
  const [note, setNote] = useState('');
  const [shareClient, setShareClient] = useState(false);
  const [shareTeam, setShareTeam] = useState(true);
  if (p === undefined) return <div className="page"><Empty>Loading…</Empty></div>;
  if (p === null || !office) return <div className="page"><Empty>This client tab doesn't exist or you don't have access.</Empty></div>;

  const st = Object.fromEntries(steps(p).map((s) => [s.key, s]));
  const enquiry = p.status === 'Enquiry' || p.status === 'Lost';
  const adv = !!p.advance?.confirmed;
  const siteReady = p.site?.status === 'Ready';
  const dispatched = ['Dispatched', 'Delivered'].includes(p.material?.status);
  const received = sum(payments, 'amount');
  const paidFor = (i) => sum(payments.filter((x) => x.milestone === i), 'amount');
  const qTotal = quoteTotal(p);
  const nextRev = drawings.length ? Math.max(...drawings.map((d) => num(d.rev))) + 1 : 0;
  const isAdmin = user.role === 'admin';
  const myTasks = openTasks(p, user.role);
  const close = () => setModal(null);

  const setMaterial = (status) => act(async () => {
    await updateDoc('projects', p.id, { material: { ...(p.material || {}), status, at: Date.now(), by: me()?.name || '' } }, p.code);
    await postActivity({ projectId: p.id, clientId: p.clientId, text: status === 'Procuring' ? 'Material is being procured for your lift.' : status === 'Ready to dispatch' ? 'Material is packed and ready to dispatch.' : `Material status: ${status}.`, visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
  }, 'Material status updated');
  const setTeam = (teamId) => act(async () => {
    const t = teams.find((x) => x.id === teamId);
    await updateDoc('projects', p.id, { teamId: teamId || null, teamName: t?.name || '' }, p.code);
    await restampTeam(p.id, teamId);
    if (t) await postActivity({ projectId: p.id, clientId: p.clientId, text: `${t.name} assigned to this site.`, visibleToClient: false, teamId, kind: 'team' });
  }, 'Site team updated');
  const approveDrawing = () => act(async () => {
    await updateDoc('projects', p.id, { drawing: { ...p.drawing, status: 'Approved', approvedAt: Date.now() } }, p.code);
    await postActivity({ projectId: p.id, clientId: p.clientId, text: `Drawing Rev ${p.drawing?.rev ?? 0} approved by client.`, visibleToClient: true, teamId: p.teamId || null, kind: 'drawing' });
  }, 'Drawing marked approved');
  const markDelivered = () => act(async () => {
    await updateDoc('projects', p.id, { material: { ...p.material, status: 'Delivered', at: Date.now(), by: me()?.name || '' } }, p.code);
    await Promise.all(dispatches.filter((d) => d.status !== 'Delivered').map((d) => updateDoc('dispatches', d.id, { status: 'Delivered', deliveredAt: Date.now() }, d.number)));
    await postActivity({ projectId: p.id, clientId: p.clientId, text: 'Material delivered at site.', visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
  }, 'Marked delivered');
  const postNote = async () => {
    if (!note.trim()) return;
    await act(() => postActivity({ projectId: p.id, clientId: p.clientId, text: note.trim(), visibleToClient: shareClient, teamId: shareTeam ? p.teamId || null : null }), 'Update posted');
    setNote(''); setShareClient(false);
  };
  const lock = (ok, reason) => (ok || isAdmin ? null : reason);

  return (
    <div className="page">
      <PageHeader
        title={p.clientName}
        sub={<>{p.title} · {p.code || p.quoteNo} · <Badge>{p.status}</Badge>{p.teamName && <> · {p.teamName}</>}</>}
        actions={<>
          <button className="btn ghost" onClick={() => go(enquiry ? 'enquiries' : 'orders')}>← Back</button>
          {p.contactPhone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(p.contactPhone, `Dear ${p.contactPerson || p.clientName}, update on your lift ${p.code || ''}: ${nextText(p)}. — ${company.name}`)}>WhatsApp</a>}
          {can(user, 'sales', 'projects') && <button className="btn ghost" onClick={() => setModal({ t: 'edit' })}>Edit details</button>}
        </>}
      />

      <Card><Pipeline p={p} /></Card>
      {myTasks.length > 0 && p.status !== 'Lost' && (
        <Note tone="blue"><b>Waiting for {user.role === 'admin' ? 'action' : 'your team'}:</b> {myTasks.map((s) => s.label).join(', ')}</Note>
      )}

      {enquiry && (
        <div className="grid-2">
          <QuoteCard p={p} user={user} company={company} setModal={setModal} qTotal={qTotal} />
          <Card title="Enquiry" actions={can(user, 'sales') && p.status === 'Enquiry' && <button className="btn ghost sm" onClick={() => setModal({ t: 'enq' })}>Update follow-up</button>}>
            <dl className="dl">
              <dt>Stage</dt><dd><Badge>{p.status === 'Lost' ? 'Lost' : p.enquiry?.status}</Badge></dd>
              <dt>Source</dt><dd>{p.enquiry?.source || '—'}</dd>
              <dt>Follow-up</dt><dd className={p.enquiry?.followUpDate <= today() ? 'danger-text' : ''}>{fmtDate(p.enquiry?.followUpDate)}</dd>
              <dt>Sales</dt><dd>{p.salesName || '—'}</dd>
              {p.enquiry?.notes && <><dt>Notes</dt><dd className="pre">{p.enquiry.notes}</dd></>}
              {p.enquiry?.lostReason && <><dt>Lost reason</dt><dd>{p.enquiry.lostReason}</dd></>}
            </dl>
            {p.status === 'Lost' && can(user, 'sales') && <button className="btn ghost sm" onClick={() => act(() => updateDoc('projects', p.id, { status: 'Enquiry' }, p.quoteNo), 'Re-opened')}>Re-open enquiry</button>}
          </Card>
        </div>
      )}

      {!enquiry && (
        <div className="grid-2">
          {/* PAYMENTS & ADVANCE */}
          {moneyRoles && (
            <Card title="Payments" actions={can(user, 'stores', 'accounts') && <button className="btn ghost sm" onClick={() => setModal({ t: 'pay' })}>Record payment</button>}>
              {!adv && (
                <div className="gate">
                  <b>Advance not received yet.</b> Drawing and material dispatch unlock once the advance is confirmed.
                  {can(user, 'stores', 'accounts') && <div><button className="btn sm" onClick={() => setModal({ t: 'pay', milestone: 0, confirmAdvance: true })}>Confirm advance received</button></div>}
                </div>
              )}
              <div className="pay-sum">
                <div><span>Order value</span><b>{inr(p.contractValue)}</b></div>
                <div><span>Received</span><b className="ok-text">{inr(received)}</b></div>
                <div><span>Balance</span><b>{inr(num(p.contractValue) - received)}</b></div>
              </div>
              <table className="mini-table"><tbody>
                {(p.milestones || []).map((m, i) => {
                  const inv = invoices.find((x) => x.id === m.invoiceId);
                  return (
                    <tr key={i}>
                      <td><b>{m.name}</b><div className="muted small">{m.percent}% · {inr(m.amount)}{paidFor(i) > 0 && ` · received ${inr(paidFor(i))}`}</div></td>
                      <td><Badge>{milestoneStatus(m, paidFor(i))}</Badge>{inv && <div className="small"><a href={'#/billing/invoices/' + inv.id}>{inv.number}</a></div>}</td>
                      <td className="r">{!m.invoiceId && can(user, 'accounts') && <button className="btn ghost sm" onClick={() => setModal({ t: 'invoice', i, m })}>Raise invoice</button>}</td>
                    </tr>
                  );
                })}
              </tbody></table>
            </Card>
          )}

          {/* DRAWINGS */}
          <Card title={<>Drawings <Badge>{p.drawing?.status || 'Pending'}</Badge></>} actions={<>
            {can(user, 'drawing') && <button className="btn ghost sm" disabled={!!lock(adv, 'x')} title={lock(adv, 'Unlocks after advance is received') || ''} onClick={() => setModal({ t: 'drawing' })}>+ Upload drawing</button>}
            {can(user, 'drawing', 'sales') && p.drawing?.status === 'Issued' && <button className="btn ghost sm" onClick={approveDrawing}>Approved by client</button>}
          </>}>
            {!adv && can(user, 'drawing') && <p className="muted small">The drawing can be issued once the advance is received.</p>}
            <FileList projectId={p.id} kind="Drawing" canDelete={can(user, 'drawing')} canToggle={can(user, 'drawing', 'sales')} />
          </Card>

          {/* SITE READINESS */}
          <Card title={<>Site readiness <Badge>{p.site?.status || 'Not checked'}</Badge></>} actions={can(user, 'projects') && <button className="btn ghost sm" onClick={() => setModal({ t: 'site' })}>Update site status</button>}>
            <ul className="checklist">{SITE_CHECKLIST.map((c) => <li key={c} className={p.site?.checks?.[c] ? 'ok' : ''}>{p.site?.checks?.[c] ? '✓' : '○'} {c}</li>)}</ul>
            {p.site?.notes && <p className="small"><b>Notes:</b> {p.site.notes}</p>}
            {p.site?.at && <p className="muted small">Last checked by {p.site.by} · {fmtDateTime(p.site.at)}</p>}
          </Card>

          {/* MATERIAL */}
          <Card title={<>Material <Badge>{p.material?.status || 'Pending'}</Badge></>} actions={can(user, 'stores') && <>
            {!dispatched && p.material?.status !== 'Procuring' && <button className="btn ghost sm" onClick={() => setMaterial('Procuring')}>Procuring</button>}
            {!dispatched && p.material?.status !== 'Ready to dispatch' && <button className="btn ghost sm" onClick={() => setMaterial('Ready to dispatch')}>Ready to dispatch</button>}
            {!dispatched && <button className="btn sm" disabled={!!lock(adv && siteReady, 'x')} onClick={() => setModal({ t: 'dispatch' })}>Dispatch to site</button>}
            {p.material?.status === 'Dispatched' && <button className="btn ghost sm" onClick={markDelivered}>Mark delivered</button>}
          </>}>
            {!dispatched && (!adv || !siteReady) && (
              <div className="gate small">Dispatch unlocks when: {!adv && <Badge tone="red">advance received</Badge>} {!siteReady && <Badge tone="red">site ready (Installation team)</Badge>}</div>
            )}
            {dispatches.length + pos.length === 0 ? <p className="muted small">No purchase orders or dispatches yet</p> : (
              <ul className="list">
                {pos.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">PO · {x.vendorName}</span><div className="muted small">{x.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div></div><Badge>{x.status}</Badge></li>)}
                {dispatches.map((x) => <li key={x.id}><div><b>{x.number}</b> <span className="muted small">Challan · {fmtDate(x.date)} · {x.vehicle}</span><div className="muted small">{x.items.map((i) => `${i.name} × ${i.qty}`).join(', ')}</div></div><Badge>{x.status}</Badge></li>)}
              </ul>
            )}
          </Card>

          {/* INSTALLATION */}
          <Card title={<>Installation <Badge>{p.install?.status || 'Not started'}</Badge></>} actions={can(user, 'projects') && <>
            <button className="btn ghost sm" disabled={!!lock(dispatched, 'x')} onClick={() => setModal({ t: 'install' })}>Update progress</button>
            {p.install?.status === 'Completed' && !p.handoverAt && <button className="btn sm" onClick={() => setModal({ t: 'handover' })}>Hand over</button>}
            {p.handoverAt && <button className="btn ghost sm" onClick={() => go('service/amc/new/' + p.id)}>Create AMC</button>}
          </>}>
            <div className="row gap between wrap">
              <span>Site team:</span>
              {can(user, 'projects') ? <Select className="inline-select" options={teamOptions(teams, 'Installation')} placeholder="— Assign team —" value={p.teamId || ''} onChange={(e) => setTeam(e.target.value)} /> : <b>{p.teamName || 'Not assigned'}</b>}
            </div>
            <div className="mt"><ProgressBar value={p.install?.progress || 0} tone="green" /><span className="muted small">{p.install?.progress || 0}% complete</span></div>
            <ul className="checklist">{INSTALL_STEPS.map((c) => <li key={c} className={p.install?.steps?.[c] ? 'ok' : ''}>{p.install?.steps?.[c] ? '✓' : '○'} {c}</li>)}</ul>
            {!dispatched && <p className="muted small">Installation starts after the material is dispatched.</p>}
            {p.handoverAt && <p className="ok-text">Handed over on {fmtDate(p.handoverAt)}{p.handover?.licence ? ' · Lift licence done' : ''}</p>}
          </Card>

          {/* FIELD JOBS */}
          <Card title="Field jobs" actions={can(user, 'projects', 'service') && <button className="btn ghost sm" onClick={() => setModal({ t: 'visit' })}>+ Schedule job</button>}>
            {visits.length === 0 ? <p className="muted small">No jobs scheduled</p> : (
              <ul className="list">{[...visits].sort((a, b) => (a.date < b.date ? 1 : -1)).map((v) => (
                <li key={v.id} className="clickable" onClick={() => go('service/visits/' + v.id)}><div><b>{v.title}</b><div className="muted small">{fmtDate(v.date)} · {v.teamName}</div></div><Badge>{v.status}</Badge></li>
              ))}</ul>
            )}
          </Card>

          <QuoteCard p={p} user={user} company={company} setModal={setModal} qTotal={qTotal} compact />
        </div>
      )}

      <div className="grid-2">
        <Card title="Site photos" actions={<PhotoUploader refId={p.id} clientId={p.clientId} projectId={p.id} teamId={p.teamId || null} />}>
          <PhotoGrid refId={p.id} canDelete={can(user, 'projects')} canToggleClient />
        </Card>
        <Card title="Documents" actions={<button className="btn ghost sm" onClick={() => setModal({ t: 'doc' })}>+ Upload</button>}>
          <FileList projectId={p.id} kind="Document" canDelete={can(user, 'sales', 'projects')} canToggle />
        </Card>
        <Card title="Client & site">
          <dl className="dl">
            <dt>Client</dt><dd><a href={'#/clients/' + p.clientId}>{p.clientName}</a></dd>
            <dt>Contact</dt><dd>{p.contactPerson} {p.contactPhone && <a href={'tel:' + p.contactPhone}>{p.contactPhone}</a>}</dd>
            <dt>Site</dt><dd>{p.siteAddress ? <a href={mapsLink(p.siteAddress)} target="_blank" rel="noreferrer">{p.siteAddress}</a> : '—'}{p.siteState ? `, ${p.siteState}` : ''}</dd>
            <dt>Lift</dt><dd>{p.lifts} × {p.liftSpec?.type} · {p.liftSpec?.capacity} · {p.liftSpec?.stops}</dd>
            <dt>Drive / doors</dt><dd>{p.liftSpec?.drive} · {p.liftSpec?.doorType}</dd>
            <dt>Sales</dt><dd>{p.salesName || '—'}</dd>
            {p.orderRef && <><dt>Client PO</dt><dd>{p.orderRef}</dd></>}
            {p.expectedHandover && <><dt>Target handover</dt><dd className={p.status === 'Order' && daysUntil(p.expectedHandover) < 0 ? 'danger-text' : ''}>{fmtDate(p.expectedHandover)}</dd></>}
          </dl>
        </Card>
      </div>

      <Card title="Timeline — all teams">
        <div className="composer">
          <textarea rows={2} placeholder="Post an update (e.g. 'Client will fix the machine room hook by Friday')" value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="row gap between wrap">
            <span className="row gap wrap">
              <label className="check"><input type="checkbox" checked={shareClient} onChange={(e) => setShareClient(e.target.checked)} /> Show to client</label>
              {p.teamId && <label className="check"><input type="checkbox" checked={shareTeam} onChange={(e) => setShareTeam(e.target.checked)} /> Show to site team</label>}
            </span>
            <button className="btn sm" onClick={postNote}>Post</button>
          </div>
        </div>
        <ActivityFeed items={activity} />
      </Card>

      {isAdmin && <p className="r"><button className="link danger" onClick={() => setModal({ t: 'delete' })}>Delete this client tab</button></p>}

      {modal?.t === 'quote' && <ProposalForm p={p} onClose={close} />}
      {modal?.t === 'confirm' && <ConfirmOrder p={p} onClose={close} />}
      {modal?.t === 'enq' && <EnquiryStatus p={p} onClose={close} />}
      {modal?.t === 'print' && <ProposalDoc p={p} onClose={close} />}
      {modal?.t === 'pay' && <PaymentForm project={p} milestone={modal.milestone} confirmAdvance={modal.confirmAdvance} onClose={close} />}
      {modal?.t === 'invoice' && <InvoiceForm onClose={close}
        initial={{ clientId: p.clientId, projectId: p.id, milestone: modal.i, placeOfSupply: p.siteState || '', items: [{ desc: `${modal.m.name} (${modal.m.percent}%) — ${p.title}`, hsn: company.hsnSupply || '', qty: 1, rate: Math.round((num(modal.m.amount) / 1.18) * 100) / 100 }], gstRate: 18 }}
        onSaved={(iid) => updateDoc('projects', p.id, { milestones: p.milestones.map((x, j) => (j === modal.i ? { ...x, invoiceId: iid } : x)) }, p.code)} />}
      {modal?.t === 'drawing' && <FileUpload project={p} kind="Drawing" nextRev={nextRev} onClose={close} onDone={async ({ rev, visibleToClient, shareWithTeam }) => {
        await updateDoc('projects', p.id, { drawing: { status: 'Issued', rev, at: Date.now(), by: me()?.name || '' } }, p.code);
        await postActivity({ projectId: p.id, clientId: p.clientId, text: `Drawing Rev ${rev} issued${visibleToClient ? ' — please review and approve' : ''}.`, visibleToClient, teamId: shareWithTeam ? p.teamId || null : null, kind: 'drawing' });
      }} />}
      {modal?.t === 'doc' && <FileUpload project={p} kind="Document" onClose={close} />}
      {modal?.t === 'site' && <SiteForm p={p} onClose={close} />}
      {modal?.t === 'install' && <InstallForm p={p} onClose={close} />}
      {modal?.t === 'handover' && <HandoverModal p={p} onClose={close} />}
      {modal?.t === 'dispatch' && <DispatchForm preset={{ projectId: p.id }} onClose={close} />}
      {modal?.t === 'visit' && <VisitForm initial={{ type: 'Installation Work', clientId: p.clientId, clientName: p.clientName, projectId: p.id, siteAddress: p.siteAddress, contactPhone: p.contactPhone, teamId: p.teamId || '' }} onClose={close} />}
      {modal?.t === 'edit' && <EditOrder p={p} user={user} onClose={close} />}
      {modal?.t === 'delete' && (
        <Modal title="Delete client tab?" onClose={close} footer={<><button className="btn ghost" onClick={close}>Keep</button><button className="btn danger-btn" onClick={() => act(() => deleteDoc('projects', p.id, p.code || p.quoteNo), 'Deleted').then(() => go(enquiry ? 'enquiries' : 'orders'))}>Delete permanently</button></>}>
          <p>This removes <b>{p.title}</b> for {p.clientName}. Invoices, payments and jobs stay in their own lists. This can't be undone.</p>
        </Modal>
      )}
    </div>
  );
}

function QuoteCard({ p, user, setModal, qTotal, compact }) {
  const sales = can(user, 'sales');
  return (
    <Card title={<>Quotation <span className="muted small">{p.quote?.refNo || p.quoteNo}</span></>} className={!compact && qTotal <= 0 ? 'attn-card' : ''} actions={<>
      <button className="btn ghost sm" onClick={() => setModal({ t: 'print' })}>Print / PDF</button>
      {sales && <button className={'btn sm' + (qTotal > 0 || compact ? ' ghost' : '')} onClick={() => setModal({ t: 'quote' })}>{p.orderConfirmedAt ? 'View details' : qTotal > 0 ? 'Edit quotation' : 'Enter price'}</button>}
    </>}>
      {!compact && p.proposal && (
        <p className="small muted">{p.proposal.origin} {p.proposal.liftKind} · {p.proposal.drive} · {p.proposal.persons} persons / {p.proposal.capacityKg} kg · {p.proposal.floors} · {p.proposal.color} · {p.proposal.door}</p>
      )}
      {!compact && (
        <ul className="list">{(p.quote?.items || []).map((it, i) => <li key={i}><span className="small">{it.desc}</span><span className="nowrap">{num(it.rate) ? `${it.qty} × ${inr(it.rate)}` : <Badge tone="red">Price?</Badge>}</span></li>)}</ul>
      )}
      <div className="row between mt"><span className="muted">Total incl. GST</span><b className="big-num">{qTotal > 0 ? inr(qTotal) : '—'}</b></div>
      {!p.orderConfirmedAt && p.status === 'Enquiry' && sales && (
        <div className="row gap mt wrap">
          {p.contactPhone && qTotal > 0 && <a className="btn ghost sm" target="_blank" rel="noreferrer" href={waLink(p.contactPhone, `Dear ${p.contactPerson || p.clientName}, thank you for your enquiry. Our proposal ${p.quote?.refNo || p.quoteNo} for ${p.title} is ready. I am sharing the PDF with you. — Dee Cee Elevators`)}>Send on WhatsApp</a>}
          <button className="btn sm" disabled={qTotal <= 0} title={qTotal <= 0 ? 'Enter the price first' : ''} onClick={() => setModal({ t: 'confirm' })}>Order confirmed →</button>
        </div>
      )}
      {p.orderConfirmedAt && <p className="muted small">Order confirmed {fmtDate(p.orderConfirmedAt)}{p.orderBy ? ' by ' + p.orderBy : ''}{num(p.contractValue) !== qTotal && p.contractValue ? ` · final value ${inr(p.contractValue)}` : ''}</p>}
    </Card>
  );
}

function HandoverModal({ p, onClose }) {
  const { f, bind, set } = useForm({ date: today(), licence: false, notes: '' });
  const save = async () => {
    await act(async () => {
      await updateDoc('projects', p.id, { handoverAt: Date.now(), handover: { date: f.date, licence: f.licence, notes: f.notes }, status: 'Completed' }, p.code);
      await postActivity({ projectId: p.id, clientId: p.clientId, text: `Lift handed over on ${fmtDate(f.date)}. Thank you for choosing DeeCee Elevators!${f.notes ? ' ' + f.notes : ''}`, visibleToClient: true, teamId: p.teamId || null, kind: 'stage' });
    }, 'Handed over — order completed');
    onClose();
  };
  return (
    <Modal title="Hand over to client" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Complete handover</button></>}>
      <div className="form-grid">
        <Field label="Handover date"><input type="date" {...bind('date')} /></Field>
        <Field label="Notes" span={2}><textarea rows={2} {...bind('notes')} placeholder="Keys, manuals, training given…" /></Field>
      </div>
      <label className="check"><input type="checkbox" checked={f.licence} onChange={(e) => set('licence', e.target.checked)} /> Lift licence / inspection done</label>
      <p className="muted small">After handover you can create the AMC contract from this page.</p>
    </Modal>
  );
}

function EditOrder({ p, user, onClose }) {
  const staff = useCol('staff');
  const { f, bind } = useForm({ siteAddress: p.siteAddress || '', siteState: p.siteState || '', contactPerson: p.contactPerson || '', contactPhone: p.contactPhone || '', expectedHandover: p.expectedHandover || '', salesBy: p.salesBy || '', status: p.status });
  const save = async () => {
    const sales = staff.find((s) => s.id === f.salesBy);
    await act(() => updateDoc('projects', p.id, { ...f, salesName: sales?.name || p.salesName || '' }, p.code || p.quoteNo), 'Saved');
    onClose();
  };
  return (
    <Modal title="Edit details" onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Site address" span={2}><input {...bind('siteAddress')} /></Field>
        <Field label="Site state (GST)"><Select options={STATE_NAMES} {...bind('siteState')} /></Field>
        <Field label="Target handover"><input type="date" {...bind('expectedHandover')} /></Field>
        <Field label="Site contact person"><input {...bind('contactPerson')} /></Field>
        <Field label="Site contact phone"><input {...bind('contactPhone')} /></Field>
        <Field label="Sales person"><Select options={staff.map((s) => ({ value: s.id, label: s.name }))} {...bind('salesBy')} /></Field>
        {user.role === 'admin' && p.status !== 'Enquiry' && p.status !== 'Lost' && <Field label="Status"><Select options={['Order', 'On Hold', 'Completed', 'Cancelled']} placeholder={false} {...bind('status')} /></Field>}
      </div>
    </Modal>
  );
}
