export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (d, n) => { const x = new Date(d || today()); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
export const addMonths = (d, n) => { const x = new Date(d || today()); x.setMonth(x.getMonth() + n); return x.toISOString().slice(0, 10); };
export const daysUntil = (d) => (d ? Math.round((new Date(d) - new Date(today())) / 86400000) : null);

export const fmtDate = (d) => {
  if (!d) return '—';
  const x = typeof d === 'number' ? new Date(d) : new Date(d);
  if (isNaN(x)) return '—';
  return x.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};
export const fmtDateTime = (t) => (t ? new Date(t).toLocaleString('en-IN', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : '—');

export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
export const num = (v) => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };

// Line-item totals with GST
export function calcTotals(items = [], gstRate = 18, discount = 0) {
  const subtotal = items.reduce((s, it) => s + num(it.qty) * num(it.rate), 0);
  const taxable = Math.max(0, subtotal - num(discount));
  const gst = (taxable * num(gstRate)) / 100;
  return { subtotal, discount: num(discount), taxable, gst, total: Math.round(taxable + gst) };
}

// Indian number to words (Rupees)
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
function two(n) { return n < 20 ? ONES[n] : TENS[Math.floor(n / 10)] + (n % 10 ? ' ' + ONES[n % 10] : ''); }
function three(n) { return (n >= 100 ? ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' : '') : '') + (n % 100 ? two(n % 100) : ''); }
export function amountInWords(amount) {
  let n = Math.round(num(amount));
  if (n === 0) return 'Rupees Zero Only';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(two(lakh) + ' Lakh');
  if (thousand) parts.push(two(thousand) + ' Thousand');
  if (n) parts.push(three(n));
  return 'Rupees ' + parts.join(' ') + ' Only';
}

// Compress a photo to a small JPEG data URL (keeps Firestore docs small, no paid Storage needed)
export function compressImage(file, maxSize = 1000, quality = 0.6) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = reject;
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

export function downloadFile(name, content, type = 'text/plain') {
  const blob = new Blob([content], { type });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

export function toCSV(rows, columns) {
  const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const head = columns.map((c) => esc(c.label)).join(',');
  const body = rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : typeof c.value === 'function' ? c.value(r) : r[c.key])).join(',')).join('\n');
  return head + '\n' + body;
}

export const cleanPhone = (p) => { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '91' + d : d; };
export const waLink = (phone, text) => `https://wa.me/${cleanPhone(phone)}?text=${encodeURIComponent(text)}`;
export const mapsLink = (addr) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addr || '')}`;

export const sum = (arr, f) => arr.reduce((s, x) => s + num(typeof f === 'function' ? f(x) : x[f]), 0);
export const byId = (arr) => Object.fromEntries((arr || []).map((x) => [x.id, x]));
export const sortBy = (arr, f, desc = false) => [...arr].sort((a, b) => { const x = f(a), y = f(b); return (x > y ? 1 : x < y ? -1 : 0) * (desc ? -1 : 1); });
