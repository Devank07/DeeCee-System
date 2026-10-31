// The order pipeline: who does what, and when each step unlocks.
import { calcTotals, inr, num } from './utils';
import { INSTALL_STEPS } from './constants';

export const STEPS = [
  { key: 'quote', label: 'Quotation', team: 'Sales' },
  { key: 'order', label: 'Order Confirmed', team: 'Sales' },
  { key: 'advance', label: 'Advance Received', team: 'Material / Accounts' },
  { key: 'drawing', label: 'Drawing Issued', team: 'Drawing' },
  { key: 'site', label: 'Site Ready', team: 'Installation' },
  { key: 'dispatch', label: 'Material Dispatched', team: 'Material' },
  { key: 'install', label: 'Installation', team: 'Installation' },
  { key: 'handover', label: 'Handover', team: 'Installation' },
];

// Roles that act on each step (admin can act on all)
export const STEP_ROLES = {
  quote: ['sales'],
  order: ['sales'],
  advance: ['stores', 'accounts'],
  drawing: ['drawing'],
  site: ['projects', 'technician'],
  dispatch: ['stores'],
  install: ['projects', 'technician'],
  handover: ['projects'],
};

export const quoteTotal = (p) => calcTotals(p.quote?.items || [], p.quote?.gstRate ?? 18, p.quote?.discount || 0).total;

export function steps(p) {
  const confirmed = !!p.orderConfirmedAt;
  const adv = !!p.advance?.confirmed;
  const drawingDone = ['Issued', 'Approved'].includes(p.drawing?.status);
  const siteReady = p.site?.status === 'Ready';
  const dispatched = ['Dispatched', 'Delivered'].includes(p.material?.status);
  const installed = p.install?.status === 'Completed';
  const handed = !!p.handoverAt;
  const qt = quoteTotal(p);
  const halted = ['Lost', 'Cancelled', 'On Hold'].includes(p.status);
  const s = {
    quote: { done: qt > 0 || confirmed, waiting: null, detail: confirmed ? '' : qt > 0 ? inr(qt) : 'Price to be entered' },
    order: { done: confirmed, waiting: qt > 0 || confirmed ? null : 'Waiting for quotation price', at: p.orderConfirmedAt },
    advance: { done: adv, waiting: confirmed ? null : 'Waiting for order', at: p.advance?.at, detail: adv && p.advance?.amount ? inr(p.advance.amount) : '' },
    drawing: {
      done: drawingDone, waiting: !confirmed ? 'Waiting for order' : !adv ? 'Waiting for advance' : null, at: p.drawing?.at,
      detail: p.drawing?.status === 'Approved' ? `Rev ${p.drawing.rev} · approved` : drawingDone ? `Rev ${p.drawing.rev}` : '',
    },
    site: { done: siteReady, waiting: confirmed ? null : 'Waiting for order', at: p.site?.at, detail: p.site?.status === 'Not ready' ? 'Not ready yet' : '' },
    dispatch: {
      done: dispatched, waiting: !adv ? 'Waiting for advance' : !siteReady ? 'Waiting for site ready' : null, at: p.material?.at,
      detail: p.material?.status === 'Delivered' ? 'Delivered' : !dispatched && p.material?.status && p.material.status !== 'Pending' ? p.material.status : '',
    },
    install: { done: installed, waiting: dispatched ? null : 'Waiting for material', at: p.install?.at, detail: !installed && p.install?.progress ? `${p.install.progress}% done` : '' },
    handover: { done: handed, waiting: installed ? null : 'Waiting for installation', at: p.handoverAt },
  };
  if (!confirmed) s.quote.done = false; // during enquiry the quote step stays open until the order is confirmed
  return STEPS.map((st) => {
    const x = s[st.key];
    return { ...st, ...x, open: !halted && !x.done && !x.waiting };
  });
}

export const currentStep = (p) => {
  const i = steps(p).findIndex((s) => !s.done);
  return i === -1 ? STEPS.length : i;
};
export const progressPct = (p) => Math.round((steps(p).filter((s) => s.done).length / STEPS.length) * 100);

export function openTasks(p, roles) {
  const r = Array.isArray(roles) ? roles : [roles];
  return steps(p).filter((s) => s.open && (r.includes('admin') || STEP_ROLES[s.key].some((k) => r.includes(k))));
}
export const nextText = (p) => {
  const open = steps(p).filter((s) => s.open);
  return open.length ? open.map((s) => `${s.team}: ${s.label}`).join(' · ') : p.status === 'Completed' ? 'Handed over' : '—';
};

export const installProgress = (stepsDone = {}) => Math.round((INSTALL_STEPS.filter((s) => stepsDone[s]).length / INSTALL_STEPS.length) * 100);

export function milestoneStatus(m, paid) {
  if (num(paid) >= num(m.amount) - 0.5 && num(m.amount) > 0) return 'Paid';
  if (num(paid) > 0) return 'Part paid';
  if (m.invoiceId) return 'Invoiced';
  return 'Due later';
}
