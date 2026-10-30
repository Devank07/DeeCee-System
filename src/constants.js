export const ROLES = {
  admin: 'Admin / Owner',
  sales: 'Sales',
  drawing: 'Drawing Team',
  stores: 'Material & Dispatch',
  projects: 'Installation Manager',
  service: 'Service & AMC',
  accounts: 'Accounts',
  technician: 'Technician (site team)',
  client: 'Client',
};
export const OFFICE_ROLES = ['admin', 'sales', 'drawing', 'stores', 'projects', 'service', 'accounts'];

export const DEPARTMENTS = ['Management', 'Sales', 'Drawing', 'Installation', 'Service', 'Material & Dispatch', 'Accounts', 'Office'];

// Which pages each role sees (in sidebar order)
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '◧', roles: OFFICE_ROLES },
  { key: 'enquiries', label: 'Enquiries & Quotes', icon: '✦', roles: ['admin', 'sales'] },
  { key: 'orders', label: 'Orders', icon: '▤', roles: OFFICE_ROLES },
  { key: 'clients', label: 'Clients', icon: '◉', roles: ['admin', 'sales', 'service', 'accounts'] },
  { key: 'billing', label: 'Billing & Payments', icon: '₹', roles: ['admin', 'accounts'] },
  { key: 'service', label: 'Service & AMC', icon: '⚙', roles: ['admin', 'service', 'projects'] },
  { key: 'inventory', label: 'Material & Stock', icon: '▦', roles: ['admin', 'stores', 'projects'] },
  { key: 'staff', label: 'Staff & Teams', icon: '☺', roles: ['admin', 'accounts', 'projects', 'service'] },
  { key: 'tech', label: 'Field App', icon: '⚒', roles: ['admin', 'technician', 'projects', 'service'] },
  { key: 'audit', label: 'Audit Log', icon: '☰', roles: ['admin'] },
  { key: 'settings', label: 'Settings & Users', icon: '⚙︎', roles: ['admin'] },
];

export const PROJECT_STATUSES = ['Enquiry', 'Order', 'On Hold', 'Completed', 'Lost', 'Cancelled'];
export const ENQ_STATUSES = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Negotiation'];
export const LEAD_SOURCES = ['Website', 'WhatsApp', 'Phone', 'Referral', 'Architect / Builder', 'IndiaMART', 'Walk-in', 'Existing client', 'Other'];
export const MATERIAL_STATUSES = ['Pending', 'Procuring', 'Ready to dispatch', 'Dispatched', 'Delivered'];
export const TEAM_TYPES = ['Installation', 'Service'];

export const SITE_CHECKLIST = [
  'Shaft construction complete & plastered',
  'Pit ready, dry & at correct depth',
  'Machine room / top lifting hook ready',
  'Door openings at all floors as per drawing',
  '3-phase power supply available at site',
  'Scaffolding arranged',
  'Safe storage space for material',
];
export const INSTALL_STEPS = [
  'Scaffolding & plumbing',
  'Guide rails & brackets',
  'Machine & controller',
  'Car frame & cabin',
  'Counterweight & ropes / belts',
  'Landing doors & car door',
  'Wiring & travelling cable',
  'Testing & commissioning',
];

export const DEFAULT_MILESTONES = [
  { name: 'Advance on order', percent: 40 },
  { name: 'Before material dispatch', percent: 40 },
  { name: 'On installation complete', percent: 15 },
  { name: 'On handover', percent: 5 },
];

export const LIFT_TYPES = ['Passenger', 'Home Lift', 'Hospital / Stretcher', 'Goods', 'Car Lift', 'Dumbwaiter', 'Hydraulic', 'Capsule / Glass', 'Escalator'];
export const DOOR_TYPES = ['Auto Centre Opening', 'Auto Side Opening', 'Manual Swing', 'Collapsible', 'Imperforate Telescopic'];
export const DRIVES = ['MRL (Gearless)', 'Machine Room (Geared)', 'Machine Room (Gearless)', 'Hydraulic'];

export const COMPLAINT_STATUSES = ['Open', 'Assigned', 'In Progress', 'Resolved', 'Closed'];
export const PRIORITIES = ['Low', 'Normal', 'High', 'Critical (Trapped / Stuck)'];
export const AMC_TYPES = ['Comprehensive', 'Non-Comprehensive', 'Labour Only'];
export const VISIT_TYPES = ['AMC Preventive Visit', 'Breakdown / Complaint', 'Installation Work', 'Site Survey', 'Testing & Commissioning'];
export const PAY_MODES = ['Bank Transfer / NEFT', 'UPI', 'Cheque', 'Cash', 'Other'];
export const PO_STATUSES = ['Draft', 'Ordered', 'Received', 'Cancelled'];
export const ITEM_CATEGORIES = ['Machine / Motor', 'Controller', 'Doors', 'Cabin', 'Guide Rails', 'Ropes & Belts', 'Electrical', 'Safety Devices', 'Hardware', 'Spares', 'Other'];
export const UNITS = ['Nos', 'Set', 'Mtr', 'Kg', 'Ltr', 'Box', 'Roll'];

export const AMC_CHECKLIST = [
  'Machine & gearbox oil level',
  'Brake operation & lining',
  'Ropes / belts condition',
  'Door operation & sensors',
  'Car & landing buttons',
  'Emergency alarm & intercom',
  'ARD / rescue device',
  'Limit switches & safety gear',
  'Pit cleaned & checked',
  'Lighting & fan in cabin',
];

// GST state codes (first two digits of a GSTIN)
export const STATES = [
  ['01', 'Jammu and Kashmir'], ['02', 'Himachal Pradesh'], ['03', 'Punjab'], ['04', 'Chandigarh'], ['05', 'Uttarakhand'],
  ['06', 'Haryana'], ['07', 'Delhi'], ['08', 'Rajasthan'], ['09', 'Uttar Pradesh'], ['10', 'Bihar'], ['11', 'Sikkim'],
  ['12', 'Arunachal Pradesh'], ['13', 'Nagaland'], ['14', 'Manipur'], ['15', 'Mizoram'], ['16', 'Tripura'], ['17', 'Meghalaya'],
  ['18', 'Assam'], ['19', 'West Bengal'], ['20', 'Jharkhand'], ['21', 'Odisha'], ['22', 'Chhattisgarh'], ['23', 'Madhya Pradesh'],
  ['24', 'Gujarat'], ['26', 'Dadra and Nagar Haveli and Daman and Diu'], ['27', 'Maharashtra'], ['29', 'Karnataka'], ['30', 'Goa'],
  ['31', 'Lakshadweep'], ['32', 'Kerala'], ['33', 'Tamil Nadu'], ['34', 'Puducherry'], ['35', 'Andaman and Nicobar Islands'],
  ['36', 'Telangana'], ['37', 'Andhra Pradesh'], ['38', 'Ladakh'],
];
export const STATE_NAMES = STATES.map((s) => s[1]);
export const stateCode = (name) => STATES.find((s) => s[1] === name)?.[0] || '';
export const stateFromGstin = (g) => STATES.find((s) => s[0] === String(g || '').slice(0, 2))?.[1] || '';
