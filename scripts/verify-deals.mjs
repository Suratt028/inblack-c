#!/usr/bin/env node
// ตรวจ data/deals.json แบบอิสระจาก transform.mjs: เทียบกลับไปที่ raw response ทีละดีล
// ออก exit code 1 ถ้ามีจุดใดไม่ผ่าน — ใช้ใน hook / CI / Skill gameprice-check
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const j = JSON.parse(await readFile(path.join(ROOT, "data/deals.json"), "utf8"));
const raw = JSON.parse(await readFile(path.join(ROOT, j.sources.raw_file), "utf8"));

const fails = [];
const check = (ok, msg) => { if (!ok) fails.push(msg); };
const r2 = (x) => Math.round((x + Number.EPSILON) * 100) / 100;

const rate = raw.fx.rates.THB;
check(j.fx.rate === rate, `fx.rate ${j.fx.rate} ≠ raw ${rate}`);
check(j.fx.rate_date === raw.fx.date, `fx.rate_date ${j.fx.rate_date} ≠ raw ${raw.fx.date}`);
check(j.deals.length === 20, `ต้องมี 20 ดีล แต่มี ${j.deals.length}`);
check(raw.request_count <= 5, `ใช้ ${raw.request_count} คำขอ (เกิน 5)`);
check(new Set(j.deals.map((d) => d.deal_id)).size === j.deals.length, "deal_id ซ้ำ");
check(new Set(j.deals.map((d) => d.game_id)).size === j.deals.length, "game_id ซ้ำ");

const rawDeals = new Map(raw.deals.map((d) => [d.dealID, d]));
const stores = new Map(raw.stores.map((s) => [String(s.storeID), s]));
for (const d of j.deals) {
  const src = rawDeals.get(d.deal_id);
  const tag = `[${d.title}]`;
  if (!src) { fails.push(`${tag} ไม่พบ dealID ใน raw`); continue; }
  const st = stores.get(d.store_id);
  check(st && st.isActive === 1, `${tag} ร้าน ${d.store_id} ไม่ได้เปิดอยู่`);
  check(st && st.storeName === d.store_name, `${tag} store_name ไม่ตรง`);
  check(d.game_id === src.gameID, `${tag} game_id ไม่ตรง raw`);
  check(d.sale_usd === Number(src.salePrice), `${tag} sale_usd ${d.sale_usd} ≠ raw ${src.salePrice}`);
  check(d.normal_usd === Number(src.normalPrice), `${tag} normal_usd ${d.normal_usd} ≠ raw ${src.normalPrice}`);
  check(d.sale_thb === r2(d.sale_usd * rate), `${tag} sale_thb ${d.sale_thb} ≠ ${r2(d.sale_usd * rate)}`);
  check(d.normal_thb === r2(d.normal_usd * rate), `${tag} normal_thb ${d.normal_thb} ≠ ${r2(d.normal_usd * rate)}`);
  const sv = r2((1 - d.sale_usd / d.normal_usd) * 100);
  check(d.savings_percent === sv, `${tag} savings ${d.savings_percent} ≠ ${sv}`);
  check(Math.abs(sv - Number(src.savings)) < 0.01, `${tag} savings ต่างจาก API เกิน 0.01 (${src.savings})`);
  check(d.sale_usd < d.normal_usd, `${tag} ไม่ได้ลดราคาจริง`);
  check(d.cheapshark_url === `https://www.cheapshark.com/redirect?dealID=${d.deal_id}`, `${tag} ลิงก์ไม่ใช่ CheapShark redirect`);
  check(!/\s{2,}/.test(d.title) && d.title === d.title.trim(), `${tag} ชื่อยังมีช่องว่างเกิน`);
}

if (fails.length) {
  console.error(`✗ verify-deals: ${fails.length} จุดไม่ผ่าน`);
  for (const f of fails) console.error("  - " + f);
  process.exit(1);
}
console.log(`✓ verify-deals: 20 ดีลตรงกับ raw (${j.sources.raw_file}), อัตรา ${rate} วันที่ ${raw.fx.date}`);
