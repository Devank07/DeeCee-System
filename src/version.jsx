// Version number, "what's new" and new-version notice.
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Modal } from './ui';
import { CHANGELOG } from './changelog';
import { fmtDate } from './utils';

/* global __APP_VERSION__ */
export const APP = typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : { version: 'dev', commit: '', built: '' };
export const versionLabel = `v${APP.version}`;

export function VersionTag({ className = '' }) {
  const [open, setOpen] = useState(false);
  return (<>
    <button type="button" className={'version-tag ' + className} onClick={() => setOpen(true)} title="What's new">{versionLabel}</button>
    {open && createPortal(<div className="version-host"><WhatsNew onClose={() => setOpen(false)} /></div>, document.body)}
  </>);
}

export function WhatsNew({ onClose }) {
  return (
    <Modal title={`Dee Cee Company OS — ${versionLabel}`} onClose={onClose} footer={<button className="btn" onClick={onClose}>Close</button>}>
      <p className="muted small">Installed version <b>{versionLabel}</b>{APP.built ? ` · built ${fmtDate(APP.built)} ${new Date(APP.built).toTimeString().slice(0, 5)}` : ''}{APP.commit ? ` · ${APP.commit}` : ''}</p>
      <div className="changelog">{CHANGELOG.map((c) => (
        <div key={c.v} className={c.v === APP.version ? 'cl-cur' : ''}>
          <div className="cl-head"><b>v{c.v}</b><span className="muted small">{fmtDate(c.date)}</span>{c.v === APP.version && <span className="badge blue tiny">this version</span>}</div>
          <ul>{c.items.map((x) => <li key={x}>{x}</li>)}</ul>
        </div>
      ))}</div>
    </Modal>
  );
}

/* Checks every few minutes (and when the tab comes back) whether a newer version was deployed. */
export function UpdateBanner() {
  const [next, setNext] = useState(null);
  useEffect(() => {
    if (APP.version === 'dev') return undefined;
    let stop = false;
    const check = async () => {
      try {
        const r = await fetch('./version.json?t=' + Date.now(), { cache: 'no-store' });
        if (!r.ok) return;
        const v = await r.json();
        if (!stop && v && (v.version !== APP.version || (v.commit && APP.commit && v.commit !== APP.commit))) setNext(v);
      } catch { /* offline */ }
    };
    check();
    const id = setInterval(check, 5 * 60 * 1000);
    const vis = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', vis);
    return () => { stop = true; clearInterval(id); document.removeEventListener('visibilitychange', vis); };
  }, []);
  if (!next) return null;
  const refresh = async () => {
    try { const regs = await navigator.serviceWorker?.getRegistrations(); await Promise.all((regs || []).map((r) => r.update())); } catch { /* ignore */ }
    try { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); } catch { /* ignore */ }
    location.reload();
  };
  return (
    <div className="update-bar">
      <span>A new version <b>v{next.version}</b> is available (you have {versionLabel}).</span>
      <button className="btn sm" onClick={refresh}>Refresh now</button>
    </div>
  );
}
