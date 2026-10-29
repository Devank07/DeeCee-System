// Sample data for DEMO MODE only (never written to Firebase).
import { today, addDays, addMonths } from './utils';
import { PROJECT_STAGES } from './constants';

export function seedData() {
  const t = today();
  const now = Date.now();
  const H = 3600000;
  const D = 86400000;

  const staff = {
    s_owner: { name: 'Owner', phone: '9800000001', email: 'admin@deecee.demo', department: 'Management', designation: 'Director', joiningDate: '2015-04-01', active: true },
    s_rahul: { name: 'Rahul Sharma', phone: '9800000002', email: 'sales@deecee.demo', department: 'Sales', designation: 'Sales Manager', joiningDate: '2019-06-10', active: true },
    s_amit: { name: 'Amit Verma', phone: '9800000003', email: 'projects@deecee.demo', department: 'Installation', designation: 'Installation Manager', joiningDate: '2018-02-15', active: true },
    s_neha: { name: 'Neha Gupta', phone: '9800000004', email: 'service@deecee.demo', department: 'Service', designation: 'Service Coordinator', joiningDate: '2021-08-01', active: true },
    s_vikas: { name: 'Vikas Tyagi', phone: '9800000005', email: 'stores@deecee.demo', department: 'Purchase & Dispatch', designation: 'Purchase & Stores', joiningDate: '2020-01-20', active: true },
    s_pooja: { name: 'Pooja Jain', phone: '9800000006', email: 'accounts@deecee.demo', department: 'Accounts', designation: 'Accountant', joiningDate: '2022-03-01', active: true },
    s_ravi: { name: 'Ravi Kumar', phone: '9800000007', email: 'tech@deecee.demo', department: 'Service', designation: 'Field Technician', joiningDate: '2019-11-05', active: true, isTechnician: true },
    s_sunil: { name: 'Sunil Yadav', phone: '9800000008', email: 'sunil@deecee.demo', department: 'Installation', designation: 'Senior Fitter', joiningDate: '2017-07-12', active: true, isTechnician: true },
    s_deepak: { name: 'Deepak Singh', phone: '9800000009', email: '', department: 'Installation', designation: 'Helper', joiningDate: '2023-09-01', active: true, isTechnician: true },
  };

  const clients = {
    c_green: { name: 'Green Valley Apartments RWA', contactPerson: 'Mr. S. K. Agarwal', phone: '9811100001', email: 'rwa@greenvalley.demo', address: 'Sector 62, Noida, UP', city: 'Noida', gstin: '09AAACG1234F1Z5' },
    c_city: { name: 'City Care Hospital', contactPerson: 'Dr. Meera Saxena', phone: '9811100002', email: 'admin@citycare.demo', address: 'Raj Nagar Extension, Ghaziabad, UP', city: 'Ghaziabad', gstin: '09AABCC5678K1Z2' },
    c_mehta: { name: 'Mehta Residence', contactPerson: 'Mr. Rohit Mehta', phone: '9811100003', email: 'rohit.mehta@mail.demo', address: 'Vasant Vihar, New Delhi', city: 'New Delhi', gstin: '' },
    c_sunrise: { name: 'Sunrise Mall', contactPerson: 'Mr. Kapil Arora', phone: '9811100004', email: 'facility@sunrisemall.demo', address: 'Sohna Road, Gurugram, HR', city: 'Gurugram', gstin: '06AAFCS9012L1Z8' },
    c_shree: { name: 'Shree Ganesh Industries', contactPerson: 'Mr. Anil Bansal', phone: '9811100005', email: 'anil@sgi.demo', address: 'Site IV, Sahibabad, UP', city: 'Ghaziabad', gstin: '09AAKFS3456P1Z1' },
  };

  const spec = (type, capacity, stops, drive, door) => ({ type, capacity, stops, speed: '1.0 m/s', drive, doorType: door, cabin: 'SS Hairline' });

  const projects = {
    p1: {
      code: 'PRJ/26-27/0001', clientId: 'c_green', clientName: clients.c_green.name, siteAddress: 'Tower B, Sector 62, Noida', title: '2 × Passenger Lifts – Tower B',
      liftSpec: spec('Passenger', '8 Persons / 544 kg', 'G+12', 'MRL (Gearless)', 'Auto Centre Opening'), lifts: 2,
      contractValue: 3200000, stage: 6, status: 'Active', expectedHandover: addDays(t, 35),
      team: { sales: 's_rahul', projectLead: 's_amit', technicians: ['s_sunil', 's_deepak'] },
      stageHistory: PROJECT_STAGES.slice(0, 7).map((s, i) => ({ stage: i, at: now - (70 - i * 10) * D, by: 'Amit Verma', note: '' })),
      milestones: [
        { name: 'Advance on order', percent: 40, amount: 1280000, status: 'Paid', invoiceId: 'i1' },
        { name: 'Before material dispatch', percent: 40, amount: 1280000, status: 'Invoiced', invoiceId: 'i2' },
        { name: 'On installation complete', percent: 15, amount: 480000, status: 'Pending' },
        { name: 'On handover', percent: 5, amount: 160000, status: 'Pending' },
      ],
    },
    p2: {
      code: 'PRJ/26-27/0002', clientId: 'c_city', clientName: clients.c_city.name, siteAddress: 'Raj Nagar Extension, Ghaziabad', title: 'Stretcher Lift – New OT Block',
      liftSpec: spec('Hospital / Stretcher', '20 Persons / 1360 kg', 'G+5', 'Machine Room (Gearless)', 'Auto Side Opening'), lifts: 1,
      contractValue: 2450000, stage: 3, status: 'Active', expectedHandover: addDays(t, 80),
      team: { sales: 's_rahul', projectLead: 's_amit', technicians: ['s_sunil'] },
      stageHistory: PROJECT_STAGES.slice(0, 4).map((s, i) => ({ stage: i, at: now - (40 - i * 10) * D, by: 'Amit Verma', note: '' })),
      milestones: [
        { name: 'Advance on order', percent: 40, amount: 980000, status: 'Paid', invoiceId: 'i3' },
        { name: 'Before material dispatch', percent: 40, amount: 980000, status: 'Pending' },
        { name: 'On installation complete', percent: 15, amount: 367500, status: 'Pending' },
        { name: 'On handover', percent: 5, amount: 122500, status: 'Pending' },
      ],
    },
    p3: {
      code: 'PRJ/26-27/0003', clientId: 'c_mehta', clientName: clients.c_mehta.name, siteAddress: 'Vasant Vihar, New Delhi', title: 'Home Lift with Glass Cabin',
      liftSpec: spec('Home Lift', '4 Persons / 272 kg', 'G+3', 'MRL (Gearless)', 'Auto Side Opening'), lifts: 1,
      contractValue: 1150000, stage: 1, status: 'Active', expectedHandover: addDays(t, 110),
      team: { sales: 's_rahul', projectLead: 's_amit', technicians: [] },
      stageHistory: [{ stage: 0, at: now - 12 * D, by: 'Rahul Sharma', note: 'Order signed' }, { stage: 1, at: now - 5 * D, by: 'Amit Verma', note: 'Survey done' }],
      milestones: [
        { name: 'Advance on order', percent: 40, amount: 460000, status: 'Invoiced', invoiceId: 'i4' },
        { name: 'Before material dispatch', percent: 40, amount: 460000, status: 'Pending' },
        { name: 'On installation complete', percent: 15, amount: 172500, status: 'Pending' },
        { name: 'On handover', percent: 5, amount: 57500, status: 'Pending' },
      ],
    },
    p4: {
      code: 'PRJ/25-26/0014', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', title: '4 × Passenger + 1 Goods Lift',
      liftSpec: spec('Passenger', '13 Persons / 884 kg', 'B2+G+4', 'MRL (Gearless)', 'Auto Centre Opening'), lifts: 5,
      contractValue: 9800000, stage: 9, status: 'Completed', expectedHandover: addDays(t, -150),
      team: { sales: 's_rahul', projectLead: 's_amit', technicians: ['s_sunil', 's_deepak'] },
      stageHistory: PROJECT_STAGES.map((s, i) => ({ stage: i, at: now - (400 - i * 25) * D, by: 'Amit Verma', note: '' })),
      milestones: [
        { name: 'Advance on order', percent: 40, amount: 3920000, status: 'Paid' },
        { name: 'Before material dispatch', percent: 40, amount: 3920000, status: 'Paid' },
        { name: 'On installation complete', percent: 15, amount: 1470000, status: 'Paid' },
        { name: 'On handover', percent: 5, amount: 490000, status: 'Paid' },
      ],
    },
  };

  const inv = (number, clientId, projectId, desc, amount, date, paid, extra = {}) => ({
    number, clientId, clientName: clients[clientId].name, projectId, date, dueDate: addDays(date, 15),
    items: [{ desc, qty: 1, rate: Math.round((amount / 1.18) * 100) / 100 }], gstRate: 18, discount: 0, total: amount, paid, ...extra,
  });
  const invoices = {
    i1: inv('INV/26-27/0001', 'c_green', 'p1', 'Advance (40%) – 2 × Passenger Lifts, Tower B', 1280000, addDays(t, -68), 1280000),
    i2: inv('INV/26-27/0002', 'c_green', 'p1', 'Second instalment (40%) – before dispatch', 1280000, addDays(t, -20), 500000),
    i3: inv('INV/26-27/0003', 'c_city', 'p2', 'Advance (40%) – Stretcher Lift', 980000, addDays(t, -38), 980000),
    i4: inv('INV/26-27/0004', 'c_mehta', 'p3', 'Advance (40%) – Home Lift', 460000, addDays(t, -11), 0),
    i5: inv('INV/26-27/0005', 'c_shree', null, 'Annual Maintenance Contract (Non-Comprehensive) – 1 Goods Lift', 42000, addDays(t, -40), 0, { amcId: 'a3' }),
  };

  const payments = {
    pay1: { invoiceId: 'i1', invoiceNumber: 'INV/26-27/0001', clientId: 'c_green', projectId: 'p1', amount: invoices.i1.total, date: addDays(t, -65), mode: 'Bank Transfer / NEFT', ref: 'UTR 2209xx01' },
    pay2: { invoiceId: 'i2', invoiceNumber: 'INV/26-27/0002', clientId: 'c_green', projectId: 'p1', amount: 500000, date: addDays(t, -12), mode: 'Cheque', ref: 'Chq 004512' },
    pay3: { invoiceId: 'i3', invoiceNumber: 'INV/26-27/0003', clientId: 'c_city', projectId: 'p2', amount: invoices.i3.total, date: addDays(t, -35), mode: 'Bank Transfer / NEFT', ref: 'UTR 2209xx77' },
  };

  const amcs = {
    a1: { number: 'AMC/26-27/0001', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, projectId: 'p4', siteAddress: 'Sohna Road, Gurugram', lifts: 5, type: 'Comprehensive', start: addMonths(t, -5), end: addMonths(t, 7), value: 480000, visitsPerYear: 12, status: 'Active' },
    a2: { number: 'AMC/25-26/0021', clientId: 'c_green', clientName: clients.c_green.name, projectId: null, siteAddress: 'Tower A, Sector 62, Noida', lifts: 2, type: 'Non-Comprehensive', start: addMonths(t, -11), end: addDays(t, 18), value: 96000, visitsPerYear: 12, status: 'Active' },
    a3: { number: 'AMC/25-26/0009', clientId: 'c_shree', clientName: clients.c_shree.name, projectId: null, siteAddress: 'Site IV, Sahibabad', lifts: 1, type: 'Non-Comprehensive', start: addMonths(t, -13), end: addDays(t, -25), value: 42000, visitsPerYear: 6, status: 'Active' },
  };

  const complaints = {
    cm1: { number: 'CMP/26-27/0001', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, amcId: 'a1', projectId: 'p4', liftRef: 'Lift 3 (Food court side)', issue: 'Door not closing properly at 2nd floor, jerks while closing', priority: 'High', status: 'Assigned', assignedTo: 's_ravi', reportedVia: 'Phone', contactPhone: '9811100004', reportedAt: now - 5 * H },
    cm2: { number: 'CMP/26-27/0002', clientId: 'c_green', clientName: clients.c_green.name, amcId: 'a2', projectId: null, liftRef: 'Tower A – Lift 1', issue: 'Cabin fan not working', priority: 'Low', status: 'Open', assignedTo: null, reportedVia: 'Client Portal', contactPhone: '9811100001', reportedAt: now - 26 * H },
    cm3: { number: 'CMP/26-27/0003', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, amcId: 'a1', projectId: 'p4', liftRef: 'Goods Lift', issue: 'Lift stopped between floors, no passengers', priority: 'Critical (Trapped / Stuck)', status: 'Resolved', assignedTo: 's_ravi', reportedVia: 'Phone', contactPhone: '9811100004', reportedAt: now - 6 * D, resolvedAt: now - 6 * D + 3 * H, resolution: 'ARD battery replaced, controller reset, tested OK' },
  };

  const visits = {
    v1: { type: 'Breakdown / Complaint', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', contactPhone: '9811100004', complaintId: 'cm1', amcId: 'a1', projectId: 'p4', technicianId: 's_ravi', date: t, status: 'Scheduled', title: 'Door issue – Lift 3' },
    v2: { type: 'AMC Preventive Visit', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', contactPhone: '9811100004', amcId: 'a1', projectId: 'p4', technicianId: 's_ravi', date: t, status: 'Scheduled', title: 'Monthly PM – all 5 lifts' },
    v3: { type: 'AMC Preventive Visit', clientId: 'c_green', clientName: clients.c_green.name, siteAddress: 'Tower A, Sector 62, Noida', contactPhone: '9811100001', amcId: 'a2', technicianId: 's_ravi', date: addDays(t, 2), status: 'Scheduled', title: 'Monthly PM – Tower A' },
    v4: { type: 'Installation Work', clientId: 'c_green', clientName: clients.c_green.name, siteAddress: 'Tower B, Sector 62, Noida', contactPhone: '9811100001', projectId: 'p1', technicianId: 's_sunil', date: t, status: 'Scheduled', title: 'Rail alignment – Lift B2' },
    v5: { type: 'AMC Preventive Visit', clientId: 'c_sunrise', clientName: clients.c_sunrise.name, siteAddress: 'Sohna Road, Gurugram', amcId: 'a1', projectId: 'p4', technicianId: 's_ravi', date: addDays(t, -30), status: 'Done', title: 'Monthly PM', notes: 'All lifts checked. Lift 3 door rollers worn – to be replaced.', doneAt: now - 30 * D, checklist: {} },
  };

  const leads = {
    l1: { name: 'Mr. Ashok Goel', company: 'Goel Builders', phone: '9822200001', email: 'ashok@goelbuild.demo', city: 'Ghaziabad', source: 'Architect / Builder', requirement: '3 passenger lifts, G+8 residential', status: 'Site Visit', assignedTo: 's_rahul', followUpDate: t, value: 3600000 },
    l2: { name: 'Mrs. Kavita Rao', company: '', phone: '9822200002', email: '', city: 'Noida', source: 'Website', requirement: 'Home lift for 3 floors, wheelchair friendly', status: 'Quoted', assignedTo: 's_rahul', followUpDate: addDays(t, 1), value: 1050000 },
    l3: { name: 'Mr. Faisal Khan', company: 'Khan Cold Storage', phone: '9822200003', email: '', city: 'Hapur', source: 'IndiaMART', requirement: 'Goods lift 2 ton, G+2', status: 'New', assignedTo: 's_rahul', followUpDate: addDays(t, -1), value: 1400000 },
    l4: { name: 'Dr. P. Singhal', company: 'Singhal Nursing Home', phone: '9822200004', email: '', city: 'Ghaziabad', source: 'Referral', requirement: 'Stretcher lift G+4', status: 'Negotiation', assignedTo: 's_rahul', followUpDate: addDays(t, 3), value: 2100000 },
    l5: { name: 'Mr. Vivek Aggarwal', company: '', phone: '9822200005', email: '', city: 'Delhi', source: 'WhatsApp', requirement: 'Capsule lift for showroom', status: 'Lost', assignedTo: 's_rahul', followUpDate: '', value: 1800000, lostReason: 'Budget' },
  };

  const quotations = {
    q1: {
      number: 'QT/26-27/0007', leadId: 'l2', clientName: 'Mrs. Kavita Rao', clientId: null, phone: '9822200002', address: 'Noida', date: addDays(t, -3), validTill: addDays(t, 27), status: 'Sent',
      liftSpec: spec('Home Lift', '4 Persons / 272 kg', 'G+2', 'MRL (Gearless)', 'Auto Side Opening'), lifts: 1,
      items: [
        { desc: 'Home lift, 4 persons, MRL gearless, G+2 (3 stops), SS cabin, auto doors – supply', qty: 1, rate: 760000 },
        { desc: 'Installation, testing & commissioning', qty: 1, rate: 110000 },
        { desc: 'ARD (Automatic Rescue Device)', qty: 1, rate: 35000 },
      ],
      gstRate: 18, discount: 15000,
      terms: '40% advance with order, 40% before dispatch, 15% on installation, 5% on handover.\nDelivery: 10–12 weeks from drawing approval.\nWarranty: 12 months from handover. Free service during warranty.\nCivil work, electrical supply up to machine room / controller and scaffolding by client.',
    },
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

  const activity = {
    ac1: { projectId: 'p1', clientId: 'c_green', text: 'Material dispatched to site: 2 machines, 26 door sets, guide rails.', visibleToClient: true, kind: 'stage', at: now - 14 * D, byName: 'Vikas Tyagi', byRole: 'stores' },
    ac2: { projectId: 'p1', clientId: 'c_green', text: 'Installation started. Rail erection in progress for Lift B1.', visibleToClient: true, kind: 'stage', at: now - 9 * D, byName: 'Amit Verma', byRole: 'projects' },
    ac3: { projectId: 'p1', clientId: 'c_green', text: 'Client asked to expedite second instalment release — follow-up call on Monday.', visibleToClient: false, kind: 'note', at: now - 3 * D, byName: 'Pooja Jain', byRole: 'accounts' },
    ac4: { projectId: 'p2', clientId: 'c_city', text: 'Shaft measurements verified — pit depth OK. Waiting for machine room hook.', visibleToClient: true, kind: 'note', at: now - 6 * D, byName: 'Amit Verma', byRole: 'projects' },
    ac5: { projectId: 'p3', clientId: 'c_mehta', text: 'Site survey done. GA drawing will be shared for approval within 5 days.', visibleToClient: true, kind: 'stage', at: now - 5 * D, byName: 'Amit Verma', byRole: 'projects' },
  };

  const attendance = {};
  ['s_owner', 's_rahul', 's_amit', 's_neha', 's_pooja', 's_ravi', 's_sunil'].forEach((s) => { attendance[`${t}_${s}`] = { date: t, staffId: s, status: 'P', inTime: '09:3' + Math.floor(Math.random() * 9) }; });
  attendance[`${t}_s_deepak`] = { date: t, staffId: 's_deepak', status: 'L' };

  const users = {
    u_admin: { name: 'Owner (Admin)', email: 'admin@deecee.demo', role: 'admin', staffId: 's_owner', active: true },
    u_sales: { name: 'Rahul Sharma', email: 'sales@deecee.demo', role: 'sales', staffId: 's_rahul', active: true },
    u_proj: { name: 'Amit Verma', email: 'projects@deecee.demo', role: 'projects', staffId: 's_amit', active: true },
    u_serv: { name: 'Neha Gupta', email: 'service@deecee.demo', role: 'service', staffId: 's_neha', active: true },
    u_store: { name: 'Vikas Tyagi', email: 'stores@deecee.demo', role: 'stores', staffId: 's_vikas', active: true },
    u_acc: { name: 'Pooja Jain', email: 'accounts@deecee.demo', role: 'accounts', staffId: 's_pooja', active: true },
    u_tech: { name: 'Ravi Kumar', email: 'tech@deecee.demo', role: 'technician', staffId: 's_ravi', active: true },
    u_client: { name: 'Green Valley RWA', email: 'client@deecee.demo', role: 'client', clientId: 'c_green', active: true },
  };

  const settings = {
    company: {
      name: 'DeeCee Elevators Pvt. Ltd.', tagline: 'Elevators · Escalators · Home Lifts', address: 'Your registered office address', phone: '+91 00000 00000',
      email: 'info@deeceeelevators.in', website: 'deeceeelevators.in', gstin: '09XXXXXXXXXXXZX', pan: '', bank: 'Bank: —\nA/c No: —\nIFSC: —', defaultGst: 18,
      quoteTerms: quotations.q1.terms,
    },
  };

  const stamp = (obj, base = now - 30 * D) => { Object.values(obj).forEach((o, i) => { o.createdAt ||= base + i * H; }); return obj; };
  return {
    staff: stamp(staff), clients: stamp(clients), projects: stamp(projects), invoices: stamp(invoices), payments: stamp(payments), amcs: stamp(amcs),
    complaints: stamp(complaints), visits: stamp(visits), leads: stamp(leads), quotations: stamp(quotations), items: stamp(items), vendors: stamp(vendors),
    purchaseOrders: stamp(purchaseOrders), dispatches: stamp(dispatches), stockMoves: stockMoves, activity, attendance, users, settings, photos: {}, audit: {},
    counters: { 'PRJ_26-27': { n: 3 }, 'INV_26-27': { n: 5 }, 'AMC_26-27': { n: 1 }, 'CMP_26-27': { n: 3 }, 'QT_26-27': { n: 7 }, 'PO_26-27': { n: 3 }, 'DSP_26-27': { n: 4 } },
  };
}
