// Install-as-app button, offline notice and service worker registration.
import React, { useEffect, useState } from 'react';
import { Modal } from './ui';
import { t } from './i18n';

let deferred = null;
const subs = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; subs.forEach((f) => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach((f) => f()); });
}
const standalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true);
const isIOS = () => typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.hostname === 'localhost' && !import.meta.env.PROD) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('./sw.js').catch(() => {}); });
}

export function InstallButton({ className = 'btn ghost sm' }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);
  useEffect(() => { const f = () => force((n) => n + 1); subs.add(f); return () => subs.delete(f); }, []);
  if (standalone()) return null;
  if (!deferred && !isIOS()) return null;
  const click = async () => {
    if (deferred) { deferred.prompt(); try { await deferred.userChoice; } catch { /* ignore */ } deferred = null; force((n) => n + 1); }
    else setHelp(true);
  };
  return (<>
    <button className={className + ' install-btn'} onClick={click} title={t('Install app')}>⤓<span className="install-l"> {t('Install app')}</span></button>
    {help && (
      <Modal title={t('Install app')} onClose={() => setHelp(false)} footer={<button className="btn" onClick={() => setHelp(false)}>OK</button>}>
        <ol className="install-steps">
          <li>Tap the <b>Share</b> button <span aria-hidden="true">⬆︎</span> at the bottom of Safari.</li>
          <li>Scroll and tap <b>Add to Home Screen</b>.</li>
          <li>Tap <b>Add</b>. The Dee Cee icon appears on your home screen and opens like an app.</li>
        </ol>
      </Modal>
    )}
  </>);
}

export function OfflineBanner() {
  const [off, setOff] = useState(typeof navigator !== 'undefined' && navigator.onLine === false);
  useEffect(() => {
    const on = () => setOff(false), offf = () => setOff(true);
    window.addEventListener('online', on); window.addEventListener('offline', offf);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', offf); };
  }, []);
  if (!off) return null;
  return <div className="offline-bar">⚠︎ {t('You are offline — changes will be sent when the internet is back.')}</div>;
}
