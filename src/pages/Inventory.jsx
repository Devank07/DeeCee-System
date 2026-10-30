import React, { useState } from 'react';
import { useCol, PageHeader, Card, DataTable, Modal, Field, Select, useForm, act, go, Badge, Tabs, Stat, PrintDoc, useSettings, Note } from '../ui';
import { addDoc, updateDoc, deleteDoc, nextNumber, postActivity, inc, me } from '../data';
import { ITEM_CATEGORIES, UNITS, PO_STATUSES } from '../constants';
import { inr, fmtDate, fmtDateTime, today, addDays, num, sum, calcTotals, waLink } from '../utils';

export default function Inventory({ user, params }) {
  const tab = ['po', 'dispatch', 'vendors', 'ledger'].includes(params[0]) ? params[0] : 'items';
  const items = useCol('items');
  const pos = useCol('purchaseOrders', [['status', 'in', ['Draft', 'Ordered']]]);
  const ready = useCol('projects', [['status', '==', 'Order']]).filter((p) => p.advance?.confirmed && p.site?.status === 'Ready' && !['Dispatched', 'Delivered'].includes(p.material?.status));
  const canWrite = ['admin', 'stores'].includes(user.role);
  return (
    <div className="page">
      <PageHeader title="Material & Stock" sub="Stock, vendors, purchase orders and dispatch to sites" />
      <div className="stats">
        <Stat label="Ready to dispatch" value={ready.length} sub="Advance received & site ready" tone={ready.length ? 'amber' : ''} onClick={() => go('orders')} />
        <Stat label="Stock value" value={inr(sum(items, (i) => num(i.stock) * num(i.rate)))} sub={`${items.length} items`} />
        <Stat label="Low stock" value={items.filter((i) => num(i.stock) <= num(i.minStock)).length} tone={items.some((i) => num(i.stock) <= num(i.minStock)) ? 'red' : ''} onClick={() => go('inventory/items')} />
        <Stat label="Open POs" value={pos.filter((p) => p.status === 'Ordered').length} sub={inr(sum(pos.filter((p) => p.status === 'Ordered'), (p) => calcTotals(p.items, p.gstRate).total))} onClick={() => go('inventory/po')} />
      </div>
      {ready.length > 0 && (
        <Card title="Ready to dispatch — site is ready and advance received">
          <ul className="list">{ready.map((p) => <li key={p.id} className="clickable" onClick={() => go('orders/' + p.id)}><div><b>{p.clientName}</b><div className="muted small">{p.title} · {p.code} · {p.siteAddress}</div></div><Badge>{p.material?.status || 'Pending'}</Badge></li>)}</ul>
        </Card>
      )}
      <Tabs value={tab} onChange={(k) => go('inventory/' + k)} tabs={[{ key: 'items', label: 'Stock' }, { key: 'po', label: 'Purchase orders' }, { key: 'dispatch', label: 'Dispatch challans' }, { key: 'vendors', label: 'Vendors' }, { key: 'ledger', label: 'Stock ledger' }]} />
      {tab === 'items' && <Items items={items} canWrite={canWrite} />}
      {tab === 'po' && <POs items={items} canWrite={canWrite} />}
      {tab === 'dispatch' && <Dispatches canWrite={canWrite} />}
      {tab === 'vendors' && <Vendors canWrite={canWrite} />}
      {tab === 'ledger' && <Ledger />}
    </div>
  );
}

/* Stock changes use server-side increments, so two people moving stock at once can't overwrite each other */
async function moveStock(items, lines, sign, type, ref, projectId) {
  for (const l of lines) {
    const it = items.find((x) => x.id === l.itemId);
    if (!it || !num(l.qty)) continue;
    await updateDoc('items', it.id, { stock: inc(sign * num(l.qty)) }, it.name);
    await addDoc('stockMoves', { itemId: it.id, itemName: it.name, qty: sign * num(l.qty), type, ref, projectId: projectId || null, at: Date.now(), byName: me()?.name || '' }, ref);
  }
}

/* ---------- ITEMS ---------- */
function Items({ items, canWrite }) {
  const [form, setForm] = useState(null);
  const [adjust, setAdjust] = useState(null);
  return (
    <>
      {canWrite && <div className="chips"><span className="spacer" /><button className="btn" onClick={() => setForm({})}>+ New item</button></div>}
      <Card pad={false}>
        <DataTable
          csvName="stock" rows={items} onRow={canWrite ? (r) => setForm(r) : undefined} initialSort={{ key: 'name' }}
          columns={[
            { key: 'code', label: 'Code' },
            { key: 'name', label: 'Item', render: (r) => <><b>{r.name}</b><div className="muted small">{r.category}</div></>, csv: (r) => r.name },
            { key: 'stock', label: 'In stock', align: 'r', render: (r) => <span className={num(r.stock) <= num(r.minStock) ? 'danger-text' : ''}><b>{r.stock}</b> {r.unit}</span>, sortValue: (r) => num(r.stock), csv: (r) => r.stock },
            { key: 'minStock', label: 'Min', align: 'r' },
            { key: 'rate', label: 'Rate', align: 'r', value: (r) => inr(r.rate), sortValue: (r) => num(r.rate), csv: (r) => r.rate },
            { key: 'val', label: 'Value', align: 'r', value: (r) => inr(num(r.stock) * num(r.rate)), sortValue: (r) => num(r.stock) * num(r.rate), csv: (r) => num(r.stock) * num(r.rate) },
            { key: 'act', label: '', noExport: true, render: (r) => canWrite && <button className="btn ghost sm" onClick={(e) => { e.stopPropagation(); setAdjust(r); }}>Adjust</button> },
          ]}
        />
      </Card>
      {form && <ItemForm item={form.id ? form : null} onClose={() => setForm(null)} />}
      {adjust && <AdjustForm item={adjust} items={items} onClose={() => setAdjust(null)} />}
    </>
  );
}
function ItemForm({ item, onClose }) {
  const { f, bind } = useForm(item || { code: '', name: '', category: ITEM_CATEGORIES[0], unit: 'Nos', stock: 0, minStock: 0, rate: 0 });
  const [del, setDel] = useState(false);
  const save = async () => {
    if (!f.name) return act(async () => { throw new Error('Item name is required'); });
    const data = { code: f.code || '', name: f.name, category: f.category, unit: f.unit, minStock: num(f.minStock), rate: num(f.rate), ...(item ? {} : { stock: num(f.stock) }) };
    if (item) await act(() => updateDoc('items', item.id, data, data.name), 'Item saved');
    else await act(() => addDoc('items', data, data.name), 'Item added');
    onClose();
  };
  return (
    <Modal title={item ? 'Edit item' : 'New item'} onClose={onClose} footer={<>{item && (del ? <button className="btn danger-btn" onClick={() => act(() => deleteDoc('items', item.id, item.name), 'Deleted').then(onClose)}>Confirm delete</button> : <button className="btn ghost danger" onClick={() => setDel(true)}>Delete</button>)}<span className="spacer" /><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Item name *" span={2}><input {...bind('name')} /></Field>
        <Field label="Code"><input {...bind('code')} /></Field>
        <Field label="Category"><Select options={ITEM_CATEGORIES} placeholder={false} {...bind('category')} /></Field>
        <Field label="Unit"><Select options={UNITS} placeholder={false} {...bind('unit')} /></Field>
        <Field label="Purchase rate (₹)"><input type="number" {...bind('rate', 'number')} /></Field>
        {!item && <Field label="Opening stock"><input type="number" {...bind('stock', 'number')} /></Field>}
        <Field label="Minimum stock (alert)"><input type="number" {...bind('minStock', 'number')} /></Field>
      </div>
      {item && <p className="muted small">To change the quantity use “Adjust”, so every change is recorded in the stock ledger.</p>}
    </Modal>
  );
}
function AdjustForm({ item, items, onClose }) {
  const [qty, setQty] = useState('');
  const [dir, setDir] = useState('in');
  const [reason, setReason] = useState('');
  const save = async () => {
    if (!num(qty)) return act(async () => { throw new Error('Enter quantity'); });
    await act(() => moveStock(items, [{ itemId: item.id, qty: num(qty) }], dir === 'in' ? 1 : -1, 'Adjustment' + (reason ? ': ' + reason : ''), 'Manual'), 'Stock adjusted');
    onClose();
  };
  return (
    <Modal title={'Adjust stock — ' + item.name} onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <p className="muted">Current stock: <b>{item.stock} {item.unit}</b></p>
      <div className="form-grid">
        <Field label="Direction"><Select options={[{ value: 'in', label: 'Add (+)' }, { value: 'out', label: 'Remove (−)' }]} placeholder={false} value={dir} onChange={(e) => setDir(e.target.value)} /></Field>
        <Field label="Quantity"><input type="number" value={qty} onChange={(e) => setQty(e.target.value)} autoFocus /></Field>
        <Field label="Reason" span={2}><input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stock count, damaged, used in service…" /></Field>
      </div>
    </Modal>
  );
}

function ItemLines({ lines, onChange, items, withRate }) {
  const upd = (i, patch) => onChange(lines.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  return (
    <div className="lines">
      <div className="table-scroll">
        <table className="lines-table">
          <thead><tr><th>Item</th><th className="r" style={{ width: 90 }}>Qty</th>{withRate && <th className="r" style={{ width: 120 }}>Rate</th>}<th className="r" style={{ width: 90 }}>In stock</th><th style={{ width: 36 }} /></tr></thead>
          <tbody>
            {lines.map((l, i) => {
              const it = items.find((x) => x.id === l.itemId);
              return (
                <tr key={i}>
                  <td><Select options={items.map((x) => ({ value: x.id, label: `${x.name}${x.code ? ' (' + x.code + ')' : ''}` }))} value={l.itemId || ''} onChange={(e) => { const x = items.find((y) => y.id === e.target.value); upd(i, { itemId: e.target.value, name: x?.name || '', rate: l.rate || x?.rate || 0 }); }} /></td>
                  <td><input type="number" className="r" value={l.qty} onChange={(e) => upd(i, { qty: e.target.value })} /></td>
                  {withRate && <td><input type="number" className="r" value={l.rate} onChange={(e) => upd(i, { rate: e.target.value })} /></td>}
                  <td className={'r ' + (it && !withRate && num(l.qty) > num(it.stock) ? 'danger-text' : 'muted')}>{it ? it.stock + ' ' + it.unit : '—'}</td>
                  <td><button className="icon-btn" onClick={() => onChange(lines.filter((_, j) => j !== i))}>✕</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <button className="btn ghost sm" onClick={() => onChange([...lines, { itemId: '', name: '', qty: 1, rate: 0 }])}>+ Add item</button>
    </div>
  );
}

/* ---------- PURCHASE ORDERS ---------- */
function POs({ items, canWrite }) {
  const [showAll, setShowAll] = useState(false);
  const pos = useCol('purchaseOrders', showAll ? [] : [['status', 'in', ['Draft', 'Ordered']]]);
  const [form, setForm] = useState(null);
  return (
    <>
      <div className="chips">
        <button className={'chip' + (!showAll ? ' on' : '')} onClick={() => setShowAll(false)}>Open</button>
        <button className={'chip' + (showAll ? ' on' : '')} onClick={() => setShowAll(true)}>All</button>
        <span className="spacer" />{canWrite && <button className="btn" onClick={() => setForm({})}>+ New purchase order</button>}
      </div>
      <Card pad={false}>
        <DataTable
          csvName="purchase-orders" rows={pos} onRow={(r) => setForm(r)} initialSort={{ key: 'date', desc: true }}
          columns={[
            { key: 'number', label: 'PO' },
            { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
            { key: 'vendorName', label: 'Vendor' },
            { key: 'items', label: 'Items', value: (r) => r.items.map((i) => `${i.name} × ${i.qty}`).join(', ') },
            { key: 'total', label: 'Total', align: 'r', value: (r) => inr(calcTotals(r.items, r.gstRate).total), csv: (r) => calcTotals(r.items, r.gstRate).total },
            { key: 'expectedDate', label: 'Expected', value: (r) => fmtDate(r.expectedDate), csv: (r) => r.expectedDate },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
      {form && <POForm key={form.id || 'new'} po={form.id ? form : null} items={items} canWrite={canWrite} onClose={() => setForm(null)} />}
    </>
  );
}
function POForm({ po, items, canWrite, onClose }) {
  const company = useSettings();
  const vendors = useCol('vendors');
  const projects = useCol('projects', [['status', '==', 'Order']]);
  const { f, setF, bind } = useForm(po || { vendorId: '', projectId: '', date: today(), expectedDate: addDays(today(), 10), status: 'Draft', items: [{ itemId: '', name: '', qty: 1, rate: 0 }], gstRate: 18, notes: '' });
  const [print, setPrint] = useState(false);
  const [confirmRecv, setConfirmRecv] = useState(false);
  const locked = po && ['Received', 'Cancelled'].includes(po.status);
  const t = calcTotals(f.items, f.gstRate);
  const save = async (statusOverride) => {
    if (!f.vendorId) return act(async () => { throw new Error('Select vendor'); });
    const v = vendors.find((x) => x.id === f.vendorId);
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    Object.assign(data, { vendorName: v?.name, vendorPhone: v?.phone || '', items: data.items.filter((l) => l.itemId), total: t.total });
    if (statusOverride) data.status = statusOverride;
    if (po) await act(() => updateDoc('purchaseOrders', po.id, data, data.number), 'PO saved');
    else { data.number = await nextNumber('PO'); await act(() => addDoc('purchaseOrders', data, data.number), 'PO created'); }
    if (statusOverride === 'Ordered' && data.projectId) {
      const p = projects.find((x) => x.id === data.projectId);
      if (p && ['Pending', undefined].includes(p.material?.status)) await updateDoc('projects', p.id, { material: { ...(p.material || {}), status: 'Procuring', at: Date.now(), by: me()?.name || '' } }, p.code);
    }
    onClose();
  };
  const receive = async () => {
    await act(async () => {
      await moveStock(items, f.items, 1, 'Purchase', f.number, f.projectId);
      await updateDoc('purchaseOrders', po.id, { status: 'Received', receivedAt: Date.now() }, f.number);
      if (f.projectId) { const p = projects.find((x) => x.id === f.projectId); await postActivity({ projectId: f.projectId, clientId: p?.clientId || null, text: `Material received at store against ${f.number} (${f.vendorName}).`, visibleToClient: false, kind: 'material' }); }
    }, 'Stock updated');
    onClose();
  };
  const v = vendors.find((x) => x.id === f.vendorId);
  return (
    <>
      <Modal title={po ? 'Purchase order ' + po.number : 'New purchase order'} wide onClose={onClose}
        footer={<>
          {po && canWrite && po.status === 'Draft' && <button className="btn ghost danger" onClick={() => act(() => deleteDoc('purchaseOrders', po.id, po.number), 'Deleted').then(onClose)}>Delete draft</button>}
          <span className="spacer" />
          {po && <button className="btn ghost" onClick={() => setPrint(true)}>Print / PDF</button>}
          {po && v?.phone && <a className="btn ghost" target="_blank" rel="noreferrer" href={waLink(v.phone, `Purchase Order ${po.number} from ${company.name}:\n${f.items.map((i) => `• ${i.name} × ${i.qty}`).join('\n')}\nRequired by ${fmtDate(f.expectedDate)}. Please confirm.`)}>WhatsApp vendor</a>}
          {canWrite && po?.status === 'Ordered' && (confirmRecv ? <button className="btn" onClick={receive}>Yes, add to stock</button> : <button className="btn ghost" onClick={() => setConfirmRecv(true)}>Mark received → stock</button>)}
          {canWrite && !locked && <button className="btn ghost" onClick={() => save()}>Save</button>}
          {canWrite && !locked && f.status === 'Draft' && <button className="btn" onClick={() => save('Ordered')}>Save & mark Ordered</button>}
        </>}>
        <fieldset disabled={locked || !canWrite} className="plain">
          <div className="form-grid four">
            <Field label="Vendor *" span={2}><Select options={vendors.map((x) => ({ value: x.id, label: x.name }))} {...bind('vendorId')} /></Field>
            <Field label="For order (optional)" span={2}><Select options={projects.map((p) => ({ value: p.id, label: p.code + ' · ' + p.clientName }))} {...bind('projectId')} /></Field>
            <Field label="PO date"><input type="date" {...bind('date')} /></Field>
            <Field label="Expected delivery"><input type="date" {...bind('expectedDate')} /></Field>
            <Field label="Status"><Select options={PO_STATUSES} placeholder={false} {...bind('status')} /></Field>
            <Field label="GST %"><input type="number" {...bind('gstRate', 'number')} /></Field>
          </div>
          <ItemLines lines={f.items} onChange={(v2) => setF((p) => ({ ...p, items: v2 }))} items={items} withRate />
          <p className="r">Subtotal {inr(t.subtotal)} · GST {inr(t.gst)} · <b>Total {inr(t.total)}</b></p>
          <Field label="Notes / terms"><textarea rows={2} {...bind('notes')} /></Field>
        </fieldset>
        {confirmRecv && <Note>Received quantities will be added to stock. Click “Yes, add to stock” to confirm.</Note>}
      </Modal>
      {print && <PrintDoc kind="Purchase Order" company={company} onClose={() => setPrint(false)} doc={{ ...f, clientName: v?.name, address: v?.address, phone: v?.phone, clientGstin: v?.gstin, items: f.items.map((i) => ({ ...i, desc: i.name })), terms: f.notes }} />}
    </>
  );
}

/* ---------- DISPATCH ---------- */
function Dispatches({ canWrite }) {
  const rows = useCol('dispatches', [['date', '>=', addDays(today(), -365)]], true, { orderBy: ['date', 'desc'] });
  const [view, setView] = useState(null);
  return (
    <>
      <p className="muted small">To dispatch material, open the order and use “Dispatch to site” — it unlocks once the advance is received and the site is ready.</p>
      <Card pad={false}>
        <DataTable
          csvName="dispatches" rows={rows} onRow={setView} initialSort={{ key: 'date', desc: true }}
          columns={[
            { key: 'number', label: 'Challan' },
            { key: 'date', label: 'Date', value: (r) => fmtDate(r.date), sortValue: (r) => r.date, csv: (r) => r.date },
            { key: 'clientName', label: 'Site', render: (r) => <>{r.clientName}<div className="muted small">{r.projectCode}</div></>, csv: (r) => r.clientName },
            { key: 'items', label: 'Material', value: (r) => r.items.map((i) => `${i.name} × ${i.qty}`).join(', ') },
            { key: 'vehicle', label: 'Vehicle' },
            { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge>, csv: (r) => r.status },
          ]}
        />
      </Card>
      {view && <ChallanView d={view} canWrite={canWrite} onClose={() => setView(null)} />}
    </>
  );
}
function ChallanView({ d, onClose }) {
  const company = useSettings();
  const [print, setPrint] = useState(false);
  return (
    <>
      <Modal title={'Delivery challan ' + d.number} onClose={onClose} footer={<><button className="btn ghost" onClick={() => go('orders/' + d.projectId)}>Open order</button><button className="btn" onClick={() => setPrint(true)}>Print challan</button></>}>
        <dl className="dl">
          <dt>Site</dt><dd>{d.clientName} · {d.siteAddress}</dd>
          <dt>Date</dt><dd>{fmtDate(d.date)}</dd>
          <dt>Vehicle</dt><dd>{d.vehicle || '—'} {d.driver && '· ' + d.driver}</dd>
          <dt>Status</dt><dd><Badge>{d.status}</Badge></dd>
        </dl>
        <ul className="list">{d.items.map((i, k) => <li key={k}><span>{i.name}</span><b>{i.qty}</b></li>)}</ul>
      </Modal>
      {print && <PrintDoc kind="Delivery Challan" company={company} onClose={() => setPrint(false)} doc={{ ...d, items: d.items.map((i) => ({ ...i, desc: i.name })) }} />}
    </>
  );
}

export function DispatchForm({ preset = {}, onClose }) {
  const items = useCol('items');
  const projects = useCol('projects', [['status', '==', 'Order']]);
  const { f, setF, bind } = useForm({ projectId: preset.projectId || '', date: today(), vehicle: '', driver: '', items: [{ itemId: '', name: '', qty: 1 }], notes: '' });
  const [shortOk, setShortOk] = useState(false);
  const p = projects.find((x) => x.id === f.projectId);
  const lines = f.items.filter((l) => l.itemId && num(l.qty) > 0);
  const short = lines.filter((l) => num(l.qty) > num(items.find((x) => x.id === l.itemId)?.stock));
  const gateOk = p && p.advance?.confirmed && p.site?.status === 'Ready';
  const save = async () => {
    if (!p) return act(async () => { throw new Error('Select the order'); });
    if (!gateOk && me()?.role !== 'admin') return act(async () => { throw new Error('Dispatch unlocks after the advance is received and the site is marked ready'); });
    if (!lines.length) return act(async () => { throw new Error('Add the items being sent'); });
    if (short.length && !shortOk) return act(async () => { throw new Error('Not enough stock for some items — tick the box to dispatch anyway'); });
    await act(async () => {
      const number = await nextNumber('DSP');
      await addDoc('dispatches', { ...f, items: lines, number, projectCode: p.code, clientName: p.clientName, siteAddress: p.siteAddress, status: 'Dispatched' }, number);
      await moveStock(items, lines, -1, 'Dispatch', number, p.id);
      await updateDoc('projects', p.id, { material: { ...(p.material || {}), status: 'Dispatched', at: Date.now(), by: me()?.name || '', challan: number } }, p.code);
      await postActivity({ projectId: p.id, clientId: p.clientId, text: `Material dispatched to site (${number}): ${lines.map((l) => `${l.name} × ${l.qty}`).join(', ')}${f.vehicle ? ' · Vehicle ' + f.vehicle : ''}.`, visibleToClient: true, teamId: p.teamId || null, kind: 'material' });
    }, 'Dispatched — client and site team informed');
    onClose();
  };
  return (
    <Modal title="Dispatch material to site" wide onClose={onClose} footer={<><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Dispatch & reduce stock</button></>}>
      <div className="form-grid four">
        <Field label="Order *" span={2}><Select options={projects.map((x) => ({ value: x.id, label: `${x.code} · ${x.clientName}` }))} {...bind('projectId')} /></Field>
        <Field label="Date"><input type="date" {...bind('date')} /></Field>
        <Field label="Vehicle no."><input {...bind('vehicle')} /></Field>
        <Field label="Driver / transporter" span={2}><input {...bind('driver')} /></Field>
        <Field label="Notes" span={2}><input {...bind('notes')} /></Field>
      </div>
      {p && <p className="muted small">Deliver to: {p.siteAddress} · Site team: {p.teamName || 'not assigned'}</p>}
      {p && !gateOk && <Note tone="red">{!p.advance?.confirmed ? 'Advance is not confirmed yet. ' : ''}{p.site?.status !== 'Ready' ? 'The installation team has not marked the site ready. ' : ''}Only the Admin can dispatch now.</Note>}
      <ItemLines lines={f.items} onChange={(v) => setF((x) => ({ ...x, items: v }))} items={items} />
      {short.length > 0 && <label className="check"><input type="checkbox" checked={shortOk} onChange={(e) => setShortOk(e.target.checked)} /> Not enough stock for {short.map((s) => s.name).join(', ')} — dispatch anyway (stock goes negative)</label>}
    </Modal>
  );
}

/* ---------- VENDORS ---------- */
function Vendors({ canWrite }) {
  const vendors = useCol('vendors');
  const [form, setForm] = useState(null);
  return (
    <>
      {canWrite && <div className="chips"><span className="spacer" /><button className="btn" onClick={() => setForm({})}>+ New vendor</button></div>}
      <Card pad={false}>
        <DataTable csvName="vendors" rows={vendors} onRow={canWrite ? setForm : undefined} initialSort={{ key: 'name' }}
          columns={[{ key: 'name', label: 'Vendor' }, { key: 'supplies', label: 'Supplies' }, { key: 'contactPerson', label: 'Contact' }, { key: 'phone', label: 'Phone' }, { key: 'gstin', label: 'GSTIN' }]} />
      </Card>
      {form && <VendorForm v={form.id ? form : null} onClose={() => setForm(null)} />}
    </>
  );
}
function VendorForm({ v, onClose }) {
  const { f, bind } = useForm(v || { name: '', contactPerson: '', phone: '', email: '', gstin: '', address: '', supplies: '' });
  const save = async () => {
    if (!f.name) return act(async () => { throw new Error('Vendor name is required'); });
    const { id, createdAt, createdBy, createdByName, updatedAt, updatedBy, ...data } = f;
    if (v) await act(() => updateDoc('vendors', v.id, data, data.name), 'Saved'); else await act(() => addDoc('vendors', data, data.name), 'Vendor added');
    onClose();
  };
  return (
    <Modal title={v ? 'Edit vendor' : 'New vendor'} onClose={onClose} footer={<><span className="spacer" /><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>Save</button></>}>
      <div className="form-grid">
        <Field label="Vendor name *" span={2}><input {...bind('name')} /></Field>
        <Field label="Contact person"><input {...bind('contactPerson')} /></Field>
        <Field label="Phone"><input {...bind('phone')} /></Field>
        <Field label="Email"><input {...bind('email')} /></Field>
        <Field label="GSTIN"><input {...bind('gstin')} /></Field>
        <Field label="Address" span={2}><input {...bind('address')} /></Field>
        <Field label="Supplies" span={2}><input {...bind('supplies')} placeholder="Machines, doors, spares…" /></Field>
      </div>
    </Modal>
  );
}

function Ledger() {
  const moves = useCol('stockMoves', [], true, { orderBy: ['at', 'desc'], limit: 500 });
  return (
    <Card pad={false}>
      <DataTable csvName="stock-ledger" rows={moves} initialSort={{ key: 'at', desc: true }}
        columns={[
          { key: 'at', label: 'When', value: (r) => fmtDateTime(r.at), sortValue: (r) => r.at, csv: (r) => new Date(r.at).toISOString() },
          { key: 'itemName', label: 'Item' },
          { key: 'qty', label: 'Qty', align: 'r', render: (r) => <b className={r.qty < 0 ? 'danger-text' : 'ok-text'}>{r.qty > 0 ? '+' : ''}{r.qty}</b>, csv: (r) => r.qty },
          { key: 'type', label: 'Type' },
          { key: 'ref', label: 'Reference' },
          { key: 'byName', label: 'By', value: (r) => r.byName || r.createdByName || '—' },
        ]} />
      <p className="muted small pad-x">Showing the latest 500 movements.</p>
    </Card>
  );
}
