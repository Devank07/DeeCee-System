# DeeCee Elevators — Company OS

One system for the whole company. Every client gets a **client tab** that moves through the same pipeline, and each team sees only what is waiting for them:

```
Quotation → Order Confirmed → Advance Received → Drawing Issued → Site Ready → Material Dispatched → Installation → Handover
  Sales        Sales           Material/Accounts     Drawing        Installation      Material          Installation   Installation
```

Built with **React + Firebase** (Authentication + Firestore). Live at **https://deecee-elevators.web.app**.

---

## How the order flow works

| Step | Who | What they do | Unlocks when |
|---|---|---|---|
| **Quotation** | Sales | *Enquiries → + New client enquiry*: enter client details and lift requirement. The client tab and a quotation (supply, installation, ARD lines) are created automatically — Sales only enters the prices. Print / WhatsApp the quote, revise it (R1, R2…). | — |
| **Order Confirmed** | Sales | *Order confirmed →*: final value, client PO no., payment milestones (40/40/15/5 by default), target date, installation team. The tab now appears in **Orders** for every team. | Quotation has a price |
| **Advance Received** | Material / Accounts | *Confirm advance received*: records the payment and releases the order to Drawing and Material. | Order confirmed |
| **Drawing Issued** | Drawing team | *+ Upload drawing* (PDF/image, Rev 0, Rev 1…). Everyone — office, the site team and the client — can open and download it. *Approved by client* when signed off. | Advance received |
| **Site Ready** | Installation (manager or site team on phone) | Site readiness checklist (shaft, pit, hook, openings, power, scaffolding, storage) → *Site is ready* / *Not ready* with notes. Client sees the update. | Order confirmed |
| **Material Dispatched** | Material | *Procuring → Ready to dispatch → Dispatch to site* (delivery challan, stock reduced, client & site team informed) → *Mark delivered*. | Advance received **and** site ready |
| **Installation** | Installation / site team | 8-step progress checklist (rails, machine, cabin, doors, wiring, testing…) with % shown to the client. | Material dispatched |
| **Handover** | Installation manager | Handover date, licence done → order Completed → *Create AMC*. | Installation complete |

Locked steps show *why* they're locked (e.g. "Waiting for site ready"). Only the Admin can override a lock.

## Who sees what

| Role | Sees |
|---|---|
| Admin / Owner | Everything |
| Sales | Dashboard, Enquiries & Quotes, Orders, Clients |
| Drawing team | Dashboard, Orders (uploads drawings) |
| Material & Dispatch | Dashboard, Orders (advance, dispatch), Material & Stock |
| Installation manager | Dashboard, Orders (site, team, installation, handover), Service, Staff & Teams, Field App |
| Service & AMC | Dashboard, Clients, Orders, Service & AMC, Staff & Teams, Field App |
| Accounts | Dashboard, Clients, Orders, Billing, Staff & attendance |
| **Technician** | **Phone app only — just their own team's sites and jobs**: drawings, site status, installation progress, photos (shared with the client), job reports with customer signature, check-in |
| Client | Their own portal: live pipeline, drawings, photos, payments, invoices, AMC, report a problem |

This is enforced by the database rules (`firestore.rules`), not just hidden in the menu. A technician's phone cannot load another team's site even if they know the link.

## Other modules
- **Billing**: GST tax invoices with HSN/SAC per line and *place of supply* (CGST+SGST in your state, IGST outside), amount in words, cancel invoice (number kept), payments by milestone, order balances, invoice ageing, WhatsApp reminders.
- **Service & AMC**: complaints → assign a service team → visit; AMC contracts, renewal alerts, one-click yearly maintenance schedule, AMC billing.
- **Alerts**: a new complaint (e.g. from the client portal) shows a red banner with a sound for Admin and Service, plus a desktop notification if turned on. *(Phone push notifications need Firebase's paid plan and are not included yet.)*
- **Material & Stock**: stock with minimum levels, purchase orders (receive → stock in), dispatch challans, vendors, stock ledger. Stock and payment totals update safely even when two people save at the same moment.
- **Staff & Teams**: staff records, **site teams** (installation crews, service team), attendance; salaries visible only to Admin & Accounts.
- **Audit log**, **CSV export** on every table, **full backup** in Settings.

---

## Update the live site (after pulling new code)

On your computer, in the `DeeCee-System` folder:

```bash
git pull
npm install
npm run build
firebase deploy --only firestore,hosting
```

`firestore` deploys both the security rules and the database indexes the team views need. The indexes take a few minutes to build after the first deploy — if a list looks empty right after deploying, wait 5 minutes and refresh.

## First-time setup checklist
1. **Settings → Company**: address, **state**, GSTIN, bank details, default **HSN/SAC** codes (confirm with your CA), quotation terms.
2. **Staff & Teams → Staff directory**: add everyone. Tick *Field technician* for fitters/helpers/service engineers.
3. **Staff & Teams → Site teams**: create e.g. *Installation Team A*, *Installation Team B*, *Service Team* and add members.
4. **Settings → Users & roles → Create login** for each person with their role. Technicians must be linked to their staff record.
5. For clients who should use the portal: **Clients → open client → Client portal login**.

## Free-plan notes
- Drawings and documents are stored inside the database in pieces (max **12 MB** per file) so no paid Storage is needed. Keep drawings as compact PDFs. The free plan has 1 GB in total — enough for several hundred drawings plus all business data. If you outgrow it, Firebase's pay-as-you-go plan can be switched on without code changes.
- The JSON backup does not include drawing files — keep originals in the drawing team's folder.

## Try it without touching live data
`npm run dev` uses the live Firebase project. For a demo with sample data, build with `VITE_DEMO=1 npm run build` (or blank out `apiKey` in `src/firebaseConfig.js`).

---

## Project structure
```
src/
  firebaseConfig.js   ← Firebase project settings
  data.js             ← data layer: Firebase/demo, audit trail, numbering, safe increments, file storage
  workflow.js         ← the 8-step pipeline: who acts, what unlocks what
  constants.js        ← roles & menus, checklists, milestones, GST state codes, dropdown lists
  seed.js             ← sample data for demo mode only
  ui.jsx              ← shared components (pipeline, tables, modals, files, photos, print layout)
  App.jsx             ← login, layout, menu badges, complaint alerts
  pages/              ← Dashboard, Enquiries, Orders (client tab), Clients, Billing, Service,
                         Inventory, Staff (teams), FieldApp (technicians), Portal (clients), Audit, Settings
firestore.rules       ← server-side permissions per role and per team
firestore.indexes.json← database indexes for team & client views
```
