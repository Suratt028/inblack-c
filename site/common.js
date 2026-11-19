// โหลด deals.json ไฟล์เดียวกับที่ commit ใน repo (workflow คัดลอกไป data/deals.json ข้างหน้าเว็บ)
export async function loadDeals() {
  const res = await fetch("data/deals.json", { cache: "no-store" });
  if (!res.ok) throw new Error(`โหลด data/deals.json ไม่ได้ (HTTP ${res.status})`);
  return res.json();
}

const thb = new Intl.NumberFormat("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const usd = new Intl.NumberFormat("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtTHB = (n) => "฿" + thb.format(n);
export const fmtUSD = (n) => "$" + usd.format(n);
export const fmtPct = (n) => `${Number.isInteger(n) ? n : n.toFixed(2)}%`;

export function fmtDate(iso) {
  // "2026-11-18" → "18 พ.ย. 2569"
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
}
export function fmtDateTime(iso) {
  return new Date(iso).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Bangkok" }) + " น.";
}

// ค้นหาแบบไม่สนตัวพิมพ์/เครื่องหมาย: "Assassin's" เจอ "Assassins", "for honor ultimate" เจอ "FOR HONOR  Ultimate"
export const norm = (s) => String(s).toLowerCase().replace(/['’]/g, "").replace(/[^\p{L}\p{M}\p{N}]+/gu, " ").trim();

export function el(tag, attrs = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else n.setAttribute(k, v === true ? "" : v);
  }
  for (const k of kids.flat()) if (k != null) n.append(k instanceof Node ? k : document.createTextNode(String(k)));
  return n;
}
