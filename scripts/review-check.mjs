#!/usr/bin/env node
// ตัวตรวจของ reviewer — เขียนแยกจาก transform.mjs / verify-deals.mjs โดยตั้งใจ
// - คิดเงินด้วยเลขจำนวนเต็มทศนิยมแน่นอน (BigInt) ไม่ใช้ float + EPSILON
// - คัดเลือก 20 ดีลใหม่เองจาก raw แล้วเทียบชุด/ลำดับกับ deals.json
// ใช้: node scripts/review-check.mjs   (exit 1 ถ้ามีจุดไม่ผ่าน)
import { readFileSync } from "node:fs";

const j = JSON.parse(readFileSync(new URL("../data/deals.json", import.meta.url), "utf8"));
const raw = JSON.parse(readFileSync(new URL("../" + j.sources.raw_file, import.meta.url), "utf8"));
const fails = [];
const ok = (c, m) => { if (!c) fails.push(m); };

// "33.975" → { n: 33975n, s: 3 }
const dec = (x) => {
  const str = String(x);
  if (!/^\d+(\.\d+)?$/.test(str)) throw new Error("ไม่ใช่ทศนิยมบวก: " + str);
  const [i, f = ""] = str.split(".");
  return { n: BigInt(i + f), s: f.length };
};
// ปัดครึ่งขึ้นเป็น 2 ตำแหน่ง แล้วคืน Number
const round2exact = ({ n, s }) => {
  if (s <= 2) return Number(n * 10n ** BigInt(2 - s)) / 100;
  const div = 10n ** BigInt(s - 2);
  let q = n / div;
  if ((n % div) * 2n >= div) q += 1n;
  return Number(q) / 100;
};
const mul = (a, b) => ({ n: a.n * b.n, s: a.s + b.s });
const thb = (usdStr, rateStr) => round2exact(mul(dec(usdStr), dec(rateStr)));
// savings = (1 − sale/normal)×100 ปัด 2 ตำแหน่ง แบบแน่นอน: (normal−sale)×10000 / normal
const savings = (saleStr, normalStr) => {
  const a = dec(saleStr), b = dec(normalStr), s = Math.max(a.s, b.s);
  const sa = a.n * 10n ** BigInt(s - a.s), nb = b.n * 10n ** BigInt(s - b.s);
  const num = (nb - sa) * 10000n;
  let q = num / nb;
  if ((num % nb) * 2n >= nb) q += 1n;
  return Number(q) / 100;
};
const compareSavings = (a, b) => {
  const ratio = (d) => {
    const sale = dec(d.salePrice), normal = dec(d.normalPrice);
    return {
      num: sale.n * 10n ** BigInt(normal.s),
      den: normal.n * 10n ** BigInt(sale.s),
    };
  };
  const x = ratio(a), y = ratio(b);
  const left = x.num * y.den, right = y.num * x.den;
  return left < right ? -1 : left > right ? 1 : 0;
};

const rateStr = String(raw.fx.rates.THB);
ok(j.fx.rate === Number(rateStr), `fx.rate ${j.fx.rate} ≠ raw ${rateStr}`);
ok(j.fx.rate_date === raw.fx.date, `fx.rate_date ${j.fx.rate_date} ≠ raw ${raw.fx.date}`);
ok(raw.fx.base === "USD" && raw.fx.amount === 1, "raw fx ไม่ใช่ base USD amount 1");
ok(j.deals.length === 20, `จำนวนดีล ${j.deals.length}`);
ok(raw.request_count <= 5 && j.sources.request_count === raw.request_count, "request_count");
ok(new Set(j.deals.map((d) => d.game_id)).size === 20, "game_id ซ้ำ");

const stores = Object.fromEntries(raw.stores.map((s) => [String(s.storeID), s]));
const rawById = Object.fromEntries(raw.deals.map((d) => [d.dealID, d]));

// --- คัดเลือกใหม่เอง ---
const active = raw.deals.filter((d) => stores[d.storeID]?.isActive === 1 && Number(d.salePrice) < Number(d.normalPrice));
const best = {};
for (const d of active) {
  const cur = best[d.gameID];
  const better = !cur ||
    Number(d.salePrice) < Number(cur.salePrice) ||
    (Number(d.salePrice) === Number(cur.salePrice) &&
      (Number(d.dealRating) > Number(cur.dealRating) ||
        (Number(d.dealRating) === Number(cur.dealRating) && Number(d.storeID) < Number(cur.storeID))));
  if (better) best[d.gameID] = d;
}
const mine = Object.values(best)
  .sort((a, b) => Number(b.dealRating) - Number(a.dealRating) ||
    compareSavings(a, b) ||
    (a.gameID < b.gameID ? -1 : a.gameID > b.gameID ? 1 : 0))
  .slice(0, 20);
const mineIds = mine.map((d) => d.dealID), theirIds = j.deals.map((d) => d.deal_id);
ok(JSON.stringify(mineIds) === JSON.stringify(theirIds), "ชุด/ลำดับ 20 ดีลไม่ตรงกับการคัดเลือกของ reviewer");
const setDiff = mineIds.filter((x) => !theirIds.includes(x));
ok(setDiff.length === 0, `ดีลที่ reviewer เลือกแต่ deals.json ไม่มี: ${setDiff.join(", ")}`);

// --- ตรวจทีละดีล ---
const rows = [];
for (const d of j.deals) {
  const r = rawById[d.deal_id];
  const t = `[${d.title}]`;
  if (!r) { fails.push(`${t} ไม่มีใน raw`); continue; }
  const eThbSale = thb(r.salePrice, rateStr), eThbNormal = thb(r.normalPrice, rateStr);
  const eSav = savings(r.salePrice, r.normalPrice);
  ok(typeof d.sale_usd === "number" && d.sale_usd === Number(r.salePrice), `${t} sale_usd`);
  ok(typeof d.normal_usd === "number" && d.normal_usd === Number(r.normalPrice), `${t} normal_usd`);
  ok(d.sale_thb === eThbSale, `${t} sale_thb ${d.sale_thb} ≠ ${eThbSale}`);
  ok(d.normal_thb === eThbNormal, `${t} normal_thb ${d.normal_thb} ≠ ${eThbNormal}`);
  ok(d.savings_percent === eSav, `${t} savings ${d.savings_percent} ≠ ${eSav}`);
  ok(d.is_free === (Number(r.salePrice) === 0), `${t} is_free`);
  ok(d.store_id === String(r.storeID) && stores[r.storeID]?.isActive === 1, `${t} ร้านไม่ active`);
  ok(d.store_name === stores[r.storeID]?.storeName, `${t} store_name`);
  ok(d.game_id === String(r.gameID), `${t} game_id`);
  ok(d.cheapshark_url === "https://www.cheapshark.com/redirect?dealID=" + r.dealID, `${t} ลิงก์`);
  ok(new URL(d.cheapshark_url).host === "www.cheapshark.com" && [...new URL(d.cheapshark_url).searchParams.keys()].join() === "dealID", `${t} ลิงก์มีพารามิเตอร์อื่น`);
  ok(d.title === d.title.trim() && !/\s{2}/.test(d.title) && !/&[a-z#0-9]+;/i.test(d.title), `${t} ชื่อไม่สะอาด`);
  rows.push([d.title, r.salePrice, d.sale_thb, eThbSale, d.savings_percent, eSav]);
}

console.log(`rate ${rateStr} (${raw.fx.date}), reviewer เลือกดีลตรงกัน ${mineIds.filter((x, i) => x === theirIds[i]).length}/20 ตำแหน่ง`);
for (const r of [rows[0], rows.find((x) => Number(x[1]) === 0), rows.at(-1)].filter(Boolean))
  console.log(`  ${r[0]}: $${r[1]} × ${rateStr} = ฿${r[3]} (json ฿${r[2]}), savings ${r[5]}% (json ${r[4]}%)`);
if (fails.length) {
  console.error(`✗ review-check: ${fails.length} จุดไม่ผ่าน`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log("✓ review-check: ทุกจุดผ่าน");
