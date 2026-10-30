// The DCEPL proposal (quotation) format: defaults, option lists and helpers.
import { num, today, addDays, amountInWords, calcTotals } from './utils';

export const COMPANY_DEFAULTS = {
  name: 'DEE CEE ELEVATORS PVT. LTD.',
  shortName: 'DEE CEE ELEVATORS (P) LTD',
  letterName: 'Dee Cee Elevators Pvt Ltd',
  tagline: 'Engineered for Safety. Designed for Reliability.',
  address: '342, Vardhman Nagar, Badarwas, Ajmer Road, Jaipur- 302019',
  state: 'Rajasthan',
  phone: '+91 9837221980',
  website: 'www.deeceeelevators.in',
  defaultGst: 18,
  quotePrefix: 'DCEPL',
  quoteNextSerial: 2830,
  freightNote: 'Freight from JAIPUR Inclusive.',
  amcWithout: 3,
  amcComp: 6,
};

export const ORIGINS = ['INDIGENEOUS', 'IMPORTED'];
export const LIFT_KINDS = ['PASSENGER', 'HOME', 'HOSPITAL / STRETCHER', 'GOODS', 'CAR', 'DUMBWAITER', 'CAPSULE'];
export const DRIVE_KINDS = ['MRL', 'MACHINE ROOM', 'HYDRAULIC'];
export const OPERATIONS = ['Simplex All Collective', 'Simplex Down Collective', 'Duplex All Collective', 'Group Control'];
export const DOORS = [
  'Automatic Central Opening Glass Door with SS Frame',
  'Automatic Central Opening SS Hairline Door',
  'Automatic Side Opening (Telescopic) SS Door',
  'Automatic Side Opening Glass Door with SS Frame',
  'Manual Swing Door',
  'Manual Collapsible Door (MS)',
  'Imperforate Telescopic Door',
];
export const COLORS = ['ROSE GOLD', 'GOLD', 'SILVER HAIRLINE', 'CHAMPAGNE GOLD', 'BLACK MIRROR', 'BLACK GOLD', 'WOOD FINISH'];
export const PANELS = ['Honeycomb Stainless Steel Designer Finish', 'Stainless Steel Hairline Finish', 'Mirror Finish Stainless Steel', 'Glass Panels with SS Frame', 'Etched Designer SS', 'MS Powder Coated'];
export const CEILINGS = ['SS with LED lights and Blower', 'Mirror SS with LED lights and Blower', 'Designer LED False Ceiling with Blower'];
export const FLOORINGS = ['Anti-Skid PVC', 'Granite / Marble (by client)', 'Chequered Plate (MS)', 'Vinyl'];
export const LOPCOP = ['Push Button', 'Touch Button', 'Push Button with LCD Display', 'Touch Button with TFT Display'];
export const BUILDING_TYPES = ['HOUSE', 'BUNGALOW', 'APARTMENT', 'HOSPITAL', 'HOTEL', 'OFFICE', 'SHOWROOM', 'FACTORY', 'SCHOOL', 'MALL'];

export const KEY_FEATURES = [
  'Smooth and energy-efficient V3F drive system',
  'Automatic Rescue Device (ARD) with battery backup',
  'Digital floor indication with voice announcement',
  'Fireman switch and safety governor',
  'Door safety interlock system',
  'Emergency alarm and lighting system',
  'Automatic lighting cutoff system',
  'Elegant stainless steel cabin design',
  'Overwait Protector',
];
export const OUR_SCOPE = [
  'Design, manufacturing, and supply of elevator',
  'Installation, testing, and commissioning',
  'Final handover after successful operation',
];
export const CLIENT_SCOPE = [
  'WHITE / DARK WASH IN SHAFT AND MACHINE ROOM',
  '3PHASE POWER CONNECTION IN MACHINE ROOM WITH 4POLE MCB SWITCH',
  'PROVIDE SCAFFOLDING',
  'DOUBLE EARTHING IN MACHINE ROOM (8NO COPPER)',
  'MINOR CIVIL WORK (MACHINE/BUFFERS/DOORS FRAME)',
  'LANDING SWING DOORS AND FRAME (ALL OPENING)',
  'WELDING MACHINE (IF REQUIRED)',
  'ELECTRICAL LINE & SWITCHES IN SHAFT (SINGLE PHASE)',
  'ONE STOREROOM WITH LOCK UP KEY',
  'IRON C CHANNELS (3/4 NOS)',
];
export const TERMS_LIST = [
  'Prices are subject to IEEMA price variation clause',
  'Taxes are extra as applicable',
  'Quotation validity: 30 days from date of issue',
  'Work subject to site readiness and uninterrupted power supply',
  'Any civil or structural delay would impact delivery timeline',
  'Final layout drawings will be submitted for approval before execution',
];
export const DEFAULT_PAY_TERMS = [
  { percent: 40, label: 'Advance along with order' },
  { percent: 50, label: 'Before dispatch of material' },
  { percent: 10, label: 'After handover' },
];

const STATE_ABBR = {
  'Uttar Pradesh': 'UP', Rajasthan: 'RJ', Delhi: 'DL', Haryana: 'HR', Punjab: 'PB', Uttarakhand: 'UK', 'Madhya Pradesh': 'MP', Maharashtra: 'MH',
  Gujarat: 'GJ', 'Himachal Pradesh': 'HP', 'Jammu and Kashmir': 'JK', Chandigarh: 'CH', Bihar: 'BR', 'West Bengal': 'WB', Jharkhand: 'JH', Odisha: 'OD',
  Chhattisgarh: 'CG', Karnataka: 'KA', Kerala: 'KL', 'Tamil Nadu': 'TN', Telangana: 'TS', 'Andhra Pradesh': 'AP', Goa: 'GA', Assam: 'AS',
};
export const stateAbbr = (s) => STATE_ABBR[s] || String(s || 'XX').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase();
export const cityCode = (city) => String(city || '').replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase() || 'XX';
export function buildRef(prefix, state, code, serial, date = today()) {
  const d = new Date(date);
  return `${prefix || 'DCEPL'}/${stateAbbr(state)}/${code || 'XX'}/${String(d.getFullYear() % 100).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${serial}`;
}
export const kgForPersons = (n) => Math.round(num(n) * 68); // IS 14665: 68 kg per person

export function defaultProposal(company = {}) {
  const c = { ...COMPANY_DEFAULTS, ...company };
  return {
    origin: 'INDIGENEOUS', liftKind: 'PASSENGER', drive: 'MRL', lifts: 1, persons: 6, capacityKg: 408, speed: '1.0', travel: '',
    floors: '', stops: '', openings: 'All Openings on same side',
    machine: '2.8 KW Gearless Traction Machine (Sharp/Techtronic)', control: 'Microprocessor with V3F Drive', operation: 'Simplex All Collective',
    shaftW: '', shaftD: '', pit: 1500, overhead: 4800, overheadNote: 'Top Slab', carW: '', carD: '', carH: 2100, entW: 700, entH: 2000,
    door: DOORS[0], color: 'ROSE GOLD', panels: PANELS[0], ceiling: CEILINGS[0], flooring: FLOORINGS[0], flooringNote: '(For stone provision Client would have to provide the stone)',
    lopcop: 'Push Button', powerMain: '415 volts, 50 Hz, Three Phase with double earthing.', powerLight: '230 volts, 50Hz, Single Phase',
    features: Object.fromEntries(KEY_FEATURES.map((f) => [f, true])),
    clientScope: Object.fromEntries(CLIENT_SCOPE.map((f) => [f, true])),
    ourScope: [...OUR_SCOPE], terms: [...TERMS_LIST], payTerms: DEFAULT_PAY_TERMS.map((x) => ({ ...x })),
    delivery: '10–12 weeks from date of order confirmation, advance payment, and drawing approval',
    warranty: ['12 Months Warranty', '12 Months Free Maintenance'],
    amcWithout: c.amcWithout, amcComp: c.amcComp, freightNote: c.freightNote,
    architect: '', siteSupervisor: '', siteVisit: '', buildingType: 'HOUSE',
  };
}

export const typeLine = (x) => `${x.origin} ${x.liftKind} LIFT ${x.drive} TYPE`;
export const floorsLine = (x) => [x.floors, x.stops ? `(${x.stops}/${x.stops} Stops)` : '', x.openings ? `(${x.openings})` : ''].filter(Boolean).join(' ');

// Keep the short lift spec (used everywhere else in the app) in step with the proposal
export function specFromProposal(x) {
  const kindMap = { PASSENGER: 'Passenger', HOME: 'Home Lift', 'HOSPITAL / STRETCHER': 'Hospital / Stretcher', GOODS: 'Goods', CAR: 'Car Lift', DUMBWAITER: 'Dumbwaiter', CAPSULE: 'Capsule / Glass' };
  return {
    type: kindMap[x.liftKind] || 'Passenger',
    capacity: `${x.persons} Persons / ${x.capacityKg} kg`,
    stops: x.floors || '',
    speed: `${x.speed} m/s`,
    drive: x.drive === 'MRL' ? 'MRL (Gearless)' : x.drive === 'HYDRAULIC' ? 'Hydraulic' : 'Machine Room (Gearless)',
    doorType: x.door,
    cabin: `${x.color} · ${x.panels}`,
  };
}
export const titleFromProposal = (x) => `${num(x.lifts) || 1} × ${specFromProposal(x).type} lift${x.floors ? ' (' + x.floors + ')' : ''}`;

export function defaultItems(company = {}) {
  return [{ desc: 'Supply & Installation of Lift', hsn: company.hsnSupply || '', qty: 1, rate: 0 }];
}

export const wordsUpper = (n) => amountInWords(n).replace(/^Rupees\s*/, '').toUpperCase();
export const quoteSubtotal = (q) => calcTotals(q?.items || [], 0, q?.discount || 0).taxable;
export const defaultValidTill = () => addDays(today(), 30);

// Revision suffix: 1 → A, 2 → B … 26 → Z, 27 → AA
export function revLetter(n) {
  let s = '';
  let x = Number(n) || 0;
  while (x > 0) { x -= 1; s = String.fromCharCode(65 + (x % 26)) + s; x = Math.floor(x / 26); }
  return s;
}
export const baseRefOf = (p) => p.quote?.baseRef || p.quote?.refNo || p.quoteNo;
export const nextRevRef = (p) => baseRefOf(p) + revLetter((Number(p.quote?.rev) || 0) + 1);
