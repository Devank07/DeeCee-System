// Client photo gallery — managed here by Sales / Admin, shown to clients on the public /gallery page.
import React, { useMemo, useState } from 'react';
import { useCol, useDoc, PageHeader, Card, Tabs, Modal, Empty, Note, Field, toast, act, useRoute, go } from '../ui';
import { setQuiet, setDoc, addDoc, deleteDoc, logAudit, nextSerial, backend, getOne, DEMO } from '../data';
import { uid, fmtDate } from '../utils';
import { isAdminU, hasAny } from '../roles';
import { GALLERY_COLS as C, withDefaults, preparePhoto, fmtCode, isImgData, sortPhotos, waLink } from '../gallery/shared';

export const galleryUrl = (setId) => {
  const base = location.origin + location.pathname.replace(/[^/]*$/, '') + (import.meta.env.DEV ? 'gallery.html' : 'gallery');
  return setId ? `${base}?s=${encodeURIComponent(setId)}` : base;
};
const copy = async (text, msg = 'Link copied') => {
  try { await navigator.clipboard.writeText(text); toast(msg); } catch { window.prompt('Copy this link:', text); }
};

export default function Gallery({ user }) {
  const [, tabParam] = useRoute();
  const tab = ['photos', 'selections', 'settings'].includes(tabParam) ? tabParam : 'photos';
  const cfgDoc = useDoc(C.config, 'main');
  const cfg = withDefaults(cfgDoc);
  const photos = useCol(C.photos);
  const [picking, setPicking] = useState(null); // { ids:Set, set?: existing selection }
  const tabs = [
    { key: 'photos', label: `Photos (${photos.length})` },
    { key: 'selections', label: 'Client selections' },
    ...(isAdminU(user) ? [{ key: 'settings', label: 'Categories & settings' }] : []),
  ];
  return (
    <div className="page">
      <PageHeader
        title="Client gallery"
        sub="Real photos for clients, sorted by category. Only this gallery is public; everything else in the system stays private."
        actions={<>
          <a className="btn ghost sm" href={galleryUrl()} target="_blank" rel="noreferrer">Open public gallery ↗</a>
          <button className="btn ghost sm" onClick={() => copy(galleryUrl())}>Copy link</button>
          <a className="btn sm wa-btn" href={waLink('', `Here are photos of our elevators, cabins, doors and finishes: ${galleryUrl()}`)} target="_blank" rel="noreferrer">Share on WhatsApp</a>
        </>}
      />
      {DEMO && <Note>Demo mode: photos are saved in this browser only and kept small. Connect Firebase for the real gallery.</Note>}
      <Tabs tabs={tabs} value={tab} onChange={(k) => go('gallery/' + k)} />
      <div className="mt">
        {tab === 'photos' && <Photos cfg={cfg} photos={photos} user={user} picking={picking} setPicking={setPicking} />}
        {tab === 'selections' && <Selections photos={photos} onEdit={(s) => { setPicking({ ids: new Set(s.ids), set: s }); go('gallery/photos'); }} onNew={() => { setPicking({ ids: new Set() }); go('gallery/photos'); }} />}
        {tab === 'settings' && isAdminU(user) && <Settings cfg={cfg} photos={photos} />}
      </div>
    </div>
  );
}

/* ---------------- Photos: upload + organise ---------------- */
function Photos({ cfg, photos, user, picking, setPicking }) {
  const cats = cfg.categories;
  const catName = (k) => cats.find((c) => c.k === k)?.n || 'No category';
  const [filter, setFilter] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState(null);
  const counts = useMemo(() => Object.fromEntries(cats.map((c) => [c.k, photos.filter((p) => p.cat === c.k).length])), [photos, cats]);
  const shown = sortPhotos(photos).filter((p) => (filter === 'all' || p.cat === filter) && (!q || `${p.code} ${p.title || ''}`.toLowerCase().includes(q.toLowerCase())));
  const canEdit = hasAny(user, 'sales');

  const save = (p, patch, what) => act(async () => { await setQuiet(C.photos, p.id, patch, true); logAudit('Updated', C.photos, `${p.code}: ${what}`); }, what);
  const remove = (p) => act(async () => { await backend().remove(C.full, p.id).catch(() => {}); await deleteDoc(C.photos, p.id, p.code); }, p.code + ' deleted');

  const toggle = (id) => setPicking((s) => { const ids = new Set(s.ids); ids.has(id) ? ids.delete(id) : ids.add(id); return { ...s, ids }; });

  return (<>
    {canEdit && !picking && <Uploader cfg={cfg} />}
    {picking && (
      <Note tone="blue">
        <b>{picking.set ? `Editing selection “${picking.set.name}”` : 'Choose photos for a client'}</b> — tap photos to add or remove them, then save. The client gets a link that shows only these photos.
      </Note>
    )}
    <Card
      title={picking ? `${picking.ids.size} selected` : 'Photos'}
      actions={<>
        <input type="search" placeholder="Search code or title" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 200 }} />
        {!picking && <button className="btn sm" onClick={() => setPicking({ ids: new Set() })}>Make a client selection</button>}
      </>}
    >
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={'chip' + (filter === 'all' ? ' on' : '')} onClick={() => setFilter('all')}>All<span>{photos.length}</span></button>
        {cats.map((c) => <button key={c.k} className={'chip' + (filter === c.k ? ' on' : '')} onClick={() => setFilter(c.k)}>{c.n}<span>{counts[c.k] || 0}</span></button>)}
      </div>
      {!picking && photos.length > 0 && <p className="muted small" style={{ marginTop: 0 }}>Pinned photos show first and become the category's cover photo. Hidden photos stay here but clients can't see them.</p>}
      {!shown.length ? <Empty>{photos.length ? 'No photos match.' : 'No photos yet. Add your first ones above.'}</Empty> : (
        <div className="gal-grid">
          {shown.map((p) => picking ? (
            <button key={p.id} className={'gal-pick' + (picking.ids.has(p.id) ? ' on' : '')} onClick={() => toggle(p.id)} aria-pressed={picking.ids.has(p.id)}>
              {isImgData(p.thumb) && <img src={p.thumb} alt={p.code} loading="lazy" />}
              <span className="gal-code">{p.code}</span>
              <span className="gal-tick">✓</span>
              {p.hidden && <span className="gal-flag">Hidden</span>}
            </button>
          ) : (
            <PhotoCard key={p.id} p={p} cats={cats} canEdit={canEdit} onOpen={() => setView(p)} save={save} remove={remove} />
          ))}
        </div>
      )}
    </Card>
    {picking && <PickBar picking={picking} setPicking={setPicking} photos={photos} />}
    {view && <Viewer p={view} catName={catName} onClose={() => setView(null)} />}
  </>);
}

function PhotoCard({ p, cats, canEdit, onOpen, save, remove }) {
  const [title, setTitle] = useState(p.title || '');
  const [arm, setArm] = useState(false);
  return (
    <div className={'gal-card' + (p.hidden ? ' hid' : '')}>
      <button className="gal-img" onClick={onOpen} aria-label={'View ' + p.code}>
        {isImgData(p.thumb) && <img src={p.thumb} alt={p.code} loading="lazy" />}
        <span className="gal-code">{p.code}</span>
        <span className="gal-flags">{p.pin && <span>Pinned</span>}{p.hidden && <span>Hidden</span>}</span>
      </button>
      {canEdit && (
        <div className="gal-body">
          <input value={title} placeholder="Title (optional)" aria-label={'Title for ' + p.code}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => title.trim() !== (p.title || '') && save(p, { title: title.trim() }, 'Title saved')} />
          <select value={p.cat} aria-label={'Category for ' + p.code} onChange={(e) => save(p, { cat: e.target.value }, 'Moved to ' + (cats.find((c) => c.k === e.target.value)?.n || ''))}>
            {cats.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}
            {!cats.some((c) => c.k === p.cat) && <option value={p.cat}>(removed category)</option>}
          </select>
          <div className="gal-acts">
            <button className={'btn sm ' + (p.pin ? '' : 'ghost')} onClick={() => save(p, { pin: !p.pin }, p.pin ? 'Unpinned' : 'Pinned')}>{p.pin ? 'Unpin' : 'Pin'}</button>
            <button className={'btn sm ' + (p.hidden ? '' : 'ghost')} onClick={() => save(p, { hidden: !p.hidden }, p.hidden ? 'Now visible to clients' : 'Hidden from clients')}>{p.hidden ? 'Show' : 'Hide'}</button>
            <button className={'btn sm ' + (arm ? 'danger-btn' : 'ghost danger')} onClick={() => { if (arm) remove(p); else { setArm(true); setTimeout(() => setArm(false), 3500); } }}>{arm ? 'Confirm' : 'Delete'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Viewer({ p, catName, onClose }) {
  const [src, setSrc] = useState(p.thumb);
  React.useEffect(() => { let on = true; getOne(C.full, p.id).then((f) => on && isImgData(f?.data) && setSrc(f.data)).catch(() => {}); return () => { on = false; }; }, [p.id]);
  return (
    <div className="lightbox" onClick={onClose}>
      <img src={src} alt={p.code} />
      <span>{p.code}{p.title ? ' · ' + p.title : ''} · {catName(p.cat)}{p.hidden ? ' · hidden' : ''}</span>
    </div>
  );
}

/* ---------- uploader ---------- */
function Uploader({ cfg }) {
  const [cat, setCat] = useState(cfg.categories[0]?.k || '');
  const [title, setTitle] = useState('');
  const [queue, setQueue] = useState([]); // {key, name, status, ok}
  const busy = queue.some((j) => j.ok == null);
  const setJob = (key, patch) => setQueue((q) => q.map((j) => (j.key === key ? { ...j, ...patch } : j)));

  const onFiles = async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/'));
    e.target.value = '';
    if (!files.length) return;
    const c = cfg.categories.find((x) => x.k === cat);
    if (!c) { toast('Choose a category first', 'err'); return; }
    const jobs = files.map((f, i) => ({ key: Date.now() + '-' + i, name: f.name, status: 'Waiting…', ok: null, f }));
    setQueue((q) => [...jobs, ...q].slice(0, 60));
    let done = 0;
    for (const j of jobs) {
      try {
        setJob(j.key, { status: 'Resizing…' });
        const { full, thumb } = await preparePhoto(j.f, { small: DEMO });
        setJob(j.key, { status: 'Uploading…' });
        const code = fmtCode(c.p, await nextSerial('GAL_' + c.p, 1));
        const id = uid();
        await setQuiet(C.full, id, { data: full.data }, false);
        try {
          await setQuiet(C.photos, id, { code, cat: c.k, title: title.trim(), thumb: thumb.data, w: full.w, h: full.h, pin: false, hidden: false, at: Date.now() }, false);
        } catch (err) { await backend().remove(C.full, id).catch(() => {}); throw err; }
        logAudit('Uploaded', C.photos, `${code} (${c.n})`);
        setJob(j.key, { status: '✓ ' + code, ok: true });
        done++;
      } catch (err) {
        console.error(err);
        const perm = String(err?.code || '').includes('permission');
        setJob(j.key, { status: perm ? '✗ No permission' : '✗ ' + (err.message?.length < 60 ? err.message : 'Upload failed'), ok: false });
      }
    }
    if (done) toast(`${done} photo${done > 1 ? 's' : ''} added to ${c.n}`);
  };

  return (
    <Card title="Add photos">
      <div className="form-grid">
        <Field label="Category">
          <select value={cat} onChange={(e) => setCat(e.target.value)}>{cfg.categories.map((c) => <option key={c.k} value={c.k}>{c.n}</option>)}</select>
        </Field>
        <Field label="Title for these photos (optional)" hint="Shown to clients, e.g. “Gold mirror cabin, Jaipur”. Don't put client names here.">
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Gold mirror cabin" />
        </Field>
      </div>
      <label className={'gal-drop' + (busy ? ' busy' : '')}>
        <b>{busy ? 'Uploading…' : 'Choose photos'}</b>
        <span className="muted small">Select many at once. Each photo is resized automatically and gets a code like {fmtCode(cfg.categories.find((c) => c.k === cat)?.p || 'CAB', 1)}.</span>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={onFiles} disabled={busy} />
      </label>
      {queue.length > 0 && (
        <ul className="gal-queue">
          {queue.map((j) => <li key={j.key} className={j.ok === true ? 'ok-text' : j.ok === false ? 'danger-text' : 'muted'}><span>{j.name}</span><span>{j.status}</span></li>)}
        </ul>
      )}
    </Card>
  );
}

/* ---------- client selections ---------- */
function PickBar({ picking, setPicking, photos }) {
  const [name, setName] = useState(picking.set?.name || '');
  const [ask, setAsk] = useState(false);
  const [made, setMade] = useState(null);
  const ids = [...picking.ids].filter((id) => photos.some((p) => p.id === id));
  const saveSet = () => act(async () => {
    if (picking.set) { await setDoc(C.sets, picking.set.id, { name: name.trim(), ids }, true, 'Gallery selection'); return picking.set.id; }
    return addDoc(C.sets, { name: name.trim(), ids, at: Date.now() }, 'Gallery selection: ' + name.trim());
  }, picking.set ? 'Selection updated' : 'Selection created').then((id) => { setAsk(false); setMade({ id, name: name.trim() }); });

  return (<>
    <div className="gal-pickbar">
      <b>{ids.length} photo{ids.length === 1 ? '' : 's'} selected</b>
      <span className="spacer" />
      <button className="btn ghost sm" onClick={() => setPicking(null)}>Cancel</button>
      <button className="btn sm" disabled={!ids.length} onClick={() => setAsk(true)}>{picking.set ? 'Save changes' : 'Create link'}</button>
    </div>
    {ask && (
      <Modal title={picking.set ? 'Update selection' : 'New client selection'} onClose={() => setAsk(false)}
        footer={<><button className="btn ghost" onClick={() => setAsk(false)}>Back</button><button className="btn" disabled={!name.trim()} onClick={saveSet}>{picking.set ? 'Save' : 'Create link'}</button></>}>
        <Field label="Selection name" hint="The client sees this as the heading, e.g. “Home lift options for Mr. Sharma”.">
          <input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="Home lift options for Mr. Sharma" />
        </Field>
      </Modal>
    )}
    {made && <ShareSet set={made} onClose={() => { setMade(null); setPicking(null); go('gallery/selections'); }} />}
  </>);
}

function ShareSet({ set, onClose }) {
  const link = galleryUrl(set.id);
  return (
    <Modal title="Send to your client" onClose={onClose} footer={<button className="btn" onClick={onClose}>Done</button>}>
      <p>This link shows only the photos in <b>{set.name}</b>. The client can still open the full gallery from there.</p>
      <input readOnly value={link} onFocus={(e) => e.target.select()} />
      <div className="row gap wrap mt">
        <button className="btn ghost" onClick={() => copy(link)}>Copy link</button>
        <a className="btn wa-btn" href={waLink('', `${set.name}: ${link}`)} target="_blank" rel="noreferrer">Send on WhatsApp</a>
      </div>
    </Modal>
  );
}

function Selections({ photos, onEdit, onNew }) {
  const sets = useCol(C.sets, [], true, { orderBy: ['at', 'desc'] });
  const [share, setShare] = useState(null);
  const [del, setDel] = useState(null);
  const thumbs = (s) => s.ids.map((id) => photos.find((p) => p.id === id)).filter(Boolean);
  return (<>
    <Card title="Client selections" actions={<button className="btn sm" onClick={onNew}>+ New selection</button>}>
      <p className="muted" style={{ marginTop: 0 }}>Pick a few photos for one client and send them a link that shows only those, instead of the whole gallery.</p>
      {!sets.length ? <Empty>No selections yet.</Empty> : (
        <div className="stack">
          {sets.map((s) => {
            const t = thumbs(s);
            return (
              <div key={s.id} className="gal-set">
                <div className="gal-set-thumbs">{t.slice(0, 4).map((p) => isImgData(p.thumb) && <img key={p.id} src={p.thumb} alt={p.code} />)}</div>
                <div className="gal-set-info">
                  <b>{s.name}</b>
                  <span className="muted small">{t.length} photo{t.length === 1 ? '' : 's'} · {fmtDate(s.at)}{s.createdByName ? ' · ' + s.createdByName : ''}</span>
                </div>
                <div className="row gap wrap">
                  <button className="btn sm wa-btn" onClick={() => setShare(s)}>Send</button>
                  <button className="btn ghost sm" onClick={() => copy(galleryUrl(s.id))}>Copy link</button>
                  <button className="btn ghost sm" onClick={() => onEdit(s)}>Edit</button>
                  <button className="btn ghost sm danger" onClick={() => setDel(s)}>Delete</button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
    {share && <ShareSet set={share} onClose={() => setShare(null)} />}
    {del && (
      <Modal title="Delete selection?" onClose={() => setDel(null)}
        footer={<><button className="btn ghost" onClick={() => setDel(null)}>Keep</button><button className="btn danger-btn" onClick={() => act(() => deleteDoc(C.sets, del.id, 'Gallery selection: ' + del.name), 'Selection deleted').then(() => setDel(null))}>Delete</button></>}>
        <p>The link for <b>{del.name}</b> will stop working. The photos themselves stay in the gallery.</p>
      </Modal>
    )}
  </>);
}

/* ---------------- Settings (Admin) ---------------- */
const slug = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 24) || 'cat';

function Settings({ cfg, photos }) {
  const [f, setF] = useState(() => ({ whatsapp: cfg.whatsapp, intro: cfg.intro, categories: cfg.categories.map((c) => ({ ...c })) }));
  const used = (k) => photos.filter((p) => p.cat === k).length;
  const setCat = (i, patch) => setF((x) => ({ ...x, categories: x.categories.map((c, j) => (j === i ? { ...c, ...patch } : c)) }));
  const move = (i, d) => setF((x) => { const a = [...x.categories]; const j = i + d; if (j < 0 || j >= a.length) return x; [a[i], a[j]] = [a[j], a[i]]; return { ...x, categories: a }; });
  const add = () => setF((x) => {
    let k = 'new', n = 1; while (x.categories.some((c) => c.k === k)) k = 'new' + ++n;
    return { ...x, categories: [...x.categories, { k, n: '', p: '', d: '', fresh: true }] };
  });
  const drop = (i) => setF((x) => ({ ...x, categories: x.categories.filter((_, j) => j !== i) }));
  const save = () => {
    const keys = new Set();
    const categories = f.categories.map((c) => {
      let k = c.fresh ? slug(c.n) : c.k;
      while (keys.has(k)) k += '-2';
      keys.add(k);
      return { k, n: c.n.trim(), p: (c.p || c.n.slice(0, 3)).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5) || 'GAL', d: (c.d || '').trim() };
    });
    if (categories.some((c) => !c.n)) { toast('Every category needs a name', 'err'); return; }
    act(() => setDoc(C.config, 'main', { whatsapp: f.whatsapp.trim(), intro: f.intro.trim(), categories }, false, 'Gallery settings'), 'Gallery settings saved')
      .then(() => setF((x) => ({ ...x, categories: categories.map((c) => ({ ...c })) })));
  };
  return (
    <Card title="Categories & settings" actions={<button className="btn sm" onClick={save}>Save</button>}>
      <div className="form-grid">
        <Field label="WhatsApp number for enquiries" hint="With country code, e.g. 91 98372 21980. Client shortlists are sent here.">
          <input value={f.whatsapp} onChange={(e) => setF({ ...f, whatsapp: e.target.value })} />
        </Field>
        <Field label="Intro text on the gallery">
          <textarea rows={3} value={f.intro} onChange={(e) => setF({ ...f, intro: e.target.value })} />
        </Field>
      </div>
      <h3 className="mt">Categories</h3>
      <p className="muted small">Order here is the order clients see. The code prefix starts every photo code (CAB → CAB-001); changing it only affects new photos. A category with photos can't be removed — move its photos first.</p>
      <div className="gal-cats">
        {f.categories.map((c, i) => (
          <div key={c.k + i} className="gal-cat-row">
            <div className="row gap"><button className="btn ghost sm" onClick={() => move(i, -1)} aria-label="Move up">↑</button><button className="btn ghost sm" onClick={() => move(i, 1)} aria-label="Move down">↓</button></div>
            <input value={c.n} placeholder="Name, e.g. Cabin interiors" onChange={(e) => setCat(i, { n: e.target.value })} aria-label="Category name" />
            <input value={c.p} placeholder="Code" onChange={(e) => setCat(i, { p: e.target.value.toUpperCase() })} aria-label="Code prefix" className="gal-prefix" />
            <input value={c.d} placeholder="Short description for clients" onChange={(e) => setCat(i, { d: e.target.value })} aria-label="Description" />
            <span className="muted small gal-used">{used(c.k)} photos</span>
            <button className="btn ghost sm danger" disabled={used(c.k) > 0} onClick={() => drop(i)} title={used(c.k) ? 'Move or delete its photos first' : 'Remove category'}>Remove</button>
          </div>
        ))}
      </div>
      <button className="btn ghost sm mt" onClick={add}>+ Add category</button>
    </Card>
  );
}
