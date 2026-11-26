// What clients send from the portal (payment proof, drawing approval, site ready, messages, AMC renewal)
// and how the office answers them.
import React, { useState } from 'react';
import { useCol, Card, Badge, Empty, act, go } from '../ui';
import { updateDoc, postActivity, me } from '../data';
import { inr, fmtDate, fmtDateTime } from '../utils';
import { hasAny } from '../roles';

export const REQ_TYPES = {
  quote: { label: 'Quotation accepted', icon: '✍️', roles: ['sales'] },
  payment: { label: 'Payment made', icon: '₹', roles: ['accounts', 'stores'] },
  drawing: { label: 'Drawing review', icon: '📐', roles: ['drawing', 'sales', 'projects'] },
  site: { label: 'Site ready', icon: '🏗', roles: ['projects'] },
  message: { label: 'Message', icon: '💬', roles: ['sales', 'projects', 'service', 'accounts', 'stores', 'drawing'] },
  amc: { label: 'AMC renewal', icon: '🔧', roles: ['service', 'sales'] },
};

export function reqSummary(r) {
  if (r.type === 'quote') return `Accepted ${r.refNo || 'the quotation'}${r.amount ? ' — ' + inr(r.amount) : ''}${r.poNo ? ' · PO ' + r.poNo : ''}${r.acceptedBy ? ' · by ' + r.acceptedBy : ''}`;
  if (r.type === 'payment') return `Paid ${inr(r.amount)} on ${fmtDate(r.date)} by ${r.mode}${r.ref ? ' · Ref ' + r.ref : ''}${r.invoiceNumber ? ' · against ' + r.invoiceNumber : ''}`;
  if (r.type === 'drawing') return `${r.decision} — ${r.fileTitle || 'drawing'}${r.rev != null ? ' (Rev ' + r.rev + ')' : ''}`;
  if (r.type === 'site') return `Site is ready (${Object.values(r.checks || {}).filter(Boolean).length} checklist items ticked)`;
  if (r.type === 'amc') return `Wants to renew AMC ${r.amcNumber || ''}`;
  return r.subject || 'Message';
}

/* One request with reply / done. `extra` adds type-specific buttons (client tab). */
export function RequestRow({ r, user, extra, showClient }) {
  const [reply, setReply] = useState('');
  const [open, setOpen] = useState(r.status === 'New' && !showClient);
  const onTab = showClient && r.projectId && ['payment', 'drawing', 'site', 'quote'].includes(r.type);
  const [img, setImg] = useState(null);
  const t = REQ_TYPES[r.type] || REQ_TYPES.message;
  const canAct = hasAny(user, ...t.roles);
  const done = (text) => act(async () => {
    const msg = (text ?? reply).trim();
    if (msg) await postActivity({ projectId: r.projectId || null, clientId: r.clientId, text: msg, visibleToClient: true, kind: 'reply' });
    await updateDoc('clientRequests', r.id, { status: 'Done', reply: msg, doneAt: Date.now(), doneBy: me()?.name || '' }, t.label + ' · ' + r.clientName);
    setReply('');
  }, msgDone(text ?? reply));
  return (
    <li className={'req ' + (r.status === 'New' ? 'req-new' : '')}>
      <div className="req-head" onClick={() => setOpen(!open)}>
        <span className="req-ico">{t.icon}</span>
        <div className="grow">
          <b>{t.label}</b>{showClient && <span className="muted"> · {r.clientName}{r.projectCode ? ' · ' + r.projectCode : ''}</span>}
          <div className="small">{reqSummary(r)}</div>
          <div className="muted small">{fmtDateTime(r.at)}{r.status === 'Done' && ` · handled by ${r.doneBy || '—'}`}</div>
        </div>
        <Badge tone={r.status === 'New' ? 'amber' : 'green'}>{r.status === 'New' ? 'New' : 'Done'}</Badge>
      </div>
      {open && (
        <div className="req-body">
          {r.text && <p className="pre small">{r.text}</p>}
          {r.attachment?.data && <a className="btn ghost sm" href={r.attachment.data} download={r.attachment.name || 'attachment'}>📎 {r.attachment.name || 'Attachment'}</a>}
          {r.images?.length > 0 && <div className="req-imgs">{r.images.map((src, i) => <img key={i} src={src} alt="" onClick={() => setImg(src)} />)}</div>}
          {r.reply && <p className="small"><b>Our reply:</b> {r.reply}</p>}
          {r.status === 'New' && canAct && onTab && (
            <div className="row gap wrap"><button className="btn sm" onClick={() => go('orders/' + r.projectId)}>Handle on client tab →</button><span className="muted small">{r.type === 'quote' ? 'Confirm the order there' : r.type === 'payment' ? 'Record the payment there' : r.type === 'drawing' ? 'Mark the drawing approved there' : 'Verify and mark the site ready there'}</span></div>
          )}
          {r.status === 'New' && canAct && !onTab && (
            <div className="req-actions">
              {extra}
              <textarea rows={2} value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Reply to the client (shown in their portal)" />
              <div className="row gap wrap">
                <button className="btn sm" onClick={() => done()}>{reply.trim() ? 'Send reply & close' : 'Mark done'}</button>
                {showClient && (r.projectId ? <button className="btn ghost sm" onClick={() => go('orders/' + r.projectId)}>Open client tab</button> : <button className="btn ghost sm" onClick={() => go('clients/' + r.clientId)}>Open client</button>)}
              </div>
            </div>
          )}
          {r.status === 'New' && !canAct && <p className="muted small">For {t.roles.join(' / ')} team.</p>}
        </div>
      )}
      {img && <div className="lightbox" onClick={() => setImg(null)}><img src={img} alt="" /></div>}
    </li>
  );
}
const msgDone = (t) => (t && t.trim() ? 'Reply sent' : 'Marked done');

/* Card on the client tab, with buttons that do the real work (record payment, approve drawing, mark site ready). */
export function ProjectRequests({ p, user, onRecordPayment, onApproveDrawing, onSiteReady, onConfirmOrder }) {
  const reqs = useCol('clientRequests', [['projectId', '==', p.id]]);
  if (!reqs.length) return null;
  const list = [...reqs].sort((a, b) => (a.status === b.status ? b.at - a.at : a.status === 'New' ? -1 : 1));
  const fresh = reqs.filter((r) => r.status === 'New').length;
  return (
    <Card title={<>From the client {fresh > 0 && <Badge tone="amber">{fresh} new</Badge>}</>} className={fresh ? 'attn-card' : ''}>
      <ul className="req-list">{list.slice(0, 12).map((r) => (
        <RequestRow key={r.id} r={r} user={user} extra={
          r.type === 'quote' && p.status === 'Enquiry' && hasAny(user, 'sales') ? <button className="btn sm" onClick={() => onConfirmOrder(r)}>Confirm order →</button>
            : r.type === 'payment' && hasAny(user, 'accounts', 'stores') ? <button className="btn sm" onClick={() => onRecordPayment(r)}>Record this payment →</button>
            : r.type === 'drawing' && r.decision === 'Approved' && p.drawing?.status !== 'Approved' && hasAny(user, 'drawing', 'sales', 'projects') ? <button className="btn sm" onClick={() => onApproveDrawing(r)}>Mark drawing approved →</button>
              : r.type === 'site' && p.site?.status !== 'Ready' && hasAny(user, 'projects') ? <button className="btn sm" onClick={() => onSiteReady(r)}>Verified — mark site ready →</button>
                : null
        } />
      ))}</ul>
    </Card>
  );
}

/* Dashboard list of everything new from clients */
export function DashboardRequests({ user }) {
  const reqs = useCol('clientRequests', [['status', '==', 'New']]);
  const mine = reqs.filter((r) => hasAny(user, ...(REQ_TYPES[r.type] || REQ_TYPES.message).roles));
  if (!mine.length) return null;
  return (
    <Card title={<>From clients <Badge tone="amber">{mine.length} new</Badge></>} className="attn-card">
      <ul className="req-list">{[...mine].sort((a, b) => b.at - a.at).slice(0, 10).map((r) => <RequestRow key={r.id} r={r} user={user} showClient />)}</ul>
      {mine.length === 0 && <Empty>Nothing new</Empty>}
    </Card>
  );
}
