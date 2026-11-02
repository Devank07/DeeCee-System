// Reads the old Excel register (DCAGRA style) — including row colours — and turns rows into client tabs.
import { defaultProposal, specFromProposal, titleFromProposal, buildRef, cityCode, kgForPersons, DEFAULT_PAY_TERMS } from './proposal';
import { num } from './utils';

export const FIELDS = [
  ['serial', 'Quote serial no.', 'A'],
  ['buildingType', 'Building type', 'B'],
  ['address', 'Site address', 'C'],
  ['city', 'City', 'D'],
  ['name', 'Client name', 'E'],
  ['phone', 'Phone', 'F'],
  ['extra', 'Other / 2nd phone', 'G'],
  ['lifts', 'Lifts (e.g. 1(6P)HYD)', 'H'],
  ['architect', 'Architect / referred by', 'I'],
  ['date', 'Date', 'J'],
  ['spec', 'Spec (e.g. G+3,ACO/RG/GD/MRL,W=…)', 'K'],
  ['costing', 'Costing (lakh)', 'L'],
  ['price', 'Quoted price (lakh)', 'M'],
];
export const STATUS_OPTIONS = [
  { value: 'new', label: 'Quote to be given' },
  { value: 'quoted', label: 'Quote given' },
  { value: 'order', label: 'Order confirmed' },
  { value: 'skip', label: "Don't import" },
];
const CITY_STATE = { JAIPUR: 'Rajasthan', AJMER: 'Rajasthan', ALWAR: 'Rajasthan', BHARATPUR: 'Rajasthan', DELHI: 'Delhi', 'NEW DELHI': 'Delhi', GURUGRAM: 'Haryana', GURGAON: 'Haryana', FARIDABAD: 'Haryana', GWALIOR: 'Madhya Pradesh' };

const colIndex = (letter) => String(letter || '').toUpperCase().split('').reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);

function cellText(cell) {
  const v = cell?.value;
  if (v == null) return '';
  if (v instanceof Date) return v;
  if (typeof v === 'object') {
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if (v.text != null) return String(v.text);
    if (v.result != null) return v.result instanceof Date ? v.result : String(v.result);
    return '';
  }
  return String(v).trim();
}

// Colour of a row: first filled cell among the first few columns
function rowColour(row) {
  for (let c = 1; c <= 6; c++) {
    const f = row.getCell(c).fill;
    if (f && f.type === 'pattern' && f.pattern && f.pattern !== 'none') {
      const fg = f.fgColor || f.bgColor || {};
      if (fg.argb) return fg.argb.slice(-6).toUpperCase();
      if (fg.theme != null) return 'THEME' + fg.theme + (fg.tint ? '~' + Math.round(fg.tint * 10) : '');
      if (fg.indexed != null) return 'IDX' + fg.indexed;
    }
  }
  return 'FFFFFF';
}

export function guessStatus(hex) {
  if (!/^[0-9A-F]{6}$/.test(hex)) return 'skip';
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max - min < 0.06 && max > 0.85) return 'new'; // white / very light grey
  let h = 0;
  const d = max - min || 1;
  if (max === r) h = ((g - b) / d) % 6; else if (max === g) h = (b - r) / d + 2; else h = (r - g) / d + 4;
  h = (h * 60 + 360) % 360;
  if (h >= 40 && h < 70) return 'quoted'; // yellow
  if (h >= 70 && h < 170) return 'order'; // green
  return 'skip';
}
export const colourName = (hex) => ({ new: 'White', quoted: 'Yellow', order: 'Green' }[guessStatus(hex)] || (/^[0-9A-F]{6}$/.test(hex) ? 'Other colour' : 'Theme colour'));

export async function readWorkbook(file) {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(await file.arrayBuffer());
  return wb;
}
export const sheetNames = (wb) => wb.worksheets.map((w) => w.name);

export function readRows(wb, sheetName, map) {
  const ws = wb.getWorksheet(sheetName) || wb.worksheets[0];
  const out = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const rec = { rowNumber, colour: rowColour(row) };
    for (const [key] of FIELDS) rec[key] = map[key] ? cellText(row.getCell(colIndex(map[key]))) : '';
    if (!/^\d+$/.test(String(rec.serial).trim()) || !String(rec.name || rec.address || '').trim()) return; // header / empty rows
    out.push(rec);
  });
  return out;
}

/* ---------- decoding the register's short codes ---------- */
export function parseDate(v) {
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  const m = String(v || '').match(/(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/);
  if (!m) return '';
  let y = Number(m[3]); if (y < 100) y += 2000;
  return `${y}-${String(m[2]).padStart(2, '0')}-${String(m[1]).padStart(2, '0')}`;
}

export function parseLifts(h) {
  const s = String(h || '').toUpperCase().replace(/\s+/g, '');
  const m = s.match(/^(\d+)\(([^)]*)\)(.*)$/);
  const lifts = m ? Number(m[1]) || 1 : 1;
  const inner = m ? m[2] : s;
  const tail = m ? m[3] : '';
  const persons = Number(inner.match(/(\d+)P\b|(\d+)P(?=\/|$)/)?.[0]?.replace('P', '')) || 0;
  const ton = inner.match(/(\d+(?:\.\d+)?)\s*(?:TON|T)\b|(\d+(?:\.\d+)?)T(?=\/|$)/);
  const tonnes = ton ? Number(ton[1] || ton[2]) : 0;
  let liftKind = 'PASSENGER';
  if (/HOSP|STRETCH/.test(inner)) liftKind = 'HOSPITAL / STRETCHER';
  else if (/GOODS/.test(inner) || (!persons && tonnes)) liftKind = 'GOODS';
  else if (/CAR\b/.test(inner)) liftKind = 'CAR';
  const drive = /HYD/.test(s) ? 'HYDRAULIC' : null;
  return { lifts, persons, capacityKg: persons ? kgForPersons(persons) : tonnes ? Math.round(tonnes * 1000) : 0, liftKind, drive, modJob: /MOD/.test(s), raw: String(h || '') };
}

export function parseSpec(k) {
  const s = String(k || '').toUpperCase().replace(/\s+/g, '');
  const out = { raw: String(k || '') };
  const fl = s.match(/(?:^|,)((?:LB\+|B\d?\+)*G(?:\+\d+)+|G)(?=,|$)/);
  if (fl) {
    out.floors = fl[1];
    const toks = fl[1].split('+');
    const nums = toks.filter((t) => /^\d+$/.test(t));
    out.stops = nums.length > 1 ? toks.length : toks.filter((t) => !/^\d+$/.test(t)).length + (nums[0] ? Number(nums[0]) : 0);
  }
  const codes = (s.split(',').find((p) => p.includes('/') && !/W=|XD/.test(p)) || '').split('/').filter(Boolean);
  const has = (c) => codes.includes(c);
  if (has('MRL')) out.drive = 'MRL';
  else if (has('MR')) out.drive = 'MACHINE ROOM';
  else if (has('HYD')) out.drive = 'HYDRAULIC';
  const glass = has('GD');
  const base = has('ATSD') || has('TSD') ? 'Automatic Side Opening (Telescopic)' : has('ACO') ? 'Automatic Central Opening' : has('SWING') || has('MSD') ? 'Manual Swing' : '';
  if (base) out.door = base === 'Manual Swing' ? 'Manual Swing Door' : `${base} ${glass ? 'Glass Door with SS Frame' : 'SS Door'}`;
  else if (glass) out.door = 'Automatic Central Opening Glass Door with SS Frame';
  if (has('RG')) out.color = 'ROSE GOLD';
  else if (has('GOLD') || has('G')) out.color = 'GOLD';
  else if (has('BLACK') || has('BK')) out.color = 'BLACK MIRROR';
  else if (has('SS')) out.color = 'SILVER HAIRLINE';
  if (has('SS') && !has('RG')) out.panels = 'Stainless Steel Hairline Finish';
  const wd = s.match(/W?=?(\d{3,4})X?D=?(\d{3,4})/);
  if (wd) { out.shaftW = Number(wd[1]); out.shaftD = Number(wd[2]); }
  return out;
}

const STATUS_ENQ = { new: 'New', quoted: 'Quoted' };

// Build the client + client-tab documents for one register row
export function buildRecord(r, { status, greenAs, state, prefix, company, hsn }) {
  const date = parseDate(r.date) || new Date().toISOString().slice(0, 10);
  const city = String(r.city || '').trim().toUpperCase();
  const siteState = CITY_STATE[city] || state;
  const L = parseLifts(r.lifts);
  const S = parseSpec(r.spec);
  const x = {
    ...defaultProposal(company),
    buildingType: String(r.buildingType || '').toUpperCase(), architect: String(r.architect || '').toUpperCase(),
    lifts: L.lifts, liftKind: L.liftKind, persons: L.persons || '', capacityKg: L.capacityKg || '',
    drive: S.drive || L.drive || 'MRL', floors: S.floors || '', stops: S.stops || '',
    shaftW: S.shaftW || '', shaftD: S.shaftD || '', cityCode: cityCode(city),
    door: S.door || '', color: S.color || '', ...(S.panels ? { panels: S.panels } : {}),
    legacySpec: S.raw, legacyLifts: L.raw,
  };
  const serial = String(r.serial).trim();
  const refNo = buildRef(prefix, siteState, x.cityCode, serial, date);
  const priceLakh = num(String(r.price).replace(/[^\d.]/g, ''));
  const costLakh = num(String(r.costing).replace(/[^\d.]/g, ''));
  const rate = Math.round(priceLakh * 100000);
  const name = String(r.name || '').trim() || String(r.buildingType || 'Client').trim();
  const phone = String(r.phone || '').replace(/\.0$/, '').trim();
  const notes = [L.modJob ? 'Modernisation job' : '', L.raw && `Register: ${L.raw}`, S.raw && `Spec: ${S.raw}`, r.extra && `Other: ${r.extra}`].filter(Boolean).join(' · ');
  const ts = new Date(date + 'T10:00:00').getTime();
  const project = {
    quoteNo: refNo, legacySerial: serial, imported: true,
    clientName: name, contactPerson: name, contactPhone: phone,
    siteAddress: String(r.address || '').trim().toUpperCase(), siteCity: city, siteState,
    title: titleFromProposal(x), lifts: L.lifts, liftSpec: specFromProposal(x), proposal: x,
    status: status === 'order' ? (greenAs === 'completed' ? 'Completed' : 'Order') : 'Enquiry',
    enquiry: { status: STATUS_ENQ[status] || 'Won', source: r.architect ? 'Architect / Builder' : 'Old register', referredBy: String(r.architect || ''), notes, followUpDate: '' },
    salesBy: '', salesName: '',
    quote: { number: refNo, refNo, serial, rev: 0, date, validTill: date, items: [{ desc: 'Supply & Installation of Lift', hsn: hsn || '', qty: 1, rate }], gstRate: 18, discount: 0 },
    createdAt: ts,
  };
  if (status === 'order') {
    const value = Math.round(rate * 1.18);
    const done = greenAs === 'completed';
    Object.assign(project, {
      orderConfirmedAt: ts, contractValue: value, expectedHandover: '',
      milestones: DEFAULT_PAY_TERMS.map((t) => ({ name: t.label, percent: t.percent, amount: Math.round((value * t.percent) / 100) })),
      advance: done ? { confirmed: true, at: ts, by: 'Imported' } : { confirmed: false },
      drawing: done ? { status: 'Approved', rev: 0, at: ts } : { status: 'Pending' },
      site: done ? { status: 'Ready', checks: {}, at: ts } : { status: 'Not checked', checks: {} },
      material: done ? { status: 'Delivered', at: ts } : { status: 'Pending' },
      install: done ? { status: 'Completed', steps: {}, progress: 100, at: ts } : { status: 'Not started', steps: {}, progress: 0 },
      ...(done ? { handoverAt: ts } : {}),
      teamId: null, teamName: '',
    });
  }
  const client = { name, contactPerson: name, phone, email: '', address: project.siteAddress, city, state: siteState, gstin: '', imported: true };
  return { client, project, costing: costLakh || priceLakh ? { costing: Math.round(costLakh * 100000), quoted: rate } : null, phone, name };
}
