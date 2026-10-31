// A login can have several roles (e.g. Sales + Accounts). Older logins have a single `role`.
import { ROLES, OFFICE_ROLES } from './constants';

export const rolesOf = (u) => (Array.isArray(u?.roles) && u.roles.length ? u.roles : u?.role ? [u.role] : []);
export const isAdminU = (u) => rolesOf(u).includes('admin');
// true if the user is Admin or has any of the given roles
export const hasAny = (u, ...r) => { const x = rolesOf(u); return x.includes('admin') || r.flat().some((k) => x.includes(k)); };
export const isOfficeU = (u) => rolesOf(u).some((r) => OFFICE_ROLES.includes(r));
export const techOnly = (u) => rolesOf(u).includes('technician') && !isOfficeU(u);
export const isClientU = (u) => rolesOf(u).includes('client') && !isOfficeU(u);
export const roleLabel = (u) => rolesOf(u).map((r) => ROLES[r] || r).join(' · ');

export const ROLE_INFO = [
  ['admin', 'Admin / Owner', 'Sees and can change everything, manages logins'],
  ['sales', 'Sales', 'Clients, enquiries, quotations, confirm orders'],
  ['drawing', 'Drawing', 'Upload and issue drawings on orders'],
  ['stores', 'Material & Dispatch', 'Confirm advance, stock, purchase orders, dispatch'],
  ['projects', 'Installation manager', 'Site readiness, teams, installation, handover'],
  ['service', 'Service & AMC', 'Complaints, AMC contracts, service visits'],
  ['accounts', 'Accounts', 'Invoices, payments, salaries & attendance'],
  ['technician', 'Technician (phone app)', "Only their own team's sites and jobs"],
];
