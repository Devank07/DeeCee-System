export const ROLES = {
  admin: 'Admin / Owner',
  sales: 'Sales',
  projects: 'Installation / Projects',
  service: 'Service & AMC',
  stores: 'Purchase & Dispatch',
  accounts: 'Accounts',
  technician: 'Field Technician',
  client: 'Client',
};

export const DEPARTMENTS = ['Management', 'Sales', 'Installation', 'Service', 'Purchase & Dispatch', 'Accounts', 'Office'];

// Which pages each role sees (in sidebar order)
export const NAV = [
  { key: 'dashboard', label: 'Dashboard', icon: '◧', roles: ['admin', 'sales', 'projects', 'service', 'stores', 'accounts'] },
  { key: 'clients', label: 'Clients', icon: '◉', roles: ['admin', 'sales', 'projects', 'service', 'accounts'] },
  { key: 'sales', label: 'Leads & Quotes', icon: '✦', roles: ['admin', 'sales'] },
  { key: 'projects', label: 'Projects', icon: '▤', roles: ['admin', 'sales', 'projects', 'service', 'stores', 'accounts'] },
  { key: 'billing', label: 'Billing & Payments', icon: '₹', roles: ['admin', 'accounts', 'sales'] },
  { key: 'service', label: 'Service & AMC', icon: '⚙', roles: ['admin', 'service', 'projects'] },
  { key: 'inventory', label: 'Inventory & Purchase', icon: '▦', roles: ['admin', 'stores', 'projects'] },
  { key: 'staff', label: 'Staff & Attendance', icon: '☺', roles: ['admin', 'accounts'] },
  { key: 'tech', label: 'Field App', icon: '⚒', roles: ['admin', 'technician', 'service', 'projects'] },
  { key: 'audit', label: 'Audit Log', icon: '☰', roles: ['admin'] },
  { key: 'settings', label: 'Settings & Users', icon: '⚙︎', roles: ['admin'] },
];

export const PROJECT_STAGES = [
  'Order Confirmed',
  'Site Survey & Drawing',
  'Drawing Approved',
  'Shaft & Pit Ready (Civil)',
  'Material Procurement',
  'Material Dispatched',
  'Installation',
  'Testing & Commissioning',
  'Lift Licence / Inspection',
  'Handover',
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

export const LEAD_STATUSES = ['New', 'Contacted', 'Site Visit', 'Quoted', 'Negotiation', 'Won', 'Lost'];
export const LEAD_SOURCES = ['Website', 'WhatsApp', 'Phone', 'Referral', 'Architect / Builder', 'IndiaMART', 'Walk-in', 'Other'];
export const QUOTE_STATUSES = ['Draft', 'Sent', 'Accepted', 'Rejected'];
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
