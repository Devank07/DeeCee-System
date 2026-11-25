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
| **Quotation** | Sales | *Enquiries → + New client enquiry*: a 4-step form (client & site → lift & shaft → car & finish → price & terms) with DeeCee's usual values pre-filled. It creates the client tab and the quotation in the DeeCee 4-page proposal format (letter, technical specifications, cost summary + AMC + commercial terms, scope + T&C + bank) with Ref No. like DCEPL/UP/AG/26/10/2830. *Print / PDF* saves it as a PDF named after the client. | — |
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
| Accounts | Dashboard, Reports, Clients, Orders, Billing (incl. CA / Tally export), Staff & attendance |
| **Technician** | **Phone app only — just their own team's sites and jobs**: drawings, site status, installation progress, photos (shared with the client), job reports with customer signature, check-in |
| Client | Their own portal (phone-first): see the **Client portal** section below |

This is enforced by the database rules (`firestore.rules`), not just hidden in the menu. A technician's phone cannot load another team's site even if they know the link.

## Client portal
Clients log in at the same address with the login you create (**Clients → open client → Client portal login**). On a phone it has a bottom tab bar:
- **Home** — progress ring, current stage and target handover, *Needs your attention* (pay advance, approve drawing, get site ready, invoice due, rate a fix), quick actions, and **your Dee Cee team**: salesperson, site-team leader and office, with Call / WhatsApp buttons.
- **Progress** — all 8 stages explained in plain words with dates, *your part* where the client must act, installation checklist, site photos, all updates.
- **Documents** — separate sections for **Quotations** (current + earlier versions), **Drawings** (approve / ask for changes), **Invoices**, **Payment receipts** and **Other documents**. Every document can be viewed, downloaded as PDF or sent on WhatsApp.
- **Payments** — order value / paid / balance, milestones, invoices to pay, bank details with Copy, and **I have made a payment** (amount, UTR, screenshot).
- **Service** — report a problem (with photo), complaint tracker (Received → Assigned → In progress → Resolved, with team name), AMC status and **Request renewal**, upcoming visits, service history, and star ratings.

**What clients send reaches the office** as *From the client* on the client tab and *From clients* on the Dashboard (with a red count on the menu). On the client tab the buttons do the real work: **Record this payment** (pre-filled), **Mark drawing approved**, **Verified — mark site ready**. Any reply typed there shows up in the client's portal.
Contact cards are copied automatically from the staff record (salesperson) and the team leader of the assigned site team, so keep their phone numbers filled in under Staff & Teams.

## Owner tools
- **Reports** (Admin, Accounts): per financial year — sales funnel (enquiries → quoted → won, win rate, lost reasons), orders booked vs money collected by month, **profit per order** (order value without GST minus material purchase orders, or the internal costing), salesperson performance, and who owes us. Every table exports to CSV.
- **Reminders** on the Dashboard, each with a one-tap **WhatsApp** message: follow-ups due (Sales), invoices due in 3 days or overdue (Accounts), AMC ending in 30 days (Service), site not ready 2+ weeks after the order (Sales / Installation), lift licence pending or expiring (Installation). ✕ hides one for 3 days.
- **AMC billing**: each AMC has a billing cycle (yearly, half-yearly, quarterly, monthly). *AMC bills due* (Dashboard, Billing, Service → AMC) lists the running period's unbilled invoice — **Raise all** creates them (SAC from Settings, GST 18%, due in 15 days) and the client sees them in the portal.
- **Lift licence** on every client tab: status (applied → inspection → issued), number, validity, upload a copy. All licences: *Service & AMC → Lift licences*. The client sees the status in the portal.
- **Handover pack** (client tab, after handover): Handover Certificate, Warranty Card and AMC Offer as PDFs — print, send on WhatsApp, or **Save all 3 to client documents** (they appear in the client's portal).
- **Client portal invite**: *Client portal* on the client tab or client page (and offered right after *Order confirmed*). Creates the client's login — **their mobile number** + an auto password — and opens WhatsApp with the link and login. Clients can sign in with the mobile number instead of an email. Set the address you send in *Settings → Company → Client portal address*.
- **Export for CA / Tally** (*Billing → Export for CA / Tally*): pick a period → **Excel** (sales register with CGST/SGST/IGST, receipts, HSN summary, GST summary B2B/B2C, cancelled invoices) and **Tally XML** (1: party ledgers, 2: sales + receipt vouchers with bill references). Ledger names are set in *Settings → Company*; they must match your Tally ledgers.

## Phones
- **Install as an app**: the ⤓ button (or on iPhone: Share → Add to Home Screen) puts a Dee Cee icon on the home screen; it opens full-screen. The app keeps working when the signal drops — changes are sent when the internet is back.
- **Technician check-in** with a selfie and GPS location, and check-out; field jobs record where they were started and completed. The office sees the photo and 📍 map links in *Staff & Teams → Mark attendance* and on each job.
- **Hindi**: the हिंदी / EN button in the technician app and the client portal.

## Other modules
- **Billing**: GST tax invoices with HSN/SAC per line and *place of supply* (CGST+SGST in your state, IGST outside), amount in words, cancel invoice (number kept), payments by milestone, **Admin can delete** a wrong/test payment (invoice balance and advance are reversed) or a test invoice (with its payments) — every deletion stays in the Audit log, order balances, invoice ageing, WhatsApp reminders.
- **Service & AMC**: complaints → assign a service team → visit; AMC contracts, renewal alerts, one-click yearly maintenance schedule, AMC billing.
- **Alerts**: a new complaint (e.g. from the client portal) shows a red banner with a sound for Admin and Service, plus a desktop notification if turned on. *(Phone push notifications need Firebase's paid plan and are not included yet.)*
- **Material & Stock**: stock with minimum levels, purchase orders (receive → stock in), dispatch challans, vendors, stock ledger. Stock and payment totals update safely even when two people save at the same moment.
- **Staff & Teams**: staff records, **site teams** (installation crews, service team), attendance; salaries visible only to Admin & Accounts.
- **Send on WhatsApp**: every quotation, invoice, delivery challan, purchase order, drawing and uploaded document has a green *Send on WhatsApp* button. It makes the PDF (named after the client), fills in the client's number and a ready message. On a phone (or a Windows PC with the WhatsApp app) the PDF is attached directly through the share menu; on other computers the PDF is downloaded and the client's WhatsApp chat opens with the message — attach it with 📎 → Document.
- **Audit log**, **CSV export** on every table, **full backup** in Settings.

---

## Version number
The version (e.g. **v2.1.0**) shows on the login screen, under your name in the sidebar, at the bottom of the client portal and in the technician app. Click it to see what changed in each version. When a newer version is deployed, everyone with the app open gets a **“A new version is available — Refresh now”** notice.
For every release: add an entry at the top of `src/changelog.js` and set the same number in `package.json` → `"version"`.

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
1. **Settings → Company & Quotation settings**: check the letterhead details, paste your **bank details**, upload the **authorised signatory's signature**, and set the **next quotation serial no.** (e.g. 2830).
2. **Staff directory**: for each salesperson, fill in *Quotation sign-off* (name, firm, address, mobile, email) — it prints on page 1.
3. **Settings → Company**: address, **state**, GSTIN, bank details, default **HSN/SAC** codes (confirm with your CA), quotation terms.
4. **Staff & Teams → Staff directory**: add everyone. Tick *Field technician* for fitters/helpers/service engineers.
5. **Staff & Teams → Site teams**: create e.g. *Installation Team A*, *Installation Team B*, *Service Team* and add members.
6. Give logins from the same staff form: open the person → **System access** → tick *Give a login*, enter email + temporary password, and tick what they can access (Sales, Drawing, Material & Dispatch, Installation manager, Service & AMC, Accounts, Technician, Admin — several allowed). Change or block access later from the same place. All logins are also listed in **Settings → Logins & access**.
7. For clients who should use the portal: **Clients → open client → Client portal login**.

## Importing your old register (Excel)
**Settings → Import old data** (Admin). In Google Sheets: *File → Download → Microsoft Excel (.xlsx)*, then choose the file.
- Row colour decides the status: **white** = quote to be given, **yellow** = quote given, **green** = order confirmed (choose whether green rows are running or completed). Other colours can be mapped or skipped.
- Columns (changeable): A serial (used in Ref No.), B building type, C address, D city, E client name, F phone, G other, H lifts e.g. `1(6P)HYD`, I architect / referred by, J date, K spec e.g. `G+3,ACO/RG/GD/MRL,W=1550XD=1650`, L costing (lakh), M quoted price (lakh).
- Codes are decoded: persons → load, HYD/MRL drive, ACO/ATSD doors, GD glass door, RG rose gold, SS steel, W×D shaft size, floors & stops.
- Costing is stored privately (Admin, Sales, Accounts only) and shows margin on the client tab.
- Re-importing is safe: serials already imported are skipped. Rows can be limited by date.

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
