// Sample data for DEMO MODE only (never written to Firebase).
import { today, addDays, addMonths } from './utils';
import { SITE_CHECKLIST, INSTALL_STEPS } from './constants';
import { defaultProposal, specFromProposal, titleFromProposal, COMPANY_DEFAULTS } from './proposal';

// A simple general-arrangement drawing (SVG) used as a sample uploaded file
function sampleDrawing(title, shaft, pit, oh) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="640" viewBox="0 0 900 640" font-family="Arial" font-size="14">
<rect width="900" height="640" fill="#fff"/><rect x="10" y="10" width="880" height="620" fill="none" stroke="#000" stroke-width="2"/>
<text x="30" y="45" font-size="22" font-weight="bold">GENERAL ARRANGEMENT DRAWING</text><text x="30" y="70">${title}</text>
<rect x="120" y="140" width="260" height="280" fill="none" stroke="#000" stroke-width="3"/><text x="160" y="130">SHAFT PLAN ${shaft}</text>
<rect x="170" y="190" width="160" height="170" fill="#e8f1fd" stroke="#0a66d8" stroke-width="2"/><text x="215" y="280">CAR</text>
<rect x="335" y="200" width="30" height="150" fill="#ddd" stroke="#000"/><text x="300" y="380" font-size="12">CWT</text>
<line x1="170" y1="420" x2="330" y2="420" stroke="#c00" stroke-width="4"/><text x="200" y="445">DOOR 800 CO</text>
<rect x="520" y="100" width="160" height="440" fill="none" stroke="#000" stroke-width="2"/><text x="530" y="90">SECTION</text>
<line x1="500" y1="540" x2="700" y2="540" stroke="#000"/><text x="705" y="545">BOTTOM FLOOR</text>
<rect x="520" y="540" width="160" height="60" fill="#f4f4f4" stroke="#000"/><text x="560" y="580">PIT ${pit}</text>
<text x="700" y="120">OVERHEAD ${oh}</text>
<rect x="560" y="470" width="80" height="70" fill="#e8f1fd" stroke="#0a66d8"/>
<rect x="600" y="560" width="270" height="60" fill="none" stroke="#000"/><text x="610" y="585">DeeCee Elevators Pvt. Ltd.</text><text x="610" y="607" font-size="12">All dimensions in mm</text>
</svg>`;
  return btoa(svg);
}

export function seedData() {
  const t = today();
  const now = Date.now();
  const H = 3600000;
  const D = 86400000;

  const teams = {
    t_a: { name: 'Installation Team A', type: 'Installation', leaderId: 's_sunil', active: true },
    t_b: { name: 'Installation Team B', type: 'Installation', leaderId: 's_manoj', active: true },
    t_s: { name: 'Service Team', type: 'Service', leaderId: 's_ravi', active: true },
  };

  const staff = {
    s_owner: { name: 'Owner', phone: '9800000001', email: 'admin@deecee.demo', department: 'Management', designation: 'Director', joiningDate: '2015-04-01', active: true },
    s_rahul: { name: 'Rahul Sharma', phone: '9800000002', email: 'sales@deecee.demo', department: 'Sales', designation: 'Sales Manager', joiningDate: '2019-06-10', active: true },
    s_kiran: { name: 'Kiran Mishra', phone: '9800000010', email: 'drawing@deecee.demo', department: 'Drawing', designation: 'Draughtsman', joiningDate: '2020-05-04', active: true },
    s_amit: { name: 'Amit Verma', phone: '9800000003', email: 'projects@deecee.demo', department: 'Installation', designation: 'Installation Manager', joiningDate: '2018-02-15', active: true },
    s_neha: { name: 'Neha Gupta', phone: '9800000004', email: 'service@deecee.demo', department: 'Service', designation: 'Service Coordinator', joiningDate: '2021-08-01', active: true },
    s_vikas: { name: 'Vikas Tyagi', phone: '9800000005', email: 'stores@deecee.demo', department: 'Material & Dispatch', designation: 'Purchase & Dispatch', joiningDate: '2020-01-20', active: true },
    s_pooja: { name: 'Pooja Jain', phone: '9800000006', email: 'accounts@deecee.demo', department: 'Accounts', designation: 'Accountant', joiningDate: '2022-03-01', active: true },
    s_sunil: { name: 'Sunil Yadav', phone: '9800000008', email: 'tech@deecee.demo', department: 'Installation', designation: 'Senior Fitter (Team leader)', joiningDate: '2017-07-12', active: true, isTechnician: true, teamId: 't_a' },
    s_deepak: { name: 'Deepak Singh', phone: '9800000009', email: '', department: 'Installation', designation: 'Helper', joiningDate: '2023-09-01', active: true, isTechnician: true, teamId: 't_a' },
    s_manoj: { name: 'Manoj Pal', phone: '9800000011', email: '', department: 'Installation', designation: 'Fitter (Team leader)', joiningDate: '2019-03-11', active: true, isTechnician: true, teamId: 't_b' },
    s_arjun: { name: 'Arjun Rawat', phone: '9800000012', email: '', department: 'Installation', designation: 'Helper', joiningDate: '2024-01-08', active: true, isTechnician: true, teamId: 't_b' },
    s_ravi: { name: 'Ravi Kumar', phone: '9800000007', email: 'servicetech@deecee.demo', department: 'Service', designation: 'Service Engineer', joiningDate: '2019-11-05', active: true, isTechnician: true, teamId: 't_s' },
    s_rakesh: { name: 'Rakesh Chauhan', phone: '9800000013', email: '', department: 'Service', designation: 'Service Technician', joiningDate: '2022-06-20', active: true, isTechnician: true, teamId: 't_s' },
  };

  const C = (name, contactPerson, phone, address, city, state, gstin = '', email = '') => ({ name, contactPerson, phone, email, address, city, state, gstin });
  const clients = {
    c_green: C('Green Valley Apartments RWA', 'Mr. S. K. Agarwal', '9811100001', 'Sector 62, Noida', 'Noida', 'Uttar Pradesh', '09AAACG1234F1Z5', 'rwa@greenvalley.demo'),
    c_city: C('City Care Hospital', 'Dr. Meera Saxena', '9811100002', 'Raj Nagar Extension, Ghaziabad', 'Ghaziabad', 'Uttar Pradesh', '09AABCC5678K1Z2'),
    c_mehta: C('Mehta Residence', 'Mr. Rohit Mehta', '9811100003', 'Vasant Vihar, New Delhi', 'New Delhi', 'Delhi'),
    c_sunrise: C('Sunrise Mall', 'Mr. Kapil Arora', '9811100004', 'Sohna Road, Gurugram', 'Gurugram', 'Haryana', '06AAFCS9012L1Z8'),
    c_shree: C('Shree Ganesh Industries', 'Mr. Anil Bansal', '9811100005', 'Site IV, Sahibabad', 'Ghaziabad', 'Uttar Pradesh', '09AAKFS3456P1Z1'),
    c_goel: C('Goel Builders', 'Mr. Ashok Goel', '9822200001', 'Crossings Republik, Ghaziabad', 'Ghaziabad', 'Uttar Pradesh'),
    c_rao: C('Mrs. Kavita Rao', 'Mrs. Kavita Rao', '9822200002', 'Sector 50, Noida', 'Noida', 'Uttar Pradesh'),
    c_khan: C('Khan Cold Storage', 'Mr. Faisal Khan', '9822200003', 'Hapur Road, Hapur', 'Hapur', 'Uttar Pradesh'),
    c_singhal: C('Singhal Nursing Home', 'Dr. P. Singhal', '9822200004', 'Kavi Nagar, Ghaziabad', 'Ghaziabad', 'Uttar Pradesh'),
  };

  const spec = (type, capacity, stops, drive, doorType, cabin = 'SS Hairline') => ({ type, capacity, stops, speed: '1.0 m/s', drive, doorType, cabin });
  const quote = (number, lifts, sp, supply, install, ard, extra = {}) => ({
    number, rev: 0, date: addDays(t, -20), validTill: addDays(t, 10), gstRate: 18, discount: 0,
    items: [
      { desc: `Supply of ${sp.type} lift — ${sp.capacity}, ${sp.stops}, ${sp.speed}, ${sp.drive}, ${sp.doorType} doors, ${sp.cabin} cabin`, hsn: '8428', qty: lifts, rate: supply },
      { desc: 'Installation, testing & commissioning', hsn: '9987', qty: lifts, rate: install },
      { desc: 'ARD (Automatic Rescue Device)', hsn: '8428', qty: lifts, rate: ard },
    ],
    terms: TERMS, ...extra,
  });
  const ms = (value, statuses = []) => [
    { name: 'Advance on order', percent: 40 }, { name: 'Before material dispatch', percent: 40 },
    { name: 'On installation complete', percent: 15 }, { name: 'On handover', percent: 5 },
  ].map((m, i) => ({ ...m, amount: Math.round((value * m.percent) / 100), ...(statuses[i] || {}) }));
  const allChecks = (list) => Object.fromEntries(list.map((x) => [x, true]));
  const base = (cid, extra) => ({ clientId: cid, clientName: clients[cid].name, contactPerson: clients[cid].contactPerson, contactPhone: clients[cid].phone, siteState: clients[cid].state, salesBy: 's_rahul', salesName: 'Rahul Sharma', ...extra });

  const projects = {
    p1: base('c_green', {
      quoteNo: 'QT/26-27/0002', code: 'PRJ/26-27/0001', siteAddress: 'Tower B, Sector 62, Noida', title: '2 × Passenger lifts (G+12) – Tower B', lifts: 2,
      liftSpec: spec('Passenger', '8 Persons / 544 kg', 'G+12', 'MRL (Gearless)', 'Auto Centre Opening'),
      quote: quote('QT/26-27/0002', 2, spec('Passenger', '8 Persons / 544 kg', 'G+12', 'MRL (Gearless)', 'Auto Centre Opening'), 1080000, 210000, 66000),
      status: 'Order', enquiry: { status: 'Quoted', source: 'Architect / Builder' },
      orderConfirmedAt: now - 70 * D, contractValue: 3200000, expectedHandover: addDays(t, 35),
      milestones: ms(3200000, [{ invoiceId: 'i1' }, { invoiceId: 'i2' }]),
      advance: { confirmed: true, at: now - 66 * D, by: 'Vikas Tyagi', amount: 1280000 },
      drawing: { status: 'Approved', rev: 1, at: now - 55 * D, by: 'Kiran Mishra' },
      site: { status: 'Ready', checks: allChecks(SITE_CHECKLIST), notes: 'Shaft and pit OK. Scaffolding done by client.', at: now - 25 * D, by: 'Sunil Yadav' },
      material: { status: 'Delivered', at: now - 13 * D, by: 'Vikas Tyagi' },
      install: { status: 'In progress', steps: allChecks(INSTALL_STEPS.slice(0, 4)), progress: 50, at: now - 1 * D, by: 'Sunil Yadav' },
      teamId: 't_a', teamName: 'Installation Team A',
    }),
    p2: base('c_city', {
      quoteNo: 'QT/26-27/0004', code: 'PRJ/26-27/0002', siteAddress: 'New OT Block, Raj Nagar Extension, Ghaziabad', title: 'Stretcher lift (G+5) – New OT Block', lifts: 1,
      liftSpec: spec('Hospital / Stretcher', '20 Persons / 1360 kg', 'G+5', 'Machine Room (Gearless)', 'Auto Side Opening'),
      quote: quote('QT/26-27/0004', 1, spec('Hospital / Stretcher', '20 Persons / 1360 kg', 'G+5', 'Machine Room (Gearless)', 'Auto Side Opening'), 1700000, 280000, 96000),
      status: 'Order', enquiry: { status: 'Negotiation', source: 'Referral' },
      orderConfirmedAt: now - 40 * D, contractValue: 2450000, expectedHandover: addDays(t, 80),
      milestones: ms(2450000, [{ invoiceId: 'i3' }]),
      advance: { confirmed: true, at: now - 36 * D, by: 'Vikas Tyagi', amount: 980000 },
      drawing: { status: 'Issued', rev: 0, at: now - 20 * D, by: 'Kiran Mishra' },
      site: { status: 'Not ready', checks: allChecks(SITE_CHECKLIST.slice(0, 1).concat(SITE_CHECKLIST.slice(3, 4))), notes: 'Pit has water seepage. Machine room hook not fixed yet.', at: now - 4 * D, by: 'Sunil Yadav' },
      material: { status: 'Procuring', at: now - 10 * D, by: 'Vikas Tyagi' },
      install: { status: 'Not started', steps: {}, progress: 0 },
      teamId: 't_a', teamName: 'Installation Team A',
    }),
    p3: base('c_mehta', {
      quoteNo: 'QT/26-27/0006', code: 'PRJ/26-27/0003', siteAddress: 'Vasant Vihar, New Delhi', title: 'Home lift with glass cabin (G+3)', lifts: 1,
      liftSpec: spec('Home Lift', '4 Persons / 272 kg', 'G+3', 'MRL (Gearless)', 'Auto Side Opening', 'Glass'),
      quote: quote('QT/26-27/0006', 1, spec('Home Lift', '4 Persons / 272 kg', 'G+3', 'MRL (Gearless)', 'Auto Side Opening', 'Glass'), 780000, 120000, 35000),
      status: 'Order', enquiry: { status: 'Quoted', source: 'Website' },
      orderConfirmedAt: now - 3 * D, contractValue: 1150000, expectedHandover: addDays(t, 110),
      milestones: ms(1150000),
      advance: { confirmed: false }, drawing: { status: 'Pending' }, site: { status: 'Not checked', checks: {} }, material: { status: 'Pending' }, install: { status: 'Not started', steps: {}, progress: 0 },
      teamId: 't_b', teamName: 'Installation Team B',
    }),
    p4: base('c_sunrise', {
      quoteNo: 'QT/25-26/0031', code: 'PRJ/25-26/0014', siteAddress: 'Sohna Road, Gurugram', title: '4 × Passenger + 1 Goods lift', lifts: 5,
      liftSpec: spec('Passenger', '13 Persons / 884 kg', 'B2+G+4', 'MRL (Gearless)', 'Auto Centre Opening'),
      quote: quote('QT/25-26/0031', 5, spec('Passenger', '13 Persons / 884 kg', 'B2+G+4', 'MRL (Gearless)', 'Auto Centre Opening'), 1350000, 220000, 90000),
      status: 'Completed', enquiry: { status: 'Quoted', source: 'Referral' },
      orderConfirmedAt: now - 400 * D, contractValue: 9800000, expectedHandover: addDays(t, -150),
      milestones: ms(9800000),
      advance: { confirmed: true, at: now - 395 * D, amount: 3920000 }, drawing: { status: 'Approved', rev: 2, at: now - 370 * D },
      site: { status: 'Ready', checks: allChecks(SITE_CHECKLIST), at: now - 300 * D }, material: { status: 'Delivered', at: now - 260 * D },
      install: { status: 'Completed', steps: allChecks(INSTALL_STEPS), progress: 100, at: now - 160 * D },
      handoverAt: now - 150 * D, handover: { date: addDays(t, -150), licence: true, notes: 'Lift licence received.' },
      teamId: 't_b', teamName: 'Installation Team B',
    }),
    p5: base('c_goel', {
      quoteNo: 'QT/26-27/0008', siteAddress: 'Plot 14, Crossings Republik, Ghaziabad', title: '3 × Passenger lifts (G+8)', lifts: 3,
      liftSpec: spec('Passenger', '8 Persons / 544 kg', 'G+8', 'MRL (Gearless)', 'Auto Centre Opening'),
      quote: quote('QT/26-27/0008', 3, spec('Passenger', '8 Persons / 544 kg', 'G+8', 'MRL (Gearless)', 'Auto Centre Opening'), 920000, 180000, 60000, { rev: 1 }),
      status: 'Enquiry', enquiry: { status: 'Negotiation', source: 'Architect / Builder', followUpDate: t, notes: 'Wants 2% discount. Decision by owner on Monday.' },
    }),
    p6: base('c_rao', {
      quoteNo: 'QT/26-27/0009', siteAddress: 'House 22, Sector 50, Noida', title: '1 × Home lift (G+2)', lifts: 1,
      liftSpec: spec('Home Lift', '4 Persons / 272 kg', 'G+2', 'MRL (Gearless)', 'Auto Side Opening'),
      quote: quote('QT/26-27/0009', 1, spec('Home Lift', '4 Persons / 272 kg', 'G+2', 'MRL (Gearless)', 'Auto Side Opening'), 0, 0, 0),
      status: 'Enquiry', enquiry: { status: 'Site Visit', source: 'Website', followUpDate: addDays(t, 1), notes: 'Wheelchair friendly cabin needed.' },
    }),
    p7: base('c_khan', {
      quoteNo: 'QT/26-27/0010', siteAddress: 'Hapur Road, Hapur', title: '1 × Goods lift 2 ton (G+2)', lifts: 1,
      liftSpec: spec('Goods', '2000 kg', 'G+2', 'Machine Room (Geared)', 'Collapsible', 'MS Chequered'),
      quote: quote('QT/26-27/0010', 1, spec('Goods', '2000 kg', 'G+2', 'Machine Room (Geared)', 'Collapsible', 'MS Chequered'), 0, 0, 0),
      status: 'Enquiry', enquiry: { status: 'New', source: 'IndiaMART', followUpDate: addDays(t, -1) },
    }),
    p8: base('c_singhal', {
      quoteNo: 'QT/26-27/0007', siteAddress: 'Kavi Nagar, Ghaziabad', title: 'Stretcher lift (G+4)', lifts: 1,
      liftSpec: spec('Hospital / Stretcher', '15 Persons / 1020 kg', 'G+4', 'MRL (Gearless)', 'Auto Side Opening'),
      quote: quote('QT/26-27/0007', 1, spec('Hospital / Stretcher', '15 Persons / 1020 kg', 'G+4', 'MRL (Gearless)', 'Auto Side Opening'), 1500000, 240000, 40000),
      status: 'Lost', enquiry: { status: 'Negotiation', source: 'Referral', lostReason: 'Went with a cheaper local vendor' },
    }),
  };


  // An enquiry in the full DeeCee proposal format (fictional client)
  const px = { ...defaultProposal(COMPANY_DEFAULTS), persons: 6, capacityKg: 408, travel: '9.3', floors: 'G+1+2', stops: 3, shaftW: 1550, shaftD: 1550, carW: 1000, carD: 1100, architect: 'MR. S. KAUSHAL', buildingType: 'HOUSE', cityCode: 'AG' };
  px.features['Overwait Protector'] = false;
  px.clientScope['LANDING SWING DOORS AND FRAME (ALL OPENING)'] = false;
  px.clientScope['WELDING MACHINE (IF REQUIRED)'] = false;
  clients.c_gupta = C('MR. RAJESH GUPTA', 'Mr. Rajesh Gupta', '9822200009', '14B Green Park, Kamla Nagar', 'Agra', 'Uttar Pradesh');
  projects.p9 = base('c_gupta', {
    quoteNo: 'DCEPL/UP/AG/26/10/2830', siteAddress: '14B GREEN PARK KAMLA NAGAR', siteCity: 'AGRA', siteState: 'Uttar Pradesh', status: 'Enquiry',
    title: titleFromProposal(px), lifts: 1, liftSpec: specFromProposal(px), proposal: px,
    quote: { number: 'DCEPL/UP/AG/26/10/2830', refNo: 'DCEPL/UP/AG/26/10/2830', serial: 2830, rev: 0, date: t, validTill: addDays(t, 30), gstRate: 18, discount: 0, items: [{ desc: 'Supply & Installation of Lift', hsn: '8428', qty: 1, rate: 820000 }] },
    enquiry: { status: 'Quoted', source: 'Architect / Builder', followUpDate: addDays(t, 2), notes: 'Rose gold finish, glass doors.' },
  });

  const inv = (number, clientId, projectId, milestone, desc, amount, date, paid, hsn, extra = {}) => {
    const rate = Math.round((amount / 1.18) * 100) / 100;
    return {
      number, clientId, clientName: clients[clientId].name, clientGstin: clients[clientId].gstin, address: clients[clientId].address, phone: clients[clientId].phone,
      projectId, milestone, date, dueDate: addDays(date, 15), placeOfSupply: clients[clientId].state, status: 'Active',
      items: [{ desc, hsn, qty: 1, rate }], gstRate: 18, discount: 0, total: amount, paid, ...extra,
    };
  };
  const invoices = {
    i1: inv('INV/26-27/0001', 'c_green', 'p1', 0, 'Advance (40%) – 2 × Passenger lifts, Tower B', 1280000, addDays(t, -68), 1280000, '8428'),
    i2: inv('INV/26-27/0002', 'c_green', 'p1', 1, 'Second instalment (40%) – before dispatch', 1280000, addDays(t, -20), 500000, '8428'),
    i3: inv('INV/26-27/0003', 'c_city', 'p2', 0, 'Advance (40%) – Stretcher lift', 980000, addDays(t, -38), 980000, '8428'),
    i5: inv('INV/26-27/0005', 'c_shree', null, null, 'Annual Maintenance Contract (Non-Comprehensive) – 1 Goods lift', 42000, addDays(t, -40), 0, '9987', { amcId: 'a3' }),
  };

  const pay = (projectId, milestone, invoiceId, clientId, amount, date, mode, ref) => ({ projectId, milestone, invoiceId, invoiceNumber: invoiceId ? invoices[invoiceId].number : '', clientId, clientName: clients[clientId].name, projectCode: projects[projectId]?.code || '', amount, date, mode, ref });
  const payments = {
    pay1: pay('p1', 0, 'i1', 'c_green', 1280000, addDays(t, -66), 'Bank Transfer / NEFT', 'UTR 2209xx01'),
    pay2: pay('p1', 1, 'i2', 'c_green', 500000, addDays(t, -12), 'Cheque', 'Chq 004512'),
    pay3: pay('p2', 0, 'i3', 'c_city', 980000, addDays(t, -36), 'Bank Transfer / NEFT', 'UTR 2209xx77'),
    pay4: pay('p4', 0, null, 'c_sunrise', 3920000, addDays(t, -395), 'Bank Transfer / NEFT', ''),
    pay5: pay('p4', 1, null, 'c_sunrise', 3920000, addDays(t, -265), 'Bank Transfer / NEFT', ''),
    pay6: pay('p4', 2, null, 'c_sunrise', 1470000, addDays(t, -158), 'Cheque', ''),
    pay7: pay('p4', 3, null, 'c_sunrise', 490000, addDays(t, -145), 'Cheque', ''),
  };

  const files = {
    f1: { projectId: 'p1', clientId: 'c_green', teamId: 't_a', shareWithTeam: true, visibleToClient: true, kind: 'Drawing', title: 'GA drawing – Tower B lifts', name: 'GA-TowerB-R1.svg', type: 'image/svg+xml', size: 2100, rev: 1, chunks: 1, uploading: false, at: now - 55 * D, byName: 'Kiran Mishra' },
    f2: { projectId: 'p2', clientId: 'c_city', teamId: 't_a', shareWithTeam: true, visibleToClient: true, kind: 'Drawing', title: 'GA drawing – Stretcher lift', name: 'GA-OT-Block-R0.svg', type: 'image/svg+xml', size: 2100, rev: 0, chunks: 1, uploading: false, at: now - 20 * D, byName: 'Kiran Mishra' },
  };

  const amcs = {
    a1: { number: 'AMC/26-27/0001', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, projectId: 'p4', siteAddress: 'Sohna Road, Gurugram', lifts: 5, type: 'Comprehensive', start: addMonths(t, -5), end: addMonths(t, 7), value: 480000, visitsPerYear: 12, status: 'Active' },
    a2: { number: 'AMC/25-26/0021', clientId: 'c_green', clientName: clients.c_green.name, projectId: null, siteAddress: 'Tower A, Sector 62, Noida', lifts: 2, type: 'Non-Comprehensive', start: addMonths(t, -11), end: addDays(t, 18), value: 96000, visitsPerYear: 12, status: 'Active' },
    a3: { number: 'AMC/25-26/0009', clientId: 'c_shree', clientName: clients.c_shree.name, projectId: null, siteAddress: 'Site IV, Sahibabad', lifts: 1, type: 'Non-Comprehensive', start: addMonths(t, -13), end: addDays(t, -25), value: 42000, visitsPerYear: 6, status: 'Active' },
  };

  const complaints = {
    cm1: { number: 'CMP/26-27/0001', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, amcId: 'a1', projectId: 'p4', liftRef: 'Lift 3 (Food court side)', issue: 'Door not closing properly at 2nd floor, jerks while closing', priority: 'High', status: 'Assigned', teamId: 't_s', teamName: 'Service Team', assignedTo: 's_ravi', reportedVia: 'Phone', contactPhone: '9811100004', reportedAt: now - 5 * H },
    cm2: { number: 'CMP/26-27/0002', clientId: 'c_green', clientName: clients.c_green.name, amcId: 'a2', projectId: null, liftRef: 'Tower A – Lift 1', issue: 'Cabin fan not working', priority: 'Low', status: 'Open', teamId: null, assignedTo: null, reportedVia: 'Client Portal', contactPhone: '9811100001', reportedAt: now - 26 * H },
    cm3: { number: 'CMP/26-27/0003', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, amcId: 'a1', projectId: 'p4', liftRef: 'Goods Lift', issue: 'Lift stopped between floors, no passengers', priority: 'Critical (Trapped / Stuck)', status: 'Resolved', teamId: 't_s', teamName: 'Service Team', assignedTo: 's_ravi', reportedVia: 'Phone', contactPhone: '9811100004', reportedAt: now - 6 * D, resolvedAt: now - 6 * D + 3 * H, resolution: 'ARD battery replaced, controller reset, tested OK' },
  };

  const V = (o) => ({ status: 'Scheduled', ...o });
  const visits = {
    v1: V({ type: 'Breakdown / Complaint', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', contactPhone: '9811100004', complaintId: 'cm1', amcId: 'a1', projectId: 'p4', teamId: 't_s', teamName: 'Service Team', technicianId: 's_ravi', date: t, title: 'Door issue – Lift 3' }),
    v2: V({ type: 'AMC Preventive Visit', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', contactPhone: '9811100004', amcId: 'a1', projectId: 'p4', teamId: 't_s', teamName: 'Service Team', date: t, title: 'Monthly PM – all 5 lifts' }),
    v3: V({ type: 'AMC Preventive Visit', clientId: 'c_green', clientName: clients.c_green.name, siteAddress: 'Tower A, Sector 62, Noida', contactPhone: '9811100001', amcId: 'a2', teamId: 't_s', teamName: 'Service Team', date: addDays(t, 2), title: 'Monthly PM – Tower A' }),
    v4: V({ type: 'Installation Work', clientId: 'c_green', clientName: clients.c_green.name, siteAddress: 'Tower B, Sector 62, Noida', contactPhone: '9811100001', projectId: 'p1', teamId: 't_a', teamName: 'Installation Team A', date: t, title: 'Car frame & cabin – Lift B2', instructions: 'Cabin panels arrived yesterday. Check for transit damage before fitting.' }),
    v5: V({ type: 'Site Survey', clientId: 'c_city', clientName: clients.c_city.name, siteAddress: 'New OT Block, Raj Nagar Extension, Ghaziabad', contactPhone: '9811100002', projectId: 'p2', teamId: 't_a', teamName: 'Installation Team A', date: addDays(t, 1), title: 'Re-check pit after waterproofing' }),
    v6: { type: 'AMC Preventive Visit', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', amcId: 'a1', projectId: 'p4', teamId: 't_s', teamName: 'Service Team', technicianId: 's_ravi', date: addDays(t, -30), status: 'Done', title: 'Monthly PM', notes: 'All lifts checked. Lift 3 door rollers worn – to be replaced.', doneAt: now - 30 * D, checklist: {} },
  };

  const items = {
    it1: { code: 'MC-GL-544', name: 'Gearless machine 544 kg, 1.0 m/s', category: 'Machine / Motor', unit: 'Nos', stock: 3, minStock: 2, rate: 185000 },
    it2: { code: 'CTRL-VF-10', name: 'VVVF controller, 10 stops', category: 'Controller', unit: 'Nos', stock: 1, minStock: 2, rate: 120000 },
    it3: { code: 'DR-AUTO-800', name: 'Auto door set 800 mm (CO)', category: 'Doors', unit: 'Set', stock: 18, minStock: 10, rate: 28000 },
    it4: { code: 'GR-T89', name: 'Guide rail T89', category: 'Guide Rails', unit: 'Mtr', stock: 240, minStock: 150, rate: 1450 },
    it5: { code: 'BELT-STL', name: 'Steel coated belt', category: 'Ropes & Belts', unit: 'Mtr', stock: 90, minStock: 120, rate: 980 },
    it6: { code: 'ARD-5KVA', name: 'ARD rescue device', category: 'Safety Devices', unit: 'Nos', stock: 4, minStock: 3, rate: 32000 },
    it7: { code: 'LC-3D', name: 'Light curtain (3D)', category: 'Safety Devices', unit: 'Nos', stock: 6, minStock: 5, rate: 9500 },
    it8: { code: 'COP-SS', name: 'Car operating panel SS, touch buttons', category: 'Cabin', unit: 'Nos', stock: 5, minStock: 3, rate: 14500 },
    it9: { code: 'ROLL-DR', name: 'Door hanger roller', category: 'Spares', unit: 'Nos', stock: 24, minStock: 20, rate: 650 },
    it10: { code: 'TRL-CBL', name: 'Travelling cable 24 core', category: 'Electrical', unit: 'Mtr', stock: 60, minStock: 100, rate: 410 },
  };

  const vendors = {
    vd1: { name: 'Montanari Drives India', contactPerson: 'Sales Desk', phone: '9833300001', email: 'sales@drives.demo', gstin: '27AAACM1111A1Z1', address: 'Pune, MH', supplies: 'Machines, controllers' },
    vd2: { name: 'Shakti Door Systems', contactPerson: 'Mr. Gupta', phone: '9833300002', email: '', gstin: '07AAECS2222B1Z3', address: 'Bawana, Delhi', supplies: 'Doors, cabins' },
    vd3: { name: 'National Elevator Spares', contactPerson: 'Mr. Khanna', phone: '9833300003', email: '', gstin: '07AAFCN3333C1Z5', address: 'Karol Bagh, Delhi', supplies: 'Spares, electrical' },
  };

  const purchaseOrders = {
    po1: { number: 'PO/26-27/0003', vendorId: 'vd1', vendorName: vendors.vd1.name, date: addDays(t, -6), expectedDate: addDays(t, 8), status: 'Ordered', projectId: 'p2', items: [{ itemId: 'it2', name: items.it2.name, qty: 2, rate: 118000 }], gstRate: 18 },
    po2: { number: 'PO/26-27/0002', vendorId: 'vd3', vendorName: vendors.vd3.name, date: addDays(t, -25), expectedDate: addDays(t, -18), status: 'Received', receivedAt: now - 18 * D, items: [{ itemId: 'it9', name: items.it9.name, qty: 20, rate: 620 }, { itemId: 'it7', name: items.it7.name, qty: 4, rate: 9200 }], gstRate: 18 },
  };

  const dispatches = {
    d1: { number: 'DSP/26-27/0004', projectId: 'p1', projectCode: projects.p1.code, clientName: clients.c_green.name, siteAddress: projects.p1.siteAddress, date: addDays(t, -14), vehicle: 'UP 14 AB 1234', driver: 'Ramesh (9800011111)', items: [{ itemId: 'it1', name: items.it1.name, qty: 2 }, { itemId: 'it3', name: items.it3.name, qty: 26 }, { itemId: 'it4', name: items.it4.name, qty: 180 }], status: 'Delivered' },
  };

  const stockMoves = {
    sm1: { itemId: 'it9', itemName: items.it9.name, qty: 20, type: 'Purchase', ref: 'PO/26-27/0002', at: now - 18 * D, byName: 'Vikas Tyagi' },
    sm2: { itemId: 'it7', itemName: items.it7.name, qty: 4, type: 'Purchase', ref: 'PO/26-27/0002', at: now - 18 * D, byName: 'Vikas Tyagi' },
    sm3: { itemId: 'it1', itemName: items.it1.name, qty: -2, type: 'Dispatch', ref: 'DSP/26-27/0004', projectId: 'p1', at: now - 14 * D, byName: 'Vikas Tyagi' },
    sm4: { itemId: 'it3', itemName: items.it3.name, qty: -26, type: 'Dispatch', ref: 'DSP/26-27/0004', projectId: 'p1', at: now - 14 * D, byName: 'Vikas Tyagi' },
    sm5: { itemId: 'it4', itemName: items.it4.name, qty: -180, type: 'Dispatch', ref: 'DSP/26-27/0004', projectId: 'p1', at: now - 14 * D, byName: 'Vikas Tyagi' },
  };

  const A = (projectId, clientId, text, visibleToClient, teamId, at, byName, byRole, kind = 'note') => ({ projectId, clientId, text, visibleToClient, teamId, teamVisible: !!teamId, at, byName, byRole, kind });
  const activity = {
    ac1: A('p1', 'c_green', 'Drawing Rev 1 issued for approval.', true, 't_a', now - 55 * D, 'Kiran Mishra', 'drawing', 'drawing'),
    ac2: A('p1', 'c_green', 'Site checked: ready for installation.', true, 't_a', now - 25 * D, 'Sunil Yadav', 'technician', 'site'),
    ac3: A('p1', 'c_green', 'Material dispatched to site (DSP/26-27/0004): 2 machines, 26 door sets, guide rails.', true, 't_a', now - 14 * D, 'Vikas Tyagi', 'stores', 'material'),
    ac4: A('p1', 'c_green', 'Installation progress 50% — car frame & cabin fitted on Lift B1.', true, 't_a', now - 1 * D, 'Sunil Yadav', 'technician', 'install'),
    ac5: A('p1', 'c_green', 'Client asked to expedite second instalment release — follow-up call on Monday.', false, null, now - 3 * D, 'Pooja Jain', 'accounts'),
    ac6: A('p2', 'c_city', 'Site not ready: pit has water seepage, machine room hook pending. Client informed.', true, 't_a', now - 4 * D, 'Sunil Yadav', 'technician', 'site'),
    ac7: A('p3', 'c_mehta', 'Order confirmed. Waiting for advance payment.', true, null, now - 3 * D, 'Rahul Sharma', 'sales', 'stage'),
  };

  const attendance = {};
  ['s_owner', 's_rahul', 's_kiran', 's_amit', 's_neha', 's_vikas', 's_pooja', 's_ravi', 's_sunil', 's_manoj'].forEach((s) => { attendance[`${t}_${s}`] = { date: t, staffId: s, status: 'P', inTime: '09:3' + (s.length % 9) }; });
  attendance[`${t}_s_deepak`] = { date: t, staffId: 's_deepak', status: 'L' };

  const users = {
    u_admin: { name: 'Owner (Admin)', email: 'admin@deecee.demo', role: 'admin', staffId: 's_owner', active: true },
    u_sales: { name: 'Rahul Sharma', email: 'sales@deecee.demo', role: 'sales', staffId: 's_rahul', active: true },
    u_draw: { name: 'Kiran Mishra', email: 'drawing@deecee.demo', role: 'drawing', staffId: 's_kiran', active: true },
    u_store: { name: 'Vikas Tyagi', email: 'stores@deecee.demo', role: 'stores', staffId: 's_vikas', active: true },
    u_proj: { name: 'Amit Verma', email: 'projects@deecee.demo', role: 'projects', staffId: 's_amit', active: true },
    u_serv: { name: 'Neha Gupta', email: 'service@deecee.demo', role: 'service', staffId: 's_neha', active: true },
    u_acc: { name: 'Pooja Jain', email: 'accounts@deecee.demo', role: 'accounts', staffId: 's_pooja', active: true },
    u_tech: { name: 'Sunil Yadav', email: 'tech@deecee.demo', role: 'technician', staffId: 's_sunil', active: true },
    u_stech: { name: 'Ravi Kumar', email: 'servicetech@deecee.demo', role: 'technician', staffId: 's_ravi', active: true },
    u_client: { name: 'Green Valley RWA', email: 'client@deecee.demo', role: 'client', clientId: 'c_green', active: true },
  };

  const settings = {
    company: {
      ...COMPANY_DEFAULTS, email: 'info@deeceeelevators.in', gstin: '08XXXXXXXXXXXZX', pan: '', defaultGst: 18,
      hsnSupply: '8428', sacService: '9987', quoteTerms: TERMS,
    },
  };

  const stamp = (obj, baseT = now - 30 * D) => { Object.values(obj).forEach((o, i) => { o.createdAt ||= baseT + i * H; }); return obj; };
  return {
    teams, staff: stamp(staff), clients: stamp(clients), projects: stamp(projects), invoices: stamp(invoices), payments: stamp(payments), amcs: stamp(amcs),
    complaints: stamp(complaints), visits: stamp(visits), items: stamp(items), vendors: stamp(vendors), files, 'files/f1/chunks': { 0: { d: sampleDrawing('2 x Passenger lifts - Tower B, Green Valley Apartments', '1800 x 1900', '1500', '4200') } },
    'files/f2/chunks': { 0: { d: sampleDrawing('Stretcher lift - New OT Block, City Care Hospital', '2400 x 2700', '1600', '4600') } },
    purchaseOrders: stamp(purchaseOrders), dispatches: stamp(dispatches), stockMoves, activity, attendance, users, settings, photos: {}, audit: {},
    counters: { 'PRJ_26-27': { n: 3 }, 'INV_26-27': { n: 5 }, 'AMC_26-27': { n: 1 }, 'CMP_26-27': { n: 3 }, 'QT_26-27': { n: 10 }, 'PO_26-27': { n: 3 }, 'DSP_26-27': { n: 4 }, QREF: { n: 2830 } },
  };
}

const TERMS = '40% advance with order, 40% before material dispatch, 15% on installation, 5% on handover.\nDelivery: 10–12 weeks from drawing approval and site readiness.\nWarranty: 12 months from handover. Free service during warranty.\nCivil work, electrical supply up to machine room / controller and scaffolding by client.';
