# DeeCee Elevators — Company OS

One system for the whole company: every client project is shared live between Sales, Installation, Purchase & Dispatch, Service, Accounts, the field technicians on their phones, and the client on their own portal.

Built with **React + Firebase** (Authentication + Firestore). Runs on Firebase's free Spark plan, works on desktop and phones, and keeps working offline on site (syncs when signal returns).

---

## What's inside

| Module | What it does |
|---|---|
| **Dashboard** | Money to collect, overdue invoices, open breakdowns, AMC renewals, delayed projects, follow-ups due, low stock, staff present — one "Needs attention" list across all teams |
| **Clients** | Full 360° view of each customer: projects, invoices, dues, AMC, complaints, timeline. Create their portal login |
| **Leads & Quotes** | Lead pipeline with follow-up dates, quotation builder with lift specs, GST, print/PDF, WhatsApp share. **Accepted → creates client + project + payment milestones in one click** |
| **Projects (the hub)** | 10-stage elevator workflow (Order → Survey → Drawing → Civil → Procurement → Dispatch → Installation → Testing → Licence → Handover), payment milestones with "Raise invoice", team, field jobs, material POs/dispatches, site photos, and a shared timeline where any team posts updates (optionally visible to the client) |
| **Billing & Payments** | GST tax invoices (CGST/SGST or IGST auto), amount in words, payments with UTR/cheque, receivables ageing (0–30/31–60/61–90/90+), WhatsApp payment reminders |
| **Service & AMC** | Complaints/breakdowns with priority (incl. "Trapped"), assign technician, AMC contracts with renewal alerts, one-click **preventive-maintenance schedule** for the year, AMC billing, visit reports |
| **Inventory & Purchase** | Stock with minimum levels, purchase orders (receive → stock in), delivery challans to site (stock out + auto project stage update), vendors, full stock ledger |
| **Staff & Attendance** | Staff records, daily attendance (P / Half / Leave / Absent), monthly paid-days report. Salaries are stored separately and only Admin/Accounts can see them |
| **Field App** (phones) | Technician's jobs for today, check-in with location, call/navigate, AMC checklist, work notes, parts used, photos, **customer signature**, complete job (auto-resolves the complaint and informs the client) |
| **Client Portal** | Client sees project stage, expected handover, payment schedule & dues, invoices (print), AMC status, service history, updates — and can **report a lift problem** |
| **Audit Log** | Who created/changed/deleted what, and when |
| **Settings** | Company details (printed on all documents), user logins & roles, full data backup |

Every table has search, sorting and **Export CSV** (opens in Excel).

### Roles
| Role | Sees |
|---|---|
| Admin / Owner | Everything |
| Sales | Dashboard, Clients, Leads & Quotes, Projects, Billing (view) |
| Installation / Projects | Dashboard, Clients, Projects, Service, Inventory (view), Field App |
| Service & AMC | Dashboard, Clients, Projects, Service & AMC, Field App |
| Purchase & Dispatch | Dashboard, Projects, Inventory & Purchase |
| Accounts | Dashboard, Clients, Projects, Billing, Staff & Attendance |
| Field Technician | Field App only (their own jobs and sites) |
| Client | Their own portal only |

These are enforced on the server by `firestore.rules`, not just hidden in the menu.

---

## 1. Try it now (demo mode)

Needs Node.js 18+.

```bash
npm install
npm run dev
```

Open the link it prints. While `src/firebaseConfig.js` is empty the app runs in **demo mode** with sample data saved only in your browser. Tap any demo account on the login screen (all demo passwords are `demo123`).

---

## 2. Go live with Firebase (about 20 minutes)

1. Go to <https://console.firebase.google.com> → **Add project** (e.g. `deecee-erp`). Google Analytics is not needed.
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → *Production mode* → location **asia-south1 (Mumbai)**.
4. **Project settings (⚙) → Your apps → Web (</>)** → register the app → copy the `firebaseConfig` values into `src/firebaseConfig.js`.
5. Install the Firebase CLI and deploy the security rules + app:
   ```bash
   npm install -g firebase-tools
   firebase login
   firebase use --add          # pick your project
   npm run build
   firebase deploy --only firestore:rules,hosting
   ```
   You'll get a link like `https://deecee-erp.web.app`.
6. **Become the Admin:** open the link → *First-time setup (owner only)* → enter your email + a password → on the next screen tap **Set up as Admin**. This works only once; after that nobody else can claim Admin.
7. **Settings → Company**: fill in address, GSTIN, bank details, default quotation terms.
8. **Staff & Attendance → Add staff** (tick *Field technician* for fitters/service engineers).
9. **Settings → Users & roles → Create login** for each person, choosing their role and linking them to their staff record. Share the email + temporary password; they can reset it from the login screen.
10. For each client who should use the portal: **Clients → open client → Client portal login.**

### Use your own domain (optional)
Firebase console → **Hosting → Add custom domain** → e.g. `erp.deeceeelevators.in` → add the DNS records it shows in your domain's DNS panel. HTTPS is set up automatically.

### Install on phones
Open the link in Chrome (Android) or Safari (iPhone) → **Add to Home Screen**. It opens full-screen like an app.

---

## Updating the app later
Edit the code, then:
```bash
npm run build
firebase deploy --only hosting           # app changes
firebase deploy --only firestore:rules   # if you changed firestore.rules
```

## Backups
**Settings → Backup → Download full backup** saves everything as one JSON file. Do this monthly and keep a copy on Google Drive. Every table also exports to CSV.

## Free-tier capacity
The Firebase Spark (free) plan allows roughly 50,000 document reads and 20,000 writes per day and 1 GB of stored data. Site photos are compressed to ~100–150 KB each and stored in Firestore (no paid Storage needed), so 1 GB holds several thousand photos alongside all business data. If you outgrow it, switching to the pay-as-you-go Blaze plan needs no code changes.

---

## Project structure
```
src/
  firebaseConfig.js   ← paste your Firebase config here
  data.js             ← Firebase / demo data layer, audit trail, document numbering (QT/26-27/0001 …)
  constants.js        ← roles, menu access, project stages, milestones, checklists, dropdown lists
  seed.js             ← sample data for demo mode only
  ui.jsx              ← shared components (tables, modals, print layout, signature pad, photos)
  App.jsx             ← login, first-time setup, layout, role-based navigation
  pages/              ← Dashboard, Clients, Sales, Projects, Billing, Service, Inventory, Staff,
                         FieldApp (technicians), Portal (clients), Audit, Settings
firestore.rules       ← server-side permissions per role
```

### Common customisations
- **Project stages / default payment milestones / AMC checklist** → `src/constants.js`
- **Which role sees which menu** → `NAV` in `src/constants.js` (also update `firestore.rules` for write access)
- **Document number prefixes** (QT, INV, PRJ, AMC, CMP, PO, DSP) → where `nextNumber('…')` is called; numbering resets each Indian financial year (April).
